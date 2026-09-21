"""Import ALL Excel columns into budget_purchase_records (exact header labels).

Usage:
  python -m scripts.import_budget_purchase
  python -m scripts.import_budget_purchase path/to/file.xlsx
"""

from __future__ import annotations

import sys
from pathlib import Path

import openpyxl
from sqlalchemy import delete, inspect, text

sys.path.append(str(Path(__file__).parent.parent))

from app.db.session import SyncSessionLocal, sync_engine
from app.db.base import Base
from app.models.budget_purchase_meta import BudgetPurchaseImportMeta
from app.models.budget_purchase_record import BudgetPurchaseRecord
from scripts.budget_purchase_excel import (
    build_merged_lookup,
    build_sheet_header_columns,
    coerce_cell_value,
    dedup_key,
    detect_header_row,
    extract_search_fields,
    get_cell_value,
    merge_column_order,
    normalize_header,
    row_is_empty,
    sheet_used_bounds,
)


def resolve_purchase_excel(cli_path: str | None = None) -> Path:
    if cli_path:
        p = Path(cli_path)
        if not p.exists():
            print(f"Error: file not found: {p.resolve()}")
            sys.exit(1)
        return p

    for path in (
        Path("data") / "Проданные.xlsx",
        Path("data") / "проданные.xlsx",
    ):
        if path.exists():
            return path

    found: list[Path] = []
    for folder in (Path("data"), Path("data/excel")):
        if not folder.is_dir():
            continue
        for path in folder.glob("*.xlsx"):
            if path.name.startswith("~$"):
                continue
            name_low = path.name.lower()
            if "аренда" in name_low:
                continue
            if any(k in name_low for k in ("рассроч", "продан", "выкуп", "купл")):
                found.append(path)

    if len(found) == 1:
        return found[0]
    if len(found) > 1:
        print("Multiple purchase Excel files found; specify path:")
        for p in found:
            print(f"  - {p}")
        sys.exit(1)

    print("Error: place Excel at data/Проданные.xlsx or pass path as argument")
    sys.exit(1)


def ensure_schema() -> None:
    Base.metadata.create_all(bind=sync_engine)
    insp = inspect(sync_engine)
    if insp.has_table("budget_purchase_records"):
        cols = {c["name"] for c in insp.get_columns("budget_purchase_records")}
        with sync_engine.begin() as conn:
            if "excel_columns" not in cols:
                conn.execute(text("ALTER TABLE budget_purchase_records ADD COLUMN excel_columns JSON"))
            for col in (
                "initial_cost",
                "payment_schedule",
                "monthly_payment",
                "remaining_debt",
            ):
                if col in cols:
                    pass  # legacy columns kept; new imports use excel_columns only


def read_sheet(sheet) -> tuple[list[dict], int, int, list[str]] | None:
    merged_lookup = build_merged_lookup(sheet)
    header_row = detect_header_row(sheet, merged_lookup)
    if header_row is None:
        print(f"  Skip {sheet.title!r}: header row not found")
        return None

    column_defs = build_sheet_header_columns(sheet, header_row, merged_lookup)
    if not column_defs:
        print(f"  Skip {sheet.title!r}: no columns")
        return None

    has_address = any(
        normalize_header(label) == "адрес"
        or (normalize_header(label).startswith("адрес") and "жк" not in normalize_header(label))
        for _c, label in column_defs
    )
    if not has_address:
        print(f"  Skip {sheet.title!r}: no Адрес column")
        return None

    print(f"\n--- Sheet {sheet.title!r} (header row {header_row}, {len(column_defs)} columns) ---")
    for col, label in column_defs:
        print(f"  Col {col:2d}: {label[:80]!r}")

    data_start = header_row + 1
    _min_row, max_row, _max_col = sheet_used_bounds(sheet)
    print(f"  Used range: {sheet.dimensions!r}, rows {data_start}..{max_row}")

    header_labels = [label for _col, label in column_defs]
    rows: list[dict] = []
    skipped = 0

    for row_idx in range(data_start, max_row + 1):
        if row_is_empty(sheet, row_idx, column_defs, merged_lookup):
            skipped += 1
            continue

        excel_columns: dict = {}
        for col, label in column_defs:
            raw = get_cell_value(sheet, row_idx, col, merged_lookup)
            excel_columns[label] = coerce_cell_value(raw)

        address, fio, contract = extract_search_fields(excel_columns)
        rows.append(
            {
                "source_sheet": sheet.title,
                "address": address,
                "fio": fio,
                "purchase_contract": contract,
                "excel_columns": excel_columns,
            }
        )

    scanned = max_row - data_start + 1
    print(f"  Scanned: {scanned}, empty skipped: {skipped}, imported rows: {len(rows)}")
    return rows, scanned, skipped, header_labels


