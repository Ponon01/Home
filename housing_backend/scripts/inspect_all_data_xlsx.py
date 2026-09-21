# -*- coding: utf-8 -*-
"""Inspect Excel workbooks in data/ for importer redesign."""
from __future__ import annotations

import json
import re
from pathlib import Path

from openpyxl import load_workbook

DATA = Path(__file__).resolve().parents[1] / "data"
OUT = DATA / "_inspect_report.json"


def cell_str(v):
    if v is None:
        return ""
    return str(v).strip()


def find_header_row(ws, needles, max_scan=40):
    needles = [n.casefold() for n in needles]
    for r in range(1, min(max_scan, ws.max_row or 1) + 1):
        vals = []
        for c in range(1, min(30, ws.max_column or 1) + 1):
            vals.append(cell_str(ws.cell(r, c).value).casefold())
        joined = " | ".join(vals)
        hits = sum(1 for n in needles if any(n in v for v in vals))
        if hits >= max(2, len(needles) // 2):
            return r, [cell_str(ws.cell(r, c).value) for c in range(1, min(30, ws.max_column or 1) + 1)]
    return None, []


def sample_rows(ws, start, count=3, cols=15):
    rows = []
    for r in range(start, min(start + count, (ws.max_row or 0) + 1)):
        rows.append([cell_str(ws.cell(r, c).value)[:80] for c in range(1, cols + 1)])
    return rows


def year_cols(headers):
    years = []
    for h in headers:
        m = re.search(r"20(1[9]|2[0-6])", h or "")
        if m:
            years.append(h)
    return years


report = {"files": []}

for path in sorted(DATA.glob("*.xlsx")):
    if path.name.startswith("~$") or path.name.startswith("_"):
        continue
    entry = {"filename": path.name, "sheets": []}
    try:
        wb = load_workbook(path, data_only=True, read_only=True)
    except Exception as exc:
        entry["error"] = str(exc)
        report["files"].append(entry)
        continue

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        sheet = {
            "name": sheet_name,
            "max_row": ws.max_row,
            "max_col": ws.max_column,
        }
        # Try several header patterns
        patterns = [
            ["№", "адрес", "фио"],
            ["№ п/п", "адрес", "фио"],
            ["наименование", "жк", "квартир"],
            ["всего", "аренде", "реализац"],
            ["фио проживающих", "квартира", "жк"],
            ["год", "сумма", "поступлен"],
            ["первоначальн", "ежемесяч", "адрес"],
        ]
        best = None
        best_headers = []
        for needles in patterns:
            hr, headers = find_header_row(ws, needles)
            if hr and (best is None or hr < best):
                # prefer more filled headers
                filled = sum(1 for h in headers if h)
                if filled >= 3:
                    best = hr
                    best_headers = headers
        if best is None:
            # dump first 8 rows raw
            sheet["preview_rows"] = sample_rows(ws, 1, 8, 12)
        else:
            sheet["header_row"] = best
            sheet["headers"] = best_headers
            sheet["year_headers"] = year_cols(best_headers)
            sheet["sample"] = sample_rows(ws, best + 1, 3, 12)
            # also scan full header row up to col 40
            full = [cell_str(ws.cell(best, c).value) for c in range(1, min(45, (ws.max_column or 1) + 1))]
            sheet["headers_full"] = full
            sheet["year_headers_full"] = year_cols(full)
        entry["sheets"].append(sheet)
    wb.close()
    report["files"].append(entry)

OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {OUT}")
