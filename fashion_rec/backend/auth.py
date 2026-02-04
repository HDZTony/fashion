import os
from supabase import create_client, Client
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Optional

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
