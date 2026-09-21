import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.deps.auth import require_admin
from app.models.housing_application import HousingApplication
from app.models.housing_application_family_member import HousingApplicationFamilyMember
from app.models.user import User
from app.schemas.housing_application import (
    HousingApplicationCreateResponse,
    HousingApplicationRead,
    HousingApplicationUpdate,
    STATUS_LABELS,
    APPLICATION_STATUS_OPTIONS,
)
from app.utils.model_updates import apply_updates

public_router = APIRouter(prefix="/public/housing-applications", tags=["public-housing-applications"])
admin_router = APIRouter(prefix="/housing-applications", tags=["housing-applications"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_BYTES = 10 * 1024 * 1024
DOC_FIELDS = ("signed_application", "housing_certificate", "id_document")
FAMILY_DOC_FIELDS = ("id_document", "housing_certificate")
DOCUMENTS_SUBDIR = "documents"


def _safe_name(name: str) -> str:
    base = Path(name).name
    return base.replace("..", "_")[:500] or "file"


def _validate_upload(file) -> None:
    filename = getattr(file, "filename", None) or ""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Файл «{filename}»: допустимы только PDF, JPG, JPEG, PNG. "
                f"/ «{filename}» файлы: тек PDF, JPG, JPEG, PNG форматтарына рұқсат."
            ),
        )


async def _save_upload(file, dest_dir: Path) -> tuple[str, str]:
    _validate_upload(file)
    original = _safe_name(file.filename or "upload")
    unique = f"{uuid.uuid4().hex}_{original}"
    dest_path = dest_dir / unique
    size = 0
    try:
        with dest_path.open("wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Файл «{original}» слишком большой (макс. 10 МБ). "
                            f"/ «{original}» файлы тым үлкен (макс. 10 МБ)."
                        ),
                    )
                buffer.write(chunk)
    finally:
        await file.close()
    rel = str(dest_path.relative_to(settings.upload_path))
    return rel, original


def _parse_family_members(raw: str | None) -> list[dict]:
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректные данные членов семьи / Отбасы мүшелерінің деректері дұрыс емес",
        ) from exc
    if not isinstance(data, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректные данные членов семьи / Отбасы мүшелерінің деректері дұрыс емес",
        )
    parsed = []
    for item in data:
        if not isinstance(item, dict):
            continue
        fio = str(item.get("fio", "")).strip()
        if not fio:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите ФИО каждого члена семьи / Әр отбасы мүшесінің ТАӘ-сін көрсетіңіз",
            )
        parsed.append(
            {
                "fio": fio,
                "relationship_degree": str(item.get("relationship", "")).strip() or None,
            }
        )
    return parsed


