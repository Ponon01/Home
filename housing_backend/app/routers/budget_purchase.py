from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.budget_purchase_meta import BudgetPurchaseImportMeta
from app.models.budget_purchase_record import BudgetPurchaseRecord
from app.schemas.budget_purchase_record import (
    BudgetPurchaseColumnsResponse,
    BudgetPurchaseRecordRead,
)

router = APIRouter(prefix="/budget-purchase", tags=["budget-purchase"])


@router.get("/columns", response_model=BudgetPurchaseColumnsResponse)
async def get_budget_purchase_columns(
    db: AsyncSession = Depends(get_db),
) -> BudgetPurchaseColumnsResponse:
    meta = await db.get(BudgetPurchaseImportMeta, 1)
    total = await db.scalar(select(func.count()).select_from(BudgetPurchaseRecord)) or 0
    if meta and meta.column_order:
        return BudgetPurchaseColumnsResponse(
            columns=meta.column_order,
            row_count=meta.row_count or total,
            sheets=meta.sheets or [],
            source_file=meta.source_file,
        )
    rows = (await db.execute(select(BudgetPurchaseRecord))).scalars().all()
    order: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.excel_columns or {}:
            if key not in seen:
                seen.add(key)
                order.append(key)
    return BudgetPurchaseColumnsResponse(
        columns=order,
        row_count=len(rows),
        sheets=sorted({r.source_sheet for r in rows if r.source_sheet}),
        source_file=None,
    )


@router.get("", response_model=list[BudgetPurchaseRecordRead])
async def list_budget_purchase_records(
    db: AsyncSession = Depends(get_db),
) -> list[BudgetPurchaseRecordRead]:
    stmt = select(BudgetPurchaseRecord).order_by(BudgetPurchaseRecord.id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [BudgetPurchaseRecordRead.model_validate(x) for x in items]
