from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class HousingApplication(Base):
    __tablename__ = "housing_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fio: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    application_type: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending", index=True)

    signed_application_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_application_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    housing_certificate_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    housing_certificate_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    id_document_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    id_document_name: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    family_members: Mapped[list["HousingApplicationFamilyMember"]] = relationship(  # noqa: F821
        "HousingApplicationFamilyMember",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="HousingApplicationFamilyMember.id",
    )
