"""
Budget Excel reader — reads Аренда.xlsx and рассрочка.xlsx, persists editable rows in DB.
Smart column mapping: auto-detects header row, FIO, Address, Debt, Penalty by regex + content analysis.
"""
from datetime import date, datetime
from decimal import Decimal
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import openpyxl  # noqa: F401 – kept for potential direct openpyxl usage elsewhere
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import require_admin
from app.models.budget_excel_row import BudgetExcelRow
from app.models.budget_excel_source_meta import BudgetExcelSourceMeta
from app.models.housing_department_record import HousingDepartmentRecord
from app.models.rental_financials import RentalFinancials
from app.models.purchase_financials import PurchaseFinancials
from app.models.purchase_payment_schedule import PurchasePaymentSchedule
from app.models.resident import Resident
from app.models.apartment import Apartment
from app.models.user import User
from app.schemas.budget_excel_row import AddBudgetColumnRequest, BudgetExcelRowRead, BudgetExcelRowUpdate

router = APIRouter(prefix="/budget-excel", tags=["budget-excel"])

DATA_DIR = Path("/app/data")
RENT_FILE = DATA_DIR / "Аренда.xlsx"
PURCHASE_FILE = DATA_DIR / "рассрочка и выкупленные общее поступление.xlsx"


# ---------------------------------------------------------------------------
# Cell value normalisation
# ---------------------------------------------------------------------------

def _cell_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val
    return str(val).strip()


# ---------------------------------------------------------------------------
# Smart header-row detection
# ---------------------------------------------------------------------------

_HEADER_KEYWORDS = re.compile(
    r'№|п/п|фио|сотрудник|адрес|жк|договор|дата|сумма|долг|пеня|пени'
    r'|статус|примечание|год|срок|площадь|комнат|улица|дом|квартира|объект'
    r'|протокол|остаток|рассрочк|выкуп|период',
    re.IGNORECASE,
)


def _detect_header_row(df: pd.DataFrame, default_row: int = 0) -> int:
    """Scan the first 15 rows and return the row index most likely to be the header."""
    best_row = default_row
    max_score = -1

    for idx in range(min(15, len(df))):
        row_values = df.iloc[idx].tolist()
        score = 0
        non_empty_count = 0
        for val in row_values:
            if pd.notna(val) and isinstance(val, str):
                val_str = val.strip()
                if val_str:
                    non_empty_count += 1
                    if _HEADER_KEYWORDS.search(val_str):
                        score += 10
                    else:
                        score += 1
        if non_empty_count > 1:
            score += non_empty_count

        if score > max_score:
            max_score = score
            best_row = idx

    return best_row


# ---------------------------------------------------------------------------
# Smart column normalisation
# ---------------------------------------------------------------------------

def _is_fio_like(val: Any) -> bool:
    """Return True if val looks like 'Фамилия Имя [Отчество]'."""
    if not isinstance(val, str):
        return False
    val_clean = val.strip()
    words = val_clean.split()
    if not (2 <= len(words) <= 4):
        return False
    for w in words:
        if not w:
            return False
        # Allow hyphenated parts like Аль-Фараби, Жан-Жак
        parts = w.replace("-", "")
        if not parts:
            return False
        if not w[0].isupper():
            return False
        if not parts.isalpha():
            return False
    return True


