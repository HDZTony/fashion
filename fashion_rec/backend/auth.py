import os
import hashlib
import logging
from supabase import create_client, Client
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

# Initialize Supabase client
# These env vars must be set in Fly.io secrets
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_KEY not set. Auth will fail.")
    # Fallback for build time or local dev without env vars
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def get_current_user_and_token(request: Request, token: Optional[str] = Depends(oauth2_scheme)):
    """
    Get both user ID and token in a single verification.
    This avoids duplicate authentication requests when both are needed.
    Returns a tuple of (user_id, token).
    
    Token can come from:
    1. Authorization header (Bearer token) - highest priority
    2. Cookie (auth_token) - fallback for browser-initiated requests
    """
    import logging
    logger = logging.getLogger(__name__)
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Debug: Log all Authorization headers (case-insensitive check)
    auth_header_lower = None
    auth_header_original = None
    for header_name, header_value in request.headers.items():
        if header_name.lower() == 'authorization':
            auth_header_original = header_name
            auth_header_lower = header_value
            break
    
    # CRITICAL: If no token from Authorization header, try cookie
    # This is essential for browser-initiated requests (page refresh, direct navigation)
    # where JavaScript may not have loaded yet to set the Authorization header
    if not token:
        cookie_token = request.cookies.get('auth_token')
        if cookie_token:
            token = cookie_token
            logger.info(f"[Auth Debug] Token found in cookie (fallback for browser-initiated request)")
    
    logger.info(f"[Auth Debug] get_current_user_and_token called - Path: {request.url.path}")
    logger.info(f"[Auth Debug] OAuth2PasswordBearer extracted token: {'Present' if token else 'Missing'}")
    logger.info(f"[Auth Debug] Raw Authorization header in request: {'Present' if auth_header_lower else 'Missing'} (header name: {auth_header_original})")
    if auth_header_lower:
        logger.info(f"[Auth Debug] Authorization header value prefix: {auth_header_lower[:30]}...")
    if token:
        logger.info(f"[Auth Debug] Extracted token prefix: {token[:30]}...")
    
    if not supabase:
        logger.error("ERROR: Supabase client not initialized")
        raise HTTPException(status_code=500, detail="Auth configuration missing")

    if not token:
        logger.warning("ERROR: No token provided in request to get_current_user_and_token")
        logger.warning(f"[Auth Debug] OAuth2PasswordBearer failed to extract token, but raw header exists: {auth_header_lower is not None}")
        raise credentials_exception

    try:
        # Verify token with Supabase (only once)
        # get_user() verifies the JWT signature and expiration
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            logger.warning(f"ERROR: Token validation failed - no user in response. Token prefix: {token[:20] if token else 'None'}...")
            raise credentials_exception
            
        return (user_response.user.id, token)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error in get_current_user_and_token: {type(e).__name__}: {e}. Token prefix: {token[:20] if token else 'None'}...")
        raise credentials_exception


async def get_optional_user_and_token(request: Request, token: Optional[str] = Depends(oauth2_scheme)):
    """
    Optional auth: returns (user_id, token) if valid token present, else (None, None).
    Does NOT raise 401 when no token or invalid token. Used for guest-capable endpoints
    (try-on, outfit, model-image, background-image) where IP-based rate limit applies for guests.
    """
    import logging
    logger = logging.getLogger(__name__)

    if not token:
        cookie_token = request.cookies.get('auth_token')
        if cookie_token:
            token = cookie_token

    if not token or not supabase:
        return (None, None)

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            return (None, None)
        return (user_response.user.id, token)
    except Exception:
        return (None, None)


