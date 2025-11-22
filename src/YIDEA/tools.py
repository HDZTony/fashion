"""Tooling for the DeepAgent pipeline."""

from __future__ import annotations

import base64
import binascii
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from langchain_core.tools import tool
from pydantic import BaseModel, Field, ValidationError

from .config import Settings


class FluxOutfitInput(BaseModel):
    """Input schema for the FLUX outfitting tool."""

    model_image_path: str = Field(..., description="Path to the model photo.")
    garment_image_path: str = Field(..., description="Path to the garment photo.")
    prompt: Optional[str] = Field(
        None,
        description="Optional textual steering instructions for the FLUX model.",
    )
    output_filename: Optional[str] = Field(
        None,
        description="Optional filename (with extension) for the generated image.",
    )


class FluxToolError(RuntimeError):
    """Raised when the FLUX API call fails."""


def _encode_image(path: Path) -> str:
    """Read an image file and return a base64 encoded string."""
    try:
        data = path.read_bytes()
    except FileNotFoundError as exc:
        raise FluxToolError(f"Image file not found: {path}") from exc
    except OSError as exc:
        raise FluxToolError(f"Failed to read image file: {path}") from exc

    return base64.b64encode(data).decode("utf-8")


def _normalise_output_filename(output_filename: Optional[str]) -> str:
    """Ensure we always return an image extension (defaulting to PNG)."""
    if not output_filename:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        return f"outfit-{timestamp}.png"

    filename = output_filename.strip()
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        return f"outfit-{timestamp}.png"

    suffix = Path(filename).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
        return f"{filename}.png"
    return filename


def build_flux_outfit_tool(settings: Settings):
    """Create a LangChain tool that calls the FLUX outfitting API."""

    @tool(
        name="flux_outfit_generator",
        args_schema=FluxOutfitInput,
        return_direct=False,
    )
    def _call_flux(
        model_image_path: str,
        garment_image_path: str,
        prompt: Optional[str] = None,
        output_filename: Optional[str] = None,
    ) -> str:
        """Blend a garment image onto a model image and return the saved file path."""
        try:
            payload = FluxOutfitInput(
                model_image_path=model_image_path,
                garment_image_path=garment_image_path,
                prompt=prompt,
                output_filename=output_filename,
            )
        except ValidationError as exc:
            raise FluxToolError(str(exc)) from exc

        model_path = Path(payload.model_image_path).expanduser().resolve()
        garment_path = Path(payload.garment_image_path).expanduser().resolve()

        output_dir = settings.ensure_output_dir()
        output_name = _normalise_output_filename(payload.output_filename)
        output_path = output_dir / output_name

        request_body = {
            "model_image_base64": _encode_image(model_path),
            "garment_image_base64": _encode_image(garment_path),
        }
        if payload.prompt:
            request_body["prompt"] = payload.prompt

        headers = {
            "Authorization": f"Bearer {settings.flux_api_key.get_secret_value()}",
            "Content-Type": "application/json",
        }

        try:
            response = httpx.post(
                str(settings.flux_api_url),
                headers=headers,
                json=request_body,
                timeout=settings.flux_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise FluxToolError(f"Failed to contact FLUX API: {exc}") from exc

        if response.status_code >= 400:
            raise FluxToolError(
                f"FLUX API responded with {response.status_code}: {response.text}"
            )

        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise FluxToolError("FLUX API returned non-JSON response.") from exc

        image_base64: Optional[str] = None
        if isinstance(data, dict):
            image_base64 = data.get("image")
            if image_base64 is None:
                maybe_data = data.get("data")
                if isinstance(maybe_data, dict):
                    image_base64 = maybe_data.get("image")
                elif isinstance(maybe_data, list) and maybe_data:
                    first_entry = maybe_data[0]
                    if isinstance(first_entry, dict):
                        image_base64 = first_entry.get("image")

        if not image_base64:
            raise FluxToolError("FLUX API response did not include an 'image' field.")

        try:
            image_bytes = base64.b64decode(image_base64)
        except (ValueError, binascii.Error) as exc:
            raise FluxToolError("Failed to decode image data from FLUX API.") from exc

        try:
            output_path.write_bytes(image_bytes)
        except OSError as exc:
            raise FluxToolError(f"Failed to write output image to {output_path}") from exc

        return str(output_path)

    return _call_flux

