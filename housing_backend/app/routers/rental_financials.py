from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.apartment import Apartment
from app.models.rental_financials import RentalFinancials
from app.models.user import User
from app.schemas.rental_financials import RentalFinancialsCreate, RentalFinancialsRead, RentalFinancialsUpdate
from app.utils.model_updates import apply_updates
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/rental-financials", tags=["rental-financials"])


async def _ensure_apartment(db: AsyncSession, apartment_id: int) -> None:
    apt = await db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apartment not found")


@router.get("", response_model=list[RentalFinancialsRead])
async def list_rental_financials(
    skip: int = 0,
    limit: int = 100,
    apartment_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[RentalFinancialsRead]:
    stmt = select(RentalFinancials)
    if apartment_id is not None:
        stmt = stmt.where(RentalFinancials.apartment_id == apartment_id)
    stmt = stmt.offset(skip).limit(min(limit, 500)).order_by(RentalFinancials.id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [RentalFinancialsRead.model_validate(x) for x in items]


@router.get("/{record_id}", response_model=RentalFinancialsRead)
async def get_rental_financials(record_id: int, db: AsyncSession = Depends(get_db)) -> RentalFinancialsRead:
    row = await db.get(RentalFinancials, record_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return RentalFinancialsRead.model_validate(row)


@router.post("", response_model=RentalFinancialsRead, status_code=status.HTTP_201_CREATED)
async def create_rental_financials(
    body: RentalFinancialsCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RentalFinancialsRead:
    await _ensure_apartment(db, body.apartment_id)
    row = RentalFinancials(**body.model_dump())
    db.add(row)
    await db.flush()
    await write_audit_log(
        db, user=user, action="create", entity_type="rental_financials", entity_id=row.id, new_value=body.model_dump()
    )
    await db.refresh(row)
    return RentalFinancialsRead.model_validate(row)


@router.patch("/{record_id}", response_model=RentalFinancialsRead)
async def update_rental_financials(
    record_id: int,
    body: RentalFinancialsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RentalFinancialsRead:
    row = await db.get(RentalFinancials, record_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    old = RentalFinancialsRead.model_validate(row).model_dump()
    apply_updates(row, body)
    await db.flush()
    await write_audit_log(
        db,
        user=user,
        action="update",
        entity_type="rental_financials",
        entity_id=row.id,
        old_value=old,
        new_value=RentalFinancialsRead.model_validate(row).model_dump(),
    )
    await db.refresh(row)
    return RentalFinancialsRead.model_validate(row)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rental_financials(
    record_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    row = await db.get(RentalFinancials, record_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    await write_audit_log(
        db,
        user=user,
        action="delete",
        entity_type="rental_financials",
        entity_id=row.id,
        old_value=RentalFinancialsRead.model_validate(row).model_dump(),
    )
    await db.delete(row)
