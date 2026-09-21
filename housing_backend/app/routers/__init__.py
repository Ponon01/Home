from app.routers.apartments import router as apartments_router
from app.routers.auth import router as auth_router
from app.routers.change_history import router as change_history_router
from app.routers.dashboard import router as dashboard_router
from app.routers.documents import router as documents_router
from app.routers.purchase_financials import router as purchase_financials_router
from app.routers.purchase_payment_schedule import router as purchase_payment_schedule_router
from app.routers.rental_financials import router as rental_financials_router
from app.routers.residents import router as residents_router
from app.routers.housing_department import router as housing_department_router
from app.routers.budget_rent import router as budget_rent_router
from app.routers.budget_purchase import router as budget_purchase_router
from app.routers.public_dashboard import router as public_dashboard_router
from app.routers.housing_applications import admin_router as housing_applications_admin_router
from app.routers.housing_applications import public_router as housing_applications_public_router
from app.routers.budget_excel import router as budget_excel_router
from app.routers.housing_registry import router as housing_registry_router
from app.routers.housing_fund import router as housing_fund_router
from app.routers.erc_invoices import router as erc_invoices_router
from app.routers.complexes import router as complexes_router

__all__ = [
    "apartments_router",
    "residents_router",
    "rental_financials_router",
    "purchase_financials_router",
    "purchase_payment_schedule_router",
    "documents_router",
    "dashboard_router",
    "auth_router",
    "change_history_router",
    "housing_department_router",
    "budget_rent_router",
    "budget_purchase_router",
    "public_dashboard_router",
    "housing_applications_admin_router",
    "housing_applications_public_router",
    "budget_excel_router",
    "housing_registry_router",
    "housing_fund_router",
    "erc_invoices_router",
    "complexes_router",
]
