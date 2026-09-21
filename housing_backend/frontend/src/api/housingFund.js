import api from "./client";

export async function getHousingFundAnalytics() {
  const { data } = await api.get("/housing-fund/analytics");
  return data;
}

/** @returns {Promise<Array>} */
export async function listHousingFundComplexes() {
  const { data } = await api.get("/housing-fund/complexes");
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.rows)) return data.rows;
  if (data && Array.isArray(data.complexes)) return data.complexes;
  console.warn("[housingFund] Unexpected complexes response shape:", data);
  return [];
}

export async function listHousingFundApartments(params = {}) {
  const { data } = await api.get("/housing-fund/apartments", { params });
  return Array.isArray(data) ? data : [];
}

export async function getHousingFundApartment(apartmentId) {
  const { data } = await api.get(`/housing-fund/apartments/${apartmentId}`);
  return data;
}

export async function updateHousingFundApartment(apartmentId, payload) {
  const { data } = await api.patch(`/apartments/${apartmentId}`, payload);
  return data;
}

export async function listHousingFundContracts() {
  const { data } = await api.get("/housing-fund/contracts");
  return data;
}

/** Контрольные итоги Excel (поступления / выкуп / рассрочка / фонд). */
export async function getExcelControlTotals() {
  const { data } = await api.get("/housing-fund/excel-controls");
  return data;
}

export async function uploadResidentContract(residentId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/residents/${residentId}/upload-contract`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
