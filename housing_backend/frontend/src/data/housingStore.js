import { MOCK_HOUSING_BUNDLE, buildMockHousingBundle } from "./mockHousingData";
import {
  listHousingFundApartments,
  listHousingFundContracts,
  listHousingFundComplexes,
} from "../api/housingFund";

const STORAGE_KEY = "housing_local_store_v4";

function canUseStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readHousingStore() {
  if (!canUseStorage()) return structuredCloneSafe(MOCK_HOUSING_BUNDLE);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.apartments)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHousingStore(bundle) {
  if (!canUseStorage()) return bundle;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  } catch (e) {
    console.warn("[housingStore] write failed:", e);
  }
  return bundle;
}

export function ensureHousingStore() {
  const existing = readHousingStore();
  if (existing?.apartments?.length) return existing;
  const fresh = buildMockHousingBundle();
  return writeHousingStore(fresh);
}

export function getLocalApartments() {
  return ensureHousingStore().apartments || [];
}

export function getLocalContracts() {
  return ensureHousingStore().contracts || [];
}

export function getLocalPayments() {
  return (ensureHousingStore().payments || []).filter((p) => !isFakePayment(p));
}

export function getLocalComplexes() {
  return ensureHousingStore().complexes || [];
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function syncFromApiPayload({ apartments, contracts, complexes } = {}) {
  const current = ensureHousingStore();
  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
    apartments: Array.isArray(apartments) && apartments.length ? apartments : current.apartments,
    contracts: Array.isArray(contracts) && contracts.length ? contracts : current.contracts,
    complexes: Array.isArray(complexes) && complexes.length ? complexes : current.complexes,
    // Платежи только из реальных источников — без mock PAY-*
    payments: Array.isArray(current.payments) ? current.payments.filter((p) => !isFakePayment(p)) : [],
  };
  return writeHousingStore(next);
}

function isFakePayment(p) {
  if (!p || typeof p !== "object") return true;
  if (p._fallback) return true;
  const id = String(p.id || "");
  return /^PAY-\d+$/i.test(id);
}

/**
 * Prefer API; on any failure or empty payload fall back to localStorage/mock.
 * Never throws for UI — always returns usable arrays.
 */
export async function loadHousingDataSafe() {
  ensureHousingStore();
  try {
    const [apartments, contracts, complexes] = await Promise.all([
      listHousingFundApartments().catch(() => null),
      listHousingFundContracts().catch(() => null),
      listHousingFundComplexes().catch(() => null),
    ]);

    const hasApiApts = Array.isArray(apartments) && apartments.length > 0;
    const hasApiContracts = Array.isArray(contracts) && contracts.length > 0;

    if (hasApiApts || hasApiContracts) {
      const synced = syncFromApiPayload({
        apartments: hasApiApts ? apartments : null,
        contracts: hasApiContracts ? contracts : null,
        complexes: Array.isArray(complexes) && complexes.length ? complexes : null,
      });
      return {
        source: "api+local",
        apartments: synced.apartments,
        contracts: synced.contracts,
        payments: synced.payments,
        complexes: synced.complexes,
      };
    }
  } catch (e) {
    console.warn("[housingStore] API unavailable, using local fallback:", e);
  }

  const local = ensureHousingStore();
  return {
    source: "local",
    apartments: local.apartments || [],
    contracts: local.contracts || [],
    payments: (local.payments || []).filter((p) => !isFakePayment(p)),
    complexes: local.complexes || [],
  };
}

export function resetHousingStoreToMock() {
  return writeHousingStore(buildMockHousingBundle());
}

export { STORAGE_KEY };
