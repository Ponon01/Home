import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.enums import ApartmentSubtype

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 1. Fetch manual summaries
        res = await session.execute(select(DashboardManualSummary))
        summaries = {s.residential_complex_name: s for s in res.scalars().all()}
        
        # 2. Fetch all apartments
        res_apts = await session.execute(select(Apartment))
        apts = res_apts.scalars().all()
        
        # Group apartments by complex
        by_complex = {}
        for a in apts:
            by_complex.setdefault(a.residential_complex_name, []).append(a)
            
        print("Complex Name | DB Count (Apts) | Summary Count | Subtypes in DB")
        print("-" * 80)
        for cname, c_apts in by_complex.items():
            s = summaries.get(cname)
            s_str = f"Total={s.total_count} Sold={s.sold_total} Rent={s.rent_count} Guest={s.guest_count or s.guest_gph_count}" if s else "None"
            
            # Count subtypes in DB
            subtypes = {
                "buyout": sum(1 for a in c_apts if a.apartment_subtype == ApartmentSubtype.full_sold),
                "installment": sum(1 for a in c_apts if a.apartment_subtype == ApartmentSubtype.installment),
                "rent": sum(1 for a in c_apts if a.apartment_subtype == ApartmentSubtype.rent),
                "guest": sum(1 for a in c_apts if a.apartment_subtype in (ApartmentSubtype.guest, ApartmentSubtype.guest_gph)),
            }
            print(f"'{cname}':\n  DB Apts: {len(c_apts)} (Buyout={subtypes['buyout']}, Inst={subtypes['installment']}, Rent={subtypes['rent']}, Guest={subtypes['guest']})\n  Summary: {s_str}")

if __name__ == "__main__":
    asyncio.run(main())
