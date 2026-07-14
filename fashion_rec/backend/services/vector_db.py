"""
Vector DB Service - Supabase pgvector Implementation
Replaces the ChromaDB implementation with Supabase for persistent vector storage.
"""
import os
import sys
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
import uuid
from PIL import Image
from supabase import Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def _append_hosts_to_no_proxy(hosts: tuple[str, ...]) -> None:
    """Append hosts to NO_PROXY/no_proxy so requests/urllib3 may bypass broken local proxies."""
    for host in hosts:
        if not host:
            continue
        for key in ("NO_PROXY", "no_proxy"):
            cur = os.environ.get(key, "")
            if host in cur:
                continue
            sep = "," if cur else ""
            os.environ[key] = f"{cur}{sep}{host}"


# Optional: bypass system proxy for Hugging Face (TLS EOF / protocol errors when proxy MITM breaks HTTPS)
_hf_bypass = (os.getenv("HF_BYPASS_PROXY_FOR_HUB") or "").strip().lower()
if _hf_bypass in ("1", "true", "yes"):
    _append_hosts_to_no_proxy(("huggingface.co", "hf-mirror.com", "cdn-lfs.huggingface.co"))
    print("[Vector DB] HF_BYPASS_PROXY_FOR_HUB enabled — added huggingface.co / hf-mirror.com to NO_PROXY")

# ============================================================================
# Configure Hugging Face environment variables BEFORE importing SentenceTransformer
# This is critical: sentence_transformers initializes huggingface_hub on import,
# so all environment variables must be set before the import.
# ============================================================================

# HF_ENDPOINT: default is official hub. If you see SSL EOF to huggingface.co, set HF_ENDPOINT=https://hf-mirror.com
# (or enable HF_BYPASS_PROXY_FOR_HUB if a local proxy breaks TLS to the hub).
_hf_ep = (os.getenv("HF_ENDPOINT") or "").strip()
if _hf_ep:
    os.environ["HF_ENDPOINT"] = _hf_ep
    print(f"[Vector DB] HF_ENDPOINT={_hf_ep}")
else:
    print(
        "[Vector DB] HF_ENDPOINT unset — lazy CLIP load will try hf-mirror first, then huggingface.co "
        "(set HF_HUB_TRY_ORDER=official_first to reverse, or HF_ENDPOINT=... for a single hub)"
    )

# Disable HF Transfer for more reliable downloads
if not os.getenv("HF_HUB_ENABLE_HF_TRANSFER"):
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

# Shorter hub timeouts so a dead TLS path fails faster (override in .env if needed)
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "30")
os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", "15")

# Set Hugging Face cache directory
hf_cache_dir = os.getenv("HF_HOME") or os.path.expanduser("~/.cache/huggingface")
print(f"[Vector DB] Hugging Face cache directory: {hf_cache_dir}")

# Check model cache and enable offline mode if cache is complete
MODEL_NAME = "clip-ViT-B-32"
model_cache_path = Path(hf_cache_dir) / "hub" / f"models--sentence-transformers--{MODEL_NAME.replace('/', '--')}"

def is_cache_complete(cache_path: Path) -> bool:
    """Check if model cache is complete by verifying essential files exist."""
    if not cache_path.exists():
        return False
    
    # Check for modules.json (required metadata file)
    modules_json = cache_path / "modules.json"
    if not modules_json.exists():
        return False
    
    # Check if there are any model files (snapshots directory)
    snapshots_dir = cache_path / "snapshots"
    if not snapshots_dir.exists():
        return False
    
    # Check if snapshots directory has content
    try:
        snapshot_dirs = [d for d in snapshots_dir.iterdir() if d.is_dir()]
        if not snapshot_dirs:
            return False
        
        # Check if at least one snapshot has model files
        for snapshot_dir in snapshot_dirs:
            # Look for common model files (pytorch_model.bin, model.safetensors, etc.)
            model_files = list(snapshot_dir.glob("*.bin")) + list(snapshot_dir.glob("*.safetensors"))
            if model_files:
                return True
    except Exception:
        return False
    
    return False

cache_is_complete = is_cache_complete(model_cache_path)

