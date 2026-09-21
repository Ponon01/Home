"""Import apartment card workbooks (sheet: Лист2)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.db.session import SyncSessionLocal
from app.models import Document, DocumentType, PurchaseFinancials, RentalFinancials
from scripts.import_utils import (
    EXCEL_DIR,
    ImportStats,
    get_or_create_apartment,
    get_or_create_resident,
    infer_apartment_type_and_subtype,
    normalize_text,
    parse_decimal,
    parse_int,
    pick_column,
)


def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [
            " | ".join([normalize_text(x) for x in tup if normalize_text(x)])
            for tup in df.columns.to_list()
        ]
    else:
        df.columns = [normalize_text(c) for c in df.columns]
    return df


def _contract_doc_type(contract_text: str) -> DocumentType:
    low = contract_text.lower()
    if "найм" in low:
        return DocumentType.rental_contract
    if "купли" in low or "продаж" in low:
        return DocumentType.purchase_contract
    if "протокол" in low:
        return DocumentType.protocol
    return DocumentType.other


def import_workbook(path: Path, stats: ImportStats) -> None:
    df = pd.read_excel(path, sheet_name="Лист2", header=[0, 1], engine="openpyxl")
    df = _flatten_columns(df)
    session = SyncSessionLocal()
    try:
        c_address = pick_column(df.columns, "адрес")
        c_complex = pick_column(df.columns, "жк")
        c_full_name = pick_column(df.columns, "фио")
        c_family = pick_column(df.columns, "состав семьи")
        c_status = pick_column(df.columns, "статус квартиры")
        c_room_count = pick_column(df.columns, "количество комнат")
        c_total_area = pick_column(df.columns, "общая площадь")
        c_living_area = pick_column(df.columns, "жилая площадь")
        c_build_year = pick_column(df.columns, "год постройки")
        c_account = pick_column(df.columns, "лицевой счет")
        c_position = pick_column(df.columns, "должность")
        c_department = pick_column(df.columns, "подразделение")
        c_basis = pick_column(df.columns, "основание")
        c_purchase_contract = pick_column(df.columns, "договор купли")
        c_rent_contract = pick_column(df.columns, "договор найма")
        c_initial_cost = pick_column(df.columns, "первоначальная стоимость")
        c_market_price = pick_column(df.columns, "рыночная цена")
        c_withheld = pick_column(df.columns, "удержания из зп")
        c_taxable = pick_column(df.columns, "налогооблагаемая база")

        for i, row in df.iterrows():
            excel_row = int(i) + 3
            try:
                address = normalize_text(row.get(c_address)) if c_address else ""
                complex_name = normalize_text(row.get(c_complex)) if c_complex else ""
                if not address:
                    stats.skipped += 1
                    stats.log(f"{path.name}: skip row {excel_row}, column='{c_address}' (empty address)")
                    continue
                if not complex_name:
                    stats.skipped += 1
                    stats.log(f"{path.name}: skip row {excel_row}, column='{c_complex}' (empty complex)")
                    continue

                contract_hint = " ".join(
                    [
                        normalize_text(row.get(c_status)),
                        normalize_text(row.get(c_purchase_contract)),
                        normalize_text(row.get(c_rent_contract)),
                    ]
                )
                housing_type, subtype = infer_apartment_type_and_subtype(contract_hint)

                apartment, created = get_or_create_apartment(
                    session,
                    address=address,
                    residential_complex_name=complex_name,
                    defaults={
                        "room_count": parse_int(row.get(c_room_count)) if c_room_count else None,
                        "total_area": parse_decimal(row.get(c_total_area)) if c_total_area else None,
                        "living_area": parse_decimal(row.get(c_living_area)) if c_living_area else None,
                        "build_year": parse_int(row.get(c_build_year)) if c_build_year else None,
                        "personal_account": normalize_text(row.get(c_account)) if c_account else None,
                        "status": normalize_text(row.get(c_status)) if c_status else None,
                        "housing_type": housing_type,
                        "apartment_subtype": subtype,
                        "contract_hint": contract_hint,
                    },
                )
                stats.inserted += 1 if created else 0
                stats.updated += 0 if created else 1

                resident_name = normalize_text(row.get(c_full_name)) if c_full_name else ""
                resident = None
                if resident_name:
                    resident, res_created = get_or_create_resident(
                        session,
                        apartment_id=apartment.id,
                        full_name=resident_name,
                        defaults={
                            "family_composition": normalize_text(row.get(c_family)) if c_family else None,
                            "position": normalize_text(row.get(c_position)) if c_position else None,
                            "department": normalize_text(row.get(c_department)) if c_department else None,
                            "occupancy_basis": normalize_text(row.get(c_basis)) if c_basis else None,
                        },
                    )
                    stats.inserted += 1 if res_created else 0
                    stats.updated += 0 if res_created else 1

                if apartment.housing_type.value == "purchase":
                    pf = session.scalars(
                        select(PurchaseFinancials).where(
                            PurchaseFinancials.apartment_id == apartment.id,
                            PurchaseFinancials.is_current.is_(True),
                        )
                    ).first()
                    if pf is None:
                        pf = PurchaseFinancials(apartment_id=apartment.id, is_current=True)
                        session.add(pf)
                    pf.resident_id = resident.id if resident else pf.resident_id
                    pf.initial_cost = parse_decimal(row.get(c_initial_cost)) if c_initial_cost else pf.initial_cost
                    pf.valuation_cost = parse_decimal(row.get(c_market_price)) if c_market_price else pf.valuation_cost
                    if c_purchase_contract:
                        pf.purchase_contract = normalize_text(row.get(c_purchase_contract)) or pf.purchase_contract
                else:
                    rf = session.scalars(
                        select(RentalFinancials).where(
                            RentalFinancials.apartment_id == apartment.id,
                            RentalFinancials.is_current.is_(True),
                        )
                    ).first()
                    if rf is None:
                        rf = RentalFinancials(apartment_id=apartment.id, is_current=True)
                        session.add(rf)
                    rf.resident_id = resident.id if resident else rf.resident_id
                    rf.market_price = parse_decimal(row.get(c_market_price)) if c_market_price else rf.market_price
                    rf.reimbursement_cost_monthly = (
                        parse_decimal(row.get(c_withheld)) if c_withheld else rf.reimbursement_cost_monthly
                    )
                    rf.taxable_base = parse_decimal(row.get(c_taxable)) if c_taxable else rf.taxable_base

                for contract_col in [c_purchase_contract, c_rent_contract]:
                    if not contract_col:
                        continue
                    contract_text = normalize_text(row.get(contract_col))
                    if not contract_text:
                        continue
                    exists = session.scalars(
                        select(Document).where(
                            Document.apartment_id == apartment.id,
                            Document.file_name == contract_text[:512],
                        )
                    ).first()
                    if exists:
                        continue
                    session.add(
                        Document(
                            apartment_id=apartment.id,
                            resident_id=resident.id if resident else None,
                            document_type=_contract_doc_type(contract_text),
                            file_name=contract_text[:512],
                            file_path=f"imported/contracts/{apartment.id}",
                            mime_type="text/plain",
                            replace_reason="Imported from contract text",
                            uploaded_by="excel-import",
                        )
                    )
            except Exception as row_exc:
                session.rollback()
                stats.errors += 1
                stats.log(f"{path.name}: error row {excel_row} - {row_exc}")
                continue
            session.commit()
        stats.log(f"{path.name}: imported")
    except Exception as exc:
        session.rollback()
        stats.errors += 1
        stats.log(f"{path.name}: error - {exc}")
    finally:
        session.close()


def main() -> None:
    stats = ImportStats()
    files = sorted(EXCEL_DIR.glob("Надо заполнить новую таблицу *.xlsx"))
    for file_path in files:
        import_workbook(file_path, stats)
    stats.log(
        f"done: inserted={stats.inserted}, updated={stats.updated}, skipped={stats.skipped}, errors={stats.errors}"
    )


if __name__ == "__main__":
    main()
