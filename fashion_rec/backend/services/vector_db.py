"""
Vector DB Service - Supabase pgvector Implementation
Replaces the ChromaDB implementation with Supabase for persistent vector storage.
"""
import os
from typing import Dict, Any, List
from pathlib import Path
import uuid
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============================================================================
# Configure Hugging Face environment variables BEFORE importing SentenceTransformer
# This is critical: sentence_transformers initializes huggingface_hub on import,
# so all environment variables must be set before the import.
# ============================================================================

# Set Hugging Face mirror endpoint (must be set before importing SentenceTransformer)
if not os.getenv("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    print("[Vector DB] Using Hugging Face mirror: https://hf-mirror.com")
else:
    print(f"[Vector DB] HF_ENDPOINT already set to: {os.getenv('HF_ENDPOINT')}")

# Disable HF Transfer for more reliable downloads
if not os.getenv("HF_HUB_ENABLE_HF_TRANSFER"):
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

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
    # Disable offline mode for initial download, but ensure mirror is used
    if "HF_HUB_OFFLINE" in os.environ:
        del os.environ["HF_HUB_OFFLINE"]
    print("[Vector DB] Model cache incomplete or missing, will download from mirror if needed")
    print(f"[Vector DB] Will use mirror endpoint: {os.getenv('HF_ENDPOINT', 'NOT SET!')}")
    if not os.getenv("HF_ENDPOINT"):
        print("[Vector DB] ERROR: HF_ENDPOINT not set! This will cause connection to huggingface.co!")

# Configure Hugging Face Hub HTTP retry strategy BEFORE importing SentenceTransformer
# Reduce retry attempts from default 5 to 2, increase timeout for slow connections (VPN)
# huggingface_hub uses requests/urllib3 internally, we patch it globally
# Also add URL rewriting to force use of mirror site
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    from urllib3.exceptions import ReadTimeoutError, ConnectTimeoutError
    
    # Get mirror endpoint
    mirror_endpoint = os.getenv("HF_ENDPOINT", "https://hf-mirror.com")
    
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
        """Rewrite huggingface.co URLs to use mirror site."""
        if isinstance(url, str) and 'huggingface.co' in url:
            # Replace huggingface.co with mirror endpoint
            new_url = url.replace('https://huggingface.co', mirror_endpoint)
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
    
    print(f"[Vector DB] Configured HTTP: retry=2, timeout=60s/120s, URL rewrite to {mirror_endpoint}")
    print("[Vector DB] All huggingface.co URLs will be automatically rewritten to mirror site")
except Exception as e:
    print(f"[Vector DB] Warning: Could not configure retry/timeout/URL rewrite: {e}")

# Import huggingface_hub and configure endpoint BEFORE importing SentenceTransformer
# This ensures the endpoint is set before any huggingface_hub initialization
try:
    import huggingface_hub
    from huggingface_hub import constants
    
    # Force set the endpoint via environment variable
    mirror_endpoint = "https://hf-mirror.com"
    if not os.getenv("HF_ENDPOINT"):
        os.environ["HF_ENDPOINT"] = mirror_endpoint
    
    # Try to set it directly in huggingface_hub constants if possible
    # This ensures it's used even if environment variable is read at import time
    if hasattr(constants, 'ENDPOINT'):
        constants.ENDPOINT = mirror_endpoint
    if hasattr(constants, 'DEFAULT_ENDPOINT'):
        constants.DEFAULT_ENDPOINT = mirror_endpoint
    
    print(f"[Vector DB] Configured huggingface_hub endpoint: {mirror_endpoint}")
except Exception as e:
    print(f"[Vector DB] Warning: Could not configure huggingface_hub endpoint: {e}")

# Import SentenceTransformer AFTER all environment variables and huggingface_hub are configured
from sentence_transformers import SentenceTransformer

# After import, verify and force endpoint configuration
try:
    from huggingface_hub import HfApi
    # Create an API instance to verify endpoint
    api = HfApi()
    actual_endpoint = getattr(api, 'endpoint', None) or getattr(api, '_endpoint', None)
    if actual_endpoint and 'huggingface.co' in actual_endpoint:
        print(f"[Vector DB] WARNING: huggingface_hub is still using {actual_endpoint}, not mirror!")
        print("[Vector DB] This may cause connection timeouts. Consider using offline mode if cache exists.")
    else:
        print(f"[Vector DB] Verified huggingface_hub endpoint: {actual_endpoint or 'using HF_ENDPOINT'}")
except Exception as e:
    print(f"[Vector DB] Could not verify huggingface_hub endpoint: {e}")

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[Vector DB] Warning: SUPABASE_URL or SUPABASE_KEY not set. Vector DB will fail.")
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[Vector DB] Supabase client initialized")

# Initialize CLIP model for embeddings
# Environment variables and cache check are already done above
embedding_model = None

try:
    if cache_is_complete:
        print(f"[Vector DB] Loading model from cache: {model_cache_path}")
    else:
        print(f"[Vector DB] Model cache not found or incomplete, will download to: {model_cache_path}")
    
    embedding_model = SentenceTransformer(MODEL_NAME, cache_folder=hf_cache_dir)
    print(f"[Vector DB] Successfully loaded CLIP model: {MODEL_NAME}")
except Exception as e:
    print(f"[Vector DB] Warning: Failed to load CLIP model {MODEL_NAME}: {e}")
    print("[Vector DB] Vector search will return mock results.")
    embedding_model = None

# For health check compatibility
collection = supabase if supabase else None

import requests
from io import BytesIO

def get_image_embedding(image_path_or_url: str) -> List[float]:
    """Generate CLIP embedding for an image."""
    if not embedding_model:
        return [0.0] * 512  # Fallback mock embedding
    
    try:
        img = None
        if image_path_or_url.startswith("http"):
            response = requests.get(image_path_or_url)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
        else:
            img = Image.open(image_path_or_url)
            
        embedding = embedding_model.encode(img)
        return embedding.tolist()
    except Exception as e:
        print(f"Error generating embedding for {image_path_or_url}: {e}")
        return [0.0] * 512


async def add_to_wardrobe(image_path: str, features: Dict[str, Any], user_id: str) -> str:
    """
    Add an item to the Supabase wardrobe_items table.
    Returns the generated Item ID.
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    item_id = str(uuid.uuid4())
    
    # Generate embedding
    embedding = get_image_embedding(image_path)
    
    # Helper function to normalize values
    def normalize_value(value):
        """Convert array values to comma-separated string, keep strings as-is"""
        if isinstance(value, list):
            return ", ".join(str(v) for v in value) if value else None
        return str(value) if value else None
    
    # Prepare data for Supabase
    item_data = {
        "id": item_id,
        "user_id": user_id,
        "image_url": image_path,
        "embedding": embedding,
        "type": normalize_value(features.get("type")),
        "color": normalize_value(features.get("color")),
        "style": normalize_value(features.get("style")),
        "occasion": normalize_value(features.get("occasion")),
        "pattern": normalize_value(features.get("pattern")),
        "material": normalize_value(features.get("material")),
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
    if not embedding_model or not supabase:
        return []
        
    try:
        # Encode text query
        query_embedding = embedding_model.encode(query_text).tolist()
        
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


def get_user_items(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all items belonging to a specific user.
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    try:
        response = supabase.table("wardrobe_items").select(
            "id, image_url, type, color, style, occasion, pattern, material, created_at"
        ).eq("user_id", user_id).execute()
        
        formatted_results = []
        if response.data:
            for item in response.data:
                formatted_results.append({
                    "id": str(item.get("id")),
                    "path": item.get("image_url"),
                    "type": item.get("type"),
                    "color": item.get("color"),
                    "style": item.get("style"),
                    "occasion": item.get("occasion"),
                    "pattern": item.get("pattern"),
                    "material": item.get("material"),
                })
        
        print(f"[Vector DB] Retrieved {len(formatted_results)} items for user {user_id}")
        return formatted_results
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Vector DB] Error getting user items for {user_id}: {e}")
        print(f"[Vector DB] Traceback:\n{error_trace}")
        raise


def delete_user_items(item_ids: List[str], user_id: str) -> int:
    """
    Delete items from the database.
    Only deletes items that belong to the specified user.
    Returns the number of items successfully deleted.
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
        return 0
