"""
ChatKit server: stream OpenAI Agents runs into ChatKit thread events.
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from agents import MaxTurnsExceeded, Runner, RunConfig
from chatkit.agents import AgentContext, stream_agent_response
from chatkit.errors import ErrorCode
from chatkit.server import ChatKitServer
from chatkit.store import NotFoundError
from chatkit.types import (
    ErrorEvent,
    Page,
    StreamingReq,
    Thread,
    ThreadCreatedEvent,
    ThreadMetadata,
    ThreadsAddUserMessageReq,
    ThreadsCreateReq,
    ThreadStreamEvent,
    UserMessageItem,
)

from services.chatkit_attachment_store import MemoryAttachmentStore
from services.chatkit_fashion_agent import fashion_stylist_agent
from services.chatkit_store_factory import create_chatkit_store
from services.chatkit_orchestration import resolve_chatkit_llm_turn
from services.chatkit_thread_converter import FashionThreadItemConverter

logger = logging.getLogger(__name__)

MAX_RECENT_ITEMS = 30

# ThreadMetadata.metadata key: maps user message item id -> scene used for that turn (client header)
FASHION_REC_MESSAGE_BACKGROUNDS = "fashion_rec_message_backgrounds"


def _chatkit_max_turns() -> int:
    # Each tool round-trip counts as turns; outfit + VL + try-on chains can exceed 40 in one user message.
    raw = (os.getenv("CHATKIT_MAX_TURNS") or "100").strip()
    try:
        n = int(raw)
    except ValueError:
        return 100
    return max(10, min(n, 200))


def _ensure_chatkit_orchestration_credentials(
    *, model_name: str, run_config: RunConfig | None
) -> None:
    """
    Default orchestration uses the OpenAI client; without OPENAI_API_KEY the Agents SDK
    raises a generic OpenAIError deep in the stream (see chatkit server logs).
    """
    if run_config is not None:
        return
    if (os.getenv("OPENAI_API_KEY") or "").strip():
        return
    msg = (
        "OPENAI_API_KEY is not set while CHATKIT_LLM_PROVIDER=openai "
        f"(model={model_name}). Set OPENAI_API_KEY, or use default xAI orchestration "
        "(unset CHATKIT_LLM_PROVIDER or set CHATKIT_LLM_PROVIDER=xai) with XAI_API_KEY."
    )
    logger.error(msg)
    raise RuntimeError(msg)


class FashionChatKitServer(ChatKitServer[dict[str, Any]]):
    def __init__(self) -> None:
        self.store = create_chatkit_store()
        self._attachment_store = MemoryAttachmentStore(self.store)
        self._thread_converter = FashionThreadItemConverter(self.store)
        super().__init__(self.store, attachment_store=self._attachment_store)

    async def _persist_scene_background_for_user_message(
        self,
        thread_id: str,
        user_message_id: str,
        request_metadata: dict[str, Any],
        context: dict[str, Any],
    ) -> None:
        raw = (request_metadata or {}).get("background_image_url")
        if not isinstance(raw, str) or not raw.strip():
            return
        url = raw.strip()
        prompt_raw = (request_metadata or {}).get("background_action_prompt")
        prompt_str = prompt_raw.strip() if isinstance(prompt_raw, str) else ""

        meta = await self.store.load_thread(thread_id, context=context)
        md = dict(meta.metadata or {})
        inner = md.get(FASHION_REC_MESSAGE_BACKGROUNDS)
        if not isinstance(inner, dict):
            inner = {}
        else:
            inner = dict(inner)
        inner[user_message_id] = {
            "background_image_url": url,
            "background_action_prompt": prompt_str,
        }
        md[FASHION_REC_MESSAGE_BACKGROUNDS] = inner
        meta.metadata = md
        await self.store.save_thread(meta, context=context)

    @staticmethod
    def _merge_thread_create_metadata(
        request: ThreadsCreateReq,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        md = dict(request.metadata) if request.metadata else {}
        uid = context.get("user_id")
        if uid is not None:
            md["user_id"] = str(uid)
        return md

    async def _process_streaming_impl(
        self,
        request: StreamingReq,
        context: dict[str, Any],
    ) -> AsyncIterator[ThreadStreamEvent]:
        """
        threads.create: merge request.metadata + context user_id into ThreadMetadata.metadata
        (base ChatKit server ignores request.metadata on create).

        Other ops: wrap NotFoundError so stale thread_ids get ErrorEvent instead of broken SSE.
        """
        if isinstance(request, ThreadsCreateReq):
            thread = Thread(
                id=self.store.generate_thread_id(context),
                created_at=datetime.now(),
                items=Page(),
                metadata=self._merge_thread_create_metadata(request, context),
            )
            await self.store.save_thread(
                ThreadMetadata(**thread.model_dump()),
                context=context,
            )
            yield ThreadCreatedEvent(thread=self._to_thread_response(thread))
            user_message = await self._build_user_message_item(
                request.params.input,
                thread,
                context,
            )
            await self._persist_scene_background_for_user_message(
                thread.id,
                user_message.id,
                dict(request.metadata or {}),
                context,
            )
            async for event in self._process_new_thread_item_respond(
                thread,
                user_message,
                context,
            ):
                yield event
            return

        if isinstance(request, ThreadsAddUserMessageReq):
            try:
                thread = await self.store.load_thread(
                    request.params.thread_id, context=context
                )
            except NotFoundError:
                logger.warning(
                    "[ChatKit] threads.add_user_message — thread not found: %s",
                    request.params.thread_id,
                )
                yield ErrorEvent(
                    code=ErrorCode.STREAM_ERROR,
                    message=(
                        "此会话在后端已不存在（常见于服务重启或使用内存存储）。请新建对话后再试。"
                    ),
                    allow_retry=False,
                )
                return
            user_message = await self._build_user_message_item(
                request.params.input,
                thread,
                context,
            )
            await self._persist_scene_background_for_user_message(
                thread.id,
                user_message.id,
                dict(request.metadata or {}),
                context,
            )
            async for event in self._process_new_thread_item_respond(
                thread,
                user_message,
                context,
            ):
                yield event
            return

        try:
            async for event in super()._process_streaming_impl(request, context):
                yield event
        except NotFoundError as e:
            logger.warning("[ChatKit] Stream aborted — store miss (stale thread / restart?): %s", e)
            yield ErrorEvent(
                code=ErrorCode.STREAM_ERROR,
                message=(
                    "此会话在后端已不存在（常见于服务重启或使用内存存储）。请新建对话后再试。"
                ),
                allow_retry=False,
            )

    async def respond(
        self,
        thread: ThreadMetadata,
        input_user_message: UserMessageItem | None,
        context: dict[str, Any],
    ) -> AsyncIterator[ThreadStreamEvent]:
        items_page = await self.store.load_thread_items(
            thread.id,
            after=None,
            limit=MAX_RECENT_ITEMS,
            order="desc",
            context=context,
        )
        items = list(reversed(items_page.data))
        agent_input = await self._thread_converter.to_agent_input(items)

        agent_context = AgentContext(
            thread=thread,
            store=self.store,
            request_context=context,
        )

        model_name, run_config = resolve_chatkit_llm_turn(items, input_user_message)
        _ensure_chatkit_orchestration_credentials(
            model_name=model_name, run_config=run_config
        )
        agent = fashion_stylist_agent.clone(model=model_name)
        logger.info(
            "[ChatKit] orchestration model=%s run_config_custom=%s",
            model_name,
            run_config is not None,
        )

        max_turns = _chatkit_max_turns()
        result = Runner.run_streamed(
            agent,
            agent_input,
            context=agent_context,
            run_config=run_config,
            max_turns=max_turns,
        )

        try:
            async for event in stream_agent_response(agent_context, result):
                yield event
        except MaxTurnsExceeded as e:
            logger.warning("[ChatKit] MaxTurnsExceeded (max_turns=%s): %s", max_turns, e)
            yield ErrorEvent(
                code=ErrorCode.STREAM_ERROR,
                message=(
                    "智能体对话轮次已达上限（多轮工具调用后易触发）。"
                    "请新建对话，或一次性说明需求（例如明确「直接试穿」）后重试。"
                    f" 当前上限：{max_turns}（可在 .env 设置 CHATKIT_MAX_TURNS，默认 100，最高 200）。"
                ),
                allow_retry=True,
            )


fashion_chatkit_server = FashionChatKitServer()
