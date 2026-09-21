import { useEffect, useState } from "react";
import { getBudgetRentRecords } from "../api/budgetRent";

export function useBudgetRentRows() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getBudgetRentRecords();
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Не удалось загрузить данные об аренде");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading, error };
}
