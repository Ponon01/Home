from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.apartment import Apartment
    from app.models.purchase_financials import PurchaseFinancials


class PurchasePaymentSchedule(Base):
    __tablename__ = "purchase_payment_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_financials_id: Mapped[int | None] = mapped_column(
        ForeignKey("purchase_financials.id", ondelete="CASCADE"), nullable=True, index=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_due: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    amount_paid: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="purchase_payment_schedule")
    purchase_financials: Mapped["PurchaseFinancials | None"] = relationship(
        "PurchaseFinancials", back_populates="payment_schedule"
    )
