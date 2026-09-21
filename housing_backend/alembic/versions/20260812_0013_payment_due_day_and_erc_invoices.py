"""add payment_due_day and erc_invoices

Revision ID: 20260812_0013
Revises: 20260812_0012
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260812_0013"
down_revision: Union[str, None] = "20260812_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # apartments.payment_due_day
    columns = {col["name"] for col in inspector.get_columns("apartments")}
    if "payment_due_day" not in columns:
        op.add_column("apartments", sa.Column("payment_due_day", sa.Integer(), nullable=True))

    # erc_invoices table
    if "erc_invoices" not in inspector.get_table_names():
        op.create_table(
            "erc_invoices",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("apartment_id", sa.Integer(), sa.ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("resident_id", sa.Integer(), sa.ForeignKey("residents.id", ondelete="SET NULL"), nullable=True),
            sa.Column("period", sa.String(length=7), nullable=False),
            sa.Column("due_day", sa.Integer(), nullable=True),
            sa.Column("monthly_payment", sa.Numeric(12, 2), nullable=True),
            sa.Column("penalty_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("total_due", sa.Numeric(12, 2), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("uploaded_file_path", sa.Text(), nullable=True),
            sa.Column("uploaded_file_name", sa.String(length=512), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("ix_erc_invoices_period", "erc_invoices", ["period"], unique=False)
        op.create_index("ix_erc_invoices_apartment_id", "erc_invoices", ["apartment_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {col["name"] for col in inspector.get_columns("apartments")}
    if "payment_due_day" in columns:
        op.drop_column("apartments", "payment_due_day")

    if "erc_invoices" in inspector.get_table_names():
        op.drop_table("erc_invoices")

