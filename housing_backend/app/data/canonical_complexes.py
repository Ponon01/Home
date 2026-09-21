"""Canonical list of housing complexes (Astana Opera)."""

from __future__ import annotations

CANONICAL_COMPLEXES = [
    {"name": "Лазурный квартал", "city": "г. Астана", "address": "ул. Сарайшык 5", "district": "Есильский район"},
    {"name": "Сармат", "city": "г. Астана", "address": "ул. Сауран 3/1", "district": "Есильский район"},
    {"name": "Зерде", "city": "г. Астана", "address": "пр. Шакарим Кудайбердыулы 4", "district": "Алматинский район"},
    {"name": "Москва", "city": "г. Астана", "address": "ул. Иманова 17", "district": "Сарыаркинский район"},
    {"name": "Виктория", "city": "г. Астана", "address": "пр. Бауыржан Момышулы 2", "district": "Алматинский район"},
    {"name": "Жагалау-3", "city": "г. Астана", "address": "ул. Чингиз Айтматов 36", "district": "район Нура"},
    {"name": "НУР-САЯ", "city": "г. Астана", "address": "ул. Достык 13/2", "district": "Есильский район"},
    {"name": "Общежитие", "city": "г. Астана", "address": "пр. Республики 81", "district": "Сарыаркинский район"},
    {"name": "Сапа-2007", "city": "г. Астана", "address": "ул. Шаймерден Косшыгулулы 7", "district": "Сарыаркинский район"},
    {"name": "Хан-тенгри", "city": "г. Астана", "address": "ул. Сембинова 7", "district": "район Байконур"},
    {"name": "Акку", "city": "г. Астана", "address": "ул. Култегин 5", "district": "район Нура"},
    {"name": "ул. К. Азирбаева", "city": "г. Астана", "address": "ул. Кенен Азирбаева 6/2", "district": "район Сарайшык"},
    {"name": "Браво", "city": "г. Астана", "address": "ул. Шамши Калдаякова 17", "district": "район Сарайшык"},
    {"name": "Compass North", "city": "г. Астана", "address": "ул. Шамши Калдаякова 58/1", "district": "район Сарайшык"},
    {"name": "Respublika", "city": "г. Астана", "address": "ул. Е 36 дом 5", "district": "Есильский район"},
]

CANONICAL_COMPLEX_NAMES = [c["name"] for c in CANONICAL_COMPLEXES]


def normalize_complex_name(raw: str | None, *, address: str | None = None) -> str | None:
    """Map Excel / free-text ЖК names to one of the 15 canonical short names."""
    text = (raw or "").strip()
    if not text or text.casefold() in {"nan", "none", "null", "жк", "итого"}:
        text = (address or "").strip()
    if not text:
        return None

    # Prefer address when the cell is only a generic "ЖК"
    if text.casefold() == "жк" and address:
        text = address.strip()

    lower = text.casefold()
    for prefix in ("жилой комплекс ", "жк ", "жк«", 'жк"'):
        if lower.startswith(prefix):
            text = text[len(prefix) :].strip(" «»\"'")
            lower = text.casefold()
            break

    rules: list[tuple[tuple[str, ...], str]] = [
        (("акку", "аққу"), "Акку"),
        (("браво",), "Браво"),
        (("виктори",), "Виктория"),
        (("жагалау",), "Жагалау-3"),
        (("зерде",), "Зерде"),
        (("лазурн",), "Лазурный квартал"),
        (("москва",), "Москва"),
        (("нур-сая", "нурсая", "нұр-сая"), "НУР-САЯ"),
        (("общежити", "республики 81"), "Общежитие"),
        (("азирбаев", "азірбаев", "кенен"), "ул. К. Азирбаева"),
        (("сапа",), "Сапа-2007"),
        (("сармат",), "Сармат"),
        (("хан-тенгри", "хан тенгри", "хантенгри", "сембинов"), "Хан-тенгри"),
        (("compass", "компас"), "Compass North"),
        (("respublika", "республик"), "Respublika"),
        (("иманов",), "Москва"),
    ]
    for needles, canonical in rules:
        if any(n in lower for n in needles):
            return canonical

    for name in CANONICAL_COMPLEX_NAMES:
        if name.casefold() == lower:
            return name
    return text.strip() or None
