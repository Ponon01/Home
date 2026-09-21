from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models import Apartment, ApartmentSubtype, ApartmentType, PurchaseFinancials, RentalFinancials, Resident
from scripts.import_utils import (
    get_or_create_apartment,
    get_or_create_resident,
    normalize_text,
    parse_decimal,
    parse_int,
)

DATA_DIR = Path("data")

APARTMENT_ALIASES = (
    "адрес",
    "address",
    "адрес_квартиры",
    "улица",
    "street",
    "квартира",
    "номер_квартиры",
    "номер_кв",
    "кв",
    "apartment_number",
)

COMPLEX_ALIASES = (
    "жк",
    "жилой_комплекс",
    "complex",
    "residential_complex",
    "комплекс",
    "жилищный_комплекс",
)

RESIDENT_ALIASES = (
    "фио",
    "fio",
    "владелец",
    "собственник",
    "житель",
    "full_name",
    "resident",
)

IIN_ALIASES = ("иин", "iin")
ROOM_ALIASES = ("количество_комнат", "rooms_count", "комнат")
AREA_TOTAL_ALIASES = ("общая_площадь", "total_area", "площадь_общая")
AREA_LIVING_ALIASES = ("жилая_площадь", "living_area", "площадь_жилая")
YEAR_ALIASES = ("год_постройки", "build_year")
ACCOUNT_ALIASES = ("личный_счет", "личевой_счет", "personal_account", "account")
STATUS_ALIASES = ("статус", "status", "состояние")
POSITION_ALIASES = ("должность", "position")
DEPARTMENT_ALIASES = ("подразделение", "department")
FAMILY_ALIASES = ("состав_семьи", "family_composition")
OCCUPANCY_ALIASES = ("основание_проживания", "occupancy_basis", "основание")
PRICE_ALIASES = (
    "сумма",
    "amount",
    "стоимость",
    "стоимость_квартиры",
    "market_price",
    "сумма_выкупа",
    "сумма_рассрочки",
    "initial_cost",
    "monthly_payment",
)


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if isinstance(df.columns, pd.MultiIndex):
        flat: list[str] = []
        for col in df.columns:
            parts = []
            for part in col:
                text = normalize_text(part)
                if text:
                    parts.append(text)
            flat.append("_".join(parts))
        df.columns = flat
    else:
        df.columns = [normalize_text(c) for c in df.columns]
    return df


def pick_value(row: dict, *aliases: str):
    for alias in aliases:
        if alias in row and row.get(alias) is not None:
            value = row.get(alias)
            if isinstance(value, float) and pd.isna(value):
                continue
            return value
    normalized_keys = {normalize_text(k).lower(): k for k in row.keys()}
    for key, original in normalized_keys.items():
        for alias in aliases:
            if normalize_text(alias).lower() == key:
                value = row.get(original)
                if value is not None:
                    if isinstance(value, float) and pd.isna(value):
                        continue
                    return value
    return None


def sheet_is_housing_like(columns: list[str]) -> bool:
    haystack = " ".join(str(c).lower() for c in columns)
    keywords = (
        "адрес",
        "жк",
        "квартира",
        "кв",
        "фио",
        "собствен",
        "комнат",
        "площад",
        "стоим",
        "выкуп",
        "расср",
        "договор",
        "address",
        "apartment",
        "owner",
        "amount",
    )
    return any(keyword in haystack for keyword in keywords)


def infer_financial_type(row: dict) -> tuple[ApartmentType, ApartmentSubtype]:
    text = " ".join(
        [
            normalize_text(pick_value(row, *STATUS_ALIASES)),
            normalize_text(pick_value(row, *PRICE_ALIASES)),
            normalize_text(pick_value(row, "договор", "contract", "тип")),
        ]
    ).lower()

    if any(token in text for token in ["выкуп", "купля", "продажа", "purchase", "sold"]):
        return ApartmentType.purchase, ApartmentSubtype.installment
    if any(token in text for token in ["расср", "installment", "payment plan"]):
        return ApartmentType.purchase, ApartmentSubtype.installment
    if any(token in text for token in ["найм", "аренда", "rent", "rental"]):
        return ApartmentType.rent, ApartmentSubtype.rent
    return ApartmentType.rent, ApartmentSubtype.rent


def choose_amount(row: dict) -> float | None:
    value = pick_value(row, *PRICE_ALIASES)
    return float(parse_decimal(value)) if parse_decimal(value) is not None else None


def build_apartment_data(row: dict) -> dict:
    address = normalize_text(pick_value(row, *APARTMENT_ALIASES))
    complex_name = normalize_text(pick_value(row, *COMPLEX_ALIASES)) or "Основной жилой фонд"
    apartment_number = normalize_text(pick_value(row, "квартира", "номер_квартиры", "номер_кв", "кв", "apartment_number"))
    return {
        "address": address,
        "complex_name": complex_name,
        "apartment_number": apartment_number,
        "status": normalize_text(pick_value(row, *STATUS_ALIASES)),
        "room_count": parse_int(pick_value(row, *ROOM_ALIASES)),
        "total_area": parse_decimal(pick_value(row, *AREA_TOTAL_ALIASES)),
        "living_area": parse_decimal(pick_value(row, *AREA_LIVING_ALIASES)),
        "build_year": parse_int(pick_value(row, *YEAR_ALIASES)),
        "personal_account": normalize_text(pick_value(row, *ACCOUNT_ALIASES)),
    }


