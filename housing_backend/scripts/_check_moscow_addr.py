# -*- coding: utf-8 -*-
from sqlalchemy import text
from app.db.session import SyncSessionLocal

s = SyncSessionLocal()
for r in s.execute(
    text(
        """
        SELECT id, apartment_number, address, street, house_number
        FROM apartments
        WHERE residential_complex_name = 'Москва'
        ORDER BY id
        """
    )
).all():
    print(r)
s.close()
