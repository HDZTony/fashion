import json
from pathlib import Path
from typing import Any, Dict, List
import uuid
from datetime import datetime


LOOKS_FILE = Path("looks.json")


def _load_all() -> List[Dict[str, Any]]:
    if not LOOKS_FILE.exists():
        return []
    try:
        return json.loads(LOOKS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_all(data: List[Dict[str, Any]]) -> None:
    LOOKS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def save_look(user_id: str, look: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persist a single outfit look for a user.
    """
    all_looks = _load_all()
    look_id = str(uuid.uuid4())
    record = {
        "id": look_id,
        "user_id": user_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        **look,
    }
    all_looks.append(record)
    _save_all(all_looks)
    return record


def list_looks(user_id: str) -> List[Dict[str, Any]]:
    """
    List saved looks for a user.
    """
    all_looks = _load_all()
    return [l for l in all_looks if l.get("user_id") == user_id]



