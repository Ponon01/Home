from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.user import User
from app.schemas.dashboard_manual_summary import ManualSummaryCreate, ManualSummaryRead, ManualSummaryUpdate
from app.utils.audit import write_audit_log

_AUDIT_KEYS = (
    "residential_complex_name",
    "total_count",
    "not_for_sale_count",
    "for_sale_count",
    "transfer_year",
    "sold_2019",
    "sold_2020",
    "sold_2021",
    "sold_2022",
    "sold_2023",
    "sold_2024",
    "sold_2025",
    "sold_2026",
    "sold_total",
    "remaining_total",
    "rent_count",
    "guest_count",
    "guest_gph_count",
    "notes",
)


def _audit_snapshot(row: DashboardManualSummary) -> dict:
    return {k: getattr(row, k) for k in _AUDIT_KEYS}


async def list_manual_summaries(db: AsyncSession) -> list[ManualSummaryRead]:
    stmt = select(DashboardManualSummary).order_by(DashboardManualSummary.residential_complex_name)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [ManualSummaryRead.model_validate(r) for r in rows]


async def create_manual_summary(
    db: AsyncSession, body: ManualSummaryCreate, user: User
) -> ManualSummaryRead:
    row = DashboardManualSummary(
        residential_complex_name=body.residential_complex_name.strip(),
        total_count=body.total_count,
        not_for_sale_count=body.not_for_sale_count,
        for_sale_count=body.for_sale_count,
        transfer_year=body.transfer_year,
        sold_2019=body.sold_2019,
        sold_2020=body.sold_2020,
        sold_2021=body.sold_2021,
        sold_2022=body.sold_2022,
        sold_2023=body.sold_2023,
        sold_2024=body.sold_2024,
        sold_2025=body.sold_2025,
        sold_2026=body.sold_2026,
        sold_total=body.sold_total,
        remaining_total=body.remaining_total,
        rent_count=body.rent_count,
        guest_count=body.guest_count,
        guest_gph_count=body.guest_gph_count,
        notes=body.notes,
        updated_by_user_id=user.id,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    await write_audit_log(
        db,
        user=user,
        action="create",
        entity_type="dashboard_manual_summary",
        entity_id=row.id,
        old_value=None,
        new_value=_audit_snapshot(row),
    )
    return ManualSummaryRead.model_validate(row)


async def update_manual_summary(
    db: AsyncSession, row_id: int, body: ManualSummaryUpdate, user: User
) -> ManualSummaryRead | None:
    row = await db.get(DashboardManualSummary, row_id)
    if row is None:
        return None
    old_snapshot = _audit_snapshot(row)
    data = body.model_dump(exclude_unset=True)
    if "residential_complex_name" in data and data["residential_complex_name"] is not None:
        data["residential_complex_name"] = data["residential_complex_name"].strip()
    for k, v in data.items():
        setattr(row, k, v)
    row.updated_by_user_id = user.id
    await db.flush()
    await db.refresh(row)
    await write_audit_log(
        db,
        user=user,
        action="update",
        entity_type="dashboard_manual_summary",
        entity_id=row.id,
        old_value=old_snapshot,
        new_value=_audit_snapshot(row),
    )
    return ManualSummaryRead.model_validate(row)


async def delete_manual_summary(db: AsyncSession, row_id: int) -> bool:
    row = await db.get(DashboardManualSummary, row_id)
    if row is None:
        return False
    await db.delete(row)
    return True
