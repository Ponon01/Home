import api from "./client";

export async function getChangeHistory(params = {}) {
  const { data } = await api.get("/change-history", { params });
  return data;
}
