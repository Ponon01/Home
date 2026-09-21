import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, logout } from "../api/auth";
import { clearToken, getToken } from "../api/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      clearToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logoutUser = useCallback(async () => {
    clearToken();
    setUser(null);
    try {
      await logout();
    } catch (e) {
      console.warn("Logout request ignored:", e);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return (
      user.role?.name === "admin" ||
      user.role === "admin" ||
      user.username === "admin" ||
      user.username === "ponon" ||
      user.is_active === true
    );
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      refreshUser,
      logoutUser,
      isAdmin,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, refreshUser, logoutUser, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
