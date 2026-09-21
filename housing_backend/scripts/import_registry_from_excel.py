"""Import housing registry data from cleaned XLSX.

Usage:
  python -m scripts.import_registry_from_excel --file data/registry.xlsx
"""

from __future__ import annotations

import argparse
from pathlib import Path

import openpyxl
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SyncSessionLocal
from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype, ApartmentType
from app.models.resident import Resident
from app.models.role import Role
from app.models.user import User

DEFAULT_PASSWORD = "12345678"


def _norm(v: object) -> str:
    return str(v or "").strip()


def _subtype_from_category(raw: str) -> ApartmentSubtype:
    text = raw.lower()
    if "100" in text or "выкуплено" in text:
        return ApartmentSubtype.full_sold
    if "рассроч" in text:
        return ApartmentSubtype.installment
    if "гост" in text:
        return ApartmentSubtype.guest
    return ApartmentSubtype.rent


def _type_from_subtype(subtype: ApartmentSubtype) -> ApartmentType:
    return ApartmentType.purchase if subtype in {ApartmentSubtype.full_sold, ApartmentSubtype.installment} else ApartmentType.rent


def import_excel(path: Path) -> None:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if len(rows) < 2:
        print("No data rows in workbook")
        return

    headers = [_norm(h).lower() for h in rows[0]]
    idx = {h: i for i, h in enumerate(headers)}

    def get(row: tuple, *names: str) -> str:
        for n in names:
            i = idx.get(n)
            if i is not None and i < len(row):
                value = _norm(row[i])
                if value:
                    return value
        return ""

    session = SyncSessionLocal()
    created_users = 0
    imported_residents = 0
    try:
        role_user = session.scalar(select(Role).where(Role.name == "user"))
        if role_user is None:
            raise RuntimeError("Role 'user' not found")

        for row in rows[1:]:
            full_name = get(row, "фио", "full_name")
            if not full_name:
                continue
            iin = get(row, "иин", "iin")
            category = get(row, "категория", "category")
            complex_name = get(row, "жк", "residential_complex_name") or "Не указан"
            address = get(row, "адрес", "address")
            position = get(row, "должность", "position")
            department = get(row, "отдел", "department")

            subtype = _subtype_from_category(category)
            apartment = Apartment(
                residential_complex_name=complex_name,
                address=address or None,
                housing_type=_type_from_subtype(subtype),
                apartment_subtype=subtype,
                status="active",
            )
            session.add(apartment)
            session.flush()

            resident = Resident(
                apartment_id=apartment.id,
                full_name=full_name,
                iin=iin or None,
                position=position or None,
                department=department or None,
                is_active=True,
            )
            session.add(resident)
            imported_residents += 1

            if iin:
                existing_user = session.scalar(select(User).where(User.username == iin))
                if existing_user is None:
                    session.add(
                        User(
                            username=iin,
                            password_hash=hash_password(DEFAULT_PASSWORD),
                            full_name=full_name,
                            role_id=role_user.id,
                            is_active=True,
                        )
                    )
                    created_users += 1

        session.commit()
        print(f"Imported residents: {imported_residents}")
        print(f"Created users: {created_users}")
        print(f"Default password: {DEFAULT_PASSWORD}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import registry from XLSX")
    parser.add_argument("--file", required=True, help="Path to cleaned xlsx")
    args = parser.parse_args()
    import_excel(Path(args.file))


if __name__ == "__main__":
    main()
