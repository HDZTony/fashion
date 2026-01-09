"""
用户图片历史服务
使用Supabase存储用户图片历史
"""
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta
from supabase import Client
from .supabase_client import create_supabase_client, create_authenticated_client

# 表名
TABLE_NAME = "user_images"

# 全局Supabase客户端实例（仅用于 cleanup_expired_images）
_client: Client = create_supabase_client()
_table = _client.table(TABLE_NAME)


def save_user_image(user_id: str, image_url: str, image_type: str, user_token: str, r2_filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Save a user image (scene or model) to history.
    image_type: "scene" or "model"
    user_token: JWT token for authenticated Supabase client (respects RLS policies)
    r2_filename: Optional R2 filename for deletion purposes
    """
    try:
        # Create authenticated client with user token
        client = create_authenticated_client(user_token)
        table = client.table(TABLE_NAME)
        
        image_id = str(uuid.uuid4())
        # Both model and scene images are permanent (no expiration)
        expires_at = None
        record = {
            "id": image_id,
            "user_id": user_id,
            "image_url": image_url,
            "image_type": image_type,  # "scene" or "model"
            "r2_filename": r2_filename,  # R2 filename for deletion
            "created_at": datetime.utcnow().isoformat() + "Z",
            "expires_at": expires_at,  # None for all images (permanent storage)
        }
        
        # Insert into database
        response = table.insert(record).execute()
        if response.data and len(response.data) > 0:
            print(f"[User Images] Saved image {image_id} for user {user_id}")
            return response.data[0]
        else:
            raise RuntimeError("Failed to insert user image: no data returned")
    except Exception as e:
        print(f"[User Images] Error saving image: {e}")
        raise


def list_user_images(user_id: str, user_token: str, image_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List user images, optionally filtered by type.
    Filters out expired images automatically.
    user_token: JWT token for authenticated Supabase client (respects RLS policies)
    image_type: "scene", "model", or None for all
    """
    try:
        # Create authenticated client with user token
        client = create_authenticated_client(user_token)
        table = client.table(TABLE_NAME)
        
        current_time = datetime.utcnow().isoformat() + "Z"
        
        # Build query
        query = table.select("*").eq("user_id", user_id)
        
        # Filter out expired images
        query = query.or_("expires_at.is.null,expires_at.gt." + current_time)
        
        # Filter by type if specified
        if image_type:
            query = query.eq("image_type", image_type)
        
        # Order by created_at descending (newest first)
        query = query.order("created_at", desc=True)
        
        response = query.execute()
        
        if response.data:
            # Additional client-side filtering for expired images (double check)
            filtered = []
            for img in response.data:
                expires_at_str = img.get("expires_at")
                if expires_at_str:
                    try:
                        expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                        expires_at_utc = expires_at.replace(tzinfo=None)
                        current_utc = datetime.utcnow()
                        if current_utc >= expires_at_utc:
                            continue  # Skip expired images
                    except Exception:
                        pass  # If parsing fails, include the image
                filtered.append(img)
            return filtered
        return []
    except Exception as e:
        print(f"[User Images] Error listing images: {e}")
        return []


def delete_user_image(user_id: str, image_id: str, user_token: str) -> bool:
    """
    Delete a user image by ID.
    Also deletes the file from R2 if r2_filename is available.
    Returns True if deleted, False if not found or not owned by user.
    user_token: JWT token for authenticated Supabase client (respects RLS policies)
    """
    try:
        # Create authenticated client with user token
        client = create_authenticated_client(user_token)
        table = client.table(TABLE_NAME)
        
        # First, get the image to check if it exists and get R2 filename
        response = table.select("*").eq("id", image_id).eq("user_id", user_id).execute()
        
        if not response.data or len(response.data) == 0:
            return False
        
        image_to_delete = response.data[0]
        
        # Delete from R2 if filename is available
        r2_filename = image_to_delete.get("r2_filename")
        if r2_filename:
            try:
                from services.storage import delete_file_from_r2_by_url
                image_url = image_to_delete.get("image_url")
                if image_url:
                    delete_file_from_r2_by_url(image_url)
            except Exception as e:
                print(f"[User Images] Failed to delete R2 file {r2_filename}: {e}")
                # Continue with database deletion even if R2 deletion fails
        
        # Delete from database (RLS will ensure user can only delete their own records)
        delete_response = table.delete().eq("id", image_id).eq("user_id", user_id).execute()
        return len(delete_response.data) > 0 if delete_response.data else False
    except Exception as e:
        print(f"[User Images] Error deleting image: {e}")
        return False


def cleanup_expired_images():
    """
    Cleanup expired images from the database.
    Note: Both model and scene images are now permanent (no expiration).
    This function only cleans up old records that were created before the permanent storage change
    and still have expires_at set. New images will have expires_at = NULL and will never be deleted.
    This should be called periodically along with R2 cleanup.
    Note: This function uses the global client (anon key) as it's a background task.
    """
    try:
        # Use global client for cleanup (no user token needed for background tasks)
        _table.select("id").limit(1).execute()
        
        current_time = datetime.utcnow().isoformat() + "Z"
        
        # Get expired images - only old records that still have expires_at set
        # New images have expires_at = NULL and will never match this query
        # This is for backward compatibility with old records created before permanent storage
        response = _table.select("*").lt("expires_at", current_time).execute()
        
        if not response.data:
            return 0
        
        deleted_count = 0
        for img in response.data:
            # Try to delete from R2 first
            r2_filename = img.get("r2_filename")
            if r2_filename:
                try:
                    from services.storage import delete_file_from_r2_by_url
                    image_url = img.get("image_url")
                    if image_url:
                        delete_file_from_r2_by_url(image_url)
                except Exception as e:
                    print(f"[User Images] Failed to delete expired R2 file {r2_filename}: {e}")
            
            # Delete from database
            try:
                delete_response = _table.delete().eq("id", img.get("id")).execute()
                if delete_response.data:
                    deleted_count += 1
            except Exception as e:
                print(f"[User Images] Failed to delete expired image {img.get('id')}: {e}")
        
        if deleted_count > 0:
            print(f"[User Images] Cleaned up {deleted_count} expired image(s) from database")
        return deleted_count
    except Exception as e:
        print(f"[User Images] Error cleaning up expired images: {e}")
        return 0
