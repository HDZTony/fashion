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
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import httpx

load_dotenv()

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

# 全局Supabase客户端实例
_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_table = _client.table(TABLE_NAME)


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
                        print(f"[Try-On History] Failed to delete R2 file {image_url}: {e}")
                        # Continue with database deletion even if R2 deletion fails
                
                scene_image_url = record.get("scene_image_url")
                if scene_image_url:
                    try:
                        delete_file_from_r2_by_url(scene_image_url)
                    except Exception as e:
                        print(f"[Try-On History] Failed to delete R2 file {scene_image_url}: {e}")
                        # Continue with database deletion even if R2 deletion fails
                
                # Delete from database
                record_id = record.get("id")
                if record_id:
                    delete_response = _table.delete().eq("id", record_id).execute()
                    if delete_response.data:
                        deleted_count += 1
            except Exception as e:
                print(f"[Try-On History] Error deleting record {record.get('id')}: {e}")
                continue
        
        if deleted_count > 0:
            print(f"[Try-On History] Cleaned up {deleted_count} expired records")
        return deleted_count
    except Exception as e:
        print(f"[Try-On History] Error cleaning up expired records: {e}")
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
            "user_id": user_id,
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
            print(f"[Try-On History] Saved history record {history_id} for user {user_id} (retention: {retention_days} days, expires_at: {expires_at.isoformat()})")
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
    Returns all records without filtering. Expired records are cleaned up by periodic cleanup task.
    """
    try:
        print(f"[Try-On History] Listing history for user_id: {user_id}")
        print(f"[Try-On History] Table name: {TABLE_NAME}")
        print(f"[Try-On History] Supabase URL: {SUPABASE_URL}")
        print(f"[Try-On History] Using key type: {'SERVICE_ROLE_KEY' if SUPABASE_SERVICE_ROLE_KEY else 'ANON_KEY (RLS enabled)'}")
        
        # Ensure table exists
        _ensure_table_exists()
        
        # Query user's history, return all records without filtering
        print(f"[Try-On History] Building query: select * from {TABLE_NAME} where user_id = {user_id} order by created_at desc")
        response = _table.select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        print(f"[Try-On History] Query executed successfully")
        print(f"[Try-On History] Response data type: {type(response.data)}")
        print(f"[Try-On History] Response data is None: {response.data is None}")
        
        if response.data:
            data_count = len(response.data)
            print(f"[Try-On History] Found {data_count} record(s)")
            if data_count > 0:
                # Log first record for debugging
                first_record = response.data[0]
                first_record_user_id = first_record.get('user_id')
                print(f"[Try-On History] First record ID: {first_record.get('id')}")
                print(f"[Try-On History] First record user_id: {first_record_user_id}")
                print(f"[Try-On History] First record created_at: {first_record.get('created_at')}")
                
                # Compare user_id format
                print(f"[Try-On History] Query user_id type: {type(user_id)}, value: '{user_id}'")
                print(f"[Try-On History] Record user_id type: {type(first_record_user_id)}, value: '{first_record_user_id}'")
                print(f"[Try-On History] User IDs match: {str(user_id) == str(first_record_user_id)}")
                
                # Check all user_ids in response
                all_user_ids = [r.get('user_id') for r in response.data]
                unique_user_ids = list(set(all_user_ids))
                print(f"[Try-On History] Unique user_ids in response: {unique_user_ids}")
                print(f"[Try-On History] Requested user_id in results: {str(user_id) in [str(uid) for uid in unique_user_ids]}")
            
            normalized_records = [_normalize_record(record) for record in response.data]
            print(f"[Try-On History] Returning {len(normalized_records)} normalized record(s)")
            return normalized_records
        else:
            print(f"[Try-On History] No data returned from query (response.data is empty or None)")
            print(f"[Try-On History] This could mean:")
            print(f"[Try-On History]   1. No records exist for user_id: {user_id}")
            print(f"[Try-On History]   2. RLS policy is blocking the query")
            print(f"[Try-On History]   3. user_id format mismatch")
            return []
    except Exception as e:
        import traceback
        print(f"[Try-On History] Error listing history: {e}")
        print(f"[Try-On History] Traceback: {traceback.format_exc()}")
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


def debug_list_all_history() -> List[Dict[str, Any]]:
    """
    Debug function: List all try-on history records without user_id filter.
    This is for debugging purposes only to check if data exists in the table.
    """
    try:
        print(f"[Try-On History Debug] Querying all records from table: {TABLE_NAME}")
        print(f"[Try-On History Debug] Supabase URL: {SUPABASE_URL}")
        print(f"[Try-On History Debug] Using key type: {'SERVICE_ROLE_KEY' if SUPABASE_SERVICE_ROLE_KEY else 'ANON_KEY (RLS enabled)'}")
        _ensure_table_exists()
        
        # Query all records (no user_id filter)
        response = _table.select("*").order("created_at", desc=True).limit(100).execute()
        
        print(f"[Try-On History Debug] Query executed successfully")
        print(f"[Try-On History Debug] Response data type: {type(response.data)}")
        
        if response.data:
            data_count = len(response.data)
            print(f"[Try-On History Debug] Found {data_count} total record(s) in table")
            
            # Group by user_id for analysis
            user_ids = {}
            for record in response.data:
                uid = record.get("user_id")
                if uid:
                    user_ids[uid] = user_ids.get(uid, 0) + 1
            
            print(f"[Try-On History Debug] Records grouped by user_id: {user_ids}")
            
            # Log sample records
            for i, record in enumerate(response.data[:5]):  # First 5 records
                print(f"[Try-On History Debug] Sample record {i+1}: id={record.get('id')}, user_id={record.get('user_id')}, created_at={record.get('created_at')}")
            
            return response.data
        else:
            print(f"[Try-On History Debug] No data found in table")
            return []
    except Exception as e:
        import traceback
        print(f"[Try-On History Debug] Error: {e}")
        print(f"[Try-On History Debug] Traceback: {traceback.format_exc()}")
        return []
