from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
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
from services.vector_db import add_to_wardrobe, search_similar, get_user_items
from services.try_on import generate_try_on
from auth import get_current_user, get_current_user_token, get_current_user_and_token
from fastapi import Depends

app = FastAPI(title="Fashion Recommendation API")

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

# Directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

class OutfitAgentRequest(BaseModel):
    location: Optional[str] = None  # Optional, will be extracted from prompt or IP if not provided
    prompt: str
    base_item_ids: Optional[List[str]] = None
    scene_image_url: Optional[str] = None
    # Map of wardrobe_id to role for already selected items (to avoid regenerating them)
    selected_items_roles: Optional[Dict[str, str]] = None


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
    scene_image_url: Optional[str] = None


class SaveFavoriteRequest(BaseModel):
    image_url: str  # The try-on result image URL (uploaded to R2)
    title: Optional[str] = None  # Optional title for the favorite
    garment_urls: Optional[List[str]] = None  # URLs of garment items used in try-on
    scene_image_url: Optional[str] = None  # Scene image URL if used
    prompt: Optional[str] = None  # User's custom prompt
    model_image_url: Optional[str] = None  # Model image URL
    model_image_id: Optional[str] = None  # Model image ID


@app.get("/")
def root():
    return {"message": "Fashion Recommendation API"}


