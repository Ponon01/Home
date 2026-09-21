import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.housing_complex import HousingComplex

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Search all complexes
        res = await session.execute(select(HousingComplex))
        for c in res.scalars().all():
            print(f"Complex: ID={c.id}, Name='{c.name}', Address='{c.address}', District='{c.district}'")

        # Search apartments with street/address like Sembinova
        stmt = select(Apartment).where(
            Apartment.address.ilike("%Сембинова%") | Apartment.street.ilike("%Сембинова%")
        )
        apts = (await session.execute(stmt)).scalars().all()
        print(f"\nFound {len(apts)} apartments matching 'Сембинова':")
        for a in apts:
            print(f"  Apt ID {a.id}, Complex: '{a.residential_complex_name}', Apt No: {a.apartment_number}, Address: '{a.address}'")

if __name__ == "__main__":
    from sqlalchemy.orm import sessionmaker
    asyncio.run(main())
