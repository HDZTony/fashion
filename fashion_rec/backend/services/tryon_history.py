"""
试穿历史记录服务
使用Supabase存储试穿历史
"""
import os
import json
from typing import Any, Dict, List
import uuid
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# 初始化Supabase客户端
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# 表名
TABLE_NAME = "tryon_history"
RETENTION_DAYS = 7  # Keep history for 7 days

# 全局Supabase客户端实例
_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_table = _client.table(TABLE_NAME)


def _ensure_table_exists():
    """
    检查表是否存在，如果不存在则提示用户创建
    """
    try:
        _table.select("id").limit(1).execute()
    except Exception as e:
        print(f"[Try-On History] Warning: Table '{TABLE_NAME}' may not exist. Please create it in Supabase Dashboard.")
        print(f"[Try-On History] Error: {e}")
        print(f"[Try-On History] See SQL migration script in migrate_history_tables.sql")


def _normalize_garment_urls(garment_urls: Any) -> List[str]:
    """
    规范化garment_urls格式，处理JSON字符串或数组
    """
    if garment_urls is None:
        return []
    if isinstance(garment_urls, str):
        try:
            return json.loads(garment_urls)
        except:
            return []
    if isinstance(garment_urls, list):
        return garment_urls
    return []


def _normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    规范化记录格式，确保garment_urls是数组格式
    """
    if 'garment_urls' in record:
        record['garment_urls'] = _normalize_garment_urls(record['garment_urls'])
    return record


def _cleanup_expired() -> None:
    """
    Remove expired records (older than RETENTION_DAYS).
    """
    try:
        cutoff_date = (datetime.utcnow() - timedelta(days=RETENTION_DAYS)).isoformat() + "Z"
        # Delete expired records
        response = _table.delete().lt("created_at", cutoff_date).execute()
        deleted_count = len(response.data) if response.data else 0
        if deleted_count > 0:
            print(f"[Try-On History] Cleaned up {deleted_count} expired records")
    except Exception as e:
        print(f"[Try-On History] Error cleaning up expired records: {e}")


def save_tryon_history(user_id: str, history: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persist a single try-on history record for a user.
    Automatically cleans up expired records before saving.
    """
    try:
        # Clean up expired records first
        _cleanup_expired()
        
        # Ensure table exists
        _ensure_table_exists()
        
        # Prepare record data
        history_id = str(uuid.uuid4())
        garment_urls = history.get("garment_urls", [])
        # Normalize garment_urls to list
        if isinstance(garment_urls, str):
            garment_urls = json.loads(garment_urls)
        
        record = {
            "id": history_id,
            "user_id": user_id,
            "image_url": history.get("image_url", ""),
            "garment_urls": garment_urls,
            "scene_image_url": history.get("scene_image_url"),
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        
        # Insert into database
        response = _table.insert(record).execute()
        if response.data and len(response.data) > 0:
            saved_record = _normalize_record(response.data[0])
            print(f"[Try-On History] Saved history record {history_id} for user {user_id}")
            return saved_record
        else:
            raise RuntimeError("Failed to insert tryon history: no data returned")
    except Exception as e:
        import traceback
        print(f"[Try-On History] Error saving history: {e}")
        print(f"[Try-On History] Traceback: {traceback.format_exc()}")
        raise


def list_tryon_history(user_id: str) -> List[Dict[str, Any]]:
    """
    List try-on history for a user.
    Automatically filters out expired records (older than RETENTION_DAYS).
    """
    try:
        # Clean up expired records first
        _cleanup_expired()
        
        # Ensure table exists
        _ensure_table_exists()
        
        # Calculate cutoff date
        cutoff_date = (datetime.utcnow() - timedelta(days=RETENTION_DAYS)).isoformat() + "Z"
        
        # Query user's history, excluding expired records
        response = _table.select("*").eq("user_id", user_id).gte("created_at", cutoff_date).order("created_at", desc=True).execute()
        
        if response.data:
            return [_normalize_record(record) for record in response.data]
        return []
    except Exception as e:
        print(f"[Try-On History] Error listing history: {e}")
        return []


def delete_tryon_history(user_id: str, history_id: str) -> bool:
    """
    Delete a try-on history record by ID.
    Returns True if deleted, False if not found.
    """
    try:
        _ensure_table_exists()
        
        # Delete the record (RLS will ensure user can only delete their own records)
        response = _table.delete().eq("id", history_id).eq("user_id", user_id).execute()
        return len(response.data) > 0 if response.data else False
    except Exception as e:
        print(f"[Try-On History] Error deleting history: {e}")
        return False
