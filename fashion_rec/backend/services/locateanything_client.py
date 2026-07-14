"""
HTTP client for the local LocateAnything-3B bbox service.

The service is expected to expose ``POST /v1/locate`` with:
``{"image_url": "...", "prompt": "..."}``, returning text that contains
one or more ``<box><x1><y1><x2><y2></box>`` spans on a 0-1000 scale.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

logger = logging.getLogger(__name__)

DEFAULT_LOCATEANYTHING_BASE_URL = "http://100.73.75.78:8000"
_BOX_RE = re.compile(
    r"<box>\s*<(-?\d+(?:\.\d+)?)>\s*<(-?\d+(?:\.\d+)?)>\s*"
    r"<(-?\d+(?:\.\d+)?)>\s*<(-?\d+(?:\.\d+)?)>\s*</box>",
    re.IGNORECASE,
)


class LocateAnythingError(RuntimeError):
    """LocateAnything service failed or returned unusable bbox output."""


def locateanything_enabled() -> bool:
    raw = (os.getenv("LOCATEANYTHING_ENABLED") or "true").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _base_url() -> str:
    return (
        os.getenv("LOCATEANYTHING_BASE_URL") or DEFAULT_LOCATEANYTHING_BASE_URL
    ).strip().rstrip("/")


def _timeout_seconds() -> float:
    raw = (os.getenv("LOCATEANYTHING_TIMEOUT_SECONDS") or "60").strip()
    try:
        return max(1.0, float(raw))
    except ValueError:
        return 60.0


def rewrite_image_url_for_locateanything_fetch(url: str) -> str:
    """Rewrite localhost URLs to a tailnet IP so remote GPU can HTTP-fetch the image.

    Example: backend on 100.127.212.44 serves ``http://127.0.0.1:8001/...``; LocateAnything on
    100.73.75.78 receives ``http://100.127.212.44:8001/...`` instead.
    Set ``LOCATEANYTHING_TAILNET_DEV_HOST`` (e.g. ``100.127.212.44``) in local ``.env``.
    """
    tailnet_host = (os.getenv("LOCATEANYTHING_TAILNET_DEV_HOST") or "").strip()
    if not tailnet_host or not url:
        return url
    try:
        p = urlparse(url)
        h = (p.hostname or "").lower()
        if h not in ("localhost", "::1") and not h.startswith("127."):
            return url
        port = p.port
        if port:
            netloc = f"{tailnet_host}:{port}"
        else:
            netloc = tailnet_host
        rewritten = urlunparse(p._replace(netloc=netloc))
        if rewritten != url:
            logger.debug("[LocateAnything] rewrite fetch URL %s -> %s", url[:80], rewritten[:80])
        return rewritten
    except Exception:
        return url


def image_url_fetchable_by_locateanything(url: str) -> bool:
    """Whether LocateAnything (possibly on another tailnet host) can HTTP-fetch this image."""
    fetch_url = rewrite_image_url_for_locateanything_fetch(url)
    try:
        p = urlparse(fetch_url)
        scheme = (p.scheme or "").lower()
        if scheme not in ("http", "https"):
            return False
        h = (p.hostname or "").lower()
        if not h:
            return False
        if h in ("localhost", "::1") or h.endswith(".local") or h.startswith("127."):
            return False
        return True
    except Exception:
        return False


def _flatten_result_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(_flatten_result_text(v) for v in value)
    if isinstance(value, dict):
        preferred: list[str] = []
        for key in ("result", "text", "output", "response", "content"):
            if key in value:
                preferred.append(_flatten_result_text(value[key]))
        if preferred:
            return "\n".join(x for x in preferred if x)
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return ""
    return str(value)


def parse_locateanything_boxes(
    text: str,
    *,
    max_items: int = 6,
    role: str = "other",
    label: str = "garment",
) -> list[dict[str, Any]]:
    """Parse valid LocateAnything ``<box>`` spans into the local bbox shape."""
    cap = max(1, min(int(max_items), 8))
    out: list[dict[str, Any]] = []
    for match in _BOX_RE.finditer(text or ""):
        try:
            x0, y0, x1, y1 = [float(v) for v in match.groups()]
        except (TypeError, ValueError):
            continue
        if not (
            0 <= x0 <= 1000
            and 0 <= y0 <= 1000
            and 0 <= x1 <= 1000
            and 0 <= y1 <= 1000
            and x0 < x1
            and y0 < y1
        ):
            continue
        out.append(
            {
                "role": role or "other",
                "label": label or "garment",
                "bbox_2d": [round(x0), round(y0), round(x1), round(y1)],
            }
        )
        if len(out) >= cap:
            break
    return out


def _parse_locate_response(data: Any) -> str:
    if isinstance(data, dict):
        status = data.get("status")
        if isinstance(status, str) and status.lower() not in ("success", "ok"):
            raise LocateAnythingError(f"LocateAnything status={status!r}")
        return _flatten_result_text(data.get("result", data))
    return _flatten_result_text(data)


async def _post_locate(
    endpoint: str,
    payload: dict[str, Any],
) -> str:
    timeout = httpx.Timeout(_timeout_seconds())
    use_proxy = bool(
        os.getenv("ALL_PROXY") or os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
    )
    try:
        async with httpx.AsyncClient(timeout=timeout, trust_env=use_proxy) as client:
            resp = await client.post(endpoint, json=payload)
            resp.raise_for_status()
            return _parse_locate_response(resp.json())
    except LocateAnythingError:
        raise
    except httpx.TimeoutException as e:
        raise LocateAnythingError(
            f"LocateAnything timed out after {_timeout_seconds()}s"
        ) from e
    except httpx.HTTPStatusError as e:
        body = (e.response.text or "")[:240]
        raise LocateAnythingError(
            f"LocateAnything HTTP {e.response.status_code}: {body}"
        ) from e
    except Exception as e:
        raise LocateAnythingError(f"LocateAnything request failed: {e!r}") from e


async def locate_garment_boxes(
    *,
    image_url: str,
    prompt: str,
    image_bytes: bytes | None = None,
    max_items: int = 6,
    role: str = "other",
    label: str = "garment",
) -> list[dict[str, Any]]:
    if not locateanything_enabled():
        raise LocateAnythingError("LocateAnything disabled")

    base = f"{_base_url()}/"
    use_proxy = bool(
        os.getenv("ALL_PROXY") or os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
    )
    timeout = httpx.Timeout(_timeout_seconds())

    if image_bytes is not None:
        bytes_endpoint = urljoin(base, "v1/locate_bytes")
        bytes_payload = {
            "image_base64": base64.standard_b64encode(image_bytes).decode("ascii"),
            "prompt": prompt,
        }
        text: str | None = None
        try:
            async with httpx.AsyncClient(timeout=timeout, trust_env=use_proxy) as client:
                resp = await client.post(bytes_endpoint, json=bytes_payload)
                if resp.status_code == 404 and image_url_fetchable_by_locateanything(
                    image_url
                ):
                    logger.info(
                        "[LocateAnything] /v1/locate_bytes missing; retry image_url %s",
                        image_url[:80],
                    )
                elif resp.is_success:
                    text = _parse_locate_response(resp.json())
                else:
                    resp.raise_for_status()
        except LocateAnythingError:
            raise
        except httpx.TimeoutException as e:
            raise LocateAnythingError(
                f"LocateAnything timed out after {_timeout_seconds()}s"
            ) from e
        except httpx.HTTPStatusError as e:
            body = (e.response.text or "")[:240]
            raise LocateAnythingError(
                f"LocateAnything HTTP {e.response.status_code}: {body}"
            ) from e
        except Exception as e:
            raise LocateAnythingError(f"LocateAnything request failed: {e!r}") from e

        if text is None:
            fetch_url = rewrite_image_url_for_locateanything_fetch(image_url)
            text = await _post_locate(
                urljoin(base, "v1/locate"),
                {"image_url": fetch_url, "prompt": prompt},
            )
        else:
            logger.debug(
                "[LocateAnything] locate_bytes ok source=%s", image_url[:80]
            )
    else:
        fetch_url = rewrite_image_url_for_locateanything_fetch(image_url)
        text = await _post_locate(
            urljoin(base, "v1/locate"),
            {"image_url": fetch_url, "prompt": prompt},
        )

    boxes = parse_locateanything_boxes(
        text,
        max_items=max_items,
        role=role,
        label=label,
    )
    if not boxes:
        logger.debug("[LocateAnything] raw output without valid boxes: %s", text[:400])
        raise LocateAnythingError("LocateAnything returned no valid boxes")
    return boxes
