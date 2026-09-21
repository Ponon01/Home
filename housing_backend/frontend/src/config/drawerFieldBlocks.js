import { HOUSING_RECORD_FIELDS } from "./housingRecordFields";
import { HOUSING_STATUS_EDIT_OPTIONS } from "./adminFilters";

const fieldMap = Object.fromEntries(HOUSING_RECORD_FIELDS.map((f) => [f.key, f]));

export const HOUSING_DRAWER_BLOCKS = [
  {
    title: "Личные данные",
    fields: [
      "fio",
      "position",
      "department",
      "family_composition",
      "residential_complex_name",
      "address",
    ],
  },
  {
    title: "Финансовые показатели",
    fields: ["initial_cost", "market_price", "reimbursement_cost_monthly", "taxable_base"],
  },
  {
    title: "Сроки и условия",
    fields: [
      "status",
      "residence_period",
      "room_count",
      "total_area",
      "build_year",
      "personal_account",
      "occupancy_and_purchase_basis",
      "rental_contract",
      "purchase_contract",
      "payment_schedule",
      "ownership_document",
    ],
  },
];

export function buildHousingDrawerFields(customHeaders = []) {
  const blocks = HOUSING_DRAWER_BLOCKS.map((block) => ({
    title: block.title,
    fields: block.fields.map((key) => {
      const base = fieldMap[key];
      if (key === "status") {
        return {
          key,
          label: base?.label || key,
          type: "select",
          options: [{ value: "", label: "—" }, ...HOUSING_STATUS_EDIT_OPTIONS],
        };
      }
      return base || { key, label: key, type: "text" };
    }),
  }));

  if (customHeaders.length) {
    blocks.push({
      title: "Дополнительные поля",
      fields: customHeaders.map((h) => ({ key: `extra:${h}`, label: h, type: "text" })),
    });
  }

  return blocks;
}

const PERSONAL_PATTERNS = /фио|адрес|жк|должност|отдел|состав/i;
const FINANCIAL_PATTERNS = /сумм|стоим|цена|итого|год|удерж|налог|оплат|платеж/i;

export function buildBudgetDrawerBlocks(headers = []) {
  const clean = headers.filter((h) => h !== "_id" && !h.startsWith("col_0"));
  const personal = [];
  const financial = [];
  const terms = [];

  for (const h of clean) {
    if (PERSONAL_PATTERNS.test(h)) personal.push(h);
    else if (FINANCIAL_PATTERNS.test(h)) financial.push(h);
    else terms.push(h);
  }

  const toFields = (keys) =>
    keys.map((key) => ({
      key,
      label: key,
      type: /договор|основан|график|адрес|протокол|справк/i.test(key) ? "textarea" : "text",
    }));

  return [
    { title: "Личные данные", fields: toFields(personal) },
    { title: "Финансовые показатели", fields: toFields(financial) },
    { title: "Сроки и условия", fields: toFields(terms) },
  ].filter((b) => b.fields.length > 0);
}

export function rowToHousingDraft(row, customHeaders = []) {
  const draft = {};
  HOUSING_RECORD_FIELDS.forEach((f) => {
    draft[f.key] = row?.[f.key] ?? "";
  });
  customHeaders.forEach((h) => {
    draft[`extra:${h}`] = row?.extra_fields?.[h] ?? "";
  });
  return draft;
}

export function housingDraftToPayload(draft, customHeaders = []) {
  const extra_fields = {};
  customHeaders.forEach((h) => {
    extra_fields[h] = draft[`extra:${h}`]?.trim() || null;
  });

  const toNumOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  return {
    residential_complex_name: draft.residential_complex_name?.trim() || null,
    address: draft.address?.trim() || null,
    fio: draft.fio?.trim() || null,
    family_composition: draft.family_composition?.trim() || null,
    initial_cost: toNumOrNull(draft.initial_cost),
    market_price: toNumOrNull(draft.market_price),
    reimbursement_cost_monthly: toNumOrNull(draft.reimbursement_cost_monthly),
    taxable_base: toNumOrNull(draft.taxable_base),
    status: draft.status?.trim() || null,
    residence_period: draft.residence_period?.trim() || null,
    room_count: toNumOrNull(draft.room_count),
    total_area: toNumOrNull(draft.total_area),
    build_year: toNumOrNull(draft.build_year),
    personal_account: draft.personal_account?.trim() || null,
    position: draft.position?.trim() || null,
    department: draft.department?.trim() || null,
    occupancy_and_purchase_basis: draft.occupancy_and_purchase_basis?.trim() || null,
    rental_contract: draft.rental_contract?.trim() || null,
    purchase_contract: draft.purchase_contract?.trim() || null,
    payment_schedule: draft.payment_schedule?.trim() || null,
    ownership_document: draft.ownership_document?.trim() || null,
    extra_fields,
  };
}
