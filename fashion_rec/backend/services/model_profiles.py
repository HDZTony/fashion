"""
模特档案服务
使用 Supabase 存储模特的身高、体重、出生年份等信息
"""
from typing import Any, Dict, List, Optional
from .supabase_client import create_authenticated_client

TABLE_NAME = "model_profiles"


def get_model_profile(user_id: str, model_id: str, user_token: str) -> Optional[Dict[str, Any]]:
    client = create_authenticated_client(user_token)
    response = (
        client.table(TABLE_NAME)
        .select("*")
        .eq("user_id", user_id)
        .eq("model_id", model_id)
        .execute()
    )
    if response.data and len(response.data) > 0:
        return response.data[0]
    return None


def list_model_profiles(user_id: str, user_token: str) -> List[Dict[str, Any]]:
    """获取用户所有模特的档案（用于批量加载昵称等信息）。"""
    client = create_authenticated_client(user_token)
    response = (
        client.table(TABLE_NAME)
        .select("model_id,nickname")
        .eq("user_id", user_id)
        .execute()
    )
    return response.data or []


def upsert_model_profile(
    user_id: str,
    model_id: str,
    user_token: str,
    nickname: Optional[str] = None,
    height: Optional[float] = None,
    weight: Optional[float] = None,
    birth_year: Optional[int] = None,
) -> Dict[str, Any]:
    client = create_authenticated_client(user_token)

    record: Dict[str, Any] = {
        "user_id": user_id,
        "model_id": model_id,
        "nickname": nickname,
        "height": height,
        "weight": weight,
        "birth_year": birth_year,
    }

    response = client.table(TABLE_NAME).upsert(record, on_conflict="user_id,model_id").execute()

    if response.data and len(response.data) > 0:
        return response.data[0]

    raise RuntimeError("Failed to upsert model profile: no data returned")
