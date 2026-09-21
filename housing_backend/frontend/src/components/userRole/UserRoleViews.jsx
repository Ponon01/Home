import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Building2,
  Home,
  Users,
  ImageIcon,
  LogIn,
  Download,
  FileText,
  ListOrdered,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  Camera,
  Trash2,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";
import { clearToken } from "../../api/tokenStorage";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import LoginModal from "../LoginModal";
import AdminLoginModal from "../AdminLoginModal";
import HeroRulesSection from "./HeroRulesSection";
import HousingApplicationCTA from "./HousingApplicationCTA";
import { uploadComplexPhoto, deleteComplexPhoto } from "../../api/manualDashboard";
import { getPublicManualDashboardSummary } from "../../api/publicDashboard";
import EditComplexModal from "./EditComplexModal";
import {
  getComplexPhotoUrl,
  hasCustomComplexPhoto,
  purgeAllLegacyComplexPhotos,
} from "../../utils/getComplexPhotoUrl";
import { getExcelDefaults, normalizeComplexName } from "../../utils/complexExcelDefaults";
import ComplexPhotoImg from "../ComplexPhotoImg";

const BLANK_URL = "/templates/zayavlenie-zhile-blank.html";

// LocalStorage Migration/Reset for official Excel housing data (non_realizable & to_realize)
(function migrationReset() {
  try {
    let needsReset = false;
    let hasKeys = false;
    
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("complex_data_v3_")) {
        hasKeys = true;
        try {
          const item = JSON.parse(localStorage.getItem(k));
          if (item && (item.name === "Лазурный квартал" || k === "complex_data_v3_1")) {
            if (item.notForSale === undefined || Number(item.notForSale) === 0 || item.rent_as_flat === undefined) {
              needsReset = true;
              break;
            }
          }
        } catch (e) {}
      }
    }
    
    if (!hasKeys || needsReset) {
      console.log("Force resetting localStorage with CLEAN_HOUSING_DATA...");
      
      const photos = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("complex_photo_")) {
          photos[k] = localStorage.getItem(k);
        }
      }
      
      localStorage.clear();
      
      Object.keys(photos).forEach((k) => {
        localStorage.setItem(k, photos[k]);
      });
      
      const CLEAN_HOUSING_DATA = [
        { id: 1, name: "Лазурный квартал", district: "Есильский район", address: "ул. Сарайшык 5", total: 22, non_realizable: 7, to_realize: 15, realized: 9, remained: 13, in_rent: 6, guest: 7, rent_as_flat: 6, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 2, name: "Сармат", district: "Есильский район", address: "ул. Сауран 3/1", total: 18, non_realizable: 0, to_realize: 18, realized: 14, remained: 4, in_rent: 4, guest: 0, rent_as_flat: 4, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 3, name: "Зерде", district: "Алматинский район", address: "пр. Шакарим Кудайбердыулы 4", total: 10, non_realizable: 0, to_realize: 10, realized: 6, remained: 4, in_rent: 4, guest: 0, rent_as_flat: 4, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 4, name: "Москва", district: "Сарыаркинский район", address: "ул. Иманова 17", total: 1, non_realizable: 0, to_realize: 1, realized: 1, remained: 0, in_rent: 0, guest: 0, rent_as_flat: 0, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 5, name: "Виктория", district: "Алматинский район", address: "пр. Бауыржан Момышулы 2", total: 12, non_realizable: 0, to_realize: 12, realized: 8, remained: 4, in_rent: 4, guest: 0, rent_as_flat: 4, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 6, name: "Жагалау-3", district: "район Нура", address: "ул. Чингиз Айтматов 36", total: 28, non_realizable: 2, to_realize: 26, realized: 20, remained: 8, in_rent: 8, guest: 0, rent_as_flat: 6, rent_as_dorm: 2, dorm_flats_info: "кв. 43, 44" },
        { id: 7, name: "НУР-САЯ", district: "Есильский район", address: "ул. Достык 13/2", total: 10, non_realizable: 0, to_realize: 10, realized: 10, remained: 0, in_rent: 0, guest: 0, rent_as_flat: 0, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 8, name: "Общежитие", district: "Сарыаркинский район", address: "пр. Республики 81", total: 53, non_realizable: 4, to_realize: 49, realized: 8, remained: 45, in_rent: 45, guest: 0, rent_as_flat: 45, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 9, name: "Сапа-2007", district: "Сарыаркинский район", address: "ул. Шаймерден Косшыгулулы 7", total: 25, non_realizable: 7, to_realize: 18, realized: 15, remained: 10, in_rent: 10, guest: 0, rent_as_flat: 7, rent_as_dorm: 3, dorm_flats_info: "кв. 177, 181, 242" },
        { id: 10, name: "Хан-тенгри", district: "район Байконур", address: "ул. Сембинова 7", total: 11, non_realizable: 0, to_realize: 11, realized: 10, remained: 1, in_rent: 1, guest: 0, rent_as_flat: 1, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 11, name: "Акку", district: "район Нура", address: "ул. Култегин 5", total: 20, non_realizable: 9, to_realize: 10, realized: 5, remained: 15, in_rent: 10, guest: 5, rent_as_flat: 1, rent_as_dorm: 9, dorm_flats_info: "кв. 116, 128, 130, 153, 186, 424, 437, 514, 516" },
        { id: 12, name: "ул. К. Азирбаева", district: "район Сарайшык", address: "ул. Кенен Азирбаева 6/2", total: 10, non_realizable: 0, to_realize: 10, realized: 6, remained: 4, in_rent: 4, guest: 0, rent_as_flat: 4, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 13, name: "Браво", district: "район Сарайшык", address: "ул. Шамши Калдаякова 17", total: 2, non_realizable: 0, to_realize: 2, realized: 0, remained: 2, in_rent: 2, guest: 0, rent_as_flat: 2, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 14, name: "Compass North", district: "район Сарайшык", address: "ул. Шамши Калдаякова 58/1", total: 6, non_realizable: 6, to_realize: 0, realized: 0, remained: 6, in_rent: 6, guest: 0, rent_as_flat: 6, rent_as_dorm: 0, dorm_flats_info: "" },
        { id: 15, name: "Respublika", district: "Есильский район", address: "ул. Е 36 дом 5", total: 26, non_realizable: 26, to_realize: 0, realized: 0, remained: 26, in_rent: 22, guest: 4, rent_as_flat: 22, rent_as_dorm: 0, dorm_flats_info: "" }
      ];
      
      CLEAN_HOUSING_DATA.forEach((complex) => {
        localStorage.setItem(`complex_data_v3_${complex.id}`, JSON.stringify({
          name: complex.name,
          district: complex.district,
          address: complex.address,
          total: complex.total,
          notForSale: complex.non_realizable,
          forSale: complex.to_realize,
          sold: complex.realized,
          remaining: complex.remained,
          rent: complex.in_rent,
          guest: complex.guest,
          rent_as_flat: complex.rent_as_flat,
          rent_as_dorm: complex.rent_as_dorm,
          dorm_flats_info: complex.dorm_flats_info
        }));
      });
    }
  } catch (e) {
    console.error("Migration error:", e);
  }
})();

