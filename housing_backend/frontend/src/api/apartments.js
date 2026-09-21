import api from "./client";

export async function getApartments(params = {}) {
  const { data } = await api.get("/apartments", { params });
  return data;
}

export async function getApartmentFullCard(id) {
  const { data } = await api.get(`/apartments/${id}/full-card`);
  return data;
}

export async function getResidents(params = {}) {
  const { data } = await api.get("/residents", { params });
  return data;
}

export async function updateApartment(id, payload) {
  const { data } = await api.patch(`/apartments/${id}`, payload);
  return data;
}

export async function updateResident(id, payload) {
  const { data } = await api.patch(`/residents/${id}`, payload);
  return data;
}

export async function createResident(payload) {
  const { data } = await api.post("/residents", payload);
  return data;
}
