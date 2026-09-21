"""add auth models and audit user link

Revision ID: 0003_auth_and_audit
Revises: 0002_finalize_schema
Create Date: 2026-04-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_auth_and_audit"
down_revision: Union[str, None] = "0002_finalize_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=128), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=False)
    op.create_index(op.f("ix_users_role_id"), "users", ["role_id"], unique=False)

    op.add_column("change_history", sa.Column("changed_by_user_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_change_history_changed_by_user_id"), "change_history", ["changed_by_user_id"], unique=False)
    op.create_foreign_key(
        "fk_change_history_changed_by_user_id",
        "change_history",
        "users",
        ["changed_by_user_id"],
        ["id"],
    )

    op.execute(
        """
        INSERT INTO roles (name, description) VALUES
        ('admin', 'Full access'),
        ('housing_department', 'Housing department'),
        ('budget_department', 'Budget department'),
        ('viewer', 'Read-only access')
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_change_history_changed_by_user_id", "change_history", type_="foreignkey")
    op.drop_index(op.f("ix_change_history_changed_by_user_id"), table_name="change_history")
    op.drop_column("change_history", "changed_by_user_id")

    op.drop_index(op.f("ix_users_role_id"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")

    op.drop_index(op.f("ix_roles_name"), table_name="roles")
    op.drop_table("roles")
