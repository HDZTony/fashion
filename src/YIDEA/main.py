"""CLI entrypoint for running the DeepAgent pipeline."""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

from .agent import build_deepagent
from .config import Settings
from .llm import build_deepseek_llm
from .tools import FluxToolError, build_flux_outfit_tool


def _build_instruction(
    model_image_path: Path,
    garment_image_path: Path,
    prompt: str | None,
    output_filename: str | None,
) -> str:
    """Craft the initial instruction sent to the agent."""
    lines = [
        "Compose the provided garment onto the model photo.",
        f"Model image absolute path: {model_image_path}",
        f"Garment image absolute path: {garment_image_path}",
        "Call the tool exactly once using these paths.",
    ]

    if prompt:
        lines.append(f"Styling guidance: {prompt}")
    if output_filename:
        lines.append(f"Desired output filename: {output_filename}")

    lines.append("Return the output path and a concise summary once done.")
    return "\n".join(lines)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="DeepAgent virtual outfit generator.")
    parser.add_argument(
        "--model-image",
        required=True,
        help="Path to the model photograph (PNG/JPEG/WebP).",
    )
    parser.add_argument(
        "--garment-image",
        required=True,
        help="Path to the garment photograph (PNG/JPEG/WebP).",
    )
    parser.add_argument(
        "--prompt",
        help="Optional text prompt to guide how the garment should be applied.",
    )
    parser.add_argument(
        "--output-filename",
        help="Optional filename (with extension) for the generated image.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point to run the agent from the command line."""
    args = parse_args(argv)

    model_image_path = Path(args.model_image).expanduser().resolve()
    garment_image_path = Path(args.garment_image).expanduser().resolve()

    settings = Settings()
    llm = build_deepseek_llm(settings)
    flux_tool = build_flux_outfit_tool(settings)
    agent = build_deepagent(llm, [flux_tool])

    instruction = _build_instruction(
        model_image_path=model_image_path,
        garment_image_path=garment_image_path,
        prompt=args.prompt,
        output_filename=args.output_filename,
    )

    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    try:
        result = agent.invoke(
            {"messages": [{"role": "user", "content": instruction}]},
            config=config,
        )
    except FluxToolError as exc:
        print(f"[DeepAgent] FLUX tool failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # pragma: no cover - surface unexpected issues
        print(f"[DeepAgent] Agent execution failed: {exc}", file=sys.stderr)
        return 1

    messages = result.get("messages", [])
    if not messages:
        print("[DeepAgent] Agent did not return any messages.", file=sys.stderr)
        return 1

    final_message = messages[-1]
    content = getattr(final_message, "content", None)
    if isinstance(content, list):
        content = "".join(
            fragment.get("text", "") if isinstance(fragment, dict) else str(fragment)
            for fragment in content
        )

    if not content:
        content = str(final_message)

    print(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

