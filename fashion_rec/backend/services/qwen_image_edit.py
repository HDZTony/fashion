"""
Lightweight client for Qwen Image Edit API (通义千问-图像编辑).

This module provides a simple programmatic interface and CLI that:
1. Supports single image editing and multi-image fusion.
2. Submits images (local files or URLs) alongside editing prompts to DashScope API.
3. Downloads the edited images to disk and returns the paths.

Usage (CLI - Single Image Edit):
    uv run python -m YIDEA.qwen_image_edit \
        --image path/to/input.jpg \
        --prompt "生成一张符合深度图的图像，遵循以下描述：一辆红色的破旧的自行车停在一条泥泞的小路上，背景是茂密的原始森林" \
        --output path/to/output.png

Usage (CLI - Multi-Image Fusion):
    uv run python -m YIDEA.qwen_image_edit \
        --images path/to/input1.jpg path/to/input2.jpg path/to/input3.jpg \
        --prompt "图1中的女生穿着图2中的黑色裙子按图3的姿势坐下" \
        --output path/to/output.png

Make sure the `DASHSCOPE_API_KEY` environment variable is set to your DashScope API key
before running the CLI or using the client programmatically.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

# Suppress RuntimeWarning about module import when running as __main__
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*found in sys.modules.*")


# API endpoints for different regions
BEIJING_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
SINGAPORE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

DEFAULT_ENV_PREFIX = "QWEN_IMAGE_EDIT_"
DEFAULT_MODEL = "qwen-image-edit-plus-2025-12-15"
DEFAULT_REGION = "singapore"  # Default to Singapore region


class QwenImageEditError(RuntimeError):
    """Raised when the Qwen Image Edit API invocation fails."""


def _is_url(path_or_url: str) -> bool:
    """Check if the given string is a URL."""
    try:
        result = urlparse(path_or_url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


async def _prepare_image_content(image_input: Union[str, Path], expires_in_days: int = None) -> Dict[str, str]:
    """
    Prepare image content for API request.
    Supports both local file paths and URLs.
    For local files, uploads to R2 first to get a public URL (instead of using base64).
    
    Args:
        image_input: Image path or URL
        expires_in_days: Optional number of days after which the file should be deleted from R2
    """
    image_str = str(image_input)
    
    if _is_url(image_str):
        # For URLs, use the URL directly
        return {"image": image_str}
    else:
        # For local files, upload to R2 to get a public URL
        image_path = Path(image_str).expanduser().resolve()
        
        # Validate file exists and is readable
        if not image_path.exists():
            raise QwenImageEditError(f"Image file does not exist: {image_path}")
        if not image_path.is_file():
            raise QwenImageEditError(f"Path is not a file: {image_path}")
        
        # Validate file size (not too large, not empty)
        file_size = image_path.stat().st_size
        if file_size == 0:
            raise QwenImageEditError(f"Image file is empty: {image_path}")
        if file_size > 10 * 1024 * 1024:  # 10MB limit
            raise QwenImageEditError(f"Image file too large ({file_size} bytes): {image_path}")
        
        # Upload to R2 to get public URL
        try:
            from services.storage import upload_file_to_r2
            
            # Determine MIME type from file extension
            suffix = image_path.suffix.lower()
            mime_type = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".avif": "image/avif",
            }.get(suffix, "image/jpeg")
            
            # Read file and upload to R2
            with image_path.open("rb") as f:
                public_url = await upload_file_to_r2(f, image_path.name, mime_type, expires_in_days=expires_in_days)
            
            if expires_in_days:
                print(f"[QwenImageEdit] Uploaded local file to R2 (expires in {expires_in_days} days): {image_path} -> {public_url}")
            else:
                print(f"[QwenImageEdit] Uploaded local file to R2: {image_path} -> {public_url}")
            return {"image": public_url}
        except Exception as e:
            raise QwenImageEditError(f"Failed to upload image to R2: {e}") from e


async def _prepare_payload(
    prompt: str,
    image_inputs: List[Union[str, Path]],
    *,
    model: str = DEFAULT_MODEL,
    n: int = 1,
    negative_prompt: Optional[str] = None,
    prompt_extend: Optional[bool] = None,
    watermark: Optional[bool] = None,
    garment_collage_index: Optional[int] = None,
    size: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build the JSON payload accepted by the Qwen Image Edit API.
    
    Args:
        prompt: Text instructions describing the desired edit.
        image_inputs: List of image paths (local files or URLs).
        model: Model name (default: qwen-image-edit-plus).
        n: Number of images to generate (default: 1).
        negative_prompt: Negative prompt to avoid certain elements.
        prompt_extend: Whether to extend the prompt automatically.
        watermark: Whether to add watermark.
        garment_collage_index: Optional index of the garment collage image (will be set to expire in 7 days).
        size: Optional output image size (e.g., "2048x2048" for 2K resolution).
    """
    # Prepare content array with images and text
    content: List[Dict[str, str]] = []
    
    # Add all images first (upload local files to R2 to get URLs)
    for idx, image_input in enumerate(image_inputs):
        # If this is the garment collage (图2), set it to expire in 7 days
        expires_in_days = 7 if idx == garment_collage_index else None
        image_content = await _prepare_image_content(image_input, expires_in_days=expires_in_days)
        content.append(image_content)
    
    # Add text prompt at the end
    content.append({"text": prompt})
    
    payload: Dict[str, Any] = {
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": content,
                }
            ]
        },
        "parameters": {
            "n": n,
        },
    }
    
    # Add optional parameters
    if negative_prompt is not None:
        payload["parameters"]["negative_prompt"] = negative_prompt
    if prompt_extend is not None:
        payload["parameters"]["prompt_extend"] = prompt_extend
    if watermark is not None:
        payload["parameters"]["watermark"] = watermark
    if size is not None:
        payload["parameters"]["size"] = size
    
    return payload


