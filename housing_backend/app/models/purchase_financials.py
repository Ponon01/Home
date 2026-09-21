from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.apartment import Apartment
    from app.models.purchase_payment_schedule import PurchasePaymentSchedule
    from app.models.resident import Resident


class PurchaseFinancials(Base):
    __tablename__ = "purchase_financials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    resident_id: Mapped[int | None] = mapped_column(ForeignKey("residents.id", ondelete="SET NULL"), nullable=True, index=True)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true", index=True)
    purchase_contract: Mapped[str | None] = mapped_column(String(255), nullable=True)
    initial_cost: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    initial_cost_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    realization_period: Mapped[str | None] = mapped_column(String(255), nullable=True)
    balance_cost: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    valuation_cost: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    initial_payment: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    repaid_amount_october: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    remaining_debt: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    monthly_payment: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    last_payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="purchase_financials")
    resident: Mapped["Resident | None"] = relationship("Resident", back_populates="purchase_financials")
    payment_schedule: Mapped[list["PurchasePaymentSchedule"]] = relationship(
        "PurchasePaymentSchedule",
        back_populates="purchase_financials",
        cascade="all, delete-orphan",
    )
