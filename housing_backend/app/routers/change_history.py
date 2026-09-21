from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.change_history import ChangeHistory
from app.models.user import User
from app.schemas.change_history import ChangeHistoryRead

router = APIRouter(prefix="/change-history", tags=["change-history"])


@router.get("", response_model=list[ChangeHistoryRead])
async def list_change_history(
    entity_type: str | None = None,
    entity_id: int | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[ChangeHistoryRead]:
    stmt = select(ChangeHistory).order_by(desc(ChangeHistory.changed_at)).limit(min(limit, 500))
    if entity_type:
        stmt = stmt.where(ChangeHistory.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(ChangeHistory.entity_id == entity_id)
    rows = (await db.execute(stmt)).scalars().all()

    out: list[ChangeHistoryRead] = []
    for row in rows:
        username = None
        if row.changed_by_user_id:
            user = await db.get(User, row.changed_by_user_id)
            username = user.username if user else None
        out.append(
            ChangeHistoryRead(
                id=row.id,
                changed_by_user_id=row.changed_by_user_id,
                changed_by_username=username,
                action=row.action,
                entity_type=row.entity_type,
                entity_id=row.entity_id,
                old_value=row.old_value,
                new_value=row.new_value,
                changed_at=row.changed_at,
            )
        )
    return out
