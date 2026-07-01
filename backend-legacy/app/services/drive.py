import httpx
from google.oauth2.credentials import Credentials
import google.auth.transport.requests

from app.config import get_settings
from app.services.auth import verify_google_id_token

settings = get_settings()

DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive.file"]

TOKEN_URI = "https://oauth2.googleapis.com/token"


def exchange_auth_code(code: str, redirect_uri: str = "postmessage") -> Credentials:
    """Exchange a GIS code-model auth code for Google OAuth credentials.
    
    Uses the raw OAuth token endpoint (not google-auth-oauthlib's Flow)
    to avoid scope translation issues. Flow auto-expands 'email' to
    'https://www.googleapis.com/auth/userinfo.email' etc., which causes
    a scope mismatch with the GIS authorization that uses short names.
    """
    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    resp = httpx.post(TOKEN_URI, data=data)
    if not resp.is_success:
        raise Exception(resp.text.strip())
    token_data = resp.json()
    return Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=TOKEN_URI,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=token_data.get("scope", "").split(),
        id_token=token_data.get("id_token"),
    )


def refresh_access_token(refresh_token: str) -> Credentials:
    """Refresh a Google access token from a stored refresh token."""
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=DRIVE_SCOPE,
    )
    creds.refresh(google.auth.transport.requests.Request())
    return creds


def get_user_id_from_credentials(creds: Credentials) -> str:
    """Extract the Google user ID (`sub`) from the ID token in credentials."""
    payload = verify_google_id_token(creds.id_token)
    return payload["sub"]
