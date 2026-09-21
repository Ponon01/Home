from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class HousingApplicationFamilyMember(Base):
    __tablename__ = "housing_application_family_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("housing_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fio: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_degree: Mapped[str | None] = mapped_column(String(128), nullable=True)

    id_document_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    id_document_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    housing_certificate_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    housing_certificate_name: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped["HousingApplication"] = relationship(  # noqa: F821
        "HousingApplication",
        back_populates="family_members",
    )
