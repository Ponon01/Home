"""Insert manually specified housing-department rows (apartment + resident + financials).

Данные можно набирать вручную или сверять со скринами Excel — главная страница не меняется.

Usage (project root):
  python -m scripts.add_manual_housing_rows

Docker:
  docker compose exec backend python -m scripts.add_manual_housing_rows

Пропуск строки: если уже есть квартира с тем же personal_account (если задан)
или с тем же address (если лицевой счёт не задан).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models import Apartment, PurchaseFinancials, RentalFinancials, Resident
from app.models.enums import ApartmentSubtype, HousingType


def _p(
    *,
    complex_name: str,
    address: str,
    street: str | None,
    house_number: str | None,
    apartment_number: str | None,
    fio: str,
    family: str | None,
    position: str | None,
    department: str | None,
    occupancy: str,
    move_in: date,
    room_count: int,
    total_area: Decimal,
    build_year: int,
    personal_account: str | None,
    initial: Decimal,
    market: Decimal,
    protocol: str,
    contract: str,
    cost_year: int | None = None,
) -> dict:
    """Полная продажа (найм по договору купли-продажи, 100% оплата)."""
    return {
        "residential_complex_name": complex_name,
        "address": address,
        "street": street,
        "house_number": house_number,
        "apartment_number": apartment_number,
        "housing_type": HousingType.purchase,
        "apartment_subtype": ApartmentSubtype.full_sold,
        "room_count": room_count,
        "total_area": total_area,
        "build_year": build_year,
        "personal_account": personal_account,
        "status": None,
        "resident": {
            "full_name": fio,
            "family_composition": family,
            "position": position,
            "department": department,
            "move_in_date": move_in,
            "move_out_date": None,
            "occupancy_basis": occupancy,
        },
        "rental": None,
        "purchase": {
            "initial_cost": initial,
            "valuation_cost": market,
            "realization_period": protocol[:255] if protocol else None,
            "purchase_contract": contract[:255] if contract else None,
            "initial_cost_year": cost_year,
        },
    }


def _r(
    *,
    complex_name: str,
    address: str,
    street: str | None,
    house_number: str | None,
    apartment_number: str | None,
    fio: str,
    family: str | None,
    position: str | None,
    department: str | None,
    occupancy: str,
    move_in: date,
    room_count: int,
    total_area: Decimal,
    build_year: int,
    personal_account: str | None,
    reimbursement: Decimal,
    taxable: Decimal,
    purchase_initial: Decimal,
    act_text: str,
    lease_contract: str,
    market_price: Decimal | None = None,
) -> dict:
    """Служебный найм: удержания в rental_financials, оценка/стоимость в purchase для колонок таблицы."""
    return {
        "residential_complex_name": complex_name,
        "address": address,
        "street": street,
        "house_number": house_number,
        "apartment_number": apartment_number,
        "housing_type": HousingType.rent,
        "apartment_subtype": ApartmentSubtype.rent,
        "room_count": room_count,
        "total_area": total_area,
        "build_year": build_year,
        "personal_account": personal_account,
        "status": None,
        "resident": {
            "full_name": fio,
            "family_composition": family,
            "position": position,
            "department": department,
            "move_in_date": move_in,
            "move_out_date": None,
            "occupancy_basis": occupancy,
        },
        "rental": {
            "market_price": market_price,
            "reimbursement_cost_monthly": reimbursement,
            "taxable_base": taxable,
        },
        "purchase": {
            "initial_cost": purchase_initial,
            "valuation_cost": None,
            "realization_period": act_text[:255] if act_text else None,
            "purchase_contract": lease_contract[:255] if lease_contract else None,
            "initial_cost_year": None,
        },
    }


# Сверка с вашими скринами Excel (Лист2). При необходимости правьте здесь.
MANUAL_ROWS: list[dict] = [
    _r(
        complex_name="Жилой комплекс Хан-тенгри",
        address="Жилой комплекс Хан-тенгри, Сембинова 7 - 6",
        street="Сембинова",
        house_number="7",
        apartment_number="6",
        fio="Сейдахмет Жәнібек Хамитұлы",
        family=(
            "супруга - Ержанова И.Б., дочь - Хамит Д.Ж., сын - Хамит М.Ж., "
            "дочь - Хамит М.Ж., сын - Хамит Ә.Ж."
        ),
        position="Звукооператор",
        department=(
            "Отдел звукового сопровождения и звукозаписи: Производственно - технический персонал, "
            "Художественно - производственный комплекс, Департамент технического сопровождения"
        ),
        occupancy="Протокол заседания жилищной комисии от 17 мая 2019 года № 62",
        move_in=date(2019, 5, 17),
        room_count=3,
        total_area=Decimal("100.8"),
        build_year=2010,
        personal_account="2346362",
        reimbursement=Decimal("23712.74"),
        taxable=Decimal("21695.86"),
        purchase_initial=Decimal("21095055"),
        act_text="Акт приема-передачи государственной собственности от 24 мая 2018 года",
        lease_contract="12-15/26 от 30.01.2026 г.",
        market_price=None,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="Жилой комплекс Хан-тенгри, Сембинова 7 - 15",
        street="Сембинова",
        house_number="7",
        apartment_number="15",
        fio="Арганбаев Максат Айдарханович",
        family=None,
        position="Грузчик склада",
        department="Склад: Департамент эксплуатации здания",
        occupancy="Протокол № 26 от 13.11.2023",
        move_in=date(2023, 11, 30),
        room_count=3,
        total_area=Decimal("101.3"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("21193693"),
        market=Decimal("12104134.40"),
        protocol="Протокол № 26 от 13.11.2023",
        contract="Договор купли-продажи № 6232 от 30.11.2023 (100% оплата)",
        cost_year=2023,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="Жилой комплекс Хан-тенгри, Сембинова 7 - 126",
        street="Сембинова",
        house_number="7",
        apartment_number="126",
        fio="Нурланова Нургуль Ериковна",
        family=None,
        position="Артист оркестра",
        department="Симфонический оркестр: Творческий персонал",
        occupancy="Протокол № 18 от 09.09.2023",
        move_in=date(2023, 10, 12),
        room_count=3,
        total_area=Decimal("122.8"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("25693135"),
        market=Decimal("14673226.40"),
        protocol="Протокол № 18 от 09.09.2023",
        contract="Договор купли-продажи от 12.10.2023 (100% оплата)",
        cost_year=2023,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="Жилой комплекс Хан-тенгри, Сембинова 7 - 132",
        street="Сембинова",
        house_number="7",
        apartment_number="132",
        fio="Безбородова Елена Владимировна",
        family=None,
        position="Артист мимики",
        department="Творческий персонал",
        occupancy="Протокол № 17 от 02.09.2023",
        move_in=date(2023, 9, 5),
        room_count=3,
        total_area=Decimal("121.3"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("25335220"),
        market=Decimal("14493894.40"),
        protocol="Протокол № 17 от 02.09.2023",
        contract="Договор купли-продажи от 05.09.2023 (100% оплата)",
        cost_year=2023,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="Жилой комплекс Хан-тенгри, Сембинова 7 - 144",
        street="Сембинова",
        house_number="7",
        apartment_number="144",
        fio="Сарсембаев Жанат Даулетович",
        family=None,
        position="Грузчик склада",
        department="Склад: Департамент эксплуатации здания",
        occupancy="Протокол № 29 от 26.12.2024",
        move_in=date(2024, 12, 30),
        room_count=3,
        total_area=Decimal("122.3"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("25594496"),
        market=Decimal("14613382.40"),
        protocol="Протокол № 29 от 26.12.2024",
        contract="Договор купли-продажи от 30.12.2024 (100% оплата)",
        cost_year=2024,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="г. Астана, ул. Сембинова, дом 7, квартира 160",
        street="Сембинова",
        house_number="7",
        apartment_number="160",
        fio="Науанов Рахметулла Алпысбекович",
        family=None,
        position="Артист балета",
        department="Балетная труппа: Творческий персонал",
        occupancy="Протокол № 9 от 20.05.2021",
        move_in=date(2021, 6, 18),
        room_count=3,
        total_area=Decimal("100.2"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("20963459"),
        market=Decimal("11972697.60"),
        protocol="Протокол № 9 от 20.05.2021",
        contract="Договор № 255 от 18.06.2021 (100% оплата)",
        cost_year=2021,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="г. Астана, ул. Сембинова, дом 7, квартира 123",
        street="Сембинова",
        house_number="7",
        apartment_number="123",
        fio="Жалпарова Шолпан Асановна",
        family=None,
        position="Артист (вокалист) хора",
        department="Хор: Творческий персонал",
        occupancy="Протокол жилищной комиссии (уточнить номер в первичных документах)",
        move_in=date(2019, 1, 1),
        room_count=3,
        total_area=Decimal("123.6"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("25866556"),
        market=Decimal("14768716.80"),
        protocol="Протокол жилищной комиссии",
        contract="Договор купли-продажи (100% оплата)",
        cost_year=2019,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="г. Астана, ул. Сембинова, дом 7, квартира 138",
        street="Сембинова",
        house_number="7",
        apartment_number="138",
        fio="Куанышбекова Дана Маратовна",
        family=None,
        position="Экскурсовод",
        department="Экскурсионная служба",
        occupancy="Протокол жилищной комиссии (уточнить номер в первичных документах)",
        move_in=date(2020, 1, 1),
        room_count=3,
        total_area=Decimal("120.6"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("25238727"),
        market=Decimal("14410252.80"),
        protocol="Протокол жилищной комиссии",
        contract="Договор купли-продажи (100% оплата)",
        cost_year=2020,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="г. Астана, ул. Сембинова, дом 7, квартира 157",
        street="Сембинова",
        house_number="7",
        apartment_number="157",
        fio="Нурией Роза Сагынбаевна",
        family=None,
        position="Помощник костюмера",
        department="Костюмерный цех: Производственно - технический персонал",
        occupancy="Протокол № 71 от 26.12.2019",
        move_in=date(2019, 12, 27),
        room_count=3,
        total_area=Decimal("99.5"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("20822936"),
        market=Decimal("11889056.00"),
        protocol="Протокол № 71 от 26.12.2019",
        contract="Договор от 27.12.2019 (100% оплата)",
        cost_year=2019,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="г. Астана, ул. Сембинова, дом 7, квартира 30",
        street="Сембинова",
        house_number="7",
        apartment_number="30",
        fio="Низамутдинова Елена Нурисламовна",
        family=None,
        position="Артист балета",
        department="Балетная труппа: Творческий персонал",
        occupancy="Протокол жилищной комиссии (уточнить номер в первичных документах)",
        move_in=date(2019, 6, 1),
        room_count=3,
        total_area=Decimal("100.2"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("20963459"),
        market=Decimal("11972697.60"),
        protocol="Протокол жилищной комиссии",
        contract="Договор купли-продажи (100% оплата)",
        cost_year=2019,
    ),
    _p(
        complex_name="Жилой комплекс Хан-тенгри",
        address="г. Астана, ул. Сембинова, дом 7, квартира 27",
        street="Сембинова",
        house_number="7",
        apartment_number="27",
        fio="Мукашева Асель Бейбитовна",
        family=None,
        position="Артист (вокалист) хора",
        department="Хор: Творческий персонал",
        occupancy="Протокол жилищной комиссии (уточнить номер в первичных документах)",
        move_in=date(2021, 1, 1),
        room_count=3,
        total_area=Decimal("101"),
        build_year=2010,
        personal_account=None,
        initial=Decimal("21136910"),
        market=Decimal("12068268.00"),
        protocol="Протокол жилищной комиссии",
        contract="Договор купли-продажи (100% оплата)",
        cost_year=2021,
    ),
    _r(
        complex_name="Жилой комплекс Акку",
        address="Жилой комплекс Акку, ул. Е10, дом 5, кв. 165",
        street="Е10",
        house_number="5",
        apartment_number="165",
        fio="Уразов Арман Серикбаевич",
        family="супруга - Токтарбаева У.С., отец - Уразов С.М.",
        position="Артист балета - ведущий солист",
        department="Балетная труппа: Творческий персонал",
        occupancy="Протокол заседания жилищной комиссии от 08 февраля 2019 года № 57",
        move_in=date(2019, 2, 8),
        room_count=3,
        total_area=Decimal("93.5"),
        build_year=2014,
        personal_account="2801930",
        reimbursement=Decimal("38737.69"),
        taxable=Decimal("27055.00"),
        purchase_initial=Decimal("32466000"),
        act_text="Акт приема-передачи государственного имущества (см. первичный документ)",
        lease_contract="12-15/20 от 27.02.2026 г.",
        market_price=None,
    ),
]


def _already_exists(session, spec: dict) -> Apartment | None:
    acc = spec.get("personal_account")
    if acc:
        return session.scalars(select(Apartment).where(Apartment.personal_account == str(acc))).first()
    addr = (spec.get("address") or "").strip()
    if addr:
        return session.scalars(select(Apartment).where(Apartment.address == addr)).first()
    return None


def main() -> None:
    session = SyncSessionLocal()
    inserted = 0
    skipped = 0
    try:
        for spec in MANUAL_ROWS:
            existing = _already_exists(session, spec)
            if existing:
                key = spec.get("personal_account") or spec.get("address")
                print(f"Skip: already exists id={existing.id} ({key!r}).")
                skipped += 1
                continue

            apt = Apartment(
                residential_complex_name=spec["residential_complex_name"],
                district=None,
                street=spec.get("street"),
                house_number=spec.get("house_number"),
                apartment_number=spec.get("apartment_number"),
                address=spec["address"],
                housing_type=spec["housing_type"],
                apartment_subtype=spec["apartment_subtype"],
                room_count=spec.get("room_count"),
                total_area=spec.get("total_area"),
                living_area=None,
                build_year=spec.get("build_year"),
                personal_account=str(spec["personal_account"]) if spec.get("personal_account") else None,
                status=spec.get("status"),
            )
            session.add(apt)
            session.flush()

            rspec = spec["resident"]
            res = Resident(
                apartment_id=apt.id,
                full_name=rspec["full_name"],
                family_composition=rspec.get("family_composition"),
                position=rspec.get("position"),
                department=rspec.get("department"),
                move_in_date=rspec.get("move_in_date"),
                move_out_date=rspec.get("move_out_date"),
                occupancy_basis=rspec.get("occupancy_basis"),
                is_active=True,
            )
            session.add(res)
            session.flush()

            if spec.get("rental"):
                rf = spec["rental"]
                session.add(
                    RentalFinancials(
                        apartment_id=apt.id,
                        resident_id=res.id,
                        is_current=True,
                        market_price=rf.get("market_price"),
                        reimbursement_cost_monthly=rf.get("reimbursement_cost_monthly"),
                        taxable_base=rf.get("taxable_base"),
                    )
                )

            if spec.get("purchase"):
                pf = spec["purchase"]
                session.add(
                    PurchaseFinancials(
                        apartment_id=apt.id,
                        resident_id=res.id,
                        is_current=True,
                        initial_cost=pf.get("initial_cost"),
                        valuation_cost=pf.get("valuation_cost"),
                        initial_cost_year=pf.get("initial_cost_year"),
                        realization_period=pf.get("realization_period"),
                        purchase_contract=pf.get("purchase_contract"),
                    )
                )

            inserted += 1
            print(f"Inserted apartment id={apt.id} ({spec['address']!r}).")

        session.commit()
        print(f"Done. inserted={inserted}, skipped={skipped}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