const DEPARTMENT_STAFF = [
  {
    name: "Шериев Пирман Турсунбаевич",
    position: "Директор департамента",
    ext: "1008",
    phone: "709 608",
    office: "С.308",
    emails: ["social-home@astanaopera.kz", "astanaopera@bk.ru"],
    initials: "ШП",
  },
  {
    name: "Суендыкова Мадина",
    position: "Главный специалист",
    ext: "1067",
    phone: "709 583",
    office: "С.308",
    emails: [],
    initials: "ЕМ",
  },
  {
    name: "Туямашев Серик",
    position: "Главный специалист",
    ext: "1329",
    phone: "709 583",
    office: "С.308",
    emails: [],
    initials: "ТС",
  },
  {
    name: "Балабекова Нурила Бауыржанқызы",
    position: "Специалист",
    ext: "1216",
    phone: "",
    office: "С.308",
    emails: [],
    initials: "БН",
  },
  {
    name: "Нурпейсова Кундыз Сандибаевна",
    position: "Главный специалист",
    ext: "1069",
    phone: "",
    office: "С.308",
    emails: [],
    initials: "НК",
  },
];

const HOUSING_RULES = [
  {
    id: "eligibility",
    icon: Users,
    title: "Кто имеет право",
    badge: "Приказ № 02-05/452-ОД",
    content:
      "Работник и члены его семьи, не имеющие жилья в г. Астане и в радиусе 50 км в течение последних 3 лет.",
  },
  {
    id: "queue",
    icon: ListOrdered,
    title: "Критерии очереди",
    badge: "3 очереди",
    content: (
      <ol className="housing-rules-list">
        <li>
          <span className="queue-badge">01</span>
          <span className="queue-title">1-я очередь</span> — приглашённые специалисты особой творческой значимости.
        </li>
        <li>
          <span className="queue-badge">02</span>
          <span className="queue-title">2-я очередь</span> — остро нуждающиеся работники с вкладом в развитие театра.
        </li>
        <li>
          <span className="queue-badge">03</span>
          <span className="queue-title">3-я очередь</span> — сотрудники из журнала учёта без взысканий.
        </li>
      </ol>
    ),
  },
  {
    id: "conditions",
    icon: ShieldCheck,
    title: "Важные условия",
    badge: "Обязательно к прочтению",
    content:
      "Жильё предоставляется только на период трудовых отношений. При увольнении — выселение в течение 10 дней. Амортизация признаётся материальной выгодой с удержанием налогов (ИПН, ОПВ, ВОСМС) из заработной платы.",
  },
];

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}


function PublicHomeHeader() {
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, user, refreshUser, logoutUser } = useAuth();
  const { lang, setLang } = useLanguage();
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const onLogout = async (e) => {
    if (e) e.preventDefault();
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleAdminModalClose = async () => {
    setAdminModalOpen(false);
    const me = await refreshUser();
    if (me) {
      navigate("/departments/housing");
    }
  };

  const displayName = user?.full_name || user?.display_name || user?.username || "";
  const isAuth = isAuthenticated || isAdmin;

  return (
    <>
      <header className="public-home-header emerald-header">
        <div className="public-home-header-inner">
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              textDecoration: "none",
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

            {/* Элегантный золотой разделитель */}
            <div
              style={{
                width: "1px",
                height: "70px",
                background: "rgba(197, 160, 89, 0.4)",
                margin: "0 4px",
              }}
            />

            {/* Подпись с засечками без синего выделения */}
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
          <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className="hf-lang-toggle gold-pill" role="group" aria-label="Language">
              <button
                type="button"
                className={`hf-lang-btn${lang === "ru" ? " is-active" : ""}`}
                onClick={() => setLang("ru")}
              >
                RU
              </button>
              <span className="lang-sep">|</span>
              <button
                type="button"
                className={`hf-lang-btn${lang === "kk" ? " is-active" : ""}`}
                onClick={() => setLang("kk")}
              >
                KZ
              </button>
            </div>

            <Link to="/departments/housing" className="public-dzhsv-panel-btn">
              Панель ДЖСВ
            </Link>

            {/* Авторизован: имя + выход */}
            {isAuth ? (
              <>
                {displayName ? (
                  <span style={{ color: "#E2C78A", fontSize: "13px", fontWeight: "500" }}>
                    {displayName}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "transparent",
                    border: "1px solid rgba(197,160,89,0.5)",
                    color: "#C5A059",
                    fontSize: "14px",
                    fontWeight: "500",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <LogIn size={15} /> Выйти
                </button>
              </>
            ) : (
              /* Гость (не авторизован): Только кнопка "Войти" */
              <button
                type="button"
                onClick={() => setAdminModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)",
                  border: "none",
                  color: "#032b1e",
                  fontSize: "14px",
                  fontWeight: "bold",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(197,160,89,0.3)",
                  transition: "all 0.2s",
                }}
              >
                <LogIn size={15} /> Войти
              </button>
            )}
          </nav>
        </div>
      </header>
      <AdminLoginModal open={adminModalOpen} onClose={handleAdminModalClose} />
    </>
  );
}

