import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.deps.auth import get_current_user, require_admin
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.user import User
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.dashboard_manual_summary import (
    ManualDashboardSummaryListResponse,
    ManualSummaryCreate,
    ManualSummaryRead,
    ManualSummaryUpdate,
)
from app.services.dashboard_service import get_dashboard_summary
from app.services.manual_dashboard_service import (
    create_manual_summary,
    delete_manual_summary,
    list_manual_summaries,
    update_manual_summary,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummaryResponse:
    return await get_dashboard_summary(db)


@router.get("/manual-summary", response_model=ManualDashboardSummaryListResponse)
async def get_manual_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ManualDashboardSummaryListResponse:
    rows = await list_manual_summaries(db)
    return ManualDashboardSummaryListResponse(rows=rows)


@router.post(
    "/manual-summary",
    response_model=ManualSummaryRead,
    status_code=status.HTTP_201_CREATED,
)
async def post_manual_dashboard_summary(
    body: ManualSummaryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> ManualSummaryRead:
    try:
        return await create_manual_summary(db, body, user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Запись с таким наименованием ЖК уже существует",
        ) from None


@router.patch("/manual-summary/{row_id}", response_model=ManualSummaryRead)
async def patch_manual_dashboard_summary(
    row_id: int,
    body: ManualSummaryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> ManualSummaryRead:
    try:
        row = await update_manual_summary(db, row_id, body, user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Запись с таким наименованием ЖК уже существует",
        ) from None
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return row


@router.delete("/manual-summary/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manual_dashboard_summary(
    row_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    ok = await delete_manual_summary(db, row_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post("/manual-summary/{row_id}/upload-photo", response_model=ManualSummaryRead)
async def upload_complex_photo(
    row_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> ManualSummaryRead:
    row = await db.get(DashboardManualSummary, row_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись ЖК не найдена")

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пожалуйста, загрузите файл изображения (jpeg, png, webp и т.д.)",
        )

    upload_root = settings.upload_path
    dest_dir = upload_root / "images_jk"
    dest_dir.mkdir(parents=True, exist_ok=True)

    original_name = Path(file.filename or "upload").name.replace("..", "_")
    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    dest_path = dest_dir / unique_name

    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    rel_path = f"images_jk/{unique_name}"
    
    if row.image_path:
        old_path = upload_root / row.image_path
        if old_path.is_file():
            try:
                old_path.unlink()
            except OSError:
                pass

    row.image_path = rel_path
    row.updated_by_user_id = user.id
    await db.commit()
    await db.refresh(row)

    return row


@router.delete("/manual-summary/{row_id}/delete-photo", response_model=ManualSummaryRead)
async def delete_complex_photo(
    row_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> ManualSummaryRead:
    row = await db.get(DashboardManualSummary, row_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись ЖК не найдена")

    if row.image_path:
        old_path = settings.upload_path / row.image_path
        if old_path.is_file():
            try:
                old_path.unlink()
            except OSError:
                pass

    row.image_path = None
    row.updated_by_user_id = user.id
    await db.commit()
    await db.refresh(row)

    return row
