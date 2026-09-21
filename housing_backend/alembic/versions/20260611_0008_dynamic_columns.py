"""dynamic columns for housing and budget excel

Revision ID: 20260611_0008
Revises: 0007_budget_excel_rows
Create Date: 2026-06-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260611_0008"
down_revision: Union[str, None] = "0007_budget_excel_rows"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "housing_department_records",
        sa.Column("extra_fields", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.create_table(
        "budget_excel_source_meta",
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("custom_headers", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("source"),
    )
    op.create_table(
        "housing_department_meta",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("custom_headers", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO housing_department_meta (custom_headers) VALUES ('[]')"
    )


def downgrade() -> None:
    op.drop_table("housing_department_meta")
    op.drop_table("budget_excel_source_meta")
    op.drop_column("housing_department_records", "extra_fields")
