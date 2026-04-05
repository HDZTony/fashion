"""
xAI Grok via OpenAI-compatible Responses API (native ``AsyncOpenAI.responses``).

Maps Chat Completions–style multimodal parts (``text`` + ``image_url``) to
``input_text`` / ``input_image`` for ``/responses``.
"""

from __future__ import annotations

import logging
from typing import Any

from services.xai_openai_client import get_xai_async_openai_client

logger = logging.getLogger(__name__)


def chat_multimodal_parts_to_responses_content(parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert HumanMessage-style content blocks to Responses API user content items."""
    out: list[dict[str, Any]] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        t = part.get("type")
        if t == "text":
            text = part.get("text")
            if isinstance(text, str) and text:
                out.append({"type": "input_text", "text": text})
        elif t == "image_url":
            iu = part.get("image_url")
            url: str | None
            if isinstance(iu, dict):
                url = iu.get("url")
            elif isinstance(iu, str):
                url = iu
            else:
                url = None
            if isinstance(url, str) and url:
                block: dict[str, Any] = {"type": "input_image", "image_url": url}
                detail = iu.get("detail") if isinstance(iu, dict) else None
                if detail in ("low", "high", "auto"):
                    block["detail"] = detail
                out.append(block)
    return out


def _extract_responses_output_text(resp: Any) -> str:
    t = getattr(resp, "output_text", None)
    if isinstance(t, str) and t.strip():
        return t
    chunks: list[str] = []
    for item in getattr(resp, "output", None) or []:
        for c in getattr(item, "content", None) or []:
            ct = getattr(c, "type", None)
            if ct == "output_text":
                tx = getattr(c, "text", None)
                if isinstance(tx, str):
                    chunks.append(tx)
            elif isinstance(c, dict) and c.get("type") == "output_text":
                tx = c.get("text")
                if isinstance(tx, str):
                    chunks.append(tx)
    return "".join(chunks)


async def xai_responses_output_text(
    *,
    model: str,
    user_content_parts: list[dict[str, Any]],
    instructions: str | None = None,
    temperature: float | None = 0.1,
) -> str:
    """
    One-shot Responses call: multimodal user turn, optional system instructions.

    ``user_content_parts`` uses Chat-style blocks: ``{"type":"text","text":...}``,
    ``{"type":"image_url","image_url":{"url":...}}``.
    """
    client = get_xai_async_openai_client()
    content = chat_multimodal_parts_to_responses_content(user_content_parts)
    if not content:
        raise ValueError("xai_responses_output_text: empty user content after conversion")

    kwargs: dict[str, Any] = {
        "model": model,
        "input": [{"role": "user", "content": content}],
        # xAI: large multimodal outputs can exceed default server-side storage; we only need text.
        "store": False,
    }
    if instructions:
        kwargs["instructions"] = instructions
    if temperature is not None:
        kwargs["temperature"] = temperature

    try:
        resp = await client.responses.create(**kwargs)
    except TypeError:
        kwargs.pop("temperature", None)
        try:
            resp = await client.responses.create(**kwargs)
        except TypeError:
            kwargs.pop("store", None)
            resp = await client.responses.create(**kwargs)

    text = _extract_responses_output_text(resp)
    if not text.strip():
        logger.warning("xAI Responses empty output_text model=%s", model)
    return text
