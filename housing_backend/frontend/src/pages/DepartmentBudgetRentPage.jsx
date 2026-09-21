import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import BudgetRentTable from "../components/department/BudgetRentTable";
import { useBudgetRentRows } from "../hooks/useBudgetRentRows";

export default function DepartmentBudgetRentPage() {
  const { rows, loading, error } = useBudgetRentRows();

  return (
    <main className="container complex-page-container">
      <AppHeader />
      <nav className="dept-breadcrumb muted">
        <Link to="/departments/housing">ДЖСВ</Link>
        {" / "}
        <Link to="/departments/budget">ДБиЭА</Link>
        {" / "}
        <span>Аренда</span>
      </nav>
      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && <BudgetRentTable rows={rows} title="ДБиЭА: аренда (все ЖК)" />}
    </main>
  );
}
