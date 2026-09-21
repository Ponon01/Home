from app.schemas.apartment import ApartmentCreate, ApartmentRead, ApartmentUpdate
from app.schemas.auth import CreateUserRequest, LoginRequest, LoginResponse, RoleRead, UserRead
from app.schemas.dashboard import ComplexSummary, DashboardSummaryResponse, DashboardTableRow
from app.schemas.dashboard_manual_summary import (
    ManualDashboardSummaryListResponse,
    ManualSummaryCreate,
    ManualSummaryRead,
    ManualSummaryUpdate,
)
from app.schemas.document import DocumentCreate, DocumentRead, DocumentUploadResponse
from app.schemas.full_card import ApartmentFullCard
from app.schemas.purchase_financials import (
    PurchaseFinancialsCreate,
    PurchaseFinancialsRead,
    PurchaseFinancialsUpdate,
)
from app.schemas.purchase_payment_schedule import (
    PurchasePaymentScheduleCreate,
    PurchasePaymentScheduleRead,
    PurchasePaymentScheduleUpdate,
)
from app.schemas.rental_financials import (
    RentalFinancialsCreate,
    RentalFinancialsRead,
    RentalFinancialsUpdate,
)
from app.schemas.resident import ResidentCreate, ResidentRead, ResidentUpdate
from app.schemas.housing_department_record import (
    HousingDepartmentRecordCreate,
    HousingDepartmentRecordRead,
    HousingDepartmentRecordUpdate,
)
from app.schemas.erc_invoices import (
    ERCInvoiceListItem,
    ERCInvoiceOverdueItem,
    ERCInvoiceUploadResponse,
)

__all__ = [
    "ApartmentCreate",
    "ApartmentRead",
    "ApartmentUpdate",
    "ResidentCreate",
    "ResidentRead",
    "ResidentUpdate",
    "RentalFinancialsCreate",
    "RentalFinancialsRead",
    "RentalFinancialsUpdate",
    "PurchaseFinancialsCreate",
    "PurchaseFinancialsRead",
    "PurchaseFinancialsUpdate",
    "PurchasePaymentScheduleCreate",
    "PurchasePaymentScheduleRead",
    "PurchasePaymentScheduleUpdate",
    "DocumentCreate",
    "DocumentRead",
    "DocumentUploadResponse",
    "DashboardSummaryResponse",
    "DashboardTableRow",
    "ComplexSummary",
    "ManualDashboardSummaryListResponse",
    "ManualSummaryCreate",
    "ManualSummaryRead",
    "ManualSummaryUpdate",
    "ApartmentFullCard",
    "LoginRequest",
    "LoginResponse",
    "RoleRead",
    "UserRead",
    "CreateUserRequest",
    "HousingDepartmentRecordCreate",
    "HousingDepartmentRecordRead",
    "HousingDepartmentRecordUpdate",
    "ERCInvoiceListItem",
    "ERCInvoiceOverdueItem",
    "ERCInvoiceUploadResponse",
]
