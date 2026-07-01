import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.config import get_settings
from app.models.user import User

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password helpers ────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── JWT helpers ─────────────────────────────────────────────────────────────

def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str | uuid.UUID) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str | uuid.UUID) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


# ─── User CRUD helpers ───────────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    email: str,
    full_name: str | None = None,
    password: str | None = None,
    google_id: str | None = None,
    avatar_url: str | None = None,
    is_verified: bool = False,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password) if password else None,
        google_id=google_id,
        avatar_url=avatar_url,
        is_verified=is_verified,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


# ─── Google OAuth ─────────────────────────────────────────────────────────────

def verify_google_id_token(token: str) -> dict[str, Any]:
    """Verify a Google ID token and return the payload."""
    idinfo = google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.google_client_id,
    )
    return idinfo


async def google_auth_or_create(db: AsyncSession, id_token_str: str) -> User:
    payload = verify_google_id_token(id_token_str)
    google_id = payload["sub"]
    email = payload["email"]
    full_name = payload.get("name")
    avatar_url = payload.get("picture")

    # Check existing user by google_id
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user:
        return user

    # Check existing user by email (link accounts)
    user = await get_user_by_email(db, email)
    if user:
        user.google_id = google_id
        if not user.avatar_url and avatar_url:
            user.avatar_url = avatar_url
        await db.flush()
        return user

    # New user
    return await create_user(
        db,
        email=email,
        full_name=full_name,
        google_id=google_id,
        avatar_url=avatar_url,
        is_verified=True,
    )