@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify the service is ready.
    Always returns 200 to indicate the service is running and accepting connections.
    Provides detailed status information about model and database initialization.
    """
    try:
        from services.vector_db import embedding_model, collection
        
        # Check if CLIP model is loaded
        model_ready = embedding_model is not None
        
        # Check if Supabase client is initialized
        db_ready = collection is not None
        
        # Always return 200 - the service is running and accepting connections
        # Fly.io health check just needs to know the app is listening
        status_code = 200
        if model_ready and db_ready:
            status = "ready"
        else:
            status = "initializing"
        
        return {
            "status": status,
            "service": "running",
            "model_loaded": model_ready,
            "database_ready": db_ready,
            "message": "Service is running and accepting connections"
        }
    except Exception as e:
        # Even if there's an error checking components, return 200
        # to indicate the HTTP server is running
        logger.warning(f"Health check encountered an error: {e}")
        return {
            "status": "running",
            "service": "running",
            "model_loaded": False,
            "database_ready": False,
            "message": "Service is running (component check failed)",
            "error": str(e)
        }


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
        features = await analyze_image(temp_path)

        # Upload to R2 and get URL
        from services.storage import upload_file_to_r2

        with temp_path.open("rb") as f:
            url = await upload_file_to_r2(f, file.filename, file.content_type or "image/jpeg")

        # Add to vector database
        item_id = await add_to_wardrobe(url, features, user_id)

        # Clean up temp file
        temp_path.unlink()

        return {
            "id": item_id,
            "url": url,
            "features": features,
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
                            detail=f"图片URL访问被拒绝（403 Forbidden）。这通常是因为网站有反爬虫保护。请尝试：1) 使用其他图片URL，2) 直接上传图片文件，或 3) 使用公开可访问的图片URL。"
                        )
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=f"无法下载图片URL: {str(e)}。HTTP状态码: {e.response.status_code if e.response else 'N/A'}。请检查URL是否正确或网络连接是否正常。"
                        )
                except requests.exceptions.Timeout as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"下载图片URL超时（连接超时60秒或读取超时300秒）。这可能是因为：\n1. 图片文件太大\n2. 网络连接较慢\n3. 服务器响应慢\n\n建议：\n- 尝试使用其他图片URL\n- 直接上传图片文件\n- 检查网络连接"
                    )
                except requests.exceptions.RequestException as e:
                    error_detail = str(e)
                    # Handle timeout errors specifically
                    if "timeout" in error_detail.lower() or isinstance(e, requests.exceptions.Timeout):
                        error_detail = "下载图片URL超时。请检查URL是否正确或网络连接是否正常。"
                    raise HTTPException(
                        status_code=400, 
                        detail=f"无法下载图片URL: {error_detail}。请检查URL是否正确或网络连接是否正常。"
                    )
                except Exception as e:
                    error_msg = str(e)
                    if "'Timeout' object is not subscriptable" in error_msg or "Timeout" in error_msg:
                        error_msg = "下载图片URL超时。请检查URL是否正确或网络连接是否正常。"
                    raise HTTPException(
                        status_code=500,
                        detail=f"处理图片URL时出错: {error_msg}"
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
                                detail=f"图片分析失败: {error_msg}"
                            )
                        logger.info(f"✓ Analysis completed, detected {len(features_list)} item(s)")
                    else:
                        logger.error("Analysis returned empty result after fallback")
                        raise HTTPException(
                            status_code=500,
                            detail="图片分析返回空结果"
                        )
                except HTTPException:
                    raise
                except requests.exceptions.HTTPError as e:
                    if e.response and e.response.status_code == 403:
                        raise HTTPException(
                            status_code=403,
                            detail=f"图片URL访问被拒绝（403 Forbidden）。这通常是因为网站有反爬虫保护。请尝试：1) 使用其他图片URL，2) 直接上传图片文件，或 3) 使用公开可访问的图片URL。"
                        )
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail=f"无法下载图片URL: {str(e)}。HTTP状态码: {e.response.status_code if e.response else 'N/A'}。请检查URL是否正确或网络连接是否正常。"
                        )
                except requests.exceptions.Timeout as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"下载图片URL超时（连接超时60秒或读取超时300秒）。这可能是因为：\n1. 图片文件太大\n2. 网络连接较慢\n3. 服务器响应慢\n\n建议：\n- 尝试使用其他图片URL\n- 直接上传图片文件\n- 检查网络连接"
                    )
                except requests.exceptions.RequestException as e:
                    error_detail = str(e)
                    if "timeout" in error_detail.lower() or isinstance(e, requests.exceptions.Timeout):
                        error_detail = "下载图片URL超时。请检查URL是否正确或网络连接是否正常。"
                    raise HTTPException(
                        status_code=400, 
                        detail=f"无法下载图片URL: {error_detail}。请检查URL是否正确或网络连接是否正常。"
                    )
                except Exception as e:
                    error_msg = str(e)
                    import traceback
                    error_trace = traceback.format_exc()
                    logger.error(f"Fallback process failed: {error_msg}")
                    logger.error(f"Traceback:\n{error_trace}")
                    if "'Timeout' object is not subscriptable" in error_msg or "Timeout" in error_msg:
                        error_msg = "下载图片URL超时。请检查URL是否正确或网络连接是否正常。"
                    raise HTTPException(
                        status_code=500,
                        detail=f"处理图片URL时出错: {error_msg}"
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
                            detail=f"文件太大（{file_size / 1024 / 1024:.2f} MB）。最大支持 50MB。请使用较小的图片或压缩图片后再上传。"
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
                        detail=f"处理文件失败: {str(e)}"
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="临时文件不存在，无法上传到存储"
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
                        detail="图片格式不支持。Qwen-VL API不支持AVIF等格式。系统已尝试自动转换，但转换失败。请尝试将图片转换为JPEG或PNG格式后重新上传。"
                    )
                else:
                    raise HTTPException(status_code=500, detail=f"图片分析失败: {error_msg}")
            
            # Add to vector database
            logger.info("Adding item to wardrobe database...")
            item_id = await add_to_wardrobe(final_url, features, user_id)
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
            error_msg = "下载图片URL超时。请检查URL是否正确或网络连接是否正常。如果图片很大，请尝试使用其他URL或直接上传文件。"
        elif "SSL" in error_msg or "SSLError" in error_msg:
            error_msg = "图片URL访问失败，可能是SSL连接问题。请尝试使用其他图片URL或直接上传文件。"
        elif "timeout" in error_msg.lower() or "Connection" in error_msg:
            error_msg = "图片URL访问超时或连接失败。请检查URL是否正确或网络是否正常。"
        elif "seek of closed file" in error_msg.lower():
            error_msg = "文件处理错误，请重试。"
        elif "Failed to upload to R2" in error_msg:
            error_msg = f"上传到存储失败：{error_msg}"
        else:
            error_msg = f"处理图片时出错：{error_msg}"
        
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

            item_id = await add_to_wardrobe(
                item_data["url"],
                item_data["features"],
                user_id,
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
            detail=f"获取衣橱数据失败: {str(e)}"
        )


class DeleteItemsRequest(BaseModel):
    item_ids: List[str]


@app.post("/items/delete")
async def delete_items(
    request: DeleteItemsRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Delete items from the user's wardrobe.
    Accepts a list of item IDs to delete.
    """
    from services.vector_db import delete_user_items
    
    try:
        deleted_count = delete_user_items(request.item_ids, user_id)
        return {
            "deleted_count": deleted_count,
            "message": f"Successfully deleted {deleted_count} item(s)"
        }
    except Exception as e:
        print(f"Failed to delete items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/outfit")
