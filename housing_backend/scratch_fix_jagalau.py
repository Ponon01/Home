import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Update Apt 44 of Жагалау-3 to subtype 'rent'
        stmt = (
            update(Apartment)
            .where(Apartment.residential_complex_name == "Жагалау-3")
            .where(Apartment.apartment_number == "44")
            .values(apartment_subtype=ApartmentSubtype.rent)
        )
        await session.execute(stmt)
        await session.commit()
        print("Updated Жагалау-3 Apt 44 status in DB.")

if __name__ == "__main__":
    asyncio.run(main())
