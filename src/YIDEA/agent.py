"""Agent assembly for DeepAgent."""

from __future__ import annotations

from typing import Sequence

from deepagents import create_deep_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import Runnable
from langchain_core.tools import BaseTool


SYSTEM_PROMPT = """\
You are DeepAgent, a specialist in virtual outfit composition.

Primary goal:
- Use the `flux_outfit_generator` tool to blend a garment image onto a model photo.

Tool usage rules:
- Always call `flux_outfit_generator` exactly once per user request.
- Pass the absolute paths for `model_image_path` and `garment_image_path` exactly as provided.
- Only include the optional `prompt` or `output_filename` arguments when the user supplies them.

Reporting:
- After tool execution succeeds, return the saved file path and a concise description of the outfit.
- If the tool fails or inputs are invalid, surface the error clearly without fabricating results.
"""


def build_deepagent(
    llm: BaseChatModel,
    tools: Sequence[BaseTool],
) -> Runnable:
    """Create the DeepAgent executor with planning and filesystem middleware."""
    return create_deep_agent(
        model=llm,
        tools=list(tools),
        system_prompt=SYSTEM_PROMPT,
    )

