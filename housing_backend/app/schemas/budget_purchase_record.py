from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class BudgetPurchaseRecordRead(BaseModel):
    id: int
    source_sheet: str | None = None
    address: str | None = None
    fio: str | None = None
    purchase_contract: str | None = None
    excel_columns: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetPurchaseColumnsResponse(BaseModel):
    columns: list[str]
    row_count: int
    sheets: list[str]
    source_file: str | None = None
