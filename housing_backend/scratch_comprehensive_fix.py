import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import selectinload, sessionmaker

from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype
from app.models.resident import Resident
from app.routers.housing_fund import list_complexes

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # ============================================================
        # FIX 1: Лазурный квартал — duplicates & guest count
        # ============================================================
        print("=== FIX 1: Лазурный квартал duplicates ===")
        stmt = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Лазурный квартал")
            .options(selectinload(Apartment.residents))
            .order_by(Apartment.apartment_number, Apartment.id)
        )
        laz_apts = (await session.execute(stmt)).scalars().all()

        # Group by apartment_number to find dupes
        by_num = {}
        for a in laz_apts:
            by_num.setdefault(a.apartment_number, []).append(a)

        for apt_num, group in by_num.items():
            if len(group) <= 1:
                continue
            print(f"  Duplicate apt {apt_num}: {len(group)} records")
            # Decide which to keep: keep the one with active residents, or the first one
            # For apt 78: keep the one with resident 'Бажбеук-Меликян', delete the empty duplicate
            # For apt 12: one is installment (Косырев), one is rent (Шангалиев) - these are different units in different buildings (Сарайшык 5В vs 5Д)
            # For apt 16: one is installment (Усик), one is installment (Гальберг) - same issue
            
            if apt_num == "78":
                # Keep the one with resident, delete empty
                to_keep = None
                to_delete = []
                for a in group:
                    active = [r for r in a.residents if r.is_active and r.full_name.strip()]
                    if active:
                        to_keep = a
                    else:
                        to_delete.append(a)
                if to_keep and to_delete:
                    for a in to_delete:
                        # Deactivate any residents first
                        for r in a.residents:
                            await session.delete(r)
                        await session.delete(a)
                        print(f"    Deleted empty duplicate apt 78 (ID {a.id})")
            # For apt 12 and 16: these are genuinely different apartments in different buildings
            # We need to keep both but give them distinct identifiers
            elif apt_num in ("12", "16"):
                # Check building info to determine which is which
                for a in group:
                    active = [r.full_name for r in a.residents if r.is_active]
                    addr = a.address or ""
                    print(f"    ID {a.id}: subtype={a.apartment_subtype}, addr='{addr}', residents={active}")
                # These are from different buildings (5В vs 5Д), keep them both but don't treat as duplicates

        # Now check: apt 105 (Шерстнева выехала) → mark as free
        for a in laz_apts:
            if a.apartment_number == "105":
                active_res = [r for r in a.residents if r.is_active]
                for r in active_res:
                    if "выехала" in (r.full_name or "").lower() or "выехал" in (r.full_name or "").lower():
                        r.is_active = False
                        print(f"  Apt 105: Deactivated '{r.full_name}' (выехала)")
                # Don't change subtype — stay guest but show as free on frontend

            # Apt 17: already has no active residents, keep guest subtype
            if a.apartment_number == "17":
                active_res = [r for r in a.residents if r.is_active]
                if not active_res:
                    print(f"  Apt 17: Already free (no active residents), subtype={a.apartment_subtype}")

        await session.flush()

        # Now add missing guest apartment to reach 7
        # Current guests: 17, 66, 76, 78, 105 = 5 after removing one 78 duplicate
        # According to OFFICIAL_DATA, Лазурный квартал has guest=7
        # Let's check what we have
        laz_apts_refresh = (await session.execute(
            select(Apartment)
            .where(Apartment.residential_complex_name == "Лазурный квартал")
        )).scalars().all()
        guest_count = sum(1 for a in laz_apts_refresh
                          if a.apartment_subtype in (ApartmentSubtype.guest, ApartmentSubtype.guest_gph))
        print(f"\n  Лазурный квартал guest count after fix: {guest_count}")
        print(f"  Total apartments after fix: {len(laz_apts_refresh)}")

        # ============================================================
        # FIX 2: Verify previously fixed complexes
        # ============================================================
        await session.commit()

        # Verify all complexes
        print("\n=== VERIFICATION: All complexes ===")
        cards = await list_complexes(db=session)
        for c in sorted(cards, key=lambda x: x.name):
            print(f"  {c.name}: Total={c.total_count}, Buyout={c.sold_count}, Inst={c.installment_count}, Rent={c.rent_count}, Guest={c.guest_count}, Free={c.free_count}")


if __name__ == "__main__":
    asyncio.run(main())
