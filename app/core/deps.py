from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User, UserRole

security_bearer = HTTPBearer(auto_error=False)


def get_current_user_optional(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = None
    if auth and auth.credentials:
        token = auth.credentials
    elif settings.cookie_name in request.cookies:
        token = request.cookies.get(settings.cookie_name)
    elif "token" in request.query_params:
        token = request.query_params.get("token")

    if not token:
        return None

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        user_id_int = int(user_id)
    except ValueError:
        return None

    user = db.query(User).filter(User.id == user_id_int).first()
    return user


def get_current_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session has expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = get_current_user_optional(request, auth, db)
    if not user:
        raise credentials_error
    return user


def require_parent(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.PARENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Only parent accounts can perform this action.",
        )
    return user


def require_child(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.CHILD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Only child accounts can perform this action.",
        )
    return user
