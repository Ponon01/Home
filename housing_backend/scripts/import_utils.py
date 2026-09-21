from __future__ import annotations

import re
import math
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import Apartment, ApartmentSubtype, ApartmentType, Resident


EXCEL_DIR = Path("data/excel")


@dataclass
class ImportStats:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0
    notes: list[str] = field(default_factory=list)

    def log(self, msg: str) -> None:
        self.notes.append(msg)
        print(msg)


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "nat", "none", "null"}:
        return ""
    return re.sub(r"\s+", " ", text)


_VACANT_FIO_MARKERS = (
    "пустая",
    "пустой",
    "пустое",
    "пусто",
    "съехал",
    "съехала",
    "съезжает",
    "съедет",
    "выехал",
    "выехала",
    "не живет",
    "не живёт",
    "свободна",
    "свободно",
    "свободн",
)

_OCCUPIED_FIO_OVERRIDE = (
    "заехал",
    "заехала",
    "заезжает",
    "заселен",
    "прожива",
)


def is_vacant_occupant_text(value: object) -> bool:
    """True when FIO cell means the unit is empty / resident moved out."""
    text = normalize_text(value)
    if not text:
        return False
    low = text.casefold().replace("ё", "е")
    if any(marker in low for marker in _OCCUPIED_FIO_OVERRIDE):
        return False
    return any(marker in low for marker in _VACANT_FIO_MARKERS)


def normalize_address(value: object) -> str:
    text = normalize_text(value).lower()
    if not text:
        return ""
    text = text.replace("ё", "е")
    for token in [
        "г. астана,",
        "г астана,",
        "жилой комплекс",
        "жк",
        "кв.",
        "кв ",
        "квартира",
    ]:
        text = text.replace(token, " ")
    text = re.sub(r"[,;/]+", " ", text)
    text = re.sub(r"\s*-\s*", "-", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (int, float, Decimal)):
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "nat", "none", "null"}:
        return None
    text = text.replace("\u00a0", "").replace(" ", "").replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    if text in {"", "-", ".", "-."}:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip().lower()
    if text in {"", "nan", "nat", "none", "null"}:
        return None
    dec = parse_decimal(value)
    return int(dec) if dec is not None else None


def parse_date(value: object) -> date | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    type_name = type(value).__name__
    if type_name in {"NaTType", "NaT"} or str(value) in {"NaT", "nat", "NaTType"}:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = normalize_text(value)
    if not text or text.lower() in {"nat", "nan"}:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def infer_apartment_type_and_subtype(status_or_contract: str) -> tuple[ApartmentType, ApartmentSubtype]:
    src = status_or_contract.lower()
    if "рассроч" in src:
        return ApartmentType.purchase, ApartmentSubtype.installment
    if "выкуп" in src or "100%" in src or "полная оплата" in src:
        return ApartmentType.purchase, ApartmentSubtype.full_sold
    if "гпх" in src:
        return ApartmentType.rent, ApartmentSubtype.guest_gph
    if "гостев" in src:
        return ApartmentType.rent, ApartmentSubtype.guest
    if "купли" in src or "продаж" in src:
        return ApartmentType.purchase, ApartmentSubtype.installment
    return ApartmentType.rent, ApartmentSubtype.rent


def extract_apartment_number(*candidates: object) -> str | None:
    """Extract a real apartment number; never match the 'кв' inside 'квартал'."""
    for raw in candidates:
        text = normalize_text(raw)
        if not text:
            continue
        # Explicit numeric (or Nа) cell from «Квартира» column
        if re.fullmatch(r"\d+[A-Za-zА-Яа-я]?", text):
            return text
        # «Сарайшык 5Д - 19» / «… - 83» at end of address
        dash = re.search(r"[-–—]\s*(\d+[A-Za-zА-Яа-я]?)\s*$", text)
        if dash:
            return dash.group(1)
        # «кв. 19» / «квартира 19» — require a digit; do not match «квартал»
        labeled = re.search(
            r"(?<![А-Яа-яA-Za-z])(?:кв\.|квартира)\s*(\d+[A-Za-zА-Яа-я/\-]*)",
            text,
            flags=re.IGNORECASE,
        )
        if labeled:
            return labeled.group(1)
    return None


