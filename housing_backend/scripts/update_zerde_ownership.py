"""
Align ЖК «Жилой комплекс Зерде» apartments with the canonical 10 residents and rent/purchase rules.
Run: PYTHONPATH=. python scripts/update_zerde_ownership.py
"""

from __future__ import annotations

import re

from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype, ApartmentType
from app.models.purchase_financials import PurchaseFinancials
from app.models.resident import Resident

ZERDE = "Жилой комплекс Зерде"


def norm_person(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def classify_zerde(full_name: str) -> tuple[str | None, str | None]:
    """Returns (bucket, canonical_key) where bucket is 'rent' or 'purchase'."""
    n = norm_person(full_name)
    if not n:
        return None, None
    rules: list[tuple[str, str, object]] = [
        (
            "мадияров дархан дилдабекович",
            "rent",
            lambda x: x == "мадияров дархан дилдабекович" or x.startswith("мадияров дархан дилдабекович "),
        ),
        (
            "есимханов болат амирбергенович",
            "rent",
            lambda x: x == "есимханов болат амирбергенович" or x.startswith("есимханов болат амирбергенович "),
        ),
        (
            "татмаков талгар",
            "purchase",
            lambda x: x == "татмаков талгар" or x.startswith("татмаков талгар "),
        ),
        (
            "кульбеков аскен",
            "purchase",
            lambda x: x == "кульбеков аскен" or x.startswith("кульбеков аскен "),
        ),
        (
            "фетисов евгений николаевич",
            "rent",
            lambda x: x == "фетисов евгений николаевич" or x.startswith("фетисов евгений николаевич "),
        ),
        (
            "искаков алишер аскарбекович",
            "rent",
            lambda x: x == "искаков алишер аскарбекович" or x.startswith("искаков алишер аскарбекович "),
        ),
        (
            "айдархан жансая",
            "purchase",
            lambda x: x == "айдархан жансая" or x.startswith("айдархан жансая "),
        ),
        (
            "ташкенбаев ерболат",
            "purchase",
            lambda x: x == "ташкенбаев ерболат" or x.startswith("ташкенбаев ерболат "),
        ),
        (
            "мустафина махаббат",
            "purchase",
            lambda x: x == "мустафина махаббат" or x.startswith("мустафина махаббат "),
        ),
        (
            "бейсембиев жанадил",
            "purchase",
            lambda x: x == "бейсембиев жанадил" or x.startswith("бейсембиев жанадил "),
        ),
    ]
    for key, cat, fn in rules:
        if fn(n):
            return cat, key
    return None, None


def main() -> None:
    with SyncSessionLocal() as session:
        apartments = (
            session.execute(select(Apartment).where(Apartment.residential_complex_name == ZERDE).order_by(Apartment.id))
            .scalars()
            .all()
        )

        rent_count = 0
        purchase_count = 0
        skipped = 0

        for apt in apartments:
            residents = (
                session.execute(
                    select(Resident).where(Resident.apartment_id == apt.id).order_by(Resident.id.asc())
                )
                .scalars()
                .all()
            )
            active = [r for r in residents if r.is_active]
            bucket = None
            primary: Resident | None = None
            for r in sorted(active, key=lambda x: x.id):
                b, _ = classify_zerde(r.full_name)
                if b:
                    bucket = b
                    primary = r
                    break

            if bucket is None:
                skipped += 1
                print(f"ORPHAN_NOT_IN_ALLOWLIST apartment_id={apt.id} address={apt.address!r}")
                continue

            pfs = (
                session.execute(
                    select(PurchaseFinancials).where(PurchaseFinancials.apartment_id == apt.id).order_by(PurchaseFinancials.id.desc())
                )
                .scalars()
                .all()
            )

            if bucket == "rent":
                apt.housing_type = ApartmentType.rent
                apt.apartment_subtype = ApartmentSubtype.rent
                for pf in pfs:
                    pf.is_current = False
                rent_count += 1
            else:
                apt.housing_type = ApartmentType.purchase
                has_contract = any(
                    pf.purchase_contract and str(pf.purchase_contract).strip() for pf in pfs
                )
                apt.apartment_subtype = ApartmentSubtype.installment if has_contract else ApartmentSubtype.full_sold
                if not pfs:
                    pf = PurchaseFinancials(
                        apartment_id=apt.id, resident_id=primary.id if primary else None, is_current=True
                    )
                    session.add(pf)
                else:
                    first = True
                    for pf in pfs:
                        pf.is_current = first
                        if first and primary:
                            pf.resident_id = primary.id
                        first = False
                purchase_count += 1

        session.commit()

        rent_rows = (
            session.execute(
                select(Apartment).where(
                    Apartment.residential_complex_name == ZERDE,
                    Apartment.apartment_subtype.in_((ApartmentSubtype.rent, ApartmentSubtype.guest, ApartmentSubtype.guest_gph)),
                )
            )
            .scalars()
            .all()
        )
        purchase_rows = (
            session.execute(
                select(Apartment).where(
                    Apartment.residential_complex_name == ZERDE,
                    Apartment.apartment_subtype.in_((ApartmentSubtype.full_sold, ApartmentSubtype.installment)),
                )
            )
            .scalars()
            .all()
        )
        all_rows = (
            session.execute(select(Apartment).where(Apartment.residential_complex_name == ZERDE)).scalars().all()
        )

        print(f"updated_rent={rent_count}")
        print(f"updated_purchase={purchase_count}")
        print(f"skipped_not_allowlist={skipped}")
        print(f"verify_budget_rent_rows={len(rent_rows)}")
        print(f"verify_budget_purchase_rows={len(purchase_rows)}")
        print(f"verify_housing_all_rows={len(all_rows)}")
        ok = len(rent_rows) == 4 and len(purchase_rows) == 6 and len(all_rows) == 10
        print(f"filtering_ok={'yes' if ok else 'no'}")


if __name__ == "__main__":
    main()
