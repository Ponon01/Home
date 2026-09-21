import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import "../departments-landing.css";

function HomeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 14h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="14" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="9" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="16" y="5" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const DEPARTMENTS = [
  {
    to: "/departments/housing",
    abbr: "ДЖСВ",
    title: "Департамент по жилищно-социальным вопросам",
    icon: HomeIcon,
    accent: "#2D463E",
    accentBg: "rgba(45, 70, 62, 0.06)",
  },
  {
    to: "/departments/budget",
    abbr: "ДБиЭА",
    title: "Департамент бюджетного и экономического анализа",
    icon: ChartIcon,
    accent: "#2D463E",
    accentBg: "rgba(45, 70, 62, 0.06)",
  },
];

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const onLogout = async () => {
    await logout();
    await refreshUser();
    navigate("/", { replace: true });
  };

  return (
    <div className="dept-landing-page">
      <header className="dept-landing-header">
        <button type="button" className="button button-ghost dept-landing-logout" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <main className="dept-landing-main">
        <div className="dept-landing-center">
          <h1 className="dept-landing-title">Департаменты</h1>
          <p className="dept-landing-subtitle">Выберите направление:</p>

          <div className="dept-landing-cards">
            {DEPARTMENTS.map((dept) => {
              const Icon = dept.icon;
              return (
                <Link
                  key={dept.to}
                  to={dept.to}
                  className="dept-landing-card"
                  style={{ "--card-accent": dept.accent, "--card-accent-bg": dept.accentBg }}
                >
                  <span className="dept-landing-card-icon">
                    <Icon />
                  </span>
                  <span className="dept-landing-card-abbr">{dept.abbr}</span>
                  <span className="dept-landing-card-desc">{dept.title}</span>
                </Link>
              );
            })}
          </div>

          <Link to="/" className="dept-landing-home-link">
            ← На главную
          </Link>
        </div>
      </main>
    </div>
  );
}
