from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChangeHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    changed_by_user_id: int | None = None
    changed_by_username: str | None = None
    action: str
    entity_type: str
    entity_id: int
    old_value: str | None = None
    new_value: str | None = None
    changed_at: datetime
