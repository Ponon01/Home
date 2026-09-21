"""add iin to residents for registry accounts

Revision ID: 20260727_0009
Revises: b1621fd8710d
Create Date: 2026-07-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_0009"
down_revision: Union[str, None] = "b1621fd8710d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("residents")}
    if "iin" not in columns:
        op.add_column("residents", sa.Column("iin", sa.String(length=12), nullable=True))
    indexes = {i["name"] for i in inspector.get_indexes("residents")}
    if "ix_residents_iin" not in indexes:
        op.create_index("ix_residents_iin", "residents", ["iin"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {i["name"] for i in inspector.get_indexes("residents")}
    if "ix_residents_iin" in indexes:
        op.drop_index("ix_residents_iin", table_name="residents")
    columns = {c["name"] for c in inspector.get_columns("residents")}
    if "iin" in columns:
        op.drop_column("residents", "iin")
