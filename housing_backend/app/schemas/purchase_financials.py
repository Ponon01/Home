from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PurchaseFinancialsBase(BaseModel):
    apartment_id: int
    resident_id: int | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    is_current: bool = True
    purchase_contract: str | None = None
    initial_cost: float | None = None
    initial_cost_year: int | None = None
    realization_period: str | None = None
    balance_cost: float | None = None
    valuation_cost: float | None = None
    initial_payment: float | None = None
    repaid_amount_october: float | None = None
    remaining_debt: float | None = None
    monthly_payment: float | None = None
    last_payment_date: date | None = None


class PurchaseFinancialsCreate(PurchaseFinancialsBase):
    pass


class PurchaseFinancialsUpdate(BaseModel):
    resident_id: int | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    is_current: bool | None = None
    purchase_contract: str | None = None
    initial_cost: float | None = None
    initial_cost_year: int | None = None
    realization_period: str | None = None
    balance_cost: float | None = None
    valuation_cost: float | None = None
    initial_payment: float | None = None
    repaid_amount_october: float | None = None
    remaining_debt: float | None = None
    monthly_payment: float | None = None
    last_payment_date: date | None = None


class PurchaseFinancialsRead(PurchaseFinancialsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
