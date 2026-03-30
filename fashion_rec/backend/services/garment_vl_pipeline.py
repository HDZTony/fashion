"""
Grok 4.1 Fast vision (per-image scene / single-item) assessment + Qwen3-VL bounding boxes + PIL crop + R2 upload.

Default assess model: ``grok-4-1-fast-reasoning`` (xAI, text+image → text). Override with env
``GARMENT_ASSESS_GROK_MODEL`` (e.g. ``grok-4-1-fast-non-reasoning`` for lower latency).

Used by ChatKit tools for try-on: turn model-wearing or multi-item photos into clean garment tiles
similar to showcase product shots before POST /try-on.

Studio **intent rail** (multi-upload): **Grok** plans which global image index supplies which garment
(xAI documents no hard cap on image count per request; we send all user photos in one stateless Grok call).
**Qwen-VL** does bbox in **multi-image batches of at most 3 images per HTTP request** (see
``QWEN_VL_MAX_IMAGES_PER_CALL``): ``_execute_intent_assignments_qwen`` packs Grok ``assignments`` into
chunks of ≤3 **distinct** ``image_index`` values, each chunk → ``_qwen_batch_bbox_chunk``; on failure,
that chunk falls back to per-image single Qwen calls.

Developer doc: ``doc/grok-multimodal-and-qwen-batch.md`` (Grok Responses ``input_*`` parts, 20MiB limit,
stateless recommendation, Qwen 3-image batching). Grok uses native ``AsyncOpenAI.responses``; Qwen uses
``chat.completions`` on DashScope compatible endpoint.
"""

from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import logging
import re
import uuid
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import httpx
from PIL import Image

from services.dashscope_openai_client import dashscope_chat_completions_text
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

# Qwen3-VL: max **images** per single multimodal request (batch bbox in `_qwen_batch_bbox_chunk`).
# Assignments from Grok are packed into chunks of ≤ this many distinct image_index values; remainder
# and failed batches use single-image Qwen calls. See doc/grok-multimodal-and-qwen-batch.md.
QWEN_VL_MAX_IMAGES_PER_CALL = 3

