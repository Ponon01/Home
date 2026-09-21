from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import re

from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype, ApartmentType
from app.models.purchase_financials import PurchaseFinancials
from app.models.rental_financials import RentalFinancials
from app.models.resident import Resident


@dataclass
class ZerdeRow:
    residential_complex_name: str
    address: str
    full_name: str
    family_composition: str | None
    initial_cost: float | None
    market_price: float | None
    reimbursement_cost_monthly: float | None
    taxable_base: float | None
    status: str | None
    room_count: int | None
    total_area: float | None
    build_year: int | None
    move_in_year: int | None
    position: str | None
    department: str | None
    protocol_text: str | None
    purchase_contract: str | None


DATA: list[ZerdeRow] = [
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 1", "Мадияров Дархан Дилдабекович", "Мадиярова Эльмира - сестра", 17719586, None, 18452.76, 14849.28, None, 2, 62.6, 2010, 2013, "Подсобный рабочий", "Общий отдел: Департамент эксплуатации здания, Производственно - технический персонал", "Протокол заседания жилищной комисии от 01 октября 2013 года №1", None),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 45", "Есимханов Болат Амирбергенович", "Есимханов А - сын; Есимханов А - отец; Есимханов О - мать", 20573561, None, 21425.35, 17240.95, None, 3, 72.9, 2010, 2013, "Солист оперы", "Оперная труппа: Творческий персонал", "Протокол заседания жилищной комисии от 01 октября 2013 года №1", None),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 78", "Татмаков Талгар", None, 17414792, None, None, None, None, 2, 61.5, 2010, 2015, "Начальник управления", "Управление машинерии сцены: Производственно - технический персонал, Художественно - производственный комплекс", "Протокол заседания жилищной комисии от", "договор купли продажи квартиры № 951 от 11.04.2022 г (прямая продажа)"),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 82", "Кульбеков Аскен", None, 17595590, None, None, None, None, 2, 62.3, 2010, 2013, "Артист миманса", "Миманс: Творческий персонал", "Протокол заседания жилищной комисии от 12 апреля 2022 года №11", "договор купли-продажи квартиры № 1017 от 14.04.2022 г. (рассрочка 15 лет)"),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 83", "Фетисов Евгений Николаевич", "Фетисова Екатерина - супруга; Фетисов Давид - сын; Фетисов Даниил - сын; Фетисова Мария - дочь; Фетисова Анна - дочь", 17414792, None, 18135.30, 14593.86, None, 2, 61.5, 2010, 2013, "Режиссер звукозаписи", "Отдел звукового сопровождения и звукозаписи: Производственно - технический персонал, Художественно - производственный комплекс, Департамент аудио и видеосопровождения", "Протокол заседания жилищной комисии от 01 октября 2013 года №1", None),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 87", "Искаков Алишер Аскарбекович", "Умирбекова Гаухар - супруга", 17540173, None, 18266.25, 14698.93, None, 2, 62.1, 2010, 2025, "Инженер звукозаписи", "Отдел звукового сопровождения и звукозаписи: Производственно - технический персонал, Художественно - производственный комплекс, Департамент аудио и видеосопровождения", "Протокол заседания жилищной комисии от 28 мая 2025 №12", None),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 88", "Айдархан Жансая", None, 17497918, None, None, None, None, 2, 61.8, 2010, 2013, "Художник - гример", "Гримерный цех: Производственно - технический персонал, Художественно - производственный комплекс", "Протокол заседания жилищной комисии от 10 апреля 2024 года №7", "договор купли-продажи квартиры №2221 от 17.05.2024 г рассрочка 15 лет"),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, Кудайбердыулы 4 - 41", "Ташкенбаев Ерболат", None, 20739812, None, None, None, None, 3, 73.5, 2010, 2013, "Артист оркестра", "Оркестр: Творческий персонал", "Протокол заседания жилищной комисии от", "договор купли продажи квартиры №1814 от 19.11.2021 г. рассрочка 15 лет"),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, ул. Кудайбердыулы 4 кв. 36", "Мустафина Махаббат", None, 20060954, None, None, None, None, 3, 73.3, 2010, 2013, "Хор: Творческий персонал", "Хор: Творческий персонал", "Протокол заседания жилищной комисии от 02 июня 2021 года №11", "договор купли продажи квартиры № 905 от 11 июня 2021 г. Рассрочка 15 лет"),
    ZerdeRow("Жилой комплекс Зерде", "Жилой комплекс Зерде, ул. Кудайбердыулы 4 кв. 303", "Бейсембиев Жанадил", None, 17275557, None, None, None, None, 2, 61.3, 2010, 2013, "Артист миманса", "Миманс: Творческий персонал", "Протокол заседания жилищной комисии от 21 октября 2021 года №23", "договор купли продажи квартиры № 1618 от 25.10.2021 г. Рассрочка 15 лет"),
]


def norm_text(v: str | None) -> str:
    return re.sub(r"\s+", " ", (v or "")).strip().lower()


def extract_unit(address: str) -> str:
    m = re.search(r"(?:-\s*|кв\.\s*)(\d+)\s*$", address.lower())
    return m.group(1) if m else ""


