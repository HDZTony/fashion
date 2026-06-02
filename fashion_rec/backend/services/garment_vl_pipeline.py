"""
Grok 4.1 Fast vision (per-image scene / single-item) assessment + LocateAnything-3B
bounding boxes (Qwen3-VL fallback) + PIL crop + R2 upload.

Default assess model: ``grok-4-1-fast-reasoning`` (xAI, text+image → text). Override with env
``GARMENT_ASSESS_GROK_MODEL`` (e.g. ``grok-4-1-fast-non-reasoning`` for lower latency).

Used by ChatKit tools for try-on: turn model-wearing or multi-item photos into clean garment tiles
similar to showcase product shots before POST /try-on.

Studio **intent rail** (multi-upload): **Grok** plans which global image index supplies which garment
(xAI documents no hard cap on image count per request; we send all user photos in one stateless Grok call).
**LocateAnything-3B** does bbox per assigned image through the local Tailscale service; if that
service is disabled, unreachable, or returns unusable coordinates, the same per-image request falls
back to Qwen3-VL.

Developer doc: ``doc/grok-multimodal-and-qwen-batch.md`` (Grok Responses ``input_*`` parts, 20MiB limit,
stateless recommendation, LocateAnything primary bbox with Qwen fallback). Grok uses native
``AsyncOpenAI.responses``; Qwen fallback uses ``chat.completions`` on DashScope compatible endpoint.
"""

from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import logging
import os
import re
import uuid
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import httpx
from PIL import Image

from services.dashscope_openai_client import dashscope_chat_completions_text
from services.locateanything_client import (
    LocateAnythingError,
    image_url_fetchable_by_locateanything,
    locate_garment_boxes,
    locateanything_enabled,
)
from services.xai_openai_client import get_xai_async_openai_client
from services.xai_responses import xai_responses_output_text

logger = logging.getLogger(__name__)

_grok_model_logged: str | None = None


def _strip_json_fence(content: str) -> str:
    s = content.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def attachment_id_from_chatkit_preview_url(url: str) -> str | None:
    try:
        parts = [p for p in urlparse(url).path.split("/") if p]
        if (
            len(parts) >= 4
            and parts[0] == "chatkit"
            and parts[1] == "attachments"
            and parts[-1] == "preview"
        ):
            return parts[2]
    except Exception:
        pass
    return None


def _url_needs_inline_image_for_vl_api(url: str) -> bool:
    """
    DashScope Qwen-VL fetches image URLs from Aliyun servers; localhost / private URLs fail with
    InvalidParameter. Inline base64 avoids that.
    """
    try:
        p = urlparse(url)
        scheme = (p.scheme or "").lower()
        if scheme not in ("http", "https"):
            return True
        h = (p.hostname or "").lower()
        if not h:
            return True
        if h in ("localhost", "::1") or h.endswith(".local"):
            return True
        if h.startswith("127."):
            return True
        try:
            ip = ipaddress.ip_address(h)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return True
        except ValueError:
            pass
        return False
    except Exception:
        return True


def _url_must_inline_for_xai_image_fetch(url: str) -> bool:
    """
    xAI Responses rejects fetching some URLs server-side (e.g. plain ``http://``, loopback).
    Inline as data URL after local ``fetch_image_bytes`` (same idea as Qwen-VL).
    """
    if _url_needs_inline_image_for_vl_api(url):
        return True
    try:
        return (urlparse(url).scheme or "").lower() == "http"
    except Exception:
        return True


async def _xai_vision_image_url_param(image_url: str) -> str:
    if _url_must_inline_for_xai_image_fetch(image_url):
        blob = await fetch_image_bytes(image_url)
        return _bytes_to_data_url(blob)
    return image_url


# DashScope chat.completions: "Exceeded limit on max bytes per data-uri item : 10485760"
# Keep raw payload under ~7 MiB so base64 + `data:...;base64,` stays under the wire cap.
_QWEN_VL_SAFE_DATA_URI_RAW_BYTES = 7 * 1024 * 1024
_LOCATEANYTHING_DEFAULT_MAX_DIM = 1280
_LOCATEANYTHING_DEFAULT_MAX_BYTES = 2 * 1024 * 1024


def _locateanything_max_image_dim() -> int:
    import os

    raw = (os.getenv("LOCATEANYTHING_MAX_IMAGE_DIM") or str(_LOCATEANYTHING_DEFAULT_MAX_DIM)).strip()
    try:
        return max(512, min(int(raw), 2048))
    except ValueError:
        return _LOCATEANYTHING_DEFAULT_MAX_DIM


