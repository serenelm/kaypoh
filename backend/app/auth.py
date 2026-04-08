from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException
from jose import JWTError, jwt

SECRET_KEY = "kaypoh-jwt-secret-do-not-use-in-production"
ALGORITHM = "HS256"
EXPIRE_HOURS = 24

# Hardcoded users {username: {password, role}}
USERS: dict[str, dict] = {
    "serene": {"password": "kaypoh123", "role": "user"},
    "user1":  {"password": "kaypoh123", "role": "user"},
    "admin":  {"password": "kaypoh123", "role": "admin"},
}


def create_token(username: str, role: str) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode(
        {"sub": username, "role": role, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(authorization.split(" ", 1)[1])


def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Like get_current_user but returns None instead of raising."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return decode_token(authorization.split(" ", 1)[1])
    except HTTPException:
        return None
