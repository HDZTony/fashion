"""
Guest quota by IP: try-on 3/day, outfit 100/day.
In-memory store keyed by (date, ip, action). For multi-instance or persistence use Redis/DB.
"""
import logging
from datetime import date
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

TRY_LIMIT = 3
OUTFIT_LIMIT = 100

# (date_str, ip, "tryon" | "outfit") -> count
_quota: dict[Tuple[str, str, str], int] = {}


def _date_str() -> str:
    return date.today().isoformat()


def _get_client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def get_client_ip(request) -> str:
    return _get_client_ip(request)


def check_and_consume_tryon(request) -> Tuple[bool, int, int]:
    """
    Check and consume one try-on for guest IP. Returns (allowed, remaining, limit).
    If not allowed, remaining is 0.
    """
    ip = _get_client_ip(request)
    key = (_date_str(), ip, "tryon")
    count = _quota.get(key, 0)
    if count >= TRY_LIMIT:
        return (False, 0, TRY_LIMIT)
    _quota[key] = count + 1
    return (True, TRY_LIMIT - count - 1, TRY_LIMIT)


def check_and_consume_outfit(request) -> Tuple[bool, int, int]:
    """
    Check and consume one outfit for guest IP. Returns (allowed, remaining, limit).
    If not allowed, remaining is 0.
    """
    ip = _get_client_ip(request)
    key = (_date_str(), ip, "outfit")
    count = _quota.get(key, 0)
    if count >= OUTFIT_LIMIT:
        return (False, 0, OUTFIT_LIMIT)
    _quota[key] = count + 1
    return (True, OUTFIT_LIMIT - count - 1, OUTFIT_LIMIT)


def get_guest_quota(request) -> dict:
    """Return remaining and limit for try and outfit for this IP (without consuming)."""
    ip = _get_client_ip(request)
    d = _date_str()
    try_key = (d, ip, "tryon")
    outfit_key = (d, ip, "outfit")
    try_count = _quota.get(try_key, 0)
    outfit_count = _quota.get(outfit_key, 0)
    return {
        "try_remaining": max(0, TRY_LIMIT - try_count),
        "try_limit": TRY_LIMIT,
        "outfit_remaining": max(0, OUTFIT_LIMIT - outfit_count),
        "outfit_limit": OUTFIT_LIMIT,
    }