@public_router.post("", response_model=HousingApplicationCreateResponse, status_code=status.HTTP_201_CREATED)
async def submit_housing_application(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> HousingApplicationCreateResponse:
    form = await request.form()
    fio_clean = str(form.get("fio", "")).strip()
    if not fio_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите ФИО / ТАӘ көрсетіңіз",
        )

    position = str(form.get("position", "")).strip() or None
    department = str(form.get("department", "")).strip() or None
    application_type = str(form.get("application_type", "")).strip() or None
    family_members_data = _parse_family_members(str(form.get("family_members", "[]")))

    signed_application = form.get("signed_application")
    housing_certificate = form.get("housing_certificate")
    id_document = form.get("id_document")
    for label, file in (
        ("Подписанное заявление", signed_application),
        ("Справка eGov", housing_certificate),
        ("Удостоверение личности", id_document),
    ):
        if file is None or not getattr(file, "filename", None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Загрузите файл: {label} / Файлды жүктеңіз: {label}",
            )

    row = HousingApplication(
        fio=fio_clean,
        application_type=application_type,
        position=position,
        department=department,
        status="pending",
    )
    db.add(row)
    await db.flush()

    app_dir = settings.upload_path / DOCUMENTS_SUBDIR / str(row.id)
    app_dir.mkdir(parents=True, exist_ok=True)

    signed_path, signed_name = await _save_upload(signed_application, app_dir)
    cert_path, cert_name = await _save_upload(housing_certificate, app_dir)
    id_path, id_name = await _save_upload(id_document, app_dir)

    row.signed_application_path = signed_path
    row.signed_application_name = signed_name
    row.housing_certificate_path = cert_path
    row.housing_certificate_name = cert_name
    row.id_document_path = id_path
    row.id_document_name = id_name

    for index, member_data in enumerate(family_members_data):
        id_file = form.get(f"family_{index}_id_document")
        cert_file = form.get(f"family_{index}_housing_certificate")
        if id_file is None or not getattr(id_file, "filename", None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Загрузите удостоверение для «{member_data['fio']}» "
                    f"/ «{member_data['fio']}» үшін жеке куәлікті жүктеңіз"
                ),
            )
        if cert_file is None or not getattr(cert_file, "filename", None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Загрузите справку eGov для «{member_data['fio']}» "
                    f"/ «{member_data['fio']}» үшін eGov анықтамасын жүктеңіз"
                ),
            )

        member_row = HousingApplicationFamilyMember(
            application_id=row.id,
            fio=member_data["fio"],
            relationship_degree=member_data["relationship_degree"],
        )
        db.add(member_row)
        await db.flush()

        family_dir = app_dir / "family" / str(member_row.id)
        family_dir.mkdir(parents=True, exist_ok=True)

        member_id_path, member_id_name = await _save_upload(id_file, family_dir)
        member_cert_path, member_cert_name = await _save_upload(cert_file, family_dir)

        member_row.id_document_path = member_id_path
        member_row.id_document_name = member_id_name
        member_row.housing_certificate_path = member_cert_path
        member_row.housing_certificate_name = member_cert_name

    await db.commit()
    await db.refresh(row)

    return HousingApplicationCreateResponse(
        id=row.id,
        status=row.status,
        status_label=STATUS_LABELS.get(row.status, row.status),
    )


@admin_router.patch("/{application_id}", response_model=HousingApplicationRead)
async def update_housing_application(
    application_id: int,
    body: HousingApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> HousingApplicationRead:
    row = await db.get(HousingApplication, application_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if body.status is not None and body.status not in APPLICATION_STATUS_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый статус. Допустимо: {', '.join(APPLICATION_STATUS_OPTIONS)}",
        )

    if body.fio is not None and not body.fio.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ФИО не может быть пустым")

    apply_updates(row, body)
    await db.commit()

    result = await db.execute(
        select(HousingApplication)
        .options(selectinload(HousingApplication.family_members))
        .where(HousingApplication.id == application_id)
    )
    updated = result.scalar_one()
    return HousingApplicationRead.from_model(updated)


@admin_router.get("", response_model=list[HousingApplicationRead])
async def list_housing_applications(
    application_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[HousingApplicationRead]:
    stmt = (
        select(HousingApplication)
        .options(selectinload(HousingApplication.family_members))
        .order_by(HousingApplication.created_at.desc())
    )
    if application_type and application_type != "all":
        stmt = stmt.where(HousingApplication.application_type == application_type)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [HousingApplicationRead.from_model(r) for r in rows]


@admin_router.get("/{application_id}/download/{doc_field}")
async def download_application_document(
    application_id: int,
    doc_field: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if doc_field not in DOC_FIELDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown document field")

    row = await db.get(HousingApplication, application_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    path_attr = f"{doc_field}_path"
    name_attr = f"{doc_field}_name"
    rel_path = getattr(row, path_attr, None)
    file_name = getattr(row, name_attr, None) or "document"
    if not rel_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    abs_path = settings.upload_path / rel_path
    if not abs_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")

    return FileResponse(abs_path, filename=file_name)


@admin_router.get("/{application_id}/family/{member_id}/download/{doc_field}")
async def download_family_member_document(
    application_id: int,
    member_id: int,
    doc_field: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if doc_field not in FAMILY_DOC_FIELDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown document field")

    member = await db.get(HousingApplicationFamilyMember, member_id)
    if not member or member.application_id != application_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family member not found")

    path_attr = f"{doc_field}_path"
    name_attr = f"{doc_field}_name"
    rel_path = getattr(member, path_attr, None)
    file_name = getattr(member, name_attr, None) or "document"
    if not rel_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    abs_path = settings.upload_path / rel_path
    if not abs_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")

    return FileResponse(abs_path, filename=file_name)
