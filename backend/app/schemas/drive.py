from pydantic import BaseModel


class ExchangeRequest(BaseModel):
    code: str
    redirect_uri: str = "postmessage"


class DriveTokenResponse(BaseModel):
    access_token: str
