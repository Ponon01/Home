import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.apartment import Apartment

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        res = await session.execute(select(Apartment))
        apts = res.scalars().all()
        
        with open("scratch_db_apts.txt", "w", encoding="utf-8") as f:
            f.write(f"Total apartments in DB: {len(apts)}\n")
            for a in apts[:100]:
                f.write(
                    f"ID: {a.id} | Complex: '{a.residential_complex_name}' | "
                    f"District: '{a.district}' | Street: '{a.street}' | "
                    f"House: '{a.house_number}' | Apt: '{a.apartment_number}' | "
                    f"Address: '{a.address}'\n"
                )

if __name__ == "__main__":
    asyncio.run(main())
