import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.dashboard_manual_summary import ManualDashboardSummaryListResponse
from app.services.manual_dashboard_service import list_manual_summaries
from scripts.ensure_housing_complexes import ensure_housing_complexes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/public/dashboard", tags=["public-dashboard"])


@router.get("/manual-summary", response_model=ManualDashboardSummaryListResponse)
async def public_manual_dashboard_summary(
    db: AsyncSession = Depends(get_db),
) -> ManualDashboardSummaryListResponse:
    try:
        ensure_housing_complexes()
        rows = await list_manual_summaries(db)
    except Exception as exc:
        logger.exception("Public manual dashboard summary unavailable")
        rows = []
    return ManualDashboardSummaryListResponse(rows=rows)

