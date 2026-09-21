from collections import defaultdict
from datetime import date
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.data.canonical_complexes import CANONICAL_COMPLEXES, CANONICAL_COMPLEX_NAMES, normalize_complex_name
from app.data.document_checklist import slots_for_status
from app.db.session import get_db
from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.document import Document
from app.models.enums import ApartmentSubtype
from app.models.housing_complex import HousingComplex
from app.models.resident import Resident
from app.models.housing_sales_receipt import HousingSalesReceipt
from app.schemas.housing_fund import (
    ApartmentCardItem,
    ApartmentDetailCard,
    ChecklistDocumentFile,
    ChecklistSlotItem,
    ComplexSummaryCard,
    CurrentResidentBrief,
    DocumentChecklistResponse,
    ExcelControlTotals,
    HousingFundAnalytics,
    HousingFundMetrics,
    OccupantCard,
    ResidenceHistoryItem,
    RoomGroup,
    YearSeriesPoint,
)

router = APIRouter(prefix="/housing-fund", tags=["housing-fund"])

GUEST_FUND_COMPLEX = "Лазурный квартал"


def _receipt_amount(rows: dict[str, float], *labels: str) -> float:
    for label in labels:
        if label in rows:
            return float(rows[label] or 0)
    return 0.0


@router.get("/excel-controls", response_model=ExcelControlTotals)
async def get_excel_control_totals(db: AsyncSession = Depends(get_db)) -> ExcelControlTotals:
    """Контрольные итоги из Excel (поступления, досрочный выкуп, рассрочка, свод фонда)."""
    result = await db.execute(select(HousingSalesReceipt))
    rows = {r.source_label: float(r.amount or 0) for r in result.scalars().all()}
    return ExcelControlTotals(
        sales_2019_2025=_receipt_amount(rows, "факт_2019_2025"),
        sales_2026=_receipt_amount(rows, "факт_2026"),
        sales_2026_plus_remainder=_receipt_amount(rows, "факт_2026_плюс_остаток"),
        modernization_2025=_receipt_amount(rows, "затраты_модернизация_2025"),
        remainder_after_modernization=_receipt_amount(rows, "остаток_после_модернизации"),
        early_count=int(_receipt_amount(rows, "control_early_count")),
        early_initial_cost=_receipt_amount(rows, "control_early_initial_cost"),
        early_balance_cost=_receipt_amount(rows, "control_early_balance_cost"),
        early_valuation_cost=_receipt_amount(rows, "control_early_valuation_cost"),
        installment_count=int(_receipt_amount(rows, "control_installment_count")),
        installment_initial_cost=_receipt_amount(rows, "control_installment_initial_cost"),
        installment_initial_payment=_receipt_amount(rows, "control_installment_initial_payment"),
        installment_monthly=_receipt_amount(rows, "control_installment_monthly"),
        fund_total=int(_receipt_amount(rows, "control_fund_total")),
        fund_not_for_sale=int(_receipt_amount(rows, "control_fund_not_for_sale")),
        fund_for_sale=int(_receipt_amount(rows, "control_fund_for_sale")),
        fund_rent=int(_receipt_amount(rows, "control_fund_rent")),
        fund_guest=int(_receipt_amount(rows, "control_fund_guest")),
    )


def _normalize_complex_name(raw: str | None) -> str | None:
    return normalize_complex_name(raw)


