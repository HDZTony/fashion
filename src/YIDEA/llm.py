"""DeepSeek LLM integration helpers."""

from __future__ import annotations

from typing import Any, Dict, Optional

from langchain_core.language_models.chat_models import (  # type: ignore[import-not-found]
    BaseChatModel,
)
from langchain_openai import ChatOpenAI  # type: ignore[import-not-found]

from .config import Settings


def build_deepseek_llm(settings: Settings) -> BaseChatModel:
    """Instantiate the DeepSeek chat model via the OpenAI-compatible LangChain wrapper."""
    extra_params: Dict[str, Any] = {}
    if settings.deepseek_max_output_tokens is not None:
        extra_params["max_tokens"] = settings.deepseek_max_output_tokens

    return ChatOpenAI(
        api_key=settings.deepseek_api_key.get_secret_value(),
        base_url=str(settings.deepseek_api_base),
        model=settings.deepseek_model,
        temperature=settings.deepseek_temperature,
        **extra_params,
    )

