from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HousingDepartmentRecordBase(BaseModel):
    residential_complex_name: str | None = Field(None, max_length=255)
    address: str | None = None
    fio: str | None = Field(None, max_length=255)
    family_composition: str | None = None
    initial_cost: Decimal | None = None
    market_price: Decimal | None = None
    reimbursement_cost_monthly: Decimal | None = None
    taxable_base: Decimal | None = None
    status: str | None = Field(None, max_length=255)
    residence_period: str | None = Field(None, max_length=255)
    room_count: int | None = None
    total_area: Decimal | None = None
    build_year: int | None = None
    personal_account: str | None = Field(None, max_length=128)
    position: str | None = Field(None, max_length=255)
    department: str | None = Field(None, max_length=255)
    occupancy_and_purchase_basis: str | None = None
    rental_contract: str | None = Field(None, max_length=512)
    purchase_contract: str | None = Field(None, max_length=512)
    payment_schedule: str | None = Field(None, max_length=512)
    ownership_document: str | None = Field(None, max_length=512)
    extra_fields: dict[str, Any] = Field(default_factory=dict)


class HousingDepartmentRecordCreate(HousingDepartmentRecordBase):
    pass


class HousingDepartmentRecordUpdate(BaseModel):
    residential_complex_name: str | None = Field(None, max_length=255)
    address: str | None = None
    fio: str | None = Field(None, max_length=255)
    family_composition: str | None = None
    initial_cost: Decimal | None = None
    market_price: Decimal | None = None
    reimbursement_cost_monthly: Decimal | None = None
    taxable_base: Decimal | None = None
    status: str | None = Field(None, max_length=255)
    residence_period: str | None = Field(None, max_length=255)
    room_count: int | None = None
    total_area: Decimal | None = None
    build_year: int | None = None
    personal_account: str | None = Field(None, max_length=128)
    position: str | None = Field(None, max_length=255)
    department: str | None = Field(None, max_length=255)
    occupancy_and_purchase_basis: str | None = None
    rental_contract: str | None = Field(None, max_length=512)
    purchase_contract: str | None = Field(None, max_length=512)
    payment_schedule: str | None = Field(None, max_length=512)
    ownership_document: str | None = Field(None, max_length=512)
    extra_fields: dict[str, Any] | None = None


class AddColumnRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class HousingDepartmentListResponse(BaseModel):
    custom_headers: list[str] = Field(default_factory=list)
    rows: list["HousingDepartmentRecordRead"]


class HousingDepartmentRecordRead(HousingDepartmentRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