def _strip_apartment_from_address(raw: str | None) -> str:
    """Remove flat numbers like «кв. 478» / trailing «- 19» from ЖК card address."""
    text = (raw or "").strip()
    if not text:
        return ""
    text = re.sub(r"(?i)(?:,?\s*)?(?:кв\.?|квартира)\s*[0-9A-Za-zА-Яа-я/\-]+", "", text)
    text = re.sub(r"\s*[-–—]\s*\d+[A-Za-zА-Яа-я]?\s*$", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip(" ,;")
    return text


def _complex_card_location(*, district: str | None, address: str | None) -> tuple[str | None, str]:
    """Return (district, display_line) for ЖК cards — district/street only."""
    clean_addr = _strip_apartment_from_address(address)
    
    # Strip any district names from the address to avoid duplication
    if district and clean_addr:
        districts_to_strip = [
            district,
            "Есильский район", "Есильский",
            "Алматинский район", "Алматинский",
            "Сарыаркинский район", "Сарыаркинский",
            "Нуринский район", "Нуринский", "район Нура",
            "Байконурский район", "Байконурский", "район Байконур",
            "Сарайшыкский район", "Сарайшыкский", "район Сарайшык", "Сарайшык",
            "Алматы район",
        ]
        for d in districts_to_strip:
            pattern = re.compile(rf"(?i)\b{re.escape(d)}\b(?:,?\s*)?")
            clean_addr = pattern.sub("", clean_addr)
        clean_addr = clean_addr.strip(" ,;")
        
    return district, clean_addr or "Адрес не указан"


def _is_guest_fund_complex(complex_name: str | None) -> bool:
    return (_normalize_complex_name(complex_name) or complex_name) == GUEST_FUND_COMPLEX


def _fund_category_for_apartment(apartment: Apartment) -> str:
    """Fund category from document / subtype — independent of occupancy."""
    subtype = apartment.apartment_subtype
    if subtype == ApartmentSubtype.full_sold:
        return "sold"
    if subtype == ApartmentSubtype.installment:
        return "installment"
    if subtype in {ApartmentSubtype.guest, ApartmentSubtype.guest_gph}:
        if _is_guest_fund_complex(apartment.residential_complex_name):
            return "guest"
        return "rent"
    if subtype == ApartmentSubtype.rent:
        return "rent"
    return "rent"


def _status_label_for_category(apartment: Apartment, category: str) -> str:
    if category == "sold":
        if apartment.residential_complex_name == "Жагалау-3":
            return "🔴 Выкуп (100%)"
        return "🔴 Выкуп"
    if category == "installment":
        return "🔵 Рассрочка"
    if category == "guest":
        return "🟣 Гостевая"
    if category == "rent":
        if apartment.residential_complex_name == "Жагалау-3" and apartment.apartment_number in ("43", "44"):
            return "🟡 Общежитие"
        return "🟡 Аренда"
    return "🟢 Свободно"


def _status_for_apartment(apartment: Apartment, has_active_resident: bool) -> tuple[str, str]:
    """Return (fund category key, display label). Empty rent/guest units keep their category."""
    category = _fund_category_for_apartment(apartment)
    is_empty = not has_active_resident

    if is_empty and category not in {"sold", "installment", "guest", "rent"}:
        return "free", "🟢 Свободно"

    return category, _status_label_for_category(apartment, category)


def _active_resident(apartment: Apartment) -> Resident | None:
    active = [r for r in apartment.residents if r.is_active]
    if not active:
        return None
    active.sort(key=lambda r: r.move_in_date or r.created_at.date(), reverse=True)
    return active[0]


def _vacancy_note(apartment: Apartment) -> str | None:
    if _active_resident(apartment) is not None:
        return None
    notes: list[str] = []
    for resident in apartment.residents:
        if not resident.is_active and resident.note:
            notes.append(resident.note.strip())
    for rental in getattr(apartment, "rental_financials", []):
        if rental.note:
            notes.append(str(rental.note).strip())
    return notes[0] if notes else None


def _payment_info(resident: Resident) -> tuple[str | None, float | None, float | None, str | None, float | None, float | None]:
    purchase = next((p for p in resident.purchase_financials if p.is_current), None)
    if purchase is None and resident.purchase_financials:
        purchase = resident.purchase_financials[0]
    rental = next((r for r in resident.rental_financials if r.is_current), None)
    if rental is None and resident.rental_financials:
        rental = resident.rental_financials[0]

    if purchase is not None:
        remaining = float(purchase.remaining_debt) if purchase.remaining_debt is not None else None
        monthly = float(purchase.monthly_payment) if purchase.monthly_payment is not None else None
        initial_payment = float(purchase.initial_payment) if purchase.initial_payment is not None else None
        initial_cost = float(purchase.initial_cost) if purchase.initial_cost is not None else None
        status = "Оплачено" if remaining == 0 else "Рассрочка / долг"
        return status, monthly, remaining, purchase.purchase_contract, initial_payment, initial_cost

    if rental is not None:
        monthly = float(rental.reimbursement_cost_monthly) if rental.reimbursement_cost_monthly is not None else None
        status = rental.contract_status or "Активен"
        return status, monthly, None, rental.rental_contract_number, None, None

    return None, None, None, None, None, None


def _to_card(apartment: Apartment) -> ApartmentCardItem:
    current = _active_resident(apartment)
    is_empty = current is None
    status_key, status_label = _status_for_apartment(apartment, not is_empty)
    occupants_count = sum(1 for r in apartment.residents if r.is_active)
    monthly_payment = None
    initial_payment = None
    initial_cost = None
    contract_end_date = None
    last_paid_month = None
    if current is not None:
        _, monthly_payment, _, _, initial_payment, initial_cost = _payment_info(current)
        contract_end_date = getattr(current, "contract_end_date", None)
        last_paid_month = getattr(current, "last_paid_month", None)
    # Fallback: apartment-level purchase/rental without linking via resident
    if monthly_payment is None or (initial_payment is None and initial_cost is None):
        purchase = next((p for p in getattr(apartment, "purchase_financials", []) if p.is_current), None)
        if purchase is None and getattr(apartment, "purchase_financials", None):
            purchase = apartment.purchase_financials[0] if apartment.purchase_financials else None
        if purchase is not None:
            if monthly_payment is None and purchase.monthly_payment is not None:
                monthly_payment = float(purchase.monthly_payment)
            if initial_payment is None and purchase.initial_payment is not None:
                initial_payment = float(purchase.initial_payment)
            if initial_cost is None and purchase.initial_cost is not None:
                initial_cost = float(purchase.initial_cost)
        rental = next((r for r in getattr(apartment, "rental_financials", []) if r.is_current), None)
        if rental is None and getattr(apartment, "rental_financials", None):
            rental = apartment.rental_financials[0] if apartment.rental_financials else None
        if rental is not None and monthly_payment is None and rental.reimbursement_cost_monthly is not None:
            monthly_payment = float(rental.reimbursement_cost_monthly)

    return ApartmentCardItem(
        id=apartment.id,
        residential_complex_name=apartment.residential_complex_name,
        address=apartment.address,
        apartment_number=apartment.apartment_number,
        house_number=apartment.house_number,
        room_count=apartment.room_count,
        total_area=float(apartment.total_area) if apartment.total_area is not None else None,
        status_key=status_key,
        status_label=status_label,
        is_empty=is_empty,
        occupancy_status="empty" if is_empty else "occupied",
        vacancy_note=_vacancy_note(apartment) if is_empty else None,
        current_resident_name=current.full_name if current else None,
        current_resident_iin=current.iin if current else None,
        department=current.department if current else None,
        floor=apartment.floor,
        entrance=apartment.entrance,
        payment_due_day=apartment.payment_due_day,
        occupants_count=occupants_count,
        monthly_deduction=float(apartment.monthly_deduction) if apartment.monthly_deduction is not None else None,
        monthly_payment=float(monthly_payment) if monthly_payment is not None else None,
        initial_payment=float(initial_payment) if initial_payment is not None else None,
        initial_cost=float(initial_cost) if initial_cost is not None else None,
        amortization_cost=float(apartment.amortization_cost) if apartment.amortization_cost is not None else None,
        taxable_base=float(apartment.taxable_base) if apartment.taxable_base is not None else None,
        occupancy_basis=current.occupancy_basis if current else None,
        contract_end_date=contract_end_date,
        last_paid_month=last_paid_month,
    )


def _build_checklist(
    apartment: Apartment,
    docs: list[Document] | None = None,
    *,
    status_key: str | None = None,
    resident_id: int | None = None,
) -> list[ChecklistSlotItem]:
    if status_key is None:
        current = _active_resident(apartment)
        status_key, _ = _status_for_apartment(apartment, current is not None)

    by_key: dict[str, Document] = {}
    for doc in docs or []:
        if not doc.is_current:
            continue
        if resident_id is not None and doc.resident_id not in (None, resident_id):
            # Prefer resident-bound docs; allow apartment-level (resident_id None) as fallback only
            # when no resident-specific file exists — handled below after pass
            if doc.resident_id is not None and doc.resident_id != resident_id:
                continue
        key = doc.document_group_key
        # Support keys like "r12_protocol"
        if key.startswith(f"r{resident_id}_") if resident_id is not None else False:
            key = key.split("_", 1)[1]
        prev = by_key.get(key)
        if prev is None:
            by_key[key] = doc
            continue
        # Prefer exact resident match over apartment-level
        if resident_id is not None:
            if prev.resident_id != resident_id and doc.resident_id == resident_id:
                by_key[key] = doc
                continue
            if prev.resident_id == resident_id and doc.resident_id != resident_id:
                continue
        if doc.uploaded_at and prev.uploaded_at and doc.uploaded_at >= prev.uploaded_at:
            by_key[key] = doc

    slots: list[ChecklistSlotItem] = []
    for slot in slots_for_status(status_key):
        doc = by_key.get(slot["key"])
        slots.append(
            ChecklistSlotItem(
                key=slot["key"],
                label=slot["label"],
                document_type=slot["document_type"],
                section=slot["section"],
                uploaded=doc is not None,
                document=ChecklistDocumentFile(
                    id=doc.id,
                    file_name=doc.file_name,
                    mime_type=doc.mime_type,
                    uploaded_at=doc.uploaded_at,
                )
                if doc
                else None,
            )
        )
    return slots


_ROOM_RE = re.compile(
    r"ком(?:нат[аые]?|анат)\s*(?:№\s*)?(\d+)\s*(?:[-–—,:]\s*([\d]+(?:[.,]\d+)?)\s*(?:кв\.?\s*м|м²|м2)?)?",
    re.IGNORECASE,
)


def _parse_room_info(*texts: str | None) -> tuple[str | None, float | None]:
    blob = " ; ".join(t for t in texts if t)
    if not blob:
        return None, None
    m = _ROOM_RE.search(blob)
    if not m:
        return None, None
    room_no = m.group(1)
    area = None
    if m.group(2):
        try:
            area = float(m.group(2).replace(",", "."))
        except ValueError:
            area = None
    return room_no, area


def _contract_type_label(status_key: str) -> str:
    return {
        "rent": "Аренда",
        "guest": "Гостевой",
        "free": "Свободно",
        "installment": "Рассрочка",
        "sold": "100% Выкуп",
    }.get(status_key, "Аренда")


def _build_occupants(apartment: Apartment, docs: list[Document]) -> list[OccupantCard]:
    status_key, _ = _status_for_apartment(apartment, any(r.is_active for r in apartment.residents))
    active = [r for r in apartment.residents if r.is_active]
    active.sort(key=lambda r: (r.move_in_date or r.created_at.date()), reverse=True)
    occupants: list[OccupantCard] = []
    for resident in active:
        payment_status, monthly, debt, contract, _, _ = _payment_info(resident)
        rf = next((x for x in resident.rental_financials if x.is_current), None)
        room_no, room_area = _parse_room_info(
            resident.note,
            rf.note if rf else None,
            rf.attachment_note if rf else None,
        )
        if room_area is None and rf is not None and rf.occupied_area_sp is not None:
            try:
                room_area = float(rf.occupied_area_sp)
            except (TypeError, ValueError):
                pass
        occupants.append(
            OccupantCard(
                id=resident.id,
                full_name=resident.full_name,
                position=resident.position,
                department=resident.department,
                occupancy_basis=resident.occupancy_basis,
                contract_type=_contract_type_label(status_key),
                contract_number=contract,
                monthly_payment=monthly,
                remaining_debt=debt,
                payment_status=payment_status,
                move_in_date=resident.move_in_date,
                room_number=room_no,
                room_area=room_area,
                note=resident.note,
                status_key=status_key,
                contract_start_date=resident.contract_start_date,
                contract_end_date=resident.contract_end_date,
                contract_file_path=resident.contract_file_path,
                contract_file_name=resident.contract_file_name,
                last_paid_month=resident.last_paid_month,
                document_checklist=_build_checklist(
                    apartment, docs, status_key=status_key, resident_id=resident.id
                ),
            )
        )
    return occupants


def _group_rooms(occupants: list[OccupantCard]) -> list[RoomGroup]:
    if not occupants:
        return []
    groups: dict[str, list[OccupantCard]] = defaultdict(list)
    areas: dict[str, float | None] = {}
    for occ in occupants:
        key = occ.room_number or "_none"
        groups[key].append(occ)
        if occ.room_area is not None:
            areas[key] = occ.room_area

    rooms: list[RoomGroup] = []
    for key, members in groups.items():
        room_number = None if key == "_none" else key
        room_area = areas.get(key)
        if room_number:
            area_part = f" — {room_area:g} кв.м" if room_area is not None else ""
            if len(members) == 1:
                people = " (1 человек)"
            elif 2 <= len(members) <= 4:
                people = f" ({len(members)} человека)"
            else:
                people = f" ({len(members)} человек)"
            title = f"Комната {room_number}{area_part}{people}"
        else:
            title = f"Проживающие ({len(members)})" if len(members) > 1 else "Проживающий"
        rooms.append(
            RoomGroup(
                title=title,
                room_number=room_number,
                room_area=room_area,
                occupants=members,
            )
        )

    rooms.sort(key=lambda g: (g.room_number is None, int(g.room_number) if g.room_number and g.room_number.isdigit() else 999, g.title))
    return rooms


@router.get("/analytics", response_model=HousingFundAnalytics)
async def get_housing_fund_analytics(db: AsyncSession = Depends(get_db)) -> HousingFundAnalytics:
    stmt = select(Apartment).options(selectinload(Apartment.residents))
    apartments = list((await db.execute(stmt)).scalars().all())

    complexes = {a.residential_complex_name for a in apartments if a.residential_complex_name}
    by_status: dict[str, int] = defaultdict(int)
    free = occupied = guest = sold = installment = rent = 0
    by_year: dict[int, dict[str, int]] = defaultdict(lambda: {"sold": 0, "rent": 0, "guest": 0})

    for apt in apartments:
        current = _active_resident(apt)
        key = _fund_category_for_apartment(apt)
        by_status[key] += 1
        if key == "free":
            free += 1
        elif key == "guest":
            guest += 1
            if current:
                occupied += 1
        elif key == "sold":
            sold += 1
            occupied += 1
        elif key == "installment":
            installment += 1
            occupied += 1
        else:
            rent += 1
            if current:
                occupied += 1

        for resident in apt.residents:
            year = resident.move_in_date.year if resident.move_in_date else None
            if year is None:
                continue
            if apt.apartment_subtype == ApartmentSubtype.full_sold:
                by_year[year]["sold"] += 1
            elif apt.apartment_subtype in {ApartmentSubtype.guest, ApartmentSubtype.guest_gph}:
                by_year[year]["guest"] += 1
            else:
                by_year[year]["rent"] += 1

    total = len(apartments)
    metrics = HousingFundMetrics(
        total_complexes=len(complexes),
        total_apartments=total,
        free_count=free,
        free_percent=round((free / total) * 100, 1) if total else 0.0,
        occupied_count=occupied,
        guest_count=guest,
        sold_count=sold,
        installment_count=installment,
        rent_count=rent,
    )

    years = sorted(by_year.keys()) or list(range(2019, 2027))
    series = [
        YearSeriesPoint(year=y, sold=by_year[y]["sold"], rent=by_year[y]["rent"], guest=by_year[y]["guest"])
        for y in years
    ]

    return HousingFundAnalytics(metrics=metrics, by_year=series, by_status=dict(by_status))


@router.get("/complexes", response_model=list[ComplexSummaryCard])
async def list_complexes(db: AsyncSession = Depends(get_db)) -> list[ComplexSummaryCard]:
    stmt = select(Apartment).options(selectinload(Apartment.residents))
    apartments = list((await db.execute(stmt)).scalars().all())

    summary_rows = list((await db.execute(select(DashboardManualSummary))).scalars().all())
    complex_rows = list((await db.execute(select(HousingComplex))).scalars().all())
    existing_profiles = {row.name: row for row in complex_rows}
    created = False
    for item in CANONICAL_COMPLEXES:
        name = item["name"]
        if name in existing_profiles:
            continue
        db.add(
            HousingComplex(
                name=name,
                district=item.get("district"),
                address=item.get("address") or "Район, адрес",
                build_year=None,
            )
        )
        created = True
    if created:
        await db.flush()
        complex_rows = list((await db.execute(select(HousingComplex))).scalars().all())
        existing_profiles = {row.name: row for row in complex_rows}

    summaries: dict[str, DashboardManualSummary] = {}
    for row in summary_rows:
        key = _normalize_complex_name(row.residential_complex_name) or row.residential_complex_name
        if key not in summaries or row.residential_complex_name == key:
            summaries[key] = row

    groups: dict[str, list[Apartment]] = defaultdict(list)
    for apt in apartments:
        key = _normalize_complex_name(apt.residential_complex_name)
        if key:
            groups[key].append(apt)

    meta = {c["name"]: c for c in CANONICAL_COMPLEXES}
    output: list[ComplexSummaryCard] = []
    for name in CANONICAL_COMPLEX_NAMES:
        items = groups.get(name, [])
        counts = defaultdict(int)
        profile = existing_profiles.get(name)
        meta_row = meta.get(name, {})
        district = (profile.district if profile else None) or meta_row.get("district")
        raw_address = (profile.address if profile else None) or meta_row.get("address") or "Район, адрес"
        district, display_address = _complex_card_location(district=district, address=raw_address)
        build_year = profile.build_year if profile else None
        real_apartments = 0
        for apt in items:
            if apt.status == "catalog" or apt.apartment_number == "—":
                continue
            real_apartments += 1
            category = _fund_category_for_apartment(apt)
            counts[category] += 1

        guest_total = counts["guest"] if _is_guest_fund_complex(name) else 0

        summary = summaries.get(name)
        image_path = summary.image_path if summary else None

        if real_apartments == 0 and summary is not None:
            installment_guess = max(int(summary.for_sale_count or 0) - int(summary.rent_count or 0), 0)
            summary_guest = int(summary.guest_count or 0) + int(summary.guest_gph_count or 0)
            free_guess = max(
                int(summary.remaining_total or 0)
                - int(summary.rent_count or 0)
                - summary_guest,
                0,
            )
            output.append(
                ComplexSummaryCard(
                    id=profile.id if profile else None,
                    name=name,
                    address=display_address,
                    district=district,
                    build_year=build_year,
                    image_path=image_path,
                    total_count=int(summary.total_count or 0),
                    rent_count=int(summary.rent_count or 0),
                    installment_count=installment_guess,
                    sold_count=int(summary.sold_total or 0),
                    guest_count=summary_guest if _is_guest_fund_complex(name) else int(summary.guest_count or 0),
                    free_count=free_guess,
                    rent_as_flat=int(summary.rent_as_flat or 0),
                    rent_as_dorm=int(summary.rent_as_dorm or 0),
                    dorm_flats_info=summary.dorm_flats_info,
                )
            )
            continue

        # При наличии свода из Excel — total / аренда / гостевые берём из свода (контрольные цифры)
        summary_guest = int(summary.guest_count or 0) if summary else 0
        output.append(
            ComplexSummaryCard(
                id=profile.id if profile else None,
                name=name,
                address=display_address,
                district=district,
                build_year=build_year,
                image_path=image_path,
                total_count=int(summary.total_count) if summary and summary.total_count else (
                    real_apartments or 0
                ),
                rent_count=int(summary.rent_count) if summary and summary.rent_count is not None else counts["rent"],
                installment_count=counts["installment"],
                sold_count=counts["sold"] or (int(summary.sold_total) if summary else 0),
                guest_count=(
                    summary_guest
                    if summary is not None
                    else (guest_total if _is_guest_fund_complex(name) else counts["guest"])
                ),
                free_count=counts["free"],
                rent_as_flat=int(summary.rent_as_flat or 0) if summary else counts["rent"],
                rent_as_dorm=int(summary.rent_as_dorm or 0) if summary else 0,
                dorm_flats_info=summary.dorm_flats_info if summary else "",
            )
        )
    return output


@router.get("/apartments", response_model=list[ApartmentCardItem])
async def list_fund_apartments(
    complex_name: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[ApartmentCardItem]:
    stmt = (
        select(Apartment)
        .options(
            selectinload(Apartment.residents).selectinload(Resident.rental_financials),
            selectinload(Apartment.residents).selectinload(Resident.purchase_financials),
            selectinload(Apartment.rental_financials),
            selectinload(Apartment.purchase_financials),
        )
        .order_by(Apartment.residential_complex_name, Apartment.apartment_number, Apartment.id)
    )
    apartments = list((await db.execute(stmt)).scalars().all())
    if complex_name and complex_name != "all":
        target = _normalize_complex_name(complex_name) or complex_name
        apartments = [
            apt for apt in apartments if _normalize_complex_name(apt.residential_complex_name) == target
        ]

    q = (search or "").strip().lower()
    output: list[ApartmentCardItem] = []

    for apt in apartments:
        if apt.status == "catalog" or apt.apartment_number == "—":
            continue
        card = _to_card(apt)
        if status and status != "all" and card.status_key != status:
            continue
        if q:
            haystack = " ".join(
                [
                    card.residential_complex_name or "",
                    card.address or "",
                    card.apartment_number or "",
                    card.current_resident_name or "",
                    card.current_resident_iin or "",
                ]
            ).lower()
            if q not in haystack:
                continue
        output.append(card)

    return output


@router.get("/apartments/{apartment_id}", response_model=ApartmentDetailCard)
async def get_apartment_detail(apartment_id: int, db: AsyncSession = Depends(get_db)) -> ApartmentDetailCard:
    stmt = (
        select(Apartment)
        .where(Apartment.id == apartment_id)
        .options(
            selectinload(Apartment.residents).selectinload(Resident.rental_financials),
            selectinload(Apartment.residents).selectinload(Resident.purchase_financials),
            selectinload(Apartment.documents),
            selectinload(Apartment.rental_financials),
        )
    )
    apartment = (await db.execute(stmt)).scalar_one_or_none()
    if apartment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found")

    card = _to_card(apartment)
    current = _active_resident(apartment)
    current_brief = None
    if current is not None:
        payment_status, monthly, debt, contract, _, _ = _payment_info(current)
        current_brief = CurrentResidentBrief(
            id=current.id,
            full_name=current.full_name,
            iin=current.iin,
            position=current.position,
            department=current.department,
            move_in_date=current.move_in_date,
            occupancy_basis=current.occupancy_basis,
            payment_status=payment_status,
            monthly_payment=monthly,
            remaining_debt=debt,
            contract_number=contract,
        )

    history_items = [
        ResidenceHistoryItem(
            resident_id=r.id,
            full_name=r.full_name,
            iin=r.iin,
            position=r.position,
            department=r.department,
            move_in_date=r.move_in_date,
            move_out_date=r.move_out_date,
            is_active=r.is_active,
            occupancy_basis=r.occupancy_basis,
            note=r.note,
            event_type="guest_booking"
            if apartment.apartment_subtype in {ApartmentSubtype.guest, ApartmentSubtype.guest_gph}
            else "residence",
        )
        for r in sorted(
            apartment.residents,
            key=lambda x: (x.move_in_date or x.created_at.date()),
            reverse=True,
        )
    ]

    docs = list(apartment.documents)
    occupants = _build_occupants(apartment, docs)
    rooms = _group_rooms(occupants)

    return ApartmentDetailCard(
        apartment=card,
        district=apartment.district,
        street=apartment.street,
        house_number=apartment.house_number,
        living_area=float(apartment.living_area) if apartment.living_area is not None else None,
        build_year=apartment.build_year,
        personal_account=apartment.personal_account,
        current_resident=current_brief,
        occupants=occupants,
        rooms=rooms,
        history=history_items,
        document_checklist=_build_checklist(apartment, docs),
    )


@router.get("/apartments/{apartment_id}/document-checklist", response_model=DocumentChecklistResponse)
async def get_apartment_document_checklist(
    apartment_id: int, db: AsyncSession = Depends(get_db)
) -> DocumentChecklistResponse:
    stmt = (
        select(Apartment)
        .where(Apartment.id == apartment_id)
        .options(selectinload(Apartment.residents), selectinload(Apartment.documents))
    )
    apartment = (await db.execute(stmt)).scalar_one_or_none()
    if apartment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    card = _to_card(apartment)
    return DocumentChecklistResponse(
        apartment_id=apartment.id,
        status_key=card.status_key,
        status_label=card.status_label,
        slots=_build_checklist(apartment, list(apartment.documents)),
    )


@router.get("/contracts")
async def list_contracts(db: AsyncSession = Depends(get_db)):
    """Return all active residents that have contract_end_date set (rental contracts)."""
    stmt = (
        select(Resident)
        .where(Resident.is_active.is_(True), Resident.contract_end_date.is_not(None))
        .options(selectinload(Resident.apartment))
    )
    rows = (await db.execute(stmt)).scalars().all()
    today = date.today()
    result = []
    for r in rows:
        end = r.contract_end_date
        start = r.contract_start_date
        days_left = (end - today).days if end else None
        if days_left is not None:
            if days_left < 0:
                contract_status = "expired"
            elif days_left <= 30:
                contract_status = "expiring"
            else:
                contract_status = "active"
        else:
            contract_status = "unknown"

        apt = r.apartment
        result.append({
            "id": r.id,
            "full_name": r.full_name,
            "department": r.department,
            "position": r.position,
            "apartment_number": apt.apartment_number if apt else None,
            "house_number": apt.house_number if apt else None,
            "residential_complex_name": apt.residential_complex_name if apt else None,
            "contract_start_date": start.isoformat() if start else None,
            "contract_end_date": end.isoformat() if end else None,
            "days_left": days_left,
            "contract_status": contract_status,
            "contract_file_path": r.contract_file_path,
            "contract_file_name": r.contract_file_name,
        })
    return result
