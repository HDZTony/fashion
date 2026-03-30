from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import time
import requests
import urllib3
from io import BytesIO
from PIL import Image
import shutil
import os
import sys
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Configure logging to ensure output is visible
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Ensure output goes to stdout
    ]
)
logger = logging.getLogger(__name__)

# Disable SSL warnings for requests with verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from services.recognition import analyze_image
from services.vector_db import add_to_wardrobe, search_similar, get_user_items, get_items_by_urls, get_user_items_with_embedding
from services.try_on import generate_try_on
from auth import get_current_user, get_current_user_token, get_current_user_and_token, get_optional_user_and_token, auth_router
from fastapi import Depends
from services.guest_quota import (
    check_and_consume_tryon,
    check_and_consume_outfit,
    get_guest_quota,
    get_client_ip as get_guest_client_ip,
)
from chatkit.server import StreamingResult
from chatkit.store import NotFoundError as ChatKitNotFoundError
from chatkit.store import default_generate_id as chatkit_default_generate_id
from chatkit.types import FileAttachment, ImageAttachment
from services.chatkit_fashion_server import fashion_chatkit_server
from services.chatkit_outfit_context import parse_outfit_context_from_request
from services.chatkit_session_api import (
    filter_visible_items,
    first_user_message_preview,
    thread_owned_by_user,
)
from services.chatkit_tools import garment_url_kind_for_tryon_log

app = FastAPI(title="Fashion Recommendation API")
app.include_router(auth_router)

# Initialize app state for background tasks
app.state.cleanup_task = None

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add middleware to log authentication-related requests
@app.middleware("http")
async def log_auth_requests(request: Request, call_next):
    """Log authentication-related requests for debugging"""
    if request.url.path in ["/tryon-history", "/favorites"]:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            logger.warning(f"[Auth Middleware] {request.method} {request.url.path} - No Authorization header")
        else:
            token_prefix = auth_header[:30] if len(auth_header) > 30 else auth_header
            logger.info(f"[Auth Middleware] {request.method} {request.url.path} - Has Authorization header: {token_prefix}...")
    
    response = await call_next(request)
    
    # Log 401 responses
    if response.status_code == 401 and request.url.path in ["/tryon-history", "/favorites"]:
        auth_header = request.headers.get("authorization")
        logger.error(f"[Auth Middleware] 401 Unauthorized for {request.method} {request.url.path} - Auth header: {'Present' if auth_header else 'Missing'}")
    
    return response

# Directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class OutfitAgentRequest(BaseModel):
    location: Optional[str] = None  # Optional, will be extracted from prompt or IP if not provided
    prompt: str
    base_item_ids: Optional[List[str]] = None
    background_image_url: Optional[str] = None
    background_action_prompt: Optional[str] = None  # User's description of actions/activities in the background image
    model_image_url: Optional[str] = None  # Model image URL (person) for personalized suggestions
    # Map of wardrobe_id to role for already selected items (to avoid regenerating them)
    selected_items_roles: Optional[Dict[str, str]] = None
    model: Optional[str] = "qwen"  # "qwen" or "grok" — which VL model to use for outfit generation


class OutfitItem(BaseModel):
    wardrobe_id: Optional[str] = None
    role: str
    description: str


class OutfitPlan(BaseModel):
    title: str
    items: List[OutfitItem]
    reason: str
    long_text: str


class OutfitAgentResponse(BaseModel):
    weather_summary: str
    wardrobe_count: int
    outfits: List[OutfitPlan]
    raw_text: str


class SaveLookItem(BaseModel):
    wardrobe_id: str | None = None
    role: str
    description: str


class SaveLookRequest(BaseModel):
    title: str
    items: List[SaveLookItem]
    location: Optional[str] = None
    prompt: str
    background_image_url: Optional[str] = None


class SaveFavoriteRequest(BaseModel):
    image_url: str  # The try-on result image URL (uploaded to R2)
    title: Optional[str] = None  # Optional title for the favorite
    garment_urls: Optional[List[str]] = None  # URLs of garment items used in try-on
    background_image_url: Optional[str] = None  # Background image URL if used
    prompt: Optional[str] = None  # User's custom prompt
    model_image_url: Optional[str] = None  # Model image URL
    model_image_id: Optional[str] = None  # Model image ID


class IntentGarmentCropsRequest(BaseModel):
    """Studio chat rail: intent-guided garment crops (Qwen3-VL + R2)."""

    image_urls: List[str]
    intent_text: str = ""


@app.get("/")
def root():
    return {"message": "Fashion Recommendation API"}


