"""Create initial admin user. Usage: python -m scripts.create_admin ponon ponon171703"""

from __future__ import annotations

import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SyncSessionLocal
from app.models.role import Role
from app.models.user import User


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python -m scripts.create_admin <username> <password>")
        raise SystemExit(1)
    username = sys.argv[1].strip()
    password = sys.argv[2]
    session = SyncSessionLocal()
    try:
        role = session.scalars(select(Role).where(Role.name == "admin")).first()
        if role is None:
            print("Role 'admin' not found. Run migrations first.")
            raise SystemExit(1)
        existing = session.scalars(select(User).where(User.username == username)).first()
        if existing:
            print(f"User '{username}' already exists.")
            return
        user = User(username=username, password_hash=hash_password(password), role_id=role.id, is_active=True)
        session.add(user)
        session.commit()
        print(f"Admin user '{username}' created.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
