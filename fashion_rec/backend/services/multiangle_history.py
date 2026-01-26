"""
多角度图片生成历史记录服务
使用 Supabase 存储多角度生成历史
"""

import os
import logging
import sys
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta
from supabase import Client
from dotenv import load_dotenv
import httpx

load_dotenv()

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

# 表名
TABLE_NAME = "multiangle_history"

# 默认保留天数
DEFAULT_RETENTION_DAYS = 7

# 订阅类型对应的保留天数
PLAN_RETENTION_DAYS = {
    "Free": 7,
    "Premium": 30,
    "Premium Plus": 90,
    "Premium Pro": 90,
    "free": 7,
    "premium": 30,
    "premium_plus": 90,
    "premium_pro": 90,
}

# 全局 Supabase 客户端
from .supabase_client import create_supabase_client, create_authenticated_client, SUPABASE_SERVICE_ROLE_KEY
_client: Client = create_supabase_client()
_table = _client.table(TABLE_NAME)


def _get_retention_days_for_user(user_id: str) -> int:
    """根据用户订阅类型获取保留天数"""
    SUBSCRIPTION_SERVICE_URL = os.getenv("SUBSCRIPTION_SERVICE_URL", "http://localhost:3001")
    try:
        resp = httpx.get(
            f"{SUBSCRIPTION_SERVICE_URL}/userinfo",
            params={"user_id": user_id},
            timeout=5.0,
        )
        if resp.status_code == 200:
            plan_name = resp.json().get("planName")
            if plan_name:
                return PLAN_RETENTION_DAYS.get(plan_name, DEFAULT_RETENTION_DAYS)
    except Exception as e:
        logger.debug(f"[MultiAngle History] Failed to get subscription status: {e}")
    return DEFAULT_RETENTION_DAYS


