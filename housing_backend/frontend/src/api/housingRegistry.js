import api from "./client";

export async function listRegistryResidents(params = {}) {
  const { data } = await api.get("/housing-registry/residents", { params });
  return data;
}

export async function getRegistryResident(residentId) {
  const { data } = await api.get(`/housing-registry/residents/${residentId}`);
  return data;
}
