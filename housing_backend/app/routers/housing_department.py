from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import require_admin
from app.models.housing_department_meta import HousingDepartmentMeta
from app.models.housing_department_record import HousingDepartmentRecord
from app.models.user import User
from app.schemas.housing_department_record import (
    AddColumnRequest,
    HousingDepartmentListResponse,
    HousingDepartmentRecordRead,
    HousingDepartmentRecordUpdate,
)
from app.utils.model_updates import apply_updates
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/housing-department", tags=["housing-department"])


async def _get_or_create_meta(db: AsyncSession) -> HousingDepartmentMeta:
    meta = (await db.execute(select(HousingDepartmentMeta).limit(1))).scalar_one_or_none()
    if meta is None:
        meta = HousingDepartmentMeta(custom_headers=[])
        db.add(meta)
        await db.flush()
    return meta


@router.get("/records", response_model=HousingDepartmentListResponse)
async def list_records(
    db: AsyncSession = Depends(get_db),
) -> HousingDepartmentListResponse:
    meta = await _get_or_create_meta(db)
    stmt = select(HousingDepartmentRecord).order_by(HousingDepartmentRecord.id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return HousingDepartmentListResponse(
        custom_headers=list(meta.custom_headers or []),
        rows=[HousingDepartmentRecordRead.model_validate(item) for item in items],
    )


@router.post("/columns", response_model=HousingDepartmentListResponse)
async def add_column(
    body: AddColumnRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> HousingDepartmentListResponse:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название столбца не может быть пустым")

    meta = await _get_or_create_meta(db)
    headers = list(meta.custom_headers or [])
    if name in headers:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Столбец уже существует")

    headers.append(name)
    meta.custom_headers = headers

    result = await db.execute(select(HousingDepartmentRecord))
    for item in result.scalars().all():
        extra = dict(item.extra_fields or {})
        extra[name] = None
        item.extra_fields = extra

    await db.flush()

    result = await db.execute(select(HousingDepartmentRecord).order_by(HousingDepartmentRecord.id))
    items = result.scalars().all()
    return HousingDepartmentListResponse(
        custom_headers=headers,
        rows=[HousingDepartmentRecordRead.model_validate(item) for item in items],
    )


@router.patch("/records/{record_id}", response_model=HousingDepartmentRecordRead)
async def update_record(
    record_id: int,
    body: HousingDepartmentRecordUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> HousingDepartmentRecordRead:
    item = await db.get(HousingDepartmentRecord, record_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Housing department record not found",
        )

    old = HousingDepartmentRecordRead.model_validate(item).model_dump(mode="json")
    apply_updates(item, body)
    if body.extra_fields is not None:
        item.extra_fields = body.extra_fields
    await db.flush()

    await write_audit_log(
        db,
        user=user,
        action="update",
        entity_type="housing_department_record",
        entity_id=item.id,
        old_value=old,
        new_value=HousingDepartmentRecordRead.model_validate(item).model_dump(mode="json"),
    )

    await db.refresh(item)
    return HousingDepartmentRecordRead.model_validate(item)
