import chromadb
from chromadb.utils import embedding_functions
from typing import Dict, Any, List
import uuid
import os
from PIL import Image
from sentence_transformers import SentenceTransformer

# Initialize ChromaDB
# Persistent client to save data to disk
# Use environment variable for path, default to local "chroma_db"
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "chroma_db")
CHROMA_CLIENT = chromadb.PersistentClient(path=CHROMA_DB_PATH)

# Initialize CLIP model for embeddings
# We use a small, efficient CLIP model
# Initialize CLIP model for embeddings
# We use a small, efficient CLIP model
MODEL_NAME = "clip-ViT-B-32"
embedding_model = None

try:
    # Try to load the model
    # If network fails, it might raise an error or return a broken model
    embedding_model = SentenceTransformer(MODEL_NAME)
except Exception as e:
    print(f"Warning: Failed to load CLIP model {MODEL_NAME}: {e}")
    print("Vector search will return mock results. Check your internet connection or HuggingFace access.")
    embedding_model = None

import requests
from io import BytesIO

def get_image_embedding(image_path_or_url: str) -> List[float]:
    if not embedding_model:
        return [0.0] * 512 # Fallback mock embedding
    
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

# Create or get collection
collection = CHROMA_CLIENT.get_or_create_collection(
    name="wardrobe",
    metadata={"hnsw:space": "cosine"} # Use cosine similarity
)

async def add_to_wardrobe(image_path: str, features: Dict[str, Any], user_id: str) -> str:
    """
    Add an item to the vector database (wardrobe).
    Returns the generated Item ID.
    """
    item_id = str(uuid.uuid4())
    
    # Generate embedding
    embedding = get_image_embedding(image_path)
    
    # Helper function to convert array values to string for ChromaDB
    def normalize_value(value):
        """Convert array values to comma-separated string, keep strings as-is"""
        if isinstance(value, list):
            return ", ".join(str(v) for v in value) if value else "Unknown"
        return str(value) if value else "Unknown"
    
    # Prepare metadata (flatten dictionary for ChromaDB)
    # ChromaDB metadata values must be strings, numbers, or booleans
    # Convert arrays to comma-separated strings
    metadata = {
        "path": image_path,
        "type": normalize_value(features.get("type", "Unknown")),
        "color": normalize_value(features.get("color", "Unknown")),
        "style": normalize_value(features.get("style", "Unknown")),
        "occasion": normalize_value(features.get("occasion", "Unknown")),
        "pattern": normalize_value(features.get("pattern", "Unknown")),  # Pattern: Solid, Striped, Floral, etc.
        "material": normalize_value(features.get("material", "Unknown")),  # Material: Cotton, Denim, Silk, etc.
        "user_id": user_id,  # Store user_id for filtering
    }
    
    collection.add(
        documents=[image_path], # We can store path as document or just use metadata
        embeddings=[embedding],
        metadatas=[metadata],
        ids=[item_id]
    )
    
    return item_id

async def search_similar(item_id: str, k: int = 3, user_id: str = None) -> List[Dict[str, Any]]:
    """
    Search for similar items based on the item's embedding.
    If user_id is provided, only search within that user's items.
    """
    # Get the item's embedding from the DB
    item = collection.get(ids=[item_id], include=["embeddings", "metadatas"])
    
    if not item or not item["embeddings"]:
        return []
    
    # Verify the item belongs to the user if user_id is provided
    if user_id and item.get("metadatas") and item["metadatas"][0].get("user_id") != user_id:
        return []
    
    query_embedding = item["embeddings"][0]
    
    # Build where clause for user filtering
    where_clause = None
    if user_id:
        where_clause = {"user_id": user_id}
    
    # Query the collection
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=k + 1, # +1 because it will find itself
        where=where_clause
    )
    
    formatted_results = []
    if results["ids"]:
        ids = results["ids"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]
        
        for i, found_id in enumerate(ids):
            if found_id == item_id:
                continue # Skip self
                
            formatted_results.append({
                "id": found_id,
                "score": 1 - distances[i], # Convert distance to similarity score
                **metadatas[i]
            })
            
    return formatted_results[:k]

def search_by_text(query_text: str, k: int = 3, user_id: str = None) -> List[Dict[str, Any]]:
    """
    Search for items that match the text description using CLIP text embeddings.
    If user_id is provided, only search within that user's items.
    """
    if not embedding_model:
        return []
        
    try:
        # Encode text query
        query_embedding = embedding_model.encode(query_text).tolist()
        
        # Build where clause for user filtering
        where_clause = None
        if user_id:
            where_clause = {"user_id": user_id}
        
        # Query the collection
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=where_clause
        )
        
        formatted_results = []
        if results["ids"]:
            ids = results["ids"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]
            
            for i, found_id in enumerate(ids):
                formatted_results.append({
                    "id": found_id,
                    "score": 1 - distances[i],
                    **metadatas[i]
                })
                
        return formatted_results
    except Exception as e:
        print(f"Error searching by text '{query_text}': {e}")
        return []


def get_user_items(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all items belonging to a specific user.
    """
    try:
        results = collection.get(
            where={"user_id": user_id},
            include=["metadatas"]
        )
        
        formatted_results = []
        if results["ids"]:
            ids = results["ids"]
            metadatas = results["metadatas"]
            
            for i, item_id in enumerate(ids):
                formatted_results.append({
                    "id": item_id,
                    **metadatas[i]
                })
                
        return formatted_results
    except Exception as e:
        print(f"Error getting user items: {e}")
        return []

