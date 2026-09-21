"""Ensure admin user exists with known credentials.

Usage:
  python -m scripts.ensure_admin
"""

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SyncSessionLocal
from app.models.role import Role
from app.models.user import User

DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"


def ensure_admin() -> None:
    session = SyncSessionLocal()
    try:
        role = session.scalars(select(Role).where(Role.name == "admin")).first()
        if role is None:
            role = Role(name="admin", description="Full access")
            session.add(role)
            session.flush()
            print("Created role 'admin'.")

        user = session.scalars(select(User).where(User.username == DEFAULT_USERNAME)).first()
        if user is None:
            user = User(
                username=DEFAULT_USERNAME,
                password_hash=hash_password(DEFAULT_PASSWORD),
                full_name="Администратор",
                role_id=role.id,
                is_active=True,
            )
            session.add(user)
            print(f"Created admin user '{DEFAULT_USERNAME}'.")
        else:
            user.password_hash = hash_password(DEFAULT_PASSWORD)
            user.role_id = role.id
            user.is_active = True
            user.full_name = user.full_name or "Администратор"
            print(f"Reset password for admin user '{DEFAULT_USERNAME}'.")

        # Keep legacy ponon account as working admin alias (same password family).
        ponon = session.scalars(select(User).where(User.username == "ponon")).first()
        if ponon is None:
            session.add(
                User(
                    username="ponon",
                    password_hash=hash_password(DEFAULT_PASSWORD),
                    full_name="Администратор",
                    role_id=role.id,
                    is_active=True,
                )
            )
            print("Created legacy admin alias 'ponon'.")
        else:
            ponon.password_hash = hash_password(DEFAULT_PASSWORD)
            ponon.role_id = role.id
            ponon.is_active = True

        session.commit()
        print(f"Admin login: {DEFAULT_USERNAME} / {DEFAULT_PASSWORD}")
        print(f"Admin gate password: {settings.ADMIN_GATE_PASSWORD}")
    finally:
        session.close()


if __name__ == "__main__":
    ensure_admin()
