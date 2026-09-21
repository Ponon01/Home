"""add floor and entrance to apartments

Revision ID: 20260803_0010
Revises: 20260727_0009
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260803_0010"
down_revision: Union[str, None] = "20260727_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("apartments")}
    if "floor" not in columns:
        op.add_column("apartments", sa.Column("floor", sa.Integer(), nullable=True))
    if "entrance" not in columns:
        op.add_column("apartments", sa.Column("entrance", sa.String(length=64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("apartments")}
    if "entrance" in columns:
        op.drop_column("apartments", "entrance")
    if "floor" in columns:
        op.drop_column("apartments", "floor")
