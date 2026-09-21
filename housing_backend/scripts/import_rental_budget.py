"""Import rental budget monthly/detail sheets into versioned rental_financials."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models import RentalFinancials
from scripts.import_utils import (
    EXCEL_DIR,
    ImportStats,
    get_or_create_apartment,
    get_or_create_resident,
    normalize_text,
    parse_decimal,
    parse_int,
    pick_column,
)

IMPORTABLE_SHEETS = [
    "2025 ОСНОВА",
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "2026 январь",
    "2026 новые январь",
    "2026 февраль",
    "2026 новые февраль",
    "2026 Март",
    "2026 новые март",
]


def _sheet_effective_from(sheet_name: str) -> date:
    month_map = {
        "январь": 1,
        "февраль": 2,
        "март": 3,
        "апрель": 4,
        "май": 5,
        "июнь": 6,
        "июль": 7,
    }
    lower = sheet_name.lower()
    year = 2026 if "2026" in lower else 2025
    month = 1
    for m_name, m_num in month_map.items():
        if m_name in lower:
            month = m_num
            break
    return date(year, month, 1)


def main() -> None:
    stats = ImportStats()
    workbook = EXCEL_DIR / "1Расчет по квартирам 2026.xlsx"
    if not workbook.exists():
        raise FileNotFoundError(workbook)

    session = SyncSessionLocal()
    try:
        for sheet in IMPORTABLE_SHEETS:
            df = pd.read_excel(workbook, sheet_name=sheet, header=0, engine="openpyxl")
            df.columns = [normalize_text(c) for c in df.columns]

            c_complex = pick_column(df.columns, "наименование жк")
            c_address = pick_column(df.columns, "адрес")
            c_name = pick_column(df.columns, "фио")
            c_rooms = pick_column(df.columns, "количество комнат")
            c_total_area = pick_column(df.columns, "общая площадь")
            c_living = pick_column(df.columns, "жилая площадь")
            c_market = pick_column(df.columns, "рыночная цена")
            c_market_prop = pick_column(df.columns, "рыночная цена деленая")
            c_balance = pick_column(df.columns, "балансовая стоимость на 31 декабря")
            c_withheld = pick_column(df.columns, "удержание из зп")
            c_taxable = pick_column(df.columns, "налогооблагаемая")
            c_benefit = pick_column(df.columns, "материальная выгода")
            c_amort = pick_column(df.columns, "амортизация")

            effective_from = _sheet_effective_from(sheet)

            for i, row in df.iterrows():
                excel_row = int(i) + 2
                try:
                    address = normalize_text(row.get(c_address)) if c_address else ""
                    complex_name = normalize_text(row.get(c_complex)) if c_complex else ""
                    full_name = normalize_text(row.get(c_name)) if c_name else ""
                    if not address:
                        stats.skipped += 1
                        stats.log(f"{workbook.name}/{sheet}: skip row {excel_row}, column='{c_address}' (empty address)")
                        continue
                    if not complex_name:
                        complex_name = "UNKNOWN"

                    apartment, _ = get_or_create_apartment(
                        session,
                        address=address,
                        residential_complex_name=complex_name,
                        defaults={
                            "room_count": parse_int(row.get(c_rooms)) if c_rooms else None,
                            "total_area": parse_decimal(row.get(c_total_area)) if c_total_area else None,
                            "living_area": parse_decimal(row.get(c_living)) if c_living else None,
                        },
                    )
                    resident = None
                    if full_name and "пустая" not in full_name.lower() and "гостевая" not in full_name.lower():
                        resident, _ = get_or_create_resident(
                            session,
                            apartment_id=apartment.id,
                            full_name=full_name,
                            defaults={},
                        )

                    prev_current = session.scalars(
                        select(RentalFinancials).where(
                            RentalFinancials.apartment_id == apartment.id,
                            RentalFinancials.is_current.is_(True),
                        )
                    ).first()
                    if prev_current and prev_current.effective_from and prev_current.effective_from < effective_from:
                        prev_current.is_current = False
                        prev_current.effective_to = effective_from

                    same_version = session.scalars(
                        select(RentalFinancials).where(
                            RentalFinancials.apartment_id == apartment.id,
                            RentalFinancials.effective_from == effective_from,
                        )
                    ).first()
                    if same_version:
                        rf = same_version
                        stats.updated += 1
                    else:
                        rf = RentalFinancials(
                            apartment_id=apartment.id,
                            effective_from=effective_from,
                            is_current=True,
                        )
                        session.add(rf)
                        stats.inserted += 1

                    rf.resident_id = resident.id if resident else rf.resident_id
                    rf.market_price = parse_decimal(row.get(c_market)) if c_market else rf.market_price
                    rf.proportional_market_price = parse_decimal(row.get(c_market_prop)) if c_market_prop else rf.proportional_market_price
                    rf.balance_value_2025 = parse_decimal(row.get(c_balance)) if c_balance else rf.balance_value_2025
                    rf.reimbursement_cost_monthly = parse_decimal(row.get(c_withheld)) if c_withheld else rf.reimbursement_cost_monthly
                    rf.taxable_base = parse_decimal(row.get(c_taxable)) if c_taxable else rf.taxable_base
                    rf.material_benefit = parse_decimal(row.get(c_benefit)) if c_benefit else rf.material_benefit
                    rf.amortization_monthly = parse_decimal(row.get(c_amort)) if c_amort else rf.amortization_monthly
                except Exception as row_exc:
                    session.rollback()
                    stats.errors += 1
                    stats.log(f"{workbook.name}/{sheet}: error row {excel_row} - {row_exc}")
                    continue
                session.commit()

            stats.log(f"{sheet}: imported")

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
