from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import USERS, create_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    user = USERS.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(body.username, user["role"])
    return {"token": token, "username": body.username, "role": user["role"]}