def get_or_create_current_pf(session, apartment_id: int) -> PurchaseFinancials:
    pf = (
        session.execute(
            select(PurchaseFinancials)
            .where(PurchaseFinancials.apartment_id == apartment_id, PurchaseFinancials.is_current.is_(True))
            .order_by(PurchaseFinancials.id.desc())
        )
        .scalars()
        .first()
    )
    if pf:
        return pf
    pf = PurchaseFinancials(apartment_id=apartment_id, is_current=True)
    session.add(pf)
    session.flush()
    return pf


def get_or_create_current_rf(session, apartment_id: int) -> RentalFinancials:
    rf = (
        session.execute(
            select(RentalFinancials)
            .where(RentalFinancials.apartment_id == apartment_id, RentalFinancials.is_current.is_(True))
            .order_by(RentalFinancials.id.desc())
        )
        .scalars()
        .first()
    )
    if rf:
        return rf
    rf = RentalFinancials(apartment_id=apartment_id, is_current=True)
    session.add(rf)
    session.flush()
    return rf


def get_or_create_active_resident(session, apartment_id: int, full_name: str) -> Resident:
    residents = (
        session.execute(
            select(Resident).where(Resident.apartment_id == apartment_id).order_by(Resident.is_active.desc(), Resident.id.asc())
        )
        .scalars()
        .all()
    )
    for r in residents:
        if r.is_active:
            return r
    for r in residents:
        if norm_text(r.full_name) == norm_text(full_name):
            r.is_active = True
            return r
    r = Resident(apartment_id=apartment_id, full_name=full_name, is_active=True)
    session.add(r)
    session.flush()
    return r


def main() -> None:
    inserted = 0
    updated = 0
    matched_addresses: list[str] = []

    with SyncSessionLocal() as session:
        all_zerde = (
            session.execute(select(Apartment).where(Apartment.residential_complex_name == "Жилой комплекс Зерде"))
            .scalars()
            .all()
        )

        by_unit = {}
        by_addr_norm = {}
        for apt in all_zerde:
            unit = extract_unit(apt.address or apt.apartment_number or "")
            if unit:
                by_unit[unit] = apt
            by_addr_norm[norm_text(apt.address)] = apt

        for row in DATA:
            unit = extract_unit(row.address)
            apt = by_addr_norm.get(norm_text(row.address)) or by_unit.get(unit)
            created = False
            if apt is None:
                subtype = ApartmentSubtype.installment if row.purchase_contract else ApartmentSubtype.rent
                htype = ApartmentType.purchase if row.purchase_contract else ApartmentType.rent
                apt = Apartment(
                    residential_complex_name=row.residential_complex_name,
                    address=row.address,
                    housing_type=htype,
                    apartment_subtype=subtype,
                )
                session.add(apt)
                session.flush()
                created = True
                inserted += 1
            else:
                matched_addresses.append(row.address)
                updated += 1

            apt.residential_complex_name = row.residential_complex_name
            apt.address = row.address
            apt.room_count = row.room_count
            apt.total_area = row.total_area
            apt.build_year = row.build_year
            apt.status = row.status
            apt.personal_account = apt.personal_account
            apt.street = "Кудайбердыулы"
            apt.house_number = "4"
            apt.apartment_number = unit or apt.apartment_number
            if created:
                apt.housing_type = ApartmentType.purchase if row.purchase_contract else ApartmentType.rent
                apt.apartment_subtype = ApartmentSubtype.installment if row.purchase_contract else ApartmentSubtype.rent

            resident = get_or_create_active_resident(session, apt.id, row.full_name)
            resident.full_name = row.full_name
            resident.family_composition = row.family_composition
            resident.position = row.position
            resident.department = row.department
            resident.occupancy_basis = row.protocol_text
            resident.move_in_date = date(row.move_in_year, 1, 1) if row.move_in_year else None
            resident.move_out_date = None
            resident.is_active = True

            pf = get_or_create_current_pf(session, apt.id)
            pf.resident_id = resident.id
            pf.initial_cost = row.initial_cost
            pf.valuation_cost = row.market_price
            pf.realization_period = row.protocol_text
            pf.purchase_contract = row.purchase_contract
            pf.initial_cost_year = row.move_in_year

            rf = get_or_create_current_rf(session, apt.id)
            rf.resident_id = resident.id
            rf.market_price = row.market_price
            rf.reimbursement_cost_monthly = row.reimbursement_cost_monthly
            rf.taxable_base = row.taxable_base

        session.commit()

        final_count = (
            session.execute(
                select(Apartment).where(Apartment.residential_complex_name == "Жилой комплекс Зерде")
            )
            .scalars()
            .all()
        )
        print(f"inserted={inserted}")
        print(f"updated={updated}")
        print(f"matched_addresses={len(matched_addresses)}")
        for x in matched_addresses:
            print(f"MATCHED: {x}")
        print(f"total_zerde_rows_now={len(final_count)}")
        print("housing_table_should_show_all_10=yes" if len(final_count) >= 10 else "housing_table_should_show_all_10=no")


if __name__ == "__main__":
    main()
