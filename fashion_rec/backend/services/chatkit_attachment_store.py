"""AttachmentStore for ChatKit: clears file bytes on delete (metadata via MemoryStore)."""

from __future__ import annotations

from chatkit.store import AttachmentStore

from services.chatkit_memory_store import MemoryStore


class MemoryAttachmentStore(AttachmentStore[dict]):
    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    async def delete_attachment(self, attachment_id: str, context: dict) -> None:
        self._store.drop_attachment_blob(attachment_id)
