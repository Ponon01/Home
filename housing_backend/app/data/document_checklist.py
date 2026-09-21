"""Document checklist slots by apartment status for housing fund cards."""

from __future__ import annotations

from app.models.enums import DocumentType

# key → (label, document_type for storage)
RENT_SLOTS: list[tuple[str, str, DocumentType]] = [
    ("id_card", "Удостоверение личности (заявитель и супруг/-га)", DocumentType.other),
    ("marriage_cert", "Свидетельство о браке", DocumentType.other),
    ("birth_certs", "Свидетельства о рождении детей", DocumentType.other),
    ("rental_contract", "Договор найма", DocumentType.rental_contract),
    ("employee_application", "Заявление от сотрудника", DocumentType.other),
    ("protocol", "Протокол", DocumentType.protocol),
    ("order", "Приказ", DocumentType.other),
    ("notification", "Уведомление", DocumentType.other),
    ("tech_passport", "Техпаспорт", DocumentType.other),
    ("transfer_act", "Акт приема-передачи / Акт сдачи", DocumentType.act),
]

INSTALLMENT_SLOTS: list[tuple[str, str, DocumentType]] = [
    ("archive_rent", "Архивные документы (старая аренда)", DocumentType.other),
    ("purchase_contract", "Договор купли-продажи", DocumentType.purchase_contract),
    ("valuation_application", "Заявление на проведение оценки", DocumentType.other),
    ("payment_schedule", "График платежей", DocumentType.payment_schedule),
    ("protocol", "Протокол", DocumentType.protocol),
    ("order", "Приказ", DocumentType.other),
]

SOLD_SLOTS: list[tuple[str, str, DocumentType]] = [
    ("archive_all", "Весь архив предыдущих документов (Аренда/Рассрочка)", DocumentType.other),
    ("docs_transfer_act", "Акт приема-передачи документов", DocumentType.act),
]


def slots_for_status(status_key: str) -> list[dict[str, str]]:
    """Return checklist slots for UI status_key (rent/free/guest/installment/sold)."""
    if status_key in {"installment"}:
        raw = INSTALLMENT_SLOTS
        section = "Рассрочка"
    elif status_key in {"sold"}:
        raw = SOLD_SLOTS
        section = "100% Выкуп"
    else:
        # rent, free, guest, guest_gph — rental renewal pack
        raw = RENT_SLOTS
        section = "Аренда"

    return [
        {
            "key": key,
            "label": label,
            "document_type": doc_type.value,
            "section": section,
        }
        for key, label, doc_type in raw
    ]


def resolve_document_type(checklist_key: str, status_key: str | None = None) -> DocumentType:
    for slots in (RENT_SLOTS, INSTALLMENT_SLOTS, SOLD_SLOTS):
        for key, _label, doc_type in slots:
            if key == checklist_key:
                return doc_type
    return DocumentType.other
