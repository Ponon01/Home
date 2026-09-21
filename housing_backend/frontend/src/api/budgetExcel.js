import api from "./client";

const EXCEL_TIMEOUT = 120000;

/** Returns { headers: string[], rows: object[] } from Аренда.xlsx */
export async function getBudgetRentExcel() {
  const { data } = await api.get("/budget-excel/rent", { timeout: EXCEL_TIMEOUT });
  return data;
}

/** Returns { headers: string[], rows: object[] } from рассрочка и выкупленные.xlsx */
export async function getBudgetPurchaseExcel() {
  const { data } = await api.get("/budget-excel/purchase", { timeout: EXCEL_TIMEOUT });
  return data;
}

export async function updateBudgetRentRow(rowId, data) {
  const { data: result } = await api.patch(`/budget-excel/rent/${rowId}`, { data });
  return result;
}

export async function updateBudgetPurchaseRow(rowId, data) {
  const { data: result } = await api.patch(`/budget-excel/purchase/${rowId}`, { data });
  return result;
}

export async function addBudgetRentColumn(name) {
  const { data } = await api.post("/budget-excel/rent/columns", { name });
  return data;
}

export async function addBudgetPurchaseColumn(name) {
  const { data } = await api.post("/budget-excel/purchase/columns", { name });
  return data;
}

export async function getBudgetRentAnalytics() {
  const { data } = await api.get("/budget-excel/analytics/rent", { timeout: EXCEL_TIMEOUT });
  return data;
}

export async function getBudgetPurchaseAnalytics() {
  const { data } = await api.get("/budget-excel/analytics/purchase", { timeout: EXCEL_TIMEOUT });
  return data;
}

export async function uploadBudgetExcel(file, source) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source", source);
  const { data } = await api.post("/budget-excel/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: EXCEL_TIMEOUT
  });
  return data;
}
