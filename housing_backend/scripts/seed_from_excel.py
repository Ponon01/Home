"""Import real housing data from Excel files in data/ into PostgreSQL.

Usage:
  python -m scripts.seed_from_excel
  python -m scripts.seed_from_excel --reset          # truncate apartments first (default)
  python -m scripts.seed_from_excel --no-reset       # upsert without clearing

Docker:
  docker compose exec backend python -m scripts.seed_from_excel --reset
"""

from __future__ import annotations

import argparse
import sys

from app.services.excel_housing_import import run_excel_import


def main() -> None:
    parser = argparse.ArgumentParser(description="Import apartments from data/*.xlsx into PostgreSQL.")
    parser.add_argument(
        "--reset",
        action="store_true",
        default=True,
        help="Truncate apartments (CASCADE) before import (default: on).",
    )
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Do not truncate; upsert into existing data.",
    )
    args = parser.parse_args()
    reset = not args.no_reset

    try:
        stats = run_excel_import(reset=reset)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"IMPORT FAILED: {exc}", file=sys.stderr)
        raise

    if stats.errors:
        sys.exit(2)


if __name__ == "__main__":
    main()
