export const HOUSING_RECORD_FIELDS = [
  { key: "residential_complex_name", label: "Наименование ЖК" },
  { key: "address", label: "Адрес", type: "textarea" },
  { key: "fio", label: "ФИО" },
  { key: "family_composition", label: "Состав семьи", type: "textarea" },
  { key: "initial_cost", label: "Первоначальная стоимость", type: "number" },
  { key: "market_price", label: "Рыночная цена", type: "number" },
  { key: "reimbursement_cost_monthly", label: "Сумма удержания из ЗП", type: "number" },
  { key: "taxable_base", label: "Налогооблагаемая база", type: "number" },
  { key: "status", label: "Статус квартиры по приказу" },
  { key: "residence_period", label: "Период проживания" },
  { key: "room_count", label: "Количество комнат", type: "number" },
  { key: "total_area", label: "Общая площадь", type: "number" },
  { key: "build_year", label: "Год постройки", type: "number" },
  { key: "personal_account", label: "Лицевой счет" },
  { key: "position", label: "Должность", type: "textarea" },
  { key: "department", label: "Подразделение", type: "textarea" },
  { key: "occupancy_and_purchase_basis", label: "Основание для заселения", type: "textarea" },
  { key: "rental_contract", label: "Договор найма жилья", type: "textarea" },
  { key: "purchase_contract", label: "Договор купли-продажи", type: "textarea" },
  { key: "payment_schedule", label: "График платежей", type: "textarea" },
  { key: "ownership_document", label: "Документ права собственности", type: "textarea" },
];

export const APPLICATION_STATUS_OPTIONS = [
  { value: "pending", label: "В ожидании (Кутедi)" },
  { value: "in_review", label: "На рассмотрении" },
  { value: "approved", label: "Одобрено" },
  { value: "rejected", label: "Отклонено" },
];

export const APPLICATION_FIELDS = [
  { key: "fio", label: "ФИО" },
  { key: "position", label: "Должность" },
  { key: "department", label: "Отдел" },
  {
    key: "status",
    label: "Статус",
    type: "select",
    options: APPLICATION_STATUS_OPTIONS,
  },
];
