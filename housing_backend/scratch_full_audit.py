import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import selectinload, sessionmaker

from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype
from app.models.resident import Resident

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Лазурный квартал - check for duplicate apt 78 and guest apartments
        print("=" * 60)
        print("=== ЛАЗУРНЫЙ КВАРТАЛ ===")
        stmt = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Лазурный квартал")
            .options(selectinload(Apartment.residents))
            .order_by(Apartment.apartment_number)
        )
        apts = (await session.execute(stmt)).scalars().all()
        print(f"Total apartments: {len(apts)}")
        for a in apts:
            active_res = [r.full_name for r in a.residents if r.is_active]
            print(f"  Apt {a.apartment_number}: subtype={a.apartment_subtype}, status={a.status}, residents={active_res}")

        # Check for duplicate apartment numbers
        apt_nums = [a.apartment_number for a in apts]
        dupes = [n for n in apt_nums if apt_nums.count(n) > 1]
        if dupes:
            print(f"  DUPLICATES FOUND: {set(dupes)}")

        # 2. Сапа-2007 - check dorm apartments 177, 181, 242
        print("\n" + "=" * 60)
        print("=== САПА-2007 ===")
        stmt = (
            select(Apartment)
            .where(Apartment.residential_complex_name == "Сапа-2007")
            .options(selectinload(Apartment.residents))
            .order_by(Apartment.apartment_number)
        )
        apts = (await session.execute(stmt)).scalars().all()
        print(f"Total apartments: {len(apts)}")
        for a in apts:
            active_res = [(r.full_name, r.id) for r in a.residents if r.is_active]
            if a.apartment_number in ("177", "181", "242") or len(active_res) > 1:
                print(f"  Apt {a.apartment_number}: subtype={a.apartment_subtype}, residents={active_res}")

        # 3. Summary of all complexes
        print("\n" + "=" * 60)
        print("=== ALL COMPLEXES SUMMARY ===")
        stmt = (
            select(Apartment)
            .options(selectinload(Apartment.residents))
        )
        all_apts = (await session.execute(stmt)).scalars().all()

        by_complex = {}
        for a in all_apts:
            by_complex.setdefault(a.residential_complex_name, []).append(a)

        for name in sorted(by_complex.keys()):
            c_apts = by_complex[name]
            counts = {"buyout": 0, "installment": 0, "rent": 0, "guest": 0, "free": 0}
            for a in c_apts:
                has_active = any(r.is_active for r in a.residents)
                if a.apartment_subtype == ApartmentSubtype.full_sold:
                    counts["buyout"] += 1
                elif a.apartment_subtype == ApartmentSubtype.installment:
                    counts["installment"] += 1
                elif a.apartment_subtype in (ApartmentSubtype.guest, ApartmentSubtype.guest_gph):
                    counts["guest"] += 1
                elif not has_active:
                    counts["free"] += 1
                else:
                    counts["rent"] += 1
            print(f"{name}: Total={len(c_apts)}, Buyout={counts['buyout']}, Inst={counts['installment']}, Rent={counts['rent']}, Guest={counts['guest']}, Free={counts['free']}")


if __name__ == "__main__":
    asyncio.run(main())
