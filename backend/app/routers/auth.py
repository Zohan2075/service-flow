from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_user_by_email,
    get_user_by_id,
    create_user,
    google_auth_or_create,
    hash_password,
    verify_password,
)
from app.dependencies import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
    )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await get_user_by_email(db, payload.email)
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    try:
        user = await google_auth_or_create(db, payload.id_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {e}")
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    credentials_exception = HTTPException(status_code=401, detail="Invalid refresh token")
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise credentials_exception
        import uuid
        user_id = uuid.UUID(data["sub"])
    except (JWTError, ValueError):
        raise credentials_exception
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return current_user