def _downscale_image_bytes(
    data: bytes,
    *,
    max_dim: int,
    max_bytes: int,
    log_prefix: str,
) -> bytes:
    if len(data) <= max_bytes:
        try:
            im = Image.open(BytesIO(data))
            im.load()
            if max(im.size) <= max_dim:
                return data
        except Exception:
            return data
    try:
        im = Image.open(BytesIO(data))
        im.load()
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[3])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")
    except Exception as e:
        logger.warning("%s: open failed (%s)", log_prefix, e)
        return data

    cur_dim = max_dim
    orig_len = len(data)
    while cur_dim >= 256:
        im2 = im
        w, h = im2.size
        if max(w, h) > cur_dim:
            r = cur_dim / max(w, h)
            im2 = im2.resize(
                (max(1, int(w * r)), max(1, int(h * r))),
                Image.Resampling.LANCZOS,
            )
        for q in (85, 78, 70, 62, 55, 48, 40, 32):
            buf = BytesIO()
            im2.save(buf, format="JPEG", quality=q, optimize=True)
            out = buf.getvalue()
            if len(out) <= max_bytes:
                if orig_len != len(out) or max(im.size) > cur_dim:
                    logger.info(
                        "%s: %d -> %d bytes (max_dim=%s q=%s)",
                        log_prefix,
                        orig_len,
                        len(out),
                        cur_dim,
                        q,
                    )
                return out
        cur_dim = int(cur_dim * 0.72)

    tiny = im.resize((256, 256), Image.Resampling.LANCZOS)
    buf = BytesIO()
    tiny.save(buf, format="JPEG", quality=32, optimize=True)
    out = buf.getvalue()
    logger.warning("%s: aggressive fallback %d -> %d bytes", log_prefix, orig_len, len(out))
    return out


def downscale_image_bytes_for_locateanything(data: bytes) -> bytes:
    """
    Shrink for GPU ``/v1/locate_bytes`` (faster, avoids 30s timeouts).

    Use the **same** returned bytes for ``crop_boxes_upload`` so bbox coords match.
    """
    return _downscale_image_bytes(
        data,
        max_dim=_locateanything_max_image_dim(),
        max_bytes=_LOCATEANYTHING_DEFAULT_MAX_BYTES,
        log_prefix="downscale_image_bytes_for_locateanything",
    )


def downscale_image_bytes_for_qwen_data_uri(data: bytes) -> bytes:
    """
    Shrink image bytes so Qwen-VL inline data URIs stay under provider limits.

    Callers must use the **returned** bytes for both ``qwen_detect_*`` (via data URL) and
    ``crop_boxes_upload`` so bbox coordinates and PIL crops share the same dimensions.
    """
    return _downscale_image_bytes(
        data,
        max_dim=4096,
        max_bytes=_QWEN_VL_SAFE_DATA_URI_RAW_BYTES,
        log_prefix="downscale_image_bytes_for_qwen_data_uri",
    )


def _bytes_to_data_url(data: bytes) -> str:
    mime = "image/jpeg"
    try:
        im = Image.open(BytesIO(data))
        im.load()
        if im.format:
            mime = Image.MIME.get(im.format, "image/jpeg")
    except Exception:
        pass
    b64 = base64.standard_b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


async def _qwen_vision_image_url_param(image_url: str) -> str:
    if _url_needs_inline_image_for_vl_api(image_url):
        blob = await fetch_image_bytes(image_url)
        blob = downscale_image_bytes_for_qwen_data_uri(blob)
        return _bytes_to_data_url(blob)
    return image_url


async def fetch_image_bytes(url: str) -> bytes:
    aid = attachment_id_from_chatkit_preview_url(url)
    if aid:
        from services.chatkit_fashion_server import fashion_chatkit_server

        blob = fashion_chatkit_server.store.get_attachment_blob(aid)
        if blob:
            return blob
    client_kw: dict[str, Any] = {}
    try:
        host = (urlparse(url).hostname or "").lower()
        if host in ("localhost", "127.0.0.1", "::1") or host.startswith("127."):
            client_kw["trust_env"] = False
    except Exception:
        pass
    async with httpx.AsyncClient(**client_kw) as client:
        r = await client.get(url, timeout=60.0, follow_redirects=True)
        r.raise_for_status()
        return r.content


def _garment_assess_grok_model() -> str:
    import os

    return (os.getenv("GARMENT_ASSESS_GROK_MODEL") or "grok-4-1-fast-reasoning").strip()


def _log_grok_model_once(model: str) -> None:
    global _grok_model_logged
    if _grok_model_logged != model:
        _grok_model_logged = model
        logger.info("[garment_vl] Grok assess model=%s (Responses API)", model)


async def _qwen_vl_completion(user_parts: list[dict[str, Any]]) -> str:
    """Single user-turn multimodal call to Qwen3-VL (DashScope OpenAI-compatible chat.completions)."""
    return await dashscope_chat_completions_text(
        model="qwen3-vl-plus",
        messages=[{"role": "user", "content": user_parts}],
        temperature=0.05,
    )


