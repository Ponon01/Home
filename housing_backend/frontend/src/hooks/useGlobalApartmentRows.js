import { useEffect, useState } from "react";
import { APARTMENT_FILTERS, loadGlobalEnrichedRows } from "../utils/apartmentRowData";

/**
 * @param {'all' | 'rent' | 'purchase'} mode
 */
export function useGlobalApartmentRows(mode) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const predicate = APARTMENT_FILTERS[mode] || APARTMENT_FILTERS.all;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await loadGlobalEnrichedRows(predicate);
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Не удалось загрузить данные");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return { rows, loading, error };
}
