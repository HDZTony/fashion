"""Select ChatKit Store backend: SQLite (default) or in-memory."""

from __future__ import annotations

import os

from chatkit.store import Store


def create_chatkit_store() -> Store[dict]:
    """
    CHATKIT_STORE=memory — process-local dict (lost on restart).
    Otherwise — SQLite at CHATKIT_SQLITE_PATH (default data/chatkit_store.db).
    """
    mode = (os.getenv("CHATKIT_STORE") or "sqlite").strip().lower()
    if mode == "memory":
        from services.chatkit_memory_store import MemoryStore

        return MemoryStore()

    path = (os.getenv("CHATKIT_SQLITE_PATH") or "data/chatkit_store.db").strip()
    from services.chatkit_sqlite_store import SqliteChatKitStore

    return SqliteChatKitStore(path)
