from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.apartment import Apartment
    from app.models.resident import Resident


class RentalFinancials(Base):
    __tablename__ = "rental_financials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    resident_id: Mapped[int | None] = mapped_column(ForeignKey("residents.id", ondelete="SET NULL"), nullable=True, index=True)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true", index=True)

    valuation_object: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    market_price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    proportional_market_price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_2025: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    proportional_balance_value_2025: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    occupied_area_sp: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    shared_area_sp_total: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    shared_area_per_person: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    calculation_area_total: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    cohabitation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cohabitant_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    land_tax_zone_adjustment: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    astana_land_tax_base_rate: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    land_tax_adjustment_for_calc: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    correction_coefficient: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    land_tax_rate: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    land_tax_yearly: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    amortization_monthly: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_1_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_2_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_3_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_4_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_5_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_6_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_7_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_8_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_9_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_10_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_11_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_12_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    balance_value_month_13: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    property_tax_year_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    total_land_and_property_tax_2026: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    material_benefit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    reimbursement_cost_monthly: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    taxable_base: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    contract_status: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rental_contract_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rental_contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    attachment_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changes_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="rental_financials")
    resident: Mapped["Resident | None"] = relationship("Resident", back_populates="rental_financials")
