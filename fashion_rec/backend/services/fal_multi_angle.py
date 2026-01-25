"""
fal.ai Multi-Angle Image Generation Service

Uses the qwen-image-edit-2511-multiple-angles model to generate
same scene from different camera angles (azimuth/elevation).
"""

import os
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict

import fal_client

logger = logging.getLogger(__name__)


@dataclass
class AngleParams:
    """Parameters for multi-angle generation."""
    horizontal_angle: float = 0      # 0-360° (azimuth)
    vertical_angle: float = 0        # -30° to 90° (elevation)
    zoom: float = 5                  # 0-10 (camera distance)
    additional_prompt: Optional[str] = None
    
    def validate(self) -> None:
        """Validate parameter ranges."""
        if not 0 <= self.horizontal_angle <= 360:
            raise ValueError(f"horizontal_angle must be 0-360, got {self.horizontal_angle}")
        if not -30 <= self.vertical_angle <= 90:
            raise ValueError(f"vertical_angle must be -30 to 90, got {self.vertical_angle}")
        if not 0 <= self.zoom <= 10:
            raise ValueError(f"zoom must be 0-10, got {self.zoom}")


# Preset angle configurations
PRESET_ANGLES: Dict[str, AngleParams] = {
    "front": AngleParams(horizontal_angle=0, vertical_angle=0, zoom=5),
    "left": AngleParams(horizontal_angle=270, vertical_angle=0, zoom=5),
    "right": AngleParams(horizontal_angle=90, vertical_angle=0, zoom=5),
    "back": AngleParams(horizontal_angle=180, vertical_angle=0, zoom=5),
    "top": AngleParams(horizontal_angle=0, vertical_angle=60, zoom=5),
    "low": AngleParams(horizontal_angle=0, vertical_angle=-20, zoom=5),
}


def get_preset_params(preset_name: str) -> AngleParams:
    """Get angle parameters for a preset name."""
    if preset_name not in PRESET_ANGLES:
        raise ValueError(f"Unknown preset: {preset_name}. Available: {list(PRESET_ANGLES.keys())}")
    return PRESET_ANGLES[preset_name]


def _ensure_fal_key() -> None:
    """Ensure FAL_KEY environment variable is set."""
    fal_key = os.getenv("FAL_KEY")
    if not fal_key:
        raise RuntimeError(
            "FAL_KEY environment variable is not set. "
            "Please set it to your fal.ai API key."
        )


def generate_multi_angle_sync(
    image_url: str,
    params: AngleParams,
    guidance_scale: float = 4.5,
    num_inference_steps: int = 28,
    lora_scale: float = 1.0,
    output_format: str = "png",
) -> Dict[str, Any]:
    """
    Generate image from a different camera angle using fal.ai.
    
    Args:
        image_url: URL of the source image (try-on result)
        params: AngleParams with horizontal_angle, vertical_angle, zoom
        guidance_scale: CFG scale (1-20, default 4.5)
        num_inference_steps: Number of inference steps (1-50, default 28)
        lora_scale: LoRA strength (0-4, default 1)
        output_format: Output format (png, jpeg, webp)
    
    Returns:
        Dict with 'images' list containing generated image URLs,
        'seed' used for generation, and 'prompt' used.
    """
    _ensure_fal_key()
    params.validate()
    
    logger.info(
        f"[Multi-Angle] Generating angle: h={params.horizontal_angle}°, "
        f"v={params.vertical_angle}°, zoom={params.zoom}"
    )
    
    arguments = {
        "image_urls": [image_url],
        "horizontal_angle": params.horizontal_angle,
        "vertical_angle": params.vertical_angle,
        "zoom": params.zoom,
        "guidance_scale": guidance_scale,
        "num_inference_steps": num_inference_steps,
        "lora_scale": lora_scale,
        "output_format": output_format,
        "num_images": 1,
        "enable_safety_checker": True,
    }
    
    if params.additional_prompt:
        arguments["additional_prompt"] = params.additional_prompt
    
    def on_queue_update(update):
        if isinstance(update, fal_client.InProgress):
            for log_entry in update.logs:
                logger.debug(f"[Multi-Angle] {log_entry.get('message', '')}")
    
    try:
        result = fal_client.subscribe(
            "fal-ai/qwen-image-edit-2511-multiple-angles",
            arguments=arguments,
            with_logs=True,
            on_queue_update=on_queue_update,
        )
        
        logger.info(f"[Multi-Angle] Generation complete. Seed: {result.get('seed')}")
        return result
        
    except Exception as e:
        logger.error(f"[Multi-Angle] Generation failed: {e}")
        raise


async def generate_multi_angle(
    image_url: str,
    params: AngleParams,
    guidance_scale: float = 4.5,
    num_inference_steps: int = 28,
    lora_scale: float = 1.0,
    output_format: str = "png",
) -> Dict[str, Any]:
    """
    Async wrapper for multi-angle generation.
    
    Note: fal_client.subscribe is synchronous, so we run it in executor.
    """
    import asyncio
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: generate_multi_angle_sync(
            image_url=image_url,
            params=params,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            lora_scale=lora_scale,
            output_format=output_format,
        )
    )
    return result


def get_available_presets() -> List[Dict[str, Any]]:
    """Get list of available preset angles with their parameters."""
    return [
        {
            "name": name,
            "horizontal_angle": params.horizontal_angle,
            "vertical_angle": params.vertical_angle,
            "zoom": params.zoom,
        }
        for name, params in PRESET_ANGLES.items()
    ]
