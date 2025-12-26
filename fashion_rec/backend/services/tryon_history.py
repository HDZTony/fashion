"""
试穿历史记录服务
使用Supabase存储试穿历史
根据用户订阅类型设置不同的保存时间：
- Free: 30天
- Premium ($5): 360天
- Premium Plus ($15): 540天
- Premium Pro ($29.9): 540天
"""
import os
import json
import logging
import sys
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx

load_dotenv()

# 配置日志，确保输出到 stdout（Fly.io 会捕获 stdout）
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

# 初始化Supabase客户端
SUPABASE_URL = os.getenv("SUPABASE_URL")
# 优先使用 service role key（如果可用），否则使用 anon key
# 注意：使用 anon key 时，RLS 策略会确保用户只能访问自己的数据
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

# 表名
TABLE_NAME = "tryon_history"

# 默认保留天数（免费用户）
DEFAULT_RETENTION_DAYS = 30

# 订阅类型对应的保留天数
PLAN_RETENTION_DAYS = {
    "Free": 30,
    "Premium": 360,
    "Premium Plus": 540,
    "Premium Pro": 540,
    # 兼容小写和不同格式
    "free": 30,
    "premium": 360,
    "premium_plus": 540,
    "premium_pro": 540,
}

# 全局Supabase客户端实例（用于不需要用户认证的操作，如清理过期记录）
_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_table = _client.table(TABLE_NAME)


def _create_authenticated_client(user_token: str) -> Client:
    """
    创建使用用户 JWT token 认证的 Supabase 客户端。
    使用 anon key 创建客户端，然后设置用户会话以尊重 RLS 策略。
    这样 auth.uid() 在 RLS 策略中才能正确工作。
    """
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Set the user session with the JWT token to respect RLS policies
    # This allows auth.uid() in RLS policies to work correctly
    client.auth.set_session(access_token=user_token, refresh_token='')
    return client


