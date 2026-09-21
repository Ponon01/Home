export const HOUSING_STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "Гостиничный", label: "Гостиничный" },
  { value: "Общежитие", label: "Общежитие" },
  {
    value: "Квартира используемая в качестве общежития",
    label: "Квартира используемая в качестве общежития",
  },
  { value: "Квартира в аренде", label: "Квартира в аренде" },
  { value: "Квартира выкупленная", label: "Квартира выкупленная" },
];

export const HOUSING_STATUS_EDIT_OPTIONS = HOUSING_STATUS_OPTIONS.filter((o) => o.value);

export const ACQUISITION_CONDITION_OPTIONS = [
  { value: "", label: "Все условия" },
  { value: "100% выкуп (Сразу полностью)", label: "100% выкуп (Сразу полностью)" },
  { value: "Рассрочка на 5 лет", label: "Рассрочка на 5 лет" },
  { value: "Рассрочка на 10 лет", label: "Рассрочка на 10 лет" },
  { value: "Рассрочка на 15 лет", label: "Рассрочка на 15 лет" },
];

const ACQUISITION_KEYWORDS = {
  "100% выкуп (Сразу полностью)": ["100%", "сразу полностью", "полный выкуп"],
  "Рассрочка на 5 лет": ["5 лет", "5-лет", "5лет"],
  "Рассрочка на 10 лет": ["10 лет", "10-лет", "10лет"],
  "Рассрочка на 15 лет": ["15 лет", "15-лет", "15лет"],
};

export function matchesAcquisitionCondition(text, filterValue) {
  if (!filterValue) return true;
  const haystack = String(text || "").toLowerCase();
  const keywords = ACQUISITION_KEYWORDS[filterValue] || [filterValue.toLowerCase()];
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export function findHeader(headers, pattern) {
  return headers.find((h) => pattern.test(h)) || null;
}
