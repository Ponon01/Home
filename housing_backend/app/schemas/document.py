from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import DocumentType


class DocumentCreate(BaseModel):
    apartment_id: int
    resident_id: int | None = None
    document_type: DocumentType
    document_group_key: str
    version_no: int = 1
    is_current: bool = True
    previous_version_id: int | None = None
    replace_reason: str | None = None
    file_name: str
    file_path: str
    mime_type: str | None = None
    file_size_bytes: int | None = None
    checksum_sha256: str | None = None
    uploaded_by: str | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    apartment_id: int
    resident_id: int | None
    document_type: DocumentType
    document_group_key: str
    version_no: int
    is_current: bool
    previous_version_id: int | None
    replaced_at: datetime | None
    replace_reason: str | None
    file_name: str
    file_path: str
    mime_type: str | None
    file_size_bytes: int | None
    checksum_sha256: str | None
    uploaded_by: str | None
    uploaded_at: datetime


class DocumentUploadResponse(DocumentRead):
    pass
