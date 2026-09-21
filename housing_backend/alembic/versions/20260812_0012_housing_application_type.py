"""add application_type to housing_applications

Revision ID: 20260812_0012
Revises: 20260803_0011
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260812_0012"
down_revision: Union[str, None] = "20260803_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("housing_applications")}
    if "application_type" not in columns:
        op.add_column("housing_applications", sa.Column("application_type", sa.String(length=255), nullable=True))
        op.create_index(
            "ix_housing_applications_application_type",
            "housing_applications",
            ["application_type"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("housing_applications")}
    if "application_type" in columns:
        op.drop_index("ix_housing_applications_application_type", table_name="housing_applications")
        op.drop_column("housing_applications", "application_type")