async def generate_outfit(
    request: OutfitAgentRequest,
    http_request: Request,
    user_id: str = Depends(get_current_user),
):
    """
    Generate outfit recommendations using the outfit agent.
    """
    from services.outfit_agent import generate_outfit_suggestions

    try:
        result = await generate_outfit_suggestions(
            user_id=user_id,
            location=request.location,
            user_prompt=request.prompt,
            base_item_ids=request.base_item_ids,
            scene_image_url=request.scene_image_url,
            client_ip=http_request.client.host if http_request.client else None,
            selected_items_roles=request.selected_items_roles,
        )

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
        
        # 检查是否是 API 密钥相关的错误
        if "API key" in error_msg or "invalid_api_key" in error_msg or "401" in error_msg or "DASHSCOPE_API_KEY" in error_msg:
            logger.error(f"API key authentication error: {e}")
            raise HTTPException(
                status_code=500, 
                detail="API 密钥配置错误。新加坡端点必须使用 DASHSCOPE_API_KEY_SG，北京端点必须使用 DASHSCOPE_API_KEY。请检查环境变量是否正确设置。"
            )
        
        print(f"Error generating outfit: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate outfit: {e}")


@app.post("/try-on")
async def try_on(
    person_image: Optional[UploadFile] = File(None),
    person_image_url: Optional[str] = Form(None),
    garment_urls: str = Form(...),
    scene_image_url: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user),
):
    """
    Virtual try-on:
    - garment_urls: JSON-encoded list of garment image URLs (图1, 单品合成图)
    - person_image: the model photo (图2) as uploaded file (optional)
    - person_image_url: the model photo (图2) as URL (optional)
    - scene_image_url: the scene image (图3) as URL (optional)

    Image order: 图1 (garment collage) → 图2 (model photo) → 图3 (scene, optional)
    At least one of person_image or person_image_url must be provided.
    """
    from services.qwen_image_edit import QwenImageEditClient, _load_env_config
    from services.storage import upload_file_to_r2
    import httpx
    
    # 检查并消耗试穿次数（调用 subscription-service）
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUBSCRIPTION_SERVICE_URL}/subscription/check-try",
                json={"user_id": user_id},
                timeout=5.0
            )
            if response.status_code == 403:
                raise HTTPException(status_code=403, detail=response.json().get("error", "试穿次数不足"))
            elif not response.is_success:
                raise HTTPException(status_code=500, detail="检查试穿次数失败")
    except httpx.RequestError as e:
        logger.warning(f"Failed to check subscription service: {e}, allowing try-on to proceed")
        # 如果订阅服务不可用，允许继续（开发环境）

    # Parse garment URLs
    try:
        garment_list = json.loads(garment_urls)
        if not isinstance(garment_list, list):
            raise ValueError("garment_urls must be a JSON list of URLs")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid garment_urls: {e}")

    if not garment_list:
        raise HTTPException(status_code=400, detail="garment_urls cannot be empty")

    # Determine person image input (local file path or URL)
    if not person_image and not person_image_url:
        raise HTTPException(status_code=400, detail="Either person_image file or person_image_url must be provided")

    person_input: str  # This will be used as the first image input for Qwen Image Edit
    output_path: Path

    if person_image:
        # Save person image to a temporary file
        try:
            person_filename = f"person_{user_id}_{person_image.filename}"
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
    else:
        # Use URL directly for person image
        person_input = person_image_url  # type: ignore[assignment]
        # Ensure output directory exists
        output_path = UPLOAD_DIR / "tryon" / f"tryon_{user_id}.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)

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

    # Build composite garment image (图2) by merging all garment images into a grid
    def build_garment_collage(urls: List[str], output_path: Path) -> Path:
        images: List[Image.Image] = []
        failed_urls: List[Dict[str, str]] = []
        
        if not urls:
            raise RuntimeError("No garment URLs provided for collage")
        
        # 检测是否为 R2 URL
        R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")
        is_r2_url = R2_PUBLIC_URL and urls[0].startswith(R2_PUBLIC_URL) if urls else False
        if not is_r2_url:
            # 通过域名判断（r2.dev）
            is_r2_url = any("r2.dev" in url for url in urls)
        
        # 创建 Session 并配置代理
        # 注意：生产环境在海外不需要代理，开发环境可能需要代理
        # 通过 R2_USE_PROXY 环境变量控制（默认 False，生产环境不需要设置）
        session = requests.Session()
        use_proxy = os.getenv("R2_USE_PROXY", "false").lower() in ("true", "1", "yes")
        
        if is_r2_url and use_proxy:
            # 仅在明确配置需要代理时才使用代理（开发环境）
            # 支持两种代理配置方式：
            # 1. HTTP_PROXY/HTTPS_PROXY（标准格式，如 http://proxy:port）
            # 2. PROXY_HOST/PROXY_PORT（自定义格式，构建为 socks5://host:port）
            proxies = {}
            
            # 方式1: 使用 HTTP_PROXY/HTTPS_PROXY（标准格式）
            http_proxy = os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
            https_proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
            
            if http_proxy or https_proxy:
                proxies["http"] = http_proxy
                proxies["https"] = https_proxy
            else:
                # 方式2: 使用 PROXY_HOST/PROXY_PORT（构建代理 URL）
                proxy_host = os.getenv("PROXY_HOST")
                proxy_port = os.getenv("PROXY_PORT")
                
                if proxy_host and proxy_port:
                    # 默认使用 SOCKS5 代理（端口 10808 通常是 SOCKS5）
                    # 如果需要 HTTP 代理，可以通过 PROXY_TYPE 环境变量指定（如 http, https, socks5）
                    proxy_type = os.getenv("PROXY_TYPE", "socks5").lower()
                    proxy_url = f"{proxy_type}://{proxy_host}:{proxy_port}"
                    proxies["http"] = proxy_url
                    proxies["https"] = proxy_url
                    
                    # 如果使用 SOCKS 代理，需要安装 PySocks
                    if proxy_type.startswith("socks"):
                        try:
                            import socks
                        except ImportError:
                            print(f"[Try-On] WARNING: SOCKS proxy requires PySocks. Install with: uv add PySocks")
                            # 尝试使用 HTTP 代理格式（某些代理服务器支持）
                            proxy_url = f"http://{proxy_host}:{proxy_port}"
                            proxies["http"] = proxy_url
                            proxies["https"] = proxy_url
            
            # 如果配置了代理，使用它；否则使用系统代理（requests 会自动检测）
            if proxies.get("http") or proxies.get("https"):
                session.proxies = proxies
                print(f"[Try-On] Using proxy for R2 URLs: {proxies}")
            else:
                # 使用系统代理（requests 会自动检测）
                print(f"[Try-On] Using system proxy for R2 URLs (auto-detected)")
        else:
            # 生产环境或非 R2 URL：不使用代理（直连）
            session.proxies = None
            if is_r2_url:
                print(f"[Try-On] R2_USE_PROXY not enabled, using direct connection for R2 URLs")
        
        print(f"[Try-On] Attempting to download {len(urls)} garment images...")
        
        for idx, url in enumerate(urls):
            try:
                print(f"[Try-On] Downloading garment image {idx + 1}/{len(urls)}: {url[:80]}...")
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

        # Normalize size: resize all to same thumbnail size
        thumb_w, thumb_h = 256, 256
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

    try:
        garments_collage_path = UPLOAD_DIR / "tryon" / f"garments_{user_id}_collage.png"
        garments_collage_path = build_garment_collage(garment_list, garments_collage_path)

        image_inputs: List[Any] = [garments_collage_path, person_input]
        # If scene image URL is provided, use it as 图3 (background)
        if scene_image_url:
            image_inputs.append(scene_image_url)
            prompt = (
                "使用图2（模特图）中的人物，让这个人物穿着图1中的所有衣服和配饰，"
                "然后将这个穿着新衣服的人物放置在图3所示的场景中。"
                "保持图3的环境与背景作为最终背景，只使用图3的场景元素，"
                "人物必须来自图2，不要使用图3中的任何人物。"
                "所有单品必须正确地穿在模特身上："
                "上装和下装必须穿在身体的对应位置，鞋子必须穿在脚上并站在地面上，"
                "外套必须穿在外层，配饰如眼镜必须戴在脸上、帽子戴在头上、"
                "包背在肩上或拎在手中。"
                "禁止任何物品悬浮在空中或散落在地上。"
                "整体画面自然、光影一致、所有物品都贴合人体。"
            )
            negative_prompt = "禁止出现图1中的人物，禁止出现图3中的人物。禁止物品悬浮在空中。禁止鞋子、眼镜、配饰散落在地上或空中。所有物品必须正确穿戴在模特身上。"  # 禁止出现衣服拼图和场景图中的人物，禁止物品散落或悬浮
        else:
            # Prompt: 图2中的人物穿着图1中的所有衣服，保留模特与原始背景
            prompt = (
                "图2中的人物穿着图1中的所有衣服和配饰，保持人物身份与原始背景自然合理，"
                "只替换服装，不要移除或替换图2的背景。"
                "所有单品必须正确地穿在模特身上："
                "上装和下装必须穿在身体的对应位置，鞋子必须穿在脚上，"
                "外套必须穿在外层，配饰如眼镜必须戴在脸上、帽子戴在头上、"
                "包背在肩上或拎在手中。"
                "禁止任何物品悬浮在空中或散落在地上。"
                "所有物品都必须贴合人体，位置准确自然。"
            )
            negative_prompt = "禁止出现图1中的人物。禁止物品悬浮在空中。禁止鞋子、眼镜、配饰散落在地上或空中。所有物品必须正确穿戴在模特身上。"  # 禁止出现衣服拼图中的人物，禁止物品散落或悬浮
    except Exception as e:
        print(f"Failed to build garment collage: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build garment collage: {e}")

    try:
        # Index 0 is the garment collage (图1), set it to expire in 7 days
        edited_path = await client.edit_image(
            image_inputs=image_inputs,
            prompt=prompt,
            n=1,
            negative_prompt=negative_prompt,
            output_path=output_path,
            garment_collage_index=0,  # 图1 (garment collage) will expire in 7 days
        )
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

    # Save try-on history (automatically uses user's subscription plan to determine retention period)
    # Retention period: Free (7 days), Premium (90 days), Premium Plus (365 days)
    try:
        from services.tryon_history import save_tryon_history
        # Use user's custom prompt (saved before system prompt overwrote it), otherwise None
        # Note: The Qwen API uses its own internal prompt, but we save the user's custom prompt for history
        save_tryon_history(user_id, {
            "image_url": public_url,
            "garment_urls": garment_list,  # Use parsed list, not JSON string (selected items from Applied Outfit Items)
            "scene_image_url": scene_image_url,
            "prompt": user_custom_prompt,  # User's original custom prompt (from Form parameter), not the system-generated prompt
        })
    except Exception as e:
        # Log error but don't fail the request
        import traceback
        print(f"[Try-On History] Failed to save history: {e}")
        print(f"[Try-On History] Traceback: {traceback.format_exc()}")

    return {"url": public_url}


