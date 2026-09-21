"""add housing_sales_receipts for Excel sales totals reconciliation

Revision ID: 20260921_0016
Revises: 20260812_0015
Create Date: 2026-09-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0016"
down_revision: Union[str, None] = "20260812_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "housing_sales_receipts" not in inspector.get_table_names():
        op.create_table(
            "housing_sales_receipts",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("amount", sa.Numeric(18, 2), nullable=False),
            sa.Column("source_label", sa.String(length=255), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("year", "source_label", name="uq_sales_receipt_year_label"),
        )
        op.create_index("ix_housing_sales_receipts_year", "housing_sales_receipts", ["year"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "housing_sales_receipts" in inspector.get_table_names():
        op.drop_index("ix_housing_sales_receipts_year", table_name="housing_sales_receipts")
        op.drop_table("housing_sales_receipts")
