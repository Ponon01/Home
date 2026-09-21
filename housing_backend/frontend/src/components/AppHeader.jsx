import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const onLogout = async (e) => {
    if (e) e.preventDefault();
    await logoutUser();
    navigate("/", { replace: true });
  };

  const displayName =
    user?.full_name || user?.display_name || user?.username || "";

  return (
    <header className="app-header">
      <nav className="app-header-nav" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            textDecoration: "none",
            marginRight: "16px",
            background: "transparent",
            padding: "8px 0",
          }}
        >
          <img
            src="/Logo.png"
            alt="Astana Opera"
            style={{
              height: "90px",
              width: "auto",
              objectFit: "contain",
              cursor: "pointer",
              filter: "invert(72%) sepia(51%) saturate(542%) hue-rotate(5deg) brightness(93%) contrast(88%)"
            }}
          />

          <div
            style={{
              width: "1px",
              height: "70px",
              background: "rgba(197, 160, 89, 0.4)",
              margin: "0 4px",
            }}
          />
          <span
            style={{
              color: "#C5A059",
              fontFamily: "'Georgia', serif",
              fontSize: "22px",
              fontWeight: "400",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            Жильё для сотрудников
          </span>
        </Link>
        <Link to="/">{t("navHome")}</Link>
      </nav>
      <div className="app-header-actions">
        <div className="hf-lang-toggle" role="group" aria-label="Language">
          <button
            type="button"
            className={`hf-lang-btn${lang === "ru" ? " is-active" : ""}`}
            onClick={() => setLang("ru")}
          >
            RU
          </button>
          <button
            type="button"
            className={`hf-lang-btn${lang === "kk" ? " is-active" : ""}`}
            onClick={() => setLang("kk")}
          >
            QZ
          </button>
        </div>
        {displayName ? <span className="app-header-user">{displayName}</span> : null}
        <button type="button" className="button button-ghost" onClick={onLogout}>
          {t("logout")}
        </button>
      </div>
    </header>
  );
}
