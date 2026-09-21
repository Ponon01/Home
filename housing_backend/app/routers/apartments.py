from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype, ApartmentType
from app.models.purchase_financials import PurchaseFinancials
from app.models.rental_financials import RentalFinancials
from app.models.resident import Resident
from app.models.user import User
from app.schemas.apartment import ApartmentCreate, ApartmentRead, ApartmentUpdate
from app.schemas.full_card import ApartmentFullCard
from app.services.apartment_service import get_apartment_full_card
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/apartments", tags=["apartments"])

_STATUS_TO_SUBTYPE = {
    "sold": (ApartmentType.purchase, ApartmentSubtype.full_sold),
    "installment": (ApartmentType.purchase, ApartmentSubtype.installment),
    "guest": (ApartmentType.rent, ApartmentSubtype.guest),
    "rent": (ApartmentType.rent, ApartmentSubtype.rent),
    "free": (ApartmentType.rent, ApartmentSubtype.rent),
}

_APT_DIRECT_FIELDS = {
    "residential_complex_name",
    "district",
    "street",
    "house_number",
    "apartment_number",
    "address",
    "housing_type",
    "apartment_subtype",
    "room_count",
    "total_area",
    "living_area",
    "build_year",
    "floor",
    "entrance",
    "personal_account",
    "payment_due_day",
    "status",
    "monthly_deduction",
    "amortization_cost",
    "taxable_base",
}


def _apply_status_key(apt: Apartment, status_key: str) -> None:
    mapping = _STATUS_TO_SUBTYPE.get(status_key)
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неизвестный статус: {status_key}",
        )
    housing_type, subtype = mapping
    apt.housing_type = housing_type
    apt.apartment_subtype = subtype
    if status_key == "free":
        apt.status = "vacant"
    else:
        apt.status = "active"


