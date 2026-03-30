"""
Convert ChatKit thread items (incl. image attachments) to Agents SDK input.

Default `simple_to_agent_input` uses ThreadItemConverter with attachment_to_message_content
unimplemented — enabling uploads triggers NotImplementedError.

Image bytes are sent as data URLs so OpenAI vision works in dev (localhost preview URLs are not fetchable by OpenAI).
"""

from __future__ import annotations

import base64

from chatkit.agents import ThreadItemConverter
from chatkit.types import Attachment, FileAttachment, ImageAttachment
from openai.types.responses import ResponseInputContentParam, ResponseInputImageParam, ResponseInputTextParam

from services.chatkit_memory_store import MemoryStore


class FashionThreadItemConverter(ThreadItemConverter):
    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    async def attachment_to_message_content(self, attachment: Attachment) -> ResponseInputContentParam:
        if isinstance(attachment, ImageAttachment):
            blob = self._store.get_attachment_blob(attachment.id)
            if blob:
                b64 = base64.b64encode(blob).decode("ascii")
                data_url = f"data:{attachment.mime_type};base64,{b64}"
                return ResponseInputImageParam(
                    type="input_image",
                    detail="auto",
                    image_url=data_url,
                )
            return ResponseInputImageParam(
                type="input_image",
                detail="auto",
                image_url=str(attachment.preview_url),
            )
        if isinstance(attachment, FileAttachment):
            return ResponseInputTextParam(
                type="input_text",
                text=f"(Attached file: {attachment.name}, type={attachment.mime_type})",
            )
        raise TypeError(f"Unsupported attachment type: {type(attachment)}")
