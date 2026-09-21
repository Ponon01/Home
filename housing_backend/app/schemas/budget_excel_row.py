from typing import Any

from pydantic import BaseModel, Field


class BudgetExcelRowUpdate(BaseModel):
    data: dict[str, Any] = Field(..., description="Column key-value pairs")


class BudgetExcelRowRead(BaseModel):
    id: int
    data: dict[str, Any]


class AddBudgetColumnRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