GROK_ASSESS_PROMPT = """You judge ONE image for virtual try-on garment extraction.

Decide if we should run a **piece extraction** step (detect bounding boxes and crop each garment):
- Set needs_piece_extraction=true when ANY applies:
  * A person/model is wearing clothing (upper and/or lower body) — we need crops of visible garments.
  * Multiple separate clothing products appear in one frame (e.g. two flat-lay items).
  * Busy scene where garment boundaries are unclear for try-on.
- Set needs_piece_extraction=false ONLY when it is clearly a **single** isolated clothing item or one product
  on a clean/simple background (typical e-commerce product shot of one piece), with no wearable outfit on a model.

Output ONLY valid JSON (no markdown):
{
  "needs_piece_extraction": true/false,
  "single_isolated_product": true/false,
  "model_wearing_clothing": true/false,
  "multiple_products_in_frame": true/false,
  "reason": "one short English sentence"
}
"""

GROK_MULTI_IMAGE_PLAN_PROMPT = """You plan **garment crops** for virtual try-on. The user sent **all** photos below in order.

Your job:
1) Read the user message (any language) and infer **which garment(s)** they want to try (e.g. black top + white skirt).
2) Look at **every** image and note what clothing is visible (rough list in English).
3) Decide **which image index** should supply **which** piece. Prefer **one clear photo per piece** — do **not**
   assign the same outfit pieces redundantly from every photo. Skip photos that do not help.
4) If **one** photo clearly shows **two different requested** pieces, you may set max_crops to 2 for that index only.
5) **Scene vs garment (order is NOT fixed):** If **exactly one** image is primarily **environment / background**
   (beach, ocean, street, park, empty room, landscape) and is **not** the best source for a garment crop, set
   `scene_image_index` to that 0-based index. If every image is a person, flat-lay product, or outfit reference,
   set `scene_image_index` to null. **Never** list the same index in both `scene_image_index` and `assignments`.

Image indices are **0, 1, 2, …** in the same order as the images appear below (first image = 0).

Return **only** valid JSON (no markdown):
{{
  "assignments": [
    {{"image_index": 0, "focus": "English: exactly what to tightly crop from this image only", "max_crops": 1}}
  ],
  "garments_seen_summary": "optional short English — what clothing appears across photos",
  "scene_image_index": null
}}

Rules:
- **image_index** must satisfy 0 <= image_index < {n_images}.
- **max_crops** must be 1 or 2 (prefer 1).
- **assignments** may be empty if nothing is usable.
- **scene_image_index** is either null or an integer with 0 <= scene_image_index < {n_images}.
"""


