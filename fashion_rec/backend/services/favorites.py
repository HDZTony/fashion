"""
Favorites service - using Supabase for storage
"""
import os
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# Table name
TABLE_NAME = "favorites"

# Global Supabase client instance
_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_table = _client.table(TABLE_NAME)


def _create_authenticated_client(user_token: str) -> Client:
    """
    Create an authenticated Supabase client using user JWT token.
    Uses anon key to create client, then sets user session.
    """
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Set the user session with the JWT token to respect RLS policies
        # Note: set_session may fail if token is invalid/expired
        client.auth.set_session(access_token=user_token, refresh_token='')
        return client
    except Exception as e:
        print(f"[Favorites] Failed to create authenticated client: {e}")
        print(f"[Favorites] Token prefix: {user_token[:30] if user_token else 'None'}...")
        # Re-raise to let calling function handle it
        raise


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
    record = {
        "id": favorite_id,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **favorite,
    }
    
    try:
        if user_token:
            # Use authenticated client for RLS
            client = _create_authenticated_client(user_token)
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


def list_favorites(user_id: str, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
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
                client = _create_authenticated_client(user_token)
                table = client.table(TABLE_NAME)
            except Exception as auth_error:
                # If setting session fails (e.g., token invalid/expired), fall back to global client
                # This allows the query to proceed, but RLS may block it if using anon key
                print(f"[Favorites] Failed to create authenticated client, falling back to global client: {auth_error}")
                table = _table
        else:
            # Use global client (for background tasks)
            table = _table
        
        response = table.select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
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
            client = _create_authenticated_client(user_token)
            table = client.table(TABLE_NAME)
        else:
            # Use global client (for background tasks)
            table = _table
        
        response = table.delete().eq("id", favorite_id).eq("user_id", user_id).execute()
        return len(response.data) > 0 if response.data else False
    except Exception as e:
        print(f"[Favorites] Error deleting favorite: {e}")
        return False