def split_address_components(raw_address: str) -> tuple[str | None, str | None, str | None]:
    text = normalize_text(raw_address)
    house_match = re.search(r"(?:дом|д\.)\s*([0-9A-Za-zА-Яа-я/\-]+)", text, flags=re.IGNORECASE)
    # «Сарайшык 5Д - 19» → house 5Д, apt 19
    street_house_apt = re.search(
        r"(?:,|^)\s*([А-Яа-яA-Za-z.\-\s]+?)\s+(\d+[A-Za-zА-Яа-я]?)\s*[-–—]\s*(\d+[A-Za-zА-Яа-я]?)\s*$",
        text,
    )
    apartment_number = extract_apartment_number(text)
    house_number = house_match.group(1) if house_match else None
    street = None
    if street_house_apt:
        street = normalize_text(street_house_apt.group(1))
        house_number = house_number or normalize_text(street_house_apt.group(2))
        apartment_number = apartment_number or normalize_text(street_house_apt.group(3))
    if street is None:
        for marker in [r"ул\.\s*([^,]+)", r"пр\.\s*([^,]+)"]:
            m = re.search(marker, text, flags=re.IGNORECASE)
            if m:
                street = normalize_text(m.group(1))
                break
    return street, house_number, apartment_number


def find_apartment(
    session: Session,
    address: str,
    complex_name: str | None = None,
    *,
    apartment_number: str | None = None,
    house_number: str | None = None,
) -> Apartment | None:
    apt_no = normalize_text(apartment_number) or None
    house = normalize_text(house_number) or None
    street, addr_house, addr_apt = split_address_components(address)
    apt_no = apt_no or addr_apt
    house = house or addr_house

    # Prefer complex + apartment number (and house when known — avoid merging 5Д-16 with 5Г-16)
    if complex_name and apt_no:
        stmt: Select[tuple[Apartment]] = select(Apartment).where(
            Apartment.residential_complex_name == complex_name,
            Apartment.apartment_number == apt_no,
        )
        if house:
            by_house = session.scalars(stmt.where(Apartment.house_number == house).limit(1)).first()
            if by_house:
                return by_house
            # Same flat number in another building of this ЖК is a different unit
            return None
        found = session.scalars(stmt.limit(1)).first()
        if found:
            return found

    normalized = normalize_address(address)
    if normalized and apt_no:
        candidates = session.scalars(
            select(Apartment).where(
                Apartment.address.is_not(None),
                Apartment.apartment_number == apt_no,
            )
        ).all()
        for apt in candidates:
            if normalize_address(apt.address) == normalized:
                return apt
    elif normalized and not apt_no:
        candidates = session.scalars(select(Apartment).where(Apartment.address.is_not(None))).all()
        for apt in candidates:
            if normalize_address(apt.address) == normalized:
                return apt

    if complex_name and (street or house or apt_no):
        stmt = select(Apartment).where(Apartment.residential_complex_name == complex_name)
        if street:
            stmt = stmt.where(Apartment.street == street)
        if house:
            stmt = stmt.where(Apartment.house_number == house)
        if apt_no:
            stmt = stmt.where(Apartment.apartment_number == apt_no)
        return session.scalars(stmt.limit(1)).first()
    return None


