from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class DashboardManualSummary(Base):
    __tablename__ = "dashboard_manual_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    residential_complex_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    not_for_sale_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    for_sale_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    transfer_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sold_2019: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2020: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2021: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2022: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2023: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2024: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2025: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_2026: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sold_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    remaining_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    guest_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    guest_gph_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rent_as_flat: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rent_as_dorm: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    dorm_flats_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    updated_by_user: Mapped["User | None"] = relationship("User", foreign_keys=[updated_by_user_id])
