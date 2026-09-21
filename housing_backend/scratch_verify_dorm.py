import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.apartment import Apartment
from app.routers.housing_fund import list_complexes, list_fund_apartments

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check summary card for Общежитие
        cards = await list_complexes(db=session)
        card = next((c for c in cards if c.name == "Общежитие"), None)
        if card:
            print("=== 'Общежитие' Summary Card ===")
            print(f"Total: {card.total_count}, Rent: {card.rent_count}, Guest: {card.guest_count}, Free: {card.free_count}")

        # Check apartments 404 & 509
        apts = await list_fund_apartments(complex_name="Общежитие", db=session)
        target_apts = [a for a in apts if a.apartment_number in ("404", "509")]
        print("\n=== Target Apartments ===")
        for a in target_apts:
            print(f"Apt No {a.apartment_number}: StatusKey='{a.status_key}', StatusLabel='{a.status_label}', Resident='{a.current_resident_name}'")

if __name__ == "__main__":
    asyncio.run(main())