def get_or_create_apartment(
    session: Session,
    *,
    address: str,
    residential_complex_name: str,
    defaults: dict[str, object] | None = None,
) -> tuple[Apartment, bool]:
    defaults = defaults or {}
    street_hint = normalize_text(defaults.get("street")) or None
    house_hint = normalize_text(defaults.get("house_number")) or None
    apt_hint = extract_apartment_number(defaults.get("apartment_number"), address) or None
    # Reject legacy false positives from «квартал» → «артал»
    if apt_hint and not re.search(r"\d", apt_hint):
        apt_hint = None
    apt = find_apartment(
        session,
        address=address,
        complex_name=residential_complex_name,
        apartment_number=apt_hint,
        house_number=house_hint,
    )
    created = False
    if apt is None:
        street, house, apartment_number = split_address_components(address)
        street = street_hint or street
        house = house_hint or house
        apartment_number = apt_hint or apartment_number
        # Ensure shared building addresses stay unique per apartment
        stored_address = normalize_text(address) or None
        if stored_address and house:
            # Keep different buildings/corpuses distinct inside stored address too
            if normalize_text(house) and normalize_text(house) not in stored_address:
                stored_address = f"{stored_address}, д. {house}"
        if stored_address and apartment_number and apartment_number not in stored_address:
            stored_address = f"{stored_address}, кв. {apartment_number}"
        apt_type, subtype = infer_apartment_type_and_subtype(
            normalize_text(defaults.get("status", "")) + " " + normalize_text(defaults.get("contract_hint", ""))
        )
        apt = Apartment(
            residential_complex_name=residential_complex_name or "UNKNOWN",
            address=stored_address,
            street=street or None,
            house_number=house or None,
            apartment_number=apartment_number or None,
            housing_type=defaults.get("housing_type", apt_type),
            apartment_subtype=defaults.get("apartment_subtype", subtype),
            room_count=defaults.get("room_count"),
            total_area=defaults.get("total_area"),
            living_area=defaults.get("living_area"),
            build_year=defaults.get("build_year"),
            personal_account=defaults.get("personal_account"),
            status=defaults.get("status"),
        )
        session.add(apt)
        session.flush()
        created = True
    else:
        for key in [
            "room_count",
            "total_area",
            "living_area",
            "build_year",
            "personal_account",
            "status",
            "street",
            "house_number",
            "apartment_number",
        ]:
            val = defaults.get(key)
            if val is not None and getattr(apt, key) in (None, "", 0):
                setattr(apt, key, val)
        if defaults.get("housing_type"):
            apt.housing_type = defaults["housing_type"]
        if defaults.get("apartment_subtype"):
            apt.apartment_subtype = defaults["apartment_subtype"]
    return apt, created


def get_or_create_resident(
    session: Session,
    *,
    apartment_id: int,
    full_name: str,
    defaults: dict[str, object] | None = None,
) -> tuple[Resident, bool]:
    defaults = defaults or {}
    name = normalize_text(full_name)
    resident = session.scalars(
        select(Resident).where(
            Resident.apartment_id == apartment_id,
            Resident.full_name == name,
            Resident.is_active.is_(True),
        )
    ).first()
    created = False
    if resident is None:
        resident = Resident(
            apartment_id=apartment_id,
            full_name=name or "UNKNOWN",
            iin=defaults.get("iin"),
            family_composition=defaults.get("family_composition"),
            position=defaults.get("position"),
            department=defaults.get("department"),
            move_in_date=defaults.get("move_in_date"),
            move_out_date=defaults.get("move_out_date"),
            occupancy_basis=defaults.get("occupancy_basis"),
            cohabitation=defaults.get("cohabitation"),
            cohabitant_count=defaults.get("cohabitant_count"),
            note=defaults.get("note"),
            is_active=True,
        )
        session.add(resident)
        session.flush()
        created = True
    else:
        for key in ["iin", "family_composition", "position", "department", "occupancy_basis", "note", "cohabitation"]:
            val = defaults.get(key)
            if val and not getattr(resident, key):
                setattr(resident, key, val)
        if defaults.get("cohabitant_count") is not None and resident.cohabitant_count is None:
            resident.cohabitant_count = defaults["cohabitant_count"]
    return resident, created


def pick_column(columns: Iterable[str], *variants: str) -> str | None:
    cols = [normalize_text(c).lower() for c in columns]
    original = list(columns)
    for variant in variants:
        v = variant.lower()
        for idx, col in enumerate(cols):
            if v in col:
                return original[idx]
    return None
