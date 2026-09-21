import api from "./client";

export async function listErcInvoices(period, search = "") {
  const { data } = await api.get("/erc-invoices/invoices", {
    params: {
      period,
      search: search || undefined,
    },
  });
  return data;
}

export async function listErcOverdue(period, search = "") {
  // currently backend overdue endpoint doesn't support search;
  // keep signature for future compatibility.
  const { data } = await api.get("/erc-invoices/overdue", { params: { period } });
  return data;
}

export async function updateErcInvoiceAmount(invoiceId, amount) {
  const { data } = await api.patch(`/erc-invoices/invoices/${invoiceId}`, null, {
    params: { monthly_payment: amount },
  });
  return data;
}

export async function uploadErcInvoiceReceipt(invoiceId, file) {
  const formData = new FormData();
  formData.append("receipt", file);
  const { data } = await api.post(`/erc-invoices/invoices/upload`, formData, {
    params: { invoice_id: invoiceId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

