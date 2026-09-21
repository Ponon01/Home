import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import selectinload, sessionmaker

from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.enums import ApartmentSubtype
from app.models.resident import Resident
from app.routers.housing_fund import list_complexes

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Update all guest rooms in Общежитие to rent
        stmt_guest = (
            update(Apartment)
            .where(Apartment.residential_complex_name == "Общежитие")
            .where(Apartment.apartment_subtype.in_([ApartmentSubtype.guest, ApartmentSubtype.guest_gph]))
            .values(apartment_subtype=ApartmentSubtype.rent)
        )
        res_g = await session.execute(stmt_guest)
        print(f"Converted {res_g.rowcount} guest apartments in 'Общежитие' to subtype 'rent'.")

        # 2. Room 404: empty / vacant (deactivate resident)
        stmt_404 = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Общежитие")
            .where(Apartment.apartment_number == "404")
            .options(selectinload(Apartment.residents))
        )
        apt_404 = (await session.execute(stmt_404)).scalar_one_or_none()
        if apt_404:
            apt_404.status = "vacant"
            apt_404.apartment_subtype = ApartmentSubtype.rent
            for r in apt_404.residents:
                r.is_active = False
            print("Room 404 updated to vacant, residents deactivated.")

        # 3. Room 509: set resident to Қадырхан Мерей, status active, subtype rent
        stmt_509 = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Общежитие")
            .where(Apartment.apartment_number == "509")
            .options(selectinload(Apartment.residents))
        )
        apt_509 = (await session.execute(stmt_509)).scalar_one_or_none()
        if apt_509:
            apt_509.status = "active"
            apt_509.apartment_subtype = ApartmentSubtype.rent
            active_res = next((r for r in apt_509.residents if r.is_active), None)
            if not active_res and apt_509.residents:
                active_res = apt_509.residents[0]
            if active_res:
                active_res.full_name = "Қадырхан Мерей"
                active_res.is_active = True
            else:
                session.add(Resident(apartment_id=apt_509.id, full_name="Қадырхан Мерей", is_active=True))
            print("Room 509 updated: Resident = Қадырхан Мерей, subtype = rent.")

        # 4. Update DashboardManualSummary for Общежитие
        stmt_sum = (
            update(DashboardManualSummary)
            .where(DashboardManualSummary.residential_complex_name == "Общежитие")
            .values(guest_count=0, guest_gph_count=0)
        )
        await session.execute(stmt_sum)
        await session.commit()

        # 5. Verify returned summary card
        cards = await list_complexes(db=session)
        dorm_card = next((c for c in cards if c.name == "Общежитие"), None)
        if dorm_card:
            print("\n'Общежитие' Summary Card returned by list_complexes:")
            print(f"  total_count: {dorm_card.total_count}")
            print(f"  sold_count: {dorm_card.sold_count}")
            print(f"  installment_count: {dorm_card.installment_count}")
            print(f"  rent_count: {dorm_card.rent_count}")
            print(f"  guest_count: {dorm_card.guest_count}")
            print(f"  free_count: {dorm_card.free_count}")

if __name__ == "__main__":
    asyncio.run(main())
