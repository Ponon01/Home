"""add last_paid_month to residents

Revision ID: 20260812_0015
Revises: 20260812_0014
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260812_0015"
down_revision: Union[str, None] = "20260812_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("residents")}
    if "last_paid_month" not in columns:
        op.add_column("residents", sa.Column("last_paid_month", sa.String(length=7), nullable=True, index=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("residents")}
    if "last_paid_month" in columns:
        op.drop_column("residents", "last_paid_month")