def build_resident_data(row: dict) -> dict:
    name = normalize_text(pick_value(row, *RESIDENT_ALIASES))
    iin = normalize_text(pick_value(row, *IIN_ALIASES))
    return {
        "full_name": name,
        "iin": iin,
        "position": normalize_text(pick_value(row, *POSITION_ALIASES)),
        "department": normalize_text(pick_value(row, *DEPARTMENT_ALIASES)),
        "family_composition": normalize_text(pick_value(row, *FAMILY_ALIASES)),
        "occupancy_basis": normalize_text(pick_value(row, *OCCUPANCY_ALIASES)),
    }


def clear_tables(session) -> None:
    session.query(PurchaseFinancials).delete()
    session.query(RentalFinancials).delete()
    session.query(Resident).delete()
    session.query(Apartment).delete()
    session.commit()


def import_workbook(path: Path, reset: bool = False) -> dict:
    stats = {"apartments": 0, "residents": 0, "financial_rows": 0, "skipped": 0, "errors": 0}

    with SyncSessionLocal() as session:
        if reset:
            clear_tables(session)

        workbook = pd.ExcelFile(path, engine="openpyxl")
        for sheet_name in workbook.sheet_names:
            try:
                df = pd.read_excel(path, sheet_name=sheet_name, engine="openpyxl")
            except Exception:
                continue
            if df.empty:
                continue

            df = normalize_columns(df)
            if not sheet_is_housing_like(list(df.columns)):
                continue

            for _, row in df.iterrows():
                row_data = row.to_dict()
                apartment_data = build_apartment_data(row_data)
                if not apartment_data["address"]:
                    stats["skipped"] += 1
                    continue

                apartment_type, apartment_subtype = infer_financial_type(row_data)

                try:
                    apartment, apartment_created = get_or_create_apartment(
                        session,
                        address=apartment_data["address"],
                        residential_complex_name=apartment_data["complex_name"],
                        defaults={
                            "apartment_number": apartment_data["apartment_number"],
                            "status": apartment_data["status"],
                            "room_count": apartment_data["room_count"],
                            "total_area": apartment_data["total_area"],
                            "living_area": apartment_data["living_area"],
                            "build_year": apartment_data["build_year"],
                            "personal_account": apartment_data["personal_account"],
                            "housing_type": apartment_type,
                            "apartment_subtype": apartment_subtype,
                        },
                    )
                    if apartment_created:
                        stats["apartments"] += 1
                except Exception as exc:
                    stats["errors"] += 1
                    print(f"Apartment mapping failed for {path.name}: {exc}")
                    continue

                resident_data = build_resident_data(row_data)
                if resident_data["full_name"] or resident_data["iin"]:
                    try:
                        resident, resident_created = get_or_create_resident(
                            session,
                            apartment_id=apartment.id,
                            full_name=resident_data["full_name"] or resident_data["iin"] or "Неизвестный жилец",
                            defaults={
                                "iin": resident_data["iin"] or None,
                                "position": resident_data["position"],
                                "department": resident_data["department"],
                                "family_composition": resident_data["family_composition"],
                                "occupancy_basis": resident_data["occupancy_basis"],
                            },
                        )
                        if resident_created:
                            stats["residents"] += 1
                    except Exception as exc:
                        stats["errors"] += 1
                        print(f"Resident mapping failed for {path.name}: {exc}")
                        continue

                amount = choose_amount(row_data)
                if amount is None:
                    continue

                try:
                    if apartment_type == ApartmentType.purchase:
                        financial = session.scalars(
                            select(PurchaseFinancials).where(
                                PurchaseFinancials.apartment_id == apartment.id,
                                PurchaseFinancials.is_current.is_(True),
                            )
                        ).first()
                        if financial is None:
                            financial = PurchaseFinancials(apartment_id=apartment.id, is_current=True)
                            session.add(financial)
                        financial.resident_id = resident.id if "resident" in locals() else None
                        financial.initial_cost = amount
                        financial.valuation_cost = amount
                        financial.balance_cost = amount
                    else:
                        financial = session.scalars(
                            select(RentalFinancials).where(
                                RentalFinancials.apartment_id == apartment.id,
                                RentalFinancials.is_current.is_(True),
                            )
                        ).first()
                        if financial is None:
                            financial = RentalFinancials(apartment_id=apartment.id, is_current=True)
                            session.add(financial)
                        financial.resident_id = resident.id if "resident" in locals() else None
                        financial.market_price = amount
                        financial.reimbursement_cost_monthly = amount
                    stats["financial_rows"] += 1
                except Exception as exc:
                    stats["errors"] += 1
                    print(f"Financial mapping failed for {path.name}: {exc}")
                    continue

        session.commit()

    return stats


def iter_xlsx_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    files: list[Path] = []
    for item in sorted(directory.iterdir()):
        if item.is_file() and item.suffix.lower() == ".xlsx" and not item.name.startswith("~$"):
            files.append(item)
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description="Import housing Excel files into PostgreSQL by apartments, residents and finances.")
    parser.add_argument("--dir", default="data", help="Directory with Excel files.")
    parser.add_argument("--reset", action="store_true", help="Delete existing apartment/resident/financial rows before import.")
    args = parser.parse_args()

    files = iter_xlsx_files(Path(args.dir))
    if not files:
        print(f"No Excel files found in {args.dir}")
        return

    total = {"apartments": 0, "residents": 0, "financial_rows": 0, "skipped": 0, "errors": 0}
    for file_path in files:
        print(f"Importing {file_path.name}")
        result = import_workbook(file_path, reset=args.reset)
        for key in total:
            total[key] += result.get(key, 0)
        print(result)

    print("TOTAL:", total)


if __name__ == "__main__":
    main()
