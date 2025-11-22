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

async def add_to_wardrobe(image_path: str, features: Dict[str, Any]) -> str:
    """
    Add an item to the vector database (wardrobe).
    Returns the generated Item ID.
    """
    item_id = str(uuid.uuid4())
    
    # Generate embedding
    embedding = get_image_embedding(image_path)
    
    # Prepare metadata (flatten dictionary for ChromaDB)
    metadata = {
        "path": image_path,
        "type": features.get("type", "Unknown"),
        "color": features.get("color", "Unknown"),
        "style": features.get("style", "Unknown"),
        "occasion": features.get("occasion", "Unknown"),
        # Store full features as JSON string if needed, or just key fields
    }
    
    collection.add(
        documents=[image_path], # We can store path as document or just use metadata
        embeddings=[embedding],
        metadatas=[metadata],
        ids=[item_id]
    )
    
    return item_id

async def search_similar(item_id: str, k: int = 3) -> List[Dict[str, Any]]:
    """
    Search for similar items based on the item's embedding.
    """
    # Get the item's embedding from the DB
    item = collection.get(ids=[item_id], include=["embeddings"])
    
    if not item or not item["embeddings"]:
        return []
    
    query_embedding = item["embeddings"][0]
    
    # Query the collection
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=k + 1 # +1 because it will find itself
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

def search_by_text(query_text: str, k: int = 3) -> List[Dict[str, Any]]:
    """
    Search for items that match the text description using CLIP text embeddings.
    """
    if not embedding_model:
        return []
        
    try:
        # Encode text query
        query_embedding = embedding_model.encode(query_text).tolist()
        
        # Query the collection
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k
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

