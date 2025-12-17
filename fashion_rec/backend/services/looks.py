"""
Looks service - using Supabase for storage
"""
import os
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# Table name
TABLE_NAME = "looks"

# Global Supabase client instance (for cleanup operations)
_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_table = _client.table(TABLE_NAME)


def _create_authenticated_client(user_token: str) -> Client:
    """
    Create an authenticated Supabase client using user JWT token.
    Uses anon key to create client, then sets user session.
    """
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Set the user session with the JWT token to respect RLS policies
    client.auth.set_session(access_token=user_token, refresh_token='')
    return client


def save_look(user_id: str, look: Dict[str, Any], user_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Persist a single outfit look for a user.
    
    Args:
        user_id: User ID
        look: Look data dictionary
        user_token: Optional JWT token for authenticated client (if None, uses global client)
    
    Returns:
        Saved look record with id and created_at
    """
    look_id = str(uuid.uuid4())
    record = {
        "id": look_id,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **look,
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
        print(f"[Looks] Error saving look: {e}")
        raise


def list_looks(user_id: str, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List saved looks for a user.
    
    Args:
        user_id: User ID
        user_token: Optional JWT token for authenticated client (if None, uses global client)
    
    Returns:
        List of look records
    """
    try:
        if user_token:
            # Use authenticated client for RLS
            client = _create_authenticated_client(user_token)
            table = client.table(TABLE_NAME)
        else:
            # Use global client (for background tasks)
            table = _table
        
        response = table.select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"[Looks] Error listing looks: {e}")
        return []


def get_look_by_id(look_id: str, user_id: str, user_token: Optional[str] = None) -> Dict[str, Any] | None:
    """
    Get a single look by ID for a user.
    Returns None if not found or doesn't belong to user.
    
    Args:
        look_id: Look ID
        user_id: User ID
        user_token: Optional JWT token for authenticated client (if None, uses global client)
    
    Returns:
        Look record or None
    """
    try:
        if user_token:
            # Use authenticated client for RLS
            client = _create_authenticated_client(user_token)
            table = client.table(TABLE_NAME)
        else:
            # Use global client (for background tasks)
            table = _table
        
        response = table.select("*").eq("id", look_id).eq("user_id", user_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        print(f"[Looks] Error getting look by ID: {e}")
        return None


def cleanup_expired_looks(
    resolve_retention_days,
    delete_file_func,
) -> int:
    """
    Physically delete looks (and related R2 assets) that exceed their retention.

    Args:
        resolve_retention_days: callable(user_id) -> int | None
        delete_file_func: callable(url) -> bool, used to delete scene images from R2

    Returns:
        Number of deleted looks
    """
    try:
        # Get all looks (using global client for cleanup)
        response = _table.select("*").execute()
        all_looks = response.data if response.data else []
        
        deleted = 0
        deleted_ids = []

        for look in all_looks:
            user_id = look.get("user_id")
            created_at = look.get("created_at")
            look_id = look.get("id")

            retention_days = resolve_retention_days(user_id) if user_id else None
            if not retention_days:
                continue

            try:
                if not isinstance(created_at, str):
                    continue
                created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
                if created_dt >= cutoff:
                    continue
            except Exception:
                # If parsing fails, skip to avoid accidental deletion
                continue

            # Delete associated scene image if any
            scene_url = look.get("scene_image_url")
            if scene_url:
                try:
                    delete_file_func(scene_url)
                except Exception:
                    # Best-effort; continue
                    pass

            # Mark for deletion
            deleted_ids.append(look_id)
            deleted += 1

        # Delete from database
        if deleted_ids:
            for look_id in deleted_ids:
                try:
                    _table.delete().eq("id", look_id).execute()
                except Exception as e:
                    print(f"[Looks] Error deleting look {look_id}: {e}")

        return deleted
    except Exception as e:
        print(f"[Looks] Error during cleanup: {e}")
        return 0
