from __future__ import annotations

from datetime import date, datetime
import calendar
from pathlib import Path
from typing import Optional

import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.apartment import Apartment
from app.models.erc_invoices import ERCInvoice
from app.models.resident import Resident
from app.schemas.erc_invoices import ERCInvoiceListItem, ERCInvoiceOverdueItem, ERCInvoiceUploadResponse
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/erc-invoices", tags=["erc-invoices"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_BYTES = 10 * 1024 * 1024


def _safe_period(period: str) -> str:
    # Expect YYYY-MM
    p = str(period).strip()
    if len(p) != 7 or p[4] != "-":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный формат периода")
    return p


def _parse_period_yyyy_mm(period: str) -> tuple[int, int]:
    p = _safe_period(period)
    y = int(p[:4])
    m = int(p[5:7])
    if m < 1 or m > 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный месяц в периоде")
    return y, m


MONTHS_RU = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
]


def _month_diff_yyyy_mm(from_period: str, to_period: str) -> int:
    """Number of months from from_period to to_period (to - from)."""
    fy, fm = _parse_period_yyyy_mm(from_period)
    ty, tm = _parse_period_yyyy_mm(to_period)
    return (ty - fy) * 12 + (tm - fm)


def _month_iter(from_period_inclusive: str, to_period_inclusive: str) -> list[str]:
    fy, fm = _parse_period_yyyy_mm(from_period_inclusive)
    ty, tm = _parse_period_yyyy_mm(to_period_inclusive)
    total = (ty - fy) * 12 + (tm - fm)
    out: list[str] = []
    for i in range(total + 1):
        y = fy + (fm - 1 + i) // 12
        m = (fm - 1 + i) % 12 + 1
        out.append(f"{y:04d}-{m:02d}")
    return out


def _month_label(period: str) -> str:
    y, m = _parse_period_yyyy_mm(period)
    return f"{MONTHS_RU[m-1]} {y}"


def _safe_name(name: str) -> str:
    base = Path(name).name
    return base.replace("..", "_")[:500] or "file"


def _validate_upload(file: UploadFile) -> None:
    filename = getattr(file, "filename", None) or ""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Допустимы только PDF, JPG, JPEG, PNG.",
        )


async def _save_upload(file: UploadFile, dest_dir: Path) -> tuple[str, str]:
    _validate_upload(file)
    original = _safe_name(file.filename or "upload")
    unique = f"{uuid.uuid4().hex}_{original}"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / unique
    size = 0
    try:
        with dest_path.open("wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Файл слишком большой (макс. 10 МБ).",
                    )
                buffer.write(chunk)
    finally:
        await file.close()

    rel = str(dest_path.relative_to(settings.upload_path))
    return rel, original


def _get_due_day(apartment: Apartment) -> int:
    # Default per requirement example: 10
    if apartment.payment_due_day is not None:
        try:
            return int(apartment.payment_due_day)
        except Exception:
            pass
    return 10


def _get_monthly_payment(apartment: Apartment) -> float:
    return float(apartment.monthly_deduction or 0.0)


def _days_overdue(current_day: int, due_day: int) -> int:
    # Strictly "current day > due_day" (per requirement)
    if current_day <= due_day:
        return 0
    return current_day - due_day


def _compute_penalty(monthly_payment: float, days_overdue: int) -> float:
    # 0.01% per day => 0.0001 * monthly_payment * days
    return float(monthly_payment) * 0.0001 * float(days_overdue)


async def _active_resident_for_apartment(apartment: Apartment) -> Resident | None:
    # apartment.residents is already loaded (selectinload)
    for r in apartment.residents:
        if r.is_active:
            return r
    return None


