import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Database,
  FolderOpen,
  Home,
  LayoutDashboard,
  Settings,
  Wallet,
} from "lucide-react";
import ComplexPhotoImg from "../ComplexPhotoImg";
import { loadHousingDataSafe } from "../../data/housingStore";
import { getExcelControlTotals } from "../../api/housingFund";
import { CANONICAL_COMPLEX_SEEDS } from "../../utils/complexMockFallback";
import {
  computeComplexDashboard,
  computeGlobalDashboard,
  formatMoneyKzt,
} from "../../utils/computeHousingAnalytics";
import { normalizeComplexName } from "../../utils/complexName";
import "./analytics-dashboard.css";

const COLORS = {
  rent: "#3B82F6",
  sold: "#14B8A6",
  dorm: "#8B5CF6",
};

const COMPLEX_TABS = [
  { id: "overview", label: "Обзор" },
  { id: "payments", label: "Платежи" },
  { id: "contracts", label: "Договоры" },
  { id: "housing", label: "Жилье" },
  { id: "reports", label: "Отчеты" },
];

const PERIOD_OPTIONS = [
  { id: "6m", label: "01.04.2025 — 30.04.2026", months: 6 },
  { id: "3m", label: "За 3 месяца", months: 3 },
  { id: "12m", label: "За 12 месяцев", months: 12 },
];

const SECTION_NAV = [
  { id: "payments", label: "Платежи", icon: Wallet, tab: "payments" },
  { id: "contracts", label: "Договоры", icon: ClipboardList, tab: "contracts" },
  { id: "housing", label: "Жилье", icon: Home, tab: "fund" },
  { id: "reports", label: "Отчеты", icon: FolderOpen, tab: "reports" },
  { id: "dirs", label: "Справочники", icon: Building2, tab: "dirs" },
  { id: "settings", label: "Настройки", icon: Settings, tab: "settings" },
];