# Enable offline mode if cache is complete (prevents remote checks)
if cache_is_complete:
    # Force enable offline mode to prevent any remote connections
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_EXPERIMENTAL_WARNING"] = "1"
    print("[Vector DB] Model cache is complete, FORCING offline mode to avoid remote checks")
    print(f"[Vector DB] Cache path: {model_cache_path}")
    print("[Vector DB] This will prevent all network requests to huggingface.co")
else:
    if "HF_HUB_OFFLINE" in os.environ:
        del os.environ["HF_HUB_OFFLINE"]
    print("[Vector DB] Model cache incomplete or missing, will download when first used")
    print(f"[Vector DB] Hub endpoint: {os.getenv('HF_ENDPOINT') or 'https://huggingface.co (default)'}")

# Configure Hugging Face Hub HTTP retry strategy BEFORE importing SentenceTransformer
# Reduce retry attempts from default 5 to 2, increase timeout for slow connections (VPN)
# huggingface_hub uses requests/urllib3 internally, we patch it globally
# Also add URL rewriting to force use of mirror site
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    from urllib3.exceptions import ReadTimeoutError, ConnectTimeoutError
    
    # Create a custom retry strategy with only 2 retries
    # Include timeout errors in retry (important for VPN/unstable connections)
    retry_strategy = Retry(
        total=2,  # Total retry attempts (reduced from default 5)
        status_forcelist=[429, 500, 502, 503, 504],  # HTTP status codes to retry
        allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"],
        backoff_factor=2,  # Wait 2s, 4s between retries (increased for stability)
        # Retry on timeout errors (ReadTimeoutError, ConnectTimeoutError)
        # This is crucial for VPN/slow connections
        read=2,  # Retry on read timeout
        connect=2,  # Retry on connection timeout
    )
    
    # Create adapter with custom retry strategy and increased timeouts
    # Increase timeout from default 10s to 60s for large file downloads
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,
        pool_maxsize=10,
    )
    
    # Patch requests.Session to use our adapter, increased timeout, and URL rewriting
    # This affects all requests made by huggingface_hub
    original_init = requests.Session.__init__
    original_get = requests.Session.get
    original_head = requests.Session.head
    original_request = requests.Session.request
    
    def rewrite_url(url: str) -> str:
        """Rewrite huggingface.co to current HF_ENDPOINT (read on each request — supports runtime fallback)."""
        ep = (os.getenv("HF_ENDPOINT") or "https://huggingface.co").rstrip("/")
        if ep in ("", "https://huggingface.co"):
            return url
        if isinstance(url, str) and "huggingface.co" in url:
            new_url = url.replace("https://huggingface.co", ep)
            if new_url != url:
                print(f"[Vector DB] URL rewrite: {url[:80]}... -> {new_url[:80]}...")
            return new_url
        return url
    
    def patched_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        # Mount adapter for both http and https
        if not hasattr(self, '_hf_retry_configured'):
            self.mount("http://", adapter)
            self.mount("https://", adapter)
            self._hf_retry_configured = True
            # Set default timeout for all requests (60s connect, 120s read)
            # This handles large file downloads even with slow VPN
            if not hasattr(self, '_default_timeout'):
                self._default_timeout = (60, 120)  # (connect_timeout, read_timeout)
    
    def patched_get(self, url, **kwargs):
        # Rewrite URL to use mirror
        url = rewrite_url(url)
        # Apply default timeout if not specified
        if 'timeout' not in kwargs:
            kwargs['timeout'] = getattr(self, '_default_timeout', (60, 120))
        return original_get(self, url, **kwargs)
    
    def patched_head(self, url, **kwargs):
        # Rewrite URL to use mirror
        url = rewrite_url(url)
        # Apply default timeout if not specified
        if 'timeout' not in kwargs:
            kwargs['timeout'] = getattr(self, '_default_timeout', (60, 120))
        return original_head(self, url, **kwargs)
    
    def patched_request(self, method, url, **kwargs):
        # Rewrite URL to use mirror
        url = rewrite_url(url)
        # Apply default timeout if not specified
        if 'timeout' not in kwargs:
            kwargs['timeout'] = getattr(self, '_default_timeout', (60, 120))
        return original_request(self, method, url, **kwargs)
    
    requests.Session.__init__ = patched_init
    requests.Session.get = patched_get
    requests.Session.head = patched_head
    requests.Session.request = patched_request
    
    _ep0 = (os.getenv("HF_ENDPOINT") or "https://huggingface.co").rstrip("/")
    print(f"[Vector DB] Configured HTTP: retry=2, timeout=60s/120s, HF_ENDPOINT={_ep0}")
    if _ep0 != "https://huggingface.co":
        print("[Vector DB] huggingface.co download URLs will be rewritten to HF_ENDPOINT")
