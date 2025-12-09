import json
from pathlib import Path
from typing import Any, Dict, List
import uuid
from datetime import datetime


FAVORITES_FILE = Path("favorites.json")


def _load_all() -> List[Dict[str, Any]]:
    if not FAVORITES_FILE.exists():
        return []
    try:
        return json.loads(FAVORITES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_all(data: List[Dict[str, Any]]) -> None:
    FAVORITES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def save_favorite(user_id: str, favorite: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persist a single favorite try-on result for a user.
    """
    all_favorites = _load_all()
    favorite_id = str(uuid.uuid4())
    record = {
        "id": favorite_id,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        **favorite,
    }
    all_favorites.append(record)
    _save_all(all_favorites)
    return record


def list_favorites(user_id: str) -> List[Dict[str, Any]]:
    """
    List saved favorites for a user.
    """
    all_favorites = _load_all()
    return [f for f in all_favorites if f.get("user_id") == user_id]


def delete_favorite(user_id: str, favorite_id: str) -> bool:
    """
    Delete a favorite by ID.
    Returns True if deleted, False if not found.
    """
    all_favorites = _load_all()
    original_count = len(all_favorites)
    all_favorites = [
        f for f in all_favorites
        if not (f.get("id") == favorite_id and f.get("user_id") == user_id)
    ]
    if len(all_favorites) < original_count:
        _save_all(all_favorites)
        return True
    return False

