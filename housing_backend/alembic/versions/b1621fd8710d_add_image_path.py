"""add_image_path

Revision ID: b1621fd8710d
Revises: 20260611_0008
Create Date: 2026-06-17 05:18:58.302785
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1621fd8710d"
down_revision: Union[str, None] = "20260611_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("dashboard_manual_summary")}
    if "image_path" not in columns:
        op.add_column(
            "dashboard_manual_summary",
            sa.Column("image_path", sa.String(length=512), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("dashboard_manual_summary")}
    if "image_path" in columns:
        op.drop_column("dashboard_manual_summary", "image_path")
