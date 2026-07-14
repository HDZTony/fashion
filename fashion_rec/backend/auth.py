"""
Fashion backend auth — thin wrapper around shared `hdz-auth` package.

Source repo: https://github.com/HDZTony/hdz-auth
"""
from hdz_auth.fastapi import create_auth_dependencies
from hdz_auth.router import create_auth_router

_deps = create_auth_dependencies()

get_current_user = _deps.get_current_user
get_current_user_token = _deps.get_current_user_token
get_current_user_and_token = _deps.get_current_user_and_token
get_optional_user_and_token = _deps.get_optional_user_and_token

auth_router = create_auth_router()

__all__ = [
    "get_current_user",
    "get_current_user_token",
    "get_current_user_and_token",
    "get_optional_user_and_token",
    "auth_router",
]
