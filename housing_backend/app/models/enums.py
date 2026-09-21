import enum


class ApartmentType(str, enum.Enum):
    rent = "rent"
    purchase = "purchase"


# Backward-compatible alias used by existing schemas/services.
HousingType = ApartmentType


class ApartmentSubtype(str, enum.Enum):
    rent = "rent"
    guest = "guest"
    guest_gph = "guest_gph"
    full_sold = "full_sold"
    installment = "installment"


class DocumentType(str, enum.Enum):
    rental_contract = "rental_contract"
    protocol = "protocol"
    purchase_contract = "purchase_contract"
    act = "act"
    payment_schedule = "payment_schedule"
    other = "other"
