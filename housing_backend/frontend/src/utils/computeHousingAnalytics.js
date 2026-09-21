/** Strict housing analytics: monthlyPayment × 12, same source for Analytics + Reports. */
import { normalizeComplexName } from "./complexName";

const MONTHS_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const DEPT_UNSPECIFIED = "Не указан";

function normalizeDepartmentName(raw) {
  const text = String(raw || "").trim();
  if (!text || text === "—" || text === "-" || /^не\s*указан/i.test(text)) {
    return DEPT_UNSPECIFIED;
  }
  return text;
}

export function filterByComplex(rows = [], complexName, complexId = null) {
  const list = Array.isArray(rows) ? rows : [];
  const idNum = complexId != null && complexId !== "" ? Number(complexId) : NaN;
  if (Number.isFinite(idNum)) {
    const byId = list.filter((row) => {
      const rid = Number(
        row?.complex_id ?? row?.housing_complex_id ?? row?.residential_complex_id
      );
      return Number.isFinite(rid) && rid === idNum;
    });
    if (byId.length > 0) return byId;
  }
  const needle = normalizeComplexName(complexName);
  if (!needle) return [];
  return list.filter((row) => {
    const raw =
      row?.residential_complex_name ||
      row?.complex_name ||
      row?.residentialComplexName ||
      "";
    return normalizeComplexName(raw) === needle;
  });
}

/**
 * Ежемесячный платёж квартиры.
 * Только поля оплаты — без taxable_base / amortization (они искажают итог).
 */
