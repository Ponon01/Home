from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.apartment import Apartment
from app.models.purchase_payment_schedule import PurchasePaymentSchedule
from app.models.user import User
from app.schemas.purchase_payment_schedule import (
    PurchasePaymentScheduleCreate,
    PurchasePaymentScheduleRead,
    PurchasePaymentScheduleUpdate,
)
from app.utils.model_updates import apply_updates
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/purchase-payment-schedule", tags=["purchase-payment-schedule"])


async def _ensure_apartment(db: AsyncSession, apartment_id: int) -> None:
    apt = await db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apartment not found")


@router.get("", response_model=list[PurchasePaymentScheduleRead])
async def list_schedule(
    skip: int = 0,
    limit: int = 200,
    apartment_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[PurchasePaymentScheduleRead]:
    stmt = select(PurchasePaymentSchedule)
    if apartment_id is not None:
        stmt = stmt.where(PurchasePaymentSchedule.apartment_id == apartment_id)
    stmt = (
        stmt.offset(skip)
        .limit(min(limit, 1000))
        .order_by(PurchasePaymentSchedule.year, PurchasePaymentSchedule.month, PurchasePaymentSchedule.id)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [PurchasePaymentScheduleRead.model_validate(x) for x in items]


@router.get("/{record_id}", response_model=PurchasePaymentScheduleRead)
async def get_schedule_row(record_id: int, db: AsyncSession = Depends(get_db)) -> PurchasePaymentScheduleRead:
    row = await db.get(PurchasePaymentSchedule, record_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return PurchasePaymentScheduleRead.model_validate(row)


@router.post("", response_model=PurchasePaymentScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule_row(
    body: PurchasePaymentScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchasePaymentScheduleRead:
    await _ensure_apartment(db, body.apartment_id)
    row = PurchasePaymentSchedule(**body.model_dump())
    db.add(row)
    await db.flush()
    await write_audit_log(
        db,
        user=user,
        action="create",
        entity_type="purchase_payment_schedule",
        entity_id=row.id,
        new_value=body.model_dump(),
    )
    await db.refresh(row)
    return PurchasePaymentScheduleRead.model_validate(row)


@router.patch("/{record_id}", response_model=PurchasePaymentScheduleRead)
async def update_schedule_row(
    record_id: int,
    body: PurchasePaymentScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchasePaymentScheduleRead:
    row = await db.get(PurchasePaymentSchedule, record_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    old = PurchasePaymentScheduleRead.model_validate(row).model_dump()
    data = body.model_dump(exclude_unset=True)
    if "apartment_id" in data:
        await _ensure_apartment(db, data["apartment_id"])
    apply_updates(row, body)
    await db.flush()
    await write_audit_log(
        db,
        user=user,
        action="update",
        entity_type="purchase_payment_schedule",
        entity_id=row.id,
        old_value=old,
        new_value=PurchasePaymentScheduleRead.model_validate(row).model_dump(),
    )
    await db.refresh(row)
    return PurchasePaymentScheduleRead.model_validate(row)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_row(
    record_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    row = await db.get(PurchasePaymentSchedule, record_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    await write_audit_log(
        db,
        user=user,
        action="delete",
        entity_type="purchase_payment_schedule",
        entity_id=row.id,
        old_value=PurchasePaymentScheduleRead.model_validate(row).model_dump(),
    )
    await db.delete(row)