def _smart_normalize_headers(all_rows: list[tuple], header_row: int) -> list[str]:
    """
    Build a header list from *header_row* of *all_rows* and apply smart
    renaming so the frontend always finds canonical column names:
      'ФИО', 'Адрес', 'Общий долг', 'Пеня'
    """
    if header_row >= len(all_rows):
        return []

    raw_headers = all_rows[header_row]
    headers: list[str] = []
    for i, h in enumerate(raw_headers):
        if h is not None and str(h).strip():
            headers.append(str(h).strip())
        else:
            headers.append(f"col_{i}")

    # ── 1. FIO detection ────────────────────────────────────────────────────
    fio_idx: int | None = None

    # a) Exact match
    for idx, h in enumerate(headers):
        if h.strip().lower() == "фио":
            fio_idx = idx
            break

    # b) Keyword match in header name
    if fio_idx is None:
        fio_pattern = re.compile(r'ФИО|реализован|сотрудн', re.IGNORECASE)
        for idx, h in enumerate(headers):
            if fio_pattern.search(h):
                fio_idx = idx
                break

    # c) Content-based heuristic – scan first 5 columns for FIO-like values
    if fio_idx is None:
        col_scores = [0] * min(5, len(headers))
        sample_rows = all_rows[header_row + 1: header_row + 51]
        for r in sample_rows:
            for col_idx in range(len(col_scores)):
                if col_idx < len(r) and _is_fio_like(r[col_idx]):
                    col_scores[col_idx] += 1
        max_score = max(col_scores) if col_scores else 0
        if max_score > 2:
            fio_idx = col_scores.index(max_score)

    # ── 2. Address / ЖК detection ────────────────────────────────────────────
    addr_idx: int | None = None
    addr_pattern = re.compile(r'Адрес|ЖК|Жилой\s*комплекс', re.IGNORECASE)
    for idx, h in enumerate(headers):
        # Also match a raw positional fallback 'col_2'
        if h == "col_2" or addr_pattern.search(h):
            addr_idx = idx
            break

    # ── 3. Debt detection (avoid matching penalty columns) ───────────────────
    debt_idx: int | None = None
    debt_pattern = re.compile(r'просроч|долг|задолж|остаток', re.IGNORECASE)
    penalty_word = re.compile(r'пеня|пени', re.IGNORECASE)
    for idx, h in enumerate(headers):
        if debt_pattern.search(h) and not penalty_word.search(h):
            debt_idx = idx
            break

    # ── 4. Penalty detection ─────────────────────────────────────────────────
    penalty_idx: int | None = None
    for idx, h in enumerate(headers):
        if penalty_word.search(h):
            penalty_idx = idx
            break

    # ── Apply canonical renames ───────────────────────────────────────────────
    if fio_idx is not None:
        headers[fio_idx] = "ФИО"
    if addr_idx is not None:
        headers[addr_idx] = "Адрес"
    if debt_idx is not None:
        headers[debt_idx] = "Общий долг"
    if penalty_idx is not None:
        headers[penalty_idx] = "Пеня"

    return headers


# ---------------------------------------------------------------------------
# Row parsing helpers
# ---------------------------------------------------------------------------

def _rows_to_records(all_rows: list[tuple], headers: list[str], header_row: int) -> list[dict]:
    records = []
    for raw in all_rows[header_row + 1:]:
        if all(v is None for v in raw):
            continue
        row_dict: dict[str, Any] = {}
        for i, val in enumerate(raw):
            key = headers[i] if i < len(headers) else f"col_{i}"
            row_dict[key] = _cell_value(val)
        records.append(row_dict)
    return records


def _parse_sheet_rows(all_rows: list[tuple], header_row: int = 0) -> dict[str, Any]:
    if header_row >= len(all_rows):
        return {"headers": [], "rows": []}
    headers = _smart_normalize_headers(all_rows, header_row)
    rows = _rows_to_records(all_rows, headers, header_row)
    return {"headers": headers, "rows": rows}


def _merge_sheet_records(*datasets: dict[str, Any]) -> dict[str, Any]:
    unified_headers: list[str] = []
    seen: set[str] = set()
    for ds in datasets:
        for h in ds.get("headers", []):
            if h not in seen:
                seen.add(h)
                unified_headers.append(h)

    merged_rows: list[dict[str, Any]] = []
    for ds in datasets:
        for row in ds.get("rows", []):
            merged_rows.append({h: row.get(h) for h in unified_headers})

    return {"headers": unified_headers, "rows": merged_rows}


# ---------------------------------------------------------------------------
# Excel loading
# ---------------------------------------------------------------------------

