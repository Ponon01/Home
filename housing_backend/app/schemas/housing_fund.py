from datetime import date, datetime

from pydantic import BaseModel, Field


class HousingFundMetrics(BaseModel):
    total_complexes: int = 0
    total_apartments: int = 0
    free_count: int = 0
    free_percent: float = 0.0
    occupied_count: int = 0
    guest_count: int = 0
    sold_count: int = 0
    installment_count: int = 0
    rent_count: int = 0


class YearSeriesPoint(BaseModel):
    year: int
    sold: int = 0
    rent: int = 0
    guest: int = 0


class HousingFundAnalytics(BaseModel):
    metrics: HousingFundMetrics
    by_year: list[YearSeriesPoint] = Field(default_factory=list)
    by_status: dict[str, int] = Field(default_factory=dict)


class ExcelControlTotals(BaseModel):
    """Контрольные цифры из Excel (сверка отчётов)."""

    sales_2019_2025: float = 0
    sales_2026: float = 0
    sales_2026_plus_remainder: float = 0
    modernization_2025: float = 0
    remainder_after_modernization: float = 0
    early_count: int = 0
    early_initial_cost: float = 0
    early_balance_cost: float = 0
    early_valuation_cost: float = 0
    installment_count: int = 0
    installment_initial_cost: float = 0
    installment_initial_payment: float = 0
    installment_monthly: float = 0
    fund_total: int = 0
    fund_not_for_sale: int = 0
    fund_for_sale: int = 0
    fund_rent: int = 0
    fund_guest: int = 0


class CurrentResidentBrief(BaseModel):
    id: int
    full_name: str
    iin: str | None = None
    position: str | None = None
    department: str | None = None
    move_in_date: date | None = None
    occupancy_basis: str | None = None
    payment_status: str | None = None
    monthly_payment: float | None = None
    remaining_debt: float | None = None
    contract_number: str | None = None


class ApartmentCardItem(BaseModel):
    id: int
    residential_complex_name: str
    address: str | None = None
    apartment_number: str | None = None
    house_number: str | None = None
    room_count: int | None = None
    total_area: float | None = None
    status_key: str
    status_label: str
    is_empty: bool = False
    occupancy_status: str = "occupied"
    vacancy_note: str | None = None
    current_resident_name: str | None = None
    current_resident_iin: str | None = None
    department: str | None = None
    floor: int | None = None
    entrance: str | None = None
    payment_due_day: int | None = None
    occupants_count: int = 0
    monthly_deduction: float | None = None
    monthly_payment: float | None = None
    initial_payment: float | None = None
    initial_cost: float | None = None
    amortization_cost: float | None = None
    taxable_base: float | None = None
    occupancy_basis: str | None = None
    contract_end_date: date | None = None
    last_paid_month: str | None = None


class ComplexSummaryCard(BaseModel):
    id: int | None = None
    name: str
    address: str | None = None
    district: str | None = None
    build_year: int | None = None
    image_path: str | None = None
    total_count: int = 0
    rent_count: int = 0
    installment_count: int = 0
    sold_count: int = 0
    guest_count: int = 0
    free_count: int = 0
    rent_as_flat: int = 0
    rent_as_dorm: int = 0
    dorm_flats_info: str | None = None


class ResidenceHistoryItem(BaseModel):
    resident_id: int
    full_name: str
    iin: str | None = None
    position: str | None = None
    department: str | None = None
    move_in_date: date | None = None
    move_out_date: date | None = None
    is_active: bool = False
    occupancy_basis: str | None = None
    note: str | None = None
    event_type: str = "residence"


class ChecklistDocumentFile(BaseModel):
    id: int
    file_name: str
    mime_type: str | None = None
    uploaded_at: datetime | None = None


class ChecklistSlotItem(BaseModel):
    key: str
    label: str
    document_type: str
    section: str
    uploaded: bool = False
    document: ChecklistDocumentFile | None = None


class DocumentChecklistResponse(BaseModel):
    apartment_id: int
    status_key: str
    status_label: str
    slots: list[ChecklistSlotItem] = Field(default_factory=list)


class OccupantCard(BaseModel):
    id: int
    full_name: str
    position: str | None = None
    department: str | None = None
    occupancy_basis: str | None = None
    contract_type: str
    contract_number: str | None = None
    monthly_payment: float | None = None
    remaining_debt: float | None = None
    payment_status: str | None = None
    move_in_date: date | None = None
    room_number: str | None = None
    room_area: float | None = None
    note: str | None = None
    status_key: str
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    contract_file_path: str | None = None
    contract_file_name: str | None = None
    last_paid_month: str | None = None
    document_checklist: list[ChecklistSlotItem] = Field(default_factory=list)


class RoomGroup(BaseModel):
    title: str
    room_number: str | None = None
    room_area: float | None = None
    occupants: list[OccupantCard] = Field(default_factory=list)


class ApartmentDetailCard(BaseModel):
    apartment: ApartmentCardItem
    district: str | None = None
    street: str | None = None
    house_number: str | None = None
    living_area: float | None = None
    build_year: int | None = None
    personal_account: str | None = None
    current_resident: CurrentResidentBrief | None = None
    occupants: list[OccupantCard] = Field(default_factory=list)
    rooms: list[RoomGroup] = Field(default_factory=list)
    history: list[ResidenceHistoryItem] = Field(default_factory=list)
    document_checklist: list[ChecklistSlotItem] = Field(default_factory=list)
