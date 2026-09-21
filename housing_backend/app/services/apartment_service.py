from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.apartment import Apartment
from app.schemas.apartment import ApartmentRead
from app.schemas.document import DocumentRead
from app.schemas.full_card import ApartmentFullCard
from app.schemas.purchase_financials import PurchaseFinancialsRead
from app.schemas.purchase_payment_schedule import PurchasePaymentScheduleRead
from app.schemas.rental_financials import RentalFinancialsRead
from app.schemas.resident import ResidentRead


async def get_apartment_full_card(db: AsyncSession, apartment_id: int) -> ApartmentFullCard | None:
    stmt = (
        select(Apartment)
        .where(Apartment.id == apartment_id)
        .options(
            selectinload(Apartment.residents),
            selectinload(Apartment.rental_financials),
            selectinload(Apartment.purchase_financials),
            selectinload(Apartment.purchase_payment_schedule),
            selectinload(Apartment.documents),
        )
    )
    result = await db.execute(stmt)
    apt = result.scalar_one_or_none()
    if apt is None:
        return None
    return ApartmentFullCard(
        apartment=ApartmentRead.model_validate(apt),
        residents=[ResidentRead.model_validate(r) for r in apt.residents],
        rental_financials=[RentalFinancialsRead.model_validate(rf) for rf in apt.rental_financials],
        purchase_financials=[PurchaseFinancialsRead.model_validate(pf) for pf in apt.purchase_financials],
        purchase_payment_schedule=[
            PurchasePaymentScheduleRead.model_validate(p) for p in apt.purchase_payment_schedule
        ],
        documents=[DocumentRead.model_validate(d) for d in apt.documents],
    )
