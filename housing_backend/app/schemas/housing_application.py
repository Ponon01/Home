from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


STATUS_LABELS = {
    "pending": "В ожидании (Кутедi)",
    "approved": "Одобрено",
    "rejected": "Отклонено",
    "in_review": "На рассмотрении",
}

APPLICATION_STATUS_OPTIONS = list(STATUS_LABELS.keys())


class HousingApplicationFamilyMemberRead(BaseModel):
    id: int
    fio: str
    relationship_degree: str | None = None
    id_document_name: str | None = None
    housing_certificate_name: str | None = None
    has_id_document: bool = False
    has_housing_certificate: bool = False

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, row) -> "HousingApplicationFamilyMemberRead":
        return cls(
            id=row.id,
            fio=row.fio,
            relationship_degree=row.relationship_degree,
            id_document_name=row.id_document_name,
            housing_certificate_name=row.housing_certificate_name,
            has_id_document=bool(row.id_document_path),
            has_housing_certificate=bool(row.housing_certificate_path),
        )


class HousingApplicationRead(BaseModel):
    id: int
    fio: str
    application_type: str | None = None
    position: str | None = None
    department: str | None = None
    status: str
    status_label: str
    signed_application_name: str | None = None
    housing_certificate_name: str | None = None
    id_document_name: str | None = None
    has_signed_application: bool = False
    has_housing_certificate: bool = False
    has_id_document: bool = False
    family_members: list[HousingApplicationFamilyMemberRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, row) -> "HousingApplicationRead":
        members = getattr(row, "family_members", None) or []
        return cls(
            id=row.id,
            fio=row.fio,
            application_type=getattr(row, "application_type", None),
            position=row.position,
            department=row.department,
            status=row.status,
            status_label=STATUS_LABELS.get(row.status, row.status),
            signed_application_name=row.signed_application_name,
            housing_certificate_name=row.housing_certificate_name,
            id_document_name=row.id_document_name,
            has_signed_application=bool(row.signed_application_path),
            has_housing_certificate=bool(row.housing_certificate_path),
            has_id_document=bool(row.id_document_path),
            family_members=[HousingApplicationFamilyMemberRead.from_model(m) for m in members],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class HousingApplicationUpdate(BaseModel):
    fio: str | None = Field(None, max_length=255)
    application_type: str | None = Field(None, max_length=255)
    position: str | None = Field(None, max_length=255)
    department: str | None = Field(None, max_length=255)
    status: str | None = Field(None, max_length=64)


class HousingApplicationCreateResponse(BaseModel):
    id: int
    status: str
    status_label: str = Field(default="В ожидании (Кутедi)")
