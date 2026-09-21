"""budget_excel_rows table

Revision ID: 0007_budget_excel_rows
Revises: 0006_housing_family_members
Create Date: 2026-06-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_budget_excel_rows"
down_revision: Union[str, None] = "0006_housing_family_members"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "budget_excel_rows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("row_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "row_index", name="uq_budget_excel_source_row_index"),
    )
    op.create_index("ix_budget_excel_rows_source", "budget_excel_rows", ["source"])


def downgrade() -> None:
    op.drop_index("ix_budget_excel_rows_source", table_name="budget_excel_rows")
    op.drop_table("budget_excel_rows")
