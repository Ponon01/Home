import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminLoginModal from "./AdminLoginModal";

export default function AdminGateRoute() {
  const { isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onUnauthorized = () => setOpen(true);
    window.addEventListener("admin:unauthorized", onUnauthorized);
    return () => window.removeEventListener("admin:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      setOpen(true);
    } else if (!loading && isAdmin) {
      setOpen(false);
    }
  }, [loading, isAdmin]);

  const close = () => {
    setOpen(false);
    // If user closes modal without admin access, send them back to public home.
    if (!isAdmin) navigate("/", { replace: true, state: { from: location.pathname } });
  };

  if (loading) return null;

  if (!isAdmin) {
    return (
      <>
        <AdminLoginModal open={open} onClose={close} />
      </>
    );
  }

  return <Outlet />;
}

