"""Ensure dashboard summary catalog without creating short-name duplicates.

Usage:
  python -m scripts.seed_dashboard_summary
"""

from scripts.ensure_housing_complexes import ensure_housing_complexes


def seed_dashboard_summary(*, force: bool = False) -> None:
    # force is intentionally ignored: never wipe/recreate homepage rows here.
    # Cleaning duplicates is a separate explicit operation.
    ensure_housing_complexes()
    print("Dashboard summary left intact (homepage source of truth).")


if __name__ == "__main__":
    seed_dashboard_summary()
