import api from "./client";

export async function getBudgetRentRecords() {
  const { data } = await api.get("/budget-rent");
  return data;
}
