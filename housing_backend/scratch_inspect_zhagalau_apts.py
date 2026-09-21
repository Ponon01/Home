import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.apartment import Apartment
from app.models.resident import Resident

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Fetch Жагалау-3 apartments
        stmt = select(Apartment).where(Apartment.residential_complex_name == "Жагалау-3")
        res = await session.execute(stmt)
        apts = res.scalars().all()
        print(f"Total Жагалау-3 apartments in DB: {len(apts)}")
        
        for a in apts:
            print(f"Apt {a.apartment_number}: housing_type='{a.housing_type}', subtype='{a.apartment_subtype}', status='{a.status}'")

if __name__ == "__main__":
    asyncio.run(main())