GROK_MULTI_IMAGE_PLAN_PROMPT = """You plan **garment crops** for virtual try-on. The user sent **all** photos below in order.

Your job:
1) Read the user message (any language) and infer **which garment(s)** they want to try (e.g. black top + white skirt).
2) Look at **every** image and note what clothing is visible (rough list in English).
3) Decide **which image index** should supply **which** piece. Prefer **one clear photo per piece** — do **not**
   assign the same outfit pieces redundantly from every photo. Skip photos that do not help.
4) If **one** photo clearly shows **two different requested** pieces, you may set max_crops to 2 for that index only.

Image indices are **0, 1, 2, …** in the same order as the images appear below (first image = 0).

Return **only** valid JSON (no markdown):
{{
  "assignments": [
    {{"image_index": 0, "focus": "English: exactly what to tightly crop from this image only", "max_crops": 1}}
  ],
  "garments_seen_summary": "optional short English — what clothing appears across photos"
}}

Rules:
- **image_index** must satisfy 0 <= image_index < {n_images}.
- **max_crops** must be 1 or 2 (prefer 1).
- **assignments** may be empty if nothing is usable.
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
            b = await fetch_image_bytes(u)
            boxes = await qwen_detect_garment_boxes(
                u, user_intent_summary, image_bytes=b
            )
            if not boxes:
                out.append(u)
                steps.append(f"qwen_no_boxes_fallback_original: {u[:60]}...")
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


async def plan_multi_image_intent_crops(
    image_urls: list[str],
    intent_text: str,
) -> list[dict[str, Any]]:
    """
    **Grok 4.1 Fast** sees all user images + text (no Qwen 3-image cap). Returns which index to crop what.
    """
    n = len(image_urls)
    if n < 2:
        return []

    try:
        get_xai_async_openai_client()
    except RuntimeError as e:
        logger.warning("[intent_plan] Grok unavailable: %s", e)
        return []

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
        return []

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
        return []

    assign = data.get("assignments") if isinstance(data, dict) else None
    if not isinstance(assign, list) or not assign:
        return []

    out = _parse_assignment_rows(assign, n)
    if not out:
        return []
    logger.info("[intent_plan] grok assignments=%s", json.dumps(out, ensure_ascii=False))
    return out


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
    boxes = await qwen_detect_garment_boxes_for_intent(
        src,
        intent,
        image_bytes=blob,
        max_items=mc,
        instruction_override=instr,
    )
    if not boxes:
        return []
    uploaded = await crop_boxes_upload(blob, boxes, max_outputs=mc)
    return [{"url": u, "source_url": src} for u in uploaded]


def _items_to_boxes(items: list[Any], max_items: int) -> list[dict[str, Any]]:
    boxes: list[dict[str, Any]] = []
    cap = max(1, min(int(max_items), 8))
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
        boxes.append(
            {
                "role": str(it.get("role", "other")),
                "label": str(it.get("label", "")),
                "bbox_2d": b,
            }
        )
    return boxes


async def _qwen_batch_bbox_chunk(
    chunk: list[dict[str, Any]],
    urls: list[str],
    blobs: dict[int, bytes],
    intent: str,
) -> list[dict[str, str]] | None:
    """
    **Multi-image Qwen-VL batch**: one ``chat.completions`` call with 1..QWEN_VL_MAX_IMAGES_PER_CALL images plus text,
    JSON ``per_image[]`` aligned by slot order. Distinct ``image_index`` per slot required.
    """
    if not chunk or len(chunk) > QWEN_VL_MAX_IMAGES_PER_CALL:
        return None
    if len({int(a["image_index"]) for a in chunk}) != len(chunk):
        return None

    n_chunk = len(chunk)
    intro = (
        f'User request (context): "{intent[:600]}"\n\n'
        f"The next **{n_chunk}** image(s) are sent **in the same order** as the descriptions below.\n"
        "For each image, output tight boxes **only** for the garment described — not face, not bare skin only.\n\n"
    )
    lines: list[str] = []
    ordered_idx: list[int] = []
    for j, a in enumerate(chunk):
        idx = int(a["image_index"])
        mc = min(3, max(1, int(a["max_crops"])))
        ordered_idx.append(idx)
        lines.append(
            f"**Slot {j + 1} / {n_chunk}** → global user photo **image_index {idx}**:\n"
            f"Crop: {a['focus']}\nMax **{mc}** bounding box(es).\n"
        )
    footer = (
        "\nReturn **only** JSON (no markdown):\n"
        "{\n  \"per_image\": [\n"
        "    {\"image_index\": <int>, \"items\": [{\"role\":\"top|bottom|dress|outerwear|other\","
        "\"label\":\"short English\",\"bbox_2d\":[x0,y0,x1,y1]}]}\n"
        "  ]\n}\n"
        "- **0–1000** bbox scale; x0<x1, y0<y1.\n"
        f"- Each `image_index` must be one of: {', '.join(str(x) for x in ordered_idx)}.\n"
        "- Provide **exactly** one `per_image` object per slot, **in the same order** as the images below "
        "(first JSON object = first image in this message).\n"
        "- Use `\"items\": []` if nothing matches.\n"
    )

    full_text = intro + "\n".join(lines) + footer
    content: list[dict[str, Any]] = [{"type": "text", "text": full_text}]
    for a in chunk:
        idx = int(a["image_index"])
        content.append(
            {"type": "image_url", "image_url": {"url": _bytes_to_data_url(blobs[idx])}}
        )

    try:
        response_text = await _qwen_vl_completion(content)
        raw = _strip_json_fence(response_text)
        data = json.loads(raw)
    except Exception as e:
        logger.warning("[intent_preview] Qwen batch bbox invoke/parse failed: %s", e)
        return None

    per = data.get("per_image") if isinstance(data, dict) else None
    if not isinstance(per, list) or len(per) != n_chunk:
        logger.warning("[intent_preview] Qwen batch per_image len got %s want %s", len(per) if isinstance(per, list) else None, n_chunk)
        return None

    out: list[dict[str, str]] = []
    for slot, a in enumerate(chunk):
        idx = int(a["image_index"])
        mc = min(3, max(1, int(a["max_crops"])))
        row = per[slot]
        if not isinstance(row, dict):
            return None
        try:
            row_idx = int(row.get("image_index"))
        except (TypeError, ValueError):
            return None
        if row_idx != idx:
            logger.warning(
                "[intent_preview] batch slot %s image_index mismatch model=%s expected=%s",
                slot,
                row_idx,
                idx,
            )
            return None
        items = row.get("items")
        if not isinstance(items, list):
            return None
        boxes = _items_to_boxes(items, mc)
        blob = blobs[idx]
        uploaded = await crop_boxes_upload(blob, boxes, max_outputs=mc)
        for u in uploaded:
            out.append({"url": u, "source_url": urls[idx]})
    return out


async def _execute_intent_assignments_qwen(
    assignments: list[dict[str, Any]],
    urls: list[str],
    intent: str,
) -> list[dict[str, str]]:
    """
    **Slice Grok assignments into Qwen batches of ≤3 distinct photos** (see ``QWEN_VL_MAX_IMAGES_PER_CALL``).
    Each batch → ``_qwen_batch_bbox_chunk``; on parse mismatch or errors, process that batch with
    ``_run_single_assignment_crop`` (one image per Qwen call).
    """
    if not assignments:
        return []
    idx_set = {int(a["image_index"]) for a in assignments}
    blobs: dict[int, bytes] = {}
    for idx in sorted(idx_set):
        blobs[idx] = await fetch_image_bytes(urls[idx])

    out: list[dict[str, str]] = []
    i = 0
    lim = len(assignments)
    while i < lim:
        chunk: list[dict[str, Any]] = []
        seen_idx: set[int] = set()
        while i < lim and len(chunk) < QWEN_VL_MAX_IMAGES_PER_CALL:
            a = assignments[i]
            idx = int(a["image_index"])
            if idx in seen_idx:
                break
            seen_idx.add(idx)
            chunk.append(a)
            i += 1

        batch = await _qwen_batch_bbox_chunk(chunk, urls, blobs, intent)
        if batch is not None:
            out.extend(batch)
            continue
        for a in chunk:
            out.extend(await _run_single_assignment_crop(a, urls, blobs, intent))
    return out


async def _intent_preview_crops_fallback_multi(
    image_urls: list[str],
    intent_text: str,
) -> list[dict[str, str]]:
    """If planner fails or yields no crops: per-image Qwen with explicit cross-image disambiguation."""
    out: list[dict[str, str]] = []
    n = len(image_urls)
    base = (intent_text or "").strip()
    for i, src in enumerate(image_urls):
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
            blob = await fetch_image_bytes(s)
            boxes = await qwen_detect_garment_boxes_for_intent(
                s,
                base,
                image_bytes=blob,
                max_items=2,
                instruction_override=fb,
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
) -> list[dict[str, str]]:
    """
    Studio chat rail: crop + R2 upload guided by user text.
    Multiple uploads: first a **multi-image plan** (which photo supplies which piece), then bbox per assigned photo only.
    """
    urls = [u.strip() for u in image_urls if isinstance(u, str) and u.strip()]
    if not urls:
        return []

    intent = (intent_text or "").strip()
    if not intent:
        intent = (
            "Identify garment pieces for virtual try-on (tops, bottoms, dress); "
            "tight boxes only on real clothing."
        )

    if len(urls) == 1:
        src = urls[0]
        try:
            blob = await fetch_image_bytes(src)
            boxes = await qwen_detect_garment_boxes_for_intent(
                src, intent, image_bytes=blob, max_items=3
            )
            if not boxes:
                logger.info("[intent_preview] no boxes for source=%s", src[:60])
                return []
            uploaded = await crop_boxes_upload(blob, boxes, max_outputs=3)
            return [{"url": u, "source_url": src} for u in uploaded]
        except Exception as e:
            logger.exception("intent_preview_crops failed for %s: %s", src[:80], e)
            return []

    plan = await plan_multi_image_intent_crops(urls, intent)
    if not plan:
        logger.info("[intent_preview] empty plan, using per-image fallback")
        return await _intent_preview_crops_fallback_multi(urls, intent)

    try:
        out = await _execute_intent_assignments_qwen(plan, urls, intent)
    except Exception as e:
        logger.exception("[intent_preview] Qwen execute plan failed: %s", e)
        out = []

    if not out:
        logger.info("[intent_preview] plan produced no crops, fallback")
        return await _intent_preview_crops_fallback_multi(urls, intent)
    return out
