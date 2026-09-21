from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ApartmentSubtype, ApartmentType

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.purchase_financials import PurchaseFinancials
    from app.models.purchase_payment_schedule import PurchasePaymentSchedule
    from app.models.rental_financials import RentalFinancials
    from app.models.resident import Resident


class Apartment(Base):
    __tablename__ = "apartments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    residential_complex_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    district: Mapped[str | None] = mapped_column(String(255), nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    apartment_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    housing_type: Mapped[ApartmentType] = mapped_column(
        SAEnum(ApartmentType, values_callable=lambda x: [e.value for e in x], name="housing_type"),
        nullable=False,
    )
    apartment_subtype: Mapped[ApartmentSubtype] = mapped_column(
        SAEnum(ApartmentSubtype, values_callable=lambda x: [e.value for e in x], name="apartment_subtype"),
        nullable=False,
    )
    room_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_area: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    living_area: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    build_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    entrance: Mapped[str | None] = mapped_column(String(64), nullable=True)
    personal_account: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payment_due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str | None] = mapped_column(String(128), nullable=True)
    monthly_deduction: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    amortization_cost: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    taxable_base: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    residents: Mapped[list["Resident"]] = relationship(
        "Resident", back_populates="apartment", cascade="all, delete-orphan"
    )
    rental_financials: Mapped[list["RentalFinancials"]] = relationship(
        "RentalFinancials", back_populates="apartment", cascade="all, delete-orphan"
    )
    purchase_financials: Mapped[list["PurchaseFinancials"]] = relationship(
        "PurchaseFinancials", back_populates="apartment", cascade="all, delete-orphan"
    )
    purchase_payment_schedule: Mapped[list["PurchasePaymentSchedule"]] = relationship(
        "PurchasePaymentSchedule", back_populates="apartment", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="apartment", cascade="all, delete-orphan"
    )
