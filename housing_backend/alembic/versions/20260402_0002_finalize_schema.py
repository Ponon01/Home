"""finalize schema for business logic

Revision ID: 0002_finalize_schema
Revises: 0001_initial
Create Date: 2026-04-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_finalize_schema"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # rental_financials: remove duplicated resident name, add relation + validity window
    op.add_column("rental_financials", sa.Column("resident_id", sa.Integer(), nullable=True))
    op.add_column("rental_financials", sa.Column("effective_from", sa.Date(), nullable=True))
    op.add_column("rental_financials", sa.Column("effective_to", sa.Date(), nullable=True))
    op.add_column(
        "rental_financials",
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.create_index(op.f("ix_rental_financials_resident_id"), "rental_financials", ["resident_id"])
    op.create_index(op.f("ix_rental_financials_effective_from"), "rental_financials", ["effective_from"])
    op.create_index(op.f("ix_rental_financials_is_current"), "rental_financials", ["is_current"])
    op.create_foreign_key(
        "fk_rental_financials_resident_id",
        "rental_financials",
        "residents",
        ["resident_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_column("rental_financials", "resident_full_name")

    # purchase_financials: remove duplicated resident name, add relation + validity window
    op.add_column("purchase_financials", sa.Column("resident_id", sa.Integer(), nullable=True))
    op.add_column("purchase_financials", sa.Column("effective_from", sa.Date(), nullable=True))
    op.add_column("purchase_financials", sa.Column("effective_to", sa.Date(), nullable=True))
    op.add_column(
        "purchase_financials",
        sa.Column("is_current", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.create_index(op.f("ix_purchase_financials_resident_id"), "purchase_financials", ["resident_id"])
    op.create_index(op.f("ix_purchase_financials_effective_from"), "purchase_financials", ["effective_from"])
    op.create_index(op.f("ix_purchase_financials_is_current"), "purchase_financials", ["is_current"])
    op.create_foreign_key(
        "fk_purchase_financials_resident_id",
        "purchase_financials",
        "residents",
        ["resident_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_column("purchase_financials", "full_name")

    # purchase_payment_schedule: bind schedule rows to purchase financial records
    op.add_column("purchase_payment_schedule", sa.Column("purchase_financials_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_purchase_payment_schedule_purchase_financials_id"),
        "purchase_payment_schedule",
        ["purchase_financials_id"],
    )
    op.create_foreign_key(
        "fk_purchase_payment_schedule_purchase_financials_id",
        "purchase_payment_schedule",
        "purchase_financials",
        ["purchase_financials_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE purchase_payment_schedule pps
        SET purchase_financials_id = pf.id
        FROM purchase_financials pf
        WHERE pps.apartment_id = pf.apartment_id
          AND pps.purchase_financials_id IS NULL
        """
    )

    # documents: versioning + optional resident link
    op.add_column("documents", sa.Column("resident_id", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("document_group_key", sa.String(length=64), nullable=True))
    op.add_column("documents", sa.Column("version_no", sa.Integer(), server_default="1", nullable=False))
    op.add_column("documents", sa.Column("is_current", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("documents", sa.Column("previous_version_id", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("replaced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("documents", sa.Column("replace_reason", sa.String(length=512), nullable=True))
    op.add_column("documents", sa.Column("file_size_bytes", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("checksum_sha256", sa.String(length=64), nullable=True))
    op.add_column("documents", sa.Column("uploaded_by", sa.String(length=255), nullable=True))
    op.execute("UPDATE documents SET document_group_key = id::text WHERE document_group_key IS NULL")
    op.alter_column("documents", "document_group_key", nullable=False)
    op.create_index(op.f("ix_documents_resident_id"), "documents", ["resident_id"])
    op.create_index(op.f("ix_documents_document_group_key"), "documents", ["document_group_key"])
    op.create_index(op.f("ix_documents_is_current"), "documents", ["is_current"])
    op.create_foreign_key(
        "fk_documents_resident_id",
        "documents",
        "residents",
        ["resident_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_documents_previous_version_id",
        "documents",
        "documents",
        ["previous_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_documents_document_group_key_version_no",
        "documents",
        ["document_group_key", "version_no"],
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_documents_group_current
        ON documents (document_group_key)
        WHERE is_current = true
        """
    )

    # change_history: richer audit metadata
    op.add_column(
        "change_history",
        sa.Column("action", sa.String(length=64), server_default="update", nullable=False),
    )
    op.add_column("change_history", sa.Column("changed_by", sa.String(length=255), nullable=True))
    op.add_column("change_history", sa.Column("reason", sa.Text(), nullable=True))
    op.add_column("change_history", sa.Column("meta_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("change_history", "meta_json")
    op.drop_column("change_history", "reason")
    op.drop_column("change_history", "changed_by")
    op.drop_column("change_history", "action")

    op.execute("DROP INDEX IF EXISTS uq_documents_group_current")
    op.drop_constraint("uq_documents_document_group_key_version_no", "documents", type_="unique")
    op.drop_constraint("fk_documents_previous_version_id", "documents", type_="foreignkey")
    op.drop_constraint("fk_documents_resident_id", "documents", type_="foreignkey")
    op.drop_index(op.f("ix_documents_is_current"), table_name="documents")
    op.drop_index(op.f("ix_documents_document_group_key"), table_name="documents")
    op.drop_index(op.f("ix_documents_resident_id"), table_name="documents")
    op.drop_column("documents", "uploaded_by")
    op.drop_column("documents", "checksum_sha256")
    op.drop_column("documents", "file_size_bytes")
    op.drop_column("documents", "replace_reason")
    op.drop_column("documents", "replaced_at")
    op.drop_column("documents", "previous_version_id")
    op.drop_column("documents", "is_current")
    op.drop_column("documents", "version_no")
    op.drop_column("documents", "document_group_key")
    op.drop_column("documents", "resident_id")

    op.drop_constraint(
        "fk_purchase_payment_schedule_purchase_financials_id",
        "purchase_payment_schedule",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_purchase_payment_schedule_purchase_financials_id"), table_name="purchase_payment_schedule")
    op.drop_column("purchase_payment_schedule", "purchase_financials_id")

    op.add_column("purchase_financials", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.drop_constraint("fk_purchase_financials_resident_id", "purchase_financials", type_="foreignkey")
    op.drop_index(op.f("ix_purchase_financials_is_current"), table_name="purchase_financials")
    op.drop_index(op.f("ix_purchase_financials_effective_from"), table_name="purchase_financials")
    op.drop_index(op.f("ix_purchase_financials_resident_id"), table_name="purchase_financials")
    op.drop_column("purchase_financials", "is_current")
    op.drop_column("purchase_financials", "effective_to")
    op.drop_column("purchase_financials", "effective_from")
    op.drop_column("purchase_financials", "resident_id")

    op.add_column("rental_financials", sa.Column("resident_full_name", sa.String(length=255), nullable=True))
    op.drop_constraint("fk_rental_financials_resident_id", "rental_financials", type_="foreignkey")
    op.drop_index(op.f("ix_rental_financials_is_current"), table_name="rental_financials")
    op.drop_index(op.f("ix_rental_financials_effective_from"), table_name="rental_financials")
    op.drop_index(op.f("ix_rental_financials_resident_id"), table_name="rental_financials")
    op.drop_column("rental_financials", "is_current")
    op.drop_column("rental_financials", "effective_to")
    op.drop_column("rental_financials", "effective_from")
    op.drop_column("rental_financials", "resident_id")
