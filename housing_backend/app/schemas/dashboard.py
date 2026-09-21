from pydantic import BaseModel, Field


class DashboardTableRow(BaseModel):
    """One row of the main dashboard / Excel-style summary per residential complex."""

    residential_complex_name: str
    total_count: int = Field(..., ge=0)
    not_for_sale_count: int = Field(..., ge=0)
    for_sale_count: int = Field(..., ge=0)
    transfer_year: int | None = None
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
    rent_count: int = Field(..., ge=0)
    guest_count: int = Field(..., ge=0)
    guest_gph_count: int = Field(..., ge=0)
    # Kept for existing dashboard UI / API consumers
    full_sold_count: int = Field(0, ge=0)
    installment_count: int = Field(0, ge=0)


# Backward-compatible name for imports and OpenAPI consumers
ComplexSummary = DashboardTableRow


class DashboardSummaryResponse(BaseModel):
    complexes: list[DashboardTableRow]