except Exception as e:
    print(f"[Vector DB] Warning: Could not configure retry/timeout/URL rewrite: {e}")

# Import huggingface_hub and configure endpoint BEFORE importing SentenceTransformer
# This ensures the endpoint is set before any huggingface_hub initialization
try:
    import huggingface_hub
    from huggingface_hub import constants
    
    mirror_endpoint = (os.getenv("HF_ENDPOINT") or "https://huggingface.co").rstrip("/")
    if hasattr(constants, "ENDPOINT"):
        constants.ENDPOINT = mirror_endpoint
    if hasattr(constants, "DEFAULT_ENDPOINT"):
        constants.DEFAULT_ENDPOINT = mirror_endpoint

    print(f"[Vector DB] Configured huggingface_hub endpoint: {mirror_endpoint}")
except Exception as e:
    print(f"[Vector DB] Warning: Could not configure huggingface_hub endpoint: {e}")


def _patch_hf_hub_http_backoff() -> None:
    """
    huggingface_hub uses http_backoff(max_retries=5) in file_download — separate from urllib3's Retry.
    Patch before SentenceTransformer pulls models so failed endpoints fail faster and fallbacks run sooner.
    """
    try:
        import huggingface_hub.utils._http as hf_http

        max_r = int((os.getenv("HF_HUB_HTTP_MAX_RETRIES") or "2").strip() or "2")
        max_r = max(1, min(max_r, 10))
        _orig = hf_http.http_backoff

        def http_backoff_wrapped(*args, **kwargs):
            kwargs.setdefault("max_retries", max_r)
            return _orig(*args, **kwargs)

        hf_http.http_backoff = http_backoff_wrapped
        try:
            import huggingface_hub.utils as hf_utils

            hf_utils.http_backoff = http_backoff_wrapped
        except Exception:
            pass
        for name in (
            "huggingface_hub.file_download",
            "huggingface_hub.hf_file_system",
            "huggingface_hub.lfs",
        ):
            mod = sys.modules.get(name)
            if mod is not None and hasattr(mod, "http_backoff"):
                mod.http_backoff = http_backoff_wrapped
        print(f"[Vector DB] Patched huggingface_hub http_backoff default max_retries -> {max_r} (HF_HUB_HTTP_MAX_RETRIES)")
    except Exception as e:
        print(f"[Vector DB] Warning: could not patch huggingface_hub http_backoff: {e}")


_patch_hf_hub_http_backoff()

# Import SentenceTransformer AFTER all environment variables and huggingface_hub are configured
from sentence_transformers import SentenceTransformer

# After import, verify and force endpoint configuration
try:
    from huggingface_hub import HfApi
    # Create an API instance to verify endpoint
    api = HfApi()
    actual_endpoint = getattr(api, 'endpoint', None) or getattr(api, '_endpoint', None)
    ep_env = (os.getenv("HF_ENDPOINT") or "").strip()
    if actual_endpoint and ep_env and "huggingface.co" in str(actual_endpoint) and "huggingface.co" not in ep_env:
        print(f"[Vector DB] WARNING: expected mirror {ep_env} but API reports {actual_endpoint}")
    else:
        print(f"[Vector DB] Verified huggingface_hub endpoint: {actual_endpoint or 'default'}")
except Exception as e:
    print(f"[Vector DB] Could not verify huggingface_hub endpoint: {e}")

# Initialize Supabase client
try:
    from .supabase_client import create_supabase_client
    supabase: Client = create_supabase_client()
    print("[Vector DB] Supabase client initialized")
except RuntimeError as e:
    print(f"[Vector DB] Warning: Failed to initialize Supabase client: {e}")
    print("[Vector DB] Vector DB will fail.")
    supabase = None

# CLIP: lazy-load on first embedding call (fast server startup). Tries multiple HF endpoints on download.
embedding_model = None
_embedding_load_attempted = False