@router.get("/invoices", response_model=list[ERCInvoiceListItem])
async def list_invoices(
    period: str = Query(..., description="YYYY-MM"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[ERCInvoiceListItem]:
    # NOTE: we don't use current_user here; main.py already adds auth dependency for this router.
    p = _safe_period(period)
    today = date.today()
    current_day = today.day

    # Create missing invoices on 12th day and later
    create_missing = current_day >= 12

    # Show ALL apartments that have at least one active resident
    stmt = (
        select(Apartment)
        .options(selectinload(Apartment.residents))
    )
    all_apartments = (await db.execute(stmt)).scalars().all()
    apartments = [a for a in all_apartments if any(r.is_active for r in a.residents)]

    result: list[ERCInvoiceListItem] = []

    for apt in apartments:
        monthly_payment = _get_monthly_payment(apt)
        due_day = _get_due_day(apt)

        resident = await _active_resident_for_apartment(apt)
        resident_id = resident.id if resident else None

        inv = await db.scalar(select(ERCInvoice).where(ERCInvoice.apartment_id == apt.id, ERCInvoice.period == p))
        if inv is None:
            if not create_missing:
                continue
            inv = ERCInvoice(
                apartment_id=apt.id,
                resident_id=resident_id,
                period=p,
                due_day=due_day,
                monthly_payment=monthly_payment,
                penalty_amount=0.0,
                total_due=monthly_payment,
                status="pending",
            )
            db.add(inv)
            await db.flush()

        # Refresh resident link if it wasn't set earlier (best-effort)
        if inv.resident_id is None and resident_id is not None:
            inv.resident_id = resident_id

        # Recompute penalty/total with current day (for overdue display)
        effective_due_day = inv.due_day if inv.due_day is not None else due_day
        effective_monthly_payment = float(inv.monthly_payment or monthly_payment)
        days = _days_overdue(current_day, effective_due_day)
        penalty = _compute_penalty(effective_monthly_payment, days) if days > 0 else 0.0
        total_due = effective_monthly_payment + penalty

        inv.due_day = effective_due_day
        inv.monthly_payment = effective_monthly_payment
        inv.penalty_amount = penalty
        inv.total_due = total_due

        employee = resident.full_name if resident else (None)
        department = resident.department if resident else None

        housing_type = apt.apartment_subtype.value if hasattr(apt.apartment_subtype, "value") else str(apt.apartment_subtype)

        if search:
            s = str(search).strip().lower()
            hay = f"{employee or ''} {department or ''} {apt.personal_account or ''} {apt.apartment_number or ''}"
            if s not in hay.lower():
                continue

        result.append(
            ERCInvoiceListItem(
                id=inv.id,
                period=inv.period,
                apartment_number=apt.apartment_number,
                house_number=apt.house_number,
                personal_account=apt.personal_account,
                employee=employee,
                department=department,
                housing_type=housing_type,
                due_day=effective_due_day,
                monthly_payment=effective_monthly_payment,
                penalty_amount=penalty,
                total_due=total_due,
                days_overdue=days,
                status=inv.status,
                uploaded_file_name=inv.uploaded_file_name,
                uploaded_file_path=inv.uploaded_file_path,
                uploaded_at=inv.uploaded_at,
                paid_at=inv.paid_at,
            )
        )

    await db.commit()
    return result


@router.get("/overdue", response_model=list[ERCInvoiceOverdueItem])
async def list_overdue(
    period: str = Query(..., description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
) -> list[ERCInvoiceOverdueItem]:
    _ = _safe_period(period)  # kept for signature compatibility; calculations use today's month
    today = date.today()
    current_period = f"{today.year}-{today.month:02d}"
    current_day = today.day

    stmt = select(Apartment).options(selectinload(Apartment.residents))
    all_apartments = (await db.execute(stmt)).scalars().all()
    apartments = [a for a in all_apartments if any(r.is_active for r in a.residents)]

    overdue_items: list[ERCInvoiceOverdueItem] = []

    for apt in apartments:
        monthly_payment = _get_monthly_payment(apt)
        if monthly_payment <= 0:
            continue

        resident = await _active_resident_for_apartment(apt)
        if resident is None:
            continue

        due_day = _get_due_day(apt)

        # Manual / stored last paid month (YYYY-MM). If missing -> no overdue in this simplified logic.
        last_paid_month = resident.last_paid_month
        if not last_paid_month:
            # Fallback: derive from last uploaded/paid invoice periods
            last_inv = await db.scalar(
                select(ERCInvoice.period)
                .where(
                    ERCInvoice.apartment_id == apt.id,
                    ERCInvoice.status == "paid",
                    ERCInvoice.period <= current_period,
                )
                .order_by(ERCInvoice.period.desc())
                .limit(1)
            )
            last_paid_month = last_inv
        if not last_paid_month:
            continue

        unpaid_months = _month_diff_yyyy_mm(last_paid_month, current_period)
        if unpaid_months <= 0:
            continue

        # Days overdue from due date of last paid month to today
        last_paid_year, last_paid_mon = _parse_period_yyyy_mm(last_paid_month)
        last_paid_due_date = date(
            last_paid_year,
            last_paid_mon,
            min(max(due_day, 1), calendar.monthrange(last_paid_year, last_paid_mon)[1]),
        )
        days_overdue = (today - last_paid_due_date).days
        if days_overdue < 0:
            days_overdue = 0

        main_debt = float(monthly_payment) * float(unpaid_months)
        penalty = float(main_debt) * 0.0001 * float(days_overdue)
        total_due = float(main_debt) + float(penalty)

        # Make sure invoice row exists for current period so we can upload receipt against it.
        inv = await db.scalar(
            select(ERCInvoice).where(ERCInvoice.apartment_id == apt.id, ERCInvoice.period == current_period)
        )
        if inv is None:
            inv = ERCInvoice(
                apartment_id=apt.id,
                resident_id=resident.id,
                period=current_period,
                due_day=due_day,
                monthly_payment=monthly_payment,
                penalty_amount=0.0,
                total_due=monthly_payment,
                status="pending",
            )
            db.add(inv)
            await db.flush()

        inv.due_day = due_day
        inv.monthly_payment = monthly_payment
        inv.penalty_amount = penalty
        inv.total_due = total_due
        inv.status = "pending" if inv.status != "paid" else inv.status

        # Build label for overdue months
        # Unpaid months are from (last_paid_month+1) ... current_period
        months_list = _month_iter(last_paid_month, current_period)
        # Remove last paid month itself
        months_unpaid = months_list[1:] if len(months_list) > 1 else []
        debt_period_label = f"{unpaid_months} мес.: " + ", ".join([_month_label(m) for m in months_unpaid]) if months_unpaid else None

        overdue_items.append(
            ERCInvoiceOverdueItem(
                id=inv.id,
                period=current_period,
                apartment_number=apt.apartment_number,
                house_number=apt.house_number,
                personal_account=apt.personal_account,
                employee=resident.full_name,
                department=resident.department,
                due_day=due_day,
                monthly_payment=monthly_payment,
                main_debt=main_debt,
                days_overdue=days_overdue,
                penalty_amount=penalty,
                total_due=total_due,
                debt_period_label=debt_period_label,
                uploaded_file_name=inv.uploaded_file_name,
                uploaded_file_path=inv.uploaded_file_path,
                status=inv.status,
            )
        )

    await db.commit()
    return overdue_items


@router.post("/invoices/upload", response_model=ERCInvoiceUploadResponse)
async def upload_invoice_receipt(
    invoice_id: int = Query(...),
    receipt: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ERCInvoiceUploadResponse:
    inv = await db.get(ERCInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Счёт не найден")

    dest_dir = settings.upload_path / "erc_invoices" / inv.period
    rel, original = await _save_upload(receipt, dest_dir)

    today = datetime.utcnow()
    # Recompute penalty based on current date
    due_day = inv.due_day or 10
    current_day = date.today().day
    days = _days_overdue(current_day, int(due_day))
    monthly_payment = float(inv.monthly_payment or 0.0)
    penalty = _compute_penalty(monthly_payment, days) if days > 0 else 0.0
    total_due = monthly_payment + penalty

    inv.uploaded_file_path = rel
    inv.uploaded_file_name = original
    inv.uploaded_at = datetime.utcnow()
    inv.status = "paid"
    inv.paid_at = today
    inv.penalty_amount = penalty
    inv.total_due = total_due

    # Auto-clear overdue: last paid month for calculations
    if inv.resident_id is not None:
        res = await db.get(Resident, inv.resident_id)
        if res:
            res.last_paid_month = inv.period

    await db.flush()

    # Optional audit: main.py already enforces auth via dependency.
    # If you later need exact `changed_by_user_id`, we can wire get_current_user here.
    try:
        await write_audit_log(
            db,
            user=None,
            action="upload_erc_receipt",
            entity_type="erc_invoice",
            entity_id=inv.id,
            new_value={
                "invoice_id": inv.id,
                "period": inv.period,
                "uploaded_file_name": inv.uploaded_file_name,
                "status": inv.status,
            },
        )
    except Exception:
        pass

    await db.commit()
    return ERCInvoiceUploadResponse(invoice_id=inv.id, ok=True)


@router.patch("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: int,
    monthly_payment: float = Query(..., description="New ERC amount"),
    db: AsyncSession = Depends(get_db),
):
    inv = await db.get(ERCInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Счёт не найден")
    inv.monthly_payment = monthly_payment
    today = date.today()
    due_day = inv.due_day or 10
    days = _days_overdue(today.day, int(due_day))
    penalty = _compute_penalty(monthly_payment, days) if days > 0 else 0.0
    inv.penalty_amount = penalty
    inv.total_due = monthly_payment + penalty
    await db.flush()
    await db.commit()
    return {"ok": True, "invoice_id": inv.id, "monthly_payment": float(inv.monthly_payment)}

