import { CANONICAL_COMPLEX_SEEDS, buildFallbackComplexes } from "../utils/complexMockFallback";
import { getExcelDefaults } from "../utils/complexExcelDefaults";

const FIRST_NAMES = [
  "Айгерим", "Нурила", "Ерлан", "Данияр", "Асель", "Марат", "Жанна", "Тимур",
  "Сауле", "Арман", "Камила", "Бауржан", "Алия", "Серік", "Динара", "Нурлан",
];
const LAST_NAMES = [
  "Касымова", "Сериков", "Абдуллаева", "Нурланов", "Искакова", "Жумабаев",
  "Оспанова", "Тулегенов", "Бекмуратова", "Садыков", "Мухамедова", "Ермеков",
];

const STATUS_LABEL = {
  rent: "🟡 Аренда",
  installment: "🔵 Рассрочка",
  sold: "🔴 Выкуп",
  guest: "🟣 Гостевая",
  free: "🟢 Свободно",
};

function pick(arr, i) {
  return arr[i % arr.length];
}

function moneyForStatus(status, i) {
  if (status === "rent") return 85000 + (i % 7) * 4500;
  if (status === "guest") return 120000 + (i % 5) * 8000;
  if (status === "installment") return 95000 + (i % 6) * 5500;
  if (status === "sold") return 0;
  return 0;
}

function isoDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ym(offsetMonths) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildApartmentsForComplex(seed, excel, startId) {
  const rentN = Number(excel.rent || 0);
  const guestN = Number(excel.guest || 0);
  const soldN = Number(excel.sold || 0);
  const forSale = Number(excel.forSale || 0);
  const installmentN = Math.max(forSale - soldN, 0);
  const freeN = Math.max(Number(excel.remaining || 0) - rentN - guestN, 0);

  // Cap free slots to keep local storage lean but representative
  const freeCap = Math.min(freeN, 3);

  const plan = [
    ...Array.from({ length: rentN }, () => "rent"),
    ...Array.from({ length: guestN }, () => "guest"),
    ...Array.from({ length: Math.min(installmentN, 8) }, () => "installment"),
    ...Array.from({ length: Math.min(soldN, 10) }, () => "sold"),
    ...Array.from({ length: freeCap }, () => "free"),
  ];

  // Ensure at least a couple of rows per complex
  if (plan.length === 0) plan.push("rent", "installment");

  const dormInfo = String(excel.dorm_flats_info || "");
  const dormNums = new Set(
    (dormInfo.match(/\d+/g) || []).map(String)
  );

  return plan.map((status, idx) => {
    const id = startId + idx;
    const aptNo =
      seed.name === "Жагалау-3" && idx < 2 && dormNums.size
        ? [...dormNums][idx] || String(10 + idx)
        : String(10 + idx);
    const isDorm =
      seed.name === "Общежитие" ||
      (seed.name === "Жагалау-3" && dormNums.has(aptNo));
    const isEmpty = status === "free";
    const fio = isEmpty
      ? null
      : `${pick(LAST_NAMES, id)} ${pick(FIRST_NAMES, id + 3)}`;
    // Отдел только из Excel — без генерации
    const department = null;
    const monthly = isEmpty ? 0 : moneyForStatus(status === "sold" ? "installment" : status, id);
    const endOffset =
      status === "rent" || status === "guest"
        ? 20 + (id % 40)
        : status === "installment"
          ? 90 + (id % 120)
          : 365;

    return {
      id,
      residential_complex_name: seed.name,
      address: excel.address || seed.address,
      apartment_number: aptNo,
      house_number: null,
      room_count: isDorm ? 1 : 2 + (id % 2),
      total_area: isDorm ? 18 + (id % 6) : 45 + (id % 30),
      status_key: status,
      status_label: isDorm && status === "rent" ? "🟡 Общежитие" : STATUS_LABEL[status],
      is_empty: isEmpty,
      occupancy_status: isEmpty ? "empty" : "occupied",
      vacancy_note: isEmpty ? "Свободна" : null,
      current_resident_name: fio,
      current_resident_iin: isEmpty ? null : `9${String(800000000000 + id).slice(0, 11)}`,
      department,
      floor: 1 + (id % 9),
      entrance: String(1 + (id % 4)),
      payment_due_day: 5 + (id % 10),
      occupants_count: isEmpty ? 0 : isDorm ? 2 : 1,
      monthly_deduction: status === "sold" ? 0 : monthly,
      monthly_payment: status === "sold" ? 0 : monthly,
      amortization_cost: status === "installment" || status === "sold" ? monthly * 12 : null,
      taxable_base: status === "installment" ? monthly * 3 : 0,
      payment_method: null,
      days_overdue: 0,
      occupancy_basis: isDorm ? "Общежитие" : status === "sold" ? "Выкуп" : status === "installment" ? "Рассрочка" : "Аренда",
      contract_start_date: isEmpty ? null : isoDate(-(200 + (id % 400))),
      contract_end_date: isEmpty ? null : isoDate(endOffset),
      last_paid_month: isEmpty || status === "sold" ? null : ym(-1),
      _fallback: true,
    };
  });
}

export function buildMockApartments() {
  let nextId = 1001;
  const rows = [];
  CANONICAL_COMPLEX_SEEDS.forEach((seed) => {
    const excel = getExcelDefaults(seed.name) || {};
    const chunk = buildApartmentsForComplex(seed, excel, nextId);
    rows.push(...chunk);
    nextId += chunk.length + 5;
  });
  return rows;
}

export function buildMockContracts(apartments = buildMockApartments()) {
  return apartments
    .filter((a) => !a.is_empty && a.status_key !== "free")
    .map((a, idx) => {
      const end = a.contract_end_date ? new Date(a.contract_end_date) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysLeft = end
        ? Math.round((end.setHours(0, 0, 0, 0) - today.getTime()) / 86400000)
        : null;
      let contract_status = "active";
      if (daysLeft != null && daysLeft < 0) contract_status = "expired";
      else if (daysLeft != null && daysLeft <= 30) contract_status = "expiring";

      return {
        id: `CTR-${a.id}`,
        full_name: a.current_resident_name,
        department: a.department,
        residential_complex_name: a.residential_complex_name,
        apartment_number: a.apartment_number,
        house_number: a.house_number,
        contract_start_date: a.contract_start_date,
        contract_end_date: a.contract_end_date,
        days_left: daysLeft,
        contract_status,
        contract_type:
          a.status_key === "sold"
            ? "Выкуп"
            : a.status_key === "installment"
              ? "Рассрочка"
              : a.status_key === "guest"
                ? "Гостевой"
                : "Аренда",
        status_key: a.status_key,
        monthly_payment: a.monthly_deduction || a.monthly_payment || 0,
        file_name: idx % 3 === 0 ? `dogovor_${a.id}.pdf` : null,
        _fallback: true,
      };
    });
}

/** Платежный реестр не генерируем — только реальные данные из Excel/API. */
export function buildMockPayments() {
  return [];
}

export function buildMockHousingBundle() {
  const complexes = buildFallbackComplexes();
  const apartments = buildMockApartments();
  const contracts = buildMockContracts(apartments);
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    complexes,
    apartments,
    contracts,
    payments: [],
  };
}

export const MOCK_HOUSING_BUNDLE = buildMockHousingBundle();
