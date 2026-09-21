"""Verify critical tables exist after alembic upgrade."""

from __future__ import annotations

import sys

from sqlalchemy import text

from app.db.session import SyncSessionLocal

REQUIRED = (
    "apartments",
    "residents",
    "housing_complexes",
    "dashboard_manual_summary",
)


def main() -> None:
    session = SyncSessionLocal()
    try:
        missing = []
        for table in REQUIRED:
            exists = session.execute(text(f"SELECT to_regclass('public.{table}')")).scalar()
            if not exists:
                missing.append(table)
        if missing:
            print(f"ERROR: missing tables after alembic: {', '.join(missing)}", file=sys.stderr)
            sys.exit(1)
        print("DB schema OK:", ", ".join(REQUIRED))
    finally:
        session.close()


if __name__ == "__main__":
    main()
