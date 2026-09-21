import { useEffect, useState } from "react";
import { getPublicManualDashboardSummary } from "../api/publicDashboard";
import { UserDashboardView } from "../components/userRole/UserRoleViews";
import "../dashboard.css";
import "../user-role.css";

/** Публичная главная — без логина, без админ-таблиц. */
export default function DashboardPage() {
  const [complexes, setComplexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadComplexes = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    getPublicManualDashboardSummary()
      .then((data) => setComplexes(data.rows || []))
      .catch(() => setError("Не удалось загрузить сводку"))
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    loadComplexes(true);
  }, []);

  return (
    <UserDashboardView
      complexes={complexes}
      loading={loading}
      error={error}
      onRefresh={(showSpinner) => loadComplexes(showSpinner)}
    />
  );
}
