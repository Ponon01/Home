"""Ensure admin user 'ponon' exists. Run: python -m scripts.ensure_ponon_admin

Deprecated: use `python -m scripts.ensure_admin` (admin / admin123).
"""

from scripts.ensure_admin import ensure_admin


if __name__ == "__main__":
    ensure_admin()
