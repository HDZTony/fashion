"""
Favorites service - using Supabase for storage
"""
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timezone
from supabase import Client
from .supabase_client import create_supabase_client, create_authenticated_client

# Table name
TABLE_NAME = "favorites"

# Global Supabase client instance
_client: Client = create_supabase_client()
_table = _client.table(TABLE_NAME)


def save_favorite(user_id: str, favorite: Dict[str, Any], user_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Persist a single favorite try-on result for a user.
    
    Args:
        user_id: User ID
        favorite: Favorite data dictionary (image_url, title)
        user_token: Optional JWT token for authenticated client (if None, uses global client)
    
    Returns:
        Saved favorite record with id and created_at
    """
    favorite_id = str(uuid.uuid4())
    model_id = favorite.get("model_id")
    scoped_model_id = str(model_id).strip() if model_id else None
    record = {
        "id": favorite_id,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **favorite,
        "model_id": scoped_model_id,
    }
    
    try:
        if user_token:
            # Use authenticated client for RLS
            client = create_authenticated_client(user_token)
            table = client.table(TABLE_NAME)
        else:
            # Use global client (for background tasks)
            table = _table
        
        response = table.insert(record).execute()
        if response.data:
            return response.data[0]
        return record
    except Exception as e:
        print(f"[Favorites] Error saving favorite: {e}")
        raise


def list_favorites(user_id: str, user_token: Optional[str] = None, model_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List saved favorites for a user.
    
    Args:
        user_id: User ID
        user_token: Optional JWT token for authenticated client (if None, uses global client)
    
    Returns:
        List of favorite records
    """
    try:
        if user_token:
            try:
                # Use authenticated client for RLS
                client = create_authenticated_client(user_token)
                table = client.table(TABLE_NAME)
            except Exception as auth_error:
                # If setting session fails (e.g., token invalid/expired), fall back to global client
                # This allows the query to proceed, but RLS may block it if using anon key
                print(f"[Favorites] Failed to create authenticated client, falling back to global client: {auth_error}")
                table = _table
        else:
            # Use global client (for background tasks)
            table = _table
        
        query = table.select("*").eq("user_id", user_id).order("created_at", desc=True)
        scoped_model_id = str(model_id).strip() if model_id else ""
        if scoped_model_id:
            query = query.or_(f"model_id.is.null,model_id.eq.{scoped_model_id}")
        else:
            query = query.is_("model_id", "null")
        response = query.execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"[Favorites] Error listing favorites: {e}")
        return []


def delete_favorite(user_id: str, favorite_id: str, user_token: Optional[str] = None) -> bool:
    """
    Delete a favorite by ID.
    Returns True if deleted, False if not found.
    
    Args:
        user_id: User ID
        favorite_id: Favorite ID
        user_token: Optional JWT token for authenticated client (if None, uses global client)
    
    Returns:
        True if deleted, False otherwise
    """
    try:
        if user_token:
            # Use authenticated client for RLS
            client = create_authenticated_client(user_token)
            table = client.table(TABLE_NAME)
        else:
            # Use global client (for background tasks)
            table = _table
        
        response = table.delete().eq("id", favorite_id).eq("user_id", user_id).execute()
        return len(response.data) > 0 if response.data else False
    except Exception as e:
        print(f"[Favorites] Error deleting favorite: {e}")
        return False
