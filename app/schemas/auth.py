import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, TypeAdapter, field_validator
from app.models.user import UserRole


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str
    role: UserRole = UserRole.PARENT
    phone: Optional[str] = None
    timezone: str = "Asia/Kolkata"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters long.")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = True


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v


class UserResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    role: UserRole
    phone: Optional[str] = None
    timezone: str
    is_verified: bool
    alert_email: Optional[str] = None
    grace_period_minutes: int
    require_photo_proof: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    alert_email: Optional[str] = None
    grace_period_minutes: Optional[int] = None
    require_photo_proof: Optional[bool] = None

    @field_validator("alert_email")
    @classmethod
    def validate_alert_email(cls, value):
        if value is None:
            return None
        return normalize_alert_emails(value)


def normalize_alert_emails(value: str) -> str:
    addresses = list(dict.fromkeys(TypeAdapter(EmailStr).validate_python(item.strip()).lower() for item in value.split(",") if item.strip()))
    result = ", ".join(addresses)
    if len(result) > 255:
        raise ValueError("Alert email list must be 255 characters or less.")
    return result
