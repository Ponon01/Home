"""Import purchase/installment workbook into purchase tables."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models import PurchaseFinancials, PurchasePaymentSchedule
from scripts.import_utils import (
    EXCEL_DIR,
    ImportStats,
    get_or_create_apartment,
    get_or_create_resident,
    normalize_text,
    parse_date,
    parse_decimal,
    parse_int,
    pick_column,
)


def _month_from_column(col: str) -> tuple[int, int] | None:
    low = col.lower()
    year_match = re.search(r"(20\d{2})", low)
    year = int(year_match.group(1)) if year_match else None
    month_map = {
        "янв": 1,
        "фев": 2,
        "мар": 3,
        "апр": 4,
        "май": 5,
        "июн": 6,
        "июл": 7,
        "авг": 8,
        "сен": 9,
        "окт": 10,
        "ноя": 11,
        "дек": 12,
    }
    month = next((v for k, v in month_map.items() if k in low), None)
    if month and year:
        return year, month
    return None


def main() -> None:
    stats = ImportStats()
    workbook = EXCEL_DIR / "рассрочка и выкупленные общее поступление.xlsx"
    if not workbook.exists():
        raise FileNotFoundError(workbook)

    df = pd.read_excel(workbook, sheet_name="Лист1", header=3, engine="openpyxl")
    df.columns = [normalize_text(c) for c in df.columns]

    session = SyncSessionLocal()
    try:
        c_address = pick_column(df.columns, "адрес")
        c_name = pick_column(df.columns, "фио")
        c_contract = pick_column(df.columns, "договор купли")
        c_initial_cost = pick_column(df.columns, "первоначальная")
        c_initial_year = pick_column(df.columns, "год")
        c_period = pick_column(df.columns, "период реализации")
        c_balance = pick_column(df.columns, "балансовая")
        c_valuation = pick_column(df.columns, "согласно отчету")
        c_initial_payment = pick_column(df.columns, "первоначального взноса")
        c_repaid_oct = pick_column(df.columns, "погашенная сумма на октябрь")
        c_remaining = pick_column(df.columns, "остаток")
        c_monthly = pick_column(df.columns, "ежемесяч")
        c_last_payment = pick_column(df.columns, "дата последнего")

        month_columns = [c for c in df.columns if _month_from_column(c) is not None]

        for i, row in df.iterrows():
            excel_row = int(i) + 5
            try:
                address = normalize_text(row.get(c_address)) if c_address else ""
                if not address:
                    stats.skipped += 1
                    stats.log(f"{workbook.name}: skip row {excel_row}, column='{c_address}' (empty address)")
                    continue

                apartment, _ = get_or_create_apartment(
                    session,
                    address=address,
                    residential_complex_name="UNKNOWN",
                    defaults={},
                )
                resident = None
                if c_name and normalize_text(row.get(c_name)):
                    resident, _ = get_or_create_resident(
                        session,
                        apartment_id=apartment.id,
                        full_name=normalize_text(row.get(c_name)),
                        defaults={},
                    )

                pf = session.scalars(
                    select(PurchaseFinancials).where(
                        PurchaseFinancials.apartment_id == apartment.id,
                        PurchaseFinancials.is_current.is_(True),
                    )
                ).first()
                if pf is None:
                    pf = PurchaseFinancials(apartment_id=apartment.id, is_current=True)
                    session.add(pf)
                    stats.inserted += 1
                else:
                    stats.updated += 1

                pf.resident_id = resident.id if resident else pf.resident_id
                pf.purchase_contract = normalize_text(row.get(c_contract)) if c_contract else pf.purchase_contract
                pf.initial_cost = parse_decimal(row.get(c_initial_cost)) if c_initial_cost else pf.initial_cost
                pf.initial_cost_year = parse_int(row.get(c_initial_year)) if c_initial_year else pf.initial_cost_year
                pf.realization_period = normalize_text(row.get(c_period)) if c_period else pf.realization_period
                pf.balance_cost = parse_decimal(row.get(c_balance)) if c_balance else pf.balance_cost
                pf.valuation_cost = parse_decimal(row.get(c_valuation)) if c_valuation else pf.valuation_cost
                pf.initial_payment = parse_decimal(row.get(c_initial_payment)) if c_initial_payment else pf.initial_payment
                pf.repaid_amount_october = parse_decimal(row.get(c_repaid_oct)) if c_repaid_oct else pf.repaid_amount_october
                pf.remaining_debt = parse_decimal(row.get(c_remaining)) if c_remaining else pf.remaining_debt
                pf.monthly_payment = parse_decimal(row.get(c_monthly)) if c_monthly else pf.monthly_payment
                pf.last_payment_date = parse_date(row.get(c_last_payment)) if c_last_payment else pf.last_payment_date
                session.flush()

                for mcol in month_columns:
                    ym = _month_from_column(mcol)
                    amount_due = parse_decimal(row.get(mcol))
                    if ym is None or amount_due is None:
                        continue
                    year, month = ym
                    sched = session.scalars(
                        select(PurchasePaymentSchedule).where(
                            PurchasePaymentSchedule.purchase_financials_id == pf.id,
                            PurchasePaymentSchedule.year == year,
                            PurchasePaymentSchedule.month == month,
                        )
                    ).first()
                    if sched is None:
                        sched = PurchasePaymentSchedule(
                            apartment_id=apartment.id,
                            purchase_financials_id=pf.id,
                            year=year,
                            month=month,
                        )
                        session.add(sched)
                    sched.amount_due = amount_due
            except Exception as row_exc:
                session.rollback()
                stats.errors += 1
                stats.log(f"{workbook.name}: error row {excel_row} - {row_exc}")
                continue
            session.commit()
        stats.log(
            f"done: inserted={stats.inserted}, updated={stats.updated}, skipped={stats.skipped}, errors={stats.errors}"
        )
    except Exception as exc:
        session.rollback()
        stats.log(f"error: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
