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
from app.routers.housing_fund import list_complexes

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Rebind apts 123, 138, 27, 160 from Москва to Хан-тенгри
        stmt = (
            update(Apartment)
            .where(Apartment.residential_complex_name == "Москва")
            .where(Apartment.apartment_number.in_(["123", "138", "27", "160"]))
            .values(residential_complex_name="Хан-тенгри")
        )
        res = await session.execute(stmt)
        await session.commit()
        print(f"Updated {res.rowcount} apartments from Москва to Хан-тенгри.")

        # Check apartments in Москва
        stmt_moscow = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Москва")
            .options(selectinload(Apartment.residents))
        )
        moscow_apts = (await session.execute(stmt_moscow)).scalars().all()
        print(f"\nRemaining apartments in 'Москва': {len(moscow_apts)}")
        for a in moscow_apts:
            res_names = [r.full_name for r in a.residents if r.is_active]
            print(f"  Apt ID {a.id}, Apt No: {a.apartment_number}, Resident: {res_names}, Subtype: {a.apartment_subtype}")

        # Check apartments in Хан-тенгри
        stmt_khan = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Хан-тенгри")
        )
        khan_apts = (await session.execute(stmt_khan)).scalars().all()
        print(f"\nApartments in 'Хан-тенгри': {len(khan_apts)}")

        # Verify returned summary cards for Москва
        cards = await list_complexes(db=session)
        moscow_card = next((c for c in cards if c.name == "Москва"), None)
        if moscow_card:
            print("\nМосква Summary Card returned by list_complexes:")
            print(f"  total_count: {moscow_card.total_count}")
            print(f"  sold_count (Выкуп): {moscow_card.sold_count}")
            print(f"  installment_count (Рассрочка): {moscow_card.installment_count}")
            print(f"  rent_count (Аренда): {moscow_card.rent_count}")
            print(f"  guest_count (Гостевая): {moscow_card.guest_count}")
            print(f"  free_count (Свободно): {moscow_card.free_count}")

if __name__ == "__main__":
    asyncio.run(main())