async def grok_assess_needs_extraction(image_url: str) -> dict[str, Any]:
    model = _garment_assess_grok_model()
    _log_grok_model_once(model)
    vision_url = await _xai_vision_image_url_param(image_url)
    parts = [
        {"type": "text", "text": GROK_ASSESS_PROMPT},
        {"type": "image_url", "image_url": {"url": vision_url}},
    ]
    response_text = await xai_responses_output_text(
        model=model,
        user_content_parts=parts,
        temperature=0.1,
    )
    raw = _strip_json_fence(response_text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Grok assess JSON parse failed: %s", raw[:400])
        return {
            "needs_piece_extraction": True,
            "single_isolated_product": False,
            "model_wearing_clothing": False,
            "multiple_products_in_frame": False,
            "reason": "parse_error_default_extract",
        }
    if not isinstance(data, dict):
        return {
            "needs_piece_extraction": True,
            "reason": "invalid_shape_default_extract",
        }
    data.setdefault("needs_piece_extraction", True)
    return data


QWEN_BBOX_PROMPT = """You locate wearable garments for virtual try-on in this image.

For each distinct garment piece the user would try on, output one entry:
- tops (shirts, tube tops, sweaters…), bottoms (pants, skirts, shorts…), dresses (count dress as one item), outerwear.
- Skip bags, jewelry, shoes unless the user clearly only cares about them (normally skip shoes).
Use tight axis-aligned boxes.

Return ONLY valid JSON (no markdown):
{
  "items": [
    {
      "role": "top|bottom|dress|outerwear|other",
      "label": "short English",
      "bbox_2d": [x0, y0, x1, y1]
    }
  ]
}

bbox_2d uses **0–1000** scale: origin top-left; x and y from 0 to 1000 inclusive.
x0,y0 = top-left corner; x1,y1 = bottom-right corner; ensure x0 < x1 and y0 < y1.
If the image is one clear product on plain background, you may use [0,0,1000,1000] for that item.
Cap at 6 items; prefer the main fashion garments the user would mention for try-on.
"""


def _norm_box_to_pixels(
    box: list[float], w: int, h: int, margin_frac: float = 0.02
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
    m = max(x0, y0, x1, y1)
    if m <= 1.0:
        x0, x1 = x0 * w, x1 * w
        y0, y1 = y0 * h, y1 * h
    else:
        x0, x1 = x0 / 1000.0 * w, x1 / 1000.0 * w
        y0, y1 = y0 / 1000.0 * h, y1 / 1000.0 * h
    mw, mh = int(w * margin_frac), int(h * margin_frac)
    x0i = max(0, int(x0) - mw)
    y0i = max(0, int(y0) - mh)
    x1i = min(w, int(x1) + mw)
    y1i = min(h, int(y1) + mh)
    if x1i <= x0i or y1i <= y0i:
        return 0, 0, w, h
    return x0i, y0i, x1i, y1i


def _intent_bbox_instruction_text(intent_text: str, *, max_items: int = 10) -> str:
    safe = (intent_text or "").strip().replace("\\", "\\\\").replace('"', "'")[:800]
    if not safe:
        safe = (
            "The user wants clothing from this photo for virtual try-on. "
            "Return tight boxes around each distinct garment (tops, bottoms, dress), not face or background."
        )
    cap = max(1, min(int(max_items), 6))
    return (
        f'User intent (may be Chinese or English): "{safe}"\n\n'
        "Return JSON only with this exact structure:\n"
        '{"items":[{"role":"top|bottom|dress|outerwear|other","label":"short English",'
        '"bbox_2d":[x0,y0,x1,y1]}]}\n\n'
        "Rules:\n"
        "- Output boxes **only** for garment(s) the user refers to. "
        "If they mention only a skirt or 裙子, output **one** box around the skirt / lower-body garment. "
        "If they mention only a top / 上衣 / 抹胸 / shirt, output **one** box around that upper garment.\n"
        "- If they mention **several** pieces and **this single image** clearly shows more than one of those pieces, "
        "you may output multiple boxes — but **never more than "
        f"{cap}** items, and only for real garments (not skin-only, face, or background).\n"
        "- Do not box face, hair, background, or unrelated objects.\n"
        "- bbox_2d: 0–1000 scale, origin top-left, x0<x1, y0<y1.\n"
        f"- **At most {cap} items** in `items`.\n"
    )


def _locateanything_assignment_concurrency() -> int:
    raw = (os.getenv("LOCATEANYTHING_MAX_CONCURRENCY") or "3").strip()
    try:
        return max(1, min(int(raw), 8))
    except ValueError:
        return 3


def _locateanything_prompt(focus_text: str, *, max_items: int = 6) -> str:
    focus = (focus_text or "").strip().replace("\\", "\\\\").replace('"', "'")[:900]
    if not focus:
        focus = "wearable garments for virtual try-on: tops, bottoms, dresses, or outerwear"
    cap = max(1, min(int(max_items), 8))
    return (
        "Locate the requested wearable garment(s) in this fashion image. "
        f"Target: {focus}. "
        f"Return up to {cap} tight bounding box(es) only for real garments, not face, hair, "
        "bare skin, background, or unrelated objects. "
        "Use 0-1000 normalized coordinates in this exact format: "
        "<box><x1><y1><x2><y2></box>."
    )


async def _resolve_locateanything_image_bytes(
    image_url: str,
    image_bytes: bytes | None,
) -> bytes | None:
    """Bytes for /v1/locate_bytes when the GPU cannot HTTP-fetch ``image_url``."""
    if image_bytes is not None:
        return image_bytes
    if image_url_fetchable_by_locateanything(image_url):
        return None
    if not _url_needs_inline_image_for_vl_api(image_url):
        return None
    try:
        blob = await fetch_image_bytes(image_url)
        return downscale_image_bytes_for_locateanything(blob)
    except Exception as e:
        logger.warning(
            "[LocateAnything] could not load local image bytes for %s: %s",
            image_url[:80],
            e,
        )
        return None


async def _locateanything_detect_with_qwen_fallback(
    image_url: str,
    *,
    locate_focus: str,
    max_items: int,
    image_bytes: bytes | None = None,
    qwen_call,
) -> list[dict[str, Any]]:
    locate_blob = None
    if locateanything_enabled():
        locate_blob = await _resolve_locateanything_image_bytes(image_url, image_bytes)
        use_locate = locate_blob is not None or image_url_fetchable_by_locateanything(
            image_url
        )
        if use_locate:
            try:
                boxes = await locate_garment_boxes(
                    image_url=image_url,
                    image_bytes=locate_blob,
                    prompt=_locateanything_prompt(locate_focus, max_items=max_items),
                    max_items=max_items,
                    label=(locate_focus or "garment")[:80],
                )
                mode = "bytes" if locate_blob is not None else "url"
                logger.info(
                    "[LocateAnything bbox] boxes=%d mode=%s source=%s",
                    len(boxes),
                    mode,
                    image_url[:80],
                )
                return boxes
            except LocateAnythingError as e:
                logger.warning(
                    "[LocateAnything bbox] failed; using Qwen fallback for %s: %s",
                    image_url[:80],
                    e,
                )
        else:
            logger.info(
                "[LocateAnything bbox] skipped unreachable URL; using Qwen fallback for %s",
                image_url[:80],
            )

    boxes = await qwen_call()
    if boxes:
        logger.info("[Qwen bbox fallback] boxes=%d source=%s", len(boxes), image_url[:80])
    return boxes


async def qwen_detect_garment_boxes_for_intent(
    image_url: str,
    intent_text: str,
    *,
    image_bytes: bytes | None = None,
    max_items: int = 6,
    instruction_override: str | None = None,
) -> list[dict[str, Any]]:
    """Tight boxes for garments matching the user's stated intent (Studio rail preview)."""
    vision_url = (
        _bytes_to_data_url(image_bytes)
        if image_bytes is not None
        else await _qwen_vision_image_url_param(image_url)
    )
    cap = max(1, min(int(max_items), 8))
    user_txt = (
        instruction_override
        if instruction_override
        else _intent_bbox_instruction_text(intent_text, max_items=cap)
    )
    parts = [
        {"type": "text", "text": user_txt},
        {"type": "image_url", "image_url": {"url": vision_url}},
    ]
    response_text = await _qwen_vl_completion(parts)
    raw = _strip_json_fence(response_text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Qwen intent-bbox JSON parse failed: %s", raw[:500])
        return []
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for it in items[:cap]:
        if not isinstance(it, dict):
            continue
        b = it.get("bbox_2d")
        if not isinstance(b, list) or len(b) != 4:
            continue
        try:
            _ = [float(x) for x in b]
        except (TypeError, ValueError):
            continue
        out.append(
            {
                "role": str(it.get("role", "other")),
                "label": str(it.get("label", "")),
                "bbox_2d": b,
            }
        )
    return out


async def qwen_detect_garment_boxes(
    image_url: str,
    user_hint: str = "",
    *,
    image_bytes: bytes | None = None,
) -> list[dict[str, Any]]:
    vision_url = (
        _bytes_to_data_url(image_bytes)
        if image_bytes is not None
        else await _qwen_vision_image_url_param(image_url)
    )
    hint = (user_hint or "").strip()
    user_txt = QWEN_BBOX_PROMPT
    if hint:
        user_txt += f'\nUser / stylist intent (may help disambiguate): "{hint}"'
    parts = [
        {"type": "text", "text": user_txt},
        {"type": "image_url", "image_url": {"url": vision_url}},
    ]
    response_text = await _qwen_vl_completion(parts)
    raw = _strip_json_fence(response_text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Qwen bbox JSON parse failed: %s", raw[:500])
        return []
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for it in items[:8]:
        if not isinstance(it, dict):
            continue
        b = it.get("bbox_2d")
        if not isinstance(b, list) or len(b) != 4:
            continue
        try:
            _ = [float(x) for x in b]
        except (TypeError, ValueError):
            continue
        out.append(
            {
                "role": str(it.get("role", "other")),
                "label": str(it.get("label", "")),
                "bbox_2d": b,
            }
        )
    return out


async def detect_garment_boxes_for_intent(
    image_url: str,
    intent_text: str,
    *,
    image_bytes: bytes | None = None,
    max_items: int = 6,
    instruction_override: str | None = None,
    locate_focus: str | None = None,
) -> list[dict[str, Any]]:
    """Tight boxes with LocateAnything primary and Qwen3-VL fallback."""
    cap = max(1, min(int(max_items), 8))

    async def qwen_call() -> list[dict[str, Any]]:
        return await qwen_detect_garment_boxes_for_intent(
            image_url,
            intent_text,
            image_bytes=image_bytes,
            max_items=cap,
            instruction_override=instruction_override,
        )

    return await _locateanything_detect_with_qwen_fallback(
        image_url,
        locate_focus=locate_focus or intent_text,
        max_items=cap,
        image_bytes=image_bytes,
        qwen_call=qwen_call,
    )


async def detect_garment_boxes(
    image_url: str,
    user_hint: str = "",
    *,
    image_bytes: bytes | None = None,
) -> list[dict[str, Any]]:
    """General garment boxes with LocateAnything primary and Qwen3-VL fallback."""

    async def qwen_call() -> list[dict[str, Any]]:
        return await qwen_detect_garment_boxes(
            image_url,
            user_hint,
            image_bytes=image_bytes,
        )

    return await _locateanything_detect_with_qwen_fallback(
        image_url,
        locate_focus=user_hint or "distinct wearable garment pieces for virtual try-on",
        max_items=6,
        image_bytes=image_bytes,
        qwen_call=qwen_call,
    )


async def crop_boxes_upload(
    image_bytes: bytes,
    boxes: list[dict[str, Any]],
    *,
    max_outputs: int | None = None,
) -> list[str]:
    from services.storage import upload_file_to_r2

    im = Image.open(BytesIO(image_bytes)).convert("RGBA")
    w, h = im.size
    urls: list[str] = []
    for idx, item in enumerate(boxes):
        if max_outputs is not None and len(urls) >= max_outputs:
            break
        coords = item.get("bbox_2d")
        if not isinstance(coords, list) or len(coords) != 4:
            continue
        try:
            fl = [float(x) for x in coords]
        except (TypeError, ValueError):
            continue
        x0, y0, x1, y1 = _norm_box_to_pixels(fl, w, h)
        crop = im.crop((x0, y0, x1, y1))
        if crop.size[0] < 16 or crop.size[1] < 16:
            continue
        buf = BytesIO()
        crop.convert("RGB").save(buf, format="PNG", optimize=True)
        buf.seek(0)
        name = f"garment_crop_{uuid.uuid4().hex[:16]}_{idx}.png"
        url = await upload_file_to_r2(buf, name, "image/png")
        urls.append(url)
    return urls


async def assess_url_list(urls: list[str]) -> dict[str, Any]:
    details: list[dict[str, Any]] = []
    flags: list[bool] = []
    for u in urls:
        try:
            g = await grok_assess_needs_extraction(u)
            need = bool(g.get("needs_piece_extraction", True))
            flags.append(need)
            details.append({"url": u, "assessment": g})
        except Exception as e:
            logger.exception("Grok assess failed for %s: %s", u[:80], e)
            flags.append(True)
            details.append(
                {
                    "url": u,
                    "assessment": {
                        "needs_piece_extraction": True,
                        "reason": str(e),
                    },
                }
            )
    return {"urls": list(urls), "needs_piece_extraction": flags, "details": details}


async def extract_or_passthrough_urls(
    urls: list[str],
    mask: list[bool],
    user_intent_summary: str,
) -> dict[str, Any]:
    if len(mask) != len(urls):
        raise ValueError("extraction_mask length must match urls length")
    out: list[str] = []
    steps: list[str] = []
    for u, need in zip(urls, mask):
        if not need:
            out.append(u)
            steps.append(f"passthrough: {u[:60]}...")
            continue
        try:
            b = downscale_image_bytes_for_locateanything(await fetch_image_bytes(u))
            boxes = await detect_garment_boxes(
                u, user_intent_summary, image_bytes=b
            )
            if not boxes:
                out.append(u)
                steps.append(f"bbox_no_boxes_fallback_original: {u[:60]}...")
                continue
            uploaded = await crop_boxes_upload(b, boxes)
            if not uploaded:
                out.append(u)
                steps.append(f"crop_empty_fallback_original: {u[:60]}...")
                continue
            out.extend(uploaded)
            steps.append(
                f"extracted {len(uploaded)} crop(s) from {u[:50]}... roles={[x.get('role') for x in boxes[: len(uploaded)]]}"
            )
        except Exception as e:
            logger.exception("extract pipeline failed for %s: %s", u[:80], e)
            out.append(u)
            steps.append(f"error_fallback_original: {u[:40]}... ({e!s})")
    return {"garment_urls": out, "steps": steps}


def _per_image_instruction_after_plan(
    global_intent: str,
    image_index: int,
    num_images: int,
    focus: str,
    max_crops: int,
) -> str:
    g = (global_intent or "").strip().replace("\\", "\\\\").replace('"', "'")[:700]
    f = (focus or "").strip().replace("\\", "\\\\").replace('"', "'")[:500]
    mc = max(1, min(int(max_crops), 3))
    return (
        f'Overall user request: "{g}"\n'
        f"You see **photo {image_index + 1} of {num_images}** (0-based index {image_index}).\n"
        f"**This frame only:** {f}\n\n"
        f"Return **only** JSON (no markdown) with at most **{mc}** garment entries:\n"
        '{"items":[{"role":"top|bottom|dress|outerwear|other","label":"short English",'
        '"bbox_2d":[x0,y0,x1,y1]}]}\n'
        "Rules:\n"
        "- bbox_2d uses 0–1000 scale, top-left origin, x0<x1, y0<y1.\n"
        "- Do **not** box bare skin, midriff-only, face, or background.\n"
        "- If this photo does **not** contain what you were told to take from it, return {\"items\":[]}.\n"
    )


def _parse_assignment_rows(assign: list[Any], n: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for a in assign:
        if not isinstance(a, dict):
            continue
        try:
            idx = int(a.get("image_index"))
        except (TypeError, ValueError):
            continue
        if idx < 0 or idx >= n:
            continue
        focus = str(a.get("focus", "")).strip()
        if not focus:
            focus = "garment matching the user request"
        try:
            mc = int(a.get("max_crops", 1))
        except (TypeError, ValueError):
            mc = 1
        mc = max(1, min(mc, 3))
        out.append({"image_index": idx, "focus": focus, "max_crops": mc})
    return out


def _parse_scene_image_index(raw: Any, n: int) -> int | None:
    if raw is None:
        return None
    try:
        idx = int(raw)
    except (TypeError, ValueError):
        return None
    if idx < 0 or idx >= n:
        return None
    return idx


async def plan_multi_image_intent_crops(
    image_urls: list[str],
    intent_text: str,
) -> tuple[list[dict[str, Any]], int | None] | None:
    """
    **Grok 4.1 Fast reasoning** sees all user images + text. Returns garment assignment rows and optional
    ``scene_image_index`` (environment frame — not a garment crop source).
    ``None`` means planner failed; use full fallback. ``([], idx)`` means no garment rows but scene known.
    """
    n = len(image_urls)
    if n < 2:
        return None

    try:
        get_xai_async_openai_client()
    except RuntimeError as e:
        logger.warning("[intent_plan] Grok unavailable: %s", e)
        return None

    safe_intent = (intent_text or "").strip().replace("\\", "\\\\").replace('"', "'")[:1200]
    header = (
        GROK_MULTI_IMAGE_PLAN_PROMPT.format(n_images=n)
        + f'\n\nUser message:\n"{safe_intent}"\n'
    )

    try:
        blobs = await asyncio.gather(
            *[fetch_image_bytes(u.strip()) for u in image_urls]
        )
    except Exception as e:
        logger.warning("[intent_plan] fetch images failed: %s", e)
        return None

    content: list[dict[str, Any]] = [{"type": "text", "text": header}]
    for i, blob in enumerate(blobs):
        content.append({"type": "text", "text": f"Image index {i}:"})
        content.append({"type": "image_url", "image_url": {"url": _bytes_to_data_url(blob)}})

    model = _garment_assess_grok_model()
    _log_grok_model_once(model)
    try:
        response_text = await xai_responses_output_text(
            model=model,
            user_content_parts=content,
            temperature=0.1,
        )
        raw = _strip_json_fence(response_text)
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning("[intent_plan] Grok planner JSON failed: %s", e)
        return None

    if not isinstance(data, dict):
        return None

    scene_idx = _parse_scene_image_index(data.get("scene_image_index"), n)
    assign_raw = data.get("assignments")
    assign_list = assign_raw if isinstance(assign_raw, list) else []
    out = _parse_assignment_rows(assign_list, n)
    if scene_idx is not None:
        out = [a for a in out if int(a["image_index"]) != scene_idx]

    if not out and scene_idx is None:
        return None

    if out:
        logger.info(
            "[intent_plan] grok assignments=%s scene_image_index=%s",
            json.dumps(out, ensure_ascii=False),
            scene_idx,
        )
    else:
        logger.info("[intent_plan] grok assignments=[] scene_image_index=%s", scene_idx)

    return (out, scene_idx)


async def _run_single_assignment_crop(
    a: dict[str, Any],
    urls: list[str],
    blobs: dict[int, bytes],
    intent: str,
) -> list[dict[str, str]]:
    idx = int(a["image_index"])
    src = urls[idx]
    mc = min(3, max(1, int(a["max_crops"])))
    focus = str(a["focus"])
    blob = blobs[idx]
    instr = _per_image_instruction_after_plan(intent, idx, len(urls), focus, mc)
    boxes = await detect_garment_boxes_for_intent(
        src,
        intent,
        image_bytes=blob,
        max_items=mc,
        instruction_override=instr,
        locate_focus=focus,
    )
    if not boxes:
        return []
    uploaded = await crop_boxes_upload(blob, boxes, max_outputs=mc)
    return [{"url": u, "source_url": src} for u in uploaded]


async def _execute_intent_assignments(
    assignments: list[dict[str, Any]],
    urls: list[str],
    intent: str,
) -> list[dict[str, str]]:
    """
    Run LocateAnything bbox per Grok assignment with bounded concurrency.
    Each assignment falls back to one-image Qwen3-VL if LocateAnything is unavailable or unusable.
    """
    if not assignments:
        return []
    idx_set = {int(a["image_index"]) for a in assignments}
    blobs: dict[int, bytes] = {}
    for idx in sorted(idx_set):
        blobs[idx] = downscale_image_bytes_for_locateanything(
            await fetch_image_bytes(urls[idx])
        )

    sem = asyncio.Semaphore(_locateanything_assignment_concurrency())

    async def run_one(a: dict[str, Any]) -> list[dict[str, str]]:
        async with sem:
            return await _run_single_assignment_crop(a, urls, blobs, intent)

    results = await asyncio.gather(
        *(run_one(a) for a in assignments),
        return_exceptions=True,
    )
    out: list[dict[str, str]] = []
    for item in results:
        if isinstance(item, Exception):
            logger.warning("[intent_preview] assignment bbox failed: %s", item)
            continue
        out.extend(item)
    return out


async def _intent_preview_crops_fallback_multi(
    image_urls: list[str],
    intent_text: str,
    skip_indices: set[int] | None = None,
) -> list[dict[str, str]]:
    """If planner fails or yields no crops: per-image bbox with explicit cross-image disambiguation."""
    out: list[dict[str, str]] = []
    n = len(image_urls)
    base = (intent_text or "").strip()
    skip = skip_indices or set()
    for i, src in enumerate(image_urls):
        if i in skip:
            continue
        s = (src or "").strip()
        if not s:
            continue
        fb = (
            f'User request: "{base[:700]}"\n'
            f"You are viewing **one of {n} user photos** (this is image index {i}).\n"
            "Draw box(es) **only** for garment(s) the user asked for that **this specific photo** is the best "
            "source for. If another photo is a better source for a piece, omit that piece here. "
            "At most **2** boxes. No skin-only or face boxes.\n"
            'Return JSON: {"items":[{"role":"top|bottom|dress|outerwear|other","label":"short English",'
            '"bbox_2d":[x0,y0,x1,y1]}]} — bbox 0–1000 scale.\n'
        )
        try:
            blob = downscale_image_bytes_for_locateanything(await fetch_image_bytes(s))
            boxes = await detect_garment_boxes_for_intent(
                s,
                base,
                image_bytes=blob,
                max_items=2,
                instruction_override=fb,
                locate_focus=base,
            )
            if not boxes:
                continue
            uploaded = await crop_boxes_upload(blob, boxes, max_outputs=2)
            for u in uploaded:
                out.append({"url": u, "source_url": s})
        except Exception as e:
            logger.exception("[intent_preview] fallback multi failed for %s: %s", s[:80], e)
    return out


async def intent_preview_crops(
    image_urls: list[str],
    intent_text: str,
) -> tuple[list[dict[str, str]], int | None]:
    """
    Studio chat rail: crop + R2 upload guided by user text.
    Multiple uploads: **Grok 4.1 fast reasoning** plans garment indices + optional ``scene_image_index``,
    then LocateAnything bbox per assigned photo only (Qwen3-VL fallback). Second return value is
    0-based scene frame index or null.
    """
    urls = [u.strip() for u in image_urls if isinstance(u, str) and u.strip()]
    if not urls:
        return [], None

    intent = (intent_text or "").strip()
    if not intent:
        intent = (
            "Identify garment pieces for virtual try-on (tops, bottoms, dress); "
            "tight boxes only on real clothing."
        )

    if len(urls) == 1:
        src = urls[0]
        try:
            blob = downscale_image_bytes_for_locateanything(await fetch_image_bytes(src))
            boxes = await detect_garment_boxes_for_intent(
                src, intent, image_bytes=blob, max_items=3
            )
            if not boxes:
                logger.info("[intent_preview] no boxes for source=%s", src[:60])
                return [], None
            uploaded = await crop_boxes_upload(blob, boxes, max_outputs=3)
            return [{"url": u, "source_url": src} for u in uploaded], None
        except Exception as e:
            logger.exception("intent_preview_crops failed for %s: %s", src[:80], e)
            return [], None

    plan_result = await plan_multi_image_intent_crops(urls, intent)
    if plan_result is None:
        logger.info("[intent_preview] empty plan, using per-image fallback")
        fb = await _intent_preview_crops_fallback_multi(urls, intent, None)
        return fb, None

    assignments, scene_idx = plan_result
    if not assignments:
        fb = await _intent_preview_crops_fallback_multi(
            urls,
            intent,
            {scene_idx} if scene_idx is not None else None,
        )
        return fb, scene_idx

    try:
        out = await _execute_intent_assignments(assignments, urls, intent)
    except Exception as e:
        logger.exception("[intent_preview] bbox execute plan failed: %s", e)
        out = []

    if not out:
        logger.info("[intent_preview] plan produced no crops, fallback")
        fb = await _intent_preview_crops_fallback_multi(
            urls,
            intent,
            {scene_idx} if scene_idx is not None else None,
        )
        return fb, scene_idx
    return out, scene_idx