@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify the service is ready.
    Always returns 200 to indicate the service is running and accepting connections.
    Minimal response to reduce bandwidth usage.
    """
    # Minimal health check - just return OK status
    # Fly.io health check just needs to know the app is listening
    # No need to check components on every health check (reduces overhead)
    return {"status": "ok"}


# Allowed host for image proxy (avoid open proxy)
_PROXY_IMAGE_ALLOWED_HOST = "r2.fashion-rec.com"


@app.get("/proxy-image", response_class=Response)
async def proxy_image(url: str = Query(..., description="Image URL (must be r2.fashion-rec.com)")):
    """
    开发环境下前端通过此接口代理 R2 图片，避免直连 R2 的 CORS 问题。
    仅允许 r2.fashion-rec.com 域名。
    """
    from urllib.parse import urlparse

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise HTTPException(status_code=400, detail="Invalid url")
        if parsed.scheme != "https" or parsed.netloc != _PROXY_IMAGE_ALLOWED_HOST:
            raise HTTPException(status_code=400, detail="Only r2.fashion-rec.com URLs are allowed")

        # 直连 R2，避免代理导致 SSL 问题
        _proxy_keys = ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")
        _saved = {k: os.environ.pop(k, None) for k in _proxy_keys if k in os.environ}
        try:
            resp = requests.get(url, timeout=30, stream=True)
            resp.raise_for_status()
            content = resp.content
            content_type = resp.headers.get("Content-Type") or "image/jpeg"
        finally:
            os.environ.update(_saved)

        return Response(content=content, media_type=content_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[proxy-image] Failed to fetch {url[:80]}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch image")


def _convert_unsupported_format(image_path: Path) -> Path:
    """
    Convert unsupported image formats (AVIF, WebP, etc.) to JPEG.
    Qwen-VL API only supports JPEG, PNG, and some other common formats.
    Returns the converted path if conversion was needed, otherwise returns original path.
    """
    try:
        # Check by file extension first (more reliable for AVIF)
        ext = image_path.suffix.lower()
        unsupported_extensions = {'.avif', '.webp', '.gif'}
        
        # Try to open and detect format using PIL
        try:
            # Open image with explicit mode handling
            logger.debug(f"Opening image: {image_path} (absolute: {image_path.resolve()})")
            if not image_path.exists():
                logger.error(f"Image file does not exist: {image_path}")
                return image_path
            
            img = Image.open(image_path)
            # Load the image to ensure it's fully loaded
            img.load()
            original_format = img.format
            logger.debug(f"Image opened successfully, format: {original_format}, mode: {img.mode}, size: {img.size}")
        except Exception as e:
            # If PIL can't open it, check if it's an unsupported extension
            if ext in unsupported_extensions:
                logger.error(f"Cannot open {ext} file with PIL: {e}. PIL may need additional plugins (e.g., pillow-avif-plugin).")
                # Return original - will fail later with a clearer error message
                return image_path
            else:
                # Unknown format, return as-is
                return image_path
        
        # Formats that Qwen-VL API may not support
        unsupported_formats = {'AVIF', 'WEBP', 'GIF'}
        needs_conversion = (ext in unsupported_extensions) or (original_format in unsupported_formats)
        
        if needs_conversion:
            format_name = original_format or ext.upper().replace('.', '')
            logger.info(f"Converting {format_name} image to JPEG for API compatibility...")
            
            # Convert to RGB if needed (AVIF might be in other modes)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Create new filename with .jpg extension
            # Use absolute path to avoid path resolution issues
            image_path_abs = image_path.resolve()
            # If file already has .jpg extension, create a new filename to avoid overwriting
            if image_path_abs.suffix.lower() in {'.jpg', '.jpeg'}:
                converted_path = image_path_abs.with_name(image_path_abs.stem + '_converted.jpg')
                logger.debug(f"File already has .jpg extension, using new filename: {converted_path}")
            else:
                converted_path = image_path_abs.with_suffix('.jpg')
            logger.debug(f"Converting {image_path} (abs: {image_path_abs}) to {converted_path} (abs: {converted_path.resolve()})")
            
            # Ensure parent directory exists
            converted_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save the converted image directly to final path
            # Don't use temp file approach as it's causing issues on Windows
            try:
                logger.debug(f"Saving directly to: {converted_path} (absolute: {converted_path.resolve()})")
                
                # Remove existing file if any
                if converted_path.exists():
                    try:
                        converted_path.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to remove existing file: {e}")
                
                # Save the image directly to final path
                try:
                    # Use context manager to ensure file is properly closed
                    logger.info(f"Attempting to save image to: {converted_path} (absolute: {converted_path.resolve()})")
                    logger.info(f"Image mode: {img.mode}, size: {img.size}, format: {img.format}")
                    
                    # Check if directory exists and is writable
                    if not converted_path.parent.exists():
                        logger.error(f"Parent directory does not exist: {converted_path.parent}")
                        raise FileNotFoundError(f"Parent directory does not exist: {converted_path.parent}")
                    
                    # Try to save
                    img.save(converted_path, 'JPEG', quality=90, optimize=True)
                    logger.info(f"img.save() completed for: {converted_path}")
                    
                    # Immediately check if file exists
                    if converted_path.exists():
                        immediate_size = converted_path.stat().st_size
                        logger.info(f"File exists immediately after save: {converted_path} (size: {immediate_size} bytes)")
                    else:
                        logger.error(f"File does NOT exist immediately after save: {converted_path}")
                        
                except Exception as save_ex:
                    logger.error(f"img.save() raised exception: {save_ex}")
                    import traceback
                    logger.error(f"Save exception traceback: {traceback.format_exc()}")
                    raise
                finally:
                    # Always close the image
                    try:
                        img.close()
                        logger.debug("Image object closed")
                    except Exception as close_ex:
                        logger.warning(f"Error closing image: {close_ex}")
                        pass
                
                # Force file system sync (Windows)
                import os
                try:
                    # Open and close the file to force write
                    with open(converted_path, 'rb') as f:
                        pass
                except Exception as e:
                    logger.warning(f"Could not verify file after save: {e}")
                
                # Small delay to ensure file system has written the file (Windows issue)
                import time
                time.sleep(0.3)  # Increased delay for Windows
                
                # Verify file exists and has content - try multiple times for Windows
                max_retries = 10
                for retry in range(max_retries):
                    if converted_path.exists():
                        try:
                            size = converted_path.stat().st_size
                            if size > 0:
                                logger.debug(f"File verified: {converted_path} (size: {size} bytes) after {retry + 1} attempts")
                                break
                            else:
                                logger.warning(f"File exists but is empty, retrying...")
                        except Exception as e:
                            logger.warning(f"Error checking file: {e}, retrying...")
                    
                    if retry < max_retries - 1:
                        logger.debug(f"File not found or invalid, retrying ({retry + 1}/{max_retries})...")
                        time.sleep(0.1)
                    else:
                        logger.error(f"Converted file does not exist or is invalid after save (tried {max_retries} times): {converted_path} (absolute: {converted_path.resolve()})")
                        # List directory contents for debugging
                        if converted_path.parent.exists():
                            try:
                                files = list(converted_path.parent.iterdir())
                                logger.error(f"Files in directory: {[f.name for f in files]}")
                            except:
                                pass
                        # Check if original still exists
                        if not image_path.exists():
                            logger.error(f"Original file also missing: {image_path}")
                            raise FileNotFoundError(f"Both converted and original files missing after save attempt")
                        return image_path
                
                converted_size = converted_path.stat().st_size
                if converted_size == 0:
                    logger.error(f"Converted file is empty: {converted_path}")
                    converted_path.unlink()  # Remove empty file
                    if not image_path.exists():
                        raise FileNotFoundError(f"Original file missing and converted file is empty")
                    return image_path
                
                logger.debug(f"File saved successfully: {converted_path} (size: {converted_size} bytes)")
                
            except Exception as save_error:
                logger.error(f"Failed to save converted image: {save_error}")
                import traceback
                logger.error(f"Save error traceback: {traceback.format_exc()}")
                # Clean up converted file if it exists but is invalid
                if converted_path.exists():
                    try:
                        converted_path.unlink()
                    except:
                        pass
                # Return original if it still exists
                if image_path.exists():
                    return image_path
                raise FileNotFoundError(f"Save failed and original file is missing: {image_path}")
            
            # Verify converted file exists before deleting original
            if not converted_path.exists():
                logger.error(f"Converted file does not exist after save: {converted_path} (absolute: {converted_path.resolve()})")
                # Try to get more info about the directory
                logger.error(f"Parent directory exists: {converted_path.parent.exists()}, is_dir: {converted_path.parent.is_dir()}")
                return image_path  # Return original if conversion failed
            
            file_size = converted_path.stat().st_size
            if file_size == 0:
                logger.error(f"Converted file is empty: {converted_path}")
                return image_path  # Return original if file is empty
            
            logger.debug(f"Converted file exists: {converted_path} (absolute: {converted_path.resolve()}, size: {file_size} bytes)")
            
            # Remove original file only after confirming new file exists and is valid
            # Only delete original if converted file is in a different location
            if converted_path.resolve() != image_path.resolve():
                # Double-check converted file exists before deleting original
                if not converted_path.exists():
                    logger.error(f"Cannot delete original: converted file does not exist: {converted_path}")
                    # Check if original still exists
                    if image_path.exists():
                        logger.warning(f"Returning original file as converted file is missing: {image_path}")
                        return image_path
                    else:
                        logger.error(f"Both converted and original files are missing!")
                        raise FileNotFoundError(f"Conversion failed: converted file missing and original file also missing")
                
                converted_size = converted_path.stat().st_size
                if converted_size == 0:
                    logger.error(f"Cannot delete original: converted file is empty: {converted_path}")
                    if image_path.exists():
                        return image_path
                    raise FileNotFoundError(f"Conversion failed: converted file is empty and original file is missing")
                
                # Only delete original if converted file is valid and in a different location
                try:
                    image_path.unlink()
                    logger.debug(f"Deleted original file: {image_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete original file {image_path}: {e}")
                    # Continue anyway - converted file exists and is valid
            else:
                # Same file path - don't delete, just return it
                logger.debug(f"Converted file is same as original, not deleting: {image_path}")
            
            # Final verification before returning - this should never happen if save succeeded
            if not converted_path.exists():
                logger.error(f"CRITICAL: Converted file does not exist before return: {converted_path}")
                logger.error(f"Absolute path: {converted_path.resolve()}")
                # This should not happen - we already checked above
                # Check if original file still exists
                if image_path.exists():
                    logger.warning(f"Returning original file as fallback: {image_path}")
                    return image_path  # Return original if it still exists
                else:
                    logger.error(f"Both converted and original files are missing!")
                    # If nothing exists, raise an error
                    raise FileNotFoundError(f"Conversion failed: neither converted file ({converted_path}) nor original file ({image_path}) exists")
            
            final_size = converted_path.stat().st_size
            if final_size == 0:
                logger.error(f"CRITICAL: Converted file is empty: {converted_path}")
                return image_path  # Return original if file is empty
            
            logger.info(f"✓ Converted {format_name} to JPEG: {converted_path.name} (size: {final_size} bytes)")
            logger.debug(f"Returning converted path: {converted_path} (absolute: {converted_path.resolve()})")
            return converted_path
        
        return image_path
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"Failed to convert image format: {error_msg}, using original file")
        # Return original path - if conversion fails, try with original
        # The API error handling will provide a user-friendly message
        return image_path


def _optimize_image_url_for_model(image_url: Optional[str], width: int = 800, quality: int = 85) -> Optional[str]:
    """
    Convert R2 image URL to Cloudflare Image Resize URL for model inference.
    R2 still stores original images, but we resize to specified resolution when passing to models.
    
    Args:
        image_url: Original R2 URL (e.g., https://r2.fashion-rec.com/example/image.jpg)
        width: Target width in pixels (default: 800)
        quality: JPEG quality 1-100 (default: 85)
    
    Returns:
        Optimized URL with Cloudflare Image Resize (e.g., https://r2.fashion-rec.com/cdn-cgi/image/width=800,quality=85/example/image.jpg)
        Returns None if input is None or empty
    """
    if not image_url:
        return None
    
    # Already optimized URL (contains /cdn-cgi/image/)
    if '/cdn-cgi/image/' in image_url:
        return image_url
    
    # Only optimize R2 domain URLs
    if 'r2.fashion-rec.com' not in image_url:
        return image_url
    
    try:
        from urllib.parse import urlparse, urlunparse
        
        parsed = urlparse(image_url)
        path = parsed.path
        
        # Build Cloudflare Image Resize URL
        # Format: https://domain/cdn-cgi/image/width=800,quality=85/path/to/image.jpg
        optimized_path = f'/cdn-cgi/image/width={width},quality={quality}{path}'
        
        optimized_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            optimized_path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
        
        return optimized_url
    except Exception as e:
        logger.warning(f"Failed to optimize image URL {image_url}: {e}, using original URL")
        return image_url


async def _download_and_upload_image(image_url: str) -> str:
    """
    Helper function to download an image from URL and upload to R2.
    Handles anti-bot measures, optimization, and returns the R2 public URL.
    """
    from services.storage import upload_file_to_r2
    from urllib.parse import urlparse
    from io import BytesIO
    import uuid
    
    # Parse URL to determine headers
    parsed_url = urlparse(image_url)
    domain = parsed_url.netloc.lower()
    
    # Determine base URL for Referer and Origin
    if 'louisvuitton.com' in domain:
        if domain.startswith('eu.'):
            base_url = 'https://eu.louisvuitton.com'
        elif domain.startswith('cn.') or domain.startswith('www.cn.'):
            base_url = 'https://www.louisvuitton.cn'
        else:
            base_url = 'https://www.louisvuitton.com'
    else:
        base_url = f"{parsed_url.scheme}://{domain}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': f'{base_url}/',
        'Origin': base_url,
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-origin',
    }
    
    # Create session and establish connection
    session = requests.Session()
    session.headers.update(headers)
    
    if 'louisvuitton.com' in domain:
        try:
            session.get(base_url, timeout=(15, 15), verify=False)
        except Exception:
            pass  # Ignore session establishment errors
    
    # Download image
    resp = session.get(image_url, timeout=(60, 300), stream=True, verify=False, allow_redirects=True)
    resp.raise_for_status()
    
    # Determine content type and extension
    content_type = resp.headers.get("content-type", "image/jpeg")
    if ";" in content_type:
        content_type = content_type.split(";")[0].strip()
    
    ext = "jpg"
    if "png" in content_type.lower():
        ext = "png"
    elif "webp" in content_type.lower():
        ext = "webp"
    elif "gif" in content_type.lower():
        ext = "gif"
    
    # Save to temp file
    temp_filename = f"url_upload_{uuid.uuid4().hex}.{ext}"
    temp_path = UPLOAD_DIR / "temp" / temp_filename
    temp_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Download with streaming
    with temp_path.open("wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    
    file_size = temp_path.stat().st_size
    
    # Verify original file exists before conversion
    if not temp_path.exists():
        logger.error(f"Downloaded file does not exist: {temp_path}")
        raise FileNotFoundError(f"Downloaded file not found: {temp_path}")
    
    original_size = temp_path.stat().st_size
    logger.info(f"Downloaded file exists: {temp_path} (size: {original_size} bytes)")
    
    # Convert unsupported formats (AVIF, WebP, etc.) to JPEG
    original_path = temp_path.resolve()  # Use absolute path for comparison
    logger.debug(f"Original path before conversion: {original_path}")
    
    try:
        converted_path = _convert_unsupported_format(temp_path)
        logger.debug(f"Converted path returned: {converted_path}")
    except Exception as convert_error:
        logger.error(f"Conversion failed with exception: {convert_error}")
        import traceback
        logger.error(f"Conversion error traceback: {traceback.format_exc()}")
        # If conversion fails, check if original file still exists
        if temp_path.exists():
            logger.warning(f"Conversion failed, using original file: {temp_path}")
            converted_path = temp_path
        else:
            raise FileNotFoundError(f"Conversion failed and original file is missing: {temp_path}")
    
    # Update temp_path to point to the converted file (if conversion happened)
    # Use absolute path comparison to ensure we detect path changes correctly
    try:
        converted_path_abs = converted_path.resolve()
    except (OSError, RuntimeError):
        # If resolve fails, file doesn't exist
        logger.error(f"Cannot resolve converted path: {converted_path}")
        converted_path_abs = converted_path
    
    logger.debug(f"Original path (abs): {original_path}, Converted path (abs): {converted_path_abs}")
    
    if converted_path_abs != original_path:
        # Verify converted file exists
        if not converted_path.exists():
            logger.error(f"Converted file does not exist: {converted_path}")
            logger.error(f"Absolute path: {converted_path_abs}")
            logger.error(f"Parent directory exists: {converted_path.parent.exists()}")
            # List files in the directory for debugging
            if converted_path.parent.exists():
                try:
                    files_in_dir = list(converted_path.parent.iterdir())
                    logger.error(f"Files in directory: {[f.name for f in files_in_dir]}")
                except Exception as e:
                    logger.error(f"Could not list directory: {e}")
            # Fallback to original file if it still exists
            if temp_path.exists():
                logger.warning(f"Converted file missing, falling back to original: {temp_path}")
                converted_path = temp_path
            else:
                raise FileNotFoundError(f"Converted file not found and original file is also missing: {temp_path}")
        
        # Verify converted file is valid
        try:
            converted_size = converted_path.stat().st_size
            if converted_size == 0:
                logger.error(f"Converted file is empty: {converted_path}")
                if temp_path.exists():
                    logger.warning(f"Converted file is empty, falling back to original: {temp_path}")
                    converted_path = temp_path
                else:
                    raise FileNotFoundError(f"Converted file is empty and original file is missing: {temp_path}")
        except Exception as e:
            logger.error(f"Error checking converted file size: {e}")
            if temp_path.exists():
                logger.warning(f"Error checking converted file, falling back to original: {temp_path}")
                converted_path = temp_path
            else:
                raise FileNotFoundError(f"Error checking converted file and original file is missing: {temp_path}")
        
        temp_path = converted_path
        temp_filename = temp_path.name
        content_type = "image/jpeg"
        file_size = temp_path.stat().st_size  # Update file size after conversion
        logger.info(f"Using converted file: {temp_path} (absolute: {temp_path.resolve()}, size: {file_size} bytes)")
    else:
        # Verify original file still exists
        if not temp_path.exists():
            logger.error(f"Original file does not exist after conversion check: {temp_path}")
            raise FileNotFoundError(f"Original file not found: {temp_path}")
        logger.info(f"Using original file: {temp_path} (absolute: {temp_path.resolve()}, size: {file_size} bytes)")
    
    # Optimize large images
    MAX_SIZE_FOR_COMPRESSION = 5 * 1024 * 1024  # 5MB
    if file_size > MAX_SIZE_FOR_COMPRESSION:
        try:
            img = Image.open(temp_path)
            original_size = img.size
            
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            max_dimension = 1920
            if max(original_size) > max_dimension:
                ratio = max_dimension / max(original_size)
                new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))
                img = img.resize(new_size, Image.LANCZOS)
            
            # Create optimized path - use a different name if already .jpg to avoid conflicts
            if temp_path.suffix.lower() == '.jpg':
                # If already .jpg, create a new file with _optimized suffix
                optimized_path = temp_path.with_name(temp_path.stem + '_optimized.jpg')
            else:
                optimized_path = temp_path.with_suffix('.jpg')
            
            img.save(optimized_path, 'JPEG', quality=85, optimize=True)
            
            # Only replace if optimized file is smaller and exists
            if optimized_path.exists() and optimized_path.stat().st_size < file_size:
                # Delete original only if optimized file is different
                if optimized_path != temp_path:
                    try:
                        temp_path.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete original file during optimization: {e}")
                temp_path = optimized_path
                temp_filename = temp_path.name
                content_type = "image/jpeg"
                file_size = temp_path.stat().st_size  # Update file size
            elif optimized_path.exists() and optimized_path == temp_path:
                # If same file, just update file size
                file_size = temp_path.stat().st_size
        except Exception as e:
            logger.warning(f"Failed to optimize image: {e}")
    
    # Upload to R2
    # Verify file exists before uploading
    if not temp_path.exists():
        logger.error(f"File does not exist before upload: {temp_path}")
        raise FileNotFoundError(f"File not found: {temp_path}")
    
    logger.info(f"Uploading file to R2: {temp_path} (size: {temp_path.stat().st_size} bytes)")
    with temp_path.open("rb") as f:
        file_content = BytesIO(f.read())
    file_content.seek(0)
    final_url = await upload_file_to_r2(file_content, temp_filename, content_type)
    
    # Clean up
    temp_path.unlink()
    
    return final_url


@app.post("/items")
async def add_item(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """
    Upload an image, analyze it, and add it to the user's wardrobe.
    """
    try:
        # Save uploaded file temporarily
        temp_path = UPLOAD_DIR / "temp" / file.filename
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        with temp_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Analyze image
        features_list = await analyze_image(temp_path)
        
        # Handle single item (for this endpoint, we expect single item)
        if not features_list or len(features_list) == 0:
            raise HTTPException(status_code=500, detail="Image analysis returned empty result")
        features = features_list[0] if isinstance(features_list, list) else features_list

        # Upload to R2 and get URL
        from services.storage import upload_file_to_r2

        with temp_path.open("rb") as f:
            url = await upload_file_to_r2(f, file.filename, file.content_type or "image/jpeg")

        # Add to vector database
        # Extract gender from features if present
        gender = features.get("gender") if isinstance(features, dict) else None
        item_id = await add_to_wardrobe(url, features, user_id, gender=gender)

        # Clean up temp file
        temp_path.unlink()

        return {
            "id": item_id,
            "url": url,
            "features": features if isinstance(features, dict) else features_list[0] if features_list else {},
        }
    except Exception as e:
        print(f"Error adding item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_image(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user),
):
    """
    Upload an image via file or URL, analyze it, and add to wardrobe.
    Supports both file upload and public URL.
    """
    from services.storage import upload_file_to_r2
    
    try:
        image_url_to_analyze: str
        final_url: Optional[str] = None  # Initialize final_url
        features_list: Optional[List[Dict[str, Any]]] = None  # Initialize features_list
        
        if file:
            # Handle file upload
            if not file.filename:
                raise HTTPException(status_code=400, detail="File must have a filename")
            
            logger.info(f"===== Starting file upload: {file.filename} =====")
            temp_path = UPLOAD_DIR / "temp" / file.filename
            temp_path.parent.mkdir(parents=True, exist_ok=True)

            with temp_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            logger.info(f"File saved to: {temp_path}")

            # Use local file for analysis (faster and more reliable)
            image_url_to_analyze = str(temp_path)
            
            # Note: We'll upload to R2 AFTER analysis, so we can use the local file for analysis
            # and R2 URL for storage
            final_url = None  # Will be set after R2 upload
            
        elif image_url:
            # Handle URL upload - simplified approach
            if not image_url.startswith(("http://", "https://")):
                raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")
            
            logger.info(f"===== Starting URL upload: {image_url} =====")
            
            # Try direct analysis first (fastest path for public URLs)
            logger.info("Attempting direct analysis...")
            features_list = None
            direct_analysis_succeeded = False
            try:
                features_list = await analyze_image(image_url)
                # Check if analysis actually succeeded (no error in features)
                if features_list and len(features_list) > 0:
                    # Check if there's an error in the first item
                    first_item = features_list[0]
                    logger.debug(f"Direct analysis result: {first_item}")
                    if "error" not in first_item and first_item.get("type") != "Unknown":
                        direct_analysis_succeeded = True
                        logger.info(f"✓ Direct analysis succeeded! Detected {len(features_list)} item(s)")
                    else:
                        error_msg = first_item.get("error", "Unknown error")
                        logger.warning(f"Direct analysis returned error: {error_msg}")
                        # Reset features_list to trigger fallback
                        features_list = None
                else:
                    logger.warning("Direct analysis returned empty result")
                    features_list = None
            except Exception as e:
                error_msg = str(e).lower()
                logger.warning(f"Direct analysis failed with exception: {e}, trying download approach...")
                
                # Fallback: Download, upload to R2, then analyze
                try:
                    # Download and upload to R2, then analyze
                    final_url = await _download_and_upload_image(image_url)
                    logger.info(f"✓ Image uploaded to R2: {final_url}")
                    
                    # Analyze with R2 URL
                    features_list = await analyze_image(final_url)
                    logger.info(f"✓ Analysis completed, detected {len(features_list)} item(s)")
                
                except requests.exceptions.HTTPError as e:
                    if e.response and e.response.status_code == 403:
                        raise HTTPException(
                            status_code=403,
                            detail=f"Image URL access denied (403 Forbidden). This is usually due to anti-scraping protection. Please try: 1) Use a different image URL, 2) Upload image file directly, or 3) Use a publicly accessible image URL."
                        )
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Failed to download image URL: {str(e)}. HTTP status code: {e.response.status_code if e.response else 'N/A'}. Please check if the URL is correct or if the network connection is normal."
                        )
                except requests.exceptions.Timeout as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Image URL download timeout (connection timeout 60s or read timeout 300s). This may be due to: \n1. Image file is too large\n2. Slow network connection\n3. Slow server response\n\nSuggestions:\n- Try using a different image URL\n- Upload image file directly\n- Check network connection"
                    )
                except requests.exceptions.RequestException as e:
                    error_detail = str(e)
                    # Handle timeout errors specifically
                    if "timeout" in error_detail.lower() or isinstance(e, requests.exceptions.Timeout):
                        error_detail = "Image URL download timeout. Please check if the URL is correct or if the network connection is normal."
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Failed to download image URL: {error_detail}. Please check if the URL is correct or if the network connection is normal."
                    )
                except Exception as e:
                    error_msg = str(e)
                    if "'Timeout' object is not subscriptable" in error_msg or "Timeout" in error_msg:
                        error_msg = "Image URL download timeout. Please check if the URL is correct or if the network connection is normal."
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error processing image URL: {error_msg}"
                    )
            
            # If direct analysis failed (either exception or returned error), we need to fallback to download approach
            if (not direct_analysis_succeeded or not features_list) and not final_url:
                logger.info("Direct analysis failed, falling back to download approach...")
                try:
                    # Download and upload to R2, then analyze
                    logger.info("Downloading image from URL...")
                    final_url = await _download_and_upload_image(image_url)
                    logger.info(f"✓ Image uploaded to R2: {final_url}")
                    
                    # Analyze with R2 URL
                    logger.info("Step 2: Analyzing image with R2 URL...")
                    features_list = await analyze_image(final_url)
                    logger.info(f"Analysis result: {features_list}")
                    
                    # Check if analysis succeeded
                    if features_list and len(features_list) > 0:
                        first_item = features_list[0]
                        if "error" in first_item or first_item.get("type") == "Unknown":
                            error_msg = first_item.get("error", "Unknown error")
                            logger.error(f"Analysis failed after fallback: {error_msg}")
                            raise HTTPException(
                                status_code=500,
                                detail=f"Image analysis failed: {error_msg}"
                            )
                        logger.info(f"✓ Analysis completed, detected {len(features_list)} item(s)")
                    else:
                        logger.error("Analysis returned empty result after fallback")
                        raise HTTPException(
                            status_code=500,
                            detail="Image analysis returned empty result"
                        )
                except HTTPException:
                    raise
                except requests.exceptions.HTTPError as e:
                    if e.response and e.response.status_code == 403:
                        raise HTTPException(
                            status_code=403,
                            detail=f"Image URL access denied (403 Forbidden). This is usually due to anti-scraping protection. Please try: 1) Use a different image URL, 2) Upload image file directly, or 3) Use a publicly accessible image URL."
                        )
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Failed to download image URL: {str(e)}. HTTP status code: {e.response.status_code if e.response else 'N/A'}. Please check if the URL is correct or if the network connection is normal."
                        )
                except requests.exceptions.Timeout as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Image URL download timeout (connection timeout 60s or read timeout 300s). This may be due to: \n1. Image file is too large\n2. Slow network connection\n3. Slow server response\n\nSuggestions:\n- Try using a different image URL\n- Upload image file directly\n- Check network connection"
                    )
                except requests.exceptions.RequestException as e:
                    error_detail = str(e)
                    if "timeout" in error_detail.lower() or isinstance(e, requests.exceptions.Timeout):
                        error_detail = "Image URL download timeout. Please check if the URL is correct or if the network connection is normal."
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Failed to download image URL: {error_detail}. Please check if the URL is correct or if the network connection is normal."
                    )
                except Exception as e:
                    error_msg = str(e)
                    import traceback
                    error_trace = traceback.format_exc()
                    logger.error(f"Fallback process failed: {error_msg}")
                    logger.error(f"Traceback:\n{error_trace}")
                    if "'Timeout' object is not subscriptable" in error_msg or "Timeout" in error_msg:
                        error_msg = "Image URL download timeout. Please check if the URL is correct or if the network connection is normal."
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error processing image URL: {error_msg}"
                    )
            
            # If direct analysis succeeded, we still need to download and store the image
            if direct_analysis_succeeded and not final_url:
                logger.info("Downloading image for storage...")
                final_url = await _download_and_upload_image(image_url)
                logger.info(f"✓ Image uploaded to R2: {final_url}")
            
            # Set image_url_to_analyze for consistency
            image_url_to_analyze = final_url if final_url else image_url
            
        else:
            raise HTTPException(status_code=400, detail="Either file or image_url must be provided")

        # For file uploads: upload to R2 first, then analyze (Qwen-VL API needs HTTP URL)
        if file:
            # Upload to R2 first, then analyze with R2 URL (Qwen-VL API can't access local file paths)
            temp_path = Path(image_url_to_analyze)
            if temp_path.exists():
                try:
                    # Check file size before processing (max 50MB)
                    file_size = temp_path.stat().st_size
                    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
                    if file_size > MAX_FILE_SIZE:
                        temp_path.unlink()  # Clean up
                        raise HTTPException(
                            status_code=400,
                            detail=f"File too large ({file_size / 1024 / 1024:.2f} MB). Maximum supported size is 50MB. Please use a smaller image or compress the image before uploading."
                        )
                    
                    logger.info(f"File size: {file_size / 1024 / 1024:.2f} MB")
                    
                    # Convert unsupported formats (AVIF, WebP, etc.) to JPEG
                    original_filename = file.filename
                    temp_path = _convert_unsupported_format(temp_path)
                    if temp_path.suffix.lower() == '.jpg':
                        # Update filename if converted
                        original_filename = temp_path.name
                        file_size = temp_path.stat().st_size  # Update file size after conversion
                    
                    from services.storage import upload_file_to_r2
                    content_type = file.content_type or "image/jpeg"
                    # If converted to JPEG, update content type
                    if temp_path.suffix.lower() == '.jpg':
                        content_type = "image/jpeg"
                    
                    logger.info("Uploading to R2 storage...")
                    
                    # Use file object directly for streaming upload (more memory efficient)
                    # Don't read entire file into memory for large files
                    with temp_path.open("rb") as f:
                        final_url = await upload_file_to_r2(f, original_filename, content_type)
                    logger.info(f"✓ Image uploaded to R2: {final_url}")
                    
                    # Clean up temp file
                    temp_path.unlink()
                    
                    # Now analyze using R2 URL (Qwen-VL API can access public R2 URLs)
                    logger.info("Analyzing uploaded file using R2 URL...")
                    features_list = await analyze_image(final_url)
                    logger.info(f"Analysis completed, detected {len(features_list)} item(s)")
                    
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"Failed to process file: {e}")
                    import traceback
                    error_trace = traceback.format_exc()
                    logger.error(f"Traceback:\n{error_trace}")
                    
                    # Clean up temp file on error
                    if temp_path.exists():
                        try:
                            temp_path.unlink()
                        except:
                            pass
                    
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to process file: {str(e)}"
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Temporary file does not exist, cannot upload to storage"
                )
        
        # Check if multiple items detected
        logger.info("Step 4/4: Processing results...")
        if len(features_list) > 1:
            # Multiple items - return for user confirmation
            logger.info(f"Multiple items detected ({len(features_list)}), returning for user confirmation")
            items = []
            for features in features_list:
                items.append({
                    "url": final_url,
                    "features": features,
                })
            logger.info("===== URL upload process completed (user confirmation needed) =====")
            return {
                "auto_added": False,
                "items": items,
            }
        else:
            # Single item - auto add
            features = features_list[0] if features_list else {}
            
            # Skip if there's an error in features
            if "error" in features:
                error_msg = str(features.get('error', ''))
                # Provide user-friendly error messages for common issues
                if "image format is illegal" in error_msg.lower() or "invalid_parameter_error" in error_msg.lower():
                    raise HTTPException(
                        status_code=400,
                        detail="Image format not supported. Qwen-VL API does not support formats like AVIF. The system has attempted automatic conversion, but it failed. Please try converting the image to JPEG or PNG format before uploading again."
                    )
                else:
                    raise HTTPException(status_code=500, detail=f"Image analysis failed: {error_msg}")
            
            # Add to vector database
            logger.info("Adding item to wardrobe database...")
            # Extract gender from features if present
            gender = features.get("gender")
            item_id = await add_to_wardrobe(final_url, features, user_id, gender=gender)
            logger.info(f"Step 4/4: Item added to wardrobe with ID: {item_id}")
            logger.info("===== URL upload process completed successfully =====")
            
            return {
                "auto_added": True,
                "items": [{
                    "id": item_id,
                    "url": final_url,
                    "features": features,
                }],
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Traceback:\n{error_trace}")
        
        # Provide more user-friendly error messages
        error_msg = str(e)
        if "'Timeout' object is not subscriptable" in error_msg:
            error_msg = "Image URL download timeout. Please check if the URL is correct or if the network connection is normal. If the image is large, please try using a different URL or upload the file directly."
        elif "SSL" in error_msg or "SSLError" in error_msg:
            error_msg = "Image URL access failed, possibly due to SSL connection issue. Please try using a different image URL or upload the file directly."
        elif "timeout" in error_msg.lower() or "Connection" in error_msg:
            error_msg = "Image URL access timeout or connection failed. Please check if the URL is correct or if the network is normal."
        elif "seek of closed file" in error_msg.lower():
            error_msg = "File processing error, please try again."
        elif "Failed to upload to R2" in error_msg:
            error_msg = f"Failed to upload to storage: {error_msg}"
        else:
            error_msg = f"Error processing image: {error_msg}"
        
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/items/batch")
async def batch_add_items(
    items: List[Dict[str, Any]],
    user_id: str = Depends(get_current_user),
):
    """
    Batch add multiple items to the wardrobe.
    Each item should have: url, features
    """
    try:
        added_items = []
        for item_data in items:
            if "error" in item_data.get("features", {}):
                continue  # Skip items with errors

            # Extract gender from features if present
            features = item_data.get("features", {})
            gender = features.get("gender") if isinstance(features, dict) else None
            
            item_id = await add_to_wardrobe(
                item_data["url"],
                features,
                user_id,
                gender=gender,
            )
            added_items.append(
                {
                    "id": item_id,
                    "url": item_data["url"],
                    "features": item_data["features"],
                    "user_id": user_id,
                }
            )

        return {"items": added_items}
    except Exception as e:
        print(f"Batch add failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/items")
async def get_items(user_id: str = Depends(get_current_user)):
    """
    Get all items belonging to the current user.
    """
    try:
        items = get_user_items(user_id)
        return {"items": items}
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Get Items] Failed to get items for user {user_id}: {e}")
        print(f"[Get Items] Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get wardrobe data: {str(e)}"
        )


@app.get("/items/{item_id}/image")
async def download_wardrobe_item_image(
    item_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Stream wardrobe image bytes for the owner (avoids browser CORS on R2).
    Used when attaching closet items to ChatKit as composer files.
    """
    from services.vector_db import get_wardrobe_item_image_url_for_user
    import httpx

    url = get_wardrobe_item_image_url_for_user(user_id, item_id)
    if not url:
        raise HTTPException(status_code=404, detail="Wardrobe item not found")

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(url)
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Image upstream returned HTTP {e.response.status_code}",
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {e!s}")

    content = resp.content
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large")

    raw_ct = (resp.headers.get("content-type") or "image/jpeg").split(";")[0].strip()
    media_type = raw_ct if raw_ct.startswith("image/") else "image/jpeg"
    return Response(content=content, media_type=media_type)


class DeleteItemsRequest(BaseModel):
    item_ids: List[str]


EXAMPLE_USER_EMAIL = "954504788@qq.com"


async def get_user_id_by_email(email: str) -> Optional[str]:
    """
    Get Supabase user ID by email.
    Requires SERVICE_ROLE_KEY permission to query auth.users table.
    """
    try:
        import httpx
        from services.supabase_client import create_supabase_client
        
        # Use service role key to query auth.users
        # Supabase Admin API endpoint
        supabase_url = os.getenv("SUPABASE_URL")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not service_role_key:
            logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
            return None
        
        # Use Supabase Admin API to list users and find by email
        # Note: Supabase Admin API uses GET /auth/v1/admin/users with query params
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                headers={
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                    "Content-Type": "application/json",
                },
                params={"page": 1, "per_page": 1000},  # Get up to 1000 users
            )
            
            if response.status_code == 200:
                users_data = response.json()
                users = users_data.get("users", [])
                
                # Find user by email
                for user in users:
                    if user.get("email") == email:
                        return user.get("id")
                
                logger.warning(f"User with email {email} not found")
                return None
            else:
                logger.error(f"Failed to query users: {response.status_code} - {response.text}")
                return None
                
    except Exception as e:
        logger.error(f"Failed to get user_id by email {email}: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.put("/items/{item_id}")
async def update_item(
    item_id: str,
    request: Dict[str, Any],
    user_id: str = Depends(get_current_user),
):
    """
    Update the features (type, color, style, etc.) of a wardrobe item.
    
    This endpoint only updates metadata fields and does NOT regenerate the embedding.
    Therefore, vector search results will remain unchanged, as vector search
    uses the image embedding which is based on visual features of the image itself,
    not the text metadata.
    
    Accepts a JSON body with the fields to update:
    {
        "features": {
            "type": "T-shirt",
            "color": "Blue",
            "style": "Casual",
            "pattern": "Solid",
            "occasion": "Daily",
            "material": "Cotton"
        }
    }
    """
    from services.vector_db import update_item_features
    
    if "features" not in request:
        raise HTTPException(status_code=400, detail="Missing 'features' field in request body")
    
    features = request["features"]
    
    try:
        success = await update_item_features(item_id, user_id, features)
        
        if success:
            return {
                "message": "Item updated successfully",
                "item_id": item_id
            }
        else:
            raise HTTPException(status_code=404, detail="Item not found or does not belong to user")
    except Exception as e:
        logger.error(f"[Update Item] Error updating item {item_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/items/delete")
async def delete_items(
    request: DeleteItemsRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    Delete items from the user's wardrobe.
    Accepts a list of item IDs to delete.
    
    This endpoint uses background tasks to delete items asynchronously,
    allowing the frontend to immediately update the UI while deletion
    happens in the background.
    """
    from services.vector_db import delete_user_items
    
    if not request.item_ids:
        return {
            "deleted_count": 0,
            "message": "No items to delete"
        }
    
    logger.info(f"[Delete Items] User {user_id} requesting to delete {len(request.item_ids)} items")
    
    # Add deletion task to background tasks
    # This allows the endpoint to return immediately while deletion happens in background
    async def delete_task():
        try:
            deleted_count = await delete_user_items(request.item_ids, user_id)
            logger.info(f"[Delete Items] Successfully deleted {deleted_count} items for user {user_id}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[Delete Items] Background deletion failed for user {user_id}: {error_msg}")
    
    background_tasks.add_task(delete_task)
    
    # Return immediately with accepted status
    # Frontend has already optimistically updated the UI
    return {
        "deleted_count": len(request.item_ids),  # Expected count (actual may differ)
        "message": f"Deletion started for {len(request.item_ids)} item(s)",
        "status": "accepted"
    }


@app.post("/items/import-examples")
async def import_example_items(
    gender: str = Form(...),  # "male", "female", or "both"
    user_id: str = Depends(get_current_user),
):
    """
    Import items from example account to current user's wardrobe.
    Supports filtering by gender: Man's, Women's, Unisex.
    Will copy original embedding to avoid regeneration.
    """
    if gender not in ["Man's", "Women's", "Unisex"]:
        raise HTTPException(status_code=400, detail="gender must be Man's, Women's, or Unisex")
    
    try:
        # 1. Get example account's user_id
        example_user_id = await get_user_id_by_email(EXAMPLE_USER_EMAIL)
        if not example_user_id:
            raise HTTPException(status_code=404, detail=f"Example account {EXAMPLE_USER_EMAIL} does not exist")
        
        logger.info(f"[Import Examples] Example user_id: {example_user_id}, Target gender: {gender}")
        
        # 2. Get all items from example account (including embedding)
        example_items = get_user_items_with_embedding(example_user_id)
        
        if not example_items:
            return {
                "message": "Example account has no item data",
                "imported_count": 0,
                "skipped_count": 0
            }
        
        logger.info(f"[Import Examples] Found {len(example_items)} items in example account")
        
        # 3. Filter by gender
        filtered_items = [
            item for item in example_items 
            if item.get("gender", "Unisex") == gender or item.get("gender", "Unisex") == "Unisex"
        ]
        
        if not filtered_items:
            gender_label = "Men's" if gender == "Man's" else "Women's" if gender == "Women's" else "Unisex"
            return {
                "message": f"Example account has no {gender_label} items",
                "imported_count": 0,
                "skipped_count": 0
            }
        
        logger.info(f"[Import Examples] Filtered to {len(filtered_items)} items matching gender {gender}")
        
        # 4. Check if current user already has items with same image_url (deduplication)
        existing_items = get_user_items(user_id)
        existing_urls = {item.get("path") or item.get("image_url") for item in existing_items if item.get("path") or item.get("image_url")}
        
        logger.info(f"[Import Examples] Found {len(existing_urls)} existing items in target user's wardrobe")
        
        # 5. Batch import to current user (copy embedding)
        imported_count = 0
        skipped_count = 0
        
        for item in filtered_items:
            image_url = item.get("image_url")
            
            # Skip existing items
            if image_url in existing_urls:
                skipped_count += 1
                continue
            
            # Rebuild features dictionary
            features = {
                "type": item.get("type"),
                "color": item.get("color"),
                "style": item.get("style"),
                "occasion": item.get("occasion"),
                "pattern": item.get("pattern"),
                "material": item.get("material"),
                "description": item.get("description"),
                "gender": item.get("gender", "Unisex"),
            }
            
            # Get original embedding
            embedding = item.get("embedding")
            
            # Add to current user (using original embedding)
            try:
                await add_to_wardrobe(
                    image_path=image_url,
                    features=features,
                    user_id=user_id,
                    gender=item.get("gender", "Unisex"),
                    embedding=embedding  # Use original embedding
                )
                imported_count += 1
                logger.debug(f"[Import Examples] Imported item {item.get('id')}: {item.get('type')}")
            except Exception as e:
                logger.error(f"[Import Examples] Failed to import item {item.get('id')}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        gender_label = "Men's" if gender == "Man's" else "Women's" if gender == "Women's" else "Unisex"
        message = f"Successfully imported {imported_count} {gender_label} items"
        if skipped_count > 0:
            message += f", skipped {skipped_count} duplicate items"
        
        logger.info(f"[Import Examples] Import completed: {imported_count} imported, {skipped_count} skipped")
        
        return {
            "message": message,
            "imported_count": imported_count,
            "skipped_count": skipped_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Import Examples] Failed to import example items: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@app.post("/studio/intent-garment-crops")
async def studio_intent_garment_crops(body: IntentGarmentCropsRequest):
    """
    Return R2 URLs of **cropped** garment tiles guided by the user's message (e.g. 裙子 vs 抹胸).
    Used by the Studio chat left rail — not raw uploads.
    """
    from services.garment_vl_pipeline import intent_preview_crops

    urls = [u.strip() for u in body.image_urls if isinstance(u, str) and u.strip()][:5]
    if not urls:
        return {"crops": []}
    intent = (body.intent_text or "").strip()
    if not intent:
        intent = (
            "Identify garment pieces in the image for virtual try-on; "
            "one box per distinct top, bottom, or dress."
        )
    try:
        crops = await intent_preview_crops(urls, intent)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("[studio/intent-garment-crops] failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    return {"crops": crops}


@app.post("/chatkit")
async def chatkit_endpoint(
    request: Request,
    auth: tuple = Depends(get_optional_user_and_token),
):
    """
    OpenAI ChatKit protocol endpoint: multi-turn chat with Agents SDK orchestration.
    The chat model decides when to call server tools (e.g. outfit generation); optional
    `X-Fashion-Rec-Outfit-Context` supplies Studio-aligned fields when tools run.
    Response shape matches the ChatKit starter POST /chatkit (StreamingResult, JSON body, etc.).
    """
    user_id, access_token = auth
    payload = await request.body()
    outfit_ctx = parse_outfit_context_from_request(request)
    ctx: Dict[str, Any] = {
        "request": request,
        "user_id": user_id,
        # Cookie auth has no Authorization header; tools calling /try-on, /generate-angles need this.
        "access_token": access_token,
    }
    if outfit_ctx:
        ctx["outfit_context"] = outfit_ctx
    result = await fashion_chatkit_server.process(payload, ctx)
    if isinstance(result, StreamingResult):
        return StreamingResponse(result, media_type="text/event-stream")
    if hasattr(result, "json"):
        return Response(content=result.json, media_type="application/json")
    return JSONResponse(result)


_MAX_CHATKIT_UPLOAD_BYTES = 20 * 1024 * 1024


@app.post("/chatkit/upload")
async def chatkit_direct_upload(
    request: Request,
    auth: tuple = Depends(get_optional_user_and_token),
):
    """
    ChatKit direct upload strategy: multipart/form-data field `file`.
    See https://github.com/openai/chatkit-python/blob/main/docs/guides/accept-rich-user-input.md
    """
    _user_id, _ = auth
    form = await request.form()
    upload = form.get("file")
    if upload is None:
        raise HTTPException(status_code=400, detail="Missing file field")
    if not hasattr(upload, "read"):
        raise HTTPException(status_code=400, detail="Invalid file field")
    content = await upload.read()
    if len(content) > _MAX_CHATKIT_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")
    filename = getattr(upload, "filename", None) or "upload"
    content_type = getattr(upload, "content_type", None) or "application/octet-stream"

    aid = chatkit_default_generate_id("attachment")
    base = str(request.base_url).rstrip("/")
    store = fashion_chatkit_server.store
    store.put_attachment_blob(aid, content)

    if content_type.startswith("image/"):
        preview_url = f"{base}/chatkit/attachments/{aid}/preview"
        att = ImageAttachment(
            id=aid,
            name=filename,
            mime_type=content_type,
            preview_url=preview_url,
        )
    else:
        att = FileAttachment(id=aid, name=filename, mime_type=content_type)

    await store.save_attachment(att, {})
    return Response(content=att.model_dump_json(), media_type="application/json")


@app.get("/chatkit/attachments/{attachment_id}/preview")
async def chatkit_attachment_preview(attachment_id: str):
    """Image preview for ChatKit; used as img src (typically no Authorization header)."""
    store = fashion_chatkit_server.store
    try:
        meta = await store.load_attachment(attachment_id, {})
    except ChatKitNotFoundError:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if meta.type != "image":
        raise HTTPException(status_code=404, detail="Not an image")
    blob = store.get_attachment_blob(attachment_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Empty attachment")
    return Response(content=blob, media_type=meta.mime_type)


@app.get("/chatkit/sessions")
async def chatkit_sessions_list(
    limit: int = Query(20, ge=1, le=100),
    after: str | None = None,
    user_id: str = Depends(get_current_user),
):
    """List ChatKit threads for the current user (metadata.user_id), for Studio history UI."""
    store = fashion_chatkit_server.store
    ctx: Dict[str, Any] = {"user_id": user_id}
    page = await store.load_threads(limit=limit, after=after, order="desc", context=ctx)
    threads_out: list[Dict[str, Any]] = []
    for t in page.data:
        title = t.title
        if not title:
            title = await first_user_message_preview(store, t.id, context=ctx)
        threads_out.append(
            {
                "thread_id": t.id,
                "created_at": t.created_at.isoformat(),
                "title": title or "—",
            }
        )
    return {"threads": threads_out, "has_more": page.has_more, "after": page.after}


@app.get("/chatkit/sessions/{thread_id}/items")
async def chatkit_session_items(
    thread_id: str,
    user_id: str = Depends(get_current_user),
):
    """Thread items for hydrating the UI; same store as Agents/Grok multi-turn context."""
    store = fashion_chatkit_server.store
    ctx: Dict[str, Any] = {"user_id": user_id}
    try:
        meta = await store.load_thread(thread_id, ctx)
    except ChatKitNotFoundError:
        raise HTTPException(status_code=404, detail="Thread not found")
    if not thread_owned_by_user(meta, user_id):
        raise HTTPException(status_code=404, detail="Thread not found")
    page = await store.load_thread_items(thread_id, None, 500, "asc", ctx)
    visible = filter_visible_items(list(page.data))
    bg_map = (meta.metadata or {}).get("fashion_rec_message_backgrounds") or {}
    items_out: list[Dict[str, Any]] = []
    for i in visible:
        d = i.model_dump(mode="json")
        if d.get("type") == "user_message" and isinstance(bg_map, dict):
            extra = bg_map.get(str(d.get("id")))
            if isinstance(extra, dict):
                bu = (extra.get("background_image_url") or "").strip()
                if bu:
                    bp = (extra.get("background_action_prompt") or "").strip()
                    d["metadata"] = {
                        "background_image_url": bu,
                        "background_action_prompt": bp,
                    }
        items_out.append(d)
    return {
        "thread_id": thread_id,
        "items": items_out,
    }


@app.post("/outfit")
async def generate_outfit(
    request: OutfitAgentRequest,
    http_request: Request,
    auth: tuple = Depends(get_optional_user_and_token),
):
    """
    Generate outfit recommendations using the outfit agent.
    Images are optimized to 800px resolution using Cloudflare Image Resize before being passed to the model.
    R2 still stores original images.
    Guest (no auth): allowed with IP-based limit of 100/day. Uses empty wardrobe.
    """
    from services.outfit_agent import generate_outfit_suggestions

    user_id, _ = auth
    if user_id is None:
        allowed, remaining, limit = check_and_consume_outfit(http_request)
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail="Guest outfit recommendation limit reached for today (100 per IP). Sign in for more.",
            )
        user_id = "guest"  # empty wardrobe for outfit_agent

    try:
        # Optimize image URLs to 800px resolution using Cloudflare Image Resize
        # R2 stores original images, but we resize when passing to models
        optimized_background_url = _optimize_image_url_for_model(request.background_image_url, width=800, quality=85)
        optimized_model_url = _optimize_image_url_for_model(request.model_image_url, width=800, quality=85)
        
        result = await generate_outfit_suggestions(
            user_id=user_id,
            location=request.location,
            user_prompt=request.prompt,
            base_item_ids=request.base_item_ids,
            background_image_url=optimized_background_url,
            background_action_prompt=request.background_action_prompt,
            model_image_url=optimized_model_url,
            client_ip=get_guest_client_ip(http_request),
            selected_items_roles=request.selected_items_roles,
            model=request.model or "qwen",
        )
        
        # #region agent log
        try:
            with open('d:\\source_code\\fashion\\.cursor\\debug.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"run1","hypothesisId":"A","location":"main.py:generate_outfit:after_call","message":"After generate_outfit_suggestions call","data":{"optimized_bg_passed":optimized_background_url,"optimized_model_passed":optimized_model_url},"timestamp":int(__import__('time').time()*1000)})+'\n')
        except: pass
        # #endregion

        # Return in agent mode format
        return {
            "mode": "agent",
            "weather_summary": result.get("weather_summary", ""),
            "wardrobe_count": result.get("wardrobe_count", 0),
            "outfits": result.get("outfits", []),
            "raw_text": result.get("raw_text", ""),
        }
    except Exception as e:
        import traceback

        error_msg = str(e)
        
        # Check if it's an API key related error
        if "API key" in error_msg or "invalid_api_key" in error_msg or "401" in error_msg or "DASHSCOPE_API_KEY" in error_msg:
            logger.error(f"API key authentication error: {e}")
            raise HTTPException(
                status_code=500, 
                detail="API key configuration error. Singapore endpoint must use DASHSCOPE_API_KEY_SG, Beijing endpoint must use DASHSCOPE_API_KEY. Please check if environment variables are correctly set."
            )
        
        print(f"Error generating outfit: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate outfit: {e}")


def _http_url_targets_loopback(url: str) -> bool:
    """True when host is loopback. System HTTP/SOCKS proxy must not be used (requests honors env even if session.proxies is None)."""
    try:
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").lower()
        if host in ("localhost", "127.0.0.1", "::1"):
            return True
        if host.startswith("127."):
            return True
        return False
    except Exception:
        return False


def _chatkit_attachment_id_from_preview_url(url: str) -> str | None:
    """Parse .../chatkit/attachments/{id}/preview → attachment id."""
    try:
        from urllib.parse import urlparse

        parts = [p for p in urlparse(url).path.split("/") if p]
        if len(parts) >= 4 and parts[0] == "chatkit" and parts[1] == "attachments" and parts[-1] == "preview":
            return parts[2]
    except Exception:
        pass
    return None


def _try_load_tryon_image_bytes_from_local_chatkit(url: str) -> bytes | None:
    """
    /try-on may receive ChatKit preview URLs pointing at this same uvicorn process.
    build_garment_collage uses synchronous requests.get; inside async try_on that blocks the event loop,
    so the GET is never served → ReadTimeout. Read bytes from MemoryStore instead.
    """
    aid = _chatkit_attachment_id_from_preview_url(url)
    if not aid:
        return None
    return fashion_chatkit_server.store.get_attachment_blob(aid)


@app.post("/try-on")
async def try_on(
    request: Request,
    person_image: Optional[UploadFile] = File(None),
    person_image_url: Optional[str] = Form(None),
    garment_urls: str = Form(...),
    unmatched_descriptions: Optional[str] = Form(None),
    background_image_url: Optional[str] = Form(None),
    background_action_prompt: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    auth: tuple = Depends(get_optional_user_and_token),
):
    """
    Virtual try-on:
    - garment_urls: JSON-encoded list of garment image URLs (Image 1, garment collage)
    - person_image: the model photo (Image 2) as uploaded file (optional)
    - person_image_url: the model photo (Image 2) as URL (optional)
    - background_image_url: the background image (Image 3) as URL (optional)

    Image order: Image 1 (garment collage) → Image 2 (model photo) → Image 3 (background, optional)
    At least one of person_image or person_image_url must be provided.
    Guest (no auth): allowed with IP-based limit of 3/day. No history saved.
    """
    from services.qwen_image_edit import (
        QwenImageEditClient,
        QwenImageEditError,
        _load_env_config,
    )
    from services.xai_tryon_fallback import (
        looks_like_dashscope_content_block,
        tryon_xai_fallback_enabled,
        tryon_xai_fallback_on_any_qwen_error,
        virtual_tryon_via_xai_imagine,
    )
    from services.storage import upload_file_to_r2
    import httpx

    user_id, user_token = auth
    if user_id is None:
        allowed, remaining, limit = check_and_consume_tryon(request)
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail="Guest try-on limit reached for today (3 per IP). Sign in for more.",
            )
        effective_user_id = f"guest_{get_guest_client_ip(request).replace('.', '_')}"
    else:
        effective_user_id = user_id

    # Check and consume try-on count (subscription-service) for logged-in users only
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    user_plan = "free"  # Default to free plan
    if user_id is not None:
        try:
            async with httpx.AsyncClient() as client:
                status_response = await client.get(
                    f"{SUBSCRIPTION_SERVICE_URL}/userinfo",
                    params={"user_id": user_id},
                    timeout=5.0
                )
                if status_response.is_success:
                    status_data = status_response.json()
                    plan_name = status_data.get("planName", "Free").lower()
                    if "premium plus" in plan_name or "premium_plus" in plan_name:
                        user_plan = "premium_plus"
                    elif "premium pro" in plan_name or "premium_pro" in plan_name:
                        user_plan = "premium_pro"
                    elif "premium" in plan_name:
                        user_plan = "premium"
                    else:
                        user_plan = "free"

                response = await client.post(
                    f"{SUBSCRIPTION_SERVICE_URL}/subscription/check-try",
                    json={"user_id": user_id},
                    timeout=5.0
                )
                if response.status_code == 403:
                    raise HTTPException(status_code=403, detail=response.json().get("error", "Insufficient try-on count"))
                elif not response.is_success:
                    raise HTTPException(status_code=500, detail="Failed to check try-on count")
        except httpx.RequestError as e:
            logger.warning(f"Failed to check subscription service: {e}, allowing try-on to proceed")

    # Parse garment URLs
    try:
        garment_list = json.loads(garment_urls)
        if not isinstance(garment_list, list):
            raise ValueError("garment_urls must be a JSON list of URLs")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid garment_urls: {e}")

    _kinds = [garment_url_kind_for_tryon_log(u) for u in garment_list]
    _chatkit_n = sum(1 for k in _kinds if k == "chatkit_preview_full_frame")
    logger.info(
        "[Try-On][Qwen Image 2.0] garment collage input (Image 1): n=%s chatkit_preview_full_frame=%s "
        "kinds=%s urls=%s",
        len(garment_list),
        _chatkit_n,
        _kinds,
        json.dumps(garment_list, ensure_ascii=False),
    )
    print(
        f"[Try-On][Qwen Image 2.0] garment tile URLs ({len(garment_list)}): "
        f"{json.dumps(garment_list, ensure_ascii=False)}"
    )

    # Parse unmatched_descriptions (items with no wardrobe image; use text in prompt)
    parsed_unmatched: List[Dict[str, str]] = []
    if unmatched_descriptions:
        try:
            raw = json.loads(unmatched_descriptions)
            if isinstance(raw, list):
                parsed_unmatched = [
                    {"role": str(x.get("role", "")), "description": str(x.get("description", ""))}
                    for x in raw if isinstance(x, dict)
                ]
        except Exception:
            pass

    if not garment_list and not parsed_unmatched:
        raise HTTPException(
            status_code=400,
            detail="Either garment_urls or unmatched_descriptions must be provided and non-empty",
        )

    # Determine person image input (local file path or URL)
    if not person_image and not person_image_url:
        raise HTTPException(status_code=400, detail="Either person_image file or person_image_url must be provided")

    person_input: str  # This will be used as the first image input for Qwen Image Edit
    output_path: Path

    if person_image:
        # Save person image to a temporary file
        try:
            person_filename = f"person_{effective_user_id}_{person_image.filename}"
            person_path = UPLOAD_DIR / "tryon" / person_filename
            person_path.parent.mkdir(parents=True, exist_ok=True)

            # Reset file pointer to beginning (in case it was read before)
            person_image.file.seek(0)

            with person_path.open("wb") as buffer:
                shutil.copyfileobj(person_image.file, buffer)

            # Verify file was saved correctly
            if not person_path.exists() or person_path.stat().st_size == 0:
                raise RuntimeError(f"Person image file was not saved correctly: {person_path}")

            print(f"[Try-On] Saved person image: {person_path} ({person_path.stat().st_size} bytes)")
        except Exception as e:
            import traceback

            print(f"[Try-On] Error saving person image: {e}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to save person image: {e}")

        person_input = str(person_path)
        output_path = person_path.with_name(person_path.stem + "_tryon.png")
        person_img_path = person_path  # Store for resolution calculation
    else:
        # Use URL directly for person image
        person_input = person_image_url  # type: ignore[assignment]
        # Ensure output directory exists
        output_path = UPLOAD_DIR / "tryon" / f"tryon_{effective_user_id}.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        person_img_path = None  # Will use URL for resolution calculation

    # Determine output resolution - default to 2K for all users
    # Calculate 2K resolution while maintaining aspect ratio
    output_size = None
    # Get person image dimensions to maintain aspect ratio
    try:
        person_width, person_height = None, None
        
        if person_img_path and Path(person_img_path).exists():
            # Get dimensions from local file
            with Image.open(person_img_path) as img:
                person_width, person_height = img.size
        elif person_image_url:
            # Get dimensions from URL
            try:
                client_kw: Dict[str, Any] = {}
                if _http_url_targets_loopback(person_image_url):
                    client_kw["trust_env"] = False
                async with httpx.AsyncClient(**client_kw) as client:
                    resp = await client.get(person_image_url, timeout=10.0)
                    if resp.status_code == 200:
                        img = Image.open(BytesIO(resp.content))
                        person_width, person_height = img.size
            except Exception as e:
                logger.warning(f"Failed to get image dimensions from URL: {e}, using default aspect ratio")
        
        # Calculate 2K resolution maintaining aspect ratio
        # Target: max dimension = 2048, maintain aspect ratio
        if person_width and person_height:
            aspect_ratio = person_width / person_height
            max_dimension = 2048
            
            if aspect_ratio >= 1:  # Landscape or square
                # Width is larger or equal
                width = min(max_dimension, int(max_dimension * aspect_ratio))
                height = min(max_dimension, int(max_dimension / aspect_ratio))
            else:  # Portrait
                # Height is larger
                height = min(max_dimension, int(max_dimension / aspect_ratio))
                width = min(max_dimension, int(max_dimension * aspect_ratio))
            
            # Ensure dimensions are within API limits [512, 2048]
            width = max(512, min(2048, width))
            height = max(512, min(2048, height))
            
            output_size = f"{width}*{height}"
            logger.info(f"[Try-On] Using 2K resolution {output_size} (maintaining aspect ratio {aspect_ratio:.2f})")
        else:
            # Fallback to square 2K if dimensions unavailable
            output_size = "2048*2048"
            logger.info(f"[Try-On] Using default 2K resolution {output_size} (could not determine input aspect ratio)")
    except Exception as e:
        # Fallback to square 2K on error
        output_size = "2048*2048"
        logger.warning(f"[Try-On] Failed to calculate aspect-ratio-preserving resolution: {e}, using default {output_size}")

    # Prepare Qwen Image Edit client
    try:
        env_config = _load_env_config()
        api_key = env_config.get("api_key")
        if not api_key:
            raise RuntimeError(
                "DASHSCOPE_API_KEY or QWEN_IMAGE_EDIT_API_KEY must be set in environment"
            )
        client = QwenImageEditClient(**env_config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Qwen Image Edit config error: {e}")

    # Build composite garment image (Image 1) by merging all garment images into a grid
    def build_garment_collage(urls: List[str], output_path: Path) -> Path:
        images: List[Image.Image] = []
        failed_urls: List[Dict[str, str]] = []
        
        if not urls:
            raise RuntimeError("No garment URLs provided for collage")
        
        # Detect if it's an R2 URL
        R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")
        is_r2_url = R2_PUBLIC_URL and urls[0].startswith(R2_PUBLIC_URL) if urls else False
        if not is_r2_url:
            # Determine by domain (r2.dev)
            is_r2_url = any("r2.dev" in url for url in urls)
        
        # Create Session and configure proxy
        # Note: Production environment overseas does not need proxy, development environment may need proxy
        # Controlled by R2_USE_PROXY environment variable (default False, production environment does not need to set)
        session = requests.Session()
        use_proxy = os.getenv("R2_USE_PROXY", "false").lower() in ("true", "1", "yes")
        
        if is_r2_url and use_proxy:
            # Only use proxy when explicitly configured (development environment)
            # Supports two proxy configuration methods:
            # 1. HTTP_PROXY/HTTPS_PROXY (standard format, e.g., http://proxy:port)
            # 2. PROXY_HOST/PROXY_PORT (custom format, build as socks5://host:port)
            proxies = {}
            
            # Method 1: Use HTTP_PROXY/HTTPS_PROXY (standard format)
            http_proxy = os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
            https_proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
            
            if http_proxy or https_proxy:
                proxies["http"] = http_proxy
                proxies["https"] = https_proxy
            else:
                # Method 2: Use PROXY_HOST/PROXY_PORT (build proxy URL)
                proxy_host = os.getenv("PROXY_HOST")
                proxy_port = os.getenv("PROXY_PORT")
                
                if proxy_host and proxy_port:
                    # Default to SOCKS5 proxy (port 10808 is usually SOCKS5)
                    # If HTTP proxy is needed, can specify via PROXY_TYPE environment variable (e.g., http, https, socks5)
                    proxy_type = os.getenv("PROXY_TYPE", "socks5").lower()
                    proxy_url = f"{proxy_type}://{proxy_host}:{proxy_port}"
                    proxies["http"] = proxy_url
                    proxies["https"] = proxy_url
                    
                    # If using SOCKS proxy, PySocks needs to be installed
                    if proxy_type.startswith("socks"):
                        try:
                            import socks
                        except ImportError:
                            print(f"[Try-On] WARNING: SOCKS proxy requires PySocks. Install with: uv add PySocks")
                            # Try using HTTP proxy format (some proxy servers support this)
                            proxy_url = f"http://{proxy_host}:{proxy_port}"
                            proxies["http"] = proxy_url
                            proxies["https"] = proxy_url
            
            # If proxy is configured, use it; otherwise use system proxy (requests will auto-detect)
            if proxies.get("http") or proxies.get("https"):
                session.proxies = proxies
                print(f"[Try-On] Using proxy for R2 URLs: {proxies}")
            else:
                # Use system proxy (requests will auto-detect)
                print(f"[Try-On] Using system proxy for R2 URLs (auto-detected)")
        else:
            # Non-R2: no explicit session proxies; requests may still use HTTP_PROXY from env (see loopback branch).
            session.proxies = None
            if is_r2_url:
                print(f"[Try-On] R2_USE_PROXY not enabled, using direct connection for R2 URLs")
        
        print(f"[Try-On] Attempting to download {len(urls)} garment images...")
        
        for idx, url in enumerate(urls):
            try:
                print(f"[Try-On] Downloading garment image {idx + 1}/{len(urls)}: {url[:80]}...")
                local_blob = _try_load_tryon_image_bytes_from_local_chatkit(url)
                if local_blob:
                    img = Image.open(BytesIO(local_blob)).convert("RGBA")
                    if img.size[0] == 0 or img.size[1] == 0:
                        raise ValueError("Invalid image dimensions")
                    images.append(img)
                    print(
                        f"[Try-On] Loaded garment image {idx + 1}/{len(urls)} from in-process ChatKit store (no HTTP)"
                    )
                    continue
                if _http_url_targets_loopback(url):
                    # Bypass HTTP_PROXY/ALL_PROXY — SOCKS to 127.0.0.1:8001 often hangs/timeouts.
                    # trust_env is a Session attribute, not a request() kwarg.
                    with requests.Session() as lb_sess:
                        lb_sess.trust_env = False
                        resp = lb_sess.get(
                            url,
                            timeout=30,
                            verify=False,
                            proxies={"http": None, "https": None},
                        )
                else:
                    resp = session.get(url, timeout=15, verify=False)
                resp.raise_for_status()
                
                # Check if response has content
                if not resp.content:
                    raise ValueError("Empty response content")
                
                # Try to open as image
                img = Image.open(BytesIO(resp.content)).convert("RGBA")
                
                # Verify image is valid
                if img.size[0] == 0 or img.size[1] == 0:
                    raise ValueError("Invalid image dimensions")
                
                images.append(img)
                print(f"[Try-On] Successfully downloaded garment image {idx + 1}/{len(urls)}")
            except requests.exceptions.RequestException as e:
                error_msg = f"HTTP error: {type(e).__name__} - {str(e)}"
                print(f"[Try-On] Failed to download garment image {idx + 1}/{len(urls)} ({url[:80]}...): {error_msg}")
                failed_urls.append({"url": url, "error": error_msg})
            except Exception as e:
                error_msg = f"{type(e).__name__}: {str(e)}"
                print(f"[Try-On] Failed to process garment image {idx + 1}/{len(urls)} ({url[:80]}...): {error_msg}")
                failed_urls.append({"url": url, "error": error_msg})

        if not images:
            error_details = {
                "total_urls": len(urls),
                "failed_count": len(failed_urls),
                "failed_urls": failed_urls[:5]  # Limit to first 5 for readability
            }
            error_msg = (
                f"No valid garment images for collage. "
                f"Attempted {len(urls)} URLs, all failed. "
                f"First few failures: {failed_urls[:3]}"
            )
            print(f"[Try-On] ERROR: {error_msg}")
            raise RuntimeError(error_msg)
        
        print(f"[Try-On] Successfully downloaded {len(images)}/{len(urls)} garment images")
        if failed_urls:
            print(f"[Try-On] Warning: {len(failed_urls)} images failed to download")

        # Normalize size: slightly larger tiles when only a few garments so skirts/details stay visible to the edit model
        n_imgs = len(images)
        thumb_w, thumb_h = (384, 384) if n_imgs <= 2 else (256, 256)
        thumbs = [img.resize((thumb_w, thumb_h), Image.LANCZOS) for img in images]

        # Simple grid: up to 3 columns
        cols = min(3, len(thumbs))
        rows = (len(thumbs) + cols - 1) // cols

        collage_w = cols * thumb_w
        collage_h = rows * thumb_h

        collage = Image.new("RGBA", (collage_w, collage_h), (255, 255, 255, 0))

        for idx, thumb in enumerate(thumbs):
            r = idx // cols
            c = idx % cols
            x = c * thumb_w
            y = r * thumb_h
            collage.paste(thumb, (x, y), mask=thumb)

        collage_path = output_path
        collage_path.parent.mkdir(parents=True, exist_ok=True)
        # PNG format doesn't support quality parameter
        collage.convert("RGB").save(collage_path, format="PNG")

        # Verify collage was saved correctly
        if not collage_path.exists() or collage_path.stat().st_size == 0:
            raise RuntimeError(f"Garment collage was not saved correctly: {collage_path}")

        print(f"[Try-On] Saved garment collage: {collage_path} ({collage_path.stat().st_size} bytes)")
        return collage_path

    # Save user's custom prompt before it gets overwritten by system prompt
    user_custom_prompt = prompt  # This is the user's original input from Form parameter

    # Build unmatched-descriptions section for prompt (text-only garment items)
    unmatched_desc_section = ""
    if parsed_unmatched:
        lines = [f"- {x['role']}: {x['description']}" for x in parsed_unmatched if x.get("description")]
        if lines:
            unmatched_desc_section = (
                "\nAdditionally, the person must wear these items (described by text, not shown in any garment image):\n"
                + "\n".join(lines)
                + "\n"
            )

    multi_garment_section = ""
    if len(garment_list) > 1:
        multi_garment_section = (
            "\nMULTI-GARMENT: Image 1 is a collage of separate garment or reference photos in a grid. "
            "Each region may show a different item (top, skirt, pants, dress, etc.). "
            "Apply **every** distinct garment visible in Image 1 onto the model in Image 2: "
            "replace upper-body clothing with tops from the collage, and **fully replace** lower-body clothing "
            "(trousers, shorts, or an existing skirt) with any bottom garment clearly shown in Image 1. "
            "Do not stop after changing only the top — if both a top and a bottom appear in Image 1, the output must show both.\n"
        )

    # Qwen often "pastes" a new skirt/shorts on top of old long pants; force true replacement, not stacking.
    replace_clothing_section = ""
    if garment_list or parsed_unmatched:
        replace_clothing_section = (
            "\nCLOTHING REPLACEMENT (critical): Remove the model's **original** garment in each body region before drawing the new one. "
            "New bottoms from Image 1 must **replace** prior pants/skirts/shorts — the old lower-body fabric must disappear, "
            "not remain visible under a new skirt or shorts (no trousers-under-skirt, no double-layer legs). "
            "Same for tops: replace the prior shirt/top unless Image 1 explicitly shows intentional layering. "
            "The final outfit must look like a single coherent layer, not stacked or pasted clothing.\n"
        )

    user_hint_section = ""
    if user_custom_prompt and str(user_custom_prompt).strip():
        user_hint_section = (
            "\nUser request (must honor): " + str(user_custom_prompt).strip() + "\n"
        )

    tryon_extra_text = (
        multi_garment_section + replace_clothing_section + user_hint_section
    )

    _tryon_layering_negative = (
        "Prohibit long pants or jeans visible under a skirt, dress, or new shorts; "
        "prohibit stacked duplicate bottoms; prohibit the model's original trousers showing beneath new lower-body garments; "
        "prohibit pasted or floating clothing layers."
    )

    action_description_section = ""
    if background_action_prompt:
        action_description_section = f"Image 2 Action/Pose: The model should be performing this action: \"{background_action_prompt}\". The person's pose and body position should match this activity description."
        logger.info(f"[Try-On] Background action prompt received: {background_action_prompt}")
    else:
        logger.info("[Try-On] No background action prompt provided")

    image_inputs: List[Any]
    prompt: str
    negative_prompt: str
    garment_collage_index: Optional[int]

    try:
        if garment_list:
            garments_collage_path = UPLOAD_DIR / "tryon" / f"garments_{effective_user_id}_collage.png"
            garments_collage_path = build_garment_collage(garment_list, garments_collage_path)
            logger.info(
                "[Try-On][Qwen Image 2.0] stitched garment collage (Image 1) path=%s from %d tile(s)",
                garments_collage_path,
                len(garment_list),
            )
            print(
                f"[Try-On][Qwen Image 2.0] stitched garment collage (Image 1): {garments_collage_path} "
                f"(from {len(garment_list)} tile URL(s))"
            )

            garment_items = get_items_by_urls(garment_list, effective_user_id) if user_id is not None else []
            garment_descriptions = []
            for item in garment_items:
                if item.get("id") and item.get("description"):
                    garment_descriptions.append(item["description"])
            garment_desc_text = ""
            if garment_descriptions:
                garment_desc_text = f"\nItem details in Image 1:\n" + "\n".join([f"- {d}" for d in garment_descriptions]) + "\n"
            garment_desc_text += unmatched_desc_section

            image_inputs = [garments_collage_path, person_input]
            if background_image_url:
                image_inputs.append(background_image_url)
            if background_image_url:
                prompt = (
                    "Use the person from Image 2 (model photo), have this person wear all clothes and accessories from Image 1, "
                    "then place this person wearing new clothes in the background shown in Image 3. "
                    + action_description_section
                    + " Keep Image 3's environment and background as the final background, only use Image 3's background elements, "
                    "the person must come from Image 2, do not use any person from Image 3. "
                    "All items must be correctly worn on the model: "
                    "Tops and bottoms must be worn on the corresponding body positions, shoes must be worn on feet, "
                    "outerwear must be worn on the outer layer, accessories like glasses must be worn on the face, hats on the head, "
                    "bags on the shoulder or held in hand. "
                    "Prohibit any items floating in the air or scattered on the ground. "
                    "CRITICAL: Pay careful attention to perspective and spatial consistency. "
                    "The model's perspective, scale, and pose must match the background's perspective and vanishing points. "
                    "The model's size and proportions are consistent with the background's depth and scale. "
                    "Avoid perspective distortion - the model should appear naturally integrated into the background scene with correct foreshortening and spatial relationships. "
                    "Overall image should be harmonious, natural, with consistent lighting, proper perspective alignment, and all items should fit the human body correctly."
                    + garment_desc_text
                    + tryon_extra_text
                )
                negative_prompt = (
                    "Prohibit person from Image 1, prohibit person from Image 3. Prohibit items floating in the air. "
                    "Prohibit shoes, glasses, accessories scattered on the ground or in the air. "
                    "All items must be correctly worn on the model. "
                    "Prohibit perspective distortion, mismatched scale, incorrect vanishing points, model floating above ground, "
                    "inconsistent depth perception, warped backgrounds, unnatural spatial relationships. "
                    + _tryon_layering_negative
                )
            else:
                prompt = (
                    "Person from Image 2 wearing all clothes and accessories from Image 1, keep person identity and original background natural and reasonable, "
                    "only replace clothing, do not remove or replace Image 2's background. "
                    "All items must be correctly worn on the model: "
                    "Tops and bottoms must be worn on the corresponding body positions, shoes must be worn on feet, "
                    "outerwear must be worn on the outer layer, accessories like glasses must be worn on the face, hats on the head, "
                    "bags on the shoulder or held in hand. "
                    "Prohibit any items floating in the air or scattered on the ground. "
                    "CRITICAL: Maintain the original perspective and spatial relationships from Image 2. "
                    "The model's pose, scale, and perspective must remain consistent with the original background. "
                    "All proportions match the original scene's depth and perspective. "
                    "Avoid any perspective distortion - the model should appear naturally integrated with the original background, maintaining harmonious spatial consistency. "
                    "All items must fit the human body, with accurate and natural positioning, consistent lighting, and proper perspective alignment."
                    + garment_desc_text
                    + tryon_extra_text
                )
                negative_prompt = (
                    "Prohibit person from Image 1. Prohibit items floating in the air. "
                    "Prohibit shoes, glasses, accessories scattered on the ground or in the air. "
                    "All items must be correctly worn on the model. "
                    "Prohibit perspective distortion, mismatched scale, incorrect vanishing points, model floating above ground, "
                    "inconsistent depth perception, warped backgrounds, unnatural spatial relationships. "
                    + _tryon_layering_negative
                )
            garment_collage_index = 0
        else:
            # Text-only garments: no collage; person is Image 1, optional background is Image 2
            image_inputs = [person_input]
            if background_image_url:
                image_inputs.append(background_image_url)
            desc_lines = [f"{x['role']}: {x['description']}" for x in parsed_unmatched if x.get("description")]
            text_wearing = (
                "The person in Image 1 must wear all of the following items (described by text): "
                + "; ".join(desc_lines) + ". "
            )
            action_text = ""
            if background_action_prompt:
                action_text = f" The person in Image 1 should be performing this action: \"{background_action_prompt}\". "
            if background_image_url:
                prompt = (
                    "Replace the background of Image 1 with the environment in Image 2; keep Image 2 as the final background. "
                    "The model in Image 1 should perform this pose or action: " + (f'"{background_action_prompt}". ' if background_action_prompt else "natural standing or sitting. ")
                    + "Replace the model's clothing in Image 1 with the following items: "
                    + "; ".join(desc_lines) + ". "
                    "All items must be correctly worn on the model (tops on torso, bottoms on legs, shoes on feet, outerwear as outer layer, accessories in place). "
                    "CRITICAL: Preserve perspective and spatial consistency; the model must fit naturally into Image 2's scene. "
                    "Result should be harmonious, natural, with consistent lighting and correct perspective alignment."
                    + tryon_extra_text
                )
                negative_prompt = (
                    "Prohibit items floating in the air or scattered on the ground. "
                    "Prohibit perspective distortion, mismatched scale, model floating above ground, warped backgrounds. "
                    + _tryon_layering_negative
                )
            else:
                prompt = (
                    "Keep the person and original background of Image 1. "
                    "The model in Image 1 should perform this pose or action: "
                    + (f'"{background_action_prompt}". ' if background_action_prompt else "natural standing or sitting. ")
                    + "Replace the model's clothing in Image 1 with the following items: "
                    + "; ".join(desc_lines) + ". "
                    "All items must be correctly worn on the model (tops on torso, bottoms on legs, shoes on feet, outerwear as outer layer, accessories in place). "
                    "CRITICAL: Maintain the original perspective and spatial relationships from Image 1. "
                    "Result should be harmonious, natural, with consistent lighting and correct perspective alignment."
                    + tryon_extra_text
                )
                negative_prompt = (
                    "Prohibit items floating in the air or scattered on the ground. "
                    "Prohibit perspective distortion, mismatched scale, warped backgrounds. "
                    + _tryon_layering_negative
                )
            garment_collage_index = None
    except Exception as e:
        print(f"Failed to build try-on inputs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build try-on inputs: {e}")

    logger.info(f"[Try-On] Final prompt length: {len(prompt)} characters")
    logger.info(f"[Try-On] Full prompt sent to API:\n{prompt}")

    _inputs_log = [str(x) for x in image_inputs]
    logger.info(
        "[Try-On][Qwen Image 2.0] edit_image sequence (collage=R2 URL after upload inside client): %s",
        json.dumps(_inputs_log, ensure_ascii=False),
    )
    print(f"[Try-On][Qwen Image 2.0] edit_image raw inputs ({len(_inputs_log)}): {_inputs_log}")

    try:
        edited_path = await client.edit_image(
            image_inputs=image_inputs,
            prompt=prompt,
            n=1,
            negative_prompt=negative_prompt,
            output_path=output_path,
            garment_collage_index=garment_collage_index,
            size=output_size,
        )
    except QwenImageEditError as e:
        use_xai = tryon_xai_fallback_enabled() and (
            tryon_xai_fallback_on_any_qwen_error()
            or looks_like_dashscope_content_block(str(e))
        )
        if use_xai:
            logger.warning(
                "[Try-On] Qwen Image failed; attempting xAI Grok Imagine fallback: %s",
                e,
            )
            try:
                img_bytes = await virtual_tryon_via_xai_imagine(
                    image_inputs=image_inputs,
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                )
                out_path = (
                    output_path
                    if isinstance(output_path, Path)
                    else Path(output_path)
                )
                out_path.write_bytes(img_bytes)
                edited_path = out_path
                logger.info(
                    "[Try-On] xAI Grok Imagine fallback succeeded (saved %s bytes)",
                    len(img_bytes),
                )
            except Exception as xai_e:
                import traceback

                error_trace = traceback.format_exc()
                print(f"\n{'='*80}")
                print("=== Qwen Image Error + xAI Fallback Failed ===")
                print(f"Qwen: {e}")
                print(f"xAI: {xai_e}")
                print(f"Traceback:\n{error_trace}")
                print(f"{'='*80}\n")
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Qwen Image failed: {e}; "
                        f"xAI Imagine fallback failed: {xai_e}"
                    ),
                ) from xai_e
        else:
            import traceback

            error_trace = traceback.format_exc()
            print(f"\n{'='*80}")
            print("=== Qwen Image Edit Error ===")
            print(f"Error: {e}")
            print(f"Traceback:\n{error_trace}")
            print(f"{'='*80}\n")
            raise HTTPException(status_code=500, detail=f"Qwen Image Edit failed: {e}")
    except Exception as e:
        import traceback

        error_trace = traceback.format_exc()
        print(f"\n{'='*80}")
        print("=== Qwen Image Edit Error ===")
        print(f"Error: {e}")
        print(f"Traceback:\n{error_trace}")
        print(f"{'='*80}\n")
        raise HTTPException(status_code=500, detail=f"Qwen Image Edit failed: {e}")

    # Upload result to R2 to get public URL
    try:
        out_path = edited_path if isinstance(edited_path, (str, Path)) else edited_path[0]
        out_path = Path(out_path)
        with out_path.open("rb") as f:
            public_url = await upload_file_to_r2(f, out_path.name, "image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload try-on image: {e}")

    # Save try-on history only for logged-in users (retention by subscription plan)
    if user_id is not None:
        try:
            from services.tryon_history import save_tryon_history
            save_tryon_history(user_id, {
                "image_url": public_url,
                "garment_urls": garment_list,
                "background_image_url": background_image_url,
                "prompt": user_custom_prompt,
                "model_image_url": person_image_url,
            }, user_token)
        except Exception as e:
            import traceback
            print(f"[Try-On History] Failed to save history: {e}")
            print(f"[Try-On History] Traceback: {traceback.format_exc()}")

    return {"url": public_url}


@app.get("/guest-quota")
async def guest_quota(request: Request):
    """
    Return guest try-on and outfit remaining counts for this IP (no auth required).
    """
    return get_guest_quota(request)


@app.post("/generate-angles")
async def generate_angles(
    image_url: str = Form(...),
    preset: Optional[str] = Form(None),
    horizontal_angle: Optional[float] = Form(None),
    vertical_angle: Optional[float] = Form(None),
    zoom: Optional[float] = Form(5.0),
    additional_prompt: Optional[str] = Form(None),
    parent_tryon_id: Optional[str] = Form(None),
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Generate multi-angle view of a try-on result using fal.ai.
    
    Args:
        image_url: URL of the source try-on result image
        preset: Optional preset name (front, left, right, back, top, low)
        horizontal_angle: Horizontal rotation 0-360° (ignored if preset is set)
        vertical_angle: Vertical angle -30° to 90° (ignored if preset is set)
        zoom: Camera zoom 0-10 (default 5)
        additional_prompt: Optional additional prompt text
        parent_tryon_id: Optional ID of the parent try-on record
    
    Returns:
        Dict with generated image URL and metadata
    """
    from services.fal_multi_angle import (
        AngleParams,
        generate_multi_angle,
        get_preset_params,
        PRESET_ANGLES,
    )
    from services.storage import upload_file_to_r2
    from services.tryon_history import save_tryon_history
    import httpx
    from io import BytesIO
    
    user_id, user_token = auth
    
    # Check subscription and consume try-on count
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUBSCRIPTION_SERVICE_URL}/subscription/check-try",
                json={"user_id": user_id},
                timeout=5.0
            )
            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail=response.json().get("error", "Insufficient try-on count for multi-angle generation")
                )
            elif not response.is_success:
                raise HTTPException(status_code=500, detail="Failed to check try-on count")
    except httpx.RequestError as e:
        logger.warning(f"Failed to check subscription service: {e}, allowing multi-angle to proceed")
    
    # Determine angle parameters
    try:
        if preset:
            if preset not in PRESET_ANGLES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown preset: {preset}. Available: {list(PRESET_ANGLES.keys())}"
                )
            params = get_preset_params(preset)
            # Override zoom if provided
            if zoom is not None:
                params.zoom = zoom
            if additional_prompt:
                params.additional_prompt = additional_prompt
        else:
            # Use custom parameters
            if horizontal_angle is None or vertical_angle is None:
                raise HTTPException(
                    status_code=400,
                    detail="Either preset or both horizontal_angle and vertical_angle must be provided"
                )
            params = AngleParams(
                horizontal_angle=horizontal_angle,
                vertical_angle=vertical_angle,
                zoom=zoom or 5.0,
                additional_prompt=additional_prompt,
            )
        
        # Validate parameters
        params.validate()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Generate multi-angle image
    try:
        logger.info(f"[Multi-Angle] Generating for user {user_id}: preset={preset}, h={params.horizontal_angle}, v={params.vertical_angle}")
        result = await generate_multi_angle(
            image_url=image_url,
            params=params,
        )
    except RuntimeError as e:
        # FAL_KEY not set or other config error
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"[Multi-Angle] Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Multi-angle generation failed: {e}")
    
    # Extract generated image URL from result
    generated_images = result.get("images", [])
    if not generated_images:
        raise HTTPException(status_code=500, detail="No images generated")
    
    fal_image_url = generated_images[0].get("url")
    if not fal_image_url:
        raise HTTPException(status_code=500, detail="Generated image URL not found")
    
    # Download and re-upload to R2 for consistent storage
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(fal_image_url, timeout=60.0)
            resp.raise_for_status()
            image_data = BytesIO(resp.content)
        
        # Generate unique filename
        import uuid
        filename = f"multiangle_{user_id}_{uuid.uuid4().hex[:8]}.png"
        
        public_url = await upload_file_to_r2(
            image_data,
            filename,
            "image/png",
            expires_in_days=7  # Same as try-on results
        )
    except Exception as e:
        logger.error(f"[Multi-Angle] Failed to upload to R2: {e}")
        # Fall back to using fal.ai URL directly
        public_url = fal_image_url
    
    # Save to multiangle_history table (separate from tryon_history)
    angle_type = preset if preset else "custom"
    angle_params_dict = {
        "horizontal_angle": params.horizontal_angle,
        "vertical_angle": params.vertical_angle,
        "zoom": params.zoom,
        "additional_prompt": params.additional_prompt,
    }
    
    try:
        from services.multiangle_history import save_multiangle_history
        save_multiangle_history(
            user_id=user_id,
            source_tryon_url=image_url,
            result_url=public_url,
            angle_type=angle_type,
            angle_params=angle_params_dict,
            user_token=user_token,
        )
    except Exception as e:
        logger.warning(f"[Multi-Angle] Failed to save history: {e}")
    
    return {
        "url": public_url,
        "angle_type": angle_type,
        "angle_params": angle_params_dict,
        "seed": result.get("seed"),
        "prompt": result.get("prompt"),
    }