def _apply_hf_hub_endpoint(ep: str) -> None:
    ep = ep.rstrip("/")
    os.environ["HF_ENDPOINT"] = ep
    try:
        from huggingface_hub import constants

        if hasattr(constants, "ENDPOINT"):
            constants.ENDPOINT = ep
        if hasattr(constants, "DEFAULT_ENDPOINT"):
            constants.DEFAULT_ENDPOINT = ep
    except Exception:
        pass


def _hf_endpoint_candidates() -> list[str]:
    """Order: explicit HF_ENDPOINT, HF_ENDPOINT_FALLBACKS, then defaults (order configurable)."""
    out: list[str] = []
    user = (os.getenv("HF_ENDPOINT") or "").strip().rstrip("/")
    if user:
        out.append(user)
    raw_fb = (os.getenv("HF_ENDPOINT_FALLBACKS") or "").strip()
    if raw_fb:
        for part in raw_fb.split(","):
            p = part.strip().rstrip("/")
            if p and p not in out:
                out.append(p)
    # When HF_ENDPOINT is unset, prefer mirror first (faster fallback if official hub TLS/proxy fails).
    order = (os.getenv("HF_HUB_TRY_ORDER") or os.getenv("HF_ENDPOINT_TRY_ORDER") or "").strip().lower()
    if order in ("official_first", "official", "hub_first"):
        default_pair = ("https://huggingface.co", "https://hf-mirror.com")
    elif order in ("mirror_first", "mirror", ""):
        default_pair = ("https://hf-mirror.com", "https://huggingface.co")
    else:
        default_pair = ("https://hf-mirror.com", "https://huggingface.co")
    for ep in default_pair:
        if ep not in out:
            out.append(ep)
    return out


def _validate_clip_sentence_transformer(m) -> None:
    """sentence_transformers may return a stub model without raising; reject wrong embedding size."""
    dim_fn = getattr(m, "get_sentence_embedding_dimension", None)
    if not callable(dim_fn):
        raise RuntimeError("loaded object has no get_sentence_embedding_dimension()")
    dim = dim_fn()
    # sentence-transformers clip-ViT-B-32 joint embedding dimension
    if dim != 512:
        raise RuntimeError(
            f"unexpected embedding dimension {dim} (expected 512 for clip-ViT-B-32); likely incomplete download or stub model"
        )


def get_embedding_model():
    """
    Load SentenceTransformer once. Offline cache path first (if complete), then network fallbacks.
    """
    global embedding_model, _embedding_load_attempted
    if _embedding_load_attempted:
        return embedding_model
    _embedding_load_attempted = True

    if cache_is_complete:
        try:
            print(f"[Vector DB] Loading CLIP from local cache (offline): {model_cache_path}")
            m = SentenceTransformer(MODEL_NAME, cache_folder=hf_cache_dir)
            _validate_clip_sentence_transformer(m)
            embedding_model = m
            print("[Vector DB] Successfully loaded CLIP from cache (offline)")
            return m
        except Exception as e:
            print(f"[Vector DB] Offline CLIP load failed: {str(e)[:400]}")
            if "HF_HUB_OFFLINE" in os.environ:
                del os.environ["HF_HUB_OFFLINE"]
            print("[Vector DB] Retrying download with endpoint fallback...")

    for ep in _hf_endpoint_candidates():
        try:
            _apply_hf_hub_endpoint(ep)
            print(f"[Vector DB] Loading CLIP (download) via {ep} ...")
            m = SentenceTransformer(MODEL_NAME, cache_folder=hf_cache_dir)
            _validate_clip_sentence_transformer(m)
            embedding_model = m
            print(f"[Vector DB] Successfully loaded CLIP via {ep}")
            return m
        except Exception as e:
            print(f"[Vector DB] CLIP load failed via {ep}: {str(e)[:350]}")

    embedding_model = None
    print("[Vector DB] Vector search will use mock embeddings.")
    print(
        "[Vector DB] Tip: SSLEOF — try HF_BYPASS_PROXY_FOR_HUB=1, HF_ENDPOINT=https://hf-mirror.com, "
        "HF_HUB_TRY_ORDER=official_first, or HF_ENDPOINT_FALLBACKS=https://hf-mirror.com"
    )
    return None


