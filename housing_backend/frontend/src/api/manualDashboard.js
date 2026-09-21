import api from "./client";

export async function getManualDashboardSummary() {
  const { data } = await api.get("/dashboard/manual-summary");
  return data;
}

export async function createManualSummaryRow(body) {
  const { data } = await api.post("/dashboard/manual-summary", body);
  return data;
}

export async function patchManualSummaryRow(id, body) {
  const { data } = await api.patch(`/dashboard/manual-summary/${id}`, body);
  return data;
}

export async function deleteManualSummaryRow(id) {
  await api.delete(`/dashboard/manual-summary/${id}`);
}

export async function uploadComplexPhoto(id, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/dashboard/manual-summary/${id}/upload-photo`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function deleteComplexPhoto(id) {
  const { data } = await api.delete(`/dashboard/manual-summary/${id}/delete-photo`);
  return data;
}
