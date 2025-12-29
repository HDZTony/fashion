"""
Supabase 客户端工具模块
提供统一的 Supabase 客户端创建函数，避免重复代码
"""
import os
import threading
from typing import Optional, Dict
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

# 缓存已认证的客户端，key 是 token，value 是 Client 实例
# 使用线程锁确保线程安全
_authenticated_clients_cache: Dict[str, Client] = {}
_cache_lock = threading.Lock()


def create_supabase_client() -> Client:
    """
    创建基础的 Supabase 客户端。
    优先使用 service role key（如果可用），否则使用 anon key。
    用于不需要用户认证的操作（如清理过期记录）。
    
    Returns:
        Client: Supabase 客户端实例
    """
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def create_authenticated_client(user_token: str, timeout: float = 5.0, use_cache: bool = True) -> Client:
    """
    创建使用用户 JWT token 认证的 Supabase 客户端。
    使用 anon key 创建客户端，然后设置用户会话以尊重 RLS 策略。
    这样 auth.uid() 在 RLS 策略中才能正确工作。
    
    客户端会被缓存，相同的 token 会复用同一个客户端实例，避免重复设置 session。
    
    Args:
        user_token: 用户的 JWT access token
        timeout: 超时时间（秒），默认 5 秒（仅在创建新客户端时使用）
        use_cache: 是否使用缓存，默认 True
        
    Returns:
        Client: 已认证的 Supabase 客户端实例
        
    Raises:
        Exception: 如果 token 无效或过期或超时
    """
    # 如果使用缓存，先检查是否已存在
    if use_cache:
        with _cache_lock:
            if user_token in _authenticated_clients_cache:
                cached_client = _authenticated_clients_cache[user_token]
                return cached_client
    
    # 创建新客户端
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Use threading with timeout to avoid hanging on set_session
        # Note: set_session may make network requests that could timeout
        result = [None]
        exception = [None]
        
        def set_session_task():
            try:
                # Set the user session with the JWT token to respect RLS policies
                # This allows auth.uid() in RLS policies to work correctly
                # Note: set_session may fail if token is invalid/expired
                client.auth.set_session(access_token=user_token, refresh_token='')
                result[0] = client
            except Exception as e:
                exception[0] = e
        
        thread = threading.Thread(target=set_session_task)
        thread.daemon = True
        thread.start()
        thread.join(timeout=timeout)
        
        if thread.is_alive():
            # Thread is still running, meaning it timed out
            raise TimeoutError(f"set_session timed out after {timeout} seconds")
        
        if exception[0]:
            raise exception[0]
        
        if result[0] is None:
            raise RuntimeError("set_session failed without raising exception")
        
        # 缓存客户端（如果启用缓存）
        if use_cache:
            with _cache_lock:
                _authenticated_clients_cache[user_token] = result[0]
                # 限制缓存大小，避免内存泄漏（保留最近 100 个客户端）
                if len(_authenticated_clients_cache) > 100:
                    # 删除最旧的项（简单策略：删除第一个）
                    oldest_token = next(iter(_authenticated_clients_cache))
                    del _authenticated_clients_cache[oldest_token]
        
        return result[0]
    except Exception as e:
        print(f"[Supabase Client] Failed to create authenticated client: {e}")
        print(f"[Supabase Client] Token prefix: {user_token[:30] if user_token else 'None'}...")
        raise


def clear_authenticated_client_cache(token: Optional[str] = None):
    """
    清除已认证客户端的缓存。
    
    Args:
        token: 如果提供，只清除该 token 的缓存；否则清除所有缓存
    """
    with _cache_lock:
        if token:
            _authenticated_clients_cache.pop(token, None)
        else:
            _authenticated_clients_cache.clear()

