import { normalizeComplexName } from "./complexName";

export const ZERDE_COMPLEX_NORM = "зерде";

/** Lowercase, trim, collapse internal whitespace (Cyrillic-safe). */
export function normalizePersonName(raw) {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Canonical 10 people for ЖК «Жилой комплекс Зерде».
 * `key` = dedupe identity; `match(n)` classifies normalized full_name from DB.
 */
const ZERDE_ENTRIES = [
  {
    key: "мадияров дархан дилдабекович",
    category: "rent",
    match: (n) => n === "мадияров дархан дилдабекович" || n.startsWith("мадияров дархан дилдабекович "),
  },
  {
    key: "есимханов болат амирбергенович",
    category: "rent",
    match: (n) => n === "есимханов болат амирбергенович" || n.startsWith("есимханов болат амирбергенович "),
  },
  {
    key: "татмаков талгар",
    category: "purchase",
    match: (n) => n === "татмаков талгар" || n.startsWith("татмаков талгар "),
  },
  {
    key: "кульбеков аскен",
    category: "purchase",
    match: (n) => n === "кульбеков аскен" || n.startsWith("кульбеков аскен "),
  },
  {
    key: "фетисов евгений николаевич",
    category: "rent",
    match: (n) => n === "фетисов евгений николаевич" || n.startsWith("фетисов евгений николаевич "),
  },
  {
    key: "искаков алишер аскарбекович",
    category: "rent",
    match: (n) => n === "искаков алишер аскарбекович" || n.startsWith("искаков алишер аскарбекович "),
  },
  {
    key: "айдархан жансая",
    category: "purchase",
    match: (n) => n === "айдархан жансая" || n.startsWith("айдархан жансая "),
  },
  {
    key: "ташкенбаев ерболат",
    category: "purchase",
    match: (n) => n === "ташкенбаев ерболат" || n.startsWith("ташкенбаев ерболат "),
  },
  {
    key: "мустафина махаббат",
    category: "purchase",
    match: (n) => n === "мустафина махаббат" || n.startsWith("мустафина махаббат "),
  },
  {
    key: "бейсембиев жанадил",
    category: "purchase",
    match: (n) => n === "бейсембиев жанадил" || n.startsWith("бейсембиев жанадил "),
  },
];

export function classifyZerdeResidentFullName(fullName) {
  const n = normalizePersonName(fullName);
  if (!n) return null;
  for (const e of ZERDE_ENTRIES) {
    if (e.match(n)) return { canonicalKey: e.key, category: e.category };
  }
  return null;
}

function isZerdeRow(row) {
  return normalizeComplexName(row?.apartment?.residential_complex_name) === ZERDE_COMPLEX_NORM;
}

/**
 * Pick active resident on this apartment whose name is in the Zerde allowlist (lowest id wins).
 */
export function resolveZerdeAllowlistedResident(apartmentId, residentsAll) {
  const active = (residentsAll || [])
    .filter((r) => r.apartment_id === apartmentId && r.is_active)
    .sort((a, b) => a.id - b.id);
  for (const r of active) {
    const hit = classifyZerdeResidentFullName(r.full_name);
    if (hit) return { resident: r, ...hit };
  }
  return null;
}

/**
 * Keeps only allowlisted Zerde rows, one row per canonical person (lowest apartment.id).
 * Patches `resident` / `fio` to the allowlisted active resident.
 */
export function applyZerdeAllowlistToEnrichedRows(rows, residentsAll, { logReasons = false } = {}) {
  const zerdeRows = (rows || []).filter(isZerdeRow);
  if (zerdeRows.length === 0) return rows;

  const excluded = [];
  const accepted = [];

  for (const row of zerdeRows) {
    const aptId = row.apartment?.id;
    const resolved = resolveZerdeAllowlistedResident(aptId, residentsAll);
    if (!resolved) {
      const activeNames = (residentsAll || [])
        .filter((r) => r.apartment_id === aptId && r.is_active)
        .map((r) => r.full_name);
      excluded.push({
        reason: "no_allowlisted_active_resident",
        apartment_id: aptId,
        address: row.address,
        residential_complex_name: row.apartment?.residential_complex_name,
        active_residents: activeNames,
        primary_fio_from_row: row.fio,
        note: "ЖК matches Зерде but no active resident matches the 10-name allowlist (stale/demo/other complex merge).",
      });
      continue;
    }
    const patched = {
      ...row,
      resident: resolved.resident,
      fio: resolved.resident?.full_name || row.fio,
      _zerdeCanonicalKey: resolved.canonicalKey,
      _zerdeCategory: resolved.category,
    };
    accepted.push(patched);
  }

  accepted.sort((a, b) => a.apartment.id - b.apartment.id);
  const seenCanon = new Set();
  const keptZerde = [];
  for (const row of accepted) {
    const k = row._zerdeCanonicalKey;
    if (seenCanon.has(k)) {
      excluded.push({
        reason: "duplicate_canonical_person",
        apartment_id: row.apartment.id,
        address: row.address,
        canonicalKey: k,
        note: "Same allowlisted person tied to two apartment ids; kept lowest apartment.id only.",
      });
      continue;
    }
    seenCanon.add(k);
    keptZerde.push(row);
  }

  const nonZerde = (rows || []).filter((r) => !isZerdeRow(r));
  const rentN = keptZerde.filter((r) => r._zerdeCategory === "rent").length;
  const purchaseN = keptZerde.filter((r) => r._zerdeCategory === "purchase").length;

  const keptStripped = keptZerde.map(({ _zerdeCanonicalKey, _zerdeCategory, ...rest }) => rest);

  if (logReasons) {
    // eslint-disable-next-line no-console
    console.group("[ЖК Зерде] allowlist filter (exactly 10 people)");
    // eslint-disable-next-line no-console
    console.log("joins_explanation", {
      source:
        "Rows come from 1:1 apartment list + primary resident per apt (no SQL join duplication). Extra rows were extra apartment records or wrong active residents matching fuzzy ЖК name.",
      dedupe_rules: [
        "1) Apartment list deduped by id and by stable unit key (same normalized ЖК + same flat).",
        "2) Only apartments with an ACTIVE resident matching one of the 10 canonical names (normalized / patronymic-tolerant).",
        "3) At most one row per canonical person (lowest apartment.id wins).",
      ],
    });
    // eslint-disable-next-line no-console
    console.log("zerde_rows_before_allowlist", zerdeRows.length);
    // eslint-disable-next-line no-console
    console.log("zerde_rows_after_allowlist", keptStripped.length, { rent: rentN, purchase: purchaseN });
    if (excluded.length) {
      // eslint-disable-next-line no-console
      console.log("excluded_rows", excluded.length, excluded);
    }
    // eslint-disable-next-line no-console
    console.log(
      "visible_names",
      keptZerde.map((r) => ({
        apartment_id: r.apartment.id,
        fio: r.fio,
        category: r._zerdeCategory,
        canonicalKey: r._zerdeCanonicalKey,
      }))
    );
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  const out = [...nonZerde, ...keptStripped];
  out.sort((a, b) => (a.apartment?.id || 0) - (b.apartment?.id || 0));
  return out;
}
