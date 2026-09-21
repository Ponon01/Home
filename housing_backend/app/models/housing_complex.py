from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HousingComplex(Base):
    """Editable ЖК profile (name, location, build year) for housing fund cards."""

    __tablename__ = "housing_complexes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    district: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    build_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rent_as_flat: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rent_as_dorm: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    dorm_flats_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
