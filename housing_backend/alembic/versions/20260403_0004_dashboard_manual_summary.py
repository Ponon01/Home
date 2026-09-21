"""dashboard_manual_summary table

Revision ID: 0004_dashboard_manual_summary
Revises: 0003_auth_and_audit
Create Date: 2026-04-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_dashboard_manual_summary"
down_revision: Union[str, None] = "0003_auth_and_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboard_manual_summary",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("residential_complex_name", sa.String(length=255), nullable=False),
        sa.Column("total_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("not_for_sale_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("for_sale_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("transfer_year", sa.Integer(), nullable=True),
        sa.Column("sold_2019", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2020", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2021", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2022", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2023", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2024", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2025", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_2026", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sold_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("remaining_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rent_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("guest_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("guest_gph_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("residential_complex_name"),
    )
    op.create_index(
        op.f("ix_dashboard_manual_summary_updated_by_user_id"),
        "dashboard_manual_summary",
        ["updated_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_dashboard_manual_summary_updated_by_user_id"), table_name="dashboard_manual_summary")
    op.drop_table("dashboard_manual_summary")