def _xlsx_to_records(path: Path, header_row: int = 0) -> dict[str, Any]:
    """
    Read the FIRST sheet of *path* via pandas (sheet_name=0).
    Auto-detect the header row; then apply smart column normalisation.
    *header_row* is used only as the starting hint for auto-detection.
    """
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Файл не найден: {path.name}")

    try:
        df = pd.read_excel(path, sheet_name=0, header=None)

        # Auto-detect the best header row
        detected_row = _detect_header_row(df, default_row=header_row)

        all_rows: list[tuple] = []
        for row in df.itertuples(index=False):
            clean_row = []
            for val in row:
                if pd.isna(val):
                    clean_row.append(None)
                elif isinstance(val, (np.integer, np.floating)):
                    clean_row.append(val.item())
                else:
                    clean_row.append(val)
            all_rows.append(tuple(clean_row))

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось прочитать файл «{path.name}»: {exc}",
        ) from exc

    return _parse_sheet_rows(all_rows, detected_row)


def _load_excel_source(source: str) -> dict[str, Any]:
    try:
        if source == "rent":
            return _xlsx_to_records(RENT_FILE, header_row=0)
        if source == "purchase":
            return _xlsx_to_records(PURCHASE_FILE, header_row=1)
        raise HTTPException(status_code=400, detail="Unknown source")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка загрузки данных ({source}): {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _headers_from_db_rows(db_rows: list[BudgetExcelRow], custom_headers: list[str] | None = None) -> list[str]:
    seen: set[str] = set()
    headers: list[str] = []
    for item in db_rows:
        for key in item.row_data.keys():
            if key not in seen:
                seen.add(key)
                headers.append(key)
    for key in custom_headers or []:
        if key not in seen:
            seen.add(key)
            headers.append(key)
    return headers


async def _get_or_create_source_meta(db: AsyncSession, source: str) -> BudgetExcelSourceMeta:
    meta = await db.get(BudgetExcelSourceMeta, source)
    if meta is None:
        meta = BudgetExcelSourceMeta(source=source, custom_headers=[])
        db.add(meta)
        await db.flush()
    return meta


async def _ensure_db_rows(db: AsyncSession, source: str) -> list[BudgetExcelRow]:
    result = await db.execute(
        select(BudgetExcelRow)
        .where(BudgetExcelRow.source == source)
        .order_by(BudgetExcelRow.row_index)
    )
    db_rows = list(result.scalars().all())
    if db_rows:
        return db_rows

    try:
        excel = _load_excel_source(source)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось импортировать данные ({source}): {exc}",
        ) from exc

    for index, row in enumerate(excel["rows"]):
        db.add(BudgetExcelRow(source=source, row_index=index, row_data=row))
    await db.commit()

    result = await db.execute(
        select(BudgetExcelRow)
        .where(BudgetExcelRow.source == source)
        .order_by(BudgetExcelRow.row_index)
    )
    return list(result.scalars().all())


async def _get_dataset(db: AsyncSession, source: str) -> dict[str, Any]:
    db_rows = await _ensure_db_rows(db, source)
    meta = await _get_or_create_source_meta(db, source)
    if not db_rows:
        return {"headers": list(meta.custom_headers or []), "rows": []}

    headers = _headers_from_db_rows(db_rows, meta.custom_headers)
    rows = []
    for item in db_rows:
        merged = {h: item.row_data.get(h) for h in headers}
        merged["_id"] = item.id
        rows.append(merged)
    return {"headers": headers, "rows": rows}


