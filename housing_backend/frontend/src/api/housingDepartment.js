import api from "./client";

export async function getHousingRecords() {
  const { data } = await api.get("/housing-department/records");
  return data;
}

export async function updateHousingRecord(id, payload) {
  const { data } = await api.patch(`/housing-department/records/${id}`, payload);
  return data;
}

export async function addHousingColumn(name) {
  const { data } = await api.post("/housing-department/columns", { name });
  return data;
}
