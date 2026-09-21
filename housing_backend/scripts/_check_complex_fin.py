# -*- coding: utf-8 -*-
from sqlalchemy import text
from app.db.session import SyncSessionLocal

s = SyncSessionLocal()
print("=== by complex/subtype ===")
for r in s.execute(
    text(
        """
        SELECT residential_complex_name, apartment_subtype::text, COUNT(*)
        FROM apartments
        GROUP BY 1, 2
        ORDER BY 1, 2
        """
    )
).all():
    print(r)

print("=== Moscow detail ===")
for r in s.execute(
    text(
        """
        SELECT a.id, a.residential_complex_name, a.apartment_number,
               a.apartment_subtype::text, a.housing_type::text,
               COALESCE(pf.initial_cost,0), COALESCE(pf.initial_payment,0),
               COALESCE(pf.monthly_payment,0), COALESCE(r.occupancy_basis,''),
               COALESCE(rf.monthly_payment,0) AS rent_mon
        FROM apartments a
        LEFT JOIN purchase_financials pf ON pf.apartment_id=a.id AND pf.is_current
        LEFT JOIN rental_financials rf ON rf.apartment_id=a.id AND rf.is_current
        LEFT JOIN residents r ON r.apartment_id=a.id AND r.is_active
        WHERE lower(a.residential_complex_name) LIKE '%моск%'
           OR lower(a.residential_complex_name) LIKE '%сармат%'
           OR lower(a.residential_complex_name) LIKE '%жагалау%'
        ORDER BY a.residential_complex_name, a.apartment_number
        """
    )
).all():
    print(r)

print("=== fund summary Moscow ===")
for r in s.execute(
    text(
        """
        SELECT residential_complex_name, total_count, rent_count, sold_total
        FROM dashboard_manual_summary
        WHERE lower(residential_complex_name) LIKE '%моск%'
           OR lower(residential_complex_name) LIKE '%сармат%'
           OR lower(residential_complex_name) LIKE '%жагалау%'
        """
    )
).all():
    print(r)
s.close()