async def _add_column(db: AsyncSession, source: str, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название столбца не может быть пустым")

    meta = await _get_or_create_source_meta(db, source)
    headers = list(meta.custom_headers or [])
    if name in headers:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Столбец уже существует")

    headers.append(name)
    meta.custom_headers = headers

    db_rows = await _ensure_db_rows(db, source)
    for item in db_rows:
        data = dict(item.row_data)
        data[name] = None
        item.row_data = data

    await db.flush()
    return await _get_dataset(db, source)


# ---------------------------------------------------------------------------
# Sync helper
# ---------------------------------------------------------------------------

async def _sync_to_housing_department(db: AsyncSession, new_dataset: dict[str, Any], source: str):
    headers = new_dataset.get("headers", [])
    rows = new_dataset.get("rows", [])
    if not rows:
        return

    # Create a Pandas DataFrame from the new rows
    df_new = pd.DataFrame(rows)

    # Detect the FIO column name
    fio_col = next((h for h in headers if "фио" in str(h).lower()), None)
    if not fio_col:
        return

    # Clean/normalize new FIOs for reliable lookup
    df_new[fio_col] = df_new[fio_col].fillna("").astype(str).str.strip()
    df_new = df_new[df_new[fio_col] != ""]
    if df_new.empty:
        return

    # Detect the address column name
    address_col = next((h for h in headers if "адрес" in str(h).lower()), None)
    
    # Detect the amount column name:
    # Rent: "Сумма по полю Себестоимость \nсумма возмещения в месяц удержание из ЗП" or similar
    # Purchase: "Сумма платежа, тенге"
    amount_col = None
    if source == "rent":
        amount_col = next((h for h in headers if any(k in str(h).lower() for k in ("удержан", "возмещен", "себестоимость"))), None)
    else:
        amount_col = next((h for h in headers if any(k in str(h).lower() for k in ("сумма платежа", "остаток задолженоности", "платеж"))), None)

    # Load housing department records
    stmt = select(HousingDepartmentRecord)
    result = await db.execute(stmt)
    housing_records = result.scalars().all()
    if not housing_records:
        return

    # Index by FIO (lowercased, stripped)
    hr_map = {}
    for hr in housing_records:
        if hr.fio:
            clean_fio = " ".join(hr.fio.strip().lower().split())
            hr_map[clean_fio] = hr

    for _, row in df_new.iterrows():
        raw_fio = str(row[fio_col]).strip()
        clean_fio = " ".join(raw_fio.lower().split())
        if clean_fio not in hr_map:
            continue

        hr = hr_map[clean_fio]
        updated = False

        # 1. Address comparison
        if address_col and pd.notna(row[address_col]):
            new_address = str(row[address_col]).strip()
            old_addr_clean = "".join((hr.address or "").lower().split())
            new_addr_clean = "".join(new_address.lower().split())
            if old_addr_clean != new_addr_clean and new_addr_clean:
                hr.address = new_address
                if "зерде" in new_address.lower():
                    hr.residential_complex_name = "ЖК Зерде"
                elif "лазурный" in new_address.lower():
                    hr.residential_complex_name = "ЖК Лазурный квартал"
                elif "нурсая" in new_address.lower():
                    hr.residential_complex_name = "ЖК Нурсая"
                elif "москва" in new_address.lower():
                    hr.residential_complex_name = "ЖК Москва"
                elif "хан тенгри" in new_address.lower() or "хан-тенгри" in new_address.lower():
                    hr.residential_complex_name = "ЖК Хан Тенгри"
                elif "жагалау" in new_address.lower():
                    hr.residential_complex_name = "ЖК Жагалау"
                
                hr.status = "Переселение"
                updated = True

        # 2. Payment Amount comparison
        if amount_col and pd.notna(row[amount_col]):
            try:
                val_str = str(row[amount_col]).replace(" ", "").replace(",", ".")
                new_val = float(val_str) if val_str else 0.0
                old_val = float(hr.reimbursement_cost_monthly or 0.0)
                if abs(old_val - new_val) > 0.01:
                    hr.reimbursement_cost_monthly = new_val
                    if not updated:
                        hr.status = "Смена условий"
                    updated = True
            except ValueError:
                pass

        if updated:
            db.add(hr)

    await db.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    source: str = Form(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, Any]:
    if source not in ("rent", "purchase"):
        raise HTTPException(status_code=400, detail="Unknown source")

    target_path = RENT_FILE if source == "rent" else PURCHASE_FILE

    # Save the uploaded file
    try:
        contents = await file.read()
        target_path.write_bytes(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    # Delete old rows
    result = await db.execute(select(BudgetExcelRow).where(BudgetExcelRow.source == source))
    old_rows = result.scalars().all()
    for row in old_rows:
        await db.delete(row)
    await db.commit()

    # Repopulate
    dataset = await _get_dataset(db, source)

    # Sync to housing department
    await _sync_to_housing_department(db, dataset, source)

    return dataset


@router.get("/rent")
async def get_rent_data(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    return await _get_dataset(db, "rent")


@router.get("/purchase")
async def get_purchase_data(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    return await _get_dataset(db, "purchase")


def _extract_dates_from_string(text: str) -> list[date]:
    if not text:
        return []
    dates = []
    # Match DD.MM.YYYY
    for m in re.finditer(r"(\d{2})\.(\d{2})\.(\d{4})", text):
        try:
            d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            dates.append(d)
        except ValueError:
            pass
    # Match YYYY-MM-DD
    for m in re.finditer(r"(\d{4})-(\d{2})-(\d{2})", text):
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            dates.append(d)
        except ValueError:
            pass
    return dates


@router.get("/analytics/rent")
async def get_rent_analytics(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    dataset = await _get_dataset(db, "rent")
    headers = dataset.get("headers", [])
    rows = dataset.get("rows", [])

    fio_col = next((h for h in headers if "фио" in str(h).lower()), "ФИО")
    address_col = next((h for h in headers if "адрес" in str(h).lower()), "Адрес")
    amount_col = next((h for h in headers if any(k in str(h).lower() for k in ("удержание", "возмещен", "себестоимость"))), None)
    penalty_col = next((h for h in headers if "пеня" in str(h).lower() or "пени" in str(h).lower()), None)
    contract_col = next((h for h in headers if "договор" in str(h).lower()), None)

    today_val = date.today()

    stmt = select(HousingDepartmentRecord)
    result = await db.execute(stmt)
    housing_records = result.scalars().all()
    hr_map = {}
    for hr in housing_records:
        if hr.fio:
            hr_map[" ".join(hr.fio.strip().lower().split())] = hr

    overdue_list = []
    penalty_list = []
    soon_payment_list = []
    relocation_list = []
    contract_expiry_list = []

    for row in rows:
        fio = str(row.get(fio_col) or "Не указан").strip()
        complex_name = str(row.get("Наименование ЖК") or row.get("ЖК") or "Не указан").strip()
        address = str(row.get(address_col) or "Не указан").strip()
        
        clean_fio = " ".join(fio.lower().split())
        hr = hr_map.get(clean_fio)

        actual_deduction = 0.0
        if amount_col and row.get(amount_col) is not None:
            try:
                actual_deduction = float(str(row[amount_col]).replace(" ", "").replace(",", "."))
            except ValueError:
                pass

        normative_payment = float(hr.reimbursement_cost_monthly) if hr and hr.reimbursement_cost_monthly else 0.0

        if actual_deduction <= 0:
            overdue_amount = normative_payment if normative_payment > 0 else 0.0
            if overdue_amount > 0:
                overdue_list.append({
                    "fio": fio,
                    "complex": complex_name,
                    "address": address,
                    "amount": overdue_amount,
                    "source": "Аренда (Удержание <= 0)"
                })
        elif actual_deduction < normative_payment:
            overdue_amount = normative_payment - actual_deduction
            if overdue_amount > 0:
                overdue_list.append({
                    "fio": fio,
                    "complex": complex_name,
                    "address": address,
                    "amount": overdue_amount,
                    "source": "Аренда (Недоплата)"
                })

        penalty_amount = 0.0
        if penalty_col and row.get(penalty_col) is not None:
            try:
                penalty_amount = float(str(row[penalty_col]).replace(" ", "").replace(",", "."))
            except ValueError:
                pass
        if penalty_amount > 0:
            penalty_list.append({
                "fio": fio,
                "complex": complex_name,
                "address": address,
                "amount": penalty_amount,
                "source": "Аренда"
            })

        contract_text = str(row.get(contract_col) or "")
        dates_found = _extract_dates_from_string(contract_text)
        if not dates_found and hr and hr.rental_contract:
            dates_found = _extract_dates_from_string(hr.rental_contract)

        payment_day = None
        if dates_found:
            payment_day = dates_found[0].day

        if payment_day:
            try:
                next_payment = date(today_val.year, today_val.month, payment_day)
                if next_payment < today_val:
                    m = today_val.month + 1
                    y = today_val.year
                    if m > 12:
                        m = 1
                        y += 1
                    next_payment = date(y, m, payment_day)
                diff_days = (next_payment - today_val).days
                if 0 <= diff_days <= 3:
                    soon_payment_list.append({
                        "fio": fio,
                        "complex": complex_name,
                        "address": address,
                        "daysLeft": diff_days,
                        "paymentDay": payment_day,
                        "amount": f"{normative_payment:,.2f} ₸" if normative_payment > 0 else "—",
                        "source": "Аренда"
                    })
            except Exception:
                pass

        if dates_found:
            try:
                start_date = dates_found[0]
                m_end = start_date.month + 11
                y_end = start_date.year
                while m_end > 12:
                    m_end -= 12
                    y_end += 1
                try:
                    exp_date = date(y_end, m_end, start_date.day)
                except ValueError:
                    import calendar
                    last_day = calendar.monthrange(y_end, m_end)[1]
                    exp_date = date(y_end, m_end, last_day)

                diff_days = (exp_date - today_val).days
                if diff_days <= 15:
                    contract_expiry_list.append({
                        "fio": fio,
                        "complex": complex_name,
                        "address": address,
                        "expDate": exp_date.strftime("%d.%m.%Y"),
                        "daysLeft": diff_days,
                        "source": "Аренда"
                    })
            except Exception:
                pass

    for hr in housing_records:
        if hr.status in ("Переселение", "Смена условий"):
            relocation_list.append({
                "fio": hr.fio or "Не указан",
                "complex": hr.residential_complex_name or "Не указан",
                "address": hr.address or "Не указан",
                "status": hr.status,
                "details": hr.occupancy_and_purchase_basis or "Переселение / Смена условий",
                "amount": f"{hr.reimbursement_cost_monthly:,.2f} ₸" if hr.reimbursement_cost_monthly else "—",
                "source": "База ДЖСВ"
            })

    overdue_list.sort(key=lambda x: x["amount"], reverse=True)
    penalty_list.sort(key=lambda x: x["amount"], reverse=True)
    soon_payment_list.sort(key=lambda x: x["daysLeft"])
    contract_expiry_list.sort(key=lambda x: x["daysLeft"])

    return {
        "overdueList": overdue_list,
        "penaltyList": penalty_list,
        "soonPaymentList": soon_payment_list,
        "relocationList": relocation_list,
        "contractExpiryList": contract_expiry_list
    }


@router.get("/analytics/purchase")
async def get_purchase_analytics(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    dataset = await _get_dataset(db, "purchase")
    headers = dataset.get("headers", [])
    rows = dataset.get("rows", [])

    fio_col = next((h for h in headers if "фио" in str(h).lower()), "ФИО")
    address_col = next((h for h in headers if "адрес" in str(h).lower()), "Адрес")
    debt_col = next((h for h in headers if "общий долг" in str(h).lower() or "остаток" in str(h).lower()), None)
    penalty_col = next((h for h in headers if "пеня" in str(h).lower() or "пени" in str(h).lower()), None)
    contract_col = next((h for h in headers if "договор" in str(h).lower()), None)

    today_val = date.today()
    current_year = today_val.year
    current_month = today_val.month

    mandatory_col = next((h for h in headers if "сумма платежа" in str(h).lower() or "обязательный платеж" in str(h).lower()), None)
    actual_col = None
    for h in headers:
        h_lower = str(h).lower()
        if "текущ" in h_lower or "фактически оплачено" in h_lower or "факт платежа за текущий" in h_lower:
            actual_col = h
            break
    if not actual_col:
        actual_col = next((h for h in headers if "факт" in str(h).lower() and str(current_year) in str(h).lower()), None)

    stmt = select(HousingDepartmentRecord)
    result = await db.execute(stmt)
    housing_records = result.scalars().all()
    hr_map = {}
    for hr in housing_records:
        if hr.fio:
            hr_map[" ".join(hr.fio.strip().lower().split())] = hr

    stmt_sched = (
        select(PurchasePaymentSchedule, Resident.full_name, Apartment.residential_complex_name, Apartment.address)
        .join(Apartment, Apartment.id == PurchasePaymentSchedule.apartment_id)
        .join(PurchaseFinancials, PurchaseFinancials.id == PurchasePaymentSchedule.purchase_financials_id, isouter=True)
        .join(Resident, Resident.id == PurchaseFinancials.resident_id, isouter=True)
        .where(PurchasePaymentSchedule.year == current_year)
        .where(PurchasePaymentSchedule.month <= current_month)
    )
    sched_result = await db.execute(stmt_sched)
    schedules = sched_result.all()

    schedule_overdue = {}
    for sched, resident_fio, complex_name, addr in schedules:
        if not resident_fio:
            continue
        due = sched.amount_due or 0.0
        paid = sched.amount_paid or 0.0
        if paid < due:
            clean_fio = " ".join(resident_fio.strip().lower().split())
            diff = due - paid
            if clean_fio in schedule_overdue:
                schedule_overdue[clean_fio]["amount"] += diff
            else:
                schedule_overdue[clean_fio] = {
                    "fio": resident_fio,
                    "complex": complex_name or "Не указан",
                    "address": addr or "Не указан",
                    "amount": diff,
                    "source": "График"
                }

    overdue_list = []
    penalty_list = []
    soon_payment_list = []
    relocation_list = []
    debt_total = 0.0

    for row in rows:
        fio = str(row.get(fio_col) or "Не указан").strip()
        complex_name = str(row.get("Наименование ЖК") or row.get("ЖК") or "Не указан").strip()
        address = str(row.get(address_col) or "Не указан").strip()
        clean_fio = " ".join(fio.lower().split())
        hr = hr_map.get(clean_fio)

        rem_debt = 0.0
        if debt_col and row.get(debt_col) is not None:
            try:
                rem_debt = float(str(row[debt_col]).replace(" ", "").replace(",", "."))
            except ValueError:
                pass
        debt_total += rem_debt

        mandatory_val = 0.0
        if mandatory_col and row.get(mandatory_col) is not None:
            try:
                mandatory_val = float(str(row[mandatory_col]).replace(" ", "").replace(",", "."))
            except ValueError:
                pass

        actual_val = 0.0
        if actual_col and row.get(actual_col) is not None:
            try:
                actual_val = float(str(row[actual_col]).replace(" ", "").replace(",", "."))
            except ValueError:
                pass

        overdue_amt = 0.0
        is_overdue = False
        source_label = ""

        # Compare mandatory payment vs actual payment for current month
        excel_diff = mandatory_val - actual_val
        if excel_diff > 0:
            overdue_amt = excel_diff
            is_overdue = True
            source_label = "Выкуп (Недоплата)"
        elif clean_fio in schedule_overdue:
            overdue_amt = schedule_overdue[clean_fio]["amount"]
            is_overdue = True
            source_label = "График платежей"
        else:
            overdue_col = next((h for h in headers if "просроч" in str(h).lower()), None)
            if overdue_col and row.get(overdue_col) is not None:
                try:
                    overdue_amt = float(str(row[overdue_col]).replace(" ", "").replace(",", "."))
                    if overdue_amt > 0:
                        is_overdue = True
                        source_label = "Выкуп (Spreadsheet)"
                except ValueError:
                    pass

        if is_overdue and overdue_amt > 0:
            overdue_list.append({
                "fio": fio,
                "complex": complex_name,
                "address": address,
                "amount": overdue_amt,
                "source": source_label
            })

        penalty_amt = 0.0
        if penalty_col and row.get(penalty_col) is not None:
            try:
                penalty_amt = float(str(row[penalty_col]).replace(" ", "").replace(",", "."))
            except ValueError:
                pass
        if penalty_amt > 0:
            penalty_list.append({
                "fio": fio,
                "complex": complex_name,
                "address": address,
                "amount": penalty_amt,
                "source": "Выкупленные"
            })

        contract_text = str(row.get(contract_col) or "")
        dates_found = _extract_dates_from_string(contract_text)
        buy_date_col = next((h for h in headers if "покупки" in str(h).lower()), None)
        if buy_date_col and row.get(buy_date_col):
            dates_found += _extract_dates_from_string(str(row[buy_date_col]))

        payment_day = None
        if dates_found:
            payment_day = dates_found[0].day

        if payment_day:
            try:
                next_payment = date(today_val.year, today_val.month, payment_day)
                if next_payment < today_val:
                    m = today_val.month + 1
                    y = today_val.year
                    if m > 12:
                        m = 1
                        y += 1
                    next_payment = date(y, m, payment_day)
                diff_days = (next_payment - today_val).days
                if 0 <= diff_days <= 3:
                    monthly_val = 0.0
                    monthly_col = next((h for h in headers if "ежемесяч" in str(h).lower() or "сумма платежа" in str(h).lower()), None)
                    if monthly_col and row.get(monthly_col) is not None:
                        try:
                            monthly_val = float(str(row[monthly_col]).replace(" ", "").replace(",", "."))
                        except ValueError:
                            pass
                    soon_payment_list.append({
                        "fio": fio,
                        "complex": complex_name,
                        "address": address,
                        "daysLeft": diff_days,
                        "paymentDay": payment_day,
                        "amount": f"{monthly_val:,.2f} ₸" if monthly_val > 0 else "—",
                        "source": "Выкупленные"
                    })
            except Exception:
                pass

    for hr in housing_records:
        if hr.status in ("Переселение", "Смена условий"):
            relocation_list.append({
                "fio": hr.fio or "Не указан",
                "complex": hr.residential_complex_name or "Не указан",
                "address": hr.address or "Не указан",
                "status": hr.status,
                "details": hr.occupancy_and_purchase_basis or "Переселение / Смена условий",
                "amount": f"{hr.reimbursement_cost_monthly:,.2f} ₸" if hr.reimbursement_cost_monthly else "—",
                "source": "База ДЖСВ"
            })

    overdue_list.sort(key=lambda x: x["amount"], reverse=True)
    penalty_list.sort(key=lambda x: x["amount"], reverse=True)
    soon_payment_list.sort(key=lambda x: x["daysLeft"])

    return {
        "overdueList": overdue_list,
        "penaltyList": penalty_list,
        "soonPaymentList": soon_payment_list,
        "relocationList": relocation_list,
        "debtTotal": debt_total
    }


@router.patch("/rent/{row_id}", response_model=BudgetExcelRowRead)
async def update_rent_row(
    row_id: int,
    body: BudgetExcelRowUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> BudgetExcelRowRead:
    return await _update_row(db, "rent", row_id, body)


@router.patch("/purchase/{row_id}", response_model=BudgetExcelRowRead)
async def update_purchase_row(
    row_id: int,
    body: BudgetExcelRowUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> BudgetExcelRowRead:
    return await _update_row(db, "purchase", row_id, body)


@router.post("/rent/columns")
async def add_rent_column(
    body: AddBudgetColumnRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, Any]:
    return await _add_column(db, "rent", body.name)


@router.post("/purchase/columns")
async def add_purchase_column(
    body: AddBudgetColumnRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, Any]:
    return await _add_column(db, "purchase", body.name)


async def _update_row(
    db: AsyncSession,
    source: str,
    row_id: int,
    body: BudgetExcelRowUpdate,
) -> BudgetExcelRowRead:
    row = await db.get(BudgetExcelRow, row_id)
    if not row or row.source != source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    meta = await _get_or_create_source_meta(db, source)
    header_set = set(row.row_data.keys()) | set(body.data.keys()) | set(meta.custom_headers or [])
    headers = list(header_set)
    clean_data = {h: body.data.get(h, row.row_data.get(h)) for h in headers}
    row.row_data = clean_data
    await db.flush()
    await db.refresh(row)
    return BudgetExcelRowRead(id=row.id, data=row.row_data)
