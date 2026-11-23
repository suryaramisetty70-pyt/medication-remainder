from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_parent
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_secure_token,
    hash_password,
    verify_password,
)
from app.models.auth_token import AuthToken, TokenType
from app.models.user import User, UserRole
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
    VerifyEmailRequest,
    normalize_alert_emails,
)
from app.services.email_service import (
    send_password_reset_email,
    send_test_alert_email,
    mail_error,
    send_verification_email,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone.strip() if payload.phone else None,
        timezone=payload.timezone,
        is_verified=False,
        alert_email=payload.email.lower().strip() if payload.role == UserRole.PARENT else None,
        grace_period_minutes=30,
        require_photo_proof=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate verification token
    raw_token = generate_secure_token()
    token_rec = AuthToken(
        user_id=user.id,
        token=raw_token,
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.utcnow() + timedelta(days=2),
    )
    db.add(token_rec)
    db.commit()

    # Send verification email
    verify_url = f"{settings.app_url}/verify-email?token={raw_token}"
    send_verification_email(
        db=db,
        to_email=user.email,
        user_name=user.name,
        verify_url=verify_url,
        token_code=raw_token[:8].upper(),
    )

    # Issue persistent session token
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    response.set_cookie(
        key=settings.cookie_name,
        value=access_token,
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})

    max_age = (
        (settings.access_token_expire_minutes * 60)
        if payload.remember_me
        else None
    )

    response.set_cookie(
        key=settings.cookie_name,
        value=access_token,
        httponly=True,
        max_age=max_age,
        samesite="lax",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.cookie_name)
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    token_str = payload.token.strip()
    token_rec = (
        db.query(AuthToken)
        .filter(
            AuthToken.token == token_str,
            AuthToken.token_type == TokenType.EMAIL_VERIFICATION,
            AuthToken.used_at.is_(None),
        )
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired email verification token.",
        )

    user = db.query(User).filter(User.id == token_rec.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_verified = True
    token_rec.used_at = datetime.utcnow()
    db.commit()

    return {"message": "Email verified successfully! You may now access all features."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if user:
        raw_token = generate_secure_token()
        token_rec = AuthToken(
            user_id=user.id,
            token=raw_token,
            token_type=TokenType.PASSWORD_RESET,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.add(token_rec)
        db.commit()

        reset_url = f"{settings.app_url}/reset-password?token={raw_token}"
        send_password_reset_email(db, user.email, user.name, reset_url)

    # Always return success to prevent email enumeration
    return {"message": "If that email exists in our system, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_str = payload.token.strip()
    token_rec = (
        db.query(AuthToken)
        .filter(
            AuthToken.token == token_str,
            AuthToken.token_type == TokenType.PASSWORD_RESET,
            AuthToken.used_at.is_(None),
        )
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    user = db.query(User).filter(User.id == token_rec.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(payload.new_password)
    token_rec.used_at = datetime.utcnow()
    db.commit()

    return {"message": "Your password has been successfully reset. You can now log in."}


@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.alert_email is not None and user.role == UserRole.PARENT:
        user.alert_email = payload.alert_email.lower().strip()
    if payload.grace_period_minutes is not None and user.role == UserRole.PARENT:
        user.grace_period_minutes = max(5, min(180, payload.grace_period_minutes))
    if payload.require_photo_proof is not None and user.role == UserRole.PARENT:
        user.require_photo_proof = payload.require_photo_proof

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/send-test-alert-email")
def send_test_email(
    payload: dict = None,
    user: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    target_email = None
    if payload and payload.get("email"):
        target_email = payload.get("email").strip()
    elif user.alert_email:
        target_email = user.alert_email.strip()
    elif user.email:
        target_email = user.email.strip()

    if not target_email:
        raise HTTPException(status_code=400, detail="No alert email provided or configured.")

    try:
        normalized = normalize_alert_emails(target_email)
        if not normalized:
            raise ValueError("No email addresses")
        addresses = normalized.split(", ")
    except ValueError:
        raise HTTPException(status_code=422, detail="Enter valid alert email addresses separated by commas.")
    failures = []
    for address in addresses:
        if not send_test_alert_email(db, address, user.name):
            failures.append(f"{address}: {mail_error.get()}")
    if failures:
        raise HTTPException(status_code=503, detail="Some test emails failed: " + "; ".join(failures))
    return {"message": f"Test email accepted by provider for {len(addresses)} address(es). Check your inbox."}

