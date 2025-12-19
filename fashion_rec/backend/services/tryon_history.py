"""
试穿历史记录服务
使用Supabase存储试穿历史
根据用户订阅类型设置不同的保存时间：
- Free: 7天
- Premium ($5): 90天
- Premium Plus ($15): 365天
"""
import os
import json
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx

load_dotenv()

# 初始化Supabase客户端
SUPABASE_URL = os.getenv("SUPABASE_URL")
# 优先使用 service role key（服务器端操作需要绕过 RLS）
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")

# 表名
TABLE_NAME = "tryon_history"

# 默认保留天数（免费用户）
DEFAULT_RETENTION_DAYS = 7

# 订阅类型对应的保留天数
PLAN_RETENTION_DAYS = {
    "Free": 7,
    "Premium": 90,
    "Premium Plus": 365,
    # 兼容小写和不同格式
    "free": 7,
    "premium": 90,
    "premium_plus": 365,
}

# 全局Supabase客户端实例
_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_table = _client.table(TABLE_NAME)


def _get_retention_days_for_user(user_id: str) -> int:
    """
    根据用户订阅类型获取保留天数。
    如果无法获取订阅信息，返回默认的7天。
    """
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        resp = httpx.get(
            f"{SUBSCRIPTION_SERVICE_URL}/subscription/status",
            params={"user_id": user_id},
            timeout=5.0,
        )
        if resp.status_code == 200:
            plan_name = resp.json().get("planName")
            if plan_name:
                return PLAN_RETENTION_DAYS.get(plan_name, DEFAULT_RETENTION_DAYS)
    except Exception as e:
        print(f"[Try-On History] Failed to get subscription status for user {user_id}: {e}")
    return DEFAULT_RETENTION_DAYS


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


def _cleanup_expired(user_id: Optional[str] = None) -> None:
    """
    Remove expired records based on user's subscription plan.
    If user_id is provided, only cleans up that user's expired records using their retention period.
    Otherwise, cleans up all expired records using the minimum retention period (7 days).
    """
    try:
        if user_id:
            # Use user-specific retention period
            retention_days = _get_retention_days_for_user(user_id)
        else:
            # Use minimum retention period for global cleanup
            retention_days = DEFAULT_RETENTION_DAYS
        
        cutoff_date = (datetime.utcnow() - timedelta(days=retention_days)).isoformat() + "Z"
        # Delete expired records
        query = _table.delete().lt("created_at", cutoff_date)
        if user_id:
            query = query.eq("user_id", user_id)
        response = query.execute()
        deleted_count = len(response.data) if response.data else 0
        if deleted_count > 0:
            print(f"[Try-On History] Cleaned up {deleted_count} expired records (retention: {retention_days} days)")
    except Exception as e:
        print(f"[Try-On History] Error cleaning up expired records: {e}")


def save_tryon_history(user_id: str, history: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persist a single try-on history record for a user.
    Automatically cleans up expired records before saving.
    Retention period is determined by user's subscription plan:
    - Free: 7 days
    - Premium: 90 days
    - Premium Plus: 365 days
    """
    try:
        # Clean up expired records for this user first
        _cleanup_expired(user_id)
        
        # Ensure table exists
        _ensure_table_exists()
        
        # Prepare record data
        history_id = str(uuid.uuid4())
        garment_urls = history.get("garment_urls", [])
        # Normalize garment_urls to list
        if isinstance(garment_urls, str):
            garment_urls = json.loads(garment_urls)
        
        # Get retention days for this user (for logging)
        retention_days = _get_retention_days_for_user(user_id)
        
        record = {
            "id": history_id,
            "user_id": user_id,
            "image_url": history.get("image_url", ""),
            "garment_urls": garment_urls,  # Selected items from Applied Outfit Items (JSONB array)
            "scene_image_url": history.get("scene_image_url"),
            "prompt": history.get("prompt"),  # User's custom prompt (optional)
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        
        # Insert into database
        response = _table.insert(record).execute()
        if response.data and len(response.data) > 0:
            saved_record = _normalize_record(response.data[0])
            print(f"[Try-On History] Saved history record {history_id} for user {user_id} (retention: {retention_days} days)")
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
    Automatically filters out expired records based on user's subscription plan.
    """
    try:
        # Clean up expired records for this user first
        _cleanup_expired(user_id)
        
        # Ensure table exists
        _ensure_table_exists()
        
        # Get retention days for this user
        retention_days = _get_retention_days_for_user(user_id)
        
        # Calculate cutoff date based on user's subscription plan
        cutoff_date = (datetime.utcnow() - timedelta(days=retention_days)).isoformat() + "Z"
        
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
