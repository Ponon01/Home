import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "../api/tokenStorage";

export default function ProtectedRoute() {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
