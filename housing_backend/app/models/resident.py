from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.apartment import Apartment
    from app.models.document import Document
    from app.models.purchase_financials import PurchaseFinancials
    from app.models.rental_financials import RentalFinancials


class Resident(Base):
    __tablename__ = "residents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    iin: Mapped[str | None] = mapped_column(String(12), nullable=True, index=True)
    family_composition: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    move_in_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    move_out_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    occupancy_basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    cohabitation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cohabitant_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    contract_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    contract_file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    last_paid_month: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)  # YYYY-MM
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    apartment: Mapped["Apartment"] = relationship("Apartment", back_populates="residents")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="resident")
    rental_financials: Mapped[list["RentalFinancials"]] = relationship("RentalFinancials", back_populates="resident")
    purchase_financials: Mapped[list["PurchaseFinancials"]] = relationship("PurchaseFinancials", back_populates="resident")
