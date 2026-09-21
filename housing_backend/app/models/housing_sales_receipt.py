from datetime import datetime

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HousingSalesReceipt(Base):
    """Фактические поступления по выкупу/реализации (сверка из «сумма продажи»)."""

    __tablename__ = "housing_sales_receipts"
    __table_args__ = (UniqueConstraint("year", "source_label", name="uq_sales_receipt_year_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    source_label: Mapped[str] = mapped_column(String(255), nullable=False, default="факт")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
