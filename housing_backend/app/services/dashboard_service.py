"""
Dashboard aggregates per residential complex.

Business mapping (current data model):
- not_for_sale_count: rental pipeline (rent + guest + guest_gph subtypes).
- for_sale_count / remaining_total: purchase subtype installment (on realization / payment plan).
- full_sold_count: subtype full_sold.
- sold_2019..sold_2026: full_sold apartments whose sale year is taken from current
  purchase_financials.initial_cost_year, else year(last_payment_date), only if in 2019–2026.
- sold_total: sum of those yearly buckets (excludes full_sold outside range or without year).
- transfer_year: mode (most frequent) of initial_cost_year among full_sold rows with
  non-null initial_cost_year on current purchase financials; ties broken by latest year.
"""

from sqlalchemy import Integer, and_, case, cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apartment import Apartment
from app.models.enums import ApartmentSubtype
from app.models.purchase_financials import PurchaseFinancials
from app.schemas.dashboard import DashboardSummaryResponse, DashboardTableRow


def _current_purchase_financials_subquery():
    """One row per apartment: latest current purchase_financials by id."""
    rn = (
        func.row_number()
        .over(
            partition_by=PurchaseFinancials.apartment_id,
            order_by=PurchaseFinancials.id.desc(),
        )
        .label("rn")
    )
    ranked = (
        select(
            PurchaseFinancials.apartment_id,
            PurchaseFinancials.initial_cost_year,
            PurchaseFinancials.last_payment_date,
            rn,
        ).where(PurchaseFinancials.is_current.is_(True))
    ).subquery()
    return (
        select(
            ranked.c.apartment_id,
            ranked.c.initial_cost_year,
            ranked.c.last_payment_date,
        ).where(ranked.c.rn == 1)
    ).subquery()


async def get_dashboard_summary(db: AsyncSession) -> DashboardSummaryResponse:
    rent = ApartmentSubtype.rent
    guest = ApartmentSubtype.guest
    guest_gph = ApartmentSubtype.guest_gph
    full_sold = ApartmentSubtype.full_sold
    installment = ApartmentSubtype.installment

    pf = _current_purchase_financials_subquery()
    A = Apartment
    sold_year = cast(
        func.coalesce(pf.c.initial_cost_year, extract("year", pf.c.last_payment_date)),
        Integer,
    )

    def sold_in_year(y: int):
        return func.sum(
            case(
                (and_(A.apartment_subtype == full_sold, sold_year == y), 1),
                else_=0,
            )
        ).label(f"sold_{y}")

    stmt = (
        select(
            A.residential_complex_name.label("name"),
            func.count(A.id).label("total_count"),
            func.sum(case((A.apartment_subtype == rent, 1), else_=0)).label("rent_count"),
            func.sum(case((A.apartment_subtype == guest, 1), else_=0)).label("guest_count"),
            func.sum(case((A.apartment_subtype == guest_gph, 1), else_=0)).label("guest_gph_count"),
            func.sum(case((A.apartment_subtype == full_sold, 1), else_=0)).label("full_sold_count"),
            func.sum(case((A.apartment_subtype == installment, 1), else_=0)).label("installment_count"),
            func.sum(
                case(
                    (
                        A.apartment_subtype.in_((rent, guest, guest_gph)),
                        1,
                    ),
                    else_=0,
                )
            ).label("not_for_sale_count"),
            func.sum(case((A.apartment_subtype == installment, 1), else_=0)).label("for_sale_count"),
            sold_in_year(2019),
            sold_in_year(2020),
            sold_in_year(2021),
            sold_in_year(2022),
            sold_in_year(2023),
            sold_in_year(2024),
            sold_in_year(2025),
            sold_in_year(2026),
        )
        .select_from(A)
        .outerjoin(pf, pf.c.apartment_id == A.id)
        .group_by(A.residential_complex_name)
        .order_by(A.residential_complex_name)
    )

    result = await db.execute(stmt)
    rows = result.mappings().all()

    year_keys = [f"sold_{y}" for y in range(2019, 2027)]

    ty_stmt = (
        select(
            A.residential_complex_name.label("name"),
            pf.c.initial_cost_year.label("iy"),
            func.count().label("cnt"),
        )
        .select_from(A)
        .join(pf, pf.c.apartment_id == A.id)
        .where(A.apartment_subtype == full_sold)
        .where(pf.c.initial_cost_year.isnot(None))
        .group_by(A.residential_complex_name, pf.c.initial_cost_year)
    )
    ty_result = await db.execute(ty_stmt)
    buckets: dict[str, list[tuple[int, int]]] = {}
    for r in ty_result.mappings().all():
        n = r["name"]
        buckets.setdefault(n, []).append((int(r["iy"]), int(r["cnt"])))

    transfer_year_by_name: dict[str, int | None] = {}
    for name, pairs in buckets.items():
        if not pairs:
            continue
        max_cnt = max(c for _, c in pairs)
        candidates = [y for y, c in pairs if c == max_cnt]
        transfer_year_by_name[name] = max(candidates)

    complexes: list[DashboardTableRow] = []
    for row in rows:
        name = row["name"]
        sold_by_year = {k: int(row[k] or 0) for k in year_keys}
        sold_total = sum(sold_by_year.values())
        inst = int(row["installment_count"] or 0)
        complexes.append(
            DashboardTableRow(
                residential_complex_name=name,
                total_count=int(row["total_count"] or 0),
                not_for_sale_count=int(row["not_for_sale_count"] or 0),
                for_sale_count=int(row["for_sale_count"] or 0),
                transfer_year=transfer_year_by_name.get(name),
                sold_2019=sold_by_year["sold_2019"],
                sold_2020=sold_by_year["sold_2020"],
                sold_2021=sold_by_year["sold_2021"],
                sold_2022=sold_by_year["sold_2022"],
                sold_2023=sold_by_year["sold_2023"],
                sold_2024=sold_by_year["sold_2024"],
                sold_2025=sold_by_year["sold_2025"],
                sold_2026=sold_by_year["sold_2026"],
                sold_total=sold_total,
                remaining_total=inst,
                rent_count=int(row["rent_count"] or 0),
                guest_count=int(row["guest_count"] or 0),
                guest_gph_count=int(row["guest_gph_count"] or 0),
                full_sold_count=int(row["full_sold_count"] or 0),
                installment_count=inst,
            )
        )

    return DashboardSummaryResponse(complexes=complexes)
