from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HousingDepartmentRecord(Base):
    __tablename__ = "housing_department_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    residential_complex_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    fio: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    family_composition: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    initial_cost: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    market_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    reimbursement_cost_monthly: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    taxable_base: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    
    status: Mapped[str | None] = mapped_column(String(255), nullable=True)
    residence_period: Mapped[str | None] = mapped_column(String(255), nullable=True)
    room_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_area: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    build_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    personal_account: Mapped[str | None] = mapped_column(String(128), nullable=True)
    
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occupancy_and_purchase_basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    rental_contract: Mapped[str | None] = mapped_column(String(512), nullable=True)
    purchase_contract: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payment_schedule: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ownership_document: Mapped[str | None] = mapped_column(String(512), nullable=True)
    extra_fields: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
