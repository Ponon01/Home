from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.deps.auth import get_current_user
from app.routers import (
    apartments_router,
    auth_router,
    change_history_router,
    dashboard_router,
    documents_router,
    purchase_financials_router,
    purchase_payment_schedule_router,
    rental_financials_router,
    residents_router,
    housing_department_router,
    budget_rent_router,
    budget_purchase_router,
    public_dashboard_router,
    housing_applications_admin_router,
    housing_applications_public_router,
    budget_excel_router,
    housing_registry_router,
    housing_fund_router,
    erc_invoices_router,
    complexes_router,
)
from app.services.excel_housing_import import run_excel_import
from scripts.ensure_housing_complexes import ensure_housing_complexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    (settings.upload_path / "documents").mkdir(parents=True, exist_ok=True)
    (settings.upload_path / "images_jk").mkdir(parents=True, exist_ok=True)

    ensure_housing_complexes()

    try:
        from sqlalchemy import select

        from app.db.session import SyncSessionLocal
        from app.models.apartment import Apartment

        with SyncSessionLocal() as session:
            has_apartments = bool(session.scalar(select(Apartment.id).limit(1)))
        if not has_apartments:
            run_excel_import(reset=True)
    except Exception as exc:
        print(f"Startup seeding warning: {exc}")

    yield


app = FastAPI(
    title="Astana Opera Housing API",
    version="1.0.0",
    lifespan=lifespan,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.mount("/api/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")

allowed_origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    apartments_router,
    residents_router,
    rental_financials_router,
    purchase_financials_router,
    purchase_payment_schedule_router,
    documents_router,
    dashboard_router,
    change_history_router,
    housing_department_router,
    budget_rent_router,
    budget_purchase_router,
    housing_applications_admin_router,
    housing_registry_router,
    housing_fund_router,
    erc_invoices_router,
):
    app.include_router(router, prefix="/api", dependencies=[Depends(get_current_user)])

app.include_router(complexes_router, prefix="/api")

app.include_router(public_dashboard_router, prefix="/api")
app.include_router(housing_applications_public_router, prefix="/api")
app.include_router(budget_excel_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(auth_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
