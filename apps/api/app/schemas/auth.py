from pydantic import BaseModel, EmailStr


class SignUpRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    email_verified: bool
    image: str | None = None

    model_config = {"from_attributes": True}