function formatMillionsShort(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("ru-RU", {
      maximumFractionDigits: 1,
    })}M ₸`;
  }
  return formatMoneyKzt(n);
}

export default function AnalyticsDashboard({ onNavigate, activeNavId = "home" }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("6m");
  const [innerTab, setInnerTab] = useState("overview");
  /** null = общая аналитика (Главная); иначе имя выбранного ЖК */
  const [selectedComplexName, setSelectedComplexName] = useState(null);
  const [apartments, setApartments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [complexes, setComplexes] = useState([]);
  const [excelControls, setExcelControls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const isGlobal = !selectedComplexName;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [data, controls] = await Promise.all([
      loadHousingDataSafe(),
      getExcelControlTotals().catch(() => null),
    ]);
    setApartments(data.apartments || []);
    setContracts(data.contracts || []);
    setPayments(data.payments || []);
    setComplexes(data.complexes?.length ? data.complexes : CANONICAL_COMPLEX_SEEDS);
    setExcelControls(controls);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, reloadTick]);

  useEffect(() => {
    const onChanged = () => setReloadTick((n) => n + 1);
    window.addEventListener("hf:data-changed", onChanged);
    return () => window.removeEventListener("hf:data-changed", onChanged);
  }, []);

  const complexList = useMemo(() => {
    if (complexes?.length) return complexes;
    return CANONICAL_COMPLEX_SEEDS.map((s) => ({
      ...s,
      total_count: null,
    }));
  }, [complexes]);

  const selectedMeta = useMemo(() => {
    if (!selectedComplexName) return null;
    const needle = normalizeComplexName(selectedComplexName);
    return (
      complexList.find((c) => normalizeComplexName(c.name) === needle) ||
      CANONICAL_COMPLEX_SEEDS.find((c) => normalizeComplexName(c.name) === needle) ||
      { name: selectedComplexName }
    );
  }, [complexList, selectedComplexName]);

  const months = PERIOD_OPTIONS.find((p) => p.id === period)?.months || 6;
  const periodLabel = PERIOD_OPTIONS.find((p) => p.id === period)?.label || "";

  const stats = useMemo(() => {
    if (isGlobal) {
      return computeGlobalDashboard(
        apartments,
        contracts,
        payments,
        complexList,
        excelControls,
        { months }
      );
    }
    return computeComplexDashboard(apartments, contracts, payments, selectedMeta, {
      months,
      complexName: selectedMeta?.name || selectedComplexName,
    });
  }, [
    isGlobal,
    apartments,
    contracts,
    payments,
    complexList,
    excelControls,
    selectedMeta,
    selectedComplexName,
    months,
  ]);

  const yMax = useMemo(() => {
    const peaks = (stats.barSeries || []).map((p) => Number(p.total || 0));
    const max = Math.max(1, ...peaks);
    return Math.ceil(max * 1.15);
  }, [stats.barSeries]);

  const handleSectionNav = (item) => {
    if (item.tab === "dirs") {
      navigate("/departments");
      return;
    }
    if (item.tab === "settings") {
      navigate("/dashboard/manual-summary");
      return;
    }
    if (typeof onNavigate === "function") onNavigate(item.tab);
  };

  const selectHome = () => {
    setSelectedComplexName(null);
    setInnerTab("overview");
  };

  const selectComplex = (name) => {
    setSelectedComplexName(name);
    setInnerTab("overview");
  };

  const handleInnerTab = (tabId) => {
    if (tabId === "overview") {
      setInnerTab(tabId);
      return;
    }
    const map = {
      payments: "payments",
      contracts: "contracts",
      housing: "fund",
      reports: "reports",
    };
    if (map[tabId] && typeof onNavigate === "function") {
      onNavigate(map[tabId]);
      return;
    }
    setInnerTab(tabId);
  };

  const heroTitle = isGlobal ? "Общая аналитика" : `ЖК ${selectedMeta?.name || selectedComplexName}`;
  const heroAddr = isGlobal
    ? `${stats.complexCount || complexList.length} жилых комплексов`
    : stats.address || selectedMeta?.address || "—";

  return (
    <div className="cad-shell">
      <aside className="cad-sidebar">
        <div className="cad-sidebar-top">
          <Link to="/" className="cad-brand" title="Astana Opera">
            <img src="/Logo.png" alt="Astana Opera" className="cad-brand-logo" />
            <div className="cad-brand-text">
              <span className="cad-brand-kicker">ASTANA</span>
              <strong>OPERA</strong>
            </div>
          </Link>

          <nav className="cad-nav" aria-label="Навигация">
            <button
              type="button"
              className={`cad-nav-item${isGlobal ? " is-active" : ""}`}
              onClick={selectHome}
            >
              <LayoutDashboard size={18} strokeWidth={1.75} />
              <span>Главная</span>
            </button>

            <div className="cad-nav-section">ЖК и аналитика</div>
            <div className="cad-complex-list">
              {complexList.map((c) => {
                const active =
                  !isGlobal &&
                  normalizeComplexName(c.name) === normalizeComplexName(selectedComplexName);
                return (
                  <button
                    key={c.id || c.name}
                    type="button"
                    className={`cad-nav-item cad-complex-item${active ? " is-active" : ""}`}
                    onClick={() => selectComplex(c.name)}
                  >
                    <Building2 size={16} strokeWidth={1.75} />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="cad-nav-section">Разделы</div>
            {SECTION_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="cad-nav-item"
                  onClick={() => handleSectionNav(item)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="cad-sidebar-foot">
          <div className="cad-sidebar-photo">
            <img src="/astana-opera.jpg" alt="Астана Опера" />
            <div className="cad-sidebar-photo-overlay" />
          </div>
          <p className="cad-sidebar-quote">Искусство объединяет</p>
        </div>
      </aside>

      <div className="cad-main">
        {loading ? <div className="cad-loading">Загрузка данных жилого фонда…</div> : null}

        <header className="cad-hero">
          <div className="cad-hero-bg" aria-hidden="true">
            {isGlobal ? (
              <img
                src="/astana-opera.jpg"
                alt=""
                className="cad-hero-img"
              />
            ) : (
              <ComplexPhotoImg
                name={selectedMeta?.name || selectedComplexName}
                className="cad-hero-img"
                alt={selectedMeta?.name || selectedComplexName}
              />
            )}
            <div className="cad-hero-shade" />
          </div>
          <div className="cad-hero-body">
            <div className="cad-hero-left">
              <h1>{heroTitle}</h1>
              <p className="cad-hero-addr">{heroAddr}</p>
              {!isGlobal && (stats.district || selectedMeta?.district) && (
                <span className="cad-district">{stats.district || selectedMeta?.district}</span>
              )}
            </div>
            <div className={`cad-hero-metrics${isGlobal ? "" : " is-complex"}`}>
              <div className="cad-hero-metric">
                <em>{isGlobal ? "Всего квартир" : "Квартир в ЖК"}</em>
                <strong>{stats.apartmentTotal}</strong>
              </div>
              {isGlobal ? (
                <div className="cad-hero-metric">
                  <em>Жилых комплексов</em>
                  <strong>{stats.complexCount || complexList.length}</strong>
                </div>
              ) : null}
              <div className="cad-hero-metric">
                <em>{isGlobal ? "В аренде / гостевые" : "Год постройки"}</em>
                <strong>
                  {isGlobal
                    ? `${stats.controlFundRent || 0} / ${stats.controlFundGuest || 0}`
                    : stats.buildYear || "—"}
                </strong>
              </div>
            </div>
          </div>
        </header>

        <div className="cad-toolbar">
          <div className="cad-tabs" role="tablist">
            {COMPLEX_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={innerTab === tab.id}
                className={`cad-tab${innerTab === tab.id ? " is-active" : ""}`}
                onClick={() => handleInnerTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="cad-period">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>

        {innerTab === "overview" && (
          <>
            <section className="cad-kpi-grid">
              {isGlobal ? (
                <>
                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-blue">
                      <Database size={18} />
                    </div>
                    <div className="cad-kpi-label">Поступления 2019–2025</div>
                    <div className="cad-kpi-value">
                      {formatMoneyKzt(stats.controlSales2019_2025)}
                    </div>
                    <div className="cad-kpi-meta">
                      <span className="cad-muted">
                        2026: {formatMoneyKzt(stats.controlSales2026)}
                      </span>
                    </div>
                  </article>

                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-teal">
                      <Home size={18} />
                    </div>
                    <div className="cad-kpi-label">Досрочный выкуп</div>
                    <div className="cad-kpi-value">{formatMoneyKzt(stats.controlEarly)}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-muted">первоначальная стоимость</span>
                    </div>
                  </article>

                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-purple">
                      <Wallet size={18} />
                    </div>
                    <div className="cad-kpi-label">Рассрочка</div>
                    <div className="cad-kpi-value">{formatMoneyKzt(stats.controlInstallment)}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-muted">перв. стоимость договоров</span>
                    </div>
                  </article>

                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-blue">
                      <Building2 size={18} />
                    </div>
                    <div className="cad-kpi-label">Жилищный фонд</div>
                    <div className="cad-kpi-value">{stats.controlFundTotal || stats.apartmentTotal}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-muted">квартир по всем ЖК</span>
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-blue">
                      <Database size={18} />
                    </div>
                    <div className="cad-kpi-label">Ежемесячный доход</div>
                    <div className="cad-kpi-value">{formatMoneyKzt(stats.monthlyTotal)}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-muted">Сумма постоянных ежемесячных поступлений</span>
                    </div>
                  </article>

                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-blue">
                      <Wallet size={18} />
                    </div>
                    <div className="cad-kpi-label">Аренда</div>
                    <div className="cad-kpi-value">{formatMoneyKzt(stats.annualRent)}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-pct is-blue">{stats.rentPct}% от общего</span>
                    </div>
                  </article>

                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-teal">
                      <Home size={18} />
                    </div>
                    <div className="cad-kpi-label">Реализованные квартиры</div>
                    <div className="cad-kpi-value">{formatMoneyKzt(stats.soldContractTotal ?? stats.annualSold)}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-pct is-teal">стоимость договоров этого ЖК</span>
                    </div>
                  </article>

                  <article className="cad-card cad-kpi">
                    <div className="cad-kpi-icon is-purple">
                      <Building2 size={18} />
                    </div>
                    <div className="cad-kpi-label">Общежитие</div>
                    <div className="cad-kpi-value">{formatMoneyKzt(stats.annualDorm)}</div>
                    <div className="cad-kpi-meta">
                      <span className="cad-pct is-purple">{stats.dormPct}% от общего</span>
                    </div>
                  </article>
                </>
              )}
            </section>

            <section className="cad-mid-grid">
              <article className="cad-card cad-bar-card">
                <div className="cad-card-head">
                  <h2 className="cad-card-title">
                    {isGlobal ? "Динамика доходов (все ЖК)" : "Динамика доходов"}
                  </h2>
                  <div className="cad-inline-legend">
                    <span>
                      <i style={{ background: COLORS.rent }} /> Аренда
                    </span>
                    <span>
                      <i style={{ background: COLORS.sold }} /> Реализованные
                    </span>
                    <span>
                      <i style={{ background: COLORS.dorm }} /> Общежитие
                    </span>
                  </div>
                </div>
                <div className="cad-bar-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.barSeries} barGap={3} barCategoryGap="18%">
                      <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(0)}M`
                            : `${Math.round(v / 1000)}k`
                        }
                        domain={[0, yMax]}
                      />
                      <Tooltip
                        formatter={(value) => formatMoneyKzt(value)}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #E2E8F0",
                          background: "#FFFFFF",
                          color: "#0F172A",
                          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                        }}
                      />
                      <Bar dataKey="rent" name="Аренда" stackId="a" fill={COLORS.rent} />
                      <Bar dataKey="sold" name="Реализованные" stackId="a" fill={COLORS.sold} />
                      <Bar
                        dataKey="dorm"
                        name="Общежитие"
                        stackId="a"
                        fill={COLORS.dorm}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="cad-card cad-donut-card">
                <h2 className="cad-card-title">
                  {isGlobal ? "Структура доходов (все ЖК)" : "Структура доходов"}
                </h2>
                <div className="cad-donut-layout">
                  <div className="cad-donut-chart">
                    {stats.annualTotal > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.donut.filter((d) => d.value > 0)}
                              dataKey="value"
                              nameKey="name"
                              innerRadius="64%"
                              outerRadius="88%"
                              paddingAngle={2}
                              stroke="none"
                            >
                              {stats.donut
                                .filter((d) => d.value > 0)
                                .map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={
                                      entry.name.startsWith("Аренда")
                                        ? COLORS.rent
                                        : entry.name.startsWith("Реализ")
                                          ? COLORS.sold
                                          : COLORS.dorm
                                    }
                                  />
                                ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => formatMoneyKzt(value)}
                              contentStyle={{
                                borderRadius: 12,
                                border: "1px solid #E2E8F0",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="cad-donut-center">
                          <strong>{formatMillionsShort(stats.annualTotal)}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="cad-empty">Нет данных</div>
                    )}
                  </div>
                  <ul className="cad-legend">
                    {stats.donut.map((item) => (
                      <li key={item.name}>
                        <span
                          className="cad-legend-dot"
                          style={{
                            background: item.name.startsWith("Аренда")
                              ? COLORS.rent
                              : item.name.startsWith("Реализ")
                                ? COLORS.sold
                                : COLORS.dorm,
                          }}
                        />
                        <div>
                          <div className="cad-legend-name">{item.name}</div>
                          <strong>{item.pct}%</strong>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="cad-card cad-pay-card">
                <h2 className="cad-card-title">Платежи по видам</h2>
                <p className="cad-card-sub">
                  {isGlobal ? "контрольные суммы Excel" : `за период · ${periodLabel}`}
                </p>
                <ul className="cad-pay-types">
                  {(stats.paymentTypes || []).map((row) => (
                    <li key={row.name}>
                      <div className="cad-pay-top">
                        <span>{row.name}</span>
                        <strong>{formatMoneyKzt(row.amount)}</strong>
                      </div>
                      <div className="cad-progress">
                        <div
                          className="cad-progress-bar"
                          style={{
                            width: `${Math.min(100, row.pct)}%`,
                            background: row.color,
                          }}
                        />
                      </div>
                      <div className="cad-pay-pct">{row.pct}%</div>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
