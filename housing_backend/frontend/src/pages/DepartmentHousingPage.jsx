import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import HousingApplicationsAdminTable from "../components/department/HousingApplicationsAdminTable";
import HousingDepartmentTabs from "../components/department/HousingDepartmentTabs";
import AnalyticsDashboard from "../components/department/AnalyticsDashboard";
import HousingFundPanel from "../components/department/HousingFundPanel";
import PaymentsRegistry from "../components/department/PaymentsRegistry";
import ContractsRegistry from "../components/department/ContractsRegistry";
import ReportsPanel from "../components/department/ReportsPanel";
import { UserHousingView } from "../components/userRole/UserRoleViews";
import { useHousingDepartmentRecords } from "../hooks/useHousingDepartmentRecords";
import { useAuth } from "../context/AuthContext";
import { ensureHousingStore } from "../data/housingStore";
import "../user-role.css";
import "../dashboard.css";
import "../components/department/housing-fund.css";
import "../components/department/housing-fund-executive.css";

export default function DepartmentHousingPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [role, setRole] = useState("user");
  const [activeTab, setActiveTab] = useState("fund");
  const { rows, loading, error } = useHousingDepartmentRecords();

  useEffect(() => {
    ensureHousingStore();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      setRole(isAdmin ? "admin" : "user");
    }
  }, [isAdmin, authLoading]);

  if (authLoading) {
    return (
      <div className="dept-housing-page">
        <main className="container complex-page-container dept-housing-inner">
          <Loading />
        </main>
      </div>
    );
  }

  if (role === "admin" && activeTab === "analytics") {
    return (
      <AnalyticsDashboard
        activeNavId="home"
        onNavigate={(tab) => {
          if (tab === "analytics") return;
          setActiveTab(tab);
        }}
      />
    );
  }

  return (
    <div className="dept-housing-page">
      <main className="container complex-page-container dept-housing-inner">
        <AppHeader />

        {role === "admin" && (
          <>
            <HousingDepartmentTabs activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === "fund" && (
              <div className="dept-housing-tab-panel">
                <HousingFundPanel />
              </div>
            )}

            {activeTab === "applications" && (
              <div className="dept-housing-tab-panel">
                <HousingApplicationsAdminTable />
              </div>
            )}

            {activeTab === "payments" && (
              <div className="dept-housing-tab-panel">
                <PaymentsRegistry />
              </div>
            )}

            {activeTab === "contracts" && (
              <div className="dept-housing-tab-panel">
                <ContractsRegistry />
              </div>
            )}

            {activeTab === "reports" && (
              <div className="dept-housing-tab-panel">
                <ReportsPanel />
              </div>
            )}
          </>
        )}

        {role === "user" && (
          <>
            {loading && <Loading />}
            {error && <ErrorMessage message={error} />}
            {!loading && !error && <UserHousingView rows={rows} />}
          </>
        )}
      </main>
    </div>
  );
}
