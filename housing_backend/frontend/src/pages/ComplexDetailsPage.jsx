import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ComplexWorkingTable from "../components/ComplexWorkingTable";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import AppHeader from "../components/AppHeader";
import { normalizeComplexName } from "../utils/complexName";
import { loadGlobalEnrichedRows } from "../utils/apartmentRowData";

export default function ComplexDetailsPage() {
  const { name } = useParams();
  const complexName = decodeURIComponent(name || "");
  const normClicked = useMemo(() => normalizeComplexName(complexName), [complexName]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await loadGlobalEnrichedRows(
          (a) => normalizeComplexName(a.residential_complex_name) === normClicked,
          { debugNormLabel: complexName, logZerdeAllowlist: true }
        );
        if (cancelled) return;

        setRows(data);
      } catch {
        if (!cancelled) setError("Не удалось загрузить данные по ЖК");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [normClicked]);

  return (
    <main className="container complex-page-container">
      <AppHeader />
      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && <ComplexWorkingTable rows={rows} complexName={complexName} />}
    </main>
  );
}
