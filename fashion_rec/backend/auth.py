import os
from supabase import create_client, Client
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not supabase:
        raise HTTPException(status_code=500, detail="Auth configuration missing")

    try:
        # Verify token with Supabase
        # get_user() verifies the JWT signature and expiration
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise credentials_exception
            
        return user_response.user.id
        
    except Exception as e:
        print(f"Auth error: {e}")
        raise credentials_exception