@app.get("/generate-angles/presets")
async def get_angle_presets():
    """Get available angle presets."""
    from services.fal_multi_angle import get_available_presets
    return {"presets": get_available_presets()}


@app.get("/multiangle-history")
async def get_multiangle_history(
    source_url: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Get multi-angle generation history for the current user.
    
    Args:
        source_url: Optional filter by source try-on URL
        page: Page number (1-based)
        limit: Items per page
    """
    from services.multiangle_history import list_multiangle_history, count_multiangle_history
    
    user_id, user_token = auth
    offset = (page - 1) * limit
    
    try:
        total = count_multiangle_history(user_id, user_token)
        history = list_multiangle_history(
            user_id=user_id,
            user_token=user_token,
            source_url=source_url,
            limit=limit,
            offset=offset,
        )
        
        total_pages = (total + limit - 1) // limit if total > 0 else 0
        
        return {
            "history": history,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
        }
    except Exception as e:
        logger.error(f"[MultiAngle History] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get multi-angle history: {e}")


@app.delete("/multiangle-history/{history_id}")
async def delete_multiangle_history_item(
    history_id: str,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """Delete a multi-angle history record by ID."""
    from services.multiangle_history import delete_multiangle_history
    
    user_id, user_token = auth
    
    success = delete_multiangle_history(user_id, history_id, user_token)
    if success:
        return {"success": True, "message": "Record deleted"}
    else:
        raise HTTPException(status_code=404, detail="Record not found or already deleted")


@app.post("/multiangle-source")
async def upload_multiangle_source(
    file: UploadFile = File(...),
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Upload a source image for multi-angle generation to R2 (with 7-day expiration).
    This is a temporary upload - the result will be saved to multiangle_history when generation completes.
    """
    from services.storage import upload_file_to_r2

    user_id, user_token = auth

    try:
        # Upload to R2 with 7-day expiration
        public_url = await upload_file_to_r2(
            file.file, file.filename, file.content_type or "image/jpeg", expires_in_days=7
        )
        
        logger.info(f"[MultiAngle] Source image uploaded for user {user_id}: {public_url}")
        return {"url": public_url}
    except Exception as e:
        logger.error(f"[MultiAngle] Failed to upload source image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload source image: {e}")


@app.post("/background-image")
async def upload_background_image(
    file: UploadFile = File(...),
    auth: tuple = Depends(get_optional_user_and_token),
):
    """
    Upload a background image to R2 (with 7-day expiration). Logged-in: save to user history. Guest: upload only.
    """
    from services.storage import upload_file_to_r2
    from services.user_images import save_user_image

    user_id, user_token = auth

    try:
        public_url = await upload_file_to_r2(
            file.file, file.filename, file.content_type or "image/jpeg", expires_in_days=7
        )
        if user_id is not None and user_token is not None:
            import os
            r2_public_url = os.getenv("R2_PUBLIC_URL", "")
            if r2_public_url and public_url.startswith(r2_public_url):
                r2_filename = public_url.replace(r2_public_url + '/', '')
            else:
                r2_filename = public_url.split('/')[-1]
            save_user_image(user_id, public_url, "background", user_token, r2_filename=r2_filename)
        return {"url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload background image: {e}")


@app.post("/model-image")
async def upload_model_image(
    file: UploadFile = File(...),
    auth: tuple = Depends(get_optional_user_and_token),
):
    """
    Upload a model image to R2 (no expiration for logged-in; 7-day for guest). Logged-in: save to user history. Guest: upload only.
    """
    from services.storage import upload_file_to_r2
    from services.user_images import save_user_image

    user_id, user_token = auth

    try:
        expires = None if user_id is not None else 7
        public_url = await upload_file_to_r2(
            file.file, file.filename, file.content_type or "image/jpeg", expires_in_days=expires
        )
        if user_id is not None and user_token is not None:
            import os
            r2_public_url = os.getenv("R2_PUBLIC_URL", "")
            if r2_public_url and public_url.startswith(r2_public_url):
                r2_filename = public_url.replace(r2_public_url + '/', '')
            else:
                r2_filename = public_url.split('/')[-1]
            save_user_image(user_id, public_url, "model", user_token, r2_filename=r2_filename)
        return {"url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload model image: {e}")


@app.put("/model-image/{model_id}")
async def replace_model_image(
    model_id: str,
    file: UploadFile = File(...),
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Replace an existing model's photo. Uploads new file to R2,
    updates the existing user_images row so the model ID is preserved.
    """
    from services.storage import upload_file_to_r2
    from services.user_images import update_user_image_url

    user_id, user_token = auth
    try:
        public_url = await upload_file_to_r2(
            file.file, file.filename, file.content_type or "image/jpeg", expires_in_days=None
        )
        import os
        r2_public_url = os.getenv("R2_PUBLIC_URL", "")
        if r2_public_url and public_url.startswith(r2_public_url):
            r2_filename = public_url.replace(r2_public_url + '/', '')
        else:
            r2_filename = public_url.split('/')[-1]

        updated = update_user_image_url(user_id, model_id, public_url, r2_filename, user_token)
        if not updated:
            raise HTTPException(status_code=404, detail="Model not found or not owned by user")
        return {"url": public_url, "model": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to replace model image: {e}")


@app.get("/user-images")
async def get_user_images(
    image_type: Optional[str] = None,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Get user's historical images, optionally filtered by type.
    Automatically filters out expired images.
    """
    from services.user_images import list_user_images

    user_id, user_token = auth

    try:
        images = list_user_images(user_id, user_token, image_type=image_type)
        return {"images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user images: {e}")


@app.delete("/user-images/{image_id}")
async def delete_user_image(
    image_id: str,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Delete a user's historical image by ID.
    Also deletes the file from R2 if available.
    """
    from services.user_images import delete_user_image

    user_id, user_token = auth

    try:
        deleted = delete_user_image(user_id, image_id, user_token)
        if not deleted:
            raise HTTPException(status_code=404, detail="Image not found or not owned by user")
        return {"message": "Image deleted successfully", "image_id": image_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user image: {e}")


# ── Model profile (身高/体重/出生年份) ──


class ModelProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    birth_year: Optional[int] = None


@app.get("/model-profiles")
async def list_model_profiles(
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """Get all model profiles (nickname etc.) for the current user."""
    from services.model_profiles import list_model_profiles as _list

    user_id, user_token = auth
    try:
        profiles = _list(user_id, user_token)
        return {"profiles": profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list model profiles: {e}")


@app.get("/model-profile/{model_id}")
async def get_model_profile(
    model_id: str,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """Get profile for a model."""
    from services.model_profiles import get_model_profile as _get

    user_id, user_token = auth
    try:
        profile = _get(user_id, model_id, user_token)
        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model profile: {e}")


@app.put("/model-profile/{model_id}")
async def update_model_profile(
    model_id: str,
    body: ModelProfileUpdate,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """Create or update profile for a model."""
    from services.model_profiles import upsert_model_profile

    user_id, user_token = auth
    try:
        profile = upsert_model_profile(
            user_id=user_id,
            model_id=model_id,
            user_token=user_token,
            nickname=body.nickname,
            height=body.height,
            weight=body.weight,
            birth_year=body.birth_year,
        )
        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update model profile: {e}")


@app.get("/looks")
async def get_looks(auth: tuple[str, str] = Depends(get_current_user_and_token)):
    """
    Get all saved looks for the current user.
    """
    from services.looks import list_looks
    import httpx

    user_id, user_token = auth

    try:
        looks = list_looks(user_id, user_token)

        # Determine retention based on subscription plan
        retention_days: Optional[int] = None
        plan_retention = {
            "Premium": 90,
            "premium": 90,
            "Premium Plus": 365,
            "premium_plus": 365,
        }

        SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{SUBSCRIPTION_SERVICE_URL}/userinfo",
                    params={"user_id": user_id},
                    timeout=5.0,
                )
                if resp.status_code == 200:
                    plan_name = resp.json().get("planName")
                    retention_days = plan_retention.get(plan_name)
                else:
                    logger.warning(f"Subscription status check failed with {resp.status_code}, skipping retention filter.")
        except Exception as sub_err:
            logger.warning(f"Failed to fetch subscription status: {sub_err}. Skipping retention filter.")

        if retention_days:
            cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

            def _parse_created_at(val: Any) -> Optional[datetime]:
                if not isinstance(val, str):
                    return None
                try:
                    ts = val.replace("Z", "+00:00")
                    return datetime.fromisoformat(ts)
                except Exception:
                    return None

            looks = [
                look
                for look in looks
                if (dt := _parse_created_at(look.get("created_at"))) is None or dt >= cutoff
            ]

        # Sort by created_at descending (newest first)
        looks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"looks": looks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get looks: {e}")


@app.get("/looks/{look_id}")
async def get_look(look_id: str, auth: tuple[str, str] = Depends(get_current_user_and_token)):
    """
    Get a single look by ID for the current user.
    """
    from services.looks import get_look_by_id

    user_id, user_token = auth

    try:
        look = get_look_by_id(look_id, user_id, user_token)
        if look is None:
            raise HTTPException(status_code=404, detail="Look not found")
        return look
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get look: {e}")


@app.post("/looks")
async def save_look(
    look: SaveLookRequest,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Save an outfit look for the current user.
    """
    from services.looks import save_look

    user_id, user_token = auth

    try:
        look_dict = look.model_dump()
        saved_look = save_look(user_id, look_dict, user_token)
        return saved_look
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save look: {e}")


def _resolve_retention_days_for_user(user_id: str, client) -> Optional[int]:
    """
    Helper to resolve retention days for a user via subscription-service.
    """
    plan_retention = {
        "Premium": 90,
        "premium": 90,
        "Premium Plus": 365,
        "premium_plus": 365,
    }
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        resp = client.get(
            f"{SUBSCRIPTION_SERVICE_URL}/userinfo",
            params={"user_id": user_id},
            timeout=5.0,
        )
        if resp.status_code == 200:
            plan_name = resp.json().get("planName")
            return plan_retention.get(plan_name)
    except Exception as e:
        logger.warning(f"Failed to resolve retention for user {user_id}: {e}")
    return None


@app.post("/cleanup-expired-files")
async def cleanup_expired_files(background_tasks: BackgroundTasks):
    """
    Manually trigger cleanup of expired files from R2.
    This can also be called periodically via a cron job.
    """
    from services.storage import delete_expired_files_from_r2

    # Run cleanup in background
    background_tasks.add_task(delete_expired_files_from_r2)

    return {"message": "Cleanup task started"}


@app.get("/favorites")
async def get_favorites(auth: tuple[str, str] = Depends(get_current_user_and_token)):
    """
    Get all saved favorites for the current user.
    """
    from services.favorites import list_favorites

    user_id, user_token = auth

    try:
        favorites = list_favorites(user_id, user_token)
        # Sort by created_at descending (newest first)
        favorites.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"favorites": favorites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get favorites: {e}")


@app.post("/favorites")
async def save_favorite(
    favorite: SaveFavoriteRequest,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Save a favorite try-on result for the current user.
    The image_url should already be uploaded to R2.
    """
    from services.favorites import save_favorite as save_favorite_service

    user_id, user_token = auth

    try:
        favorite_dict = favorite.model_dump()
        saved_favorite = save_favorite_service(user_id, favorite_dict, user_token)
        return saved_favorite
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save favorite: {e}")


@app.delete("/favorites/{favorite_id}")
async def delete_favorite(
    favorite_id: str,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Delete a favorite by ID.
    """
    from services.favorites import delete_favorite as delete_favorite_service

    user_id, user_token = auth

    try:
        deleted = delete_favorite_service(user_id, favorite_id, user_token)
        if not deleted:
            raise HTTPException(status_code=404, detail="Favorite not found")
        return {"message": "Favorite deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete favorite: {e}")


@app.get("/tryon-history")
async def get_tryon_history(
    page: int = 1,
    limit: int = 20,
    user_id: str = Depends(get_current_user),
    user_token: str = Depends(get_current_user_token),
):
    """
    Get try-on history for the current user with pagination.
    Expired records are cleaned up by periodic cleanup task.
    
    Args:
        page: Page number (1-indexed)
        limit: Number of records per page (default: 20, max: 100)
    """
    from services.tryon_history import list_tryon_history, count_tryon_history

    try:
        # Validate and clamp parameters
        page = max(1, page)
        limit = max(1, min(100, limit))  # Limit between 1 and 100
        offset = (page - 1) * limit
        
        # Log received user_id
        logger.info(f"[API] /tryon-history endpoint called for user_id: {user_id}, page: {page}, limit: {limit}")
        
        # Get total count and paginated history
        total = count_tryon_history(user_id, user_token)
        history = list_tryon_history(user_id, user_token, limit=limit, offset=offset)
        
        # Log query result count
        logger.info(f"[API] /tryon-history returned {len(history)} record(s) for user_id: {user_id} (total: {total})")
        
        logger.info(f"[API] /tryon-history returning {len(history)} record(s) for page {page}")
        return {
            "history": history,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if limit > 0 else 0
        }
    except Exception as e:
        import traceback
        # Log any exceptions with full details
        logger.error(f"[API] /tryon-history error for user_id {user_id}: {e}")
        logger.error(f"[API] /tryon-history traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to get try-on history: {e}")


@app.delete("/tryon-history/{history_id}")
async def delete_tryon_history(
    history_id: str,
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Delete a try-on history record by ID.
    """
    from services.tryon_history import delete_tryon_history as delete_history_service

    try:
        user_id, user_token = auth
        deleted = delete_history_service(user_id, history_id, user_token)
        if not deleted:
            raise HTTPException(status_code=404, detail="History record not found")
        return {"message": "History record deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete history record: {e}")


@app.get("/tryon-history/debug")
async def debug_tryon_history(
    user_id: str = Depends(get_current_user),
    user_token: str = Depends(get_current_user_token),
):
    """
    Debug endpoint: Get all try-on history records without user_id filter.
    This helps diagnose why history might be empty.
    """
    from services.tryon_history import debug_list_all_history, list_tryon_history

    try:
        # Get all records (for debugging - uses service role key if available)
        all_records = debug_list_all_history()
        
        # Get user-specific records (uses user token for RLS)
        user_records = list_tryon_history(user_id, user_token)
        
        return {
            "debug_info": {
                "requested_user_id": user_id,
                "total_records_in_table": len(all_records),
                "user_specific_records": len(user_records),
            },
            "all_records_sample": all_records[:10] if all_records else [],  # First 10 records
            "user_records": user_records,
        }
    except Exception as e:
        import traceback
        logger.error(f"[API Debug] /tryon-history/debug error: {e}")
        logger.error(f"[API Debug] /tryon-history/debug traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Debug endpoint error: {e}")


# Schedule periodic cleanup on startup
@app.on_event("startup")
async def startup_event():
    """
    Schedule periodic cleanup of expired R2 files.
    Runs cleanup every 6 hours.
    """
    import asyncio
    import requests
    from services.storage import delete_expired_files_from_r2, delete_file_from_r2_by_url
    from services.looks import cleanup_expired_looks
    
    # Log that the application is starting up
    logger.info("=" * 60)
    logger.info("Fashion Recommendation API - Starting up...")
    logger.info("=" * 60)
    logger.info("Application is listening on 0.0.0.0:8000")
    logger.info("Health check endpoint available at: /health")

    async def periodic_cleanup():
        try:
            while True:
                try:
                    await asyncio.sleep(24 * 60 * 60)  # 24 hours
                    # Clean up expired R2 files
                    await delete_expired_files_from_r2()
                    # Clean up expired user images from database
                    from services.user_images import cleanup_expired_images
                    cleanup_expired_images()
                    # Clean up expired looks based on retention policy
                    session = requests.Session()

                    def resolve_retention(user_id: str):
                        return _resolve_retention_days_for_user(user_id, session)

                    deleted_looks = cleanup_expired_looks(resolve_retention, delete_file_from_r2_by_url)
                    if deleted_looks:
                        logger.info(f"Deleted {deleted_looks} expired look(s) based on retention policy.")
                    
                    # Clean up expired try-on history records (deletes from Supabase and R2)
                    from services.tryon_history import _cleanup_expired
                    deleted_history = _cleanup_expired()
                    if deleted_history:
                        logger.info(f"Deleted {deleted_history} expired try-on history record(s).")
                except asyncio.CancelledError:
                    # This is expected when the application is shutting down or reloading
                    logger.debug("Periodic cleanup task cancelled (shutting down/reloading)")
                    raise  # Re-raise to properly exit the loop
                except Exception as e:
                    logger.error(f"Error during periodic cleanup: {e}")
        except (asyncio.CancelledError, KeyboardInterrupt):
            # Handle cancellation gracefully - this is normal on shutdown/reload
            logger.debug("Periodic cleanup task stopped (normal shutdown/reload)")
            # Don't re-raise, just exit gracefully
        except Exception as e:
            # Only log unexpected errors
            logger.error(f"Unexpected error in periodic cleanup task: {e}")

    # Start cleanup task in background
    task = asyncio.create_task(periodic_cleanup())
    logger.info("Periodic R2 cleanup task started (runs every 24 hours)")
    
    # Store task reference for cleanup on shutdown
    app.state.cleanup_task = task
    
    # Log startup completion
    logger.info("Application startup complete - ready to accept connections")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up background tasks on shutdown.
    """
    if hasattr(app.state, 'cleanup_task') and app.state.cleanup_task:
        logger.info("Cancelling periodic cleanup task...")
        app.state.cleanup_task.cancel()
        try:
            await app.state.cleanup_task
        except (asyncio.CancelledError, KeyboardInterrupt):
            # These are expected during shutdown/reload - not actual errors
            logger.debug("Cleanup task cancelled (normal shutdown behavior)")
        except Exception as e:
            # Only log unexpected errors
            logger.warning(f"Unexpected error while cancelling cleanup task: {e}")
        logger.info("Periodic cleanup task cancelled")


# ==================== LV Products Related API ====================

class ScrapeLVRequest(BaseModel):
    category_url: str
    max_pages: int = 1
    max_products: Optional[int] = None
    generate_thumbnails: bool = True
    watermark_text: Optional[str] = None


class LVProductResponse(BaseModel):
    product_id: str
    product_name: str
    price: Optional[str] = None
    original_lv_url: str
    thumbnail_url: Optional[str] = None
    original_image_url: str
    created_at: str
    updated_at: str
    metadata: Optional[Dict[str, Any]] = None


@app.post("/lv-products/scrape", response_model=Dict[str, Any])
async def scrape_lv_products(
    request: ScrapeLVRequest,
    background_tasks: BackgroundTasks,
):
    """
    Scrape LV product data and generate thumbnails
    
    Note: This feature needs to adjust selectors according to actual LV website structure
    """
    from services.lv_scraper import LVScraper
    from services.lv_products_db import get_db
    from services.thumbnail_service import ThumbnailService
    from services.storage import upload_file_to_r2
    
    try:
        scraper = LVScraper()
        db = get_db()
        
        # Scrape products
        print(f"[LV Scraper] Starting to scrape products: {request.category_url}")
        products = scraper.fetch_product_list(
            request.category_url,
            max_pages=request.max_pages
        )
        
        if request.max_products:
            products = products[:request.max_products]
        
        print(f"[LV Scraper] Scraped {len(products)} products")
        
        added_products = []
        
        # Setup thumbnail service
        watermark_text = request.watermark_text or "fashion-rec.dongzhouhe.com"
        thumbnail_service = ThumbnailService(
            thumbnail_size=(300, 300),
            quality=40,
            watermark_text=watermark_text,
        )
        
        # Process each product
        for product in products:
            try:
                # Add to database
                product_id = db.add_product(
                    product_name=product.get('name', 'Unknown'),
                    original_lv_url=product.get('product_url', ''),
                    original_image_url=product.get('original_image_url', ''),
                    price=product.get('price'),
                    metadata={
                        'all_images': product.get('all_images', []),
                    },
                )
                
                thumbnail_url = None
                
                # Generate thumbnail (if enabled)
                if request.generate_thumbnails and product.get('original_image_url'):
                    try:
                        # Download and generate thumbnail
                        thumbnail = thumbnail_service.download_image(product['original_image_url'])
                        if thumbnail:
                            thumbnail_img = thumbnail_service.create_thumbnail(thumbnail, add_watermark=True)
                            
                            # Save to temporary file
                            temp_thumbnail_path = UPLOAD_DIR / "lv_thumbnails" / f"{product_id}.jpg"
                            temp_thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
                            thumbnail_service.save_thumbnail(thumbnail_img, temp_thumbnail_path)
                            
                            # Upload to R2
                            with temp_thumbnail_path.open("rb") as f:
                                thumbnail_url = await upload_file_to_r2(
                                    f,
                                    f"{product_id}.jpg",
                                    "image/jpeg"
                                )
                            
                            # Update database
                            db.update_product(product_id, thumbnail_url=thumbnail_url)
                            
                            # Delete temporary file
                            temp_thumbnail_path.unlink()
                    except Exception as e:
                        print(f"[LV Scraper] Failed to generate thumbnail {product_id}: {e}")
                
                added_products.append({
                    "product_id": product_id,
                    "product_name": product.get('name'),
                    "thumbnail_url": thumbnail_url,
                })
                
            except Exception as e:
                print(f"[LV Scraper] Failed to process product: {e}")
                continue
        
        return {
            "message": f"Successfully scraped and processed {len(added_products)} products",
            "total_scraped": len(products),
            "total_added": len(added_products),
            "products": added_products,
        }
        
    except Exception as e:
        import traceback
        print(f"[LV Scraper] Scraping failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")


@app.get("/lv-products", response_model=Dict[str, Any])
async def list_lv_products(
    limit: Optional[int] = None,
    offset: int = 0,
    order_by: str = "created_at",
    order_direction: str = "DESC",
):
    """
    List LV products
    """
    from services.lv_products_db import get_db
    
    try:
        db = get_db()
        products = db.list_products(
            limit=limit,
            offset=offset,
            order_by=order_by,
            order_direction=order_direction,
        )
        total = db.count_products()
        
        return {
            "products": products,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        print(f"[LV Products] Failed to get product list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lv-products/{product_id}", response_model=LVProductResponse)
async def get_lv_product(product_id: str):
    """
    Get single LV product details
    """
    from services.lv_products_db import get_db
    
    try:
        db = get_db()
        product = db.get_product(product_id)
        
        if not product:
            raise HTTPException(status_code=404, detail="Product does not exist")
        
        return product
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LV Products] Failed to get product: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lv-products/search", response_model=Dict[str, Any])
async def search_lv_products(
    keyword: str,
    limit: Optional[int] = None,
    offset: int = 0,
):
    """
    Search LV products
    """
    from services.lv_products_db import get_db
    
    try:
        db = get_db()
        products = db.search_products(
            keyword=keyword,
            limit=limit,
            offset=offset,
        )
        
        return {
            "products": products,
            "keyword": keyword,
            "count": len(products),
        }
    except Exception as e:
        print(f"[LV Products] Failed to search products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lv-products/{product_id}/generate-thumbnail")
async def generate_product_thumbnail(
    product_id: str,
    watermark_text: Optional[str] = None,
):
    """
    Generate thumbnail for specified product
    """
    from services.lv_products_db import get_db
    from services.thumbnail_service import ThumbnailService
    from services.storage import upload_file_to_r2
    
    try:
        db = get_db()
        product = db.get_product(product_id)
        
        if not product:
            raise HTTPException(status_code=404, detail="Product does not exist")
        
        if not product.get('original_image_url'):
            raise HTTPException(status_code=400, detail="Product has no original image URL")
        
        # Generate thumbnail
        watermark = watermark_text or "fashion-rec.dongzhouhe.com"
        thumbnail_service = ThumbnailService(
            thumbnail_size=(300, 300),
            quality=40,
            watermark_text=watermark,
        )
        
        # Download and generate thumbnail
        thumbnail = thumbnail_service.download_image(product['original_image_url'])
        if not thumbnail:
            raise HTTPException(status_code=500, detail="Failed to download original image")
        
        thumbnail_img = thumbnail_service.create_thumbnail(thumbnail, add_watermark=True)
        
        # Save to temporary file
        temp_thumbnail_path = UPLOAD_DIR / "lv_thumbnails" / f"{product_id}.jpg"
        temp_thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
        thumbnail_service.save_thumbnail(thumbnail_img, temp_thumbnail_path)
        
        # Upload to R2
        with temp_thumbnail_path.open("rb") as f:
            thumbnail_url = await upload_file_to_r2(
                f,
                f"{product_id}.jpg",
                "image/jpeg"
            )
        
        # Update database
        db.update_product(product_id, thumbnail_url=thumbnail_url)
        
        # Delete temporary file
        temp_thumbnail_path.unlink()
        
        return {
            "product_id": product_id,
            "thumbnail_url": thumbnail_url,
            "message": "Thumbnail generated successfully",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[LV Products] Failed to generate thumbnail: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate thumbnail: {str(e)}")


@app.delete("/lv-products/{product_id}")
async def delete_lv_product(product_id: str):
    """
    Delete LV product
    """
    from services.lv_products_db import get_db
    
    try:
        db = get_db()
        success = db.delete_product(product_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Product does not exist")
        
        return {"message": "Product deleted", "product_id": product_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LV Products] Failed to delete product: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Subscription Management ====================

# Note: Subscription management API has been migrated to subscription-service (TypeScript)
# These endpoints are kept as proxies, or directly call subscription-service
# It is recommended that frontend directly calls subscription-service

@app.get("/userinfo")
async def get_userinfo(user_id: str = Depends(get_current_user)):
    """
    Get user subscription status and try-on count information (proxy to subscription-service)
    """
    import httpx
    
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUBSCRIPTION_SERVICE_URL}/userinfo",
                params={"user_id": user_id},
                timeout=5.0
            )
            if response.is_success:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to get subscription status")
    except httpx.RequestError as e:
        logger.error(f"Error proxying to subscription service: {e}")
        raise HTTPException(status_code=500, detail=f"Subscription service unavailable: {str(e)}")


# ==================== SEO & Search Console API ====================

@app.get("/seo/search-console/connect")
async def connect_search_console(user_id: str = Depends(get_current_user)):
    """Initiate Google Search Console OAuth connection"""
    try:
        from services.search_console import SearchConsoleService
        
        service = SearchConsoleService()
        auth_url = service.get_authorization_url()
        
        # Store state in session/database for later verification
        # For now, return the URL directly
        return {"authUrl": auth_url}
    except Exception as e:
        logger.error(f"Failed to initiate Search Console connection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect: {str(e)}")


@app.get("/seo/search-console/callback")
async def search_console_callback(code: str, state: Optional[str] = None, user_id: str = Depends(get_current_user)):
    """Handle OAuth callback from Google Search Console"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB
        
        service = SearchConsoleService()
        credentials = service.get_credentials_from_code(code)
        
        # Prepare credentials dictionary
        credentials_dict = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        # Store credentials in database (encrypted)
        db = SearchConsoleDB()
        site_url = 'https://fashion-rec.com'  # Default site URL
        success = db.save_credentials(user_id, credentials_dict, site_url)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save credentials")
        
        return {"success": True, "message": "Successfully connected to Google Search Console"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to handle Search Console callback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect: {str(e)}")


@app.post("/seo/search-console/disconnect")
async def disconnect_search_console(user_id: str = Depends(get_current_user)):
    """Disconnect Google Search Console"""
    try:
        from services.search_console_db import SearchConsoleDB
        
        db = SearchConsoleDB()
        success = db.delete_credentials(user_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete credentials")
        
        return {"success": True, "message": "Disconnected from Google Search Console"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disconnect Search Console: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")


@app.get("/seo/search-console/status")
async def get_search_console_status(user_id: str = Depends(get_current_user)):
    """Check Search Console connection status"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB
        
        # Retrieve credentials from database
        db = SearchConsoleDB()
        credentials_dict = db.get_credentials(user_id)
        
        if not credentials_dict:
            return {"connected": False}
        
        # Add user_id to credentials_dict for token refresh callback
        credentials_dict['user_id'] = user_id
        
        # Create callback to save refreshed token
        def save_refreshed_token(uid: str, updated_creds: Dict[str, Any]):
            db.save_credentials(uid, updated_creds)
        
        service = SearchConsoleService()
        # Pass callback to automatically save refreshed token
        is_connected = service.check_connection(credentials_dict, save_refreshed_token)
        
        return {"connected": is_connected}
    except Exception as e:
        logger.error(f"Failed to check Search Console status: {e}")
        return {"connected": False}


@app.post("/seo/verify-site")
async def verify_site(request: Dict[str, Any], user_id: str = Depends(get_current_user)):
    """Verify site ownership"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB
        
        site_url = request.get('siteUrl')
        if not site_url:
            raise HTTPException(status_code=400, detail="siteUrl is required")
        
        # Retrieve credentials from database
        db = SearchConsoleDB()
        credentials_dict = db.get_credentials(user_id)
        
        if not credentials_dict:
            raise HTTPException(status_code=401, detail="Not connected to Google Search Console")
        
        # Add user_id and create callback for token refresh
        credentials_dict['user_id'] = user_id
        def save_refreshed_token(uid: str, updated_creds: Dict[str, Any]):
            db.save_credentials(uid, updated_creds)
        
        service = SearchConsoleService()
        result = service.verify_site(credentials_dict, site_url, save_refreshed_token)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify site: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@app.post("/seo/submit-sitemap")
async def submit_sitemap(request: Dict[str, Any], user_id: str = Depends(get_current_user)):
    """Submit sitemap to Google Search Console"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB
        
        sitemap_url = request.get('sitemapUrl')
        site_url = request.get('siteUrl', 'https://fashion-rec.com')
        
        if not sitemap_url:
            raise HTTPException(status_code=400, detail="sitemapUrl is required")
        
        # Retrieve credentials from database
        db = SearchConsoleDB()
        credentials_dict = db.get_credentials(user_id)
        
        if not credentials_dict:
            raise HTTPException(status_code=401, detail="Not connected to Google Search Console")
        
        # Add user_id and create callback for token refresh
        credentials_dict['user_id'] = user_id
        def save_refreshed_token(uid: str, updated_creds: Dict[str, Any]):
            db.save_credentials(uid, updated_creds)
        
        service = SearchConsoleService()
        result = service.submit_sitemap(credentials_dict, site_url, sitemap_url, save_refreshed_token)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit sitemap: {e}")
        raise HTTPException(status_code=500, detail=f"Sitemap submission failed: {str(e)}")


@app.post("/seo/inspect-url")
async def inspect_url(request: Dict[str, Any], user_id: str = Depends(get_current_user)):
    """Inspect URL using Google Search Console URL Inspection API"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB
        
        url = request.get('url')
        if not url:
            raise HTTPException(status_code=400, detail="url is required")
        
        # Retrieve credentials from database
        db = SearchConsoleDB()
        credentials_dict = db.get_credentials(user_id)
        
        if not credentials_dict:
            raise HTTPException(status_code=401, detail="Not connected to Google Search Console")
        
        # Add user_id and create callback for token refresh
        credentials_dict['user_id'] = user_id
        def save_refreshed_token(uid: str, updated_creds: Dict[str, Any]):
            db.save_credentials(uid, updated_creds)
        
        service = SearchConsoleService()
        result = service.inspect_url(credentials_dict, url, save_refreshed_token)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to inspect URL: {e}")
        raise HTTPException(status_code=500, detail=f"URL inspection failed: {str(e)}")


@app.get("/seo/video-analytics")
async def get_video_seo_analytics(
    startDate: str,
    endDate: str,
    user_id: str = Depends(get_current_user)
):
    """Get video search analytics from Google Search Console"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB

        # Retrieve credentials from database
        db = SearchConsoleDB()
        credentials_dict = db.get_credentials(user_id)

        if not credentials_dict:
            raise HTTPException(status_code=401, detail="Not connected to Google Search Console")

        # Get site_url from credentials or use default
        site_url = credentials_dict.get('site_url', 'https://fashion-rec.com')

        service = SearchConsoleService()
        result = service.get_video_search_analytics(
            credentials_dict,
            site_url,
            startDate,
            endDate
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get video analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get video analytics: {str(e)}")


@app.get("/seo/analytics")
async def get_seo_analytics(
    startDate: str,
    endDate: str,
    user_id: str = Depends(get_current_user)
):
    """Get search analytics from Google Search Console"""
    try:
        from services.search_console import SearchConsoleService
        from services.search_console_db import SearchConsoleDB
        
        # Retrieve credentials from database
        db = SearchConsoleDB()
        credentials_dict = db.get_credentials(user_id)
        
        if not credentials_dict:
            raise HTTPException(status_code=401, detail="Not connected to Google Search Console")
        
        # Get site_url from credentials or use default
        site_url = credentials_dict.get('site_url', 'https://fashion-rec.com')
        
        service = SearchConsoleService()
        result = service.get_search_analytics(
            credentials_dict,
            site_url,
            startDate,
            endDate
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@app.get("/video-sitemap.xml")
async def get_video_sitemap():
    """Generate video sitemap for Google Search Console"""
    try:
        import aiohttp

        # Fetch blog posts from Cloudflare Workers API
        blog_api_url = "https://blog.fashion-rec.workers.dev/posts?status=published&limit=1000"

        async with aiohttp.ClientSession() as session:
            async with session.get(blog_api_url) as response:
                if response.status != 200:
                    logger.warning(f"Failed to fetch blog posts: {response.status}")
                    # Return empty sitemap
                    return Response(
                        content='''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
</urlset>''',
                        media_type="application/xml"
                    )

                data = await response.json()
                posts = data.get('posts', [])

        # Build video sitemap XML
        xml_parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">'
        ]

        base_url = "https://fashion-rec.com"
        blog_base_url = "https://blog.fashion-rec.com"

        for post in posts:
            if post.get('media_urls'):
                # Check if post contains videos
                has_video = any(media.get('type') == 'video' for media in post['media_urls'])

                if has_video:
                    xml_parts.append('  <url>')
                    xml_parts.append(f'    <loc>{blog_base_url}/blog/{post["id"]}</loc>')
                    xml_parts.append(f'    <lastmod>{post["updated_at"][:10]}</lastmod>')

                    # Add video entries for each video in the post
                    for media in post['media_urls']:
                        if media.get('type') == 'video':
                            xml_parts.append('    <video:video>')

                            # Use thumbnail if available, otherwise use a default or video URL
                            thumbnail_url = media.get('thumbnail') or media['url'].replace('.mp4', '.jpg').replace('.webm', '.jpg').replace('.mov', '.jpg')
                            xml_parts.append(f'      <video:thumbnail_loc>{thumbnail_url}</video:thumbnail_loc>')

                            # Title: Post title + Video
                            xml_parts.append(f'      <video:title>{post["title"]} - Video</video:title>')

                            # Description: First 500 characters of post content
                            description = post.get("content", "")[:500]
                            if not description:
                                description = post["title"]
                            xml_parts.append(f'      <video:description>{description}</video:description>')

                            # Content location: Direct video file URL
                            xml_parts.append(f'      <video:content_loc>{media["url"]}</video:content_loc>')

                            # Player location: Blog post URL with video anchor
                            xml_parts.append(f'      <video:player_loc>{blog_base_url}/blog/{post["id"]}#video</video:player_loc>')

                            # Duration: Default to 300 seconds (5 minutes) - should be calculated from actual video metadata
                            xml_parts.append('      <video:duration>300</video:duration>')

                            # Publication date
                            xml_parts.append('      <video:publication_date>')
                            xml_parts.append(f'        <video:nested>{post["created_at"][:19]}+00:00</video:nested>')
                            xml_parts.append('      </video:publication_date>')

                            xml_parts.append('    </video:video>')

                    xml_parts.append('  </url>')

        xml_parts.append('</urlset>')

        return Response(
            content='\n'.join(xml_parts),
            media_type="application/xml"
        )

    except Exception as e:
        logger.error(f"Failed to generate video sitemap: {e}")
        # Return empty sitemap on error
        return Response(
            content='''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
</urlset>''',
            media_type="application/xml"
        )