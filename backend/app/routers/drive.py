from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.google_token import GoogleToken
from app.schemas.auth import TokenResponse
from app.schemas.drive import DriveTokenResponse, ExchangeRequest
from app.services.auth import create_access_token, create_refresh_token, google_auth_or_create
from app.services.drive import exchange_auth_code, refresh_access_token

router = APIRouter(prefix="/drive", tags=["drive"])


@router.post("/exchange", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def exchange_token(
    payload: ExchangeRequest, db: Annotated[AsyncSession, Depends(get_db)]
):
    try:
        creds = exchange_auth_code(payload.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to exchange auth code: {e}")
    if not creds.id_token:
        raise HTTPException(
            status_code=400, detail="No ID token in exchange response"
        )
    try:
        user = await google_auth_or_create(db, creds.id_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {e}")
    if not creds.refresh_token:
        raise HTTPException(
            status_code=400,
            detail="No refresh token returned. Re-authorize with consent.",
        )

    # Upsert the GoogleToken row (one per user)
    result = await db.execute(
        select(GoogleToken).where(GoogleToken.user_id == user.id)
    )
    google_token = result.scalar_one_or_none()
    if google_token:
        google_token.google_refresh_token = creds.refresh_token
        google_token.google_access_token = creds.token
        google_token.access_token_expires_at = creds.expiry
    else:
        google_token = GoogleToken(
            user_id=user.id,
            google_refresh_token=creds.refresh_token,
            google_access_token=creds.token,
            access_token_expires_at=creds.expiry,
        )
        db.add(google_token)
    await db.flush()

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/token", response_model=DriveTokenResponse)
async def get_drive_token(
    current_user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    result = await db.execute(
        select(GoogleToken).where(GoogleToken.user_id == current_user.id)
    )
    google_token = result.scalar_one_or_none()
    if not google_token:
        raise HTTPException(
            status_code=404,
            detail="No Google Drive token stored. Please re-authorize.",
        )
    try:
        creds = refresh_access_token(google_token.google_refresh_token)
    except Exception as e:
        raise HTTPException(
            status_code=401, detail=f"Failed to refresh Google token: {e}"
        )

    google_token.google_access_token = creds.token
    google_token.access_token_expires_at = creds.expiry
    await db.flush()

    return DriveTokenResponse(access_token=creds.token)


@router.delete("/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_drive_token(
    current_user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    result = await db.execute(
        select(GoogleToken).where(GoogleToken.user_id == current_user.id)
    )
    google_token = result.scalar_one_or_none()
    if google_token:
        await db.delete(google_token)
        await db.flush()
    return None