@dataclass
class QwenImageEditClient:
    """Minimal client wrapper around the Qwen Image Edit API."""

    api_key: str
    endpoint: str = SINGAPORE_ENDPOINT  # Default to Singapore endpoint
    timeout_seconds: float = 300.0
    model: str = DEFAULT_MODEL

    async def edit_image(
        self,
        image_inputs: Union[str, Path, List[Union[str, Path]]],
        prompt: str,
        *,
        n: int = 1,
        negative_prompt: Optional[str] = None,
        prompt_extend: Optional[bool] = None,
        watermark: Optional[bool] = None,
        output_path: Optional[Path] = None,
        debug: bool = False,
        garment_collage_index: Optional[int] = None,
        size: Optional[str] = None,
    ) -> Union[Path, List[Path]]:
        """
        Submit an editing request and return the path(s) to the edited image(s).

        Args:
            image_inputs: Single image path/URL or list of image paths/URLs for fusion.
            prompt: Text instructions describing the desired edit.
            n: Number of images to generate (default: 1).
            negative_prompt: Optional negative prompt.
            prompt_extend: Whether to extend the prompt automatically (default: True).
            watermark: Whether to add watermark (default: False).
            output_path: Optional explicit path where the edited image(s) should be saved.
                         If n > 1, this will be used as a prefix with index suffix.
            debug: Whether to print debug information.
            size: Optional output image size (e.g., "2048x2048" for 2K resolution).

        Returns:
            Path to the saved edited image, or list of paths if n > 1.
        """
        # Normalize image_inputs to a list
        if isinstance(image_inputs, (str, Path)):
            image_list = [image_inputs]
        else:
            image_list = image_inputs

        if not image_list:
            raise QwenImageEditError("At least one image input is required.")

        # Set defaults for optional parameters
        if prompt_extend is None:
            prompt_extend = True
        if watermark is None:
            watermark = False

        payload = await _prepare_payload(
            prompt=prompt,
            image_inputs=image_list,
            model=self.model,
            n=n,
            negative_prompt=negative_prompt,
            prompt_extend=prompt_extend,
            watermark=watermark,
            garment_collage_index=garment_collage_index,
            size=size,
        )

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        # Prepare a readable version of payload for logging
        log_payload = payload.copy()
        if "input" in log_payload and "messages" in log_payload["input"]:
            messages = log_payload["input"]["messages"]
            for msg in messages:
                if "content" in msg:
                    content = msg["content"]
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict) and "image" in item:
                                img_data = item["image"]
                                # All images are now URLs, no need to truncate
                                if isinstance(img_data, str) and img_data.startswith("http"):
                                    # Keep URLs as-is for logging
                                    pass

        print("\n" + "="*80)
        print("=== Qwen-Image-Edit Model Request (Try-On) ===")
        print("="*80)
        print(f"\n[Model]: {self.model}")
        print(f"\n[Prompt]: {prompt}")
        print(f"\n[Image Inputs Count]: {len(image_list)}")
        for idx, img_input in enumerate(image_list):
            if _is_url(str(img_input)):
                print(f"  Image {idx + 1}: URL - {img_input}")
            else:
                print(f"  Image {idx + 1}: Local file - {img_input}")
        print(f"\n[Parameters]:")
        print(f"  n: {n}")
        if negative_prompt:
            print(f"  negative_prompt: {negative_prompt}")
        print(f"  prompt_extend: {prompt_extend}")
        print(f"  watermark: {watermark}")
        print("\n[Full Payload (with image URLs)]:")
        print(json.dumps(log_payload, indent=2, ensure_ascii=False))
        print("\n" + "="*80 + "\n")

        if debug:
            print(f"[QwenImageEdit] Request payload: {payload}")

        with httpx.Client(timeout=self.timeout_seconds) as client:
            try:
                # Validate payload before sending (all images should be URLs now)
                import json as json_module
                try:
                    # Try to serialize payload to check for encoding issues
                    json_str = json_module.dumps(payload)
                    # Validate that all images are URLs (not base64)
                    if "input" in payload and "messages" in payload["input"]:
                        for msg in payload["input"]["messages"]:
                            if "content" in msg:
                                content = msg["content"]
                                if isinstance(content, list):
                                    for item in content:
                                        if isinstance(item, dict) and "image" in item:
                                            img_data = item["image"]
                                            if isinstance(img_data, str):
                                                if img_data.startswith("data:"):
                                                    raise QwenImageEditError(f"Image data should be URL, not base64 data URL: {img_data[:50]}...")
                                                elif not img_data.startswith("http"):
                                                    raise QwenImageEditError(f"Image data should be a valid URL: {img_data[:50]}...")
                                                else:
                                                    print(f"[Validation] Image URL is valid: {img_data}")
                except Exception as validation_err:
                    print(f"[Error] Payload validation failed: {validation_err}")
                    raise QwenImageEditError(f"Payload validation failed: {validation_err}")
                
                response = client.post(self.endpoint, headers=headers, json=payload)
            except httpx.HTTPError as exc:
                raise QwenImageEditError(
                    f"Failed to reach Qwen Image Edit API: {exc}"
                ) from exc

            if response.status_code >= 400:
                error_text = response.text
                try:
                    error_json = response.json()
                    error_text = str(error_json)
                    # Print detailed error info
                    print(f"\n[Qwen Image Edit API Error]")
                    print(f"Status Code: {response.status_code}")
                    print(f"Error Response: {error_json}")
                    if isinstance(error_json, dict):
                        print(f"Request ID: {error_json.get('request_id', 'N/A')}")
                        print(f"Error Code: {error_json.get('code', 'N/A')}")
                        print(f"Error Message: {error_json.get('message', 'N/A')}")
                except ValueError:
                    pass
                raise QwenImageEditError(
                    f"Qwen Image Edit API responded with {response.status_code}: {error_text}"
                )

            try:
                result = response.json()
            except ValueError as exc:
                raise QwenImageEditError(
                    "Qwen Image Edit API returned invalid JSON."
                ) from exc

            if debug:
                print(f"[QwenImageEdit] Response: {result}")

            # Extract image URLs from response
            output = result.get("output", {})
            choices = output.get("choices", [])
            if not choices:
                raise QwenImageEditError(
                    "Qwen Image Edit API response missing 'output.choices'."
                )

            message = choices[0].get("message", {})
            content = message.get("content", [])
            
            image_urls: List[str] = []
            for item in content:
                if isinstance(item, dict) and "image" in item:
                    image_urls.append(item["image"])

            if not image_urls:
                raise QwenImageEditError(
                    "Qwen Image Edit API response missing image URLs."
                )

            # Determine base path for output naming (before loop)
            if output_path is None:
                # Use first image input as base for naming
                first_input = image_list[0]
                if isinstance(first_input, Path):
                    base_path = first_input
                elif _is_url(first_input):
                    base_path = Path("output")
                else:
                    base_path = Path(first_input).expanduser().resolve()
            else:
                # Use provided output_path as base
                base_path = output_path
                output_path = None  # Reset to None so we generate from base_path

            # Download images
            saved_paths: List[Path] = []
            for idx, image_url in enumerate(image_urls):
                try:
                    download_response = client.get(image_url, timeout=self.timeout_seconds)
                except httpx.HTTPError as exc:
                    raise QwenImageEditError(
                        f"Failed to download edited image {idx + 1}: {exc}"
                    ) from exc

                if download_response.status_code >= 400:
                    raise QwenImageEditError(
                        f"Downloading edited image {idx + 1} failed with "
                        f"{download_response.status_code}: {download_response.text}"
                    )

                image_bytes = download_response.content

                # Determine output path for this image
                suffix = base_path.suffix if base_path.suffix else ".png"
                if n > 1:
                    # Multiple images: add index suffix
                    current_output_path = base_path.with_name(
                        f"{base_path.stem}-edited-{idx + 1}{suffix}"
                    )
                else:
                    # Single image: just add -edited suffix
                    current_output_path = base_path.with_name(
                        f"{base_path.stem}-edited{suffix}"
                    )

                try:
                    current_output_path.write_bytes(image_bytes)
                except OSError as exc:
                    raise QwenImageEditError(
                        f"Failed to write edited image to {current_output_path}"
                    ) from exc

                saved_paths.append(current_output_path.resolve())
                if debug:
                    print(f"[QwenImageEdit] Saved image {idx + 1} to: {current_output_path}")

            # Return single path or list of paths
            return saved_paths[0] if n == 1 else saved_paths


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Edit image(s) using Qwen Image Edit API (通义千问-图像编辑)."
    )
    parser.add_argument(
        "--image",
        help="Path to a single input image (for single image editing).",
    )
    parser.add_argument(
        "--images",
        nargs="+",
        help="Paths to multiple input images (for multi-image fusion).",
    )
    parser.add_argument(
        "--prompt",
        required=True,
        help="Text instructions describing the desired edit.",
    )
    parser.add_argument(
        "--output",
        help="Optional output path for the edited image(s). "
        "For multiple images, index suffix will be added.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        choices=["qwen-image-edit-plus", "qwen-image-edit-plus-2025-12-15", "qwen-image-edit"],
        help="Model name to use (default: qwen-image-edit-plus).",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=1,
        help="Number of images to generate (default: 1).",
    )
    parser.add_argument(
        "--negative-prompt",
        help="Negative prompt to avoid certain elements.",
    )
    parser.add_argument(
        "--no-prompt-extend",
        action="store_true",
        help="Disable automatic prompt extension (enabled by default).",
    )
    parser.add_argument(
        "--watermark",
        action="store_true",
        help="Add watermark to generated images (disabled by default).",
    )
    parser.add_argument(
        "--region",
        choices=["beijing", "singapore"],
        default=DEFAULT_REGION,
        help="API region to use (default: beijing).",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print debug information for troubleshooting.",
    )
    return parser.parse_args(argv)


