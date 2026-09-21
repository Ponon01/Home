import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.apartment import Apartment
from app.models.resident import Resident
from app.models.user import User
from app.schemas.resident import ResidentCreate, ResidentRead, ResidentUpdate
from app.utils.model_updates import apply_updates
from app.utils.audit import write_audit_log

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/residents", tags=["residents"])


async def _ensure_apartment(db: AsyncSession, apartment_id: int) -> None:
    apt = await db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apartment not found")


@router.get("", response_model=list[ResidentRead])
async def list_residents(
    skip: int = 0,
    limit: int = 100,
    apartment_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[ResidentRead]:
    stmt = select(Resident)
    if apartment_id is not None:
        stmt = stmt.where(Resident.apartment_id == apartment_id)
    stmt = stmt.offset(skip).limit(min(limit, 500)).order_by(Resident.id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [ResidentRead.model_validate(r) for r in items]


@router.get("/{resident_id}", response_model=ResidentRead)
async def get_resident(resident_id: int, db: AsyncSession = Depends(get_db)) -> ResidentRead:
    r = await db.get(Resident, resident_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")
    return ResidentRead.model_validate(r)


@router.post("", response_model=ResidentRead, status_code=status.HTTP_201_CREATED)
async def create_resident(
    body: ResidentCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> ResidentRead:
    await _ensure_apartment(db, body.apartment_id)
    r = Resident(**body.model_dump())
    db.add(r)
    await db.flush()
    await write_audit_log(
        db, user=user, action="create", entity_type="resident", entity_id=r.id, new_value=body.model_dump()
    )
    await db.refresh(r)
    return ResidentRead.model_validate(r)


@router.patch("/{resident_id}", response_model=ResidentRead)
async def update_resident(
    resident_id: int,
    body: ResidentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResidentRead:
    r = await db.get(Resident, resident_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")
    old = ResidentRead.model_validate(r).model_dump()
    data = body.model_dump(exclude_unset=True)
    if "apartment_id" in data:
        await _ensure_apartment(db, data["apartment_id"])
    apply_updates(r, body)
    await db.flush()
    await write_audit_log(
        db,
        user=user,
        action="update",
        entity_type="resident",
        entity_id=r.id,
        old_value=old,
        new_value=ResidentRead.model_validate(r).model_dump(),
    )
    await db.refresh(r)
    return ResidentRead.model_validate(r)


@router.delete("/{resident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resident(
    resident_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    r = await db.get(Resident, resident_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")
    await write_audit_log(
        db,
        user=user,
        action="delete",
        entity_type="resident",
        entity_id=r.id,
        old_value=ResidentRead.model_validate(r).model_dump(),
    )
    await db.delete(r)


@router.post("/{resident_id}/upload-contract")
async def upload_contract(
    resident_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await db.get(Resident, resident_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    filename = getattr(file, "filename", None) or ""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Допустимы только PDF, JPG, JPEG, PNG.")

    dest_dir = settings.upload_path / "contracts"
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name.replace("..", "_")[:500] or "file"
    unique = f"{uuid.uuid4().hex}_{safe_name}"
    dest_path = dest_dir / unique

    size = 0
    try:
        with dest_path.open("wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл слишком большой (макс. 10 МБ).")
                buffer.write(chunk)
    finally:
        await file.close()

    rel = str(dest_path.relative_to(settings.upload_path))
    r.contract_file_path = rel
    r.contract_file_name = safe_name
    await db.flush()
    await db.refresh(r)
    return {"ok": True, "contract_file_path": rel, "contract_file_name": safe_name}