# For health check compatibility
collection = supabase if supabase else None

import requests
from io import BytesIO


def get_image_embedding(image_path_or_url: str) -> List[float]:
    """Generate CLIP embedding for an image."""
    model = get_embedding_model()
    if not model:
        return [0.0] * 512  # Fallback mock embedding

    try:
        img = None
        if image_path_or_url.startswith("http"):
            response = requests.get(image_path_or_url)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
        else:
            img = Image.open(image_path_or_url)

        embedding = model.encode(img)
        return embedding.tolist()
    except Exception as e:
        print(f"Error generating embedding for {image_path_or_url}: {e}")
        return [0.0] * 512


async def add_to_wardrobe(
    image_path: str, 
    features: Dict[str, Any], 
    user_id: str,
    gender: Optional[str] = None,
    model_id: Optional[str] = None,
    embedding: Optional[List[float]] = None
) -> str:
    """
    Add an item to the Supabase wardrobe_items table.
    Returns the generated Item ID.
    
    Args:
        image_path: URL or path to the image
        features: Dictionary containing item features (type, color, style, etc.)
        user_id: User ID who owns this item
        gender: Optional gender classification (male/female/both). If not provided, will try to get from features
        embedding: Optional pre-computed embedding. If not provided, will generate one from the image
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    item_id = str(uuid.uuid4())
    
    # Use provided embedding or generate new one
    if embedding is not None:
        final_embedding = embedding
    else:
        final_embedding = get_image_embedding(image_path)
    
    # Helper function to normalize values
    def normalize_value(value):
        """Convert array values to comma-separated string, keep strings as-is"""
        if isinstance(value, list):
            return ", ".join(str(v) for v in value) if value else None
        return str(value) if value else None
    
    # Get description from features (generated by Qwen-VL)
    description = features.get("description")  # Can be None if Qwen-VL didn't provide one
    
    # Determine gender: use provided parameter, or get from features, or default to 'both'
    if gender is not None:
        final_gender = gender
    elif "gender" in features:
        final_gender = features.get("gender", "Unisex")
    else:
        final_gender = "Unisex"
    
    # Validate gender value
    if final_gender not in ["Man's", "Women's", "Unisex"]:
        final_gender = "Unisex"  # Default to 'Unisex' if invalid value
    
    # Prepare data for Supabase
    item_data = {
        "id": item_id,
        "user_id": user_id,
        "image_url": image_path,
        "embedding": final_embedding,
        "type": normalize_value(features.get("type")),
        "color": normalize_value(features.get("color")),
        "style": normalize_value(features.get("style")),
        "occasion": normalize_value(features.get("occasion")),
        "pattern": normalize_value(features.get("pattern")),
        "material": normalize_value(features.get("material")),
        "description": description,
        "gender": final_gender,
        "model_id": (str(model_id).strip() if model_id else None),
    }
    
    response = supabase.table("wardrobe_items").insert(item_data).execute()
    
    return item_id


async def search_similar(item_id: str, k: int = 3, user_id: str = None) -> List[Dict[str, Any]]:
    """
    Search for similar items based on the item's embedding using pgvector.
    If user_id is provided, only search within that user's items.
    """
    if not supabase:
        return []
    
    try:
        # Get the item's embedding from the DB
        item_response = supabase.table("wardrobe_items").select("embedding, user_id").eq("id", item_id).execute()
        
        if not item_response.data or len(item_response.data) == 0:
            return []
        
        item = item_response.data[0]
        
        # Verify the item belongs to the user if user_id is provided
        if user_id and item.get("user_id") != user_id:
            return []
        
        query_embedding = item.get("embedding")
        if not query_embedding:
            return []
        
        # Use the RPC function for similarity search
        results = supabase.rpc("match_wardrobe_items", {
            "query_embedding": query_embedding,
            "match_threshold": 0.0,  # Return all matches
            "match_count": k + 1,  # +1 because it will find itself
            "filter_user_id": user_id or item.get("user_id")
        }).execute()
        
        formatted_results = []
        if results.data:
            for found_item in results.data:
                if str(found_item.get("id")) == item_id:
                    continue  # Skip self
                    
                formatted_results.append({
                    "id": str(found_item.get("id")),
                    "score": found_item.get("score", 0),
                    "path": found_item.get("image_url"),
                    "type": found_item.get("type"),
                    "color": found_item.get("color"),
                    "style": found_item.get("style"),
                    "occasion": found_item.get("occasion"),
                    "pattern": found_item.get("pattern"),
                    "material": found_item.get("material"),
                })
                
        return formatted_results[:k]
    except Exception as e:
        print(f"[Vector DB] Error in search_similar: {e}")
        return []


def search_by_text(query_text: str, k: int = 3, user_id: str = None) -> List[Dict[str, Any]]:
    """
    Search for items that match the text description using CLIP text embeddings.
    If user_id is provided, only search within that user's items.
    """
    model = get_embedding_model()
    if not model or not supabase:
        return []

    try:
        # Encode text query
        query_embedding = model.encode(query_text).tolist()
        
        # Use the RPC function for similarity search
        results = supabase.rpc("match_wardrobe_items", {
            "query_embedding": query_embedding,
            "match_threshold": 0.0,
            "match_count": k,
            "filter_user_id": user_id
        }).execute()
        
        formatted_results = []
        if results.data:
            for found_item in results.data:
                formatted_results.append({
                    "id": str(found_item.get("id")),
                    "score": found_item.get("score", 0),
                    "path": found_item.get("image_url"),
                    "type": found_item.get("type"),
                    "color": found_item.get("color"),
                    "style": found_item.get("style"),
                    "occasion": found_item.get("occasion"),
                    "pattern": found_item.get("pattern"),
                    "material": found_item.get("material"),
                })
                
        return formatted_results
    except Exception as e:
        print(f"Error searching by text '{query_text}': {e}")
        return []


def get_user_items(user_id: str, model_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all items belonging to a specific user.
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    try:
        query = supabase.table("wardrobe_items").select(
            "id, image_url, type, color, style, occasion, pattern, material, gender, description, created_at"
        ).eq("user_id", user_id)
        scoped_model_id = (str(model_id).strip() if model_id else "")
        if scoped_model_id:
            query = query.or_(f"model_id.is.null,model_id.eq.{scoped_model_id}")
        else:
            query = query.is_("model_id", "null")
        response = query.execute()
        
        formatted_results = []
        if response.data:
            for item in response.data:
                # Debug: log first item to check database values
                if len(formatted_results) == 0:
                    print(f"[Vector DB] First item from database (raw): {item}")
                    print(f"[Vector DB] Gender in item: {'gender' in item}, value: {item.get('gender')}, type: {type(item.get('gender'))}")
                    print(f"[Vector DB] Description in item: {'description' in item}, value: {item.get('description')}, type: {type(item.get('description'))}")
                
                # Get gender value - if None or missing, default to "Unisex"
                gender_value = item.get("gender")
                if gender_value is None:
                    gender_value = "Unisex"
                
                # Get description value - if None, keep as None (will be serialized as null)
                description_value = item.get("description")
                
                formatted_results.append({
                    "id": str(item.get("id")),
                    "path": item.get("image_url"),
                    "type": item.get("type"),
                    "color": item.get("color"),
                    "style": item.get("style"),
                    "occasion": item.get("occasion"),
                    "pattern": item.get("pattern"),
                    "material": item.get("material"),
                    "gender": gender_value,  # Always include, defaults to "Unisex" if None
                    "description": description_value,  # Include even if None (will be null in JSON)
                })
        
        print(f"[Vector DB] Retrieved {len(formatted_results)} items for user {user_id}")
        return formatted_results
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Vector DB] Error getting user items for {user_id}: {e}")
        print(f"[Vector DB] Traceback:\n{error_trace}")
        raise


def get_wardrobe_item_image_url_for_user(user_id: str, item_id: str) -> Optional[str]:
    """Return the stored image URL for a wardrobe row if it belongs to the user."""
    if not supabase:
        raise Exception("Supabase client not initialized")
    try:
        response = (
            supabase.table("wardrobe_items")
            .select("image_url")
            .eq("id", item_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        url = response.data[0].get("image_url")
        return str(url).strip() if url else None
    except Exception as e:
        print(f"[Vector DB] get_wardrobe_item_image_url_for_user failed: {e}")
        return None


def get_items_by_urls(image_urls: List[str], user_id: str) -> List[Dict[str, Any]]:
    """
    Get wardrobe items by their image URLs.
    Returns a list of items with their details including description.
    
    Args:
        image_urls: List of image URLs to query
        user_id: User ID to filter items (only returns items belonging to this user)
    
    Returns:
        List of item dictionaries with details, ordered by input URL order
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    if not image_urls:
        return []
    
    try:
        # Query items by image_url and user_id
        # Use 'in' filter to match any URL in the list
        response = supabase.table("wardrobe_items").select(
            "id, image_url, type, color, style, occasion, pattern, material, description"
        ).eq("user_id", user_id).in_("image_url", image_urls).execute()
        
        # Create a mapping from URL to item for quick lookup
        url_to_item = {}
        if response.data:
            for item in response.data:
                url = item.get("image_url")
                if url:
                    url_to_item[url] = {
                        "id": str(item.get("id")),
                        "image_url": url,
                        "type": item.get("type"),
                        "color": item.get("color"),
                        "style": item.get("style"),
                        "occasion": item.get("occasion"),
                        "pattern": item.get("pattern"),
                        "material": item.get("material"),
                        "description": item.get("description"),
                    }
        
        # Return items in the same order as input URLs
        result = []
        for url in image_urls:
            if url in url_to_item:
                result.append(url_to_item[url])
            else:
                # If URL not found, still include it with None values for optional logging
                result.append({
                    "id": None,
                    "image_url": url,
                    "type": None,
                    "color": None,
                    "style": None,
                    "occasion": None,
                    "pattern": None,
                    "material": None,
                    "description": None,
                })
        
        print(f"[Vector DB] Retrieved {len([r for r in result if r['id']])} items by URLs for user {user_id}")
        return result
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Vector DB] Error getting items by URLs for user {user_id}: {e}")
        print(f"[Vector DB] Traceback:\n{error_trace}")
        # Return empty list on error to allow try-on to continue
        return []


