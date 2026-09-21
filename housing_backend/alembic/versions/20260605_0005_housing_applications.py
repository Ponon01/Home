"""housing_applications table

Revision ID: 0005_housing_applications
Revises: eb2742421bfb
Create Date: 2026-06-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_housing_applications"
down_revision: Union[str, None] = "eb2742421bfb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "housing_applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fio", sa.String(length=255), nullable=False),
        sa.Column("position", sa.String(length=255), nullable=True),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="pending"),
        sa.Column("signed_application_path", sa.Text(), nullable=True),
        sa.Column("signed_application_name", sa.String(length=512), nullable=True),
        sa.Column("housing_certificate_path", sa.Text(), nullable=True),
        sa.Column("housing_certificate_name", sa.String(length=512), nullable=True),
        sa.Column("id_document_path", sa.Text(), nullable=True),
        sa.Column("id_document_name", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_housing_applications_fio", "housing_applications", ["fio"])
    op.create_index("ix_housing_applications_status", "housing_applications", ["status"])


def downgrade() -> None:
    op.drop_index("ix_housing_applications_status", table_name="housing_applications")
    op.drop_index("ix_housing_applications_fio", table_name="housing_applications")
    op.drop_table("housing_applications")
