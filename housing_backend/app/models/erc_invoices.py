from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.apartment import Apartment
    from app.models.resident import Resident


class ERCInvoice(Base):
    __tablename__ = "erc_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    apartment_id: Mapped[int] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resident_id: Mapped[int | None] = mapped_column(
        ForeignKey("residents.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # YYYY-MM
    period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)

    due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_payment: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    penalty_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_due: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    # pending | paid
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", server_default="pending")

    uploaded_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apartment: Mapped["Apartment"] = relationship("Apartment")
    resident: Mapped["Resident | None"] = relationship("Resident")

