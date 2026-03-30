"""
ChatKit server: stream OpenAI Agents runs into ChatKit thread events.
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from typing import Any

from agents import MaxTurnsExceeded, Runner, RunConfig
from chatkit.agents import AgentContext, stream_agent_response
from chatkit.errors import ErrorCode
from chatkit.server import ChatKitServer
from chatkit.store import NotFoundError
from chatkit.types import (
    ErrorEvent,
    StreamingReq,
    ThreadMetadata,
    ThreadStreamEvent,
    UserMessageItem,
)

from services.chatkit_attachment_store import MemoryAttachmentStore
from services.chatkit_fashion_agent import fashion_stylist_agent
from services.chatkit_memory_store import MemoryStore
from services.chatkit_orchestration import resolve_chatkit_llm_turn
from services.chatkit_thread_converter import FashionThreadItemConverter

logger = logging.getLogger(__name__)

MAX_RECENT_ITEMS = 30


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
        self.store = MemoryStore()
        self._attachment_store = MemoryAttachmentStore(self.store)
        self._thread_converter = FashionThreadItemConverter(self.store)
        super().__init__(self.store, attachment_store=self._attachment_store)

    async def _process_streaming_impl(
        self,
        request: StreamingReq,
        context: dict[str, Any],
    ) -> AsyncIterator[ThreadStreamEvent]:
        """
        MemoryStore loses all threads on process restart; the ChatKit UI may still retry
        an old thread_id (e.g. threads.retry_after_item) and the base implementation
        would raise NotFoundError and break the SSE stream. Emit a protocol ErrorEvent instead.
        """
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
