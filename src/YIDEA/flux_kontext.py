"""
Lightweight client for FLUX.1 Kontext (image editing) API.

This module provides a simple programmatic interface and CLI that:
1. Encodes a single input image as base64.
2. Submits the image alongside an editing prompt to the FLUX Kontext endpoint.
3. Polls until the edited image is ready.
4. Downloads the edited image to disk and returns the path.

Usage (CLI):
    uv run python -m deepagent.flux_kontext \
        --image path/to/input.jpg \
        --prompt "replace 'joy' with 'BFL'" \
        --output path/to/output.png

Make sure the `BFL_API_KEY` environment variable is set to your Kontext API key
before running the CLI or using the client programmatically.
"""

from __future__ import annotations

import argparse
import base64
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv


DEFAULT_ENDPOINT = "https://api.bfl.ai/v1/flux-kontext-pro"
DEFAULT_ENV_PREFIX = "FLUX_KONTEXT_"


class FluxKontextError(RuntimeError):
    """Raised when the FLUX Kontext API invocation fails."""


def _read_image_as_base64(image_path: Path) -> str:
    """Read the image from disk and return a base64-encoded string."""
    try:
        image_bytes = image_path.read_bytes()
    except FileNotFoundError as exc:
        raise FluxKontextError(f"Image file not found: {image_path}") from exc
    except OSError as exc:
        raise FluxKontextError(f"Failed to read image file: {image_path}") from exc

    return base64.b64encode(image_bytes).decode("utf-8")