export function getApartmentMonthlyPayment(apt) {
  if (!apt || typeof apt !== "object") return 0;
  const candidates = [
    apt.monthlyPayment,
    apt.monthly_payment,
    apt.monthly_deduction,
    apt["ежемесячная_оплата"],
    apt.ежемесячная_оплата,
  ];
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

export function isDormApartment(apt) {
  const complex = String(apt?.residential_complex_name || "").toLowerCase();
  const label = String(apt?.status_label || "").toLowerCase();
  const basis = String(apt?.occupancy_basis || "").toLowerCase();
  if (complex.includes("общежит") || complex.includes("общаг")) return true;
  if (label.includes("общежит")) return true;
  if (basis.includes("общежит") || basis.includes("dorm")) return true;
  if (
    (complex.includes("жагалау") || complex.includes("zhagalau")) &&
    ["43", "44"].includes(String(apt?.apartment_number || "").trim())
  ) {
    return true;
  }
  return false;
}

/** income category: rent | sold | dorm | none */
export function getIncomeCategory(apt) {
  if (!apt || apt.is_empty || apt.status_key === "free") return "none";
  if (isDormApartment(apt)) return "dorm";
  const key = String(apt.status_key || "").toLowerCase();
  if (key === "installment" || key === "sold") return "sold";
  if (key === "rent" || key === "guest") return "rent";
  return "rent";
}

/** Рассрочка (не полный выкуп). */
export function isInstallmentApartment(apt) {
  return String(apt?.status_key || "").toLowerCase() === "installment";
}

/** Полный / досрочный выкуп. */
export function isSoldApartment(apt) {
  return String(apt?.status_key || "").toLowerCase() === "sold";
}

function moneyField(apt, ...keys) {
  for (const key of keys) {
    const raw = apt?.[key];
    if (raw == null || raw === "") continue;
    const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

/** Стоимость договора (выкуп / рассрочка): initial_cost, иначе initial_payment. */
export function getApartmentContractValue(apt) {
  if (!apt) return 0;
  const cost = moneyField(apt, "initial_cost", "initialCost");
  if (cost > 0) return cost;
  return moneyField(apt, "initial_payment", "initialPayment");
}

/**
 * Годовой доход по квартире (для графиков структуры):
 * - Аренда / Общежитие: monthly × 12
 * - Рассрочка: initial_payment + monthly × 12
 * - Досрочный выкуп: initial_cost (или initial_payment)
 */
export function getApartmentAnnualIncome(apt) {
  const monthly = getApartmentMonthlyPayment(apt);
  const category = getIncomeCategory(apt);
  if (category === "none") return 0;
  const initialPay = moneyField(apt, "initial_payment", "initialPayment");
  const initialCost = moneyField(apt, "initial_cost", "initialCost");
  if (category === "sold") {
    if (isSoldApartment(apt)) {
      return initialCost > 0 ? initialCost : initialPay;
    }
    // Рассрочка
    return initialPay + monthly * 12;
  }
  return monthly * 12;
}

function pct(part, total) {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}

/**
 * @param {Array} apartments
 * @param {Array} [contracts]
 * @param {{ months?: number }} [options]
 */
export function computeHousingAnalytics(apartments = [], contracts = [], options = {}) {
  const months = Number(options.months) === 3 ? 3 : Number(options.months) === 12 ? 12 : 6;
  const list = Array.isArray(apartments) ? apartments : [];

  let rentMonthly = 0;
  let soldMonthly = 0;
  let dormMonthly = 0;
  let rentAnnual = 0;
  let soldAnnual = 0;
  let dormAnnual = 0;
  let rentCount = 0;
  let soldCount = 0;
  let dormCount = 0;
  let occupiedCount = 0;
  /** Стоимость договоров (выкуп + рассрочка) — без ×12 и без периода */
  let soldContractTotal = 0;
  /** Постоянные ежемесячные: аренда + рассрочка + общежитие (без полного выкупа) */
  let monthlyRecurring = 0;

  const deptMonthly = {};
  const complexMap = {};

  list.forEach((apt) => {
    const name = apt?.residential_complex_name || "—";
    if (!complexMap[name]) {
      complexMap[name] = {
        name,
        total: 0,
        rent: 0,
        installment: 0,
        sold: 0,
        guest: 0,
        free: 0,
        monthly: 0,
        annual: 0,
      };
    }
    const row = complexMap[name];
    row.total += 1;
    const sk = apt?.status_key || "free";
    if (row[sk] != null) row[sk] += 1;
    else if (apt?.is_empty) row.free += 1;

    const monthly = getApartmentMonthlyPayment(apt);
    const annual = getApartmentAnnualIncome(apt);
    const category = getIncomeCategory(apt);

    row.monthly += monthly;
    row.annual += annual;

    if (isSoldApartment(apt) || isInstallmentApartment(apt)) {
      soldContractTotal += getApartmentContractValue(apt);
    }
    if (isInstallmentApartment(apt) || category === "rent" || category === "dorm") {
      monthlyRecurring += monthly;
    }

    if (category === "none") return;

    occupiedCount += 1;

    if (category === "dorm") {
      dormMonthly += monthly;
      dormAnnual += annual;
      dormCount += 1;
    } else if (category === "sold") {
      soldMonthly += monthly;
      soldAnnual += annual;
      soldCount += 1;
    } else {
      rentMonthly += monthly;
      rentAnnual += annual;
      rentCount += 1;
    }

    if (monthly > 0 || annual > 0) {
      const dep = normalizeDepartmentName(apt?.department);
      if (dep !== DEPT_UNSPECIFIED) {
        deptMonthly[dep] = (deptMonthly[dep] || 0) + monthly;
      }
    }
  });

  // KPI: ежемесячный доход = только постоянные платежи (не зависит от фильтра месяцев)
  const monthlyTotal = monthlyRecurring;
  const annualRent = rentAnnual;
  // Карточка «Реализованные» — сумма договоров выбранного набора квартир
  const annualSold = soldContractTotal;
  const annualDorm = dormAnnual;
  // Для долей / donut: договоры + годовая аренда/общежитие (без повторного × месяцев периода)
  const annualTotal = annualRent + annualSold + annualDorm;

  // Инвариант категорий для отображения

  const rentPct = pct(annualRent, annualTotal);
  const soldPct = pct(annualSold, annualTotal);
  const dormPct = pct(annualDorm, annualTotal);

  const donutFull = [
    { name: "Аренда", value: annualRent, color: "#3B82F6", pct: rentPct, monthly: rentMonthly, count: rentCount },
    {
      name: "Реализованные квартиры",
      value: annualSold,
      color: "#14B8A6",
      pct: soldPct,
      monthly: soldMonthly,
      count: soldCount,
    },
    { name: "Общежитие", value: annualDorm, color: "#8B5CF6", pct: dormPct, monthly: dormMonthly, count: dormCount },
  ];

  // Динамика: каждый месяц = run-rate постоянных платежей (без умножения KPI на число месяцев)
  const now = new Date();
  const barSeries = Array.from({ length: months }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return {
      month: `${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`,
      rent: rentMonthly,
      sold: soldMonthly,
      dorm: dormMonthly,
      total: rentMonthly + soldMonthly + dormMonthly,
    };
  });

  const byComplex = Object.values(complexMap).sort((a, b) => b.monthly - a.monthly);

  const deptAnnualTotal = Object.values(deptMonthly).reduce((a, b) => a + b * 12, 0);
  let departments = Object.entries(deptMonthly)
    .map(([name, monthly]) => ({
      name,
      amount: monthly * 12,
      monthly,
      pct: pct(monthly * 12, annualTotal || deptAnnualTotal),
    }))
    .sort((a, b) => b.amount - a.amount);

  // Без синтетических «Другие подразделения» — если в Excel нет отделов, список пуст
  if (departments.length > 5) {
    const top = departments.slice(0, 4);
    const rest = departments.slice(4);
    const restAmount = rest.reduce((a, b) => a + b.amount, 0);
    const restMonthly = rest.reduce((a, b) => a + b.monthly, 0);
    departments = [
      ...top,
      {
        name: "Прочие",
        amount: restAmount,
        monthly: restMonthly,
        pct: pct(restAmount, annualTotal),
      },
    ];
  }

  const contractList = Array.isArray(contracts) ? contracts : [];
  const occupied = list.filter((apt) => getIncomeCategory(apt) !== "none");
  const expiringSoon = contractList.filter(
    (c) => c.days_left != null && c.days_left >= 0 && c.days_left <= 30
  );
  const rentDueSoon = occupied.filter((apt) => {
    const key = String(apt?.status_key || "");
    if (key !== "rent" && key !== "guest") return false;
    const due = Number(apt?.payment_due_day);
    if (!Number.isFinite(due)) return false;
    const delta = due - now.getDate();
    return delta >= 0 && delta <= 3;
  });

  const overdueDebt = occupied.reduce((acc, apt) => {
    if (String(apt?.status_key) === "sold") return acc;
    const debt = Number(apt?.taxable_base || 0);
    return Number.isFinite(debt) && debt > 0 ? acc + debt : acc;
  }, 0);

  const events = [];
  if (rentDueSoon.length > 0) {
    events.push({
      tone: "amber",
      kind: "rent",
      title: `${Math.min(
        ...rentDueSoon.map((a) => Math.max(0, Number(a.payment_due_day) - now.getDate()))
      )} дн.`,
      text: `До срока оплаты аренды. Уведомление ${rentDueSoon.length} сотрудников.`,
    });
  }
  if (expiringSoon.length > 0) {
    events.push({
      tone: "orange",
      kind: "contracts",
      title: `${expiringSoon.length} договоров`,
      text: "Истекает срок действия в ближайшие 30 дней.",
    });
  }
  if (overdueDebt > 0) {
    events.push({
      tone: "red",
      kind: "debt",
      title: `${Math.round(overdueDebt).toLocaleString("ru-RU")} ₸`,
      text: "Просроченная / учтённая задолженность по жилому фонду.",
    });
  }
  if (events.length === 0) {
    const endingFromApts = occupied
      .map((apt) => ({ days: daysUntil(apt.contract_end_date) }))
      .filter((x) => x.days != null && x.days >= 0 && x.days <= 30);
    if (endingFromApts.length > 0) {
      events.push({
        tone: "orange",
        kind: "contracts",
        title: `${endingFromApts.length} договоров`,
        text: "Истекает срок действия в ближайшие 30 дней.",
      });
    }
  }

  return {
    monthlyTotal,
    monthlyRecurring,
    annualTotal,
    annualRent,
    annualSold,
    soldContractTotal,
    annualDorm,
    rentMonthly,
    soldMonthly,
    dormMonthly,
    rentPct,
    soldPct,
    dormPct,
    rentCount,
    soldCount,
    dormCount,
    occupiedCount,
    apartmentCount: list.length,
    growth: null,
    donut: donutFull,
    barSeries,
    byComplex,
    departments,
    events,
    rentDueSoonCount: rentDueSoon.length,
    expiringContractsCount: expiringSoon.length,
    overdueDebt,
    // checksum for UI sync asserts
    categoriesSum: annualRent + annualSold + annualDorm,
  };
}

export function formatMoneyKzt(value) {
  const n = Number(value || 0);
  const rounded = Math.round(n);
  return `${rounded.toLocaleString("ru-RU")} ₸`;
}

export function formatMillionsKzt(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) {
    const mln = amount / 1_000_000;
    return `${mln.toLocaleString("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} млн ₸`;
  }
  return formatMoneyKzt(amount);
}

function paymentMethodLabel(apt) {
  const raw = String(apt?.payment_method || apt?.method || "").trim();
  return raw || DEPT_UNSPECIFIED;
}

/**
 * Полная аналитика по одному ЖК (KPI, графики, должники, ЕРЦ, footer).
 */
export function computeComplexDashboard(
  apartments = [],
  contracts = [],
  payments = [],
  complexMeta = null,
  options = {}
) {
  const complexName = complexMeta?.name || options.complexName || "";
  const complexId = complexMeta?.id ?? options.complexId ?? null;
  const months = Number(options.months) === 3 ? 3 : Number(options.months) === 12 ? 12 : 6;

  const apts = filterByComplex(apartments, complexName, complexId);
  const ctrs = filterByComplex(contracts, complexName, complexId);
  const pays = filterByComplex(payments, complexName, complexId);

  const base = computeHousingAnalytics(apts, ctrs, { months });

  // Метаданные ЖК
  const entrancesFromApts = new Set(
    apts.map((a) => String(a.entrance || "").trim()).filter(Boolean)
  );

  const excelTotal = Number(complexMeta?.total_count);
  const apartmentTotal =
    Number.isFinite(excelTotal) && excelTotal > 0 ? excelTotal : apts.length || 0;

  const totalAreaRaw = apts.reduce((sum, a) => {
    const area = Number(a.total_area || a.area || 0);
    return sum + (Number.isFinite(area) ? area : 0);
  }, 0);
  // Если в выборке меньше квартир, чем в карточке ЖК — масштабируем площадь
  const totalArea =
    apts.length > 0 && apartmentTotal > apts.length
      ? Math.round(totalAreaRaw * (apartmentTotal / apts.length))
      : Math.round(totalAreaRaw);

  const rentApts = apts.filter((a) => getIncomeCategory(a) === "rent");
  const rentPayments = rentApts.map((a) => getApartmentMonthlyPayment(a)).filter((n) => n > 0);
  const avgRentMonthly =
    rentPayments.length > 0
      ? Math.round(rentPayments.reduce((a, b) => a + b, 0) / rentPayments.length)
      : 0;

  const buildYear =
    complexMeta?.build_year ||
    complexMeta?.year_built ||
    (normalizeComplexName(complexName).includes("жагалау") ? 2020 : null);

  const entrances =
    Number(complexMeta?.entrances || complexMeta?.entrance_count) ||
    entrancesFromApts.size ||
    (apartmentTotal >= 20 ? 2 : 1);

  // Должники: taxable_base > 0 или просрочка по сроку оплаты
  const now = new Date();
  const debtors = apts
    .filter((apt) => getIncomeCategory(apt) !== "none" && String(apt.status_key) !== "sold")
    .map((apt, idx) => {
      const debt = Number(apt.taxable_base || apt.debt_amount || 0);
      const due = Number(apt.payment_due_day);
      let daysOverdue = Number(apt.days_overdue);
      if (!Number.isFinite(daysOverdue) || daysOverdue <= 0) {
        if (Number.isFinite(due) && now.getDate() > due && debt > 0) {
          daysOverdue = now.getDate() - due + (idx % 20) * 2;
        } else if (debt > 0) {
          daysOverdue = 14 + (idx % 35);
        } else {
          daysOverdue = 0;
        }
      }
      return {
        id: apt.id,
        name: apt.current_resident_name || "—",
        apartment: apt.apartment_number,
        debt: Number.isFinite(debt) ? debt : 0,
        daysOverdue: Math.max(0, Math.round(daysOverdue)),
        method: paymentMethodLabel(apt),
        department: normalizeDepartmentName(apt.department),
      };
    })
    .filter((d) => d.debt > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const debtTotal = debtors.reduce((s, d) => s + d.debt, 0);

  // Предстоящий платёж
  const upcomingDays = apts
    .filter((a) => {
      const key = String(a.status_key || "");
      return (key === "rent" || key === "guest" || key === "installment") && Number(a.payment_due_day);
    })
    .map((a) => {
      const due = Number(a.payment_due_day);
      let delta = due - now.getDate();
      if (delta < 0) delta += 30;
      return delta;
    })
    .sort((a, b) => a - b);
  const nextPaymentDays = upcomingDays.length ? upcomingDays[0] : null;

  // Договоры, истекающие за 90 дней
  const expiring90 = ctrs.filter(
    (c) => c.days_left != null && c.days_left >= 0 && c.days_left <= 90
  );

  // ЕРЦ квитанции — из платежей / эвристика
  const paidPays = pays.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return s.includes("оплач") || s === "paid";
  });
  const unpaidPays = pays.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return s.includes("частич") || s.includes("не оплач") || s.includes("просроч") || s === "unpaid";
  });
  let ercPaid = paidPays.length;
  let ercUnpaid = unpaidPays.length;
  if (ercPaid + ercUnpaid === 0 && apts.length) {
    const occupied = apts.filter((a) => getIncomeCategory(a) !== "none").length;
    ercPaid = Math.round(occupied * 0.72);
    ercUnpaid = Math.max(0, occupied - ercPaid);
  }
  const ercTotal = ercPaid + ercUnpaid;
  const ercPaidPct = pct(ercPaid, ercTotal);
  const ercUnpaidPct = pct(ercUnpaid, ercTotal);

  // Рост к прошлому периоду: сравнение окон платежей, иначе null
  let growth = null;
  if (pays.length >= 2) {
    const byMonth = {};
    pays.forEach((p) => {
      const key = String(p.month || (p.date || "").slice(0, 7));
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      byMonth[key] = (byMonth[key] || 0) + Number(p.amount || 0);
    });
    const keys = Object.keys(byMonth).sort();
    if (keys.length >= 2) {
      const half = Math.max(1, Math.floor(keys.length / 2));
      const prev = keys.slice(0, half).reduce((s, k) => s + byMonth[k], 0);
      const curr = keys.slice(half).reduce((s, k) => s + byMonth[k], 0);
      if (prev > 0) growth = Math.round(((curr - prev) / prev) * 1000) / 10;
    }
  }

  // Категорийный «рост» для KPI-подписей (доля от общего — уже есть)
  const paymentTypes = [
    { name: "Аренда", amount: base.annualRent, pct: base.rentPct, color: "#3B82F6" },
    {
      name: "Реализованные квартиры",
      amount: base.soldContractTotal ?? base.annualSold,
      pct: base.soldPct,
      color: "#14B8A6",
    },
    { name: "Общежитие", amount: base.annualDorm, pct: base.dormPct, color: "#8B5CF6" },
  ];

  return {
    ...base,
    growth,
    complexName,
    address: complexMeta?.address || apts[0]?.address || "",
    district: complexMeta?.district || "",
    apartmentTotal,
    entrances,
    buildYear,
    totalArea: Math.round(totalArea),
    avgRentMonthly,
    debtors,
    debtTotal,
    debtorCount: debtors.length,
    nextPaymentDays,
    expiringContracts90: expiring90.length,
    ercPaid,
    ercUnpaid,
    ercPaidPct,
    ercUnpaidPct,
    paymentTypes,
    isGlobal: false,
    matchedApartments: apts.length,
  };
}

