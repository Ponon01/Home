import api from "./client";

export async function listComplexes() {
  const { data } = await api.get("/complexes");
  return data;
}

export async function getComplex(id) {
  const { data } = await api.get(`/complexes/${id}`);
  return data;
}

export async function updateComplex(id, payload) {
  const { data } = await api.patch(`/complexes/${id}`, payload);
  return data;
}
