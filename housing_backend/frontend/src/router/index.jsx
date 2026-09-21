import { createBrowserRouter, Navigate } from "react-router-dom";
import DashboardPage from "../pages/DashboardPage";
import ManualSummaryEditPage from "../pages/ManualSummaryEditPage";
import ComplexDetailsPage from "../pages/ComplexDetailsPage";
import ApartmentFullCardPage from "../pages/ApartmentFullCardPage";
import DepartmentHousingPage from "../pages/DepartmentHousingPage";
import DepartmentBudgetPage from "../pages/DepartmentBudgetPage";
import DepartmentBudgetRentPage from "../pages/DepartmentBudgetRentPage";
import LoginPage from "../pages/LoginPage";
import AdminGateRoute from "../components/AdminGateRoute";
import HousingRegistryPage from "../pages/HousingRegistryPage";

export const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <AdminGateRoute />,
    children: [
      { path: "/departments", element: <Navigate to="/departments/housing" replace /> },
      { path: "/departments/housing", element: <DepartmentHousingPage /> },
      { path: "/departments/housing/registry", element: <HousingRegistryPage /> },
      { path: "/departments/budget", element: <DepartmentBudgetPage /> },
      { path: "/departments/budget/rent", element: <DepartmentBudgetRentPage /> },
      { path: "/dashboard/manual-summary", element: <ManualSummaryEditPage /> },
      { path: "/complex/:name", element: <ComplexDetailsPage /> },
      { path: "/complex/:name/apartments", element: <ComplexDetailsPage /> },
      { path: "/apartments/:id", element: <ApartmentFullCardPage /> },
    ],
  },
]);
