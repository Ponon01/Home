"""Load demo data (run from project root).

Usage:
  python -m scripts.seed              # skip if apartments already exist
  python -m scripts.seed --reset      # delete all apartments (cascades) then seed

Docker (after compose up):
  docker compose exec backend python -m scripts.seed --reset
"""

from __future__ import annotations

import argparse
from datetime import date

from sqlalchemy import select, text

from app.core.config import settings
from app.db.session import SyncSessionLocal
from app.models import Apartment, Document, PurchaseFinancials, PurchasePaymentSchedule, RentalFinancials, Resident
from app.models.enums import ApartmentSubtype, DocumentType, HousingType

COMPLEX_LAZURNY = "Лазурный квартал"
COMPLEX_SARMAT = "Сармат"


def _write_demo_file(apartment_id: int, file_name: str, content: str) -> str:
    rel = f"{apartment_id}/demo/{file_name}"
    dest = settings.upload_path / str(apartment_id) / "demo"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / file_name).write_text(content, encoding="utf-8")
    return rel.replace("\\", "/")


def seed(*, reset: bool = False) -> None:
    session = SyncSessionLocal()
    try:
        if reset:
            # RESTART IDENTITY so the next apartments get ids 1, 2, … (PostgreSQL)
            session.execute(text("TRUNCATE TABLE apartments RESTART IDENTITY CASCADE"))
            session.commit()
            print("Truncated apartments and related rows; sequences reset.")

        existing = session.scalars(select(Apartment).limit(1)).first()
        if existing is not None:
            print("Database already has apartments; skip seed. Use --reset to replace demo data.")
            return

        a1 = Apartment(
            residential_complex_name=COMPLEX_LAZURNY,
            district="Есиль",
            street="Достык",
            house_number="10",
            apartment_number="12",
            address="г. Астана, ЖК Лазурный квартал, ул. Достык, д. 10, кв. 12",
            housing_type=HousingType.rent,
            apartment_subtype=ApartmentSubtype.rent,
            room_count=3,
            total_area=82.0,
            living_area=44.5,
            build_year=2019,
            personal_account="LZ-0012",
            status="active",
        )
        a2 = Apartment(
            residential_complex_name=COMPLEX_LAZURNY,
            district="Есиль",
            street="Кабанбай батыра",
            house_number="5",
            apartment_number="88",
            address="г. Астана, ЖК Лазурный квартал, ул. Кабанбай батыра, д. 5, кв. 88",
            housing_type=HousingType.rent,
            apartment_subtype=ApartmentSubtype.guest,
            room_count=2,
            total_area=58.0,
            living_area=32.0,
            build_year=2017,
            personal_account="LZ-0088",
            status="active",
        )
        a3 = Apartment(
            residential_complex_name=COMPLEX_LAZURNY,
            district="Есиль",
            street="Сыганак",
            house_number="3",
            apartment_number="15",
            address="г. Астана, ЖК Лазурный квартал, ул. Сыганак, д. 3, кв. 15",
            housing_type=HousingType.rent,
            apartment_subtype=ApartmentSubtype.guest_gph,
            room_count=4,
            total_area=105.0,
            living_area=58.0,
            build_year=2016,
            personal_account="LZ-0015",
            status="active",
        )
        a4 = Apartment(
            residential_complex_name=COMPLEX_SARMAT,
            district="Алматы",
            street="Абая",
            house_number="120",
            apartment_number="42",
            address="г. Алматы, ЖК Сармат, пр. Абая, д. 120, кв. 42",
            housing_type=HousingType.purchase,
            apartment_subtype=ApartmentSubtype.full_sold,
            room_count=3,
            total_area=95.0,
            living_area=52.0,
            build_year=2014,
            personal_account="SR-0042",
            status="active",
        )
        a5 = Apartment(
            residential_complex_name=COMPLEX_SARMAT,
            district="Алматы",
            street="Сатпаева",
            house_number="22",
            apartment_number="7",
            address="г. Алматы, ЖК Сармат, ул. Сатпаева, д. 22, кв. 7",
            housing_type=HousingType.purchase,
            apartment_subtype=ApartmentSubtype.installment,
            room_count=2,
            total_area=61.5,
            living_area=34.0,
            build_year=2021,
            personal_account="SR-0007",
            status="active",
        )
        a6 = Apartment(
            residential_complex_name=COMPLEX_LAZURNY,
            district="Есиль",
            street="Туран",
            house_number="18",
            apartment_number="45",
            address="г. Астана, ЖК Лазурный квартал, ул. Туран, д. 18, кв. 45",
            housing_type=HousingType.rent,
            apartment_subtype=ApartmentSubtype.rent,
            room_count=2,
            total_area=54.0,
            living_area=30.0,
            build_year=2020,
            personal_account="LZ-0045",
            status="vacant",
        )
        session.add_all([a1, a2, a3, a4, a5, a6])
        session.flush()

        session.add_all(
            [
                Resident(
                    apartment_id=a1.id,
                    full_name="Сейдалиев Асхат Нурланович",
                    iin="900101300123",
                    family_composition="2 взрослых",
                    position="Солист",
                    department="Опера",
                    move_in_date=date(2022, 9, 1),
                    occupancy_basis="служебное жильё по договору найма",
                    cohabitation="нет",
                    cohabitant_count=0,
                    is_active=True,
                ),
                Resident(
                    apartment_id=a1.id,
                    full_name="Нурмагамбетов Ерлан",
                    position="Хормейстер",
                    department="Хор",
                    move_in_date=date(2019, 3, 1),
                    move_out_date=date(2022, 8, 20),
                    occupancy_basis="предыдущий жилец (история)",
                    is_active=False,
                    note="Выехал перед заселением текущего жильца",
                ),
                Resident(
                    apartment_id=a2.id,
                    full_name="Ким Елена Викторовна",
                    position="Хормейстер",
                    department="Хор",
                    move_in_date=date(2024, 2, 10),
                    occupancy_basis="гостевая квартира",
                    is_active=True,
                ),
                Resident(
                    apartment_id=a2.id,
                    full_name="Маэстро Роберто Альвизи",
                    position="Дирижёр",
                    department="Приглашённый артист",
                    move_in_date=date(2023, 11, 5),
                    move_out_date=date(2023, 11, 18),
                    occupancy_basis="гастроли / приказ №112",
                    is_active=False,
                    note="Краткосрочное бронирование гостевого фонда",
                ),
                Resident(
                    apartment_id=a3.id,
                    full_name="Омаров Данияр Талгатович",
                    family_composition="1 взрослый",
                    position="Артист балета",
                    department="Балет",
                    move_in_date=date(2025, 1, 5),
                    occupancy_basis="ГПХ / временное проживание",
                    is_active=True,
                ),
                Resident(
                    apartment_id=a4.id,
                    full_name="Жумабекова Айгуль Сериковна",
                    position="Концертмейстер",
                    department="Симфонический оркестр",
                    move_in_date=date(2015, 4, 20),
                    occupancy_basis="полная продажа",
                    is_active=True,
                ),
                Resident(
                    apartment_id=a5.id,
                    full_name="Нуртазин Бекжан Ерланович",
                    family_composition="2 взрослых, 1 ребёнок",
                    position="Музыкант",
                    department="Оркестр",
                    move_in_date=date(2021, 11, 1),
                    occupancy_basis="рассрочка",
                    is_active=True,
                ),
            ]
        )

        session.add(
            RentalFinancials(
                apartment_id=a1.id,
                valuation_object="Квартира (найм)",
                quantity=1,
                market_price=52_000_000,
                proportional_market_price=52_000_000,
                balance_value_2025=41_500_000,
                occupied_area_sp=82,
                contract_status="active",
                rental_contract_number="LZ-НАЙМ-2024-012",
                rental_contract_date=date(2024, 3, 1),
                reimbursement_cost_monthly=185_000,
                taxable_base=165_000,
            )
        )

        session.add_all(
            [
                PurchaseFinancials(
                    apartment_id=a4.id,
                    purchase_contract="SR-ПК-2015-042",
                    initial_cost=28_000_000,
                    initial_cost_year=2015,
                    realization_period="полная оплата",
                    balance_cost=0,
                    valuation_cost=42_000_000,
                    initial_payment=28_000_000,
                    remaining_debt=0,
                    last_payment_date=date(2015, 6, 30),
                ),
                PurchaseFinancials(
                    apartment_id=a5.id,
                    purchase_contract="SR-РС-2021-007",
                    initial_cost=35_000_000,
                    initial_cost_year=2021,
                    realization_period="рассрочка 10 лет",
                    balance_cost=18_500_000,
                    valuation_cost=38_000_000,
                    initial_payment=5_000_000,
                    repaid_amount_october=1_200_000,
                    remaining_debt=18_500_000,
                    monthly_payment=245_000,
                    last_payment_date=date(2026, 3, 15),
                ),
            ]
        )

        session.add_all(
            [
                PurchasePaymentSchedule(
                    apartment_id=a5.id,
                    year=2026,
                    month=3,
                    amount_due=245_000,
                    amount_paid=245_000,
                    note="март",
                ),
                PurchasePaymentSchedule(
                    apartment_id=a5.id,
                    year=2026,
                    month=4,
                    amount_due=245_000,
                    amount_paid=0,
                    note="апрель",
                ),
            ]
        )

        docs: list[Document] = []
        p1 = _write_demo_file(a1.id, "dogovor_naima.txt", "Демо: договор найма (ЖК Лазурный квартал)\n")
        docs.append(
            Document(
                apartment_id=a1.id,
                document_type=DocumentType.rental_contract,
                file_name="dogovor_naima.txt",
                file_path=p1,
                mime_type="text/plain",
            )
        )
        p2 = _write_demo_file(a2.id, "protokol_zasedaniya.txt", "Демо: протокол (гостевая квартира)\n")
        docs.append(
            Document(
                apartment_id=a2.id,
                document_type=DocumentType.protocol,
                file_name="protokol_zasedaniya.txt",
                file_path=p2,
                mime_type="text/plain",
            )
        )
        p3 = _write_demo_file(a4.id, "dogovor_kupli_prodazhi.txt", "Демо: договор купли-продажи (полная продажа)\n")
        docs.append(
            Document(
                apartment_id=a4.id,
                document_type=DocumentType.purchase_contract,
                file_name="dogovor_kupli_prodazhi.txt",
                file_path=p3,
                mime_type="text/plain",
            )
        )
        p4 = _write_demo_file(a5.id, "grafik_platezhey.txt", "Демо: график платежей (рассрочка)\n")
        docs.append(
            Document(
                apartment_id=a5.id,
                document_type=DocumentType.payment_schedule,
                file_name="grafik_platezhey.txt",
                file_path=p4,
                mime_type="text/plain",
            )
        )
        p5 = _write_demo_file(a1.id, "akt_priema.txt", "Демо: акт приёма-передачи\n")
        docs.append(
            Document(
                apartment_id=a1.id,
                document_type=DocumentType.act,
                file_name="akt_priema.txt",
                file_path=p5,
                mime_type="text/plain",
            )
        )
        session.add_all(docs)

        session.commit()
        print(
            "Seed completed: 5 apartments (3 Lazurny + 2 Sarmat), residents, "
            "rental_financials, purchase_financials, payment schedule, 5 demo documents."
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Insert demo housing data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Remove all apartments (CASCADE) before seeding.",
    )
    args = parser.parse_args()
    seed(reset=args.reset)


if __name__ == "__main__":
    main()
