import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../api/auth";
import { setToken } from "../api/tokenStorage";
import { useAuth } from "../context/AuthContext";

export default function AdminLoginModal({ open, onClose }) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setLoading(false);
    }
  }, [open]);

  const canSubmit = useMemo(() => password.trim().length > 0 && !loading, [password, loading]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await adminLogin(password.trim());
      setToken(data.access_token);
      const me = await refreshUser();
      onClose?.();
      if (me) {
        navigate("/departments/housing", { replace: true });
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError("Неверный пароль");
      } else if (!err?.response) {
        setError("Сервер недоступен. Проверьте, что backend запущен.");
      } else {
        setError("Не удалось войти. Попробуйте ещё раз.");
      }
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
            <h3 className="admin-modal-title">Вход для администрации</h3>
            <p className="admin-modal-sub muted">Чтобы открыть панель ДЖСВ, введите пароль</p>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="admin-modal-form">
          <label className="admin-modal-label">
            Пароль администратора
            <input
              type="password"
              className="admin-modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="admin123"
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
