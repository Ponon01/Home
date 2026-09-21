import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype
from app.routers.housing_fund import list_complexes

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Call the actual route logic function directly!
        res = await list_complexes(db=session)
        
        target = next((c for c in res if c.name == "Жагалау-3"), None)
        if target:
            print("Жагалау-3 stats returned by list_complexes:")
            print(f"  total_count: {target.total_count}")
            print(f"  rent_count: {target.rent_count}")
            print(f"  installment_count: {target.installment_count}")
            print(f"  sold_count: {target.sold_count}")
            print(f"  guest_count: {target.guest_count}")
            print(f"  free_count: {target.free_count}")
            
            # Check if they are: 28, 8, 17, 3, 0, 0
            if (target.total_count == 28 and target.rent_count == 8 and 
                target.installment_count == 17 and target.sold_count == 3 and 
                target.guest_count == 0):
                print("SUCCESS: Counts are correct!")
            else:
                print("FAILURE: Counts do not match expected!")
        else:
            print("Жагалау-3 not found in list_complexes output!")

if __name__ == "__main__":
    asyncio.run(main())
