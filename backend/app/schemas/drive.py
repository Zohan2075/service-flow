from pydantic import BaseModel


class ExchangeRequest(BaseModel):
    code: str


class DriveTokenResponse(BaseModel):
    access_token: str
