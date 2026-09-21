from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class RentalFinancialsBase(BaseModel):
    apartment_id: int
    resident_id: int | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    is_current: bool = True
    valuation_object: str | None = None
    quantity: float | None = None
    market_price: float | None = None
    proportional_market_price: float | None = None
    balance_value_2025: float | None = None
    proportional_balance_value_2025: float | None = None
    occupied_area_sp: float | None = None
    shared_area_sp_total: float | None = None
    shared_area_per_person: float | None = None
    calculation_area_total: float | None = None
    cohabitation: str | None = None
    cohabitant_count: int | None = None
    note: str | None = None
    land_tax_zone_adjustment: float | None = None
    astana_land_tax_base_rate: float | None = None
    land_tax_adjustment_for_calc: float | None = None
    correction_coefficient: float | None = None
    land_tax_rate: float | None = None
    land_tax_yearly: float | None = None
    amortization_monthly: float | None = None
    balance_value_month_1_2026: float | None = None
    balance_value_month_2_2026: float | None = None
    balance_value_month_3_2026: float | None = None
    balance_value_month_4_2026: float | None = None
    balance_value_month_5_2026: float | None = None
    balance_value_month_6_2026: float | None = None
    balance_value_month_7_2026: float | None = None
    balance_value_month_8_2026: float | None = None
    balance_value_month_9_2026: float | None = None
    balance_value_month_10_2026: float | None = None
    balance_value_month_11_2026: float | None = None
    balance_value_month_12_2026: float | None = None
    balance_value_month_13: float | None = None
    property_tax_year_2026: float | None = None
    total_land_and_property_tax_2026: float | None = None
    material_benefit: float | None = None
    reimbursement_cost_monthly: float | None = None
    taxable_base: float | None = None
    contract_status: str | None = None
    rental_contract_number: str | None = None
    rental_contract_date: date | None = None
    attachment_note: str | None = None
    changes_note: str | None = None


class RentalFinancialsCreate(RentalFinancialsBase):
    pass


class RentalFinancialsUpdate(BaseModel):
    resident_id: int | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    is_current: bool | None = None
    valuation_object: str | None = None
    quantity: float | None = None
    market_price: float | None = None
    proportional_market_price: float | None = None
    balance_value_2025: float | None = None
    proportional_balance_value_2025: float | None = None
    occupied_area_sp: float | None = None
    shared_area_sp_total: float | None = None
    shared_area_per_person: float | None = None
    calculation_area_total: float | None = None
    cohabitation: str | None = None
    cohabitant_count: int | None = None
    note: str | None = None
    land_tax_zone_adjustment: float | None = None
    astana_land_tax_base_rate: float | None = None
    land_tax_adjustment_for_calc: float | None = None
    correction_coefficient: float | None = None
    land_tax_rate: float | None = None
    land_tax_yearly: float | None = None
    amortization_monthly: float | None = None
    balance_value_month_1_2026: float | None = None
    balance_value_month_2_2026: float | None = None
    balance_value_month_3_2026: float | None = None
    balance_value_month_4_2026: float | None = None
    balance_value_month_5_2026: float | None = None
    balance_value_month_6_2026: float | None = None
    balance_value_month_7_2026: float | None = None
    balance_value_month_8_2026: float | None = None
    balance_value_month_9_2026: float | None = None
    balance_value_month_10_2026: float | None = None
    balance_value_month_11_2026: float | None = None
    balance_value_month_12_2026: float | None = None
    balance_value_month_13: float | None = None
    property_tax_year_2026: float | None = None
    total_land_and_property_tax_2026: float | None = None
    material_benefit: float | None = None
    reimbursement_cost_monthly: float | None = None
    taxable_base: float | None = None
    contract_status: str | None = None
    rental_contract_number: str | None = None
    rental_contract_date: date | None = None
    attachment_note: str | None = None
    changes_note: str | None = None


class RentalFinancialsRead(RentalFinancialsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
