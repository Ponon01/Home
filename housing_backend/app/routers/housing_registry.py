from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.session import get_db
from app.models.apartment import Apartment
from app.models.document import Document
from app.models.enums import ApartmentSubtype
from app.models.purchase_financials import PurchaseFinancials
from app.models.rental_financials import RentalFinancials
from app.models.resident import Resident
from app.schemas.housing_registry import (
    RegistryContractInfo,
    RegistryDocumentInfo,
    RegistryListItem,
    RegistryResidentDetail,
)

router = APIRouter(prefix="/housing-registry", tags=["housing-registry"])


def _category_label(subtype: ApartmentSubtype) -> str:
    mapping = {
        ApartmentSubtype.full_sold: "Выкуплено (100%)",
        ApartmentSubtype.installment: "Рассрочка (Выкуп)",
        ApartmentSubtype.rent: "Аренда",
        ApartmentSubtype.guest: "Гостевой фонд",
        ApartmentSubtype.guest_gph: "Гостевой фонд",
    }
    return mapping.get(subtype, "Аренда")


@router.get("/residents", response_model=list[RegistryListItem])
async def list_registry_residents(
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[RegistryListItem]:
    stmt = (
        select(Resident)
        .options(
            selectinload(Resident.apartment),
            selectinload(Resident.rental_financials),
            selectinload(Resident.purchase_financials),
        )
        .where(Resident.is_active.is_(True))
        .order_by(Resident.full_name)
    )
    residents = (await db.execute(stmt)).scalars().all()

    query = (search or "").strip().lower()
    output: list[RegistryListItem] = []
    for resident in residents:
        apartment = resident.apartment
        if apartment is None:
            continue

        category_label = _category_label(apartment.apartment_subtype)
        if category and category != "all" and category_label != category:
            continue

        if query:
            haystack = " ".join(
                [
                    resident.full_name or "",
                    resident.iin or "",
                    apartment.residential_complex_name or "",
                    apartment.address or "",
                ]
            ).lower()
            if query not in haystack:
                continue

        rental = resident.rental_financials[0] if resident.rental_financials else None
        purchase = resident.purchase_financials[0] if resident.purchase_financials else None
        monthly_payment = rental.reimbursement_cost_monthly if rental else purchase.monthly_payment if purchase else None
        remaining_debt = purchase.remaining_debt if purchase else None
        contract_status = rental.contract_status if rental else None

        output.append(
            RegistryListItem(
                resident_id=resident.id,
                full_name=resident.full_name,
                iin=resident.iin,
                position=resident.position,
                department=resident.department,
                category=category_label,
                residential_complex_name=apartment.residential_complex_name,
                address=apartment.address,
                room_count=apartment.room_count,
                total_area=float(apartment.total_area) if apartment.total_area is not None else None,
                contract_status=contract_status,
                monthly_payment=float(monthly_payment) if monthly_payment is not None else None,
                remaining_debt=float(remaining_debt) if remaining_debt is not None else None,
            )
        )

    return output


@router.get("/residents/{resident_id}", response_model=RegistryResidentDetail)
async def get_registry_resident(
    resident_id: int,
    db: AsyncSession = Depends(get_db),
) -> RegistryResidentDetail:
    stmt = (
        select(Resident)
        .where(Resident.id == resident_id)
        .options(
            selectinload(Resident.apartment).selectinload(Apartment.documents),
            selectinload(Resident.rental_financials),
            selectinload(Resident.purchase_financials),
        )
    )
    resident = (await db.execute(stmt)).scalar_one_or_none()
    if resident is None or resident.apartment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    apartment = resident.apartment
    rental: RentalFinancials | None = resident.rental_financials[0] if resident.rental_financials else None
    purchase: PurchaseFinancials | None = resident.purchase_financials[0] if resident.purchase_financials else None

    docs = sorted(apartment.documents, key=lambda d: d.uploaded_at, reverse=True)
    doc_items = [
        RegistryDocumentInfo(
            id=doc.id,
            document_type=doc.document_type.value,
            file_name=doc.file_name,
            uploaded_at=doc.uploaded_at,
        )
        for doc in docs
    ]

    contract = RegistryContractInfo(
        start_date=resident.move_in_date,
        end_date=resident.move_out_date,
        occupancy_basis=resident.occupancy_basis,
        rental_contract_number=rental.rental_contract_number if rental else None,
        rental_contract_date=rental.rental_contract_date if rental else None,
        purchase_contract=purchase.purchase_contract if purchase else None,
        realization_period=purchase.realization_period if purchase else None,
    )

    finance: dict[str, float | str | None] = {
        "monthly_rent_payment": float(rental.reimbursement_cost_monthly) if rental and rental.reimbursement_cost_monthly is not None else None,
        "taxable_base": float(rental.taxable_base) if rental and rental.taxable_base is not None else None,
        "initial_cost": float(purchase.initial_cost) if purchase and purchase.initial_cost is not None else None,
        "valuation_cost": float(purchase.valuation_cost) if purchase and purchase.valuation_cost is not None else None,
        "monthly_installment_payment": float(purchase.monthly_payment) if purchase and purchase.monthly_payment is not None else None,
        "remaining_debt": float(purchase.remaining_debt) if purchase and purchase.remaining_debt is not None else None,
    }

    return RegistryResidentDetail(
        resident_id=resident.id,
        full_name=resident.full_name,
        iin=resident.iin,
        family_composition=resident.family_composition,
        position=resident.position,
        department=resident.department,
        move_in_date=resident.move_in_date,
        move_out_date=resident.move_out_date,
        category=_category_label(apartment.apartment_subtype),
        apartment={
            "residential_complex_name": apartment.residential_complex_name,
            "address": apartment.address,
            "district": apartment.district,
            "street": apartment.street,
            "house_number": apartment.house_number,
            "apartment_number": apartment.apartment_number,
            "room_count": apartment.room_count,
            "total_area": float(apartment.total_area) if apartment.total_area is not None else None,
        },
        contract=contract,
        documents=doc_items,
        finance=finance,
    )
