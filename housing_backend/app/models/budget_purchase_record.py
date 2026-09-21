from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BudgetPurchaseRecord(Base):
    __tablename__ = "budget_purchase_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_sheet: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Search / dedup helpers (mirrored from excel_columns)
    address: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    fio: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    purchase_contract: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # All Excel columns keyed by exact header text from row 1 of each sheet
    excel_columns: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