async def get_current_user_token(request: Request, token: Optional[str] = Depends(oauth2_scheme)) -> str:
    """
    Get the current user's JWT token.
    This can be used to create authenticated Supabase clients that respect RLS policies.
    Note: This does NOT verify the token (for performance). Use get_current_user_and_token if you need both.
    
    Token can come from:
    1. Authorization header (Bearer token) - highest priority
    2. Cookie (auth_token) - fallback for browser-initiated requests
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Debug: Log all Authorization headers (case-insensitive check)
    auth_header_lower = None
    auth_header_original = None
    for header_name, header_value in request.headers.items():
        if header_name.lower() == 'authorization':
            auth_header_original = header_name
            auth_header_lower = header_value
            break
    
    # CRITICAL: If no token from Authorization header, try cookie
    if not token:
        cookie_token = request.cookies.get('auth_token')
        if cookie_token:
            token = cookie_token
            logger.info(f"[Auth Debug] Token found in cookie (fallback for browser-initiated request)")
    
    logger.info(f"[Auth Debug] get_current_user_token called - Path: {request.url.path}")
    logger.info(f"[Auth Debug] OAuth2PasswordBearer extracted token: {'Present' if token else 'Missing'}")
    logger.info(f"[Auth Debug] Raw Authorization header in request: {'Present' if auth_header_lower else 'Missing'} (header name: {auth_header_original})")
    if auth_header_lower:
        logger.info(f"[Auth Debug] Authorization header value prefix: {auth_header_lower[:30]}...")
    if token:
        logger.info(f"[Auth Debug] Extracted token prefix: {token[:30]}...")
    
    if not token:
        logger.warning("ERROR: No token provided in request to get_current_user_token")
        logger.warning(f"[Auth Debug] OAuth2PasswordBearer failed to extract token, but raw header exists: {auth_header_lower is not None}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Just return the token without verification to avoid duplicate auth requests
    # The token will be verified when used with Supabase client
    return token


async def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme)):
    """
    Get the current user's ID.
    Note: This verifies the token. If you also need the token, use get_current_user_and_token instead.
    
    Token can come from:
    1. Authorization header (Bearer token) - highest priority
    2. Cookie (auth_token) - fallback for browser-initiated requests
    """
    import logging
    logger = logging.getLogger(__name__)
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Debug: Log all Authorization headers (case-insensitive check)
    auth_header_lower = None
    auth_header_original = None
    for header_name, header_value in request.headers.items():
        if header_name.lower() == 'authorization':
            auth_header_original = header_name
            auth_header_lower = header_value
            break
    
    # CRITICAL: If no token from Authorization header, try cookie
    if not token:
        cookie_token = request.cookies.get('auth_token')
        if cookie_token:
            token = cookie_token
            logger.info(f"[Auth Debug] Token found in cookie (fallback for browser-initiated request)")
    
    logger.info(f"[Auth Debug] get_current_user called - Path: {request.url.path}")
    logger.info(f"[Auth Debug] OAuth2PasswordBearer extracted token: {'Present' if token else 'Missing'}")
    logger.info(f"[Auth Debug] Raw Authorization header in request: {'Present' if auth_header_lower else 'Missing'} (header name: {auth_header_original})")
    if auth_header_lower:
        logger.info(f"[Auth Debug] Authorization header value prefix: {auth_header_lower[:30]}...")
    if token:
        logger.info(f"[Auth Debug] Extracted token prefix: {token[:30]}...")
    
    if not supabase:
        logger.error("ERROR: Supabase client not initialized")
        raise HTTPException(status_code=500, detail="Auth configuration missing")

    if not token:
        logger.warning("ERROR: No token provided in request")
        logger.warning(f"[Auth Debug] OAuth2PasswordBearer failed to extract token, but raw header exists: {auth_header_lower is not None}")
        raise credentials_exception

    try:
        # Verify token with Supabase
        # get_user() verifies the JWT signature and expiration
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            logger.warning(f"ERROR: Token validation failed - no user in response. Token prefix: {token[:20] if token else 'None'}...")
            raise credentials_exception
            
        return user_response.user.id
        
    except HTTPException:
        # Re-raise HTTP exceptions (like credentials_exception)
        raise
    except Exception as e:
        # Log the actual error for debugging
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"ERROR: Auth validation failed - {error_type}: {error_msg}. Token prefix: {token[:20] if token else 'None'}...")
        # Don't expose internal error details to client
        raise credentials_exception


# ── Auth Router ──────────────────────────────────────────────────────────
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleNativeAuthRequest(BaseModel):
    """App 端 Google 原生登录请求体"""
    email: str
    google_user_id: str
    name: str = ""


@auth_router.post("/google-native")
async def google_native_auth(body: GoogleNativeAuthRequest):
    """
    处理 App 端原生 Google 登录。

    uni-app 的 Google OAuth 模块不返回 idToken/access_token，
    只返回 openid(google_user_id) 和用户基本信息。

    本端点通过 Supabase Admin API 完成认证：
    1. 用 google_user_id 生成确定性密码（服务端私密）
    2. 查找或创建 Supabase 用户
    3. 使用邮箱+密码登录获取 session tokens
    """
    import httpx

    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=500, detail="Server auth configuration missing")

    # 用 google_user_id + 服务端密钥生成确定性密码，只有服务端能算出
    password = hashlib.sha256(
        f"google-native:{body.google_user_id}:{service_role_key[:32]}".encode()
    ).hexdigest()

    admin_headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Step 1: 尝试创建用户
        create_resp = await client.post(
            f"{supabase_url}/auth/v1/admin/users",
            headers=admin_headers,
            json={
                "email": body.email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": body.name,
                    "name": body.name,
                    "google_user_id": body.google_user_id,
                    "avatar_url": "",
                },
                "app_metadata": {
                    "provider": "google",
                    "providers": ["google"],
                },
            },
        )

        if create_resp.status_code in (200, 201):
            logger.info(f"[Google Native Auth] Created new user: {body.email}")
        elif create_resp.status_code == 422:
            # 用户已存在 → 更新密码和元数据以确保一致
            logger.info(f"[Google Native Auth] User exists, updating: {body.email}")
            users_resp = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                headers=admin_headers,
                params={"page": 1, "per_page": 1000},
            )
            user_id = None
            if users_resp.status_code == 200:
                for u in users_resp.json().get("users", []):
                    if u.get("email") == body.email:
                        user_id = u["id"]
                        break

            if user_id:
                await client.put(
                    f"{supabase_url}/auth/v1/admin/users/{user_id}",
                    headers=admin_headers,
                    json={
                        "password": password,
                        "email_confirm": True,
                        "user_metadata": {
                            "full_name": body.name,
                            "name": body.name,
                            "google_user_id": body.google_user_id,
                        },
                    },
                )
            else:
                logger.error(f"[Google Native Auth] User exists but not found in list: {body.email}")
                raise HTTPException(status_code=500, detail="User lookup failed")
        else:
            logger.error(
                f"[Google Native Auth] Create user failed: {create_resp.status_code} {create_resp.text}"
            )
            raise HTTPException(status_code=500, detail="Failed to create user")

        # Step 2: 用邮箱+密码登录，获取 session tokens
        signin_resp = await client.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={
                "apikey": service_role_key,
                "Content-Type": "application/json",
            },
            json={"email": body.email, "password": password},
        )

        if signin_resp.status_code != 200:
            logger.error(
                f"[Google Native Auth] Sign in failed: {signin_resp.status_code} {signin_resp.text}"
            )
            raise HTTPException(status_code=500, detail="Authentication failed")

        session = signin_resp.json()
        logger.info(f"[Google Native Auth] Login OK for {body.email}")

        return {
            "access_token": session["access_token"],
            "refresh_token": session["refresh_token"],
        }