def _load_env_config() -> dict[str, Any]:
    """Read optional overrides from environment variables."""
    config: dict[str, Any] = {}
    
    # Determine region (default to Singapore)
    region = os.getenv(f"{DEFAULT_ENV_PREFIX}REGION", DEFAULT_REGION).lower()
    if region == "singapore":
        config["endpoint"] = SINGAPORE_ENDPOINT
        # For Singapore endpoint, must use Singapore API key
        api_key = os.getenv("DASHSCOPE_API_KEY_SG") or os.getenv(f"{DEFAULT_ENV_PREFIX}API_KEY")
        if not api_key:
            raise QwenImageEditError(
                "DASHSCOPE_API_KEY_SG must be set for Singapore endpoint. "
                "Please set this environment variable in Fly.io using: "
                "fly secrets set DASHSCOPE_API_KEY_SG=your_singapore_key_here"
            )
        config["api_key"] = api_key
        if os.getenv("DASHSCOPE_API_KEY_SG"):
            print("[Qwen-Image-Edit] Using Singapore endpoint with Singapore API key")
        else:
            print("[Qwen-Image-Edit] Using Singapore endpoint with custom API key")
    else:
        config["endpoint"] = BEIJING_ENDPOINT
        # For Beijing endpoint, must use Beijing API key (not Singapore key)
        api_key = os.getenv("DASHSCOPE_API_KEY") or os.getenv(f"{DEFAULT_ENV_PREFIX}API_KEY")
        if not api_key:
            raise QwenImageEditError(
                "DASHSCOPE_API_KEY must be set for Beijing endpoint. "
                "Please set this environment variable in Fly.io using: "
                "fly secrets set DASHSCOPE_API_KEY=your_beijing_key_here"
            )
        config["api_key"] = api_key
        print("[Qwen-Image-Edit] Using Beijing endpoint with Beijing API key")

    model = os.getenv(f"{DEFAULT_ENV_PREFIX}MODEL")
    if model:
        config["model"] = model

    timeout = os.getenv(f"{DEFAULT_ENV_PREFIX}TIMEOUT_SECONDS")
    if timeout:
        try:
            config["timeout_seconds"] = float(timeout)
        except ValueError as exc:
            raise QwenImageEditError(
                f"Invalid {DEFAULT_ENV_PREFIX}TIMEOUT_SECONDS value: {timeout}"
            ) from exc

    return config


