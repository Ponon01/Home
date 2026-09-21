"""Verify Budget Purchase: Excel columns == DB == API shape."""

from __future__ import annotations

import sys
from pathlib import Path

import openpyxl

sys.path.append(str(Path(__file__).parent.parent))

from app.db.session import SyncSessionLocal
from app.models.budget_purchase_meta import BudgetPurchaseImportMeta
from app.models.budget_purchase_record import BudgetPurchaseRecord
from app.schemas.budget_purchase_record import BudgetPurchaseColumnsResponse, BudgetPurchaseRecordRead
from scripts.budget_purchase_excel import (
    build_merged_lookup,
    build_sheet_header_columns,
    detect_header_row,
)
from scripts.import_budget_purchase import resolve_purchase_excel


def main() -> None:
    target = resolve_purchase_excel()
    wb = openpyxl.load_workbook(target, data_only=True)
    sh = wb[wb.sheetnames[0]]
    ml = build_merged_lookup(sh)
    hr = detect_header_row(sh, ml)
    excel_cols = [label for _c, label in build_sheet_header_columns(sh, hr, ml)]
    wb.close()

    session = SyncSessionLocal()
    try:
        meta = session.get(BudgetPurchaseImportMeta, 1)
        row = session.query(BudgetPurchaseRecord).first()
        total = session.query(BudgetPurchaseRecord).count()
        db_cols = meta.column_order if meta else []
        api_cols = BudgetPurchaseColumnsResponse(
            columns=db_cols,
            row_count=meta.row_count if meta else total,
            sheets=meta.sheets if meta else [],
            source_file=meta.source_file if meta else None,
        )
        row_keys = len(BudgetPurchaseRecordRead.model_validate(row).excel_columns) if row else 0
    finally:
        session.close()

    print("Excel columns:", len(excel_cols))
    print("DB meta columns:", len(db_cols))
    print("DB rows:", total)
    print("API columns:", len(api_cols.columns))
    print("First row excel_columns keys:", row_keys)
    ok = (
        len(excel_cols) == len(db_cols) == len(api_cols.columns) == row_keys
        and total > 0
    )
    if excel_cols != db_cols:
        print("WARN: Excel header order differs from DB meta (counts may still match)")
    print("MATCH:", ok)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