def _delete_user_items_sync(item_ids: List[str], user_id: str) -> int:
    """
    Synchronous helper function for deleting items.
    This is executed in a thread pool to avoid blocking the event loop.
    """
    if not supabase:
        return 0
    
    try:
        if not item_ids:
            return 0
        
        # Delete items that match the ids and user_id
        # RLS policy ensures only the user's items can be deleted
        response = supabase.table("wardrobe_items").delete().in_("id", item_ids).eq("user_id", user_id).execute()
        
        # Count deleted items
        deleted_count = len(response.data) if response.data else 0
        
        return deleted_count
    except Exception as e:
        print(f"Error deleting items: {e}")
        import traceback
        traceback.print_exc()
        raise  # Re-raise to be handled by async wrapper


async def delete_user_items(item_ids: List[str], user_id: str) -> int:
    """
    Delete items from the database asynchronously.
    Only deletes items that belong to the specified user.
    Returns the number of items successfully deleted.
    
    This function runs the synchronous Supabase operation in a thread pool
    to avoid blocking the async event loop, with a timeout to prevent hanging.
    """
    if not supabase:
        return 0
    
    if not item_ids:
        return 0
    
    try:
        # Run synchronous Supabase operation in thread pool with timeout
        # Timeout set to 20 seconds to prevent hanging requests
        deleted_count = await asyncio.wait_for(
            asyncio.to_thread(_delete_user_items_sync, item_ids, user_id),
            timeout=20.0
        )
        return deleted_count
    except asyncio.TimeoutError:
        print(f"Error deleting items: Operation timed out after 20 seconds for user {user_id}, items: {item_ids[:5]}...")
        raise Exception("Delete operation timed out. Please try again.")
    except Exception as e:
        print(f"Error deleting items: {e}")
        import traceback
        traceback.print_exc()
        raise


