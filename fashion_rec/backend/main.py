from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os
from pathlib import Path
from services.recognition import analyze_image
from services.vector_db import add_to_wardrobe, search_similar, get_user_items
from services.try_on import generate_try_on
from auth import get_current_user
from fastapi import Depends

app = FastAPI(title="Fashion Recommendation API")

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

class RecommendationRequest(BaseModel):
    item_id: Optional[str] = None
    occasion: str = "Casual"

@app.get("/")
def read_root():
    return {"message": "Fashion Recommendation API is running"}

@app.post("/upload")
async def upload_item(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    from services.storage import upload_file_to_r2
    try:
        # Upload to R2
        public_url = await upload_file_to_r2(file.file, file.filename, file.content_type)
        
        # Analyze image using the public URL (returns list of items)
        items_features = await analyze_image(public_url)
        
        # If only one item detected, auto-add it (maintain current UX)
        if len(items_features) == 1:
            features = items_features[0]
            # Check if there's an error in the features
            if "error" in features:
                raise HTTPException(status_code=500, detail=features.get("error", "Analysis failed"))
            
            # Add to Vector DB
            item_id = await add_to_wardrobe(public_url, features, user_id)
            
            return {
                "auto_added": True,
                "items": [{
                    "id": item_id,
                    "filename": file.filename,
                    "url": public_url,
                    "features": features,
                    "user_id": user_id
                }]
            }
        else:
            # Multiple items detected, return for user confirmation
            return {
                "auto_added": False,
                "items": [{
                    "filename": file.filename,
                    "url": public_url,
                    "features": features,
                    "user_id": user_id
                } for features in items_features if "error" not in features]
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend")
async def recommend_outfit(
    request: RecommendationRequest,
    user_id: str = Depends(get_current_user)
):
    from services.recognition import generate_compatibility_queries, generate_outfit_queries
    from services.vector_db import search_by_text, search_similar, collection

    recommendations = []
    strategy = ""

    # Scheme A: Item-based Compatibility
    if request.item_id:
        strategy = "Compatibility (Scheme A)"
        # 1. Get item features from DB
        item = collection.get(ids=[request.item_id], include=["metadatas"])
        if not item or not item["metadatas"]:
            raise HTTPException(status_code=404, detail="Item not found")
        
        item_features = item["metadatas"][0]
        
        # Verify the item belongs to the current user
        if item_features.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Item does not belong to current user")
        
        # 2. Generate queries for complementary items
        queries = await generate_compatibility_queries(item_features, request.occasion)
        
        # 3. Search for each query (filtered by user_id)
        for query in queries:
            results = search_by_text(query, k=1, user_id=user_id)
            if results:
                # Add the best match for this query
                rec = results[0]
                rec["reason"] = f"Matches '{query}'"
                recommendations.append(rec)

    # Scheme B: Full Outfit Generation
    else:
        strategy = "Full Outfit (Scheme B)"
        # 1. Generate queries for a full look
        queries = await generate_outfit_queries(request.occasion)
        
        # 2. Search for each query (filtered by user_id)
        for query in queries:
            results = search_by_text(query, k=1, user_id=user_id)
            if results:
                rec = results[0]
                rec["reason"] = f"Matches '{query}'"
                recommendations.append(rec)

    return {
        "strategy": strategy,
        "occasion": request.occasion,
        "recommendations": recommendations
    }

@app.post("/search")
async def search_items(query_image: UploadFile = File(...)):
    # Search by image
    pass

@app.post("/items/batch")
async def batch_add_items(
    items: List[Dict[str, Any]],
    user_id: str = Depends(get_current_user)
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
                user_id
            )
            added_items.append({
                "id": item_id,
                "url": item_data["url"],
                "features": item_data["features"],
                "user_id": user_id
            })
        
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
        print(f"Failed to get items: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/try-on")
async def try_on(person_image: UploadFile = File(...), garment_image: UploadFile = File(...)):
    # Call try-on service
    pass
