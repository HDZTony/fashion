"""
ChatKit orchestration LLM: **default xAI Grok only** (OpenAI-compatible Responses API), optional OpenAI.

Uses the Agents SDK ``MultiProvider`` with ``openai_base_url=https://api.x.ai/v1`` and your ``XAI_API_KEY``
passed as the client API key — same HTTP shape as OpenAI's Responses API, not MCP.

Env:
  CHATKIT_LLM_PROVIDER   xai | openai   (default: xai)
  XAI_API_KEY            required for default xAI orchestration
  XAI_BASE_URL           default https://api.x.ai/v1
  CHATKIT_XAI_HTTP_TRUST_ENV  true|false (default true) — when true, httpx uses HTTP(S)_PROXY from
                            the **process** environment. On Windows, v2rayN/Clash「自动配置系统代理」often
                            does **not** set these vars for Python/uvicorn: use CHATKIT_XAI_PROXY or
                            CHATKIT_XAI_LOCAL_PROXY_PORT instead. Set false to force a direct connection
                            to api.x.ai (only if you do not need a proxy).
  CHATKIT_XAI_PROXY   optional proxy URL for xAI only, e.g. http://127.0.0.1:10808 (v2rayN mixed) or
                            socks5://127.0.0.1:10808 (install httpx[socks] / socksio). When set,
                            overrides env proxies and uses trust_env=false for this client only.
  CHATKIT_XAI_LOCAL_PROXY_PORT  e.g. 10808 — shorthand for http://127.0.0.1:<port> when CHATKIT_XAI_PROXY
                            is unset. Typical v2rayN local mixed port.
  CHATKIT_XAI_HTTP_CONNECT_TIMEOUT  seconds, default 45
  CHATKIT_XAI_HTTP_READ_TIMEOUT     seconds, default 180
  CHATKIT_XAI_ROUTING    auto | fast | reasoning   (default: auto)
  CHATKIT_XAI_MODEL_FAST       override, default grok-4.20-0309-non-reasoning
  CHATKIT_XAI_MODEL_REASONING  override, default grok-4.20-0309-reasoning
  CHATKIT_XAI_USE_RESPONSES    true|false (default true — OpenAI Responses API compatible path to xAI)
  CHATKIT_MAX_TURNS      agent Runner max_turns, default 100, clamped 10–200 (SDK default is 10)
  OPENAI_API_KEY         only when CHATKIT_LLM_PROVIDER=openai
"""

from __future__ import annotations

import logging
import os
import re

from agents import RunConfig
from agents.models.multi_provider import MultiProvider
from chatkit.types import ThreadItem, UserMessageItem, UserMessageTextContent

from services.xai_openai_client import get_xai_async_openai_client

logger = logging.getLogger(__name__)

# Explicit OpenAI path only when CHATKIT_LLM_PROVIDER=openai
OPENAI_ORCHESTRATION_MODEL = "gpt-4.1-mini"

# Default orchestration: Grok via xAI (no OpenAI key required)
DEFAULT_ORCHESTRATION_PROVIDER = "xai"

# xAI Grok 4.20 — see https://docs.x.ai/docs/models
DEFAULT_XAI_FAST = "grok-4.20-0309-non-reasoning"
DEFAULT_XAI_REASONING = "grok-4.20-0309-reasoning"

_REASONING_HINTS_RE = re.compile(
    r"为什么|怎(?:么|样)办|分析|对比|详细|步骤|推理|证明|权衡|优缺点|"
    r"\bwhy\b|\banalyze\b|\bcompare\b|\bexplain\b.*\bdetail\b|\bstep\s*by\s*step\b|\breasoning\b",
    re.IGNORECASE,
)

_xai_run_config_singleton: RunConfig | None = None


def _get_xai_run_config() -> RunConfig:
    global _xai_run_config_singleton
    if _xai_run_config_singleton is not None:
        return _xai_run_config_singleton
    key = (os.getenv("XAI_API_KEY") or "").strip()
    if not key:
        raise RuntimeError(
            "XAI_API_KEY is required: ChatKit orchestration defaults to xAI Grok using the "
            "OpenAI-compatible Responses API (CHATKIT_XAI_USE_RESPONSES defaults to true). "
            "Set XAI_API_KEY, or set CHATKIT_LLM_PROVIDER=openai with OPENAI_API_KEY."
        )
    use_resp = os.getenv("CHATKIT_XAI_USE_RESPONSES", "true").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    xai_client = get_xai_async_openai_client()
    prov = MultiProvider(
        openai_client=xai_client,
        openai_use_responses=use_resp,
    )
    _xai_run_config_singleton = RunConfig(model_provider=prov)
    return _xai_run_config_singleton


def _user_text_from_message(item: UserMessageItem) -> str:
    parts: list[str] = []
    for p in item.content:
        if isinstance(p, UserMessageTextContent):
            parts.append(p.text)
    return "".join(parts)


def _last_user_message_items(items: list[ThreadItem]) -> list[UserMessageItem]:
    out: list[UserMessageItem] = []
    for it in items:
        if isinstance(it, UserMessageItem):
            out.append(it)
    return out


def _pick_xai_model(
    routing: str,
    last_user: UserMessageItem | None,
) -> str:
    fast_id = (os.getenv("CHATKIT_XAI_MODEL_FAST") or DEFAULT_XAI_FAST).strip()
    reasoning_id = (os.getenv("CHATKIT_XAI_MODEL_REASONING") or DEFAULT_XAI_REASONING).strip()
    r = (routing or "auto").strip().lower()
    if r == "fast":
        return fast_id
    if r in ("reasoning", "resonance"):  # user typo / alias
        return reasoning_id
    # auto
    if last_user is None:
        return fast_id
    if last_user.attachments:
        return reasoning_id
    text = _user_text_from_message(last_user)
    if len(text) > 500:
        return reasoning_id
    if _REASONING_HINTS_RE.search(text):
        return reasoning_id
    return fast_id


def resolve_chatkit_llm_turn(
    thread_items: list[ThreadItem],
    input_user_message: UserMessageItem | None,
) -> tuple[str, RunConfig | None]:
    """
    Returns (model_name, run_config).
    Default: xAI Grok + RunConfig(MultiProvider, OpenAI-compatible Responses API to api.x.ai).
    If CHATKIT_LLM_PROVIDER=openai: (OPENAI_ORCHESTRATION_MODEL, None) — requires OPENAI_API_KEY.
    """
    provider = (
        os.getenv("CHATKIT_LLM_PROVIDER") or DEFAULT_ORCHESTRATION_PROVIDER
    ).strip().lower()
    users = _last_user_message_items(thread_items)
    last_user = input_user_message if input_user_message is not None else (users[-1] if users else None)

    if provider == "xai":
        routing = (os.getenv("CHATKIT_XAI_ROUTING") or "auto").strip()
        model = _pick_xai_model(routing, last_user)
        return model, _get_xai_run_config()

    if provider not in ("openai", ""):
        raise ValueError(f"Unknown CHATKIT_LLM_PROVIDER={provider!r}; use openai or xai")

    return OPENAI_ORCHESTRATION_MODEL, None
