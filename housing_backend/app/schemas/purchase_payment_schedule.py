from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PurchasePaymentScheduleBase(BaseModel):
    apartment_id: int
    purchase_financials_id: int | None = None
    year: int = Field(..., ge=1900, le=2100)
    month: int = Field(..., ge=1, le=12)
    amount_due: float | None = None
    amount_paid: float | None = None
    note: str | None = None


class PurchasePaymentScheduleCreate(PurchasePaymentScheduleBase):
    pass


class PurchasePaymentScheduleUpdate(BaseModel):
    apartment_id: int | None = None
    purchase_financials_id: int | None = None
    year: int | None = Field(None, ge=1900, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    amount_due: float | None = None
    amount_paid: float | None = None
    note: str | None = None


class PurchasePaymentScheduleRead(PurchasePaymentScheduleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
