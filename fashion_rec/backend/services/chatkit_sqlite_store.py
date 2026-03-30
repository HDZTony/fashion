"""
SQLite-backed ChatKit Store — survives process restarts (threads + items + attachment blobs).
"""

from __future__ import annotations

import asyncio
import os
import sqlite3
from collections.abc import Callable
from typing import Any, TypeVar

from pydantic import TypeAdapter

from chatkit.store import NotFoundError, Store
from chatkit.types import Attachment, Page, ThreadItem, ThreadMetadata

from services.chatkit_memory_store import filter_threads_for_context

T = TypeVar("T")

_thread_item_adapter: TypeAdapter[ThreadItem] = TypeAdapter(ThreadItem)
_attachment_adapter: TypeAdapter[Attachment] = TypeAdapter(Attachment)


class SqliteChatKitStore(Store[dict]):
    def __init__(self, path: str) -> None:
        self._path = path
        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS chatkit_threads (
                  id TEXT PRIMARY KEY,
                  json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS chatkit_items (
                  thread_id TEXT NOT NULL,
                  id TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  json TEXT NOT NULL,
                  PRIMARY KEY (thread_id, id)
                );
                CREATE INDEX IF NOT EXISTS idx_items_thread_created
                  ON chatkit_items(thread_id, created_at);
                CREATE TABLE IF NOT EXISTS chatkit_attachments (
                  id TEXT PRIMARY KEY,
                  json TEXT NOT NULL,
                  blob BLOB
                );
                """
            )
            conn.commit()

    async def _run(self, fn: Callable[..., T], *args: Any) -> T:
        return await asyncio.get_event_loop().run_in_executor(None, lambda: fn(*args))

    # --- sync implementations ---

    def _save_thread_sync(self, thread: ThreadMetadata) -> None:
        payload = thread.model_dump_json()
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO chatkit_threads (id, json) VALUES (?, ?)",
                (thread.id, payload),
            )
            conn.commit()

    def _load_thread_sync(self, thread_id: str) -> ThreadMetadata:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT json FROM chatkit_threads WHERE id = ?",
                (thread_id,),
            ).fetchone()
        if row is None:
            raise NotFoundError(f"Thread {thread_id} not found")
        return ThreadMetadata.model_validate_json(row["json"])

    def _all_threads_sync(self) -> list[ThreadMetadata]:
        with self._connect() as conn:
            rows = conn.execute("SELECT json FROM chatkit_threads").fetchall()
        return [ThreadMetadata.model_validate_json(r["json"]) for r in rows]

    def _paginate(
        self,
        rows: list,
        after: str | None,
        limit: int,
        order: str,
        sort_key: Callable,
        cursor_key: Callable,
    ) -> Page:
        sorted_rows = sorted(rows, key=sort_key, reverse=order == "desc")
        start = 0
        if after:
            for idx, row in enumerate(sorted_rows):
                if cursor_key(row) == after:
                    start = idx + 1
                    break
        data = sorted_rows[start : start + limit]
        has_more = start + limit < len(sorted_rows)
        next_after = cursor_key(data[-1]) if has_more and data else None
        return Page(data=data, has_more=has_more, after=next_after)

    async def load_thread(self, thread_id: str, context: dict) -> ThreadMetadata:
        return await self._run(self._load_thread_sync, thread_id)

    async def save_thread(self, thread: ThreadMetadata, context: dict) -> None:
        await self._run(self._save_thread_sync, thread)

    async def load_threads(
        self, limit: int, after: str | None, order: str, context: dict
    ) -> Page[ThreadMetadata]:
        def work() -> Page[ThreadMetadata]:
            threads = filter_threads_for_context(self._all_threads_sync(), context)
            return self._paginate(
                threads,
                after,
                limit,
                order,
                sort_key=lambda t: t.created_at,
                cursor_key=lambda t: t.id,
            )

        return await self._run(work)

    def _items_for_thread_sync(self, thread_id: str) -> list[ThreadItem]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT json FROM chatkit_items WHERE thread_id = ? ORDER BY created_at ASC",
                (thread_id,),
            ).fetchall()
        out: list[ThreadItem] = []
        for r in rows:
            out.append(_thread_item_adapter.validate_json(r["json"]))
        return out

    async def load_thread_items(
        self, thread_id: str, after: str | None, limit: int, order: str, context: dict
    ) -> Page[ThreadItem]:
        def work() -> Page[ThreadItem]:
            items = self._items_for_thread_sync(thread_id)
            return self._paginate(
                items,
                after,
                limit,
                order,
                sort_key=lambda i: i.created_at,
                cursor_key=lambda i: i.id,
            )

        return await self._run(work)

    def _add_thread_item_sync(self, thread_id: str, item: ThreadItem) -> None:
        payload = item.model_dump_json()
        created = item.created_at.isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO chatkit_items (thread_id, id, created_at, json)
                VALUES (?, ?, ?, ?)
                """,
                (thread_id, item.id, created, payload),
            )
            conn.commit()

    async def add_thread_item(self, thread_id: str, item: ThreadItem, context: dict) -> None:
        await self._run(self._add_thread_item_sync, thread_id, item)

    def _save_item_sync(self, thread_id: str, item: ThreadItem) -> None:
        payload = item.model_dump_json()
        created = item.created_at.isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO chatkit_items (thread_id, id, created_at, json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(thread_id, id) DO UPDATE SET
                  created_at = excluded.created_at,
                  json = excluded.json
                """,
                (thread_id, item.id, created, payload),
            )
            conn.commit()

    async def save_item(self, thread_id: str, item: ThreadItem, context: dict) -> None:
        await self._run(self._save_item_sync, thread_id, item)

    def _load_item_sync(self, thread_id: str, item_id: str) -> ThreadItem:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT json FROM chatkit_items
                WHERE thread_id = ? AND id = ?
                """,
                (thread_id, item_id),
            ).fetchone()
        if row is None:
            raise NotFoundError(f"Item {item_id} not found in thread {thread_id}")
        return _thread_item_adapter.validate_json(row["json"])

    async def load_item(self, thread_id: str, item_id: str, context: dict) -> ThreadItem:
        return await self._run(self._load_item_sync, thread_id, item_id)

    def _delete_thread_sync(self, thread_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM chatkit_items WHERE thread_id = ?", (thread_id,))
            conn.execute("DELETE FROM chatkit_threads WHERE id = ?", (thread_id,))
            conn.commit()

    async def delete_thread(self, thread_id: str, context: dict) -> None:
        await self._run(self._delete_thread_sync, thread_id)

    def _delete_thread_item_sync(self, thread_id: str, item_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM chatkit_items WHERE thread_id = ? AND id = ?",
                (thread_id, item_id),
            )
            conn.commit()

    async def delete_thread_item(self, thread_id: str, item_id: str, context: dict) -> None:
        await self._run(self._delete_thread_item_sync, thread_id, item_id)

    def _save_attachment_sync(self, attachment: Attachment) -> None:
        payload = attachment.model_dump_json()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT blob FROM chatkit_attachments WHERE id = ?",
                (attachment.id,),
            ).fetchone()
            blob = row["blob"] if row else None
            conn.execute(
                """
                INSERT OR REPLACE INTO chatkit_attachments (id, json, blob)
                VALUES (?, ?, ?)
                """,
                (attachment.id, payload, blob),
            )
            conn.commit()

    async def save_attachment(self, attachment: Attachment, context: dict) -> None:
        await self._run(self._save_attachment_sync, attachment)

    def _load_attachment_sync(self, attachment_id: str) -> Attachment:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT json FROM chatkit_attachments WHERE id = ?",
                (attachment_id,),
            ).fetchone()
        if row is None:
            raise NotFoundError(f"Attachment {attachment_id} not found")
        return _attachment_adapter.validate_json(row["json"])

    async def load_attachment(self, attachment_id: str, context: dict) -> Attachment:
        return await self._run(self._load_attachment_sync, attachment_id)

    def _delete_attachment_sync(self, attachment_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM chatkit_attachments WHERE id = ?", (attachment_id,))
            conn.commit()

    async def delete_attachment(self, attachment_id: str, context: dict) -> None:
        await self._run(self._delete_attachment_sync, attachment_id)

    def put_attachment_blob(self, attachment_id: str, data: bytes) -> None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT json FROM chatkit_attachments WHERE id = ?",
                (attachment_id,),
            ).fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO chatkit_attachments (id, json, blob) VALUES (?, ?, ?)",
                    (attachment_id, "{}", data),
                )
            else:
                conn.execute(
                    "UPDATE chatkit_attachments SET blob = ? WHERE id = ?",
                    (data, attachment_id),
                )
            conn.commit()

    def get_attachment_blob(self, attachment_id: str) -> bytes | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT blob FROM chatkit_attachments WHERE id = ?",
                (attachment_id,),
            ).fetchone()
        if row is None or row["blob"] is None:
            return None
        return row["blob"]

    def drop_attachment_blob(self, attachment_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE chatkit_attachments SET blob = NULL WHERE id = ?",
                (attachment_id,),
            )
            conn.commit()
