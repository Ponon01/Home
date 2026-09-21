from datetime import date, datetime

from pydantic import BaseModel, Field


class RegistryListItem(BaseModel):
    resident_id: int
    full_name: str
    iin: str | None = None
    position: str | None = None
    department: str | None = None
    category: str
    residential_complex_name: str
    address: str | None = None
    room_count: int | None = None
    total_area: float | None = None
    contract_status: str | None = None
    monthly_payment: float | None = None
    remaining_debt: float | None = None


class RegistryContractInfo(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    occupancy_basis: str | None = None
    rental_contract_number: str | None = None
    rental_contract_date: date | None = None
    purchase_contract: str | None = None
    realization_period: str | None = None


class RegistryDocumentInfo(BaseModel):
    id: int
    document_type: str
    file_name: str
    uploaded_at: datetime


class RegistryResidentDetail(BaseModel):
    resident_id: int
    full_name: str
    iin: str | None = None
    family_composition: str | None = None
    position: str | None = None
    department: str | None = None
    move_in_date: date | None = None
    move_out_date: date | None = None
    category: str
    apartment: dict[str, str | int | float | None]
    contract: RegistryContractInfo
    documents: list[RegistryDocumentInfo] = Field(default_factory=list)
    finance: dict[str, float | str | None] = Field(default_factory=dict)