def get_user_items_with_embedding(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all items belonging to a specific user, including embedding.
    Used for importing example data functionality.
    
    Returns a list of dictionaries containing all item fields including embedding.
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    try:
        response = supabase.table("wardrobe_items").select(
            "id, image_url, type, color, style, occasion, pattern, material, description, gender, embedding"
        ).eq("user_id", user_id).execute()
        
        formatted_results = []
        if response.data:
            for item in response.data:
                formatted_results.append({
                    "id": str(item.get("id")),
                    "image_url": item.get("image_url"),
                    "type": item.get("type"),
                    "color": item.get("color"),
                    "style": item.get("style"),
                    "occasion": item.get("occasion"),
                    "pattern": item.get("pattern"),
                    "material": item.get("material"),
                    "description": item.get("description"),
                    "gender": item.get("gender", "Unisex"),  # Default to 'Unisex' for existing data
                    "embedding": item.get("embedding"),  # Include embedding
                })
        
        print(f"[Vector DB] Retrieved {len(formatted_results)} items with embedding for user {user_id}")
        return formatted_results
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Vector DB] Error getting user items with embedding for {user_id}: {e}")
        print(f"[Vector DB] Traceback:\n{error_trace}")
        raise


def _update_item_features_sync(
    item_id: str,
    user_id: str,
    features: Dict[str, Any]
) -> bool:
    """
    Synchronous helper function for updating item features.
    This is executed in a thread pool to avoid blocking the event loop.
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    try:
        # First verify the item belongs to the user
        verify_response = supabase.table("wardrobe_items").select("id").eq("id", item_id).eq("user_id", user_id).execute()
        
        if not verify_response.data or len(verify_response.data) == 0:
            print(f"[Vector DB] Item {item_id} not found or does not belong to user {user_id}")
            return False
        
        # Helper function to normalize values
        def normalize_value(value):
            """Convert array values to comma-separated string, keep strings as-is"""
            if isinstance(value, list):
                return ", ".join(str(v) for v in value) if value else None
            return str(value) if value else None
        
        # Prepare updates
        updates = {}
        
        # Only update fields that are present in features
        if "type" in features:
            updates["type"] = normalize_value(features["type"])
        if "color" in features:
            updates["color"] = normalize_value(features["color"])
        if "style" in features:
            updates["style"] = normalize_value(features["style"])
        if "pattern" in features:
            updates["pattern"] = normalize_value(features["pattern"])
        if "occasion" in features:
            updates["occasion"] = normalize_value(features["occasion"])
        if "material" in features:
            updates["material"] = normalize_value(features["material"])
        if "gender" in features:
            # Validate gender value
            gender_value = normalize_value(features["gender"])
            if gender_value and gender_value in ["Man's", "Women's", "Unisex"]:
                updates["gender"] = gender_value
        if "description" in features:
            # Description is a string, not an array
            desc_value = features["description"]
            updates["description"] = str(desc_value) if desc_value else None
        
        if not updates:
            print(f"[Vector DB] No valid fields to update for item {item_id}")
            return False
        
        # Update the item
        response = supabase.table("wardrobe_items").update(updates).eq("id", item_id).eq("user_id", user_id).execute()
        
        if response.data and len(response.data) > 0:
            print(f"[Vector DB] Successfully updated item {item_id}")
            return True
        else:
            print(f"[Vector DB] Update failed for item {item_id}")
            return False
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Vector DB] Error updating item {item_id}: {e}")
        print(f"[Vector DB] Traceback:\n{error_trace}")
        raise


async def update_item_features(
    item_id: str,
    user_id: str,
    features: Dict[str, Any]
) -> bool:
    """
    Update the features (type, color, style, etc.) of an item.
    This does NOT update the embedding, so vector search will remain unaffected.
    
    Args:
        item_id: The ID of the item to update
        user_id: User ID who owns this item (for authorization)
        features: Dictionary containing features to update (type, color, style, pattern, occasion, material)
    
    Returns:
        True if update was successful, False otherwise
    """
    try:
        # Run synchronous Supabase operation in thread pool with timeout
        # Timeout set to 20 seconds to prevent hanging requests
        success = await asyncio.wait_for(
            asyncio.to_thread(_update_item_features_sync, item_id, user_id, features),
            timeout=20.0
        )
        return success
    except asyncio.TimeoutError:
        print(f"[Vector DB] Error updating item {item_id}: Operation timed out after 20 seconds")
        raise Exception("Update operation timed out. Please try again.")
    except Exception as e:
        print(f"[Vector DB] Error updating item {item_id}: {e}")
        import traceback
        traceback.print_exc()
        raise