from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ManualSummaryBase(BaseModel):
    residential_complex_name: str = Field(..., min_length=1, max_length=255)
    total_count: int = Field(0, ge=0)
    not_for_sale_count: int = Field(0, ge=0)
    for_sale_count: int = Field(0, ge=0)
    transfer_year: int | None = Field(None, ge=1900, le=2100)
    sold_2019: int = Field(0, ge=0)
    sold_2020: int = Field(0, ge=0)
    sold_2021: int = Field(0, ge=0)
    sold_2022: int = Field(0, ge=0)
    sold_2023: int = Field(0, ge=0)
    sold_2024: int = Field(0, ge=0)
    sold_2025: int = Field(0, ge=0)
    sold_2026: int = Field(0, ge=0)
    sold_total: int = Field(0, ge=0)
    remaining_total: int = Field(0, ge=0)
    rent_count: int = Field(0, ge=0)
    guest_count: int = Field(0, ge=0)
    guest_gph_count: int = Field(0, ge=0)
    rent_as_flat: int = Field(0, ge=0)
    rent_as_dorm: int = Field(0, ge=0)
    dorm_flats_info: str | None = None
    notes: str | None = None


class ManualSummaryCreate(ManualSummaryBase):
    pass


class ManualSummaryUpdate(BaseModel):
    residential_complex_name: str | None = Field(None, min_length=1, max_length=255)
    total_count: int | None = Field(None, ge=0)
    not_for_sale_count: int | None = Field(None, ge=0)
    for_sale_count: int | None = Field(None, ge=0)
    transfer_year: int | None = Field(None, ge=1900, le=2100)
    sold_2019: int | None = Field(None, ge=0)
    sold_2020: int | None = Field(None, ge=0)
    sold_2021: int | None = Field(None, ge=0)
    sold_2022: int | None = Field(None, ge=0)
    sold_2023: int | None = Field(None, ge=0)
    sold_2024: int | None = Field(None, ge=0)
    sold_2025: int | None = Field(None, ge=0)
    sold_2026: int | None = Field(None, ge=0)
    sold_total: int | None = Field(None, ge=0)
    remaining_total: int | None = Field(None, ge=0)
    rent_count: int | None = Field(None, ge=0)
    guest_count: int | None = Field(None, ge=0)
    guest_gph_count: int | None = Field(None, ge=0)
    rent_as_flat: int | None = Field(None, ge=0)
    rent_as_dorm: int | None = Field(None, ge=0)
    dorm_flats_info: str | None = None
    notes: str | None = None


class ManualSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    residential_complex_name: str
    total_count: int
    not_for_sale_count: int
    for_sale_count: int
    transfer_year: int | None
    sold_2019: int
    sold_2020: int
    sold_2021: int
    sold_2022: int
    sold_2023: int
    sold_2024: int
    sold_2025: int
    sold_2026: int
    sold_total: int
    remaining_total: int
    rent_count: int
    guest_count: int
    guest_gph_count: int
    rent_as_flat: int
    rent_as_dorm: int
    dorm_flats_info: str | None
    updated_by_user_id: int | None
    updated_at: datetime
    notes: str | None
    image_path: str | None = None


class ManualDashboardSummaryListResponse(BaseModel):
    rows: list[ManualSummaryRead]
