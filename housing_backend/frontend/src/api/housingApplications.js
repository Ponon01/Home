import api from "./client";

export async function submitHousingApplication({
  fio,
  position,
  department,
  application_type,
  signedApplication,
  housingCertificate,
  idDocument,
  familyMembers = [],
}) {
  const form = new FormData();
  form.append("fio", fio);
  form.append("position", position || "");
  form.append("department", department || "");
  form.append("application_type", application_type || "");
  form.append("signed_application", signedApplication);
  form.append("housing_certificate", housingCertificate);
  form.append("id_document", idDocument);
  form.append(
    "family_members",
    JSON.stringify(
      familyMembers.map(({ fio: memberFio, relationship }) => ({
        fio: memberFio,
        relationship,
      }))
    )
  );
  familyMembers.forEach((member, index) => {
    form.append(`family_${index}_id_document`, member.idDocument || member.document);
    form.append(`family_${index}_housing_certificate`, member.housingCertificate || member.document);
  });
  const { data } = await api.post("/public/housing-applications", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return data;
}

export async function listHousingApplications(applicationType = "all") {
  const params = applicationType && applicationType !== "all" ? { application_type: applicationType } : {};
  const { data } = await api.get("/housing-applications", { params });
  return data;
}

export async function updateHousingApplication(id, payload) {
  const { data } = await api.patch(`/housing-applications/${id}`, payload);
  return data;
}

export async function openHousingApplicationDocument(applicationId, docField) {
  const response = await api.get(`/housing-applications/${applicationId}/download/${docField}`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], {
    type: response.headers["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => window.URL.revokeObjectURL(url), 15000);
}

export async function openFamilyMemberDocument(applicationId, memberId, docField) {
  const response = await api.get(
    `/housing-applications/${applicationId}/family/${memberId}/download/${docField}`,
    { responseType: "blob" }
  );
  const blob = new Blob([response.data], {
    type: response.headers["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => window.URL.revokeObjectURL(url), 15000);
}
