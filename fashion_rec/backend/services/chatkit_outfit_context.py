"""
Parse optional outfit context from ChatKit requests (mirrors Studio /outfit payload).
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from starlette.requests import Request

logger = logging.getLogger(__name__)

OUTFIT_CONTEXT_HEADER = "x-fashion-rec-outfit-context"


def parse_outfit_context_from_request(request: Request) -> dict[str, Any] | None:
    raw = request.headers.get(OUTFIT_CONTEXT_HEADER)
    if not raw or not raw.strip():
        return None
    try:
        padded = raw.strip() + "=" * (-len(raw.strip()) % 4)
        data = base64.urlsafe_b64decode(padded.encode("ascii"))
        obj = json.loads(data.decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.warning("Invalid %s header: %s", OUTFIT_CONTEXT_HEADER, e)
        return None
    if not isinstance(obj, dict):
        return None
    return _sanitize_outfit_context(obj)


def _sanitize_outfit_context(obj: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}

    bids = obj.get("base_item_ids")
    if isinstance(bids, list):
        out["base_item_ids"] = [str(x) for x in bids if x is not None and str(x).strip()]

    sir = obj.get("selected_items_roles")
    if isinstance(sir, dict):
        out["selected_items_roles"] = {
            str(k): str(v) for k, v in sir.items() if k is not None and v is not None
        }

    for key in (
        "background_image_url",
        "background_action_prompt",
        "model_image_url",
        "location",
    ):
        v = obj.get(key)
        if isinstance(v, str) and v.strip():
            out[key] = v.strip()

    model = obj.get("model")
    if isinstance(model, str) and model.strip().lower() in ("qwen", "grok"):
        out["model"] = model.strip().lower()

    ex = obj.get("excluded_try_on_garment_urls")
    if isinstance(ex, list):
        urls = [str(x).strip() for x in ex if x is not None and str(x).strip()][:32]
        if urls:
            out["excluded_try_on_garment_urls"] = urls

    rail = obj.get("studio_try_on_garment_urls")
    if isinstance(rail, list):
        rurls = [str(x).strip() for x in rail if x is not None and str(x).strip()][:24]
        if rurls:
            out["studio_try_on_garment_urls"] = rurls

    return out
