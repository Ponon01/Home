from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ResidentBase(BaseModel):
    apartment_id: int
    full_name: str = Field(..., max_length=255)
    family_composition: str | None = None
    position: str | None = None
    department: str | None = None
    move_in_date: date | None = None
    move_out_date: date | None = None
    occupancy_basis: str | None = None
    cohabitation: str | None = None
    cohabitant_count: int | None = None
    note: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    contract_file_path: str | None = None
    contract_file_name: str | None = None
    last_paid_month: str | None = None  # YYYY-MM
    is_active: bool = True


class ResidentCreate(ResidentBase):
    pass


class ResidentUpdate(BaseModel):
    apartment_id: int | None = None
    full_name: str | None = Field(None, max_length=255)
    family_composition: str | None = None
    position: str | None = None
    department: str | None = None
    move_in_date: date | None = None
    move_out_date: date | None = None
    occupancy_basis: str | None = None
    cohabitation: str | None = None
    cohabitant_count: int | None = None
    note: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    contract_file_path: str | None = None
    contract_file_name: str | None = None
    last_paid_month: str | None = None  # YYYY-MM
    is_active: bool | None = None


class ResidentRead(ResidentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
