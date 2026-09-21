import json
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.change_history import ChangeHistory
from app.models.user import User


def _json_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


async def write_audit_log(
    db: AsyncSession,
    *,
    user: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> None:
    row = ChangeHistory(
        changed_by_user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id or 0,
        field_name="_row",
        old_value=json.dumps(old_value, ensure_ascii=False, default=_json_default)
        if old_value is not None
        else None,
        new_value=json.dumps(new_value, ensure_ascii=False, default=_json_default)
        if new_value is not None
        else None,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(row)
