import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.data.document_checklist import resolve_document_type
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.apartment import Apartment
from app.models.document import Document
from app.models.enums import DocumentType
from app.models.user import User
from app.schemas.document import DocumentRead, DocumentUploadResponse
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/pjpeg",
    "image/x-png",
}
ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}


def _safe_name(name: str) -> str:
    base = Path(name).name
    return base.replace("..", "_")[:500] or "file"


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    apartment_id: int | None = None,
    checklist_key: str | None = None,
    current_only: bool = True,
    db: AsyncSession = Depends(get_db),
) -> list[DocumentRead]:
    stmt = select(Document)
    if apartment_id is not None:
        stmt = stmt.where(Document.apartment_id == apartment_id)
    if checklist_key is not None:
        stmt = stmt.where(Document.document_group_key == checklist_key)
    if current_only:
        stmt = stmt.where(Document.is_current.is_(True))
    stmt = stmt.offset(skip).limit(min(limit, 500)).order_by(Document.uploaded_at.desc())
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [DocumentRead.model_validate(d) for d in items]


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    apartment_id: int = Form(...),
    file: UploadFile = File(...),
    document_type: DocumentType | None = Form(None),
    checklist_key: str | None = Form(None),
    resident_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentUploadResponse:
    apt = await db.get(Apartment, apartment_id)
    if not apt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apartment not found")

    original = _safe_name(file.filename or "upload")
    ext = Path(original).suffix.lower()
    mime = (file.content_type or "").lower()
    if ext not in ALLOWED_EXT and mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только файлы PDF, JPG, PNG",
        )

    group_key = (checklist_key or "").strip() or uuid.uuid4().hex
    resolved_type = document_type or resolve_document_type(group_key)

    prev_rows: list[Document] = []
    # Supersede previous current file for the same checklist slot
    if checklist_key:
        prev_rows = list(
            (
                await db.execute(
                    select(Document).where(
                        Document.apartment_id == apartment_id,
                        Document.document_group_key == group_key,
                        Document.is_current.is_(True),
                    )
                )
            ).scalars().all()
        )
        now = datetime.now(timezone.utc)
        for prev in prev_rows:
            prev.is_current = False
            prev.replaced_at = now
            prev.replace_reason = "Replaced by new upload"

    upload_root = settings.upload_path
    dest_dir = upload_root / "documents" / str(apartment_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    unique = f"{uuid.uuid4().hex}_{original}"
    dest_path = dest_dir / unique

    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    rel_path = str(dest_path.relative_to(upload_root)).replace("\\", "/")
    size = dest_path.stat().st_size if dest_path.is_file() else None

    version_no = 1
    previous_id = None
    if checklist_key:
        all_versions = list(
            (
                await db.execute(
                    select(Document).where(
                        Document.apartment_id == apartment_id,
                        Document.document_group_key == group_key,
                    )
                )
            ).scalars().all()
        )
        version_no = len(all_versions) + 1
        previous_id = prev_rows[0].id if prev_rows else None

    doc = Document(
        apartment_id=apartment_id,
        resident_id=resident_id,
        document_type=resolved_type,
        document_group_key=group_key,
        version_no=version_no,
        is_current=True,
        previous_version_id=previous_id,
        file_name=original,
        file_path=rel_path,
        mime_type=mime or None,
        file_size_bytes=size,
        uploaded_by=user.username if user else None,
    )
    db.add(doc)
    await db.flush()
    await write_audit_log(
        db,
        user=user,
        action="upload",
        entity_type="document",
        entity_id=doc.id,
        new_value={
            "apartment_id": apartment_id,
            "document_type": resolved_type.value,
            "checklist_key": checklist_key,
            "file_name": original,
        },
    )
    await db.refresh(doc)
    return DocumentUploadResponse.model_validate(doc)


@router.get("/{document_id}/download")
async def download_document(document_id: int, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    full = settings.upload_path / doc.file_path
    if not full.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
    return FileResponse(
        path=str(full),
        filename=doc.file_name,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.get("/{document_id}/view")
async def view_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """Inline view (same file, Content-Disposition inline via FileResponse filename only)."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    full = settings.upload_path / doc.file_path
    if not full.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
    return FileResponse(
        path=str(full),
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.file_name,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await write_audit_log(
        db,
        user=user,
        action="delete",
        entity_type="document",
        entity_id=doc.id,
        old_value=DocumentRead.model_validate(doc).model_dump(),
    )
    full = settings.upload_path / doc.file_path
    await db.delete(doc)
    await db.flush()
    if full.is_file():
        try:
            full.unlink()
        except OSError:
            pass
