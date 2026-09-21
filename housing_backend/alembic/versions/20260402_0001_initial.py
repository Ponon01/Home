"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE housing_type AS ENUM ('rent', 'purchase')")
    op.execute(
        "CREATE TYPE apartment_subtype AS ENUM ('rent', 'guest', 'guest_gph', 'full_sold', 'installment')"
    )
    op.execute(
        "CREATE TYPE document_type AS ENUM ("
        "'rental_contract', 'protocol', 'purchase_contract', 'act', 'payment_schedule', 'other')"
    )

    housing_type = postgresql.ENUM("rent", "purchase", name="housing_type", create_type=False)
    apartment_subtype = postgresql.ENUM(
        "rent",
        "guest",
        "guest_gph",
        "full_sold",
        "installment",
        name="apartment_subtype",
        create_type=False,
    )
    document_type = postgresql.ENUM(
        "rental_contract",
        "protocol",
        "purchase_contract",
        "act",
        "payment_schedule",
        "other",
        name="document_type",
        create_type=False,
    )

    op.create_table(
        "apartments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("residential_complex_name", sa.String(length=255), nullable=False),
        sa.Column("district", sa.String(length=255), nullable=True),
        sa.Column("street", sa.String(length=255), nullable=True),
        sa.Column("house_number", sa.String(length=64), nullable=True),
        sa.Column("apartment_number", sa.String(length=64), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("housing_type", housing_type, nullable=False),
        sa.Column("apartment_subtype", apartment_subtype, nullable=False),
        sa.Column("room_count", sa.Integer(), nullable=True),
        sa.Column("total_area", sa.Numeric(12, 2), nullable=True),
        sa.Column("living_area", sa.Numeric(12, 2), nullable=True),
        sa.Column("build_year", sa.Integer(), nullable=True),
        sa.Column("personal_account", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_apartments_residential_complex_name"), "apartments", ["residential_complex_name"])

    op.create_table(
        "change_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("entity_type", sa.String(length=128), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_change_history_entity_id"), "change_history", ["entity_id"])
    op.create_index(op.f("ix_change_history_entity_type"), "change_history", ["entity_type"])

    op.create_table(
        "residents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("family_composition", sa.Text(), nullable=True),
        sa.Column("position", sa.String(length=255), nullable=True),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("move_in_date", sa.Date(), nullable=True),
        sa.Column("move_out_date", sa.Date(), nullable=True),
        sa.Column("occupancy_basis", sa.Text(), nullable=True),
        sa.Column("cohabitation", sa.String(length=255), nullable=True),
        sa.Column("cohabitant_count", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_residents_apartment_id"), "residents", ["apartment_id"])

    op.create_table(
        "rental_financials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("valuation_object", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("market_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("proportional_market_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_2025", sa.Numeric(18, 2), nullable=True),
        sa.Column("proportional_balance_value_2025", sa.Numeric(18, 2), nullable=True),
        sa.Column("occupied_area_sp", sa.Numeric(18, 4), nullable=True),
        sa.Column("shared_area_sp_total", sa.Numeric(18, 4), nullable=True),
        sa.Column("shared_area_per_person", sa.Numeric(18, 4), nullable=True),
        sa.Column("calculation_area_total", sa.Numeric(18, 4), nullable=True),
        sa.Column("resident_full_name", sa.String(length=255), nullable=True),
        sa.Column("cohabitation", sa.String(length=255), nullable=True),
        sa.Column("cohabitant_count", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("land_tax_zone_adjustment", sa.Numeric(18, 4), nullable=True),
        sa.Column("astana_land_tax_base_rate", sa.Numeric(18, 4), nullable=True),
        sa.Column("land_tax_adjustment_for_calc", sa.Numeric(18, 4), nullable=True),
        sa.Column("correction_coefficient", sa.Numeric(18, 6), nullable=True),
        sa.Column("land_tax_rate", sa.Numeric(18, 4), nullable=True),
        sa.Column("land_tax_yearly", sa.Numeric(18, 2), nullable=True),
        sa.Column("amortization_monthly", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_1_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_2_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_3_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_4_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_5_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_6_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_7_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_8_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_9_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_10_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_11_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_12_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("balance_value_month_13", sa.Numeric(18, 2), nullable=True),
        sa.Column("property_tax_year_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("total_land_and_property_tax_2026", sa.Numeric(18, 2), nullable=True),
        sa.Column("material_benefit", sa.Numeric(18, 2), nullable=True),
        sa.Column("reimbursement_cost_monthly", sa.Numeric(18, 2), nullable=True),
        sa.Column("taxable_base", sa.Numeric(18, 2), nullable=True),
        sa.Column("contract_status", sa.String(length=128), nullable=True),
        sa.Column("rental_contract_number", sa.String(length=128), nullable=True),
        sa.Column("rental_contract_date", sa.Date(), nullable=True),
        sa.Column("attachment_note", sa.Text(), nullable=True),
        sa.Column("changes_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rental_financials_apartment_id"), "rental_financials", ["apartment_id"])

    op.create_table(
        "purchase_financials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("purchase_contract", sa.String(length=255), nullable=True),
        sa.Column("initial_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("initial_cost_year", sa.Integer(), nullable=True),
        sa.Column("realization_period", sa.String(length=255), nullable=True),
        sa.Column("balance_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("valuation_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("initial_payment", sa.Numeric(18, 2), nullable=True),
        sa.Column("repaid_amount_october", sa.Numeric(18, 2), nullable=True),
        sa.Column("remaining_debt", sa.Numeric(18, 2), nullable=True),
        sa.Column("monthly_payment", sa.Numeric(18, 2), nullable=True),
        sa.Column("last_payment_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_purchase_financials_apartment_id"), "purchase_financials", ["apartment_id"])

    op.create_table(
        "purchase_payment_schedule",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("amount_due", sa.Numeric(18, 2), nullable=True),
        sa.Column("amount_paid", sa.Numeric(18, 2), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_purchase_payment_schedule_apartment_id"),
        "purchase_payment_schedule",
        ["apartment_id"],
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("document_type", document_type, nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["apartment_id"], ["apartments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_apartment_id"), "documents", ["apartment_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_apartment_id"), table_name="documents")
    op.drop_table("documents")
    op.drop_index(op.f("ix_purchase_payment_schedule_apartment_id"), table_name="purchase_payment_schedule")
    op.drop_table("purchase_payment_schedule")
    op.drop_index(op.f("ix_purchase_financials_apartment_id"), table_name="purchase_financials")
    op.drop_table("purchase_financials")
    op.drop_index(op.f("ix_rental_financials_apartment_id"), table_name="rental_financials")
    op.drop_table("rental_financials")
    op.drop_index(op.f("ix_residents_apartment_id"), table_name="residents")
    op.drop_table("residents")
    op.drop_index(op.f("ix_change_history_entity_type"), table_name="change_history")
    op.drop_index(op.f("ix_change_history_entity_id"), table_name="change_history")
    op.drop_table("change_history")
    op.drop_index(op.f("ix_apartments_residential_complex_name"), table_name="apartments")
    op.drop_table("apartments")
    op.execute("DROP TYPE document_type")
    op.execute("DROP TYPE apartment_subtype")
    op.execute("DROP TYPE housing_type")
