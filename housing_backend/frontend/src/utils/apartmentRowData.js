import { getApartments, getResidents } from "../api/apartments";
import { listDocuments } from "../api/documents";
import { listPurchaseFinancials, listRentalFinancials } from "../api/housingData";
import { normalizeComplexName } from "./complexName";
import { applyZerdeAllowlistToEnrichedRows } from "./zerdeAllowlist";

export const DOC_TYPE_KEYS = ["rental_contract", "protocol", "purchase_contract", "payment_schedule", "act"];

export function formatAddress(apt) {
  if (apt.address && String(apt.address).trim()) return String(apt.address).trim();
  const parts = [apt.district, apt.street, apt.house_number, apt.apartment_number].filter(
    (x) => x != null && String(x).trim() !== ""
  );
  return parts.join(", ");
}

export function pickPrimaryResident(residents, apartmentId) {
  const active = residents.filter((r) => r.apartment_id === apartmentId && r.is_active);
  active.sort((a, b) => a.id - b.id);
  return active[0] || null;
}

export function pickCurrentFinancial(rows) {
  if (!rows?.length) return null;
  const cur = rows.filter((r) => r.is_current);
  const pool = cur.length ? cur : rows;
  return [...pool].sort((a, b) => b.id - a.id)[0];
}

export function pickBestDoc(docs) {
  if (!docs || !docs.length) return null;
  return [...docs].sort((a, b) => {
    if (Boolean(a.is_current) !== Boolean(b.is_current)) return a.is_current ? -1 : 1;
    return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
  })[0];
}

export function pickDocsByType(docs) {
  const out = {};
  for (const t of DOC_TYPE_KEYS) {
    out[t] = pickBestDoc((docs || []).filter((d) => d.document_type === t));
  }
  return out;
}

