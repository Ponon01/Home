from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.budget_rent_record import BudgetRentRecord
from app.schemas.budget_rent_record import BudgetRentRecordRead

router = APIRouter(prefix="/budget-rent", tags=["budget-rent"])

@router.get("", response_model=list[BudgetRentRecordRead])
async def list_budget_rent_records(
    db: AsyncSession = Depends(get_db),
) -> list[BudgetRentRecordRead]:
    stmt = select(BudgetRentRecord).order_by(BudgetRentRecord.id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [BudgetRentRecordRead.model_validate(x) for x in items]
