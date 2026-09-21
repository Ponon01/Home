from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BudgetPurchaseImportMeta(Base):
    """Column order and import stats for Budget Purchase (single row, id=1)."""

    __tablename__ = "budget_purchase_import_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_file: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sheets: Mapped[list | None] = mapped_column(JSON, nullable=True)
    column_order: Mapped[list | None] = mapped_column(JSON, nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