def save_multiangle_history(
    user_id: str,
    source_tryon_url: str,
    result_url: str,
    angle_type: str,
    angle_params: Optional[Dict[str, Any]] = None,
    user_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    保存多角度生成历史记录
    
    Args:
        user_id: 用户 ID
        source_tryon_url: 原始试穿结果 URL
        result_url: 生成的多角度图片 URL
        angle_type: 角度类型 (preset name 或 "custom")
        angle_params: 角度参数 JSON
        user_token: 用户 JWT token
    
    Returns:
        保存的记录
    """
    try:
        # 创建认证客户端
        if user_token:
            try:
                client = create_authenticated_client(user_token)
                table = client.table(TABLE_NAME)
                logger.info(f"[MultiAngle History] Using authenticated client")
            except Exception as auth_error:
                logger.warning(f"[MultiAngle History] Auth client failed, using global: {auth_error}")
                table = _table
        else:
            table = _table
        
        # 计算过期时间
        retention_days = _get_retention_days_for_user(user_id)
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(days=retention_days)
        
        record = {
            "id": str(uuid.uuid4()),
            "user_id": str(user_id),
            "source_tryon_url": source_tryon_url,
            "result_url": result_url,
            "angle_type": angle_type,
            "angle_params": angle_params,
            "created_at": created_at.isoformat() + "Z",
            "expires_at": expires_at.isoformat() + "Z",
        }
        
        response = table.insert(record).execute()
        if response.data and len(response.data) > 0:
            logger.info(f"[MultiAngle History] Saved record for user {user_id}, retention: {retention_days} days")
            return response.data[0]
        else:
            raise RuntimeError("Failed to insert multiangle history")
    except Exception as e:
        logger.error(f"[MultiAngle History] Error saving: {e}")
        raise


def list_multiangle_history(
    user_id: str,
    user_token: Optional[str] = None,
    source_url: Optional[str] = None,
    limit: Optional[int] = 50,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    获取用户的多角度生成历史
    
    Args:
        user_id: 用户 ID
        user_token: 用户 JWT token
        source_url: 可选，筛选特定试穿结果的多角度图片
        limit: 返回数量限制
        offset: 偏移量
    
    Returns:
        历史记录列表
    """
    try:
        # 使用 service role key 或认证客户端
        if SUPABASE_SERVICE_ROLE_KEY:
            table = _table
        elif user_token:
            try:
                client = create_authenticated_client(user_token, timeout=3.0)
                table = client.table(TABLE_NAME)
            except Exception:
                table = _table
        else:
            table = _table
        
        query = table.select("*").eq("user_id", str(user_id)).order("created_at", desc=True)
        
        if source_url:
            query = query.eq("source_tryon_url", source_url)
        
        if limit is not None:
            query = query.range(offset, offset + limit - 1)
        
        response = query.execute()
        
        if response.data:
            logger.info(f"[MultiAngle History] Found {len(response.data)} records for user {user_id}")
            return response.data
        return []
    except Exception as e:
        logger.error(f"[MultiAngle History] Error listing: {e}")
        return []


def count_multiangle_history(user_id: str, user_token: Optional[str] = None) -> int:
    """统计用户的多角度历史记录数量"""
    try:
        if SUPABASE_SERVICE_ROLE_KEY:
            table = _table
        elif user_token:
            try:
                client = create_authenticated_client(user_token, timeout=3.0)
                table = client.table(TABLE_NAME)
            except Exception:
                table = _table
        else:
            table = _table
        
        response = table.select("id", count="exact").eq("user_id", str(user_id)).limit(0).execute()
        return response.count if hasattr(response, 'count') and response.count is not None else 0
    except Exception as e:
        logger.error(f"[MultiAngle History] Error counting: {e}")
        return 0


def delete_multiangle_history(
    user_id: str,
    history_id: str,
    user_token: Optional[str] = None
) -> bool:
    """
    删除多角度历史记录
    
    Returns:
        是否删除成功
    """
    try:
        if user_token:
            try:
                client = create_authenticated_client(user_token)
                table = client.table(TABLE_NAME)
            except Exception:
                table = _table
        else:
            table = _table
        
        # 先获取记录以便删除 R2 文件
        record = table.select("result_url").eq("id", history_id).eq("user_id", user_id).execute()
        
        if record.data and len(record.data) > 0:
            result_url = record.data[0].get("result_url")
            
            # 删除 R2 文件
            if result_url:
                try:
                    from services.storage import delete_file_from_r2_by_url
                    delete_file_from_r2_by_url(result_url)
                except Exception as e:
                    logger.warning(f"[MultiAngle History] Failed to delete R2 file: {e}")
            
            # 删除数据库记录
            response = table.delete().eq("id", history_id).eq("user_id", user_id).execute()
            return len(response.data) > 0 if response.data else False
        
        return False
    except Exception as e:
        logger.error(f"[MultiAngle History] Error deleting: {e}")
        return False


def cleanup_expired() -> int:
    """
    清理过期的多角度历史记录
    
    Returns:
        删除的记录数
    """
    try:
        from services.storage import delete_file_from_r2_by_url
        
        now = datetime.utcnow().isoformat() + "Z"
        
        # 查询过期记录
        response = _table.select("*").lt("expires_at", now).execute()
        
        if not response.data:
            return 0
        
        deleted_count = 0
        for record in response.data:
            try:
                # 删除 R2 文件
                result_url = record.get("result_url")
                if result_url:
                    try:
                        delete_file_from_r2_by_url(result_url)
                    except Exception as e:
                        logger.warning(f"[MultiAngle History] Failed to delete R2 file {result_url}: {e}")
                
                # 删除数据库记录
                record_id = record.get("id")
                if record_id:
                    delete_response = _table.delete().eq("id", record_id).execute()
                    if delete_response.data:
                        deleted_count += 1
            except Exception as e:
                logger.error(f"[MultiAngle History] Error cleaning up record {record.get('id')}: {e}")
        
        if deleted_count > 0:
            logger.info(f"[MultiAngle History] Cleaned up {deleted_count} expired records")
        
        return deleted_count
    except Exception as e:
        logger.error(f"[MultiAngle History] Error during cleanup: {e}")
        return 0
