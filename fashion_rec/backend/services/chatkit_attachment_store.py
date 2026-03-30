"""AttachmentStore for ChatKit: clears file bytes on delete (metadata via MemoryStore)."""

from __future__ import annotations

from chatkit.store import AttachmentStore

from typing import Any


class MemoryAttachmentStore(AttachmentStore[dict]):
    """Works with MemoryStore or SqliteChatKitStore (put/get/drop attachment blob)."""

    def __init__(self, store: Any) -> None:
        self._store = store

    async def delete_attachment(self, attachment_id: str, context: dict) -> None:
        self._store.drop_attachment_blob(attachment_id)