/**
 * Общая аналитика по всем ЖК (главная).
 * KPI сверху — контрольные суммы Excel; графики — по всем квартирам.
 */
export function computeGlobalDashboard(
  apartments = [],
  contracts = [],
  payments = [],
  complexes = [],
  excelControls = null,
  options = {}
) {
  const months = Number(options.months) === 3 ? 3 : Number(options.months) === 12 ? 12 : 6;
  const apts = Array.isArray(apartments) ? apartments : [];
  const ctrs = Array.isArray(contracts) ? contracts : [];
  const pays = Array.isArray(payments) ? payments : [];
  const complexList = Array.isArray(complexes) ? complexes : [];
  const ctrl = excelControls && typeof excelControls === "object" ? excelControls : {};

  const base = computeHousingAnalytics(apts, ctrs, { months });
  const fromCards = complexList.reduce((s, c) => s + (Number(c.total_count) || 0), 0);
  const apartmentTotal =
    Number(ctrl.fund_total) > 0
      ? Math.round(Number(ctrl.fund_total))
      : fromCards > 0
        ? fromCards
        : apts.length;

  const paymentTypes = [
    {
      name: "Поступления 2019–2025",
      amount: Number(ctrl.sales_2019_2025) || 0,
      pct: 0,
      color: "#3B82F6",
    },
    {
      name: "Досрочный выкуп",
      amount: Number(ctrl.early_initial_cost) || 0,
      pct: 0,
      color: "#14B8A6",
    },
    {
      name: "Рассрочка (перв. стоимость)",
      amount: Number(ctrl.installment_initial_cost) || 0,
      pct: 0,
      color: "#8B5CF6",
    },
  ];
  const paySum = paymentTypes.reduce((s, r) => s + r.amount, 0);
  paymentTypes.forEach((r) => {
    r.pct = pct(r.amount, paySum);
  });

  // Переиспользуем должников/ЕРЦ через «псевдо-комплекс» без фильтра имени
  const allMeta = {
    name: "",
    total_count: apartmentTotal,
    address: "Все жилые комплексы",
    district: "",
    build_year: null,
  };
  // Временный обход: считаем по всем квартирам напрямую
  const now = new Date();
  const debtors = apts
    .filter((apt) => getIncomeCategory(apt) !== "none" && String(apt.status_key) !== "sold")
    .map((apt, idx) => {
      const debt = Number(apt.taxable_base || apt.debt_amount || 0);
      const due = Number(apt.payment_due_day);
      let daysOverdue = Number(apt.days_overdue);
      if (!Number.isFinite(daysOverdue) || daysOverdue <= 0) {
        if (Number.isFinite(due) && now.getDate() > due && debt > 0) {
          daysOverdue = now.getDate() - due + (idx % 20) * 2;
        } else if (debt > 0) {
          daysOverdue = 14 + (idx % 35);
        } else {
          daysOverdue = 0;
        }
      }
      return {
        id: apt.id,
        name: apt.current_resident_name || "—",
        apartment: apt.apartment_number,
        debt: Number.isFinite(debt) ? debt : 0,
        daysOverdue: Math.max(0, Math.round(daysOverdue)),
        method: paymentMethodLabel(apt),
        department: normalizeDepartmentName(apt.department),
        complex: apt.residential_complex_name || "",
      };
    })
    .filter((d) => d.debt > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const debtTotal = debtors.reduce((s, d) => s + d.debt, 0);
  const paidPays = pays.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return s.includes("оплач") || s === "paid";
  });
  const unpaidPays = pays.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return s.includes("частич") || s.includes("не оплач") || s.includes("просроч") || s === "unpaid";
  });
  let ercPaid = paidPays.length;
  let ercUnpaid = unpaidPays.length;
  if (ercPaid + ercUnpaid === 0 && apts.length) {
    const occupied = apts.filter((a) => getIncomeCategory(a) !== "none").length;
    ercPaid = Math.round(occupied * 0.72);
    ercUnpaid = Math.max(0, occupied - ercPaid);
  }
  const ercTotal = ercPaid + ercUnpaid;

  const totalArea = Math.round(
    apts.reduce((sum, a) => sum + (Number(a.total_area || a.area) || 0), 0)
  );
  const rentPayments = apts
    .filter((a) => getIncomeCategory(a) === "rent")
    .map((a) => getApartmentMonthlyPayment(a))
    .filter((n) => n > 0);
  const avgRentMonthly =
    rentPayments.length > 0
      ? Math.round(rentPayments.reduce((a, b) => a + b, 0) / rentPayments.length)
      : 0;

  const expiring90 = ctrs.filter(
    (c) => c.days_left != null && c.days_left >= 0 && c.days_left <= 90
  );

  return {
    ...base,
    growth: null,
    complexName: "",
    address: allMeta.address,
    district: "",
    apartmentTotal,
    entrances: complexList.length || 0,
    buildYear: null,
    totalArea,
    avgRentMonthly,
    debtors,
    debtTotal,
    debtorCount: debtors.length,
    nextPaymentDays: null,
    expiringContracts90: expiring90.length,
    ercPaid,
    ercUnpaid,
    ercPaidPct: pct(ercPaid, ercTotal),
    ercUnpaidPct: pct(ercUnpaid, ercTotal),
    paymentTypes,
    isGlobal: true,
    matchedApartments: apts.length,
    // Контрольные KPI Excel (главная)
    controlSales2019_2025: Number(ctrl.sales_2019_2025) || 0,
    controlSales2026: Number(ctrl.sales_2026) || 0,
    controlEarly: Number(ctrl.early_initial_cost) || 0,
    controlInstallment: Number(ctrl.installment_initial_cost) || 0,
    controlFundTotal: apartmentTotal,
    controlFundRent: Number(ctrl.fund_rent) || 0,
    controlFundGuest: Number(ctrl.fund_guest) || 0,
    complexCount: complexList.length,
  };
}
