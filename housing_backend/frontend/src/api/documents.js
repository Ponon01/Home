import api from "./client";

export async function listDocuments(params = {}) {
  const { data } = await api.get("/documents", { params });
  return data;
}

export async function openDocument(id) {
  const response = await api.get(`/documents/${id}/download`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);
}

export async function downloadDocument(id, fileName = "document") {
  const response = await api.get(`/documents/${id}/download`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);
}

export async function uploadDocument({ apartmentId, documentType, checklistKey, file, residentId }) {
  const form = new FormData();
  form.append("apartment_id", String(apartmentId));
  if (documentType) form.append("document_type", documentType);
  if (checklistKey) form.append("checklist_key", checklistKey);
  if (residentId != null) form.append("resident_id", String(residentId));
  form.append("file", file);
  const { data } = await api.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteDocument(id) {
  await api.delete(`/documents/${id}`);
}