function HousingRulesSection() {
  return (
    <section className="public-section housing-rules-section">
      <div className="housing-rules-grid">
        {HOUSING_RULES.map((rule) => {
          const Icon = rule.icon;
          return (
            <article key={rule.id} className="housing-rule-card group">
              <div className="housing-rule-card-head">
                <div className="housing-rule-card-icon">
                  <Icon size={22} />
                </div>
                <div className="housing-rule-card-titles">
                  <h3>{rule.title}</h3>
                  <span className="housing-rule-badge">{rule.badge}</span>
                </div>
              </div>
              <div className="housing-rule-card-body">{rule.content}</div>
              <div className="housing-rule-arrow"><ChevronRight size={18} /></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PublicAnalyticsReport({ complexes = [] }) {
  // Статические эталонные данные из Excel отчета
  const metrics = {
    totalComplexes: 15,
    totalApartments: 254,
    sold: 112,
    forSale: 192,
    notForSale: 61,
    rent: 135,
    guest: 7,
    remaining: 142
  };

  const yearlyChartData = [
    { year: "2019", realized: 11 },
    { year: "2020", realized: 7 },
    { year: "2021", realized: 35 },
    { year: "2022", realized: 25 },
    { year: "2023", realized: 11 },
    { year: "2024", realized: 7 },
    { year: "2025", realized: 11 },
    { year: "2026", realized: 5 }
  ];

  const pieData = [
    { name: "Реализовано", value: 112, color: "#C5A059" },
    { name: "В аренде", value: 135, color: "#10b981" },
    { name: "Гостевые", value: 7, color: "#3b82f6" }
  ];



  const cardStyle = {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    transition: "all 0.3s ease"
  };

  const kpiValueStyle = {
    fontSize: "26px",
    fontWeight: "bold",
    color: "#f8fafc",
    marginTop: "4px"
  };

  const kpiLabelStyle = {
    fontSize: "12px",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: "500"
  };

  const iconWrapperStyle = {
    background: "rgba(197, 160, 89, 0.1)",
    border: "1px solid rgba(197, 160, 89, 0.25)",
    borderRadius: "8px",
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#c5a059"
  };

  return (
    <div style={{ background: "#0f172a", padding: "24px", borderRadius: "16px", border: "1px solid #334155" }}>
      {/* Inject Hover Styles for Slate KPI Cards */}
      <style>{`
        .kpi-slate-card:hover {
          border-color: rgba(197, 160, 89, 0.5) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
        }
      `}</style>

      {/* Метрики KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="kpi-slate-card" style={cardStyle}>
          <div style={iconWrapperStyle}><Building2 size={24} /></div>
          <div>
            <div style={kpiLabelStyle}>Всего ЖК</div>
            <div style={kpiValueStyle}>{metrics.totalComplexes}</div>
          </div>
        </div>
        <div className="kpi-slate-card" style={cardStyle}>
          <div style={iconWrapperStyle}><Home size={24} /></div>
          <div>
            <div style={kpiLabelStyle}>Всего квартир</div>
            <div style={kpiValueStyle}>{metrics.totalApartments}</div>
          </div>
        </div>
        <div className="kpi-slate-card" style={cardStyle}>
          <div style={{ ...iconWrapperStyle, color: "#10b981", background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" }}><CheckCircle2 size={24} /></div>
          <div>
            <div style={kpiLabelStyle}>Реализовано</div>
            <div style={{ ...kpiValueStyle, color: "#10b981" }}>{metrics.sold}</div>
          </div>
        </div>
        <div className="kpi-slate-card" style={cardStyle}>
          <div style={iconWrapperStyle}><TrendingUp size={24} /></div>
          <div>
            <div style={kpiLabelStyle}>К реализации</div>
            <div style={{ ...kpiValueStyle, color: "#c5a059" }}>{metrics.forSale}</div>
          </div>
        </div>
        <div className="kpi-slate-card" style={cardStyle}>
          <div style={{ ...iconWrapperStyle, color: "#3b82f6", background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.2)" }}><Users size={24} /></div>
          <div>
            <div style={kpiLabelStyle}>В аренде</div>
            <div style={{ ...kpiValueStyle, color: "#3b82f6" }}>{metrics.rent}</div>
          </div>
        </div>
      </div>

      {/* Графики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginBottom: "24px" }}>
        {/* График Динамики */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#c5a059", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontFamily: "Georgia, serif" }}>
            <TrendingUp size={18} /> Динамика реализации по годам
          </h3>
          <div style={{ height: "240px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearlyChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c5a059" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c5a059" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="realized"
                  name="Реализовано"
                  stroke="#c5a059"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#goldGradient)"
                  dot={{ r: 4, fill: "#c5a059", strokeWidth: 1.5, stroke: "#1e293b" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Структура квартирного фонда */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#c5a059", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontFamily: "Georgia, serif" }}>
            <CheckCircle2 size={18} /> Структура квартирного фонда
          </h3>
          <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value, entry) => (
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>{value}: <b style={{ color: "#fff" }}>{entry.payload.value}</b></span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>    </div>
  );
}function PublicHomeFooter() {
  const staff = DEPARTMENT_STAFF.filter((p) => p.name);
  const emails = [...new Set(DEPARTMENT_STAFF.flatMap((p) => p.emails))];

  return (
    <footer className="public-home-footer">
      <div className="dept-contacts-card">
        <h3 className="contacts-card-title">Департамент по жилищно-социальным вопросам</h3>
        <p className="contacts-card-subtitle">Контакты сотрудников для справок и вопросов</p>

        <div className="contacts-grid">
          {staff.map((person) => (
            <div key={person.name} className="contact-person-card">
              <div className="contact-avatar">
                {person.initials || "?"}
              </div>
              <div className="contact-info">
                <span className="contact-name">{person.name}</span>
                <span className="contact-position">{person.position}</span>
                <div className="contact-details">
                  {person.office && (
                    <span className="contact-detail-item">
                      <MapPin size={14} className="contact-icon" />
                      Кабинет {person.office}
                    </span>
                  )}
                  {person.phone && (
                    <span className="contact-detail-item">
                      <Phone size={14} className="contact-icon" />
                      тел: {person.phone} {person.ext ? `(доб. ${person.ext})` : ""}
                    </span>
                  )}
                  {person.ext && !person.phone && (
                    <span className="contact-detail-item">
                      <Phone size={14} className="contact-icon" />
                      доб. {person.ext}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {emails.length > 0 && (
          <div className="contacts-emails-row">
            <span className="emails-label">
              <Mail size={16} className="contact-icon" />
              Электронная почта для обращений:
            </span>
            <div className="emails-list">
              {emails.map((email) => (
                <a key={email} href={`mailto:${email}`} className="contact-email-link">
                  {email}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="public-footer-copy muted">© Астана Opera — Жильё для сотрудников</p>
    </footer>
  );
}

/** Публичная главная страница (все блоки сверху вниз). */
export function UserDashboardView({ complexes = [], loading = false, error = "", onRefresh }) {
  const { isAdmin } = useAuth();
  const [uploadingId, setUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapDistrict, setMapDistrict] = useState("Все");

  const mapRef = useRef(null);
  const markersRef = useRef({});

  // Центры районов Астаны для flyTo
  const DISTRICT_CENTERS = {
    "Все": { center: [51.145, 71.43], zoom: 12 },
    "Алматинский район": { center: [51.160, 71.465], zoom: 13 },
    "Байконурский район": { center: [51.165, 71.425], zoom: 13 },
    "Есильский район": { center: [51.128, 71.430], zoom: 13 },
    "Нуринский район": { center: [51.120, 71.370], zoom: 13 },
    "Сарыаркинский район": { center: [51.175, 71.400], zoom: 13 },
    "Сарайшыкский район": { center: [51.135, 71.485], zoom: 13 },
  };

  const DISTRICT_TABS = ["Все", "Алматинский район", "Байконурский район", "Есильский район", "Нуринский район", "Сарыаркинский район", "Сарайшыкский район"];

  // Фото текущей сессии; legacy localStorage очищается при старте
  const [localPhotos, setLocalPhotos] = useState(() => {
    purgeAllLegacyComplexPhotos();
    return {};
  });

  const [editingComplexData, setEditingComplexData] = useState(null);

  // Локальные данные карточек из localStorage (v3 — добавлено поле district)
  const [localOverrides, setLocalOverrides] = useState(() => {
    const initial = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("complex_data_v3_")) {
          const id = k.replace("complex_data_v3_", "");
          initial[id] = JSON.parse(localStorage.getItem(k));
        }
      }
    } catch (e) {
      console.warn("localStorage init error:", e);
    }
    return initial;
  });

  const savePhotoLocally = (id, name, base64) => {
    try {
      if (id) localStorage.setItem(`complex_photo_${id}`, base64);
      if (name) localStorage.setItem(`complex_photo_${name}`, base64);
    } catch (e) {
      console.warn("localStorage photo save error:", e);
    }
  };

  const removePhotoLocally = (id, name) => {
    try {
      if (id) localStorage.removeItem(`complex_photo_${id}`);
      if (name) localStorage.removeItem(`complex_photo_${name}`);
    } catch (e) {
      console.warn("localStorage photo remove error:", e);
    }
  };

  const handleSaveComplexData = (id, data) => {
    // Сохраняем фото (Base64) отдельно в complex_photo_ по ID и по имени ЖК
    if (data.image) {
      savePhotoLocally(id, data.name, data.image);
      setLocalPhotos((prev) => ({
        ...prev,
        [id]: data.image,
        ...(data.name ? { [data.name]: data.image } : {})
      }));
    } else {
      // Если image пустой — удаляем фото
      removePhotoLocally(id, data.name);
      setLocalPhotos((prev) => {
        const next = { ...prev };
        delete next[id];
        if (data.name) delete next[data.name];
        return next;
      });
    }

    // Сохраняем остальные данные (без image, чтобы не раздувать localStorage)
    const { image, ...rest } = data;
    try {
      localStorage.setItem(`complex_data_v3_${id}`, JSON.stringify(rest));
    } catch (err) {
      console.warn("localStorage save error:", err);
    }
    setLocalOverrides((prev) => ({
      ...prev,
      [id]: rest,
    }));
    setEditingComplexData(null);
  };

  const cards = useMemo(() => {
    return [...complexes]
      .filter((c) => (c.residential_complex_name || "").trim())
      .sort((a, b) =>
        (a.residential_complex_name || "").localeCompare(b.residential_complex_name || "", "ru")
      )
      .map((c) => {
        const key = c.id != null ? `id-${c.id}` : c.residential_complex_name;
        const id = c.id || c.residential_complex_name;
        const override = localOverrides[id] || {};
        // Приоритет: localStorage override > данные из Excel > backend данные
        const excel = getExcelDefaults(c.residential_complex_name || "");

        const get = (field, backendVal) => {
          if (override[field] !== undefined) return override[field];
          if (excel && excel[field] !== undefined) return excel[field];
          return backendVal;
        };

        return {
          key,
          id,
          name: get("name", c.residential_complex_name),
          district: get("district", ""),
          address: get("address", c.address || ""),
          total: get("total", safeNum(c.total_count)),
          notForSale: get("notForSale", safeNum(c.not_for_sale_count)),
          forSale: get("forSale", safeNum(c.for_sale_count)),
          sold: get("sold", safeNum(c.sold_total)),
          remaining: get("remaining", safeNum(c.remaining_total)),
          rent: get("rent", safeNum(c.rent_count || c.family_rent_count)),
          guest: get("guest", safeNum(c.hotel_count)),
          rent_as_flat: get("rent_as_flat", c.rent_as_flat != null ? safeNum(c.rent_as_flat) : safeNum(c.rent_count || c.family_rent_count)),
          rent_as_dorm: get("rent_as_dorm", safeNum(c.rent_as_dorm)),
          dorm_flats_info: get("dorm_flats_info", c.dorm_flats_info || ""),
          imagePath: c.image_path,
        };
      });
  }, [complexes, localOverrides]);

  const handlePhotoUpload = (cardId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetCard = cards.find((c) => c.id === cardId || c.key === cardId);
    const cardName = targetCard ? targetCard.name : "";

    setUploadingId(cardId);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target.result;
      if (base64Image) {
        savePhotoLocally(cardId, cardName, base64Image);
        setLocalPhotos((prev) => ({
          ...prev,
          [cardId]: base64Image,
          ...(cardName ? { [cardName]: base64Image } : {})
        }));
      }

      if (typeof cardId === "number" || (!isNaN(Number(cardId)) && Number(cardId) > 0)) {
        try {
          await uploadComplexPhoto(Number(cardId), file);
          if (onRefresh) onRefresh(false);
        } catch (err) {
          console.warn("Backend upload warning:", err);
        }
      }
      setUploadingId(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoDelete = async (cardId) => {
    if (!window.confirm("Удалить фото этого ЖК?")) return;
    const targetCard = cards.find((c) => c.id === cardId || c.key === cardId);
    const cardName = targetCard ? targetCard.name : "";

    setDeletingId(cardId);
    removePhotoLocally(cardId, cardName);
    setLocalPhotos((prev) => {
      const next = { ...prev };
      delete next[cardId];
      if (cardName) delete next[cardName];
      return next;
    });

    if (typeof cardId === "number" || (!isNaN(Number(cardId)) && Number(cardId) > 0)) {
      try {
        await deleteComplexPhoto(Number(cardId));
        if (onRefresh) onRefresh(false);
      } catch (err) {
        console.warn("Backend delete warning:", err);
      }
    }
    setDeletingId(null);
  };

  // Load Yandex Maps dynamically
  useEffect(() => {
    if (window.ymaps) {
      setMapLoaded(true);
      return;
    }

    const jsScript = document.createElement("script");
    jsScript.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
    jsScript.onload = () => {
      window.ymaps.ready(() => {
        setMapLoaded(true);
      });
    };
    document.head.appendChild(jsScript);
  }, []);

  // Координаты ЖК (вынесено для переиспользования)
  const COMPLEX_COORDINATES = {
    "акку": [51.1554, 71.4722],
    "аққу": [51.1554, 71.4722],
    "браво": [51.1189, 71.4552],
    "виктория": [51.1412, 71.4688],
    "жагалау": [51.1215, 71.4012],
    "зерде": [51.148, 71.491],
    "лазурный": [51.1275, 71.4361],
    "москва": [51.1620, 71.4380],
    "нур-сая": [51.1281, 71.4305],
    "общежитие": [51.1834, 71.4285],
    "азирбаев": [51.159, 71.472],
    "азірбаев": [51.159, 71.472],
    "сапа": [51.1730, 71.3912],
    "сармат": [51.1232, 71.4288],
    "хан тенгри": [51.1601, 71.4611],
    "хан-тенгри": [51.1601, 71.4611],
    "compass": [51.1130, 71.4610],
    "respublika": [51.0980, 71.4150]
  };

  const getComplexCoords = (name) => {
    const nameLower = (name || "").toLowerCase();
    for (const [key, val] of Object.entries(COMPLEX_COORDINATES)) {
      if (nameLower.includes(key)) return val;
    }
    return [51.1283, 71.4305];
  };

  // 1. Инициализация карты (выполняется один раз)
  useEffect(() => {
    if (!mapLoaded || !window.ymaps || !document.getElementById("map-canvas")) return;

    if (mapRef.current) {
      mapRef.current.destroy();
      mapRef.current = null;
    }

    const map = new window.ymaps.Map("map-canvas", {
      center: [51.145, 71.43],
      zoom: 12,
      controls: ["zoomControl"]
    }, {
      minZoom: 11,
      maxZoom: 18,
      yandexMapDisablePoiBubble: true,
      restrictMapArea: [[51.00, 71.10], [51.30, 71.80]]
    });

    map.behaviors.disable('scrollZoom');
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [mapLoaded]);

  // 2. Обновление маркеров ЖК в зависимости от выбранного района
  useEffect(() => {
    if (!mapRef.current || !window.ymaps) return;
    const map = mapRef.current;

    // Очищаем старые геообъекты на карте перед перерисовкой
    map.geoObjects.removeAll();
    markersRef.current = {};

    cards.forEach((c) => {
      // Фильтрация маркеров ЖК на уровне React-состояния
      if (mapDistrict !== "Все" && c.district !== mapDistrict) return;

      const coords = getComplexCoords(c.name);
      const photoUrl = getComplexPhotoUrl(c, localPhotos);
      const photoHtml = `<img src="${photoUrl}" alt="${c.name}" style="width:100px;height:70px;object-fit:cover;float:left;margin-right:10px;border-radius:6px;border:1px solid rgba(245,158,11,0.35);"/>`;

      const districtBadge = c.district
        ? `<span style="display:inline-block;font-size:10px;color:#475569;background:#f1f5f9;padding:2px 8px;border-radius:6px;margin-top:4px;border:1px solid #e2e8f0;">${c.district}</span>`
        : "";

      const popupContent = `
        <div style="font-family:system-ui,-apple-system,sans-serif;width:280px;color:#1e293b;line-height:1.4;padding:4px 0;">
          ${photoHtml}
          <div style="overflow:hidden;">
            <h4 style="margin:0 0 4px 0;color:#0f172a;font-size:14px;font-weight:700;">${c.name}</h4>
            <p style="margin:0 0 4px 0;font-size:11px;color:#64748b;">📍 ${c.address || 'Адрес не указан'}</p>
            ${districtBadge}
            <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#475569;">
              <div>Всего: <b>${c.total}</b></div>
              <div>Продано: <b>${c.sold}</b></div>
              <div>Аренда: <b>${c.rent}</b></div>
              <div>Остаток: <b>${c.remaining}</b></div>
            </div>
          </div>
        </div>
      `;

      // Кастомный премиальный SVG маркер в стиле "Астана Опера"
      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
        <filter id="sh" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
        </filter>
        <path d="M18 2C9.16 2 2 9.16 2 18c0 12 16 26 16 26s16-14 16-26c0-8.84-7.16-16-16-16z" fill="#0f382c" stroke="#c5a059" stroke-width="2.5" filter="url(#sh)"/>
        <circle cx="18" cy="18" r="8" fill="#c5a059"/>
        <path d="M15 14h6v8h-6zm1-5h4v5h-4zm-4 2h2v11h-2zm10 0h2v11h-2z" fill="#0f382c"/>
      </svg>`;

      const placemark = new window.ymaps.Placemark(coords, {
        balloonContentBody: popupContent,
        hintContent: c.name
      }, {
        iconLayout: 'default#image',
        iconImageHref: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg)}`,
        iconImageSize: [36, 46],
        iconImageOffset: [-18, -46],
        hideIconOnBalloonOpen: false
      });

      map.geoObjects.add(placemark);
      markersRef.current[c.name] = { placemark, district: c.district || "" };
    });

    // Плавное перемещение на центр выбранного района
    const target = DISTRICT_CENTERS[mapDistrict] || DISTRICT_CENTERS["Все"];
    map.setCenter(target.center, target.zoom, { duration: 800, checkZoomRange: true });
  }, [mapLoaded, cards, localPhotos, mapDistrict]);

  const focusComplexOnMap = (name) => {
    const targetCoords = getComplexCoords(name);

    if (targetCoords && mapRef.current) {
      setMapDistrict("Все");
      setTimeout(() => {
        mapRef.current.setCenter(targetCoords, 15, { duration: 800, checkZoomRange: true });
        const entry = markersRef.current[name];
        if (entry && entry.placemark) {
          entry.placemark.balloon.open();
        }
      }, 150);
      document.getElementById("map-canvas")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="public-home">
      <PublicHomeHeader />
      <HeroRulesSection />
      <main className="public-home-main">
        <section className="public-section public-apply-section">
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{
              color: "#C5A059",
              fontSize: "36px",
              fontFamily: "Georgia, serif",
              fontWeight: "bold",
              margin: "0 0 10px 0"
            }}>
              Подача заявления
            </h2>
            <p style={{
              color: "#a0aec0",
              fontSize: "16px",
              margin: 0
            }}>
              Скачайте бланк, заполните, получите подпись директора и отправьте заявление онлайн
            </p>
          </div>
          <HousingApplicationCTA variant="hero" />
        </section>

        {loading && <p className="muted public-loading">Загрузка данных...</p>}
        {error && (
          <p className="muted public-summary-error">
            {error}. Данные могут быть неполными, попробуйте обновить страницу позже.
          </p>
        )}

        {!loading && (
          <>
            <section className="public-section public-gallery-section">
              <div style={{ textAlign: "center", marginBottom: "36px" }}>
                <h2 style={{
                  background: "linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "36px",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontWeight: "bold",
                  margin: "0 0 10px 0",
                  letterSpacing: "0.02em",
                }}>Жилые комплексы</h2>
                <p style={{
                  color: "#a0aec0",
                  fontSize: "16px",
                  margin: 0,
                  fontStyle: "italic",
                }}>
                  {cards.length > 0
                    ? `${cards.length} жилых комплексов в программе обеспечения жильём`
                    : "Обзор доступных жилых комплексов"}
                </p>
              </div>
              <div className="user-role-cards-grid">
                {cards.length === 0 ? (
                  <p className="user-role-empty muted">
                    Сводка временно недоступна. Проверьте подключение или повторите попытку позже.
                  </p>
                ) : (
                  cards.map((card) => {
                    const hasCustomPhoto = hasCustomComplexPhoto(card, localPhotos);
                    const cardId = card.id || card.key;
                    return (
                      <article
                        key={card.key}
                        className="user-jk-card"
                        style={{ cursor: "pointer" }}
                        onClick={() => focusComplexOnMap(card.name)}
                      >
                        <div className="user-jk-card-photo user-jk-photo-hero">
                          <ComplexPhotoImg
                            complex={card}
                            className="user-jk-card-photo-img w-full h-full object-cover rounded-t-2xl"
                            alt={card.name}
                          />
                          <div className="user-jk-photo-gradient" aria-hidden="true" />

                          {isAdmin && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "8px",
                                right: "8px",
                                display: "flex",
                                gap: "6px",
                                justifyContent: hasCustomPhoto ? "space-between" : "center",
                                zIndex: 10,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Upload / Change */}
                              <label
                                htmlFor={`upload-photo-${cardId}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  background: "rgba(5, 53, 38, 0.9)",
                                  backdropFilter: "blur(6px)",
                                  color: "#C5A059",
                                  border: "1px solid rgba(197,160,89,0.5)",
                                  borderRadius: "8px",
                                  padding: "5px 12px",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                  transition: "all 0.2s",
                                }}
                              >
                                <Camera size={13} />
                                {uploadingId === cardId
                                  ? "Загрузка..."
                                  : hasCustomPhoto
                                  ? "Изменить"
                                  : "Добавить фото"}
                                <input
                                  type="file"
                                  id={`upload-photo-${cardId}`}
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload(cardId, e)}
                                  style={{ display: "none" }}
                                  disabled={uploadingId === cardId}
                                />
                              </label>

                              {/* Delete (only if photo exists) */}
                              {hasCustomPhoto && (
                                <button
                                  type="button"
                                  onClick={() => handlePhotoDelete(cardId)}
                                  disabled={deletingId === cardId}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    background: "rgba(120, 30, 30, 0.9)",
                                    backdropFilter: "blur(6px)",
                                    color: "#ff9b9b",
                                    border: "1px solid rgba(255,100,100,0.5)",
                                    borderRadius: "8px",
                                    padding: "5px 12px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    cursor: deletingId === cardId ? "wait" : "pointer",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                    transition: "all 0.2s",
                                    opacity: deletingId === cardId ? 0.6 : 1,
                                  }}
                                >
                                  <Trash2 size={13} />
                                  {deletingId === cardId ? "Удаление..." : "Удалить"}
                                </button>
                              )}
                              
                              {/* Edit Data */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditingComplexData(card); }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "rgba(30, 58, 138, 0.9)",
                                  backdropFilter: "blur(6px)",
                                  color: "#93c5fd",
                                  border: "1px solid rgba(147,197,253,0.5)",
                                  borderRadius: "8px",
                                  padding: "5px",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                  transition: "all 0.2s",
                                }}
                                title="Редактировать данные"
                              >
                                <Pencil size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="user-jk-card-body" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", height: "auto", overflow: "visible" }}>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <h3 style={{
                              fontSize: "22px",
                              fontWeight: "bold",
                              margin: 0,
                              background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              letterSpacing: "-0.02em",
                              lineHeight: "1.2"
                            }}>
                              {card.name}
                            </h3>
                            {(card.address || card.district) && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                                {card.address && (
                                  <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px", fontWeight: "500" }}>
                                    <MapPin size={12} style={{ flexShrink: 0 }} />
                                    <span>{card.address}</span>
                                  </div>
                                )}
                                {card.district && (
                                  <span style={{
                                    display: "inline-block",
                                    marginTop: "4px",
                                    fontSize: "11px",
                                    color: "#475569",
                                    background: "#f1f5f9",
                                    padding: "2px 10px",
                                    borderRadius: "6px",
                                    fontWeight: "500",
                                    width: "fit-content",
                                  }}>{card.district}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {Number(card.total) > 0 && (
                            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px", letterSpacing: "0.05em" }}><Building2 size={12}/> Всего квартир</div>
                                <div style={{ fontSize: "15px", fontWeight: "bold", color: "#0f172a" }}>{card.total}</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "16px", borderLeft: "2px solid #cbd5e1" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
                                  <span>└ Из них не подлежат реализации:</span>
                                  <span style={{ fontWeight: "600" }}>{card.notForSale}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
                                  <span>└ Из них к реализации:</span>
                                  <span style={{ fontWeight: "600" }}>{card.forSale}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Блок 2 и 3: Процесс реализации и Текущее использование остатка */}
                          {(Number(card.sold) > 0 || Number(card.remaining) > 0) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {Number(card.sold) > 0 && (
                                <div style={{ background: "#f0fdf4", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>Реализовано (Продано)</span>
                                  <span style={{ fontSize: "15px", fontWeight: "bold", color: "#14532d" }}>{card.sold}</span>
                                </div>
                              )}
                              
                              {Number(card.remaining) > 0 && (
                                <div style={{ background: "#eff6ff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", gap: "8px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Осталось в фонде театра</span>
                                    <span style={{ fontSize: "15px", fontWeight: "bold", color: "#1e3a8a" }}>{card.remaining}</span>
                                  </div>
                                  
                                  {/* Блок 3: Текущее использование остатка */}
                                  {(Number(card.rent) > 0 || Number(card.guest) > 0) && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "12px", borderLeft: "2px solid #93c5fd", marginTop: "2px" }}>
                                      {Number(card.rent) > 0 && (
                                        <>
                                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#3b82f6" }}>
                                            <span>↳ В аренде (сотрудникам):</span>
                                            <span style={{ fontWeight: "600" }}>{card.rent}</span>
                                          </div>
                                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "12px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#60a5fa" }}>
                                              <span>↳ Как квартира:</span>
                                              <span style={{ fontWeight: "500" }}>{card.rent_as_flat || card.rent}</span>
                                            </div>
                                            {Number(card.rent_as_dorm) > 0 && (
                                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#60a5fa" }}>
                                                <span>↳ Как общежитие: {card.rent_as_dorm} <span style={{ fontSize: "10px", color: "#93c5fd", marginLeft: "4px" }}>({card.dorm_flats_info})</span></span>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}
                                      {Number(card.guest) > 0 && (
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#3b82f6" }}>
                                          <span>↳ Гостевой фонд (гастроли):</span>
                                          <span style={{ fontWeight: "600" }}>{card.guest}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="public-section public-map-section">
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <h2 style={{
                  background: "linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontSize: "36px",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontWeight: "bold",
                  margin: "0 0 10px 0",
                  letterSpacing: "0.02em",
                }}>Наши комплексы на карте</h2>
                <p style={{ color: "#a0aec0", fontSize: "15px", margin: 0, fontStyle: "italic" }}>
                  Выберите район для фильтрации или нажмите на маркер для подробностей
                </p>
              </div>

              {/* Фильтры по районам */}
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "center",
                marginBottom: "16px",
              }}>
                {DISTRICT_TABS.map((d) => {
                  const isActive = mapDistrict === d;
                  const label = d === "Все" ? "Все районы" : d.replace(" район", "");
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setMapDistrict(d)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "20px",
                        border: isActive ? "1px solid #C5A059" : "1px solid rgba(197,160,89,0.25)",
                        background: isActive
                          ? "linear-gradient(135deg, #C5A059 0%, #E2C78A 100%)"
                          : "rgba(197,160,89,0.06)",
                        color: isActive ? "#053526" : "#a0aec0",
                        fontSize: "13px",
                        fontWeight: isActive ? "700" : "500",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        letterSpacing: "0.01em",
                        boxShadow: isActive ? "0 2px 12px rgba(197,160,89,0.3)" : "none",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid rgba(197,160,89,0.25)',
                borderRadius: '16px',
                padding: '4px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div id="map-canvas" style={{ height: "500px", width: "100%", borderRadius: "12px", zIndex: 1 }} />
              </div>
            </section>

            <section className="public-section public-report-section" style={{ padding: "48px 0 24px 0" }}>
              <div style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto 32px auto" }}>
                <h2 style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "36px",
                  fontWeight: "bold",
                  color: "#c5a059",
                  letterSpacing: "0.03em",
                  margin: "0 0 8px 0"
                }}>
                  Анализ данных
                </h2>
                <p style={{
                  color: "#e2e8f0",
                  fontSize: "15px",
                  fontWeight: "normal",
                  letterSpacing: "0.02em",
                  lineHeight: "1.5",
                  margin: 0,
                  opacity: 0.95
                }}>
                  Публичный отчёт жилищного департамента — сводная статистика без персональных данных
                </p>
                <div style={{
                  width: "80px",
                  height: "3px",
                  backgroundColor: "#c5a059",
                  margin: "16px auto 0 auto",
                  borderRadius: "9999px"
                }} />
              </div>
              <PublicAnalyticsReport complexes={complexes} />
            </section>
          </>
        )}
      </main>

      <PublicHomeFooter />
      
      <EditComplexModal 
        isOpen={!!editingComplexData}
        complexData={editingComplexData}
        onClose={() => setEditingComplexData(null)}
        onSave={handleSaveComplexData}
      />
    </div>
  );
}

/** Карточки ЖК для жилищного департамента (данные из rows — только чтение). */
export function UserHousingView({ rows = [] }) {
  const { isAdmin } = useAuth();
  const [complexes, setComplexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplex, setSelectedComplex] = useState(null);

  // States for uploading/deleting photo inside this component
  const [uploadingId, setUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingComplexData, setEditingComplexData] = useState(null);

  // Load local photos & overrides
  const [localPhotos, setLocalPhotos] = useState(() => {
    purgeAllLegacyComplexPhotos();
    return {};
  });

  const [localOverrides, setLocalOverrides] = useState(() => {
    const initial = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("complex_data_v3_")) {
          const id = k.replace("complex_data_v3_", "");
          initial[id] = JSON.parse(localStorage.getItem(k));
        }
      }
    } catch (e) {
      console.warn("localStorage init error:", e);
    }
    return initial;
  });

  const loadData = () => {
    setLoading(true);
    getPublicManualDashboardSummary()
      .then((data) => setComplexes(data.rows || []))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save complex photo/data helper functions
  const savePhotoLocally = (id, name, base64) => {
    try {
      if (id) localStorage.setItem(`complex_photo_${id}`, base64);
      if (name) localStorage.setItem(`complex_photo_${name}`, base64);
    } catch (e) {
      console.warn("localStorage photo save error:", e);
    }
  };

  const removePhotoLocally = (id, name) => {
    try {
      if (id) localStorage.removeItem(`complex_photo_${id}`);
      if (name) localStorage.removeItem(`complex_photo_${name}`);
    } catch (e) {
      console.warn("localStorage photo remove error:", e);
    }
  };

  const handleSaveComplexData = (id, data) => {
    if (data.image) {
      savePhotoLocally(id, data.name, data.image);
      setLocalPhotos((prev) => ({
        ...prev,
        [id]: data.image,
        ...(data.name ? { [data.name]: data.image } : {})
      }));
    } else {
      removePhotoLocally(id, data.name);
      setLocalPhotos((prev) => {
        const next = { ...prev };
        delete next[id];
        if (data.name) delete next[data.name];
        return next;
      });
    }

    const { image, ...rest } = data;
    try {
      localStorage.setItem(`complex_data_v3_${id}`, JSON.stringify(rest));
    } catch (err) {
      console.warn("localStorage save error:", err);
    }
    setLocalOverrides((prev) => ({
      ...prev,
      [id]: rest,
    }));
    setEditingComplexData(null);
  };

  const handlePhotoUpload = (cardId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetCard = cards.find((c) => c.id === cardId || c.key === cardId);
    const cardName = targetCard ? targetCard.name : "";

    setUploadingId(cardId);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Image = event.target.result;
      if (base64Image) {
        savePhotoLocally(cardId, cardName, base64Image);
        setLocalPhotos((prev) => ({
          ...prev,
          [cardId]: base64Image,
          ...(cardName ? { [cardName]: base64Image } : {})
        }));
      }
      setUploadingId(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoDelete = (cardId) => {
    if (!window.confirm("Удалить фото этого ЖК?")) return;
    const targetCard = cards.find((c) => c.id === cardId || c.key === cardId);
    const cardName = targetCard ? targetCard.name : "";

    removePhotoLocally(cardId, cardName);
    setLocalPhotos((prev) => {
      const next = { ...prev };
      delete next[cardId];
      if (cardName) delete next[cardName];
      return next;
    });
  };

  // Helper for safe numbers
  const safeNum = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  const cards = useMemo(() => {
    return [...complexes]
      .filter((c) => (c.residential_complex_name || "").trim())
      .sort((a, b) =>
        (a.residential_complex_name || "").localeCompare(b.residential_complex_name || "", "ru")
      )
      .map((c) => {
        const key = c.id != null ? `id-${c.id}` : c.residential_complex_name;
        const id = c.id || c.residential_complex_name;
        const override = localOverrides[id] || {};
        const excel = getExcelDefaults(c.residential_complex_name || "");

        const get = (field, backendVal) => {
          if (override[field] !== undefined) return override[field];
          if (excel && excel[field] !== undefined) return excel[field];
          return backendVal;
        };

        return {
          key,
          id,
          name: get("name", c.residential_complex_name),
          district: get("district", ""),
          address: get("address", c.address || ""),
          total: get("total", safeNum(c.total_count)),
          notForSale: get("notForSale", safeNum(c.not_for_sale_count)),
          forSale: get("forSale", safeNum(c.for_sale_count)),
          sold: get("sold", safeNum(c.sold_total ?? c.sold_count)),
          remaining: get("remaining", safeNum(c.remaining_total ?? c.free_count)),
          rent: get("rent", safeNum(c.rent_count || c.family_rent_count)),
          guest: get("guest", safeNum(c.hotel_count ?? c.guest_count)),
          rent_as_flat: get("rent_as_flat", c.rent_as_flat != null ? safeNum(c.rent_as_flat) : safeNum(c.rent_count || c.family_rent_count)),
          rent_as_dorm: get("rent_as_dorm", safeNum(c.rent_as_dorm)),
          dorm_flats_info: get("dorm_flats_info", c.dorm_flats_info || ""),
          imagePath: c.image_path,
        };
      });
  }, [complexes, localOverrides]);

  const normalizeComplexNameLocal = (name = "") => normalizeComplexName(name);

  const filteredApartments = useMemo(() => {
    if (!selectedComplex) return [];
    const normSelected = normalizeComplexNameLocal(selectedComplex.name);
    return rows.filter((r) => {
      const complexNorm = normalizeComplexNameLocal(r.residential_complex_name);
      return complexNorm === normSelected;
    });
  }, [rows, selectedComplex]);

  const parseAptAndFloor = (addressStr = "") => {
    let apt = "—";
    let floor = "—";
    
    // Match кв. / кв / квартира
    const aptMatch = addressStr.match(/(?:кв\.|квартира|кв)\s*(\d+)/i);
    if (aptMatch) apt = aptMatch[1];
    
    // Match эт. / этаж
    const floorMatch = addressStr.match(/(?:эт\.|этаж)\s*(\d+)/i);
    if (floorMatch) floor = floorMatch[1];
    
    return { apt, floor };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <span style={{ color: "#c5a059", fontSize: "16px", fontWeight: "600" }}>Загрузка жилого фонда...</span>
      </div>
    );
  }

  // Детализация квартир выбранного ЖК
  if (selectedComplex) {
    return (
      <section className="user-role-section" style={{ minHeight: "60vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            type="button"
            onClick={() => setSelectedComplex(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(197,160,89,0.1)",
              border: "1px solid rgba(197,160,89,0.3)",
              color: "#C5A059",
              padding: "8px 16px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s"
            }}
          >
            ← Назад к списку ЖК
          </button>
          <h2 style={{
            margin: 0,
            fontSize: "24px",
            color: "#FAF9F6",
            fontFamily: "Georgia, serif"
          }}>
            {selectedComplex.name} — Реестр квартир
          </h2>
        </div>

        <div style={{ background: "#0d2e22", border: "1px solid rgba(197,160,89,0.25)", borderRadius: "12px", padding: "20px", overflow: "hidden" }}>
          {filteredApartments.length === 0 ? (
            <p style={{ color: "#a0aec0", margin: "20px 0", textAlign: "center", fontStyle: "italic" }}>
              Записи о заселенных или проданных квартирах в этом ЖК отсутствуют в реестре ДЖСВ.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px", color: "#FAF9F6" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.3)" }}>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>№ Квартиры</th>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>Этаж</th>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>Комнат</th>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>Площадь</th>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>Статус по приказу</th>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>ФИО жильца</th>
                    <th style={{ padding: "12px 10px", color: "#C5A059", fontWeight: "600" }}>Полный адрес</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApartments.map((apt, idx) => {
                    const parsed = parseAptAndFloor(apt.address);
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid rgba(197,160,89,0.1)",
                          backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(197,160,89,0.02)",
                          transition: "background 0.2s"
                        }}
                      >
                        <td style={{ padding: "12px 10px", fontWeight: "bold", color: "#C5A059" }}>{parsed.apt}</td>
                        <td style={{ padding: "12px 10px" }}>{parsed.floor}</td>
                        <td style={{ padding: "12px 10px", fontWeight: "600" }}>{apt.room_count || "—"}</td>
                        <td style={{ padding: "12px 10px" }}>{apt.total_area ? `${apt.total_area} м²` : "—"}</td>
                        <td style={{ padding: "12px 10px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "500",
                            background: (apt.status || "").toLowerCase().includes("аренд") ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                            color: (apt.status || "").toLowerCase().includes("аренд") ? "#93c5fd" : "#34d399",
                            border: (apt.status || "").toLowerCase().includes("аренд") ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(16,185,129,0.3)"
                          }}>
                            {apt.status || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 10px", fontWeight: "500" }}>{apt.fio || "—"}</td>
                        <td style={{ padding: "12px 10px", color: "#a0aec0", fontSize: "12px" }}>{apt.address || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Список жилых комплексов (Карточки)
  return (
    <section className="user-role-section">
      <div className="user-role-hero">
        <h2>ДЖСВ</h2>
        <p className="muted">Обзор жилых комплексов и подача заявления</p>
      </div>
      <HousingApplicationCTA />
      
      <div style={{ textAlign: "center", marginBottom: "24px", marginTop: "32px" }}>
        <h2 style={{
          background: "linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontSize: "36px",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: "bold",
          margin: "0 0 10px 0",
          letterSpacing: "0.02em",
        }}>Жилые комплексы</h2>
        <p style={{
          color: "#a0aec0",
          fontSize: "16px",
          margin: 0,
          fontStyle: "italic",
        }}>
          {cards.length > 0
            ? `${cards.length} жилых комплексов в программе обеспечения жильём`
            : "Обзор доступных жилых комплексов"}
        </p>
      </div>

      <div className="user-role-cards-grid">
        {cards.length === 0 ? (
          <p className="user-role-empty muted">Нет данных по ЖК</p>
        ) : (
          cards.map((card) => {
            const hasCustomPhoto = hasCustomComplexPhoto(card, localPhotos);
            const cardId = card.id || card.key;
            return (
              <article
                key={card.key}
                className="user-jk-card"
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedComplex(card)}
              >
                <div className="user-jk-card-photo user-jk-photo-hero">
                  <ComplexPhotoImg
                    complex={card}
                    className="user-jk-card-photo-img w-full h-full object-cover rounded-t-2xl"
                    alt={card.name}
                  />
                  <div className="user-jk-photo-gradient" aria-hidden="true" />

                  {isAdmin && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        right: "8px",
                        display: "flex",
                        gap: "6px",
                        justifyContent: hasCustomPhoto ? "space-between" : "center",
                        zIndex: 10,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label
                        htmlFor={`upload-photo-housing-${cardId}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "rgba(5, 53, 38, 0.9)",
                          backdropFilter: "blur(6px)",
                          color: "#C5A059",
                          border: "1px solid rgba(197,160,89,0.5)",
                          borderRadius: "8px",
                          padding: "5px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          transition: "all 0.2s",
                        }}
                      >
                        <Camera size={13} />
                        {uploadingId === cardId
                          ? "Загрузка..."
                          : hasCustomPhoto
                          ? "Изменить"
                          : "Добавить фото"}
                        <input
                          type="file"
                          id={`upload-photo-housing-${cardId}`}
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(cardId, e)}
                          style={{ display: "none" }}
                          disabled={uploadingId === cardId}
                        />
                      </label>

                      {hasCustomPhoto && (
                        <button
                          type="button"
                          onClick={() => handlePhotoDelete(cardId)}
                          disabled={deletingId === cardId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "rgba(120, 30, 30, 0.9)",
                            backdropFilter: "blur(6px)",
                            color: "#ff9b9b",
                            border: "1px solid rgba(255,100,100,0.5)",
                            borderRadius: "8px",
                            padding: "5px 12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: deletingId === cardId ? "wait" : "pointer",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                            transition: "all 0.2s",
                            opacity: deletingId === cardId ? 0.6 : 1,
                          }}
                        >
                          <Trash2 size={13} />
                          {deletingId === cardId ? "Удаление..." : "Удалить"}
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingComplexData(card); }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(30, 58, 138, 0.9)",
                          backdropFilter: "blur(6px)",
                          color: "#93c5fd",
                          border: "1px solid rgba(147,197,253,0.5)",
                          borderRadius: "8px",
                          padding: "5px",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          transition: "all 0.2s",
                        }}
                        title="Редактировать данные"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="user-jk-card-body" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", height: "auto", overflow: "visible" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h3 style={{
                      fontSize: "22px",
                      fontWeight: "bold",
                      margin: 0,
                      background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-0.02em",
                      lineHeight: "1.2"
                    }}>
                      {card.name}
                    </h3>
                    {(card.address || card.district) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                        {card.address && (
                          <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px", fontWeight: "500" }}>
                            <MapPin size={12} style={{ flexShrink: 0 }} />
                            <span>{card.address}</span>
                          </div>
                        )}
                        {card.district && (
                          <span style={{
                            display: "inline-block",
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "#475569",
                            background: "#f1f5f9",
                            padding: "2px 10px",
                            borderRadius: "6px",
                            fontWeight: "500",
                            width: "fit-content",
                          }}>{card.district}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {Number(card.total) > 0 && (
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px", letterSpacing: "0.05em" }}><Building2 size={12}/> Всего квартир</div>
                        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#0f172a" }}>{card.total}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "16px", borderLeft: "2px solid #cbd5e1" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
                          <span>└ Из них не подлежат реализации:</span>
                          <span style={{ fontWeight: "600" }}>{card.notForSale}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
                          <span>└ Из них к реализации:</span>
                          <span style={{ fontWeight: "600" }}>{card.forSale}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {(Number(card.sold) > 0 || Number(card.remaining) > 0) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {Number(card.sold) > 0 && (
                        <div style={{ background: "#f0fdf4", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: "600", color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>Реализовано (Продано)</span>
                          <span style={{ fontSize: "15px", fontWeight: "bold", color: "#14532d" }}>{card.sold}</span>
                        </div>
                      )}

                      {Number(card.remaining) > 0 && (
                        <div style={{ background: "#eff6ff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Осталось в фонде театра</span>
                            <span style={{ fontSize: "15px", fontWeight: "bold", color: "#1e3a8a" }}>{card.remaining}</span>
                          </div>

                          {(Number(card.rent) > 0 || Number(card.guest) > 0) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "12px", borderLeft: "2px solid #93c5fd", marginTop: "2px" }}>
                              {Number(card.rent) > 0 && (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#3b82f6" }}>
                                    <span>↳ В аренде (сотрудникам):</span>
                                    <span style={{ fontWeight: "600" }}>{card.rent}</span>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "12px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#60a5fa" }}>
                                      <span>↳ Как квартира:</span>
                                      <span style={{ fontWeight: "500" }}>{card.rent_as_flat || card.rent}</span>
                                    </div>
                                    {Number(card.rent_as_dorm) > 0 && (
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#60a5fa" }}>
                                        <span>↳ Как общежитие: {card.rent_as_dorm} <span style={{ fontSize: "10px", color: "#93c5fd", marginLeft: "4px" }}>({card.dorm_flats_info})</span></span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                              {Number(card.guest) > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#3b82f6" }}>
                                  <span>↳ Гостевой фонд (гастроли):</span>
                                  <span style={{ fontWeight: "600" }}>{card.guest}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      <EditComplexModal 
        isOpen={!!editingComplexData}
        complexData={editingComplexData}
        onClose={() => setEditingComplexData(null)}
        onSave={handleSaveComplexData}
      />
    </section>
  );
}
