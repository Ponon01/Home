# -*- coding: utf-8 -*-
"""Сверка агрегатов БД / excel-controls с контрольными цифрами."""
from sqlalchemy import text

from app.db.session import SyncSessionLocal

SALES = {
    "факт_2019_2025": 1_093_169_761.37,
    "факт_2026": 97_539_848.00,
    "факт_2026_плюс_остаток": 317_937_229.03,
    "затраты_модернизация_2025": 872_772_380.34,
    "остаток_после_модернизации": 220_397_381.03,
}

CONTROLS = {
    "control_installment_count": 111,
    "control_installment_initial_cost": 2_052_445_660.00,  # Excel; user typo 2_052_445_600
    "control_installment_initial_payment": 401_091_399.00,
    "control_installment_monthly": 7_947_706.00,
    "control_early_count": 34,
    "control_early_initial_cost": 652_289_417.00,
    # Excel SoT (user bal/val 604.8M/387.3M отличаются на 2 строки)
    "control_early_balance_cost": 621_991_943.17,
    "control_early_valuation_cost": 409_074_199.81,
    "control_fund_total": 254,
    "control_fund_not_for_sale": 61,
    "control_fund_for_sale": 192,
    "control_fund_rent": 135,
    "control_fund_guest": 7,
}


def main() -> None:
    s = SyncSessionLocal()
    try:
        print("=== SALES + CONTROLS ===")
        for label, expect in {**SALES, **CONTROLS}.items():
            amt = s.scalar(
                text("SELECT amount FROM housing_sales_receipts WHERE source_label=:l"),
                {"l": label},
            )
            got = float(amt or 0)
            mark = "OK" if abs(got - expect) < 0.05 else "FAIL"
            print(f"{mark} {label}: {got:,.2f} (expect {expect:,.2f})")

        print("=== OPERATIONAL SUBTYPES ===")
        for subtype in ("installment", "full_sold"):
            row = s.execute(
                text(
                    """
                    SELECT COUNT(*) AS n,
                      COALESCE(SUM(pf.initial_cost),0) AS init,
                      COALESCE(SUM(pf.initial_payment),0) AS pay,
                      COALESCE(SUM(pf.monthly_payment),0) AS mon
                    FROM apartments a
                    JOIN purchase_financials pf ON pf.apartment_id = a.id AND pf.is_current
                    WHERE a.apartment_subtype = :st
                    """
                ),
                {"st": subtype},
            ).one()
            print(
                f"{subtype}: n={row.n} init={float(row.init):,.2f} "
                f"pay={float(row.pay):,.2f} mon={float(row.mon):,.2f}"
            )

        print("=== FUND TABLE ===")
        row = s.execute(
            text(
                """
                SELECT COALESCE(SUM(total_count),0),
                       COALESCE(SUM(not_for_sale_count),0),
                       COALESCE(SUM(for_sale_count),0),
                       COALESCE(SUM(rent_count),0),
                       COALESCE(SUM(guest_count),0)
                FROM dashboard_manual_summary
                """
            )
        ).one()
        print(f"total={row[0]} nfs={row[1]} fs={row[2]} rent={row[3]} guest={row[4]}")
    finally:
        s.close()


if __name__ == "__main__":
    main()