/** One entry per apartment id (defensive if API ever repeats rows). */
export function dedupeApartmentsById(apartments) {
  const byId = new Map();
  for (const a of apartments || []) {
    if (a?.id == null) continue;
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
  return [...byId.values()];
}

/**
 * Stable physical unit within a ЖК for collapsing duplicate apartment rows (e.g. seed "Зерде" vs "Жилой комплекс Зерде").
 * Uses street + house + flat when set so two different houses in the same named ЖК do not merge.
 */
export function apartmentStableUnitKey(apt) {
  const street =
    apt?.street != null && String(apt.street).trim()
      ? String(apt.street).toLowerCase().replace(/\s+/g, " ").trim()
      : "";
  const house = apt?.house_number != null && String(apt.house_number).trim() ? String(apt.house_number).trim() : "";
  const an =
    apt?.apartment_number != null && String(apt.apartment_number).trim()
      ? String(apt.apartment_number).trim()
      : "";
  if (street && house && an) return `loc:${street}|${house}|${an}`;
  if (house && an) return `loc:|${house}|${an}`;
  if (an) return `unit:${an}`;
  const addr = formatAddress(apt);
  const m = addr.match(/(?:-\s*|кв\.?\s*)(\d+)\s*$/i);
  if (m) return `unit:${m[1]}`;
  return `addr:${addr.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/** Complex (normalized) + unit → at most one apartment row; keeps lowest id. */
export function apartmentStableDedupKey(apt) {
  return `${normalizeComplexName(apt.residential_complex_name)}|${apartmentStableUnitKey(apt)}`;
}

export function dedupeApartmentsByStableKey(apartments) {
  const sorted = [...(apartments || [])].sort((a, b) => a.id - b.id);
  const seen = new Set();
  const out = [];
  for (const a of sorted) {
    const k = apartmentStableDedupKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

async function financialMapForApartments(ids, listFn) {
  const map = new Map();
  const counts = new Map();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const rows = await listFn({ apartment_id: id, limit: 100 });
        const arr = Array.isArray(rows) ? rows : [];
        map.set(id, pickCurrentFinancial(arr));
        counts.set(id, arr.length);
      } catch {
        map.set(id, null);
        counts.set(id, 0);
      }
    })
  );
  return { map, counts };
}

async function documentsMapForApartments(ids) {
  const map = new Map();
  const counts = new Map();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const rows = await listDocuments({ apartment_id: id, limit: 100 });
        const arr = Array.isArray(rows) ? rows : [];
        map.set(id, pickDocsByType(arr));
        counts.set(id, arr.length);
      } catch {
        map.set(id, pickDocsByType([]));
        counts.set(id, 0);
      }
    })
  );
  return { map, counts };
}

function logZerdeComplexDebug({
  rawApartments,
  dedupedApartments,
  residentsAll,
  rentalCounts,
  purchaseCounts,
  docCounts,
}) {
  const zerdeNorm = "зерде";
  const inZerde = (a) => normalizeComplexName(a.residential_complex_name) === zerdeNorm;
  const rawZerde = (rawApartments || []).filter(inZerde);
  if (!rawZerde.length) return;

  // eslint-disable-next-line no-console
  console.group("[Complex Зерде] apartment load / deduplication");
  // eslint-disable-next-line no-console
  console.log("raw_apartments_matching_page_filter", rawApartments.length);
  // eslint-disable-next-line no-console
  console.log("after_dedupe_stable_key", dedupedApartments.length);
  // eslint-disable-next-line no-console
  console.log(
    "dedupe_removed",
    rawApartments.length - dedupedApartments.length,
    "(same normalized ЖК + same unit/address key → keep lowest apartment.id)"
  );

  const resByApt = new Map();
  for (const r of residentsAll || []) {
    if (!r?.apartment_id) continue;
    resByApt.set(r.apartment_id, (resByApt.get(r.apartment_id) || 0) + 1);
  }

  for (const a of rawZerde.sort((x, y) => x.id - y.id)) {
    const id = a.id;
    // eslint-disable-next-line no-console
    console.log({
      apartment_id: id,
      address: formatAddress(a),
      residential_complex_name: a.residential_complex_name,
      apartment_subtype: a.apartment_subtype,
      housing_type: a.housing_type,
      stable_dedup_key: apartmentStableDedupKey(a),
      residents_count_for_apartment: resByApt.get(id) ?? 0,
      rental_financials_rows: rentalCounts.get(id) ?? 0,
      purchase_financials_rows: purchaseCounts.get(id) ?? 0,
      documents_rows: docCounts.get(id) ?? 0,
      kept_after_dedup: dedupedApartments.some((x) => x.id === id),
    });
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export function buildEnrichedRows(apartments, residents, rentMap, purchaseMap, docMap) {
  return apartments.map((apt) => {
    const resident = pickPrimaryResident(residents, apt.id);
    return {
      apartment: apt,
      resident,
      rental: rentMap.get(apt.id) || null,
      purchase: purchaseMap.get(apt.id) || null,
      documents: docMap.get(apt.id) || {},
      address: formatAddress(apt),
      fio: resident?.full_name || "",
    };
  });
}

/**
 * @param {(apt: object) => boolean} apartmentPredicate
 * @param {{ debugNormLabel?: string, logZerdeAllowlist?: boolean }} [options]
 */
export async function loadGlobalEnrichedRows(apartmentPredicate, options = {}) {
  const { debugNormLabel, logZerdeAllowlist } = options;
  const [apartmentsAll, residentsAll] = await Promise.all([
    getApartments({ limit: 500 }),
    getResidents({ limit: 500 }),
  ]);

  const apartmentsUnique = dedupeApartmentsById(apartmentsAll);
  const filteredRaw = apartmentsUnique.filter(apartmentPredicate).sort((a, b) => a.id - b.id);
  const filteredApts = dedupeApartmentsByStableKey(filteredRaw);

  const debugZerde =
    debugNormLabel != null && normalizeComplexName(debugNormLabel) === "зерде";
  const fetchIds = debugZerde
    ? [...new Set(filteredRaw.map((a) => a.id))]
    : filteredApts.map((a) => a.id);

  let rentMap = new Map();
  let purchaseMap = new Map();
  let docMap = new Map();
  let rentalCounts = new Map();
  let purchaseCounts = new Map();
  let docCounts = new Map();

  if (fetchIds.length) {
    const [r, p, d] = await Promise.all([
      financialMapForApartments(fetchIds, listRentalFinancials),
      financialMapForApartments(fetchIds, listPurchaseFinancials),
      documentsMapForApartments(fetchIds),
    ]);
    rentMap = r.map;
    rentalCounts = r.counts;
    purchaseMap = p.map;
    purchaseCounts = p.counts;
    docMap = d.map;
    docCounts = d.counts;
  }

  if (debugZerde) {
    logZerdeComplexDebug({
      rawApartments: filteredRaw,
      dedupedApartments: filteredApts,
      residentsAll: residentsAll || [],
      rentalCounts,
      purchaseCounts,
      docCounts,
    });
  }

  let enriched = buildEnrichedRows(filteredApts, residentsAll || [], rentMap, purchaseMap, docMap);
  const zerdeBeforeAllow = enriched.filter(
    (r) => normalizeComplexName(r.apartment?.residential_complex_name) === "зерде"
  ).length;
  if (zerdeBeforeAllow > 0) {
    enriched = applyZerdeAllowlistToEnrichedRows(enriched, residentsAll || [], {
      logReasons: Boolean(debugZerde || logZerdeAllowlist),
    });
  }
  return enriched;
}

export const APARTMENT_FILTERS = {
  all: () => true,
  rent: (a) => ["rent", "guest", "guest_gph"].includes(a.apartment_subtype),
  purchase: (a) => ["full_sold", "installment"].includes(a.apartment_subtype),
};

export function formatResidencePeriod(res) {
  if (!res) return "";
  const from = res.move_in_date;
  const to = res.move_out_date;
  const f = from ? new Date(from).toLocaleDateString("ru-RU") : "";
  const t = to ? new Date(to).toLocaleDateString("ru-RU") : res.is_active ? "н.в." : "";
  if (!f && !t) return "";
  return f ? `${f} — ${t || "—"}` : t;
}

export function formatPurchaseBasis(purchase) {
  if (!purchase) return "";
  const rs = purchase.realization_period != null ? String(purchase.realization_period).trim() : "";
  const cs = purchase.purchase_contract != null ? String(purchase.purchase_contract).trim() : "";
  if (rs && cs) return `${rs}; ${cs}`;
  return rs || cs || "";
}

export function formatNum(v) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
}