def read_workbook(target_file: Path):
    wb = openpyxl.load_workbook(target_file, data_only=True, read_only=False)
    sheet_names = list(wb.sheetnames)
    print(f"Sheets found ({len(sheet_names)}): {sheet_names}")

    global_column_order: list[str] = []
    all_rows: list[dict] = []
    per_sheet: dict[str, int] = {}
    duplicates = 0
    seen: set[tuple[str, str, str]] = set()
    sheets_ok: list[str] = []

    for name in sheet_names:
        result = read_sheet(wb[name])
        if result is None:
            per_sheet[name] = 0
            continue

        sheet_rows, _scanned, _skipped, header_labels = result
        global_column_order = merge_column_order(global_column_order, header_labels)
        sheets_ok.append(name)

        imported = 0
        dup = 0
        for row in sheet_rows:
            key = dedup_key(row["excel_columns"])
            if key in seen:
                dup += 1
                duplicates += 1
                continue
            seen.add(key)
            all_rows.append(row)
            imported += 1

        per_sheet[name] = imported
        print(f"  Unique rows from sheet: {imported}, duplicates skipped: {dup}")

    wb.close()
    return all_rows, per_sheet, duplicates, sheets_ok, global_column_order, sheet_names


def import_excel(cli_path: str | None = None) -> None:
    ensure_schema()
    target = resolve_purchase_excel(cli_path)

    print("=" * 60)
    print("WHY PARTIAL IMPORT BEFORE:")
    print("  Parser only saved columns matching fixed rules (core + payment).")
    print("  Unmatched headers (e.g. empty col 50, extra fields) were dropped.")
    print("  Frontend used a short hardcoded column list, not full Excel headers.")
    print("FIX: every header column -> excel_columns JSON; UI uses exact labels.")
    print("=" * 60)
    print(f"File: {target.resolve()}\n")

    rows, per_sheet, duplicates, sheets_ok, column_order, all_sheets = read_workbook(target)

    print(f"\n=== Summary before DB ===")
    print(f"Sheets in file: {len(all_sheets)}")
    print(f"Sheets processed: {len(sheets_ok)} -> {sheets_ok}")
    print(f"Columns found: {len(column_order)}")
    print(f"Duplicates skipped: {duplicates}")
    print(f"Rows to import: {len(rows)}")

    session = SyncSessionLocal()
    try:
        session.execute(delete(BudgetPurchaseRecord))
        session.execute(delete(BudgetPurchaseImportMeta))
        session.commit()
        print("Cleared budget_purchase_records and import meta.")

        if rows:
            session.add_all([BudgetPurchaseRecord(**r) for r in rows])
        session.add(
            BudgetPurchaseImportMeta(
                id=1,
                source_file=str(target),
                sheets=sheets_ok,
                column_order=column_order,
                row_count=len(rows),
            )
        )
        session.commit()

        final = session.query(BudgetPurchaseRecord).count()
        print(f"\n=== Import complete ===")
        for sn, cnt in per_sheet.items():
            print(f"  {sn!r}: {cnt} rows")
        print(f"Total in DB: {final}")
        print(f"Columns stored: {len(column_order)}")
        if rows:
            ec = rows[0]["excel_columns"]
            print(f"Sample headers in row 1: {list(ec.keys())[:5]} ... {list(ec.keys())[-3:]}")
    except Exception as e:
        session.rollback()
        print("Import failed:", e)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    import_excel(sys.argv[1] if len(sys.argv) > 1 else None)
