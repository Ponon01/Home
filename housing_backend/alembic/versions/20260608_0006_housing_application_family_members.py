"""housing_application_family_members table

Revision ID: 0006_housing_family_members
Revises: 0005_housing_applications
Create Date: 2026-06-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_housing_family_members"
down_revision: Union[str, None] = "0005_housing_applications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "housing_application_family_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("fio", sa.String(length=255), nullable=False),
        sa.Column("relationship_degree", sa.String(length=128), nullable=True),
        sa.Column("id_document_path", sa.Text(), nullable=True),
        sa.Column("id_document_name", sa.String(length=512), nullable=True),
        sa.Column("housing_certificate_path", sa.Text(), nullable=True),
        sa.Column("housing_certificate_name", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["housing_applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_housing_application_family_members_application_id",
        "housing_application_family_members",
        ["application_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_housing_application_family_members_application_id",
        table_name="housing_application_family_members",
    )
    op.drop_table("housing_application_family_members")