@app.post("/scene-image")
async def upload_scene_image(
    file: UploadFile = File(...),
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Upload a scene image to R2 (with 7-day expiration) and save it to user's history.
    """
    from services.storage import upload_file_to_r2
    from services.user_images import save_user_image

    user_id, user_token = auth

    try:
        # Upload to R2 with 7-day expiration
        public_url = await upload_file_to_r2(
            file.file, file.filename, file.content_type or "image/jpeg", expires_in_days=7
        )
        
        # Extract R2 filename from URL for deletion purposes
        import os
        r2_public_url = os.getenv("R2_PUBLIC_URL", "")
        if r2_public_url and public_url.startswith(r2_public_url):
            r2_filename = public_url.replace(r2_public_url + '/', '')
        else:
            r2_filename = public_url.split('/')[-1]

        # Save to user history with R2 filename for deletion
        save_user_image(user_id, public_url, "scene", user_token, r2_filename=r2_filename)

        return {"url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload scene image: {e}")


@app.post("/model-image")
async def upload_model_image(
    file: UploadFile = File(...),
    auth: tuple[str, str] = Depends(get_current_user_and_token),
):
    """
    Upload a model image to R2 (with 7-day expiration) and save it to user's history.
    """
    from services.storage import upload_file_to_r2
    from services.user_images import save_user_image

    user_id, user_token = auth

    try:
        # Upload to R2 with 7-day expiration
        public_url = await upload_file_to_r2(
            file.file, file.filename, file.content_type or "image/jpeg", expires_in_days=7
        )
        
        # Extract R2 filename from URL for deletion purposes
        import os
        r2_public_url = os.getenv("R2_PUBLIC_URL", "")
        if r2_public_url and public_url.startswith(r2_public_url):
            r2_filename = public_url.replace(r2_public_url + '/', '')
        else:
            r2_filename = public_url.split('/')[-1]

        # Save to user history with R2 filename for deletion
        save_user_image(user_id, public_url, "model", user_token, r2_filename=r2_filename)

        return {"url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload model image: {e}")


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
                    f"{SUBSCRIPTION_SERVICE_URL}/subscription/status",
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
            f"{SUBSCRIPTION_SERVICE_URL}/subscription/status",
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
async def get_tryon_history(user_id: str = Depends(get_current_user)):
    """
    Get all try-on history for the current user.
    Returns all records without filtering. Expired records are cleaned up by periodic cleanup task.
    """
    from services.tryon_history import list_tryon_history

    try:
        history = list_tryon_history(user_id)
        # Sort by created_at descending (newest first)
        history.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get try-on history: {e}")


@app.delete("/tryon-history/{history_id}")
async def delete_tryon_history(
    history_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Delete a try-on history record by ID.
    """
    from services.tryon_history import delete_tryon_history as delete_history_service

    try:
        deleted = delete_history_service(user_id, history_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="History record not found")
        return {"message": "History record deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete history record: {e}")


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


# ==================== LV商品相关API ====================

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
    抓取LV商品数据并生成缩略图
    
    注意：此功能需要根据实际LV网站结构调整选择器
    """
    from services.lv_scraper import LVScraper
    from services.lv_products_db import get_db
    from services.thumbnail_service import ThumbnailService
    from services.storage import upload_file_to_r2
    
    try:
        scraper = LVScraper()
        db = get_db()
        
        # 抓取商品
        print(f"[LV Scraper] 开始抓取商品: {request.category_url}")
        products = scraper.fetch_product_list(
            request.category_url,
            max_pages=request.max_pages
        )
        
        if request.max_products:
            products = products[:request.max_products]
        
        print(f"[LV Scraper] 抓取到 {len(products)} 个商品")
        
        added_products = []
        
        # 设置缩略图服务
        watermark_text = request.watermark_text or "fashion-rec.dongzhouhe.com"
        thumbnail_service = ThumbnailService(
            thumbnail_size=(300, 300),
            quality=40,
            watermark_text=watermark_text,
        )
        
        # 处理每个商品
        for product in products:
            try:
                # 添加到数据库
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
                
                # 生成缩略图（如果启用）
                if request.generate_thumbnails and product.get('original_image_url'):
                    try:
                        # 下载并生成缩略图
                        thumbnail = thumbnail_service.download_image(product['original_image_url'])
                        if thumbnail:
                            thumbnail_img = thumbnail_service.create_thumbnail(thumbnail, add_watermark=True)
                            
                            # 保存到临时文件
                            temp_thumbnail_path = UPLOAD_DIR / "lv_thumbnails" / f"{product_id}.jpg"
                            temp_thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
                            thumbnail_service.save_thumbnail(thumbnail_img, temp_thumbnail_path)
                            
                            # 上传到R2
                            with temp_thumbnail_path.open("rb") as f:
                                thumbnail_url = await upload_file_to_r2(
                                    f,
                                    f"{product_id}.jpg",
                                    "image/jpeg"
                                )
                            
                            # 更新数据库
                            db.update_product(product_id, thumbnail_url=thumbnail_url)
                            
                            # 删除临时文件
                            temp_thumbnail_path.unlink()
                    except Exception as e:
                        print(f"[LV Scraper] 生成缩略图失败 {product_id}: {e}")
                
                added_products.append({
                    "product_id": product_id,
                    "product_name": product.get('name'),
                    "thumbnail_url": thumbnail_url,
                })
                
            except Exception as e:
                print(f"[LV Scraper] 处理商品失败: {e}")
                continue
        
        return {
            "message": f"成功抓取并处理 {len(added_products)} 个商品",
            "total_scraped": len(products),
            "total_added": len(added_products),
            "products": added_products,
        }
        
    except Exception as e:
        import traceback
        print(f"[LV Scraper] 抓取失败: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"抓取失败: {str(e)}")


@app.get("/lv-products", response_model=Dict[str, Any])
async def list_lv_products(
    limit: Optional[int] = None,
    offset: int = 0,
    order_by: str = "created_at",
    order_direction: str = "DESC",
):
    """
    列出LV商品列表
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
        print(f"[LV Products] 获取商品列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lv-products/{product_id}", response_model=LVProductResponse)
async def get_lv_product(product_id: str):
    """
    获取单个LV商品详情
    """
    from services.lv_products_db import get_db
    
    try:
        db = get_db()
        product = db.get_product(product_id)
        
        if not product:
            raise HTTPException(status_code=404, detail="商品不存在")
        
        return product
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LV Products] 获取商品失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lv-products/search", response_model=Dict[str, Any])
async def search_lv_products(
    keyword: str,
    limit: Optional[int] = None,
    offset: int = 0,
):
    """
    搜索LV商品
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
        print(f"[LV Products] 搜索商品失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lv-products/{product_id}/generate-thumbnail")
async def generate_product_thumbnail(
    product_id: str,
    watermark_text: Optional[str] = None,
):
    """
    为指定商品生成缩略图
    """
    from services.lv_products_db import get_db
    from services.thumbnail_service import ThumbnailService
    from services.storage import upload_file_to_r2
    
    try:
        db = get_db()
        product = db.get_product(product_id)
        
        if not product:
            raise HTTPException(status_code=404, detail="商品不存在")
        
        if not product.get('original_image_url'):
            raise HTTPException(status_code=400, detail="商品没有原始图片URL")
        
        # 生成缩略图
        watermark = watermark_text or "fashion-rec.dongzhouhe.com"
        thumbnail_service = ThumbnailService(
            thumbnail_size=(300, 300),
            quality=40,
            watermark_text=watermark,
        )
        
        # 下载并生成缩略图
        thumbnail = thumbnail_service.download_image(product['original_image_url'])
        if not thumbnail:
            raise HTTPException(status_code=500, detail="下载原始图片失败")
        
        thumbnail_img = thumbnail_service.create_thumbnail(thumbnail, add_watermark=True)
        
        # 保存到临时文件
        temp_thumbnail_path = UPLOAD_DIR / "lv_thumbnails" / f"{product_id}.jpg"
        temp_thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
        thumbnail_service.save_thumbnail(thumbnail_img, temp_thumbnail_path)
        
        # 上传到R2
        with temp_thumbnail_path.open("rb") as f:
            thumbnail_url = await upload_file_to_r2(
                f,
                f"{product_id}.jpg",
                "image/jpeg"
            )
        
        # 更新数据库
        db.update_product(product_id, thumbnail_url=thumbnail_url)
        
        # 删除临时文件
        temp_thumbnail_path.unlink()
        
        return {
            "product_id": product_id,
            "thumbnail_url": thumbnail_url,
            "message": "缩略图生成成功",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[LV Products] 生成缩略图失败: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"生成缩略图失败: {str(e)}")


@app.delete("/lv-products/{product_id}")
async def delete_lv_product(product_id: str):
    """
    删除LV商品
    """
    from services.lv_products_db import get_db
    
    try:
        db = get_db()
        success = db.delete_product(product_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="商品不存在")
        
        return {"message": "商品已删除", "product_id": product_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LV Products] 删除商品失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Subscription Management ====================

# 注意：订阅管理 API 已迁移到 subscription-service (TypeScript)
# 这些端点保留作为代理，或直接调用 subscription-service
# 建议前端直接调用 subscription-service

@app.get("/subscription/status")
async def get_subscription_status(user_id: str = Depends(get_current_user)):
    """
    获取用户订阅状态和试穿次数信息（代理到 subscription-service）
    """
    import httpx
    
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUBSCRIPTION_SERVICE_URL}/subscription/status",
                params={"user_id": user_id},
                timeout=5.0
            )
            if response.is_success:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="获取订阅状态失败")
    except httpx.RequestError as e:
        logger.error(f"Error proxying to subscription service: {e}")
        raise HTTPException(status_code=500, detail=f"订阅服务不可用: {str(e)}")