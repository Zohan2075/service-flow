from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import google.auth.transport.requests

from app.config import get_settings
from app.services.auth import verify_google_id_token

settings = get_settings()

SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"]
DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive.file"]


def exchange_auth_code(code: str) -> Credentials:
    """Exchange a GIS code-model auth code for Google OAuth credentials."""
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["postmessage"],
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri="postmessage",
    )
    flow.fetch_token(code=code)
    return flow.credentials


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
