import { useEffect, useState } from "react";
import { getHousingRecords } from "../api/housingDepartment";

export function useHousingDepartmentRecords() {
  const [rows, setRows] = useState([]);
  const [customHeaders, setCustomHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const applyPayload = (data) => {
    setRows(data.rows || []);
    setCustomHeaders(data.custom_headers || []);
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getHousingRecords();
      applyPayload(data);
    } catch {
      setRows([]);
      setCustomHeaders([]);
      setError("Не удалось загрузить данные ДЖСВ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { rows, setRows, customHeaders, setCustomHeaders, applyPayload, loading, error, refresh };
}
