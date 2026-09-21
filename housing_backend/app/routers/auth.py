from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps.auth import get_current_user, require_admin, revoke_token
from app.models.role import Role
from app.models.user import User
from app.core.config import settings
from app.schemas.auth import AdminLoginRequest, CreateUserRequest, LoginRequest, LoginResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    stmt = select(User).options(selectinload(User.role)).where(User.username == body.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    token = create_access_token(user.id, user.username)
    return LoginResponse(access_token=token)


@router.post("/admin-login", response_model=LoginResponse)
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    """
    Password-only login for the frontend admin gate modal.
    Creates an 'admin' user if missing and returns a normal JWT token.
    """
    # Accept default gate passwords used in local/dev setups.
    allowed = {
        settings.ADMIN_GATE_PASSWORD,
        "admin123",
        "admin",
    }
    if body.password not in allowed:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role = (await db.execute(select(Role).where(Role.name == "admin"))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Role 'admin' not found")

    stmt = select(User).options(selectinload(User.role)).where(User.username == "admin")
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        user = User(
            username="admin",
            password_hash=hash_password(body.password),
            full_name="Администратор",
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user, attribute_names=["role"])

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    token = create_access_token(user.id, user.username)
    return LoginResponse(access_token=token)


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if credentials:
        revoke_token(credentials.credentials)
    return {"ok": True}


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    role = (await db.execute(select(Role).where(Role.name == body.role_name))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown role")
    existing = (await db.execute(select(User).where(User.username == body.username))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user, attribute_names=["role"])
    return UserRead.model_validate(user)
 