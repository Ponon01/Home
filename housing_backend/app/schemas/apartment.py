from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import ApartmentSubtype, ApartmentType


def _blank_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


class ApartmentBase(BaseModel):
    residential_complex_name: str = Field(..., max_length=255)
    district: str | None = None
    street: str | None = None
    house_number: str | None = None
    apartment_number: str | None = None
    address: str | None = None
    housing_type: ApartmentType
    apartment_subtype: ApartmentSubtype
    room_count: int | None = None
    total_area: float | None = None
    living_area: float | None = None
    build_year: int | None = None
    floor: int | None = None
    entrance: str | None = None
    personal_account: str | None = None
    payment_due_day: int | None = None
    status: str | None = None
    monthly_deduction: float | None = None
    amortization_cost: float | None = None
    taxable_base: float | None = None


class ApartmentCreate(ApartmentBase):
    pass


class ApartmentUpdate(BaseModel):
    residential_complex_name: str | None = Field(None, max_length=255)
    district: str | None = None
    street: str | None = None
    house_number: str | None = None
    apartment_number: str | None = None
    address: str | None = None
    housing_type: ApartmentType | None = None
    apartment_subtype: ApartmentSubtype | None = None
    status_key: str | None = None
    room_count: int | None = None
    total_area: float | None = None
    living_area: float | None = None
    build_year: int | None = None
    floor: int | None = None
    entrance: str | None = None
    personal_account: str | None = None
    payment_due_day: int | None = None
    status: str | None = None
    # Optional / nullable resident fields — empty string clears to null
    resident_id: int | None = None
    full_name: str | None = Field(None, max_length=255)
    person_name: str | None = Field(None, max_length=255)  # alias
    position: str | None = None
    department: str | None = None
    occupancy_basis: str | None = None
    contract: str | None = None  # alias for occupancy_basis
    monthly_payment: float | None = None
    monthly_deduction: float | None = None
    amortization_cost: float | None = None
    taxable_base: float | None = None
    contract_start_date: str | None = None
    contract_end_date: str | None = None
    last_paid_month: str | None = None  # YYYY-MM

    @field_validator(
        "district",
        "street",
        "house_number",
        "apartment_number",
        "address",
        "entrance",
        "personal_account",
        "full_name",
        "person_name",
        "position",
        "department",
        "occupancy_basis",
        "contract",
        "status",
        "status_key",
        mode="before",
    )
    @classmethod
    def blank_strings_to_none(cls, value: Any) -> Any:
        return _blank_to_none(value)

    @field_validator("floor", "room_count", "build_year", "payment_due_day", mode="before")
    @classmethod
    def blank_number_to_none(cls, value: Any) -> Any:
        if value is None or value == "":
            return None
        return value

    @field_validator("total_area", "living_area", "monthly_payment", "monthly_deduction", "amortization_cost", "taxable_base", mode="before")
    @classmethod
    def blank_float_to_none(cls, value: Any) -> Any:
        if value is None or value == "":
            return None
        return value


class ApartmentRead(ApartmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
