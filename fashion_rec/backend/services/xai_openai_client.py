"""
Shared AsyncOpenAI client for xAI (api.x.ai) with the same httpx settings as ChatKit orchestration.

Proxy, timeouts, and trust_env follow env vars documented in ``chatkit_orchestration``.
"""

from __future__ import annotations

import logging
import os

import httpx
from openai import AsyncOpenAI, DefaultAsyncHttpxClient

logger = logging.getLogger(__name__)

_xai_client_singleton: AsyncOpenAI | None = None


def get_xai_async_openai_client() -> AsyncOpenAI:
    """
    Return a process-wide AsyncOpenAI pointed at xAI ``/v1``.

    Raises:
        RuntimeError: if ``XAI_API_KEY`` is missing.
    """
    global _xai_client_singleton
    if _xai_client_singleton is not None:
        return _xai_client_singleton

    key = (os.getenv("XAI_API_KEY") or "").strip()
    if not key:
        raise RuntimeError(
            "XAI_API_KEY is required for xAI Grok API calls (shared OpenAI-compatible client)."
        )
    raw = (os.getenv("XAI_BASE_URL") or "https://api.x.ai/v1").strip().rstrip("/")
    base_url = raw if raw.endswith("/v1") else f"{raw}/v1"

    try:
        connect_s = float(os.getenv("CHATKIT_XAI_HTTP_CONNECT_TIMEOUT", "45").strip())
    except ValueError:
        connect_s = 45.0
    try:
        read_s = float(os.getenv("CHATKIT_XAI_HTTP_READ_TIMEOUT", "180").strip())
    except ValueError:
        read_s = 180.0
    timeout = httpx.Timeout(read_s, connect=connect_s)

    dedicated_proxy = (
        os.getenv("CHATKIT_XAI_PROXY")
        or os.getenv("CHATKIT_XAI_HTTPS_PROXY")
        or os.getenv("CHATKIT_XAI_HTTP_PROXY")
        or ""
    ).strip()
    if not dedicated_proxy:
        port_raw = (os.getenv("CHATKIT_XAI_LOCAL_PROXY_PORT") or "").strip()
        if port_raw.isdigit() and 1 <= int(port_raw) <= 65535:
            dedicated_proxy = f"http://127.0.0.1:{int(port_raw)}"
    if dedicated_proxy:
        http_client = DefaultAsyncHttpxClient(
            timeout=timeout,
            trust_env=False,
            proxy=dedicated_proxy,
        )
        logger.info(
            "[xAI client] httpx dedicated proxy %s (trust_env=false)",
            dedicated_proxy.split("@")[-1],
        )
    else:
        trust_env = os.getenv("CHATKIT_XAI_HTTP_TRUST_ENV", "true").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        http_client = DefaultAsyncHttpxClient(timeout=timeout, trust_env=trust_env)
        logger.info("[xAI client] httpx trust_env=%s", trust_env)

    _xai_client_singleton = AsyncOpenAI(
        api_key=key,
        base_url=base_url,
        http_client=http_client,
        timeout=timeout,
        max_retries=2,
    )
    return _xai_client_singleton
