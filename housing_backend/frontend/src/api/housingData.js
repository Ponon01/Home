import api from "./client";

export async function listRentalFinancials(params = {}) {
  const { data } = await api.get("/rental-financials", { params });
  return data;
}

export async function listPurchaseFinancials(params = {}) {
  const { data } = await api.get("/purchase-financials", { params });
  return data;
}

export async function updateRentalFinancial(id, payload) {
  const { data } = await api.patch(`/rental-financials/${id}`, payload);
  return data;
}

export async function updatePurchaseFinancial(id, payload) {
  const { data } = await api.patch(`/purchase-financials/${id}`, payload);
  return data;
}
