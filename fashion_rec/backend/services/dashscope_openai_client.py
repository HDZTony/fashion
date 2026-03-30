"""
DashScope Qwen (Singapore compatible OpenAI mode) via native ``AsyncOpenAI.chat.completions``.
"""

from __future__ import annotations

import os
from typing import Any

from openai import AsyncOpenAI

SINGAPORE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

_dashscope_client: AsyncOpenAI | None = None


def get_dashscope_sg_async_openai_client() -> AsyncOpenAI:
    global _dashscope_client
    if _dashscope_client is not None:
        return _dashscope_client
    key = (os.getenv("DASHSCOPE_API_KEY_SG") or "").strip()
    if not key:
        raise RuntimeError(
            "DASHSCOPE_API_KEY_SG is required for Qwen (Singapore DashScope compatible endpoint)."
        )
    _dashscope_client = AsyncOpenAI(
        api_key=key,
        base_url=SINGAPORE_BASE_URL,
    )
    return _dashscope_client


def _message_content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                t = block.get("text")
                if isinstance(t, str):
                    parts.append(t)
        return "".join(parts)
    return str(content or "")


async def dashscope_chat_completions_text(
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.1,
) -> str:
    client = get_dashscope_sg_async_openai_client()
    resp = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    choice = resp.choices[0]
    raw = choice.message.content
    return _message_content_to_text(raw).strip()
