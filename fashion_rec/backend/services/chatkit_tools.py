"""
ChatKit / OpenAI Agents server tools: outfit generation (Qwen/Grok VL) + virtual try-on (/try-on).

Try-on calls POST /try-on; when DashScope blocks content, the backend may retry with xAI Grok Imagine
if TRYON_XAI_FALLBACK is enabled and XAI_API_KEY is set (see services/xai_tryon_fallback.py).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx
from agents import function_tool
from agents.run_context import RunContextWrapper
from chatkit.agents import AgentContext
from chatkit.types import ImageAttachment, UserMessageItem

from services.fal_multi_angle import PRESET_ANGLES
from services.guest_quota import check_and_consume_outfit
from services.guest_quota import get_client_ip
from services.outfit_agent import generate_outfit_suggestions

logger = logging.getLogger(__name__)

_TRY_ON_HTTP_TIMEOUT_SEC = 600.0


def _norm_garment_url(u: str) -> str:
    return (u or "").strip().rstrip("/")


def _studio_try_on_urls_from_ctx(req: dict[str, Any]) -> list[str]:
    oc = req.get("outfit_context")
    if not isinstance(oc, dict):
        return []
    raw = oc.get("studio_try_on_garment_urls")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if x is not None and str(x).strip()][:32]


def _excluded_try_on_urls_from_ctx(req: dict[str, Any]) -> set[str]:
    oc = req.get("outfit_context")
    if not isinstance(oc, dict):
        return set()
    raw = oc.get("excluded_try_on_garment_urls")
    if not isinstance(raw, list):
        return set()
    return {_norm_garment_url(str(x)) for x in raw if x is not None and str(x).strip()}


def _filter_try_on_garment_urls(urls: list[str], excluded: set[str]) -> list[str]:
    if not excluded:
        return urls
    out: list[str] = []
    for u in urls:
        nu = _norm_garment_url(u)
        if nu and nu not in excluded:
            out.append(u.strip())
    return out


def _is_chatkit_attachment_preview_url(url: str) -> bool:
    u = (url or "").strip()
    if not u:
        return False
    lu = u.lower()
    return "/chatkit/attachments/" in lu and "/preview" in lu


def garment_url_kind_for_tryon_log(url: str) -> str:
    """
    Coarse label for logs: whether Qwen Image 1 collage is likely full-frame preview vs R2 crop tile.
    """
    u = (url or "").strip()
    if not u:
        return "empty"
    if _is_chatkit_attachment_preview_url(u):
        return "chatkit_preview_full_frame"
    lu = u.lower()
    if "r2.fashion-rec.com" in lu or "r2.dev" in lu or "/cdn-cgi/image/" in lu:
        return "r2_or_cdn_tile"
    return "other_https"


async def _expand_chatkit_preview_garment_urls(
    urls: list[str],
    intent_text: str,
) -> list[str]:
    """
    Replace each maximal consecutive run of ChatKit `/chatkit/attachments/.../preview` URLs with
    R2 tiles from ``intent_preview_crops`` (same pipeline as Studio sidebar). Other URLs keep order.

    Handles mixed lists (e.g. wardrobe R2 + chat previews) where ``all(...)`` preview checks would skip.
    """
    if not urls:
        return urls
    from services.garment_vl_pipeline import intent_preview_crops

    itxt = (intent_text or "").strip() or (
        "Identify garment pieces in the image for virtual try-on (tops, bottoms, dress)."
    )
    out: list[str] = []
    i = 0
    n = len(urls)
    while i < n:
        raw = urls[i]
        u = str(raw).strip()
        if not _is_chatkit_attachment_preview_url(u):
            logger.info(
                "[QwenImage1][expand] passthrough_non_chatkit kind=%s head=%s",
                garment_url_kind_for_tryon_log(u),
                u[:120],
            )
            out.append(u)
            i += 1
            continue
        run: list[str] = []
        while i < n:
            seg = str(urls[i]).strip()
            if not _is_chatkit_attachment_preview_url(seg):
                break
            run.append(seg)
            i += 1
        logger.info(
            "[QwenImage1][expand] chatkit_preview_run n=%s heads=%s",
            len(run),
            [x[:100] for x in run],
        )
        try:
            rows = await intent_preview_crops(run, itxt)
            nu = [
                str(r["url"]).strip()
                for r in rows
                if isinstance(r, dict)
                and isinstance(r.get("url"), str)
                and str(r["url"]).strip()
            ]
            if nu:
                logger.info(
                    "[QwenImage1][expand] intent_preview_crops ok run_in=%d tiles_out=%s heads=%s",
                    len(run),
                    len(nu),
                    [x[:100] for x in nu[:5]],
                )
                out.extend(nu)
            else:
                logger.warning(
                    "[QwenImage1][expand] intent_preview_crops returned 0 tiles; "
                    "keeping %d full-frame preview URL(s) for collage",
                    len(run),
                )
                out.extend(run)
        except Exception as e:
            logger.warning(
                "[ChatKit try-on] intent_preview_crops for preview run len=%d failed: %s",
                len(run),
                e,
            )
            out.extend(run)
    return out


# Fallback when outfit context has no model_image_url (must match frontend DEFAULT_MODEL_IMAGE_URL).
_DEFAULT_TRYON_MODEL_IMAGE_URL = "https://r2.fashion-rec.com/example/IMG_9953.JPG"
_MULTI_ANGLE_HTTP_TIMEOUT_SEC = 600.0


def _internal_api_auth_headers(req_ctx: dict[str, Any]) -> dict[str, str]:
    """
    Forward auth to same-origin FastAPI routes. Cookie-only sessions have no Authorization header
    on the incoming request; optional auth still provides access_token in context.
    """
    token = req_ctx.get("access_token")
    if isinstance(token, str) and token.strip():
        return {"Authorization": f"Bearer {token.strip()}"}
    http_request = req_ctx.get("request")
    if http_request is not None:
        auth_h = http_request.headers.get("authorization")
        if auth_h:
            return {"Authorization": auth_h}
    return {}


def _merge_outfit_params_from_context(
    req: dict[str, Any],
    user_request: str,
    model_image_url: str | None,
    background_image_url: str | None,
    background_action_prompt: str | None,
) -> dict[str, Any]:
    """
    Merge tool arguments with optional `outfit_context` from the ChatKit HTTP request
    (same fields as POST /outfit). Tool-provided URLs win when non-empty.
    """
    oc_raw = req.get("outfit_context")
    oc: dict[str, Any] = oc_raw if isinstance(oc_raw, dict) else {}

    def pick_str(tool_val: str | None, key: str) -> str | None:
        if tool_val and str(tool_val).strip():
            return str(tool_val).strip()
        v = oc.get(key)
        return str(v).strip() if isinstance(v, str) and v.strip() else None

    base_raw = oc.get("base_item_ids")
    base_item_ids: list[str] | None
    if isinstance(base_raw, list) and base_raw:
        base_item_ids = [str(x) for x in base_raw if x is not None and str(x).strip()]
    else:
        base_item_ids = None

    sir_raw = oc.get("selected_items_roles")
    selected_items_roles: dict[str, str] | None
    if isinstance(sir_raw, dict) and sir_raw:
        selected_items_roles = {
            str(k): str(v) for k, v in sir_raw.items() if v is not None
        }
    else:
        selected_items_roles = None

    loc = oc.get("location")
    location = str(loc).strip() if isinstance(loc, str) and loc.strip() else None

    model_raw = oc.get("model")
    model = model_raw if model_raw in ("qwen", "grok") else "qwen"

    return {
        "user_prompt": user_request.strip(),
        "location": location,
        "base_item_ids": base_item_ids,
        "background_image_url": pick_str(background_image_url, "background_image_url"),
        "background_action_prompt": pick_str(
            background_action_prompt, "background_action_prompt"
        ),
        "model_image_url": pick_str(model_image_url, "model_image_url"),
        "selected_items_roles": selected_items_roles,
        "model": model,
    }


def _optimize_image_url_for_model(
    image_url: Optional[str], width: int = 800, quality: int = 85
) -> Optional[str]:
    """Match main.py /outfit behavior for R2 + Cloudflare Image Resize."""
    if not image_url:
        return None
    if "/cdn-cgi/image/" in image_url:
        return image_url
    if "r2.fashion-rec.com" not in image_url:
        return image_url
    try:
        from urllib.parse import urlparse, urlunparse

        parsed = urlparse(image_url)
        path = parsed.path
        optimized_path = f"/cdn-cgi/image/width={width},quality={quality}{path}"
        return urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                optimized_path,
                parsed.params,
                parsed.query,
                parsed.fragment,
            )
        )
    except Exception as e:
        logger.warning("Failed to optimize image URL %s: %s", image_url, e)
        return image_url


@function_tool
async def generate_outfit_recommendations(
    ctx: RunContextWrapper[AgentContext[dict[str, Any]]],
    user_request: str,
    model_image_url: str | None = None,
    background_image_url: str | None = None,
    background_action_prompt: str | None = None,
) -> str:
    """
    Generate outfit recommendations from the user's wardrobe and weather context (Qwen or Grok VL pipeline).
    Call when the user has enough context or explicitly asks for outfits.
    The HTTP client may send `X-Fashion-Rec-Outfit-Context` with the same payload as Studio POST /outfit
    (base_item_ids, selected_items_roles, background/model URLs, model=qwen|grok). Tool URL args override context.
    """
    agent_ctx = ctx.context
    req: dict[str, Any] = agent_ctx.request_context
    http_request = req.get("request")
    user_id: str | None = req.get("user_id")

    if not http_request:
        return "Error: missing request context; cannot run outfit generation."

    if user_id is None:
        allowed, _remaining, _limit = check_and_consume_outfit(http_request)
        if not allowed:
            return (
                "Guest daily outfit recommendation limit reached for this IP. "
                "Please sign in for more recommendations."
            )
        effective_user_id = "guest"
    else:
        effective_user_id = user_id

    client_ip = get_client_ip(http_request)
    merged = _merge_outfit_params_from_context(
        req,
        user_request,
        model_image_url,
        background_image_url,
        background_action_prompt,
    )

    try:
        bg_opt = _optimize_image_url_for_model(merged["background_image_url"])
        model_opt = _optimize_image_url_for_model(merged["model_image_url"])
        result = await generate_outfit_suggestions(
            user_id=effective_user_id,
            location=merged["location"],
            user_prompt=merged["user_prompt"],
            base_item_ids=merged["base_item_ids"],
            background_image_url=bg_opt,
            background_action_prompt=merged["background_action_prompt"],
            model_image_url=model_opt,
            client_ip=client_ip,
            selected_items_roles=merged["selected_items_roles"],
            model=merged["model"],
        )
    except Exception as e:
        logger.exception("generate_outfit_recommendations failed: %s", e)
        return f"Outfit generation failed: {e!s}"

    outfits = result.get("outfits") or []
    weather_summary = result.get("weather_summary", "")
    wardrobe_count = result.get("wardrobe_count", 0)

    payload = {
        "weather_summary": weather_summary,
        "wardrobe_count": wardrobe_count,
        "outfits": outfits,
    }
    # Model-friendly compact view
    lines = [
        f"Weather context: {weather_summary}",
        f"Wardrobe items considered: {wardrobe_count}",
        "",
    ]
    for i, o in enumerate(outfits, start=1):
        title = o.get("title", f"Outfit {i}")
        reason = o.get("reason", "")
        lines.append(f"### {title}")
        lines.append(reason)
        for it in o.get("items") or []:
            role = it.get("role", "")
            desc = it.get("description", "")
            wid = it.get("wardrobe_id")
            lines.append(f"- {role}: {desc}" + (f" (wardrobe_id={wid})" if wid else ""))
        lt = o.get("long_text")
        if lt:
            lines.append(lt)
        lines.append("")

    lines.append("--- JSON (for reference) ---")
    lines.append(json.dumps(payload, ensure_ascii=False)[:12000])
    return "\n".join(lines)


async def _latest_user_message_image_preview_urls(
    store: Any,
    thread_id: str,
    context: dict[str, Any],
) -> list[str]:
    """
    Newest-first scan of user messages; return URLs from the latest user message that has image attachments.
    So if the user later replies with text only (e.g. confirming try-on), we still pick the prior message's photos.
    """
    page = await store.load_thread_items(thread_id, None, 100, "desc", context)
    for item in page.data:
        if isinstance(item, UserMessageItem):
            urls: list[str] = []
            for att in item.attachments:
                if isinstance(att, ImageAttachment):
                    urls.append(str(att.preview_url))
            if urls:
                return urls
    return []


@function_tool
async def assess_garment_try_on_sources(
    ctx: RunContextWrapper[AgentContext[dict[str, Any]]],
    image_urls_json: str | None = None,
) -> str:
    """
    **Step 1 (Grok 4.1 Fast vision, per image):** For each garment/reference image URL, decide whether **piece extraction**
    is needed (model wearing clothes, multiple products in one frame, busy scene). Single clean product shots
    on simple backgrounds should **not** need extraction.

    If `image_urls_json` is omitted or empty, uses image attachments from the **latest user message** that has photos
    (same rule as virtual try-on).

    Returns JSON: `urls`, `needs_piece_extraction` (booleans, same order), `details` (per-URL Grok rationale).
    """
    from services.garment_vl_pipeline import assess_url_list

    agent_ctx = ctx.context
    thread_id = agent_ctx.thread.id
    store = agent_ctx.store

    raw = (image_urls_json or "").strip()
    if raw:
        try:
            urls = json.loads(raw)
            if not isinstance(urls, list) or not all(
                isinstance(x, str) and str(x).strip() for x in urls
            ):
                return "Error: image_urls_json must be a JSON array of non-empty strings (URLs)."
            urls = [str(u).strip() for u in urls]
        except json.JSONDecodeError as e:
            return f"Error: invalid image_urls_json: {e!s}"
    else:
        urls = await _latest_user_message_image_preview_urls(
            store, thread_id, agent_ctx.request_context
        )
    if not urls:
        return (
            "No image URLs to assess. Ask the user to attach garment/reference photos, then call again."
        )
    try:
        payload = await assess_url_list(urls)
    except Exception as e:
        logger.exception("assess_garment_try_on_sources failed: %s", e)
        return f"Assessment failed: {e!s}"
    return json.dumps(payload, ensure_ascii=False)


@function_tool
async def extract_isolated_garment_pieces_for_try_on(
    ctx: RunContextWrapper[AgentContext[dict[str, Any]]],
    source_urls_json: str,
    extraction_mask_json: str,
    user_intent_summary: str = "",
) -> str:
    """
    **Step 2 (Qwen3-VL sub-pipeline):** For each source URL, either **pass through** the original URL or **run**
    bounding-box detection + PIL crop + R2 upload (one tile per detected garment), like clean showcase product images.

    - `source_urls_json`: JSON array of image URLs (same order as `assess_garment_try_on_sources` returned in `urls`).
    - `extraction_mask_json`: JSON array of booleans, same length — `true` means run Qwen crop pipeline on that URL;
      `false` means keep the original URL as one garment input.

    Pass `user_intent_summary` (English) to help Qwen disambiguate (e.g. tube top + pleated skirt only).

    Returns JSON with `garment_urls` (flat list for try-on collage) and `steps` (short log lines). Feed `garment_urls`
    into `generate_virtual_try_on` as `prepared_garment_urls_json`.
    """
    from services.garment_vl_pipeline import extract_or_passthrough_urls

    try:
        urls = json.loads(source_urls_json)
        if not isinstance(urls, list) or not all(
            isinstance(x, str) and str(x).strip() for x in urls
        ):
            return "Error: source_urls_json must be a JSON array of URL strings."
        urls = [str(u).strip() for u in urls]
    except json.JSONDecodeError as e:
        return f"Error: invalid source_urls_json: {e!s}"

    try:
        mask_raw = json.loads(extraction_mask_json)
        if not isinstance(mask_raw, list):
            return "Error: extraction_mask_json must be a JSON array."
        mask: list[bool] = []
        for x in mask_raw:
            if isinstance(x, bool):
                mask.append(x)
            elif isinstance(x, int) and x in (0, 1):
                mask.append(bool(x))
            else:
                return (
                    "Error: extraction_mask_json entries must be booleans or 0/1 integers."
                )
    except json.JSONDecodeError as e:
        return f"Error: invalid extraction_mask_json: {e!s}"

    try:
        payload = await extract_or_passthrough_urls(
            urls,
            mask,
            (user_intent_summary or "").strip(),
        )
    except ValueError as e:
        return f"Error: {e!s}"
    except Exception as e:
        logger.exception("extract_isolated_garment_pieces_for_try_on failed: %s", e)
        return f"Extraction failed: {e!s}"

    return json.dumps(payload, ensure_ascii=False)


@function_tool
async def generate_virtual_try_on(
    ctx: RunContextWrapper[AgentContext[dict[str, Any]]],
    intent_summary: str,
    garment_image_url_override: str | None = None,
    extra_style_notes: str | None = None,
    prepared_garment_urls_json: str | None = None,
) -> str:
    """
    Virtual try-on (same pipeline as POST /try-on): garment from the user's attached photo; model person image
    from `X-Fashion-Rec-Outfit-Context` (app-selected model) or a built-in default — do not require the user
    to open another page to pick a model.

    When to call:
    - After the user has **confirmed** they want immediate try-on (or explicitly asked to skip questions), not on the
      first vague "try this" turn unless your instructions allow skipping the confirmation step.
    - A garment image must still exist in the thread (usually an earlier user message attachment).

    Parameters:
    - intent_summary: Short English summary of what the user wants (merged from the message, e.g. try this two-piece on the model).
    - garment_image_url_override: Only if the user gave a public image URL in text; otherwise omit — the server uses the latest message's attachments.
    - extra_style_notes: Optional pose/background hints for the try-on API.
    - prepared_garment_urls_json: Optional JSON array from `extract_isolated_garment_pieces_for_try_on`.
      **Ignored when** the client sends non-empty `studio_try_on_garment_urls` (sidebar intent crops from
      `/studio/intent-garment-crops`) — those match the UI and win over agent extract (which may fall back to full frames).
    """
    agent_ctx = ctx.context
    req_ctx: dict[str, Any] = agent_ctx.request_context
    http_request = req_ctx.get("request")
    if not http_request:
        return "Error: missing HTTP request context; cannot run virtual try-on."

    thread_id = agent_ctx.thread.id
    store = agent_ctx.store

    studio_rail = _studio_try_on_urls_from_ctx(req_ctx)
    prepared_raw = (
        str(prepared_garment_urls_json).strip() if prepared_garment_urls_json else ""
    )
    garment_branch = ""
    _oc = req_ctx.get("outfit_context")
    logger.info(
        "[QwenImage1][try-on] thread_id=%s outfit_context_is_dict=%s "
        "header_studio_try_on_garment_urls_count=%s prepared_garment_urls_json_set=%s",
        thread_id,
        isinstance(_oc, dict),
        len(studio_rail),
        bool(prepared_raw),
    )

    if studio_rail:
        garment_branch = "studio_rail"
        urls = list(studio_rail)
        if garment_image_url_override and str(garment_image_url_override).strip():
            logger.info(
                "Ignoring garment_image_url_override; using %d studio_try_on_garment_urls from outfit header",
                len(urls),
            )
        if prepared_raw:
            logger.info(
                "[ChatKit try-on] garment sources=studio_rail (sidebar crops; overrides prepared_garment_urls_json) urls=%s",
                json.dumps(urls, ensure_ascii=False),
            )
        else:
            logger.info(
                "[ChatKit try-on] garment sources=studio_rail urls=%s",
                json.dumps(urls, ensure_ascii=False),
            )
    elif prepared_raw:
        garment_branch = "prepared_garment_urls_json"
        try:
            parsed = json.loads(prepared_raw)
            if not isinstance(parsed, list) or not all(
                isinstance(x, str) and str(x).strip() for x in parsed
            ):
                return (
                    "Error: prepared_garment_urls_json must be a JSON array of non-empty URL strings."
                )
            urls = [str(u).strip() for u in parsed]
        except json.JSONDecodeError as e:
            return f"Error: invalid prepared_garment_urls_json: {e!s}"
        if not urls:
            return "Error: prepared_garment_urls_json array is empty."
        logger.info(
            "[ChatKit try-on] garment sources=prepared_garment_urls_json urls=%s",
            json.dumps(urls, ensure_ascii=False),
        )
        if garment_image_url_override and str(garment_image_url_override).strip():
            logger.info(
                "Ignoring garment_image_url_override because prepared_garment_urls_json is set"
            )
    else:
        garment_branch = "thread_attachments"
        from_store = await _latest_user_message_image_preview_urls(
            store, thread_id, req_ctx
        )
        override_raw = (
            str(garment_image_url_override).strip()
            if garment_image_url_override
            else ""
        )
        if len(from_store) >= 2:
            urls = list(from_store)
            if override_raw:
                logger.info(
                    "Ignoring garment_image_url_override; using %d thread image attachments for try-on",
                    len(from_store),
                )
        elif override_raw:
            urls = [override_raw]
        else:
            urls = list(from_store)
        if not urls:
            return (
                "No garment image in the latest user message. Ask the user to attach a clear photo of the clothes "
                "they want to try, then call this tool again."
            )
        logger.info(
            "[ChatKit try-on] garment sources=thread_attachments urls=%s",
            json.dumps(urls, ensure_ascii=False),
        )

    # Map ChatKit full-frame previews → R2 intent tiles (same as Studio sidebar). Handles pure-preview
    # lists and mixed lists (e.g. wardrobe R2 URL + chat previews).
    itxt_expand = (intent_summary or "").strip() or (
        "Identify garment pieces in the image for virtual try-on (tops, bottoms, dress)."
    )
    kinds_before = [garment_url_kind_for_tryon_log(u) for u in urls]
    chatkit_before = sum(1 for k in kinds_before if k == "chatkit_preview_full_frame")
    urls_before_expand = list(urls)
    logger.info(
        "[QwenImage1][try-on] before_expand branch=%s n=%s chatkit_preview_count=%s kinds=%s "
        "sample_heads=%s",
        garment_branch,
        len(urls),
        chatkit_before,
        kinds_before,
        [u[:120] for u in urls[:6]],
    )
    urls = await _expand_chatkit_preview_garment_urls(urls, itxt_expand)
    kinds_after = [garment_url_kind_for_tryon_log(u) for u in urls]
    chatkit_after = sum(1 for k in kinds_after if k == "chatkit_preview_full_frame")
    logger.info(
        "[QwenImage1][try-on] after_expand n=%s chatkit_preview_remaining=%s kinds=%s "
        "list_changed=%s sample_heads=%s",
        len(urls),
        chatkit_after,
        kinds_after,
        urls != urls_before_expand,
        [u[:120] for u in urls[:6]],
    )

    excluded = _excluded_try_on_urls_from_ctx(req_ctx)
    urls = _filter_try_on_garment_urls(urls, excluded)
    if not urls:
        return (
            "No garment images left for try-on (the user may have removed pieces from the chat sidebar). "
            "Ask them to restore items or attach photos again."
        )

    merged = _merge_outfit_params_from_context(
        req_ctx,
        intent_summary.strip() or "virtual try-on from chat",
        None,
        None,
        None,
    )
    person_url = merged["model_image_url"] or _DEFAULT_TRYON_MODEL_IMAGE_URL
    person_opt = _optimize_image_url_for_model(person_url) or person_url

    base = str(http_request.base_url).rstrip("/")
    headers = _internal_api_auth_headers(req_ctx)

    form: dict[str, str] = {
        "garment_urls": json.dumps(urls),
        "person_image_url": person_opt,
    }
    hint_parts: list[str] = []
    if intent_summary and str(intent_summary).strip():
        hint_parts.append(str(intent_summary).strip())
    if extra_style_notes and str(extra_style_notes).strip():
        hint_parts.append(str(extra_style_notes).strip())
    if hint_parts:
        form["prompt"] = "\n".join(hint_parts)
    bg = merged.get("background_image_url")
    if bg:
        form["background_image_url"] = _optimize_image_url_for_model(bg) or bg
    bap = merged.get("background_action_prompt")
    if bap and form.get("background_image_url"):
        form["background_action_prompt"] = bap

    logger.info(
        "[ChatKit try-on] POST /try-on garment_urls=%s person_image_url=%s",
        json.dumps(urls, ensure_ascii=False),
        person_opt[:120] if person_opt else "",
    )

    try:
        async with httpx.AsyncClient(timeout=_TRY_ON_HTTP_TIMEOUT_SEC) as client:
            resp = await client.post(f"{base}/try-on", data=form, headers=headers)
    except httpx.HTTPError as e:
        logger.exception("generate_virtual_try_on HTTP error: %s", e)
        return f"Virtual try-on request failed: {e!s}"

    if resp.status_code >= 400:
        detail: Any = resp.text
        try:
            body = resp.json()
            if isinstance(body, dict) and "detail" in body:
                detail = body["detail"]
        except Exception:
            pass
        return f"Virtual try-on failed (HTTP {resp.status_code}): {detail}"

    try:
        data = resp.json()
    except Exception as e:
        return f"Virtual try-on returned invalid JSON: {e!s}"
    out_url = data.get("url")
    if not out_url:
        return f"Virtual try-on response missing url: {data!r}"

    return (
        "SUCCESS. Virtual try-on image URL (share with the user, they can open in a new tab):\n"
        f"{out_url}\n"
        f"(Garment source(s) used as collage input: {len(urls)} image(s); intent: {intent_summary.strip()})"
    )


@function_tool
async def generate_multi_angle_view(
    ctx: RunContextWrapper[AgentContext[dict[str, Any]]],
    source_image_url: str,
    preset: str = "left",
    additional_prompt: str | None = None,
) -> str:
    """
    Render the same outfit/person from another camera angle (multi-angle), using the existing result image as source.

    When to call:
    - Only after the user **agrees** they want another angle (e.g. 看看侧面/背面/换个角度, "show from the left", "back view").
    - The source must be a **reachable image URL** — typically the URL returned by `generate_virtual_try_on`, or another full-body
      fashion render the user confirmed.

    Do **not** call on the first turn after recommendations-only text with no image URL.

    Parameters:
    - source_image_url: Full URL of the source image (try-on output or equivalent).
    - preset: One of: front, left, right, back, top, low (default left).
    - additional_prompt: Optional extra hints for the angle model.
    """
    agent_ctx = ctx.context
    req_ctx: dict[str, Any] = agent_ctx.request_context
    http_request = req_ctx.get("request")
    user_id: str | None = req_ctx.get("user_id")

    if not http_request:
        return "Error: missing HTTP request context; cannot run multi-angle generation."
    if user_id is None:
        return (
            "Multi-angle generation requires a signed-in account. Ask the user to log in and try again."
        )

    url = str(source_image_url).strip()
    if not url:
        return "Error: source_image_url is empty."

    p = str(preset).strip().lower() if preset else "left"
    if p not in PRESET_ANGLES:
        allowed = ", ".join(sorted(PRESET_ANGLES))
        return f"Invalid preset {preset!r}. Use one of: {allowed}"

    base = str(http_request.base_url).rstrip("/")
    headers = _internal_api_auth_headers(req_ctx)

    form: dict[str, str] = {"image_url": url, "preset": p}
    if additional_prompt and str(additional_prompt).strip():
        form["additional_prompt"] = str(additional_prompt).strip()

    try:
        async with httpx.AsyncClient(timeout=_MULTI_ANGLE_HTTP_TIMEOUT_SEC) as client:
            resp = await client.post(f"{base}/generate-angles", data=form, headers=headers)
    except httpx.HTTPError as e:
        logger.exception("generate_multi_angle_view HTTP error: %s", e)
        return f"Multi-angle request failed: {e!s}"

    if resp.status_code >= 400:
        detail: Any = resp.text
        try:
            body = resp.json()
            if isinstance(body, dict) and "detail" in body:
                detail = body["detail"]
        except Exception:
            pass
        return f"Multi-angle failed (HTTP {resp.status_code}): {detail}"

    try:
        data = resp.json()
    except Exception as e:
        return f"Multi-angle returned invalid JSON: {e!s}"
    out_url = data.get("url")
    if not out_url:
        return f"Multi-angle response missing url: {data!r}"

    angle_type = data.get("angle_type", p)
    return (
        "SUCCESS. Multi-angle image URL (share with the user):\n"
        f"{out_url}\n"
        f"(preset={angle_type}; source was the provided image URL)"
    )
