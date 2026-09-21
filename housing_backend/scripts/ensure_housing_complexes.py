"""Ensure housing complex profiles exist for the housing fund editor and homepage.

Usage:
  python -m scripts.ensure_housing_complexes
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select, text

from app.data.canonical_complexes import CANONICAL_COMPLEXES
from app.db.session import SyncSessionLocal
from app.models.apartment import Apartment
from app.models.dashboard_manual_summary import DashboardManualSummary
from app.models.housing_complex import HousingComplex

DEFAULT_IMAGE_PATH = "images_jk/complex-placeholder.png"


def _slugify(value: str) -> str:
    text = value.strip().lower()
    for ch in " .,/\\:'\"()[]{}":
        text = text.replace(ch, "-")
    text = "-".join(part for part in text.split("-") if part)
    return text or "complex"


def _ensure_complex_photo(name: str, *, upload_root: Path | None = None) -> str:
    root = upload_root or Path("uploads")
    images_dir = root / "images_jk"
    images_dir.mkdir(parents=True, exist_ok=True)
    slug = _slugify(name)
    target = images_dir / f"{slug}.svg"
    if not target.exists():
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#123b2f" />
      <stop offset="100%" stop-color="#2f7f64" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f9d478" />
      <stop offset="100%" stop-color="#f8b900" />
    </linearGradient>
  </defs>
  <rect width="800" height="520" rx="28" fill="url(#bg)" />
  <rect x="42" y="42" width="716" height="436" rx="24" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.28)" />
  <circle cx="620" cy="176" r="112" fill="rgba(255,255,255,0.12)" />
  <path d="M180 360c56-92 118-130 188-132 72-2 130 44 184 132" fill="none" stroke="url(#accent)" stroke-width="12" stroke-linecap="round" />
  <path d="M214 332c37-53 82-82 124-84 48-2 92 24 124 84" fill="none" stroke="#fef3c7" stroke-width="8" stroke-linecap="round" opacity="0.8" />
  <rect x="96" y="120" width="240" height="96" rx="18" fill="rgba(255,255,255,0.18)" />
  <text x="116" y="170" fill="#fefce8" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">{name}</text>
  <text x="116" y="204" fill="#d8f3e5" font-family="Segoe UI, Arial, sans-serif" font-size="18">Жилой комплекс</text>
</svg>'''
        target.write_text(svg, encoding="utf-8")
    return f"images_jk/{target.name}"


def _normalize(raw: str | None) -> str | None:
    if not raw:
        return None
    text = str(raw).strip()
    lower = text.casefold()
    for prefix in ("жилой комплекс ", "жк "):
        if lower.startswith(prefix):
            text = text[len(prefix) :].strip(" «»\"'")
            lower = text.casefold()
            break
    rules = [
        (("акку", "аққу"), "Акку"),
        (("браво",), "Браво"),
        (("виктори",), "Виктория"),
        (("жагалау",), "Жагалау-3"),
        (("зерде",), "Зерде"),
        (("лазурн",), "Лазурный квартал"),
        (("москва",), "Москва"),
        (("нур-сая", "нурсая", "нұр-сая"), "НУР-САЯ"),
        (("общежити",), "Общежитие"),
        (("азирбаев", "азірбаев"), "ул. К. Азирбаева"),
        (("сапа",), "Сапа-2007"),
        (("сармат",), "Сармат"),
        (("хан-тенгри", "хан тенгри", "хантенгри"), "Хан-тенгри"),
        (("compass", "компас"), "Compass North"),
        (("respublika", "республик"), "Respublika"),
    ]
    for needles, canonical in rules:
        if any(n in lower for n in needles):
            return canonical
    return text


def build_seed_rows() -> list[dict[str, object]]:
    """Return canonical seed data for all 15 complexes and homepage cards."""

    # Official housing data from Excel table (актуально на 2026)
    OFFICIAL_DATA = {
        "Лазурный квартал": {"total": 22, "not_for_sale": 7, "for_sale": 15, "sold": 9, "remaining": 13, "rent": 6, "guest": 7},
        "Сармат":           {"total": 18, "not_for_sale": 0, "for_sale": 18, "sold": 14, "remaining": 4, "rent": 4, "guest": 0},
        "Зерде":            {"total": 10, "not_for_sale": 0, "for_sale": 10, "sold": 6, "remaining": 4, "rent": 4, "guest": 0},
        "Москва":           {"total": 1,  "not_for_sale": 0, "for_sale": 1,  "sold": 1, "remaining": 0, "rent": 0, "guest": 0},
        "Виктория":         {"total": 12, "not_for_sale": 0, "for_sale": 12, "sold": 8, "remaining": 4, "rent": 4, "guest": 0},
        "Жагалау-3":        {"total": 28, "not_for_sale": 2, "for_sale": 26, "sold": 20, "remaining": 8, "rent": 8, "guest": 0, "rent_as_flat": 6, "rent_as_dorm": 2, "dorm_flats_info": "кв. 43, 44"},
        "НУР-САЯ":          {"total": 10, "not_for_sale": 0, "for_sale": 10, "sold": 10, "remaining": 0, "rent": 0, "guest": 0},
        "Общежитие":        {"total": 53, "not_for_sale": 4, "for_sale": 49, "sold": 8, "remaining": 45, "rent": 45, "guest": 0},
        "Сапа-2007":        {"total": 25, "not_for_sale": 7, "for_sale": 18, "sold": 15, "remaining": 10, "rent": 10, "guest": 0, "rent_as_flat": 7, "rent_as_dorm": 3, "dorm_flats_info": "кв. 177, 181, 242"},
        "Хан-тенгри":       {"total": 11, "not_for_sale": 0, "for_sale": 11, "sold": 10, "remaining": 1, "rent": 1, "guest": 0},
        "Акку":             {"total": 20, "not_for_sale": 9, "for_sale": 10, "sold": 5, "remaining": 15, "rent": 10, "guest": 5, "rent_as_flat": 1, "rent_as_dorm": 9, "dorm_flats_info": "кв. 116, 128, 130, 153, 186, 424, 437, 514, 516"},
        "ул. К. Азирбаева": {"total": 10, "not_for_sale": 0, "for_sale": 10, "sold": 6, "remaining": 4, "rent": 4, "guest": 0},
        "Браво":            {"total": 2,  "not_for_sale": 0, "for_sale": 2,  "sold": 0, "remaining": 2, "rent": 2, "guest": 0},
        "Compass North":    {"total": 6,  "not_for_sale": 6, "for_sale": 0,  "sold": 0, "remaining": 6, "rent": 6, "guest": 0},
        "Respublika":       {"total": 26, "not_for_sale": 26, "for_sale": 0, "sold": 0, "remaining": 26, "rent": 22, "guest": 4},
    }

    rows: list[dict[str, object]] = []
    for item in CANONICAL_COMPLEXES:
        name = str(item["name"])
        image_path = _ensure_complex_photo(name)
        official = OFFICIAL_DATA.get(name, {})
        rent_val = official.get("rent", 0)
        rows.append(
            {
                "name": name,
                "district": item.get("district"),
                "address": item.get("address") or "Район, адрес",
                "build_year": None,
                "image_path": image_path,
                "total_count": official.get("total", 0),
                "for_sale_count": official.get("for_sale", 0),
                "sold_total": official.get("sold", 0),
                "remaining_total": official.get("remaining", 0),
                "rent_count": rent_val,
                "guest_count": official.get("guest", 0),
                "guest_gph_count": 0,
                "not_for_sale_count": official.get("not_for_sale", 0),
                "rent_as_flat": official.get("rent_as_flat", rent_val),
                "rent_as_dorm": official.get("rent_as_dorm", 0),
                "dorm_flats_info": official.get("dorm_flats_info", ""),
                "notes": f"Автоматически создано для {name}",
            }
        )
    return rows


def ensure_housing_complexes() -> None:
    """Create editable housing_complexes rows for all 15 canonical ЖК."""
    session = SyncSessionLocal()
    try:
        exists = session.execute(text("SELECT to_regclass('public.housing_complexes')")).scalar()
        if not exists:
            raise RuntimeError(
                "Table housing_complexes is missing. Run: alembic upgrade head"
            )

        existing_profiles = {row.name: row for row in session.scalars(select(HousingComplex)).all()}
        created_profiles = 0
        for item in build_seed_rows():
            name = item["name"]
            if name in existing_profiles:
                profile = existing_profiles[name]
                if item.get("district"):
                    profile.district = item.get("district")
                if item.get("address"):
                    profile.address = item.get("address")
                profile.rent_as_flat = int(item.get("rent_as_flat") or 0)
                profile.rent_as_dorm = int(item.get("rent_as_dorm") or 0)
                profile.dorm_flats_info = item.get("dorm_flats_info")
                continue
            session.add(
                HousingComplex(
                    name=name,
                    district=item.get("district"),
                    address=item.get("address") or "Район, адрес",
                    build_year=None,
                    rent_as_flat=int(item.get("rent_as_flat") or 0),
                    rent_as_dorm=int(item.get("rent_as_dorm") or 0),
                    dorm_flats_info=item.get("dorm_flats_info"),
                )
            )
            created_profiles += 1

        summary_rows = {
            row.residential_complex_name: row
            for row in session.scalars(select(DashboardManualSummary)).all()
        }
        created_summaries = 0
        for item in build_seed_rows():
            name = item["name"]
            summary = summary_rows.get(name)
            if summary is None:
                session.add(
                    DashboardManualSummary(
                        residential_complex_name=name,
                        total_count=int(item.get("total_count") or 0),
                        not_for_sale_count=int(item.get("not_for_sale_count") or 0),
                        for_sale_count=int(item.get("for_sale_count") or 0),
                        sold_total=int(item.get("sold_total") or 0),
                        remaining_total=int(item.get("remaining_total") or 0),
                        rent_count=int(item.get("rent_count") or 0),
                        guest_count=int(item.get("guest_count") or 0),
                        guest_gph_count=int(item.get("guest_gph_count") or 0),
                        rent_as_flat=int(item.get("rent_as_flat") or 0),
                        rent_as_dorm=int(item.get("rent_as_dorm") or 0),
                        dorm_flats_info=item.get("dorm_flats_info"),
                        notes=item.get("notes"),
                        image_path=item.get("image_path"),
                    )
                )
                created_summaries += 1
                continue
            # Не перетираем цифры Excel-импорта — только фото/метаданные
            if item.get("image_path"):
                summary.image_path = item.get("image_path")
            if item.get("dorm_flats_info") and not summary.dorm_flats_info:
                summary.dorm_flats_info = item.get("dorm_flats_info")
            if item.get("notes") and not summary.notes:
                summary.notes = item.get("notes")

        session.commit()

        summary_rows = list(session.scalars(select(DashboardManualSummary)).all())
        existing_norm = {
            _normalize(r.residential_complex_name) for r in summary_rows if r.residential_complex_name
        }
        apt_names = {
            _normalize(n)
            for n in session.scalars(select(Apartment.residential_complex_name).distinct()).all()
            if n
        }
        profile_count = len(list(session.scalars(select(HousingComplex)).all()))

        print(f"Canonical complexes: {len(CANONICAL_COMPLEXES)}")
        print(f"housing_complexes profiles: {profile_count} (created now: {created_profiles})")
        print(f"Dashboard summary rows: {len(summary_rows)} (created now: {created_summaries})")
        print(f"Summary rows present (normalized): {len(existing_norm - {None})}")
        print(f"Apartment complexes present (normalized): {len(apt_names - {None})}")
    finally:
        session.close()


if __name__ == "__main__":
    ensure_housing_complexes()