def _prepare_payload(
    prompt: str,
    image_b64: str,
    aspect_ratio: Optional[str] = None,
    seed: Optional[int] = None,
    prompt_upsampling: Optional[bool] = None,
    safety_tolerance: Optional[int] = None,
    output_format: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the JSON payload accepted by the Kontext API."""
    payload: Dict[str, Any] = {
        "prompt": prompt,
        "input_image": image_b64,
    }

    if aspect_ratio:
        payload["aspect_ratio"] = aspect_ratio
    if seed is not None:
        payload["seed"] = seed
    if prompt_upsampling is not None:
        payload["prompt_upsampling"] = prompt_upsampling
    if safety_tolerance is not None:
        payload["safety_tolerance"] = safety_tolerance
    if output_format:
        payload["output_format"] = output_format

    return payload


@dataclass
class FluxKontextClient:
    """Minimal client wrapper around the FLUX Kontext API."""

    api_key: str
    endpoint: str = DEFAULT_ENDPOINT
    timeout_seconds: float = 120.0
    poll_interval: float = 0.5

    def submit_edit(
        self,
        image_path: Path,
        prompt: str,
        *,
        aspect_ratio: Optional[str] = None,
        seed: Optional[int] = None,
        prompt_upsampling: Optional[bool] = None,
        safety_tolerance: Optional[int] = None,
        output_format: Optional[str] = None,
        output_path: Optional[Path] = None,
        debug: bool = False,
    ) -> Path:
        """
        Submit an editing request and return the path to the edited image.

        Args:
            image_path: Path to the input image that should be edited.
            prompt: Text instructions describing the desired edit.
            aspect_ratio: Optional aspect ratio override (e.g. "16:9").
            seed: Optional seed for reproducibility.
            prompt_upsampling: Whether to enable prompt upsampling.
            safety_tolerance: Moderation strictness (0-6, higher is more permissive).
            output_format: Desired image format ("jpeg" or "png").
            output_path: Optional explicit path where the edited image should be saved.

        Returns:
            Path to the saved edited image on disk.
        """
        image_b64 = _read_image_as_base64(image_path.resolve())
        payload = _prepare_payload(
            prompt=prompt,
            image_b64=image_b64,
            aspect_ratio=aspect_ratio,
            seed=seed,
            prompt_upsampling=prompt_upsampling,
            safety_tolerance=safety_tolerance,
            output_format=output_format,
        )

        headers = {
            "accept": "application/json",
            "x-key": self.api_key,
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self.timeout_seconds) as client:
            try:
                response = client.post(self.endpoint, headers=headers, json=payload)
            except httpx.HTTPError as exc:
                raise FluxKontextError(f"Failed to reach FLUX Kontext API: {exc}") from exc

            if response.status_code >= 400:
                raise FluxKontextError(
                    f"FLUX Kontext API responded with {response.status_code}: {response.text}"
                )

            try:
                request_info = response.json()
            except ValueError as exc:
                raise FluxKontextError("FLUX Kontext API returned invalid JSON.") from exc

            request_id = request_info.get("id")
            polling_url = request_info.get("polling_url")

            if not request_id or not polling_url:
                raise FluxKontextError(
                    "FLUX Kontext API response missing 'id' or 'polling_url'."
                )

            # Poll until the job is ready.
            while True:
                time.sleep(self.poll_interval)
                try:
                    poll_response = client.get(
                        polling_url,
                        headers=headers,
                        params={"id": request_id},
                    )
                except httpx.HTTPError as exc:
                    raise FluxKontextError(f"Polling request failed: {exc}") from exc

                if poll_response.status_code >= 400:
                    raise FluxKontextError(
                        f"Polling failed with {poll_response.status_code}: {poll_response.text}"
                    )

                try:
                    poll_data = poll_response.json()
                except ValueError as exc:
                    raise FluxKontextError("Polling response was not valid JSON.") from exc

                status = poll_data.get("status")
                if debug:
                    print(f"[FluxKontext] Polling status: {status}")
                if status in {"Error", "Failed"}:
                    raise FluxKontextError(f"Image generation failed: {poll_data}")
                if status != "Ready":
                    continue

                result = poll_data.get("result") or {}
                sample_url = result.get("sample")
                if not sample_url:
                    raise FluxKontextError("Ready response missing result sample URL.")
                if debug:
                    metadata = {k: v for k, v in result.items() if k != "sample"}
                    if metadata:
                        print(f"[FluxKontext] Result metadata: {metadata}")

                try:
                    download_response = client.get(sample_url)
                except httpx.HTTPError as exc:
                    raise FluxKontextError(f"Failed to download edited image: {exc}") from exc

                if download_response.status_code >= 400:
                    raise FluxKontextError(
                        f"Downloading edited image failed with "
                        f"{download_response.status_code}: {download_response.text}"
                    )

                image_bytes = download_response.content

                if output_path is None:
                    suffix = (
                        Path(sample_url).suffix
                        if Path(sample_url).suffix
                        else (".png" if output_format == "png" else ".jpg")
                    )
                    output_path = image_path.with_name(
                        f"{image_path.stem}-edited{suffix}"
                    )

                try:
                    output_path.write_bytes(image_bytes)
                except OSError as exc:
                    raise FluxKontextError(
                        f"Failed to write edited image to {output_path}"
                    ) from exc

                return output_path.resolve()


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Edit a single image using FLUX.1 Kontext."
    )
    parser.add_argument("--image", required=True, help="Path to the input image.")
    parser.add_argument("--prompt", required=True, help="Text instructions for the edit.")
    parser.add_argument(
        "--output",
        help="Optional output path for the edited image. Defaults to '<stem>-edited.<ext>'.",
    )
    parser.add_argument("--aspect-ratio", help="Optional aspect ratio override, e.g. 16:9.")
    parser.add_argument("--seed", type=int, help="Optional seed for reproducibility.")
    parser.add_argument(
        "--prompt-upsampling",
        action="store_true",
        help="Enable prompt upsampling (disabled by default).",
    )
    parser.add_argument(
        "--safety-tolerance",
        type=int,
        choices=range(0, 7),
        help="Moderation strictness (0-6). Higher is more permissive.",
    )
    parser.add_argument(
        "--output-format",
        choices={"jpeg", "png"},
        help="Desired output image format.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print intermediate polling status and metadata for troubleshooting.",
    )
    return parser.parse_args(argv)


def _load_env_config() -> dict[str, Any]:
    """Read optional overrides from environment variables."""
    config: dict[str, Any] = {}
    api_key = os.getenv(f"{DEFAULT_ENV_PREFIX}API_KEY")
    if api_key:
        config["api_key"] = api_key

    endpoint = os.getenv(f"{DEFAULT_ENV_PREFIX}ENDPOINT")
    if endpoint:
        config["endpoint"] = endpoint

    timeout = os.getenv(f"{DEFAULT_ENV_PREFIX}TIMEOUT_SECONDS")
    if timeout:
        try:
            config["timeout_seconds"] = float(timeout)
        except ValueError as exc:
            raise FluxKontextError(
                f"Invalid {DEFAULT_ENV_PREFIX}TIMEOUT_SECONDS value: {timeout}"
            ) from exc

    poll_interval = os.getenv(f"{DEFAULT_ENV_PREFIX}POLL_INTERVAL")
    if poll_interval:
        try:
            config["poll_interval"] = float(poll_interval)
        except ValueError as exc:
            raise FluxKontextError(
                f"Invalid {DEFAULT_ENV_PREFIX}POLL_INTERVAL value: {poll_interval}"
            ) from exc

    return config


def main(argv: Optional[list[str]] = None) -> int:
    load_dotenv()
    args = _parse_args(argv)

    env_config = _load_env_config()
    api_key = env_config.get("api_key")
    if not api_key:
        raise FluxKontextError(
            f"Environment variable {DEFAULT_ENV_PREFIX}API_KEY must be set."
        )

    client = FluxKontextClient(**env_config)

    image_path = Path(args.image).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve() if args.output else None

    edited_path = client.submit_edit(
        image_path=image_path,
        prompt=args.prompt,
        aspect_ratio=args.aspect_ratio,
        seed=args.seed,
        prompt_upsampling=args.prompt_upsampling or None,
        safety_tolerance=args.safety_tolerance,
        output_format=args.output_format,
        output_path=output_path,
        debug=args.debug,
    )

    print(f"Edited image saved to: {edited_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


