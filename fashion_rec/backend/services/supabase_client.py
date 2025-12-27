"""
Supabase 客户端工具模块
提供统一的 Supabase 客户端创建函数，避免重复代码
"""
import os
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# 从环境变量获取 Supabase 配置
SUPABASE_URL = os.getenv("SUPABASE_URL")
# 优先使用 service role key（如果可用），否则使用 anon key
# 注意：使用 anon key 时，RLS 策略会确保用户只能访问自己的数据
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")


def create_supabase_client() -> Client:
    """
    创建基础的 Supabase 客户端。
    优先使用 service role key（如果可用），否则使用 anon key。
    用于不需要用户认证的操作（如清理过期记录）。
    
    Returns:
        Client: Supabase 客户端实例
    """
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def create_authenticated_client(user_token: str) -> Client:
    """
    创建使用用户 JWT token 认证的 Supabase 客户端。
    使用 anon key 创建客户端，然后设置用户会话以尊重 RLS 策略。
    这样 auth.uid() 在 RLS 策略中才能正确工作。
    
    Args:
        user_token: 用户的 JWT access token
        
    Returns:
        Client: 已认证的 Supabase 客户端实例
        
    Raises:
        Exception: 如果 token 无效或过期
    """
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Set the user session with the JWT token to respect RLS policies
        # This allows auth.uid() in RLS policies to work correctly
        # Note: set_session may fail if token is invalid/expired
        client.auth.set_session(access_token=user_token, refresh_token='')
        return client
    except Exception as e:
        print(f"[Supabase Client] Failed to create authenticated client: {e}")
        print(f"[Supabase Client] Token prefix: {user_token[:30] if user_token else 'None'}...")
        raise

