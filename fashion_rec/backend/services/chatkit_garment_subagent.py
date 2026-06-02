"""
Conceptual **sub-agent** for garment piece extraction: LocateAnything-3B bounding boxes
(Qwen3-VL fallback) + PIL crop + R2 upload.

The main stylist (`FashionStylist`) should call tools in order:
1. `assess_garment_try_on_sources` — Grok vision, per-image `needs_piece_extraction`
2. `extract_isolated_garment_pieces_for_try_on` — this pipeline (same tool the sub-agent would own)
3. `generate_virtual_try_on` with `prepared_garment_urls_json` = JSON array from step 2's `garment_urls`

`garment_piece_extractor_agent` is available if you later wire an Agents SDK **handoff**; it is not
registered on the ChatKit server by default.
"""

from __future__ import annotations

from typing import Any

from agents import Agent
from chatkit.agents import AgentContext

from services.chatkit_orchestration import OPENAI_ORCHESTRATION_MODEL
from services.chatkit_tools import extract_isolated_garment_pieces_for_try_on

GARMENT_PIECE_EXTRACTOR_INSTRUCTIONS = """
You are the garment **piece extraction** sub-agent. You receive source image URLs and a boolean mask
(from the main stylist, after Grok assessment). Call `extract_isolated_garment_pieces_for_try_on` once with:
- source_urls_json: JSON array of URLs
- extraction_mask_json: JSON array of booleans (same length)
- user_intent_summary: short English hint for the bbox crop model

Return the tool output JSON to the main agent; do not chat with the end user.
""".strip()

garment_piece_extractor_agent = Agent[AgentContext[dict[str, Any]]](
    model=OPENAI_ORCHESTRATION_MODEL,
    name="GarmentPieceExtractor",
    instructions=GARMENT_PIECE_EXTRACTOR_INSTRUCTIONS,
    tools=[extract_isolated_garment_pieces_for_try_on],
)
