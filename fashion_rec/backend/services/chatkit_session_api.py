"""Helpers for GET /chatkit/sessions and thread items (auth + ownership)."""

from __future__ import annotations

from chatkit.store import Store
from chatkit.types import (
    HiddenContextItem,
    SDKHiddenContextItem,
    ThreadItem,
    ThreadMetadata,
    UserMessageItem,
    UserMessageTextContent,
)


def thread_owned_by_user(
    meta: ThreadMetadata,
    user_id: str,
    model_id: str | None = None,
) -> bool:
    if str(meta.metadata.get("user_id", "")) != str(user_id):
        return False
    scoped = str(model_id).strip() if model_id is not None else ""
    current = str(meta.metadata.get("model_id", "")).strip()
    if not scoped:
        return current == ""
    return (current == "") or (current == scoped)


async def first_user_message_preview(
    store: Store[dict],
    thread_id: str,
    *,
    context: dict,
) -> str | None:
    page = await store.load_thread_items(thread_id, None, 80, "asc", context)
    for item in page.data:
        if not isinstance(item, UserMessageItem):
            continue
        for part in item.content:
            if isinstance(part, UserMessageTextContent) and part.text.strip():
                text = part.text.strip().replace("\n", " ")
                return text[:72] + ("…" if len(text) > 72 else "")
    return None


def filter_visible_items(items: list[ThreadItem]) -> list[ThreadItem]:
    return [
        i
        for i in items
        if not isinstance(i, (HiddenContextItem, SDKHiddenContextItem))
    ]


