"""
xAI Grok Imagine fallback when DashScope Qwen Image rejects or blocks try-on.

Uses POST /v1/images/edits with multi-reference prompts (<IMAGE_0>, ...).
Proxy and timeouts align with CHATKIT_XAI_* env vars where applicable.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Sequence

import httpx

logger = logging.getLogger(__name__)

_XAI_EDITS_PATH = "/images/edits"

_CONTENT_BLOCK_HINTS = (
    "内容安全",
    "内容审核",
    "安全合规",
    "敏感",
    "违法违规",
    "风险内容",
    "不适宜",
    "DataInspection",
    "InputData",
    "safety",
    "Safety",
    "moderation",
    "Moderation",
    "content policy",
    "inappropriate",
    "violates",
    "blocked",
    "filter",
    "Filter",
    "policy",
    "IRA",
)


def tryon_xai_fallback_enabled() -> bool:
    if not (os.getenv("XAI_API_KEY") or "").strip():
        return False
    v = (os.getenv("TRYON_XAI_FALLBACK") or "true").strip().lower()
    return v in ("1", "true", "yes", "on")


def tryon_xai_fallback_on_any_qwen_error() -> bool:
    v = (os.getenv("TRYON_XAI_FALLBACK_ON_ANY_QWEN_ERROR") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def looks_like_dashscope_content_block(message: str) -> bool:
    if not message:
        return False
    if re.search(r"\b400\b", message) and re.search(
        r"内容|审核|安全|敏感|违规|风险|policy|safety|moderation|blocked|filter",
        message,
        re.I,
    ):
        return True
    lower = message.lower()
    return any(h.lower() in lower for h in _CONTENT_BLOCK_HINTS)


def _xai_base_url() -> str:
    raw = (os.getenv("XAI_BASE_URL") or "https://api.x.ai/v1").strip().rstrip("/")
    return raw if raw.endswith("/v1") else f"{raw}/v1"


def _xai_async_client(timeout_s: float) -> httpx.AsyncClient:
    connect_s = 45.0
    try:
        connect_s = float(os.getenv("CHATKIT_XAI_HTTP_CONNECT_TIMEOUT", "45").strip())
    except ValueError:
        pass
    timeout = httpx.Timeout(timeout_s, connect=connect_s)
    dedicated = (
        os.getenv("CHATKIT_XAI_PROXY")
        or os.getenv("CHATKIT_XAI_HTTPS_PROXY")
        or os.getenv("CHATKIT_XAI_HTTP_PROXY")
        or ""
    ).strip()
    if not dedicated:
        port_raw = (os.getenv("CHATKIT_XAI_LOCAL_PROXY_PORT") or "").strip()
        if port_raw.isdigit() and 1 <= int(port_raw) <= 65535:
            dedicated = f"http://127.0.0.1:{int(port_raw)}"
    if dedicated:
        return httpx.AsyncClient(
            timeout=timeout,
            trust_env=False,
            proxy=dedicated,
        )
    trust_env = os.getenv("CHATKIT_XAI_HTTP_TRUST_ENV", "true").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    return httpx.AsyncClient(timeout=timeout, trust_env=trust_env)


def _mime_for_path(p: Path) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(p.suffix.lower(), "image/png")


def _build_xai_edit_prompt(qwen_prompt: str, negative_prompt: str | None) -> str:
    text = qwen_prompt.strip()
    if negative_prompt and str(negative_prompt).strip():
        text += "\n\nAvoid / negative guidance: " + str(negative_prompt).strip()
    return text


def _map_prompt_for_xai(qwen_prompt: str, num_images: int) -> str:
    p = qwen_prompt.strip()
    if num_images == 1:
        return (
            p.replace("Image 1", "The input image")
            .replace("Image 2", "The input image")
            .replace("Image 3", "The input image")
        )
    return (
        p.replace("Image 1", "<IMAGE_0>")
        .replace("Image 2", "<IMAGE_1>")
        .replace("Image 3", "<IMAGE_2>")
    )


async def _resolve_inputs_to_urls(image_inputs: Sequence[str | Path]) -> list[str]:
    from services.storage import upload_file_to_r2

    urls: list[str] = []
    for inp in image_inputs:
        s = str(inp)
        if s.startswith("http://") or s.startswith("https://"):
            urls.append(s)
            continue
        p = Path(s).expanduser().resolve()
        if not p.is_file():
            raise RuntimeError(f"xAI fallback: not a file or URL: {p}")
        mime = _mime_for_path(p)
        with p.open("rb") as f:
            u = await upload_file_to_r2(f, p.name, mime)
        urls.append(u)
    return urls


async def virtual_tryon_via_xai_imagine(
    *,
    image_inputs: Sequence[str | Path],
    prompt: str,
    negative_prompt: str | None = None,
) -> bytes:
    """
    Run virtual try-on via xAI /v1/images/edits; return PNG/JPEG bytes of the first result.
    """
    api_key = (os.getenv("XAI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("XAI_API_KEY is not set; cannot use try-on fallback")

    if not image_inputs:
        raise RuntimeError("xAI fallback: empty image_inputs")

    model = (os.getenv("TRYON_XAI_IMAGINE_MODEL") or "grok-imagine-image").strip()
    resolution = (os.getenv("TRYON_XAI_RESOLUTION") or "2k").strip().lower()
    if resolution not in ("1k", "2k"):
        resolution = "2k"
    try:
        read_s = float(os.getenv("CHATKIT_XAI_HTTP_READ_TIMEOUT", "300").strip())
    except ValueError:
        read_s = 300.0

    image_urls = await _resolve_inputs_to_urls(image_inputs)
    n = len(image_urls)
    xai_prompt = _map_prompt_for_xai(prompt, n)
    xai_prompt = _build_xai_edit_prompt(xai_prompt, negative_prompt)

    base = _xai_base_url()
    url = f"{base.rstrip('/')}{_XAI_EDITS_PATH}"

    body: dict = {
        "model": model,
        "prompt": xai_prompt,
        "n": 1,
        "quality": "high",
        "resolution": resolution,
    }
    if n == 1:
        body["image"] = {"url": image_urls[0], "type": "image_url"}
    else:
        body["images"] = [{"url": u, "type": "image_url"} for u in image_urls]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    logger.info(
        "[Try-On][xAI fallback] POST %s model=%s images=%d",
        _XAI_EDITS_PATH,
        model,
        n,
    )

    async with _xai_async_client(read_s) as client:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            raise RuntimeError(
                f"xAI images/edits HTTP {resp.status_code}: {resp.text[:2000]}"
            )
        data = resp.json()
    rows = data.get("data")
    if not isinstance(rows, list) or not rows:
        raise RuntimeError(f"xAI images/edits missing data[]: {data!r}"[:2000])
    first = rows[0]
    if not isinstance(first, dict):
        raise RuntimeError(f"xAI images/edits bad row: {first!r}")
    out_url = first.get("url")
    if not out_url:
        raise RuntimeError(f"xAI images/edits missing url in row: {first!r}"[:2000])

    async with _xai_async_client(read_s) as dl:
        img_resp = await dl.get(str(out_url), follow_redirects=True)
    if img_resp.status_code >= 400:
        raise RuntimeError(
            f"xAI result download failed {img_resp.status_code}: {img_resp.text[:500]}"
        )
    content = img_resp.content
    if not content:
        raise RuntimeError("xAI result download empty body")
    return content
