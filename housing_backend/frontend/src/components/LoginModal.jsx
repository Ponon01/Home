import { useEffect, useMemo, useState } from "react";
import { login } from "../api/auth";
import { setToken } from "../api/tokenStorage";
import { useAuth } from "../context/AuthContext";

export default function LoginModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setError("");
      setLoading(false);
    }
  }, [open]);

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.length > 0 && !loading,
    [username, password, loading]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(username.trim(), password);
      setToken(data.access_token);
      await refreshUser();
      onClose?.();
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <div className="admin-modal-head">
          <div>
            <h3 className="admin-modal-title">Вход в систему</h3>
            <p className="admin-modal-sub muted">Введите логин и пароль администратора</p>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="admin-modal-form">
          <label className="admin-modal-label">
            Username
            <input
              className="admin-modal-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              placeholder="admin"
              autoComplete="username"
            />
          </label>
          <label className="admin-modal-label">
            Password
            <input
              type="password"
              className="admin-modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
            />
          </label>
          {error ? <div className="state error">{error}</div> : null}
          <div className="admin-modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="button admin-modal-primary" disabled={!canSubmit}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