def main(argv: Optional[list[str]] = None) -> int:
    load_dotenv()
    args = _parse_args(argv)

    # Validate arguments
    if not args.image and not args.images:
        parser = argparse.ArgumentParser()
        parser.error("Either --image or --images must be provided.")

    env_config = _load_env_config()
    api_key = env_config.get("api_key")
    if not api_key:
        raise QwenImageEditError(
            "Environment variable DASHSCOPE_API_KEY or "
            f"{DEFAULT_ENV_PREFIX}API_KEY must be set."
        )

    # Override endpoint if region is specified
    if args.region == "singapore":
        env_config["endpoint"] = SINGAPORE_ENDPOINT
    else:
        env_config["endpoint"] = BEIJING_ENDPOINT

    # Override model if specified
    if args.model:
        env_config["model"] = args.model

    client = QwenImageEditClient(**env_config)

    # Prepare image inputs
    if args.images:
        image_inputs = [Path(img).expanduser().resolve() for img in args.images]
    else:
        image_inputs = Path(args.image).expanduser().resolve()

    output_path = Path(args.output).expanduser().resolve() if args.output else None

    edited_paths = client.edit_image(
        image_inputs=image_inputs,
        prompt=args.prompt,
        n=args.n,
        negative_prompt=args.negative_prompt,
        prompt_extend=not args.no_prompt_extend,
        watermark=args.watermark,
        output_path=output_path,
        debug=args.debug,
    )

    if isinstance(edited_paths, list):
        print(f"Edited images saved to:")
        for path in edited_paths:
            print(f"  - {path}")
    else:
        print(f"Edited image saved to: {edited_paths}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# 单图编辑
# uv run python -m YIDEA.qwen_image_edit \
#     --image path/to/your/image.jpg \
#     --prompt "你的编辑提示词" \
#     --output output.jpg

# # 多图融合
# uv run python -m YIDEA.qwen_image_edit --images "C:\Users\hedz\Desktop\自拍照2_75_95.jpg" "C:\Users\hedz\Desktop\微信图片_20251110135305_76_95.jpg" --prompt "图1中的女生穿着图2中的衣服" --n 2