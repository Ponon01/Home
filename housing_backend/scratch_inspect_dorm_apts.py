import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import selectinload, sessionmaker

from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.resident import Resident

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Search apartments in 'Общежитие'
        stmt = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Общежитие")
            .options(selectinload(Apartment.residents))
        )
        apts = (await session.execute(stmt)).scalars().all()
        print(f"Total 'Общежитие' apartments in DB: {len(apts)}")

        for a in apts:
            if a.apartment_number in ("404", "509") or a.apartment_subtype in ("guest", "guest_gph"):
                res_info = [(r.id, r.full_name, r.is_active) for r in a.residents]
                print(f"Apt ID {a.id}, No: {a.apartment_number}, Subtype: {a.apartment_subtype}, Status: {a.status}, Residents: {res_info}")

if __name__ == "__main__":
    asyncio.run(main())
