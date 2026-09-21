from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ERCInvoiceListItem(BaseModel):
    id: int
    period: str
    apartment_number: str | None
    house_number: str | None
    personal_account: str | None
    employee: str | None
    department: str | None
    housing_type: str | None

    due_day: int | None
    monthly_payment: float | None
    penalty_amount: float | None
    total_due: float | None
    days_overdue: int

    status: str
    uploaded_file_name: str | None
    uploaded_file_path: str | None
    uploaded_at: datetime | None
    paid_at: datetime | None


class ERCInvoiceOverdueItem(BaseModel):
    id: int
    period: str
    apartment_number: str | None
    house_number: str | None
    personal_account: str | None
    employee: str | None
    department: str | None
    due_day: int | None

    monthly_payment: float | None
    main_debt: float | None
    days_overdue: int
    penalty_amount: float | None
    total_due: float | None

    debt_period_label: str | None

    uploaded_file_name: str | None
    uploaded_file_path: str | None
    status: str


class ERCInvoiceUploadResponse(BaseModel):
    ok: bool = True
    invoice_id: int

