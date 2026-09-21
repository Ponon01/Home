import api from "./client";

export async function getPublicManualDashboardSummary() {
  const { data } = await api.get("/public/dashboard/manual-summary");
  return data;
}