def _get_retention_days_for_user(user_id: str) -> int:
    """
    根据用户订阅类型获取保留天数。
    仅在保存历史记录时调用，用于计算 expires_at。
    如果无法获取订阅信息，返回默认的30天。
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
        logger.debug(f"[Try-On History] Failed to get subscription status for user {user_id}: {e}")
    return DEFAULT_RETENTION_DAYS


def _ensure_table_exists():
    """
    检查表是否存在，如果不存在则提示用户创建
    """
    try:
        _table.select("id").limit(1).execute()
    except Exception as e:
        logger.warning(f"[Try-On History] Warning: Table '{TABLE_NAME}' may not exist. Error: {e}")


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


def _cleanup_expired(user_id: Optional[str] = None) -> int:
    """
    Remove expired records based on expires_at field.
    Also deletes corresponding R2 files (image_url and scene_image_url).
    If user_id is provided, only cleans up that user's expired records.
    Otherwise, cleans up all expired records.
    
    Returns:
        Number of deleted records
    """
    try:
        from services.storage import delete_file_from_r2_by_url
        
        # Query expired records (expires_at < now)
        now = datetime.utcnow().isoformat() + "Z"
        cutoff_30_days = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"
        
        expired_records = []
        seen_ids = set()
        
        # Query records where expires_at < now
        query1 = _table.select("*").lt("expires_at", now)
        if user_id:
            query1 = query1.eq("user_id", user_id)
        response1 = query1.execute()
        if response1.data:
            for record in response1.data:
                record_id = record.get("id")
                if record_id and record_id not in seen_ids:
                    expired_records.append(record)
                    seen_ids.add(record_id)
        
        # Also query records with NULL expires_at (backward compatibility)
        # First get all records with NULL expires_at, then filter by created_at in Python
        query2 = _table.select("*").is_("expires_at", "null")
        if user_id:
            query2 = query2.eq("user_id", user_id)
        response2 = query2.execute()
        if response2.data:
            for record in response2.data:
                # Only include if created_at < 30 days ago (backward compatibility)
                created_at = record.get("created_at", "")
                if created_at and created_at < cutoff_30_days:
                    record_id = record.get("id")
                    if record_id and record_id not in seen_ids:
                        expired_records.append(record)
                        seen_ids.add(record_id)
        
        deleted_count = 0
        for record in expired_records:
            try:
                # Delete R2 files if they exist
                image_url = record.get("image_url")
                if image_url:
                    try:
                        delete_file_from_r2_by_url(image_url)
                    except Exception as e:
                        logger.warning(f"[Try-On History] Failed to delete R2 file {image_url}: {e}")
                        # Continue with database deletion even if R2 deletion fails
                
                scene_image_url = record.get("scene_image_url")
                if scene_image_url:
                    try:
                        delete_file_from_r2_by_url(scene_image_url)
                    except Exception as e:
                        logger.warning(f"[Try-On History] Failed to delete R2 file {scene_image_url}: {e}")
                        # Continue with database deletion even if R2 deletion fails
                
                # Delete from database
                record_id = record.get("id")
                if record_id:
                    try:
                        delete_response = _table.delete().eq("id", record_id).execute()
                        if delete_response.data:
                            deleted_count += 1
                    except Exception as e:
                        logger.error(f"[Try-On History] Error deleting record {record.get('id')}: {e}")
            except Exception as e:
                logger.error(f"[Try-On History] Error processing record {record.get('id')}: {e}")
                continue
        
        if deleted_count > 0:
            logger.info(f"[Try-On History] Cleaned up {deleted_count} expired records")
        return deleted_count
    except Exception as e:
        logger.error(f"[Try-On History] Error cleaning up expired records: {e}")
        return 0


def save_tryon_history(user_id: str, history: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persist a single try-on history record for a user.
    Automatically cleans up expired records before saving.
    Retention period is determined by user's subscription plan:
    - Free: 30 days
    - Premium: 360 days
    - Premium Plus: 540 days
    - Premium Pro: 540 days
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
        
        # Get retention days for this user to calculate expires_at
        retention_days = _get_retention_days_for_user(user_id)
        
        # Calculate expires_at based on retention period
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(days=retention_days)
        
        record = {
            "id": history_id,
            "user_id": str(user_id),  # Ensure it's a string
            "image_url": history.get("image_url", ""),
            "garment_urls": garment_urls,  # Selected items from Applied Outfit Items (JSONB array)
            "scene_image_url": history.get("scene_image_url"),
            "prompt": history.get("prompt"),  # User's custom prompt (optional)
            "created_at": created_at.isoformat() + "Z",
            "expires_at": expires_at.isoformat() + "Z",
        }
        
        # Insert into database
        response = _table.insert(record).execute()
        if response.data and len(response.data) > 0:
            saved_record = _normalize_record(response.data[0])
            logger.info(f"[Try-On History] Saved history record {history_id} for user {user_id} (retention: {retention_days} days)")
            return saved_record
        else:
            raise RuntimeError("Failed to insert tryon history: no data returned")
    except Exception as e:
        import traceback
        logger.error(f"[Try-On History] Error saving history: {e}")
        logger.error(f"[Try-On History] Traceback: {traceback.format_exc()}")
        raise


def list_tryon_history(user_id: str, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List try-on history for a user.
    Returns all records without filtering. Expired records are cleaned up by periodic cleanup task.
    
    Args:
        user_id: The user ID to query
        user_token: JWT token for authenticated requests. Required for RLS policies to work correctly.
                   If provided, creates an authenticated client that respects RLS policies.
                   If None, uses service role key (if available) or anon key (may be blocked by RLS).
    """
    try:
        # Create authenticated client if user_token is provided
        # This is required for RLS policies to work correctly with auth.uid()
        if user_token:
            client = _create_authenticated_client(user_token)
            table = client.table(TABLE_NAME)
        else:
            # Use global client (service role key or anon key)
            # Note: If using anon key without user token, RLS policies may block the query
            table = _table
        
        # Ensure table exists
        _ensure_table_exists()
        
        # Query user's history, return all records without filtering
        # RLS policy will automatically filter to only return records where auth.uid() = user_id
        query_user_id = str(user_id).strip()
        response = table.select("*").eq("user_id", query_user_id).order("created_at", desc=True).execute()
        
        if response.data:
            normalized_records = [_normalize_record(record) for record in response.data]
            logger.info(f"[Try-On History] Found {len(normalized_records)} record(s) for user {user_id}")
            return normalized_records
        else:
            logger.info(f"[Try-On History] No records found for user {user_id}")
            return []
    except Exception as e:
        import traceback
        logger.error(f"[Try-On History] Error listing history: {e}")
        logger.error(f"[Try-On History] Traceback: {traceback.format_exc()}")
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
        logger.error(f"[Try-On History] Error deleting history: {e}")
        return False


def debug_list_all_history() -> List[Dict[str, Any]]:
    """
    Debug function: List all try-on history records without user_id filter.
    This is for debugging purposes only to check if data exists in the table.
    """
    try:
        _ensure_table_exists()
        response = _table.select("*").order("created_at", desc=True).limit(100).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"[Try-On History Debug] Error: {e}")
        return []
