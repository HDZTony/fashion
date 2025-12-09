"""
Vector DB Service - Supabase pgvector Implementation
Replaces the ChromaDB implementation with Supabase for persistent vector storage.
"""
import os
from typing import Dict, Any, List
import uuid
from PIL import Image
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[Vector DB] Warning: SUPABASE_URL or SUPABASE_KEY not set. Vector DB will fail.")
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[Vector DB] Supabase client initialized")

# Set Hugging Face mirror to avoid SSL issues (if not already set)
if not os.getenv("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    print("[Vector DB] Using Hugging Face mirror: https://hf-mirror.com")

# Set Hugging Face cache directory
hf_cache_dir = os.getenv("HF_HOME") or os.path.expanduser("~/.cache/huggingface")
print(f"[Vector DB] Hugging Face cache directory: {hf_cache_dir}")

# Initialize CLIP model for embeddings
MODEL_NAME = "clip-ViT-B-32"
embedding_model = None

try:
    from pathlib import Path
    model_cache_path = Path(hf_cache_dir) / "hub" / f"models--sentence-transformers--{MODEL_NAME.replace('/', '--')}"
    if model_cache_path.exists():
        print(f"[Vector DB] Model cache found at: {model_cache_path}")
        print("[Vector DB] Loading from cache (no download needed)")
    else:
        print("[Vector DB] Model not in cache, will download once...")
    
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
