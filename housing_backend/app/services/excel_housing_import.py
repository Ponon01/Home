"""Import real housing data from Excel workbooks under data/ into PostgreSQL."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.data.canonical_complexes import normalize_complex_name
from app.db.session import SyncSessionLocal
from app.models import (
    Apartment,
    DashboardManualSummary,
    HousingComplex,
    HousingSalesReceipt,
    PurchaseFinancials,
    PurchasePaymentSchedule,
    RentalFinancials,
    Resident,
)
from app.models.enums import ApartmentSubtype, ApartmentType
from scripts.import_utils import (
    ImportStats,
    extract_apartment_number,
    get_or_create_apartment,
    get_or_create_resident,
    infer_apartment_type_and_subtype,
    is_vacant_occupant_text,
    normalize_text,
    parse_date,
    parse_decimal,
    parse_int,
    pick_column,
)

DATA_DIR = Path("data")

# Кандидаты по ключевым словам (реальные имена файлов могут отличаться опечатками)
RENT_BOOK_KEYWORDS = ("книга1",)
FUND_BOOK_KEYWORDS = ("информац", "фонд")
EARLY_BUYOUT_KEYWORDS = ("выкуп",)  # + досроч/доссроч в _find_by_keywords
INSTALLMENT_BOOK_KEYWORDS = ("рассроч",)
SALES_TOTALS_KEYWORDS = ("сумма",)  # продаж/продож

_MONTH_MAP = {
    "январ": 1,
    "феврал": 2,
    "март": 3,
    "апрел": 4,
    "май": 5,
    "июн": 6,
    "июл": 7,
    "август": 8,
    "сентябр": 9,
    "октябр": 10,
    "ноябр": 11,
    "декабр": 12,
}


def _iter_xlsx() -> list[Path]:
    if not DATA_DIR.exists():
        return []
    return sorted(
        p for p in DATA_DIR.glob("*.xlsx") if not p.name.startswith("~$") and not p.name.startswith("_")
    )


def _find_by_keywords(*groups: tuple[str, ...]) -> Path | None:
    """Return first workbook whose name contains ALL keywords from any group."""
    files = _iter_xlsx()
    for group in groups:
        for path in files:
            low = path.name.casefold().replace("ё", "е")
            if all(k in low for k in group):
                return path
    return None


def _find_first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists() and not path.name.startswith("~$"):
            return path
    return None


def discover_workbooks() -> dict[str, Path | None]:
    """Locate the five canonical Excel sources under data/."""
    rent = _find_by_keywords(RENT_BOOK_KEYWORDS) or _find_first_existing(
        [DATA_DIR / "Книга1.xlsx"]
    )
    fund = _find_by_keywords(FUND_BOOK_KEYWORDS)
    early = _find_by_keywords(
        ("досроч", "выкуп"),
        ("доссроч", "выкуп"),
        ("досрочно",),
        ("доссрочно",),
    )
    installment = _find_by_keywords(INSTALLMENT_BOOK_KEYWORDS) or _find_first_existing(
        [
            DATA_DIR / "рассрочка и выкупленные общее поступление 2222.xlsx",
            DATA_DIR / "рассрочка и выкупленные общее поступление.xlsx",
        ]
    )
    sales = _find_by_keywords(
        ("сумма", "продаж"),
        ("сумма", "продож"),
        ("сумма",),
    )
    return {
        "rent": rent,
        "fund": fund,
        "early_buyout": early,
        "installment": installment,
        "sales": sales,
    }


def _safe_color_attr(fg, name: str):
    try:
        return getattr(fg, name, None)
    except Exception:
        return None


def _cell_fill_bucket(cell) -> str | None:
    """Classify Excel cell fill into red / yellow / blue (or None)."""
    fill = getattr(cell, "fill", None)
    if fill is None:
        return None
    fill_type = getattr(fill, "fill_type", None) or getattr(fill, "patternType", None)
    if fill_type not in {"solid"}:
        return None
    fg = getattr(fill, "fgColor", None)
    if fg is None:
        return None

    rgb = _safe_color_attr(fg, "rgb")
    theme = _safe_color_attr(fg, "theme")
    indexed = _safe_color_attr(fg, "indexed")

    if isinstance(rgb, str) and len(rgb) >= 6 and "Values must be" not in rgb:
        hex6 = rgb[-6:].upper()
        try:
            r = int(hex6[0:2], 16)
            g = int(hex6[2:4], 16)
            b = int(hex6[4:6], 16)
        except ValueError:
            r = g = b = -1
        if r >= 0:
            # Pure / strong red (выкуп / гостевая depending on file)
            if r >= 180 and g <= 90 and b <= 90:
                return "red"
            # Yellow / amber (аренда)
            if r >= 200 and g >= 180 and b <= 120:
                return "yellow"
            # Blue / cyan (рассрочка)
            if b >= 150 and b > r and b >= g - 20:
                return "blue"
            if r <= 120 and g >= 160 and b >= 200:
                return "blue"

    # Theme accents used in the purchase workbook (Accent1 ≈ blue)
    if theme is not None:
        try:
            theme_i = int(theme)
        except (TypeError, ValueError):
            theme_i = -1
        # Only Accent1/Accent2 — do NOT map theme 0/2 (Лист2 uses them for both sold & installment)
        if theme_i in {4, 5, 7}:
            return "blue"

    if indexed is not None:
        try:
            idx = int(indexed)
        except (TypeError, ValueError):
            idx = -1
        # Common indexed palette: 2=red, 5/6≈yellow, 4/32≈blue
        if idx in {2, 10}:
            return "red"
        if idx in {5, 6, 13, 43, 44}:
            return "yellow"
        if idx in {4, 32, 33, 41, 23}:
            return "blue"

    return None


def _row_fill_bucket(ws, excel_row: int, preferred_cols: list[int]) -> str | None:
    """Return first meaningful fill color from preferred columns, then scan row."""
    max_col = min(getattr(ws, "max_column", 30) or 30, 40)
    for col in preferred_cols:
        if 1 <= col <= max_col:
            bucket = _cell_fill_bucket(ws.cell(excel_row, col))
            if bucket:
                return bucket
    for col in range(1, max_col + 1):
        bucket = _cell_fill_bucket(ws.cell(excel_row, col))
        if bucket:
            return bucket
    return None


def _build_color_lookup(
    ws,
    *,
    start_row: int,
    key_cols: list[int],
    preferred_cols: list[int],
    max_empty_streak: int = 40,
) -> dict[str, str]:
    """Map normalized FIO/address text → fill bucket (avoids pandas/Excel row drift)."""
    lookup: dict[str, str] = {}
    max_row = getattr(ws, "max_row", 0) or 0
    # openpyxl иногда отдаёт max_row=1_048_576 — ограничиваем разумным пределом
    hard_cap = min(max_row, start_row + 5000)
    empty_streak = 0
    for excel_row in range(start_row, hard_cap + 1):
        has_key = False
        for col in key_cols:
            if col < 1:
                continue
            raw = normalize_text(ws.cell(excel_row, col).value)
            if raw:
                has_key = True
                break
        if not has_key:
            empty_streak += 1
            if empty_streak >= max_empty_streak:
                break
            continue
        empty_streak = 0
        bucket = _row_fill_bucket(ws, excel_row, preferred_cols)
        if not bucket:
            continue
        for col in key_cols:
            if col < 1:
                continue
            raw = normalize_text(ws.cell(excel_row, col).value)
            if raw:
                lookup[raw.casefold()] = bucket
    return lookup


def _lookup_row_color(
    lookup: dict[str, str],
    *values: object,
    ws=None,
    excel_row: int | None = None,
    preferred_cols: list[int] | None = None,
) -> str | None:
    for value in values:
        key = normalize_text(value).casefold()
        if key and key in lookup:
            return lookup[key]
    if ws is not None and excel_row is not None and preferred_cols is not None:
        return _row_fill_bucket(ws, excel_row, preferred_cols)
    return None


def _open_sheet(path: Path, sheet_name: str | int | None = None):
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=False, read_only=False)
    if sheet_name is None:
        ws = wb.active
    else:
        ws = wb[sheet_name]
    return wb, ws


def _header_map(ws, header_row: int) -> dict[str, int]:
    mapping: dict[str, int] = {}
    max_col = min(getattr(ws, "max_column", 80) or 80, 80)
    for col in range(1, max_col + 1):
        title = normalize_text(ws.cell(header_row, col).value)
        if title:
            mapping[title] = col
    return mapping


def _pick_header_col(headers: dict[str, int], *needles: str) -> int | None:
    for needle in needles:
        n = needle.casefold()
        for title, col in headers.items():
            if n in title.casefold():
                return col
    return None


def parse_iin(value: object) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    if len(digits) == 12:
        return digits
    if len(digits) > 12:
        return digits[:12]
    return digits or None


def _room_count_from_object(value: object) -> int | None:
    text = normalize_text(value).casefold()
    if not text:
        return None
    if "комната" in text and "квартир" not in text:
        return 1
    m = re.search(r"(\d+)\s*[-–]?\s*х?", text)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*комнат", text)
    if m:
        return int(m.group(1))
    return None


def _build_address(
    *,
    complex_name: str | None,
    street: str | None,
    house: str | None,
    apt: str | None,
    fallback: str | None = None,
) -> str:
    if fallback and normalize_text(fallback):
        return normalize_text(fallback)
    parts: list[str] = []
    if complex_name:
        parts.append(f"Жилой комплекс {complex_name}")
    if street:
        parts.append(street)
    if house:
        parts.append(str(house))
    if apt:
        parts.append(f"- {apt}")
    return ", ".join(parts) if parts else ""


def _resolve_complex(raw_name: object, address: object) -> str | None:
    return normalize_complex_name(normalize_text(raw_name) or None, address=normalize_text(address) or None)


def clear_apartments(session: Session) -> None:
    session.execute(text("TRUNCATE TABLE apartments RESTART IDENTITY CASCADE"))
    session.execute(text("TRUNCATE TABLE housing_sales_receipts RESTART IDENTITY CASCADE"))
    session.commit()


def _store_control_total(
    session: Session,
    *,
    label: str,
    amount: float,
    note: str | None = None,
    year: int = 0,
) -> None:
    """Контрольные итоги Excel (year=0), отдельно от годовых фактов поступлений."""
    _upsert_sales_receipt(
        session,
        year=year,
        label=label,
        amount=float(amount),
        note=note,
    )
    session.flush()


def _upsert_rental_financials(
    session: Session,
    *,
    apartment: Apartment,
    resident: Resident | None,
    row: pd.Series,
    cols: dict[str, str | None],
) -> None:
    rf = session.scalars(
        select(RentalFinancials).where(
            RentalFinancials.apartment_id == apartment.id,
            RentalFinancials.is_current.is_(True),
        )
    ).first()
    if rf is None:
        rf = RentalFinancials(apartment_id=apartment.id, is_current=True)
        session.add(rf)

    rf.resident_id = resident.id if resident else rf.resident_id
    if cols.get("object"):
        rf.valuation_object = normalize_text(row.get(cols["object"])) or rf.valuation_object
    if cols.get("qty"):
        rf.quantity = parse_decimal(row.get(cols["qty"])) or rf.quantity
    if cols.get("market"):
        rf.market_price = parse_decimal(row.get(cols["market"])) or rf.market_price
    if cols.get("market_prop"):
        rf.proportional_market_price = parse_decimal(row.get(cols["market_prop"])) or rf.proportional_market_price
    if cols.get("balance"):
        rf.balance_value_2025 = parse_decimal(row.get(cols["balance"])) or rf.balance_value_2025
    if cols.get("balance_prop"):
        rf.proportional_balance_value_2025 = (
            parse_decimal(row.get(cols["balance_prop"])) or rf.proportional_balance_value_2025
        )
    if cols.get("occupied"):
        rf.occupied_area_sp = parse_decimal(row.get(cols["occupied"])) or rf.occupied_area_sp
    if cols.get("shared_total"):
        rf.shared_area_sp_total = parse_decimal(row.get(cols["shared_total"])) or rf.shared_area_sp_total
    if cols.get("shared_person"):
        rf.shared_area_per_person = parse_decimal(row.get(cols["shared_person"])) or rf.shared_area_per_person
    if cols.get("calc_area"):
        rf.calculation_area_total = parse_decimal(row.get(cols["calc_area"])) or rf.calculation_area_total
    if cols.get("cohabitation"):
        rf.cohabitation = normalize_text(row.get(cols["cohabitation"])) or rf.cohabitation
    if cols.get("cohabitant_count"):
        rf.cohabitant_count = parse_int(row.get(cols["cohabitant_count"])) or rf.cohabitant_count
    if cols.get("note"):
        rf.note = normalize_text(row.get(cols["note"])) or rf.note
    if cols.get("amortization"):
        rf.amortization_monthly = parse_decimal(row.get(cols["amortization"])) or rf.amortization_monthly
    if cols.get("material"):
        rf.material_benefit = parse_decimal(row.get(cols["material"])) or rf.material_benefit
    if cols.get("monthly"):
        rf.reimbursement_cost_monthly = parse_decimal(row.get(cols["monthly"])) or rf.reimbursement_cost_monthly
    if cols.get("taxable"):
        rf.taxable_base = parse_decimal(row.get(cols["taxable"])) or rf.taxable_base
    if cols.get("contract"):
        rf.rental_contract_number = normalize_text(row.get(cols["contract"])) or rf.rental_contract_number
    if cols.get("attachment"):
        rf.attachment_note = normalize_text(row.get(cols["attachment"])) or rf.attachment_note
    if cols.get("changes"):
        rf.changes_note = normalize_text(row.get(cols["changes"])) or rf.changes_note
    rf.contract_status = rf.contract_status or "active"


def import_rent_book(session: Session, path: Path, stats: ImportStats) -> None:
    df = pd.read_excel(path, sheet_name=0, header=0, engine="openpyxl")
    df.columns = [normalize_text(c) for c in df.columns]
    # Отсекаем полностью пустые строки (Книга1 раздута до max_row Excel)
    df = df.dropna(how="all")
    if len(df) > 3000:
        df = df.head(3000)
        stats.log(f"{path.name}: truncated to first 3000 non-empty rows")
    wb, ws = _open_sheet(path, sheet_name=None)
    headers_xlsx = _header_map(ws, 1)
    fio_col_x = _pick_header_col(headers_xlsx, "фио проживающих", "фио") or 21
    apt_col_x = _pick_header_col(headers_xlsx, "квартира") or 7
    note_col_x = _pick_header_col(headers_xlsx, "примечание")
    addr_col_x = _pick_header_col(headers_xlsx, "адрес")
    preferred_cols = [fio_col_x, apt_col_x] + ([note_col_x] if note_col_x else [])
    key_cols = [fio_col_x] + ([addr_col_x] if addr_col_x else [])
    color_lookup = _build_color_lookup(
        ws, start_row=2, key_cols=key_cols, preferred_cols=preferred_cols
    )

    cols = {
        "complex": pick_column(df.columns, "наименование жк", "жк"),
        "street": pick_column(df.columns, "улица"),
        "house": pick_column(df.columns, "дом", "корпус", "дом/корпус"),
        "apt": pick_column(df.columns, "квартира"),
        "address": pick_column(df.columns, "адрес"),
        "object": pick_column(df.columns, "объект оценки"),
        "qty": pick_column(df.columns, "количество"),
        "market": pick_column(df.columns, "рыночная цена"),
        "market_prop": pick_column(df.columns, "деленая пропорционально на количество оформленных"),
        "balance": pick_column(df.columns, "балансовая стоимость на 31 декабря"),
        "balance_prop": None,
        "rooms": pick_column(df.columns, "количество комнат"),
        "total_area": pick_column(df.columns, "общая площадь"),
        "living_area": pick_column(df.columns, "жилая площадь"),
        "occupied": pick_column(df.columns, "занимаемая площадь"),
        "shared_total": pick_column(df.columns, "общая площадь в сп квартирах (которая"),
        "shared_person": pick_column(df.columns, "на каждого проживающего"),
        "calc_area": pick_column(df.columns, "итого площадь"),
        "fio": pick_column(df.columns, "фио проживающих", "фио"),
        "iin": pick_column(df.columns, "иин"),
        "cohabitation": pick_column(df.columns, "совместное проживание"),
        "cohabitant_count": pick_column(df.columns, "количество совместно"),
        "note": pick_column(df.columns, "примечание"),
        "amortization": pick_column(df.columns, "амортизация в месяц"),
        "material": pick_column(df.columns, "материальная выгода"),
        "monthly": pick_column(df.columns, "себестоимость", "сумма возмещения"),
        "taxable": pick_column(df.columns, "налоооблагаемая", "налогооблагаемая"),
        "contract": pick_column(df.columns, "договор найма"),
        "attachment": pick_column(df.columns, "приложение"),
        "changes": pick_column(df.columns, "изменения"),
        "status_hint": pick_column(df.columns, "статус"),
    }
    # Second balance-prop column (longer header)
    for c in df.columns:
        low = c.casefold()
        if "балансовая" in low and "пропорционально" in low:
            cols["balance_prop"] = c
            break
        if cols["market_prop"] is None and "рыночная" in low and "пропорционально" in low:
            cols["market_prop"] = c

    try:
        for i, row in df.iterrows():
            excel_row = int(i) + 2
            try:
                address = normalize_text(row.get(cols["address"])) if cols["address"] else ""
                street = normalize_text(row.get(cols["street"])) if cols["street"] else ""
                house = normalize_text(row.get(cols["house"])) if cols["house"] else ""
                apt_raw = normalize_text(row.get(cols["apt"])) if cols["apt"] else ""
                apt_no = extract_apartment_number(apt_raw, address) or ""
                raw_complex = normalize_text(row.get(cols["complex"])) if cols["complex"] else ""
                complex_name = _resolve_complex(raw_complex, address)
                if not complex_name:
                    stats.skipped += 1
                    continue

                if not address:
                    address = _build_address(
                        complex_name=complex_name, street=street, house=house, apt=apt_no
                    )
                if not address and not apt_no:
                    stats.skipped += 1
                    continue

                fio = normalize_text(row.get(cols["fio"])) if cols["fio"] else ""
                note = normalize_text(row.get(cols["note"])) if cols["note"] else ""
                color = _lookup_row_color(
                    color_lookup,
                    fio,
                    address,
                    ws=ws,
                    excel_row=excel_row,
                    preferred_cols=preferred_cols,
                )
                hint = " ".join(
                    [
                        normalize_text(row.get(cols["status_hint"])) if cols["status_hint"] else "",
                        note,
                        normalize_text(row.get(cols["object"])) if cols["object"] else "",
                        fio,
                        "найм",
                    ]
                )
                housing_type, subtype = infer_apartment_type_and_subtype(hint)
                # Книга1 color legend: yellow → аренда, red → гостевая
                if color == "red" or "гостев" in hint.casefold():
                    housing_type, subtype = ApartmentType.rent, ApartmentSubtype.guest
                elif color == "yellow":
                    housing_type, subtype = ApartmentType.rent, ApartmentSubtype.rent
                elif housing_type == ApartmentType.purchase:
                    housing_type, subtype = ApartmentType.rent, ApartmentSubtype.rent

                room_count = parse_int(row.get(cols["rooms"])) if cols["rooms"] else None
                if room_count is None and cols["object"]:
                    room_count = _room_count_from_object(row.get(cols["object"]))

                apartment, created = get_or_create_apartment(
                    session,
                    address=address,
                    residential_complex_name=complex_name,
                    defaults={
                        "street": street or None,
                        "house_number": house or None,
                        "apartment_number": apt_no or None,
                        "room_count": room_count,
                        "total_area": parse_decimal(row.get(cols["total_area"])) if cols["total_area"] else None,
                        "living_area": parse_decimal(row.get(cols["living_area"])) if cols["living_area"] else None,
                        "housing_type": housing_type,
                        "apartment_subtype": subtype,
                        "status": "active",
                        "contract_hint": hint,
                    },
                )
                apartment.housing_type = housing_type
                apartment.apartment_subtype = subtype
                if created:
                    stats.inserted += 1
                else:
                    stats.updated += 1
                    apartment.residential_complex_name = complex_name
                    if street:
                        apartment.street = street
                    if house:
                        apartment.house_number = house
                    if apt_no:
                        apartment.apartment_number = apt_no

                resident = None
                vacant = bool(fio) and is_vacant_occupant_text(fio)
                guest_label = "гостев" in fio.casefold()
                # Strip generic guest prefix to keep a real surname when present
                display_fio = fio
                if guest_label:
                    display_fio = re.sub(
                        r"(?i)гостевая\s+служебная\s+квартира\s*",
                        "",
                        fio,
                    ).strip()
                    display_fio = re.sub(r"(?i)\bпустая\b", "", display_fio).strip()
                if vacant and not display_fio:
                    pass
                elif display_fio and not (guest_label and not display_fio):
                    apartment.status = "active"
                    primary = re.split(r"[;/]| и ", display_fio)[0].strip()
                    if primary and primary.casefold() not in {"гостевая служебная квартира", "гостевая"}:
                        iin = parse_iin(row.get(cols["iin"])) if cols["iin"] else None
                        resident, res_created = get_or_create_resident(
                            session,
                            apartment_id=apartment.id,
                            full_name=primary,
                            defaults={
                                "iin": iin,
                                "cohabitation": normalize_text(row.get(cols["cohabitation"]))
                                if cols["cohabitation"]
                                else None,
                                "cohabitant_count": parse_int(row.get(cols["cohabitant_count"]))
                                if cols["cohabitant_count"]
                                else None,
                                "note": note or None,
                                "occupancy_basis": "гостевой фонд" if subtype == ApartmentSubtype.guest else "договор найма",
                            },
                        )
                        stats.inserted += 1 if res_created else 0
                        stats.updated += 0 if res_created else 1

                _upsert_rental_financials(session, apartment=apartment, resident=resident, row=row, cols=cols)
                if vacant:
                    rf = session.scalars(
                        select(RentalFinancials).where(
                            RentalFinancials.apartment_id == apartment.id,
                            RentalFinancials.is_current.is_(True),
                        )
                    ).first()
                    if rf is not None:
                        note_bits = [normalize_text(rf.note), fio]
                        rf.note = "; ".join(dict.fromkeys(x for x in note_bits if x))
                        if resident is None and rf.resident_id is None:
                            rf.contract_status = rf.contract_status or "vacant"
                    has_active = session.scalars(
                        select(Resident.id)
                        .where(
                            Resident.apartment_id == apartment.id,
                            Resident.is_active.is_(True),
                        )
                        .limit(1)
                    ).first()
                    if not has_active and subtype != ApartmentSubtype.guest:
                        apartment.status = "vacant"
                if stats.inserted % 25 == 0:
                    session.commit()
                else:
                    session.flush()
            except Exception as exc:
                session.rollback()
                stats.errors += 1
                stats.log(f"{path.name}: rent row {excel_row}: {exc}")
        session.commit()
    finally:
        wb.close()

    stats.log(f"{path.name}: rent import finished")


def _month_from_column(col: str) -> tuple[int, int] | None:
    """Return (year, month). month=0 means annual total column «за 2019»."""
    low = col.casefold().replace("ё", "е")
    year_match = re.search(r"(20\d{2})", low)
    month = None
    for key, m in _MONTH_MAP.items():
        if key in low:
            month = m
            break

    if year_match:
        year = int(year_match.group(1))
        if month is not None:
            return year, month
        # «за 2019», «за 2025 год», bare year
        if "за " in low or "год" in low or re.fullmatch(r".*20\d{2}.*", low):
            return year, 0
        return year, 0

    if month is not None:
        return 2026, month
    return None


def _is_purchase_summary_row(*, address: str, fio: str, row_no: object) -> bool:
    """Skip empty / total / section header rows in purchase workbooks."""
    addr = address.casefold().replace("ё", "е")
    name = fio.casefold().replace("ё", "е")
    if not addr and not name:
        return True
    markers = (
        "итого",
        "информация по",
        "задолж",
        "реализованные квартир",
        "№ п/п",
        "адрес",
        "всего",
        "сумма",
    )
    if any(m in addr for m in markers):
        return True
    if addr in {"", "nan"} and not name:
        return True
    # Row number cell sometimes holds "Итого"
    no_txt = normalize_text(row_no).casefold()
    if no_txt.startswith("итого"):
        return True
    return False


def _import_purchase_sheet(
    session: Session,
    path: Path,
    *,
    sheet_name: str,
    header_row: int,
    subtype: ApartmentSubtype,
    stats: ImportStats,
    force_early_buyout: bool = False,
) -> None:
    from openpyxl import load_workbook

    # Resolve sheet name (case / first sheet fallback)
    wb_names = load_workbook(path, read_only=True, data_only=False)
    try:
        names = wb_names.sheetnames
    finally:
        wb_names.close()
    if sheet_name not in names:
        # Fuzzy: Лист1 / Sheet1 / first sheet
        target = None
        needle = sheet_name.casefold()
        for n in names:
            if n.casefold() == needle or needle in n.casefold():
                target = n
                break
        if target is None and names:
            target = names[0]
            stats.log(f"{path.name}: sheet '{sheet_name}' missing — using '{target}'")
        sheet_name = target or sheet_name

    df = pd.read_excel(path, sheet_name=sheet_name, header=header_row, engine="openpyxl")
    df.columns = [normalize_text(c) for c in df.columns]
    # Drop fully empty columns that pandas sometimes invents
    df = df.dropna(how="all")
    wb, ws = _open_sheet(path, sheet_name=sheet_name)
    headers_xlsx = _header_map(ws, header_row + 1)
    fio_col_x = _pick_header_col(headers_xlsx, "фио") or 4
    addr_col_x = _pick_header_col(headers_xlsx, "адрес") or 3
    note_col_x = _pick_header_col(headers_xlsx, "примечание")
    preferred_cols = [fio_col_x, addr_col_x] + ([note_col_x] if note_col_x else [])
    color_lookup = _build_color_lookup(
        ws,
        start_row=header_row + 2,
        key_cols=[fio_col_x, addr_col_x],
        preferred_cols=preferred_cols,
    )

    c_address = pick_column(df.columns, "адрес")
    c_name = pick_column(df.columns, "фио")
    c_iin = pick_column(df.columns, "иин")
    c_contract = pick_column(df.columns, "договор купли")
    c_initial_cost = pick_column(df.columns, "первоначальная")
    c_initial_year = pick_column(df.columns, "год продажи", "год")
    c_period = pick_column(df.columns, "период реализации")
    c_balance = pick_column(df.columns, "балансовая")
    c_valuation = pick_column(df.columns, "согласно отчету", "стоимость жилья")
    c_initial_payment = pick_column(df.columns, "первоначального взноса", "сумма первоначального")
    c_remaining = pick_column(df.columns, "остаток", "задолж")
    c_monthly = pick_column(df.columns, "ежемесяч")
    c_last_payment = pick_column(df.columns, "дата последнего")
    c_note = pick_column(df.columns, "примечание")
    c_row_no = pick_column(df.columns, "№ п/п", "№")
    month_columns = [c for c in df.columns if _month_from_column(c) is not None]

    try:
        for i, row in df.iterrows():
            excel_row = int(i) + header_row + 2
            try:
                address = normalize_text(row.get(c_address)) if c_address else ""
                fio = normalize_text(row.get(c_name)) if c_name else ""
                row_no = row.get(c_row_no) if c_row_no else None
                if _is_purchase_summary_row(address=address, fio=fio, row_no=row_no):
                    stats.skipped += 1
                    continue
                if not address:
                    stats.skipped += 1
                    continue

                complex_name = _resolve_complex(None, address) or "UNKNOWN"
                apt_no = extract_apartment_number(address)
                street_hint = None
                house_hint = None
                m_addr = re.search(
                    r"([А-Яа-яA-Za-z.\-\s]+?)\s+(\d+[A-Za-zА-Яа-я]?)\s*[-–—]\s*(\d+[A-Za-zА-Яа-я]?)\s*$",
                    address,
                )
                if m_addr:
                    street_hint = normalize_text(m_addr.group(1))
                    house_hint = normalize_text(m_addr.group(2))
                    apt_no = apt_no or normalize_text(m_addr.group(3))

                contract = normalize_text(row.get(c_contract)) if c_contract else ""
                note = normalize_text(row.get(c_note)) if c_note else ""
                hint = f"{contract} {note}".strip()
                color = _lookup_row_color(
                    color_lookup,
                    fio,
                    address,
                    ws=ws,
                    excel_row=excel_row,
                    preferred_cols=preferred_cols,
                )

                final_subtype = subtype
                note_low = note.casefold().replace("ё", "е")
                contract_low = contract.casefold().replace("ё", "е")
                early_markers = ("выкуплен", "выкупен", "досроч", "доссроч", "сразу", "100%")
                is_early_note = any(x in note_low or x in contract_low for x in early_markers)
                is_active_installment = "действующ" in note_low or (
                    "рассроч" in note_low and not is_early_note
                )

                # При force_early — импортируем только досрочный / сразу выкуп
                if force_early_buyout:
                    if not is_early_note:
                        stats.skipped += 1
                        continue
                    final_subtype = ApartmentSubtype.full_sold
                elif is_early_note and not is_active_installment:
                    final_subtype = ApartmentSubtype.full_sold
                elif is_active_installment or subtype == ApartmentSubtype.installment:
                    # Рассрочка: не перебиваем цветом ячейки на full_sold
                    final_subtype = ApartmentSubtype.installment
                elif color == "red" and subtype == ApartmentSubtype.full_sold:
                    final_subtype = ApartmentSubtype.full_sold
                elif color == "blue":
                    final_subtype = ApartmentSubtype.installment

                occupancy = (
                    "досрочный выкуп"
                    if force_early_buyout or (final_subtype == ApartmentSubtype.full_sold and is_early_note)
                    else ("выкуп" if final_subtype == ApartmentSubtype.full_sold else "рассрочка")
                )

                apartment, created = get_or_create_apartment(
                    session,
                    address=address,
                    residential_complex_name=complex_name,
                    defaults={
                        "street": street_hint,
                        "house_number": house_hint,
                        "apartment_number": apt_no,
                        "housing_type": ApartmentType.purchase,
                        "apartment_subtype": final_subtype,
                        "status": "active",
                        "contract_hint": hint or occupancy,
                    },
                )
                apartment.housing_type = ApartmentType.purchase
                apartment.apartment_subtype = final_subtype
                apartment.residential_complex_name = complex_name
                apartment.status = "active"
                if street_hint:
                    apartment.street = street_hint
                if house_hint:
                    apartment.house_number = house_hint
                if apt_no:
                    apartment.apartment_number = apt_no
                stats.inserted += 1 if created else 0
                stats.updated += 0 if created else 1

                resident = None
                if fio:
                    resident, _ = get_or_create_resident(
                        session,
                        apartment_id=apartment.id,
                        full_name=fio,
                        defaults={
                            "iin": parse_iin(row.get(c_iin)) if c_iin else None,
                            "occupancy_basis": occupancy,
                            "note": note or None,
                        },
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

                pf.resident_id = resident.id if resident else pf.resident_id
                pf.purchase_contract = contract or pf.purchase_contract
                pf.initial_cost = parse_decimal(row.get(c_initial_cost)) if c_initial_cost else pf.initial_cost
                pf.initial_cost_year = parse_int(row.get(c_initial_year)) if c_initial_year else pf.initial_cost_year
                pf.realization_period = normalize_text(row.get(c_period)) if c_period else pf.realization_period
                pf.balance_cost = parse_decimal(row.get(c_balance)) if c_balance else pf.balance_cost
                pf.valuation_cost = parse_decimal(row.get(c_valuation)) if c_valuation else pf.valuation_cost
                pf.initial_payment = (
                    parse_decimal(row.get(c_initial_payment)) if c_initial_payment else pf.initial_payment
                )
                pf.monthly_payment = parse_decimal(row.get(c_monthly)) if c_monthly else pf.monthly_payment
                if c_last_payment:
                    pf.last_payment_date = parse_date(row.get(c_last_payment))
                if c_remaining:
                    pf.remaining_debt = parse_decimal(row.get(c_remaining))
                elif final_subtype == ApartmentSubtype.full_sold:
                    pf.remaining_debt = 0
                    if force_early_buyout:
                        pf.monthly_payment = pf.monthly_payment or 0
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
                    if month == 0:
                        sched.note = sched.note or "год (итог)"

                session.commit()
            except Exception as exc:
                session.rollback()
                stats.errors += 1
                stats.log(f"{path.name}/{sheet_name}: row {excel_row}: {exc}")
    finally:
        wb.close()

    label = "early_buyout" if force_early_buyout else subtype.value
    stats.log(f"{path.name}/{sheet_name}: purchase import finished ({label})")


def _excel_purchase_control_totals(
    path: Path,
    *,
    sheet_name: str | None = None,
    header_row: int = 3,
    note_filter_early: bool = False,
) -> dict[str, float]:
    """Суммы контрольных колонок из книги рассрочки / досрочного выкупа."""
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True, read_only=True)
    try:
        ws = wb[sheet_name] if sheet_name and sheet_name in wb.sheetnames else wb[wb.sheetnames[0]]
        # Найти строку заголовка
        hdr = header_row
        for r in range(1, min(15, (ws.max_row or 1) + 1)):
            vals = " ".join(
                str(ws.cell(r, c).value or "").casefold()
                for c in range(1, min(14, (ws.max_column or 1) + 1))
            )
            if "адрес" in vals and "фио" in vals:
                hdr = r
                break

        # Колонки по подписям
        col = {}
        for c in range(1, min(20, (ws.max_column or 1) + 1)):
            t = normalize_text(ws.cell(hdr, c).value).casefold().replace("ё", "е")
            if not t:
                continue
            if "адрес" in t:
                col["addr"] = c
            elif "фио" in t:
                col["fio"] = c
            elif "первоначальн" in t and "взнос" not in t:
                col["init"] = c
            elif "балансов" in t:
                col["bal"] = c
            elif "согласно отчету" in t or "оценк" in t:
                col["val"] = c
            elif "первоначального взноса" in t or "сумма первоначального" in t:
                col["pay"] = c
            elif "ежемесяч" in t:
                col["mon"] = c
            elif "примечание" in t:
                col["note"] = c

        addr_c = col.get("addr", 3)
        fio_c = col.get("fio", 4)
        init_c = col.get("init", 6)
        bal_c = col.get("bal", 9)
        val_c = col.get("val", 10)
        pay_c = col.get("pay")
        mon_c = col.get("mon")
        note_c = col.get("note", 11)
        markers = ("выкуплен", "выкупен", "досроч", "доссроч", "сразу", "100%")

        out = {"n": 0.0, "init": 0.0, "bal": 0.0, "val": 0.0, "pay": 0.0, "mon": 0.0}
        for r in range(hdr + 1, (ws.max_row or 0) + 1):
            addr = normalize_text(ws.cell(r, addr_c).value)
            fio = normalize_text(ws.cell(r, fio_c).value)
            if not addr or not fio:
                continue
            low_addr = addr.casefold()
            if "итого" in low_addr or "информац" in low_addr:
                continue
            note = normalize_text(ws.cell(r, note_c).value).casefold().replace("ё", "е")
            if note_filter_early and not any(m in note for m in markers):
                continue

            def _n(c: int | None) -> float:
                if not c:
                    return 0.0
                return float(parse_decimal(ws.cell(r, c).value) or 0)

            out["n"] += 1
            out["init"] += _n(init_c)
            out["bal"] += _n(bal_c)
            out["val"] += _n(val_c)
            out["pay"] += _n(pay_c)
            out["mon"] += _n(mon_c)
        return out
    finally:
        wb.close()


def import_purchase_book(session: Session, path: Path, stats: ImportStats) -> None:
    """Рассрочка: лист с заголовком «Ежемесячный платеж» / «первоначального взноса»."""
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=False)
    try:
        sheet_names = list(wb.sheetnames)
    finally:
        wb.close()

    # Prefer Лист1; also accept any sheet that looks like installment
    targets: list[tuple[str, int]] = []
    for name in sheet_names:
        low = name.casefold()
        if "лист1" in low or low in {"sheet1", "лист 1"}:
            targets.append((name, 4))
        elif "лист2" in low:
            # Legacy sold sheet — import as sold if present
            targets.append((name, 2))
    if not targets and sheet_names:
        targets.append((sheet_names[0], 4))

    for sheet_name, header_row in targets:
        subtype = (
            ApartmentSubtype.full_sold
            if "лист2" in sheet_name.casefold()
            else ApartmentSubtype.installment
        )
    _import_purchase_sheet(
        session,
        path,
            sheet_name=sheet_name,
            header_row=header_row,
            subtype=subtype,
        stats=stats,
            force_early_buyout=False,
        )

    # Контрольные итоги листа рассрочки (111 кв.) — до переклассификации early
    try:
        sheet = next((n for n, _ in targets if "лист1" in n.casefold()), targets[0][0] if targets else None)
        totals = _excel_purchase_control_totals(path, sheet_name=sheet, header_row=5, note_filter_early=False)
        _store_control_total(
            session,
            label="control_installment_count",
            amount=totals["n"],
            note=path.name,
        )
        _store_control_total(
            session,
            label="control_installment_initial_cost",
            amount=totals["init"],
            note=path.name,
        )
        _store_control_total(
            session,
            label="control_installment_initial_payment",
            amount=totals["pay"],
            note=path.name,
        )
        _store_control_total(
            session,
            label="control_installment_monthly",
            amount=totals["mon"],
            note=path.name,
        )
        session.commit()
        stats.log(
            f"{path.name}: installment controls n={int(totals['n'])} "
            f"init={totals['init']:.2f} pay={totals['pay']:.2f} mon={totals['mon']:.2f}"
        )
    except Exception as exc:
        session.rollback()
        stats.log(f"{path.name}: installment control totals failed: {exc}")


def import_early_buyout_book(session: Session, path: Path, stats: ImportStats) -> None:
    """Досрочно выкупленные квартиры (отдельный файл)."""
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet_names = list(wb.sheetnames)
        # Locate header row with № п/п + Адрес + ФИО
        chosen = None
        header_row_pandas = 2
        for name in sheet_names:
            ws = wb[name]
            for r in range(1, min(15, (ws.max_row or 1) + 1)):
                vals = " ".join(
                    str(ws.cell(r, c).value or "").casefold()
                    for c in range(1, min(12, (ws.max_column or 1) + 1))
                )
                if "адрес" in vals and "фио" in vals and ("№" in vals or "п/п" in vals):
                    chosen = name
                    header_row_pandas = r - 1  # pandas 0-based header index
                    break
            if chosen:
                break
    finally:
        wb.close()

    if not chosen:
        chosen = sheet_names[0] if sheet_names else "Лист2"
        header_row_pandas = 2
        stats.log(f"{path.name}: header not auto-detected — using {chosen} row {header_row_pandas + 1}")

    _import_purchase_sheet(
        session,
        path,
        sheet_name=chosen,
        header_row=header_row_pandas,
        subtype=ApartmentSubtype.full_sold,
        stats=stats,
        force_early_buyout=True,
    )

    # Контрольные итоги: только строки с маркерами досрочного / сразу выкупа
    try:
        totals = _excel_purchase_control_totals(
            path, sheet_name=chosen, header_row=header_row_pandas + 1, note_filter_early=True
        )
        _store_control_total(session, label="control_early_count", amount=totals["n"], note=path.name)
        _store_control_total(
            session, label="control_early_initial_cost", amount=totals["init"], note=path.name
        )
        _store_control_total(
            session, label="control_early_balance_cost", amount=totals["bal"], note=path.name
        )
        _store_control_total(
            session, label="control_early_valuation_cost", amount=totals["val"], note=path.name
        )
        session.commit()
        stats.log(
            f"{path.name}: early controls n={int(totals['n'])} "
            f"init={totals['init']:.2f} bal={totals['bal']:.2f} val={totals['val']:.2f}"
        )
    except Exception as exc:
        session.rollback()
        stats.log(f"{path.name}: early control totals failed: {exc}")


def _safe_int(value: object, default: int = 0) -> int:
    n = parse_int(value)
    return int(n) if n is not None else default


def import_fund_summary_book(session: Session, path: Path, stats: ImportStats) -> None:
    """Свод по ЖК: количество, не подлежащие реализации, аренда, гостевые → DashboardManualSummary."""
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True, read_only=True)
    try:
        sheet_name = None
        for name in wb.sheetnames:
            low = name.casefold()
            if "русс" in low:
                sheet_name = name
                break
            if sheet_name is None and "свод" in low:
                sheet_name = name
        if sheet_name is None:
            sheet_name = wb.sheetnames[0]
        ws = wb[sheet_name]

        # Фиксированная раскладка листа «Свод по ЖК русс»:
        # 1 ЖК, 2 адрес, 3 кол-во, 4 не подлежат, 5 к реализации, 6 год,
        # 7–14 годы 2019–2026, 15 итого реализовано, 16 осталось, 17 в аренде, 18 гостевые
        col_map = {
            "name": 1,
            "address": 2,
            "total": 3,
            "not_for_sale": 4,
            "for_sale": 5,
            "transfer_year": 6,
            "sold_total": 15,
            "remaining": 16,
            "rent": 17,
            "guest": 18,
        }
        year_cols = {y: 7 + i for i, y in enumerate(range(2019, 2027))}

        imported = 0
        rent_sum = guest_sum = total_sum = not_sale_sum = for_sale_sum = 0
        for r in range(8, (ws.max_row or 0) + 1):
            raw_name = normalize_text(ws.cell(r, col_map["name"]).value)
            if not raw_name:
                continue
            if raw_name.casefold().startswith("итого"):
                continue

            complex_name = _resolve_complex(raw_name, ws.cell(r, col_map["address"]).value)
            if not complex_name:
                stats.skipped += 1
                continue

            address = normalize_text(ws.cell(r, col_map["address"]).value) or None
            total = _safe_int(ws.cell(r, col_map["total"]).value)
            not_for_sale = _safe_int(ws.cell(r, col_map["not_for_sale"]).value)
            for_sale = _safe_int(ws.cell(r, col_map["for_sale"]).value)
            transfer_year = parse_int(ws.cell(r, col_map["transfer_year"]).value)
            remaining = _safe_int(ws.cell(r, col_map["remaining"]).value)
            rent = _safe_int(ws.cell(r, col_map["rent"]).value)
            guest = _safe_int(ws.cell(r, col_map["guest"]).value)
            sold_total = _safe_int(ws.cell(r, col_map["sold_total"]).value)
            sold_by_year = {y: _safe_int(ws.cell(r, c).value) for y, c in year_cols.items()}
            if sold_total <= 0:
                sold_total = sum(sold_by_year.values())

            row = session.scalars(
                select(DashboardManualSummary).where(
                    DashboardManualSummary.residential_complex_name == complex_name
                )
            ).first()
            if row is None:
                row = DashboardManualSummary(residential_complex_name=complex_name)
                session.add(row)

            row.total_count = total
            row.not_for_sale_count = not_for_sale
            row.for_sale_count = for_sale
            row.transfer_year = transfer_year
            row.sold_2019 = sold_by_year.get(2019, 0)
            row.sold_2020 = sold_by_year.get(2020, 0)
            row.sold_2021 = sold_by_year.get(2021, 0)
            row.sold_2022 = sold_by_year.get(2022, 0)
            row.sold_2023 = sold_by_year.get(2023, 0)
            row.sold_2024 = sold_by_year.get(2024, 0)
            row.sold_2025 = sold_by_year.get(2025, 0)
            row.sold_2026 = sold_by_year.get(2026, 0)
            row.sold_total = sold_total
            row.remaining_total = remaining
            row.rent_count = rent
            row.guest_count = guest
            row.rent_as_flat = max(rent - guest, 0) if guest else rent
            row.notes = f"Импорт из {path.name}"

            profile = session.scalars(
                select(HousingComplex).where(HousingComplex.name == complex_name)
            ).first()
            if profile is None:
                profile = HousingComplex(name=complex_name)
                session.add(profile)
            if address:
                profile.address = address
            if transfer_year:
                profile.build_year = transfer_year

            imported += 1
            total_sum += total
            not_sale_sum += not_for_sale
            for_sale_sum += for_sale
            rent_sum += rent
            guest_sum += guest

        _store_control_total(session, label="control_fund_total", amount=total_sum, note=path.name)
        _store_control_total(session, label="control_fund_not_for_sale", amount=not_sale_sum, note=path.name)
        _store_control_total(session, label="control_fund_for_sale", amount=for_sale_sum, note=path.name)
        _store_control_total(session, label="control_fund_rent", amount=rent_sum, note=path.name)
        _store_control_total(session, label="control_fund_guest", amount=guest_sum, note=path.name)

        session.commit()
        stats.log(
            f"{path.name}/{sheet_name}: fund summary — {imported} ЖК "
            f"(всего={total_sum}, не_к_реализации={not_sale_sum}, к_реализации={for_sale_sum}, "
            f"аренда={rent_sum}, гостевые={guest_sum})"
        )
        stats.updated += imported
    except Exception as exc:
        session.rollback()
        stats.errors += 1
        stats.log(f"{path.name}: fund import failed: {exc}")
    finally:
        wb.close()


def _upsert_sales_receipt(
    session: Session,
    *,
    year: int,
    label: str,
    amount: float,
    note: str | None,
) -> None:
    row = session.scalars(
        select(HousingSalesReceipt).where(
            HousingSalesReceipt.year == year,
            HousingSalesReceipt.source_label == label,
        )
    ).first()
    if row is None:
        row = HousingSalesReceipt(year=year, source_label=label)
        session.add(row)
        session.flush()
    row.amount = float(amount)
    row.note = note


def import_sales_totals_book(session: Session, path: Path, stats: ImportStats) -> None:
    """Сверка фактических поступлений 2019–2026 + модернизация / остаток."""
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True, read_only=True)
    try:
        sheet = wb[wb.sheetnames[0]]
        header_row = None
        for r in range(1, min(20, (sheet.max_row or 1) + 1)):
            vals = [
                str(sheet.cell(r, c).value or "").casefold()
                for c in range(1, min(20, (sheet.max_column or 1) + 1))
            ]
            if any("факт поступлен" in v for v in vals) and any(
                re.search(r"20\d{2}", v) for v in vals
            ):
                header_row = r
                break
        if header_row is None:
            stats.log(f"{path.name}: sales header not found — skipped")
            return

        # Колонки шапки (факт по годам + итоги)
        year_cols: list[tuple[int, int, str]] = []
        seen_labels: set[str] = set()
        for c in range(1, min(20, (sheet.max_column or 1) + 1)):
            title = normalize_text(sheet.cell(header_row, c).value)
            low = title.casefold().replace("–", "-").replace("—", "-")
            if not title:
                continue
            if re.search(r"2019\s*-\s*2025", low) or "2019-2025" in low.replace(" ", ""):
                label = "факт_2019_2025"
                store_year = 2019
            elif "итоговая сумма" in low or ("остаток" in low and "2026" in low):
                label = "факт_2026_плюс_остаток"
                store_year = 2026
            elif "2026" in low and "факт" in low:
                label = "факт_2026"
                store_year = 2026
            else:
                m = re.search(r"(20\d{2})", low)
                if not m or "факт" not in low:
                    continue
                label = "факт"
                store_year = int(m.group(1))
            if label in seen_labels and label != "факт":
                continue
            if label == "факт":
                key = f"факт_{store_year}"
                if key in seen_labels:
                    continue
                seen_labels.add(key)
            else:
                seen_labels.add(label)
            year_cols.append((c, store_year, label))

        count = 0
        # Основная строка факта (row header_row+1)
        data_row = header_row + 1
        note = normalize_text(sheet.cell(data_row, 3).value) or path.name
        for c, store_year, label in year_cols:
            amount = parse_decimal(sheet.cell(data_row, c).value)
            if amount is None:
                continue
            _upsert_sales_receipt(
                session, year=store_year, label=label, amount=float(amount), note=note
            )
            count += 1

        # Доп. строки: модернизация / остаток (колонка K = 11)
        for r in range(header_row + 2, min(header_row + 8, (sheet.max_row or 1) + 1)):
            label_cell = normalize_text(sheet.cell(r, 3).value).casefold().replace("ё", "е")
            if not label_cell:
                continue
            amount = None
            for c in range(4, 14):
                amount = parse_decimal(sheet.cell(r, c).value)
                if amount is not None:
                    break
            if amount is None:
                continue
            # «остаток … после … модернизации» содержит оба слова — сначала остаток
            if "остаток" in label_cell:
                _upsert_sales_receipt(
                    session,
                    year=2025,
                    label="остаток_после_модернизации",
                    amount=float(amount),
                    note=normalize_text(sheet.cell(r, 3).value),
                )
                count += 1
            elif "модерниз" in label_cell or "затрат" in label_cell:
                _upsert_sales_receipt(
                    session,
                    year=2025,
                    label="затраты_модернизация_2025",
                    amount=float(amount),
                    note=normalize_text(sheet.cell(r, 3).value),
                )
                count += 1

        session.commit()
        stats.log(f"{path.name}: sales receipts — {count} buckets")
        stats.updated += count
    except Exception as exc:
        session.rollback()
        stats.errors += 1
        stats.log(f"{path.name}: sales import failed: {exc}")
    finally:
        wb.close()


def run_excel_import(*, reset: bool = True) -> ImportStats:
    """
    Универсальная загрузка из data/*.xlsx:

    1. Информация о квартирном фонде — свод по ЖК
    2. Книга1 — аренда / общежитие
    3. рассрочка и выкупленные… — рассрочка + графики
    4. досрочно выкуп — досрочный выкуп
    5. сумма продажи — сверка фактических поступлений
    """
    books = discover_workbooks()
    if not any(books.values()):
        raise FileNotFoundError(
            "Не найдены Excel-файлы в data/. Ожидаются: "
            "Информация о квартирном фонде…, Книга1.xlsx, "
            "рассрочка и выкупленные…, досрочно выкуп.xlsx, сумма продажи.xlsx"
        )

    stats = ImportStats()
    session = SyncSessionLocal()
    try:
        if reset:
            clear_apartments(session)
            stats.log("Truncated apartments (CASCADE) — demo/test rows removed.")

        stats.log("Workbook discovery:")
        for key, path in books.items():
            stats.log(f"  {key}: {path.name if path else '—'}")

        # 1) Fund summary (cards / KPIs by complex)
        if books["fund"] is not None:
            stats.log(f"Importing fund summary: {books['fund']}")
            import_fund_summary_book(session, books["fund"], stats)
        else:
            stats.log("Fund workbook not found — skipped.")

        # 2) Rent / dorm (Книга1)
        if books["rent"] is not None:
            stats.log(f"Importing rent registry: {books['rent']}")
            import_rent_book(session, books["rent"], stats)
        else:
            stats.log("Rent workbook (Книга1) not found — skipped.")

        # 3) Installment schedules
        if books["installment"] is not None:
            stats.log(f"Importing installment workbook: {books['installment']}")
            import_purchase_book(session, books["installment"], stats)
        else:
            stats.log("Installment workbook not found — skipped.")

        # 4) Early buyout (overrides / marks full_sold)
        if books["early_buyout"] is not None:
            stats.log(f"Importing early buyout: {books['early_buyout']}")
            import_early_buyout_book(session, books["early_buyout"], stats)
        else:
            stats.log("Early buyout workbook not found — skipped.")

        # 5) Sales totals reconciliation
        if books["sales"] is not None:
            stats.log(f"Importing sales totals: {books['sales']}")
            import_sales_totals_book(session, books["sales"], stats)
        else:
            stats.log("Sales totals workbook not found — skipped.")

        rows = session.execute(
            text(
                "SELECT residential_complex_name, COUNT(*) "
                "FROM apartments GROUP BY 1 ORDER BY 1"
            )
        ).all()
        stats.log("Apartments by complex:")
        for name, count in rows:
            stats.log(f"  {name}: {count}")
        total = session.scalar(text("SELECT COUNT(*) FROM apartments")) or 0
        stats.log(
            f"Done. apartments={total}, inserted={stats.inserted}, "
            f"updated={stats.updated}, skipped={stats.skipped}, errors={stats.errors}"
        )
        return stats
    finally:
        session.close()
