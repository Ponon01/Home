from pydantic import BaseModel

from app.schemas.apartment import ApartmentRead
from app.schemas.document import DocumentRead
from app.schemas.purchase_financials import PurchaseFinancialsRead
from app.schemas.purchase_payment_schedule import PurchasePaymentScheduleRead
from app.schemas.rental_financials import RentalFinancialsRead
from app.schemas.resident import ResidentRead


class ApartmentFullCard(BaseModel):
    apartment: ApartmentRead
    residents: list[ResidentRead]
    rental_financials: list[RentalFinancialsRead]
    purchase_financials: list[PurchaseFinancialsRead]
    purchase_payment_schedule: list[PurchasePaymentScheduleRead]
    documents: list[DocumentRead]
