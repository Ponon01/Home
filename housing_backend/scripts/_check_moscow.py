# -*- coding: utf-8 -*-
from sqlalchemy import text
from app.db.session import SyncSessionLocal

s = SyncSessionLocal()
print("=== Moscow apartments ===")
for r in s.execute(
    text(
        """
        SELECT a.id, a.apartment_number, a.apartment_subtype::text,
               COALESCE(pf.initial_cost,0) AS init,
               COALESCE(pf.initial_payment,0) AS pay,
               COALESCE(pf.monthly_payment,0) AS mon,
               COALESCE(r.occupancy_basis,'') AS basis
        FROM apartments a
        LEFT JOIN purchase_financials pf ON pf.apartment_id=a.id AND pf.is_current
        LEFT JOIN residents r ON r.apartment_id=a.id AND r.is_active
        WHERE a.residential_complex_name = 'Москва'
        ORDER BY a.id
        """
    )
).all():
    print(r)

print("=== Moscow SUM ===")
print(
    s.execute(
        text(
            """
            SELECT COUNT(*), COALESCE(SUM(pf.initial_cost),0),
                   COALESCE(SUM(pf.initial_payment),0),
                   COALESCE(SUM(pf.monthly_payment),0)
            FROM apartments a
            LEFT JOIN purchase_financials pf ON pf.apartment_id=a.id AND pf.is_current
            WHERE a.residential_complex_name = 'Москва'
            """
        )
    ).one()
)

print("=== fund Москва ===")
print(
    s.execute(
        text(
            """
            SELECT * FROM dashboard_manual_summary
            WHERE residential_complex_name = 'Москва'
            """
        )
    ).mappings().first()
)
s.close()
