"""add contract fields to residents

Revision ID: 20260812_0014
Revises: 20260812_0013
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260812_0014"
down_revision: Union[str, None] = "20260812_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("residents")}

    if "contract_start_date" not in columns:
        op.add_column("residents", sa.Column("contract_start_date", sa.Date(), nullable=True))
    if "contract_end_date" not in columns:
        op.add_column("residents", sa.Column("contract_end_date", sa.Date(), nullable=True))
    if "contract_file_path" not in columns:
        op.add_column("residents", sa.Column("contract_file_path", sa.Text(), nullable=True))
    if "contract_file_name" not in columns:
        op.add_column("residents", sa.Column("contract_file_name", sa.String(length=512), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("residents")}
    for col in ("contract_start_date", "contract_end_date", "contract_file_path", "contract_file_name"):
        if col in columns:
            op.drop_column("residents", col)
