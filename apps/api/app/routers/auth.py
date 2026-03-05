from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import Account, User
from app.schemas.auth import AuthResponse, SignInRequest, SignUpRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/sign-up", response_model=AuthResponse)
async def sign_up(body: SignUpRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    now = datetime.now(timezone.utc)
    user_id = str(uuid4())

    user = User(
        id=user_id,
        name=body.name,
        email=body.email,
        email_verified=False,
        created_at=now,
        updated_at=now,
    )
    db.add(user)

    account = Account(
        id=str(uuid4()),
        account_id=user_id,
        provider_id="credential",
        user_id=user_id,
        password=hash_password(body.password),
        created_at=now,
        updated_at=now,
    )
    db.add(account)
    await db.commit()

    token = create_access_token(user_id)
    return AuthResponse(token=token, user=UserResponse.model_validate(user))


@router.post("/sign-in", response_model=AuthResponse)
async def sign_in(body: SignInRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    result = await db.execute(
        select(Account).where(
            Account.user_id == user.id,
            Account.provider_id == "credential",
        )
    )
    account = result.scalar_one_or_none()
    if not account or not account.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(body.password, account.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return AuthResponse(token=token, user=UserResponse.model_validate(user))


@router.get("/get-session", response_model=UserResponse)
async def get_session(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.post("/sign-out")
async def sign_out():
    # JWT is stateless — client discards the token
    return {"success": True}


@router.post("/delete-user")
async def delete_user(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()
    return {"success": True}