@router.get("", response_model=list[ApartmentRead])
async def list_apartments(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[ApartmentRead]:
    stmt = select(Apartment).offset(skip).limit(min(limit, 500)).order_by(Apartment.id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [ApartmentRead.model_validate(a) for a in items]


@router.get("/{apartment_id}/full-card", response_model=ApartmentFullCard)
async def get_full_card(apartment_id: int, db: AsyncSession = Depends(get_db)) -> ApartmentFullCard:
    card = await get_apartment_full_card(db, apartment_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    return card


@router.get("/{apartment_id}", response_model=ApartmentRead)
async def get_apartment(apartment_id: int, db: AsyncSession = Depends(get_db)) -> ApartmentRead:
    apt = await db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    return ApartmentRead.model_validate(apt)


@router.post("", response_model=ApartmentRead, status_code=status.HTTP_201_CREATED)
async def create_apartment(
    body: ApartmentCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> ApartmentRead:
    apt = Apartment(**body.model_dump())
    db.add(apt)
    await db.flush()
    await write_audit_log(
        db,
        user=user,
        action="create",
        entity_type="apartment",
        entity_id=apt.id,
        new_value=body.model_dump(),
    )
    await db.refresh(apt)
    return ApartmentRead.model_validate(apt)


@router.patch("/{apartment_id}", response_model=ApartmentRead)
@router.put("/{apartment_id}", response_model=ApartmentRead)
async def update_apartment(
    apartment_id: int,
    body: ApartmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ApartmentRead:
    try:
        apt = await db.get(Apartment, apartment_id)
        if not apt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Квартира не найдена")
        old = {"id": apt.id, **ApartmentRead.model_validate(apt).model_dump(mode="json")}

        fields = body.model_dump(exclude_unset=True)

        # Aliases
        if "full_name" not in fields and "person_name" in fields:
            fields["full_name"] = fields["person_name"]
        if "occupancy_basis" not in fields and "contract" in fields:
            fields["occupancy_basis"] = fields["contract"]

        status_key = fields.get("status_key")
        resident_id = fields.get("resident_id") if "resident_id" in fields else None
        has_resident_patch = any(
            key in fields
            for key in (
                "full_name",
                "person_name",
                "position",
                "department",
                "occupancy_basis",
                "contract",
                "resident_id",
            )
        )
        has_payment_patch = "monthly_payment" in fields
        has_contract_patch = "contract_start_date" in fields or "contract_end_date" in fields
        has_last_paid_patch = "last_paid_month" in fields

        for key in _APT_DIRECT_FIELDS:
            if key in fields:
                setattr(apt, key, fields[key])

        if status_key is not None:
            _apply_status_key(apt, status_key)

        needs_relations = (
            has_resident_patch
            or has_payment_patch
            or has_contract_patch
            or has_last_paid_patch
            or status_key == "free"
        )
        if needs_relations:
            stmt = (
                select(Apartment)
                .where(Apartment.id == apartment_id)
                .options(
                    selectinload(Apartment.residents),
                    selectinload(Apartment.rental_financials),
                    selectinload(Apartment.purchase_financials),
                )
            )
            apt = (await db.execute(stmt)).scalar_one()

        if status_key == "free":
            for res in apt.residents:
                if res.is_active:
                    res.is_active = False
        elif has_resident_patch:
            target: Resident | None = None
            if resident_id is not None:
                target = next((r for r in apt.residents if r.id == resident_id), None)
            if target is None:
                target = next((r for r in apt.residents if r.is_active), None)

            incoming_name = fields["full_name"] if "full_name" in fields else None
            if target is None and incoming_name:
                target = Resident(apartment_id=apt.id, full_name=incoming_name, is_active=True)
                db.add(target)
                await db.flush()

            if target is not None:
                # Apply clears: key present with None → set NULL (except full_name NOT NULL → "")
                if "full_name" in fields:
                    target.full_name = fields["full_name"] or ""
                if "position" in fields:
                    target.position = fields["position"]
                if "department" in fields:
                    target.department = fields["department"]
                if "occupancy_basis" in fields:
                    target.occupancy_basis = fields["occupancy_basis"]
                target.is_active = True
                if status_key and status_key != "free":
                    apt.status = "active"

        if has_payment_patch:
            monthly_payment = fields["monthly_payment"]
            if apt.housing_type == ApartmentType.purchase:
                pf = next((p for p in apt.purchase_financials if p.is_current), None)
                if pf is None:
                    pf = PurchaseFinancials(apartment_id=apt.id, is_current=True)
                    db.add(pf)
                pf.monthly_payment = monthly_payment
            else:
                rf = next((r for r in apt.rental_financials if r.is_current), None)
                if rf is None:
                    rf = RentalFinancials(apartment_id=apt.id, is_current=True)
                    db.add(rf)
                rf.reimbursement_cost_monthly = monthly_payment

        # Contract dates on resident
        if has_contract_patch and needs_relations:
            from datetime import date as _date
            target_res = next((r for r in apt.residents if r.is_active), None)
            if target_res:
                if "contract_start_date" in fields:
                    val = fields["contract_start_date"]
                    target_res.contract_start_date = _date.fromisoformat(val) if val else None
                if "contract_end_date" in fields:
                    val = fields["contract_end_date"]
                    target_res.contract_end_date = _date.fromisoformat(val) if val else None

        # Last paid month on resident (YYYY-MM)
        if has_last_paid_patch and needs_relations:
            target_res = next((r for r in apt.residents if r.is_active), None)
            if target_res:
                last_paid = fields.get("last_paid_month")
                if last_paid is None:
                    target_res.last_paid_month = None
                else:
                    target_res.last_paid_month = str(last_paid).strip() or None

        await db.flush()
        await db.refresh(apt)
        await write_audit_log(
            db,
            user=user,
            action="update",
            entity_type="apartment",
            entity_id=apt.id,
            old_value=old,
            new_value=ApartmentRead.model_validate(apt).model_dump(mode="json"),
        )
        return ApartmentRead.model_validate(apt)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось сохранить квартиру: {exc}",
        ) from exc


@router.delete("/{apartment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_apartment(
    apartment_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    apt = await db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    await write_audit_log(
        db,
        user=user,
        action="delete",
        entity_type="apartment",
        entity_id=apt.id,
        old_value=ApartmentRead.model_validate(apt).model_dump(),
    )
    await db.delete(apt)
