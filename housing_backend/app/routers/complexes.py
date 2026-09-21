"""CRUD for editable housing complex (ЖК) profiles."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.canonical_complexes import CANONICAL_COMPLEXES, normalize_complex_name
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.housing_complex import HousingComplex
from app.models.user import User
from app.schemas.housing_complex import HousingComplexRead, HousingComplexUpdate
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/complexes", tags=["complexes"])


async def _ensure_complex_rows(db: AsyncSession) -> None:
    existing = {
        row.name: row
        for row in (await db.execute(select(HousingComplex))).scalars().all()
    }
    changed = False
    for item in CANONICAL_COMPLEXES:
        name = item["name"]
        if name in existing:
            continue
        db.add(
            HousingComplex(
                name=name,
                district=item.get("district"),
                address=item.get("address") or "Район, адрес",
                build_year=None,
            )
        )
        changed = True
    if changed:
        await db.flush()


def _row_to_read(row: HousingComplex) -> HousingComplexRead:
    return HousingComplexRead(
        id=row.id,
        name=row.name,
        district=row.district,
        address=row.address,
        build_year=row.build_year,
        created_at=getattr(row, "created_at", None),
        updated_at=getattr(row, "updated_at", None),
    )


@router.get("", response_model=list[HousingComplexRead])
async def list_complexes(db: AsyncSession = Depends(get_db)) -> list[HousingComplexRead]:
    await _ensure_complex_rows(db)
    rows = (await db.execute(select(HousingComplex).order_by(HousingComplex.name))).scalars().all()
    return [_row_to_read(r) for r in rows]


@router.get("/{complex_id}", response_model=HousingComplexRead)
async def get_complex(complex_id: int, db: AsyncSession = Depends(get_db)) -> HousingComplexRead:
    await _ensure_complex_rows(db)
    row = await db.get(HousingComplex, complex_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ЖК не найден")
    return _row_to_read(row)


@router.patch("/{complex_id}", response_model=HousingComplexRead)
@router.put("/{complex_id}", response_model=HousingComplexRead)
async def update_complex(
    complex_id: int,
    body: HousingComplexUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HousingComplexRead:
    try:
        await _ensure_complex_rows(db)
        row = await db.get(HousingComplex, complex_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ЖК не найден")

        old = _row_to_read(row).model_dump(mode="json")
        old_name = row.name
        data = body.model_dump(exclude_unset=True, exclude={"title", "year_built"})

        # Ensure aliases merged by validator are applied even if only alias was sent
        if "name" not in data and body.name is not None:
            data["name"] = body.name
        if "build_year" not in data and body.build_year is not None:
            data["build_year"] = body.build_year
        # Explicit null clear for build_year when year_built/build_year sent as null
        raw_dump = body.model_dump(exclude_unset=True)
        if "build_year" in raw_dump or "year_built" in raw_dump:
            data["build_year"] = body.build_year

        new_name = data.get("name")
        if new_name is not None:
            new_name = normalize_complex_name(new_name) or str(new_name).strip()
            if not new_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Название ЖК не может быть пустым",
                )
            if new_name != old_name:
                clash = (
                    await db.execute(select(HousingComplex).where(HousingComplex.name == new_name))
                ).scalar_one_or_none()
                if clash and clash.id != row.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="ЖК с таким названием уже существует",
                    )
                data["name"] = new_name

        for key, value in data.items():
            if hasattr(row, key):
                setattr(row, key, value)

        await db.flush()
        await db.refresh(row)

        if new_name and new_name != old_name:
            await db.execute(
                update(Apartment)
                .where(Apartment.residential_complex_name == old_name)
                .values(residential_complex_name=new_name)
            )
            summaries = (
                await db.execute(
                    select(DashboardManualSummary).where(
                        DashboardManualSummary.residential_complex_name == old_name
                    )
                )
            ).scalars().all()
            for summary in summaries:
                summary.residential_complex_name = new_name

        result = _row_to_read(row)
        await write_audit_log(
            db,
            user=user,
            action="update",
            entity_type="housing_complex",
            entity_id=row.id,
            old_value=old,
            new_value=result.model_dump(mode="json"),
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось сохранить ЖК: {exc}",
        ) from exc
