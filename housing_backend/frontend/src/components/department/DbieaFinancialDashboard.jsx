import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis
} from "recharts";
import { AlertCircle, Calendar, ShieldAlert, Award, Sparkles, TrendingUp, DollarSign, ListCollapse } from "lucide-react";

// --- Base Astana Districts template generators ---
const getInitialDistrictsRent = () => ({
  "Есильский район": { name: "Есильский район", value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 },
  "Район Сарайшык": { name: "Район Сарайшык", value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 },
  "Алматинский район": { name: "Алматинский район", value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 },
  "Байконурский район": { name: "Байконурский район", value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 },
  "Нуринский район": { name: "Нуринский район", value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 },
  "Сарыаркинский район": { name: "Сарыаркинский район", value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 }
});

const getInitialDistrictsPurchase = () => ({
  "Есильский район": { name: "Есильский район", value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 },
  "Район Сарайшык": { name: "Район Сарайшык", value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 },
  "Алматинский район": { name: "Алматинский район", value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 },
  "Байконурский район": { name: "Байконурский район", value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 },
  "Нуринский район": { name: "Нуринский район", value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 },
  "Сарыаркинский район": { name: "Сарыаркинский район", value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 }
});

// --- Soft and Harmonious HSL Palettes (Emerald, Mint, Graphite, and delicate Gray for others) ---
function getRentColor(name, index) {
  const normName = String(name || "").toLowerCase();
  if (normName.includes("не указан") || normName.includes("не найдена") || normName.includes("не указана")) {
    return "#94a3b8"; // delicate gray
  }
  
  // Custom cyclic palette of deep emerald, mint, and graphite shades
  const palette = [
    "#0f4c3a", // deep emerald
    "#115e59", // deep teal
    "#0d9488", // minty teal
    "#14b8a6", // mint
    "#334155", // dark graphite
    "#475569", // graphite
    "#1d7a62", 
    "#56b299", 
    "#64748b"  // steel gray
  ];
  return palette[index % palette.length];
}

// Custom Purchase colors mapping
function getPurchaseColor(name, index) {
  const normName = String(name || "").toLowerCase();
  if (normName.includes("не указан") || normName.includes("не найдена") || normName.includes("не указана")) {
    return "#94a3b8"; // delicate gray
  }

  // Soft blues, indigo, and graphite
  const palette = [
    "#1e3b8b", // deep sapphire blue
    "#2563eb", // royal blue
    "#3b82f6", // clear blue
    "#334155", // graphite
    "#4f46e5", // soft indigo
    "#60a5fa", // soft sky blue
    "#475569", // graphite medium
    "#818cf8"  // light indigo
  ];
  return palette[index % palette.length];
}

// 6 official Astana districts color map
const DISTRICT_COLORS = {
  "Алматинский район": "#10b981",   // Emerald
  "Байконурский район": "#f59e0b",  // Amber
  "Есильский район": "#3b82f6",     // Blue
  "Нуринский район": "#8b5cf6",     // Purple
  "Сарыаркинский район": "#ec4899",  // Pink
  "Район Сарайшык": "#06b6d4"       // Cyan
};

const DISTRICT_COLOR_LIST = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

const PIE_COLORS = ["#15803d", "#22c55e", "#eab308", "#ef4444", "#64748b"];

// --- Helper Functions ---
function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^а-яa-z0-9]+/g, "");
}

function findHeader(headers, keywords) {
  return headers.find((header) => keywords.some((keyword) => normalizeHeader(header).includes(keyword))) || "";
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₸`;
}

function formatCompactMoney(value) {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)} млрд ₸`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)} млн ₸`;
  }
  return formatMoney(value);
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const asDate = new Date((value - 25569) * 86400 * 1000);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }
  const asString = String(value).trim();
  if (!asString) return null;
  const isoMatch = asString.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const ruMatch = asString.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (ruMatch) {
    const [, d, m, y] = ruMatch;
    return new Date(Number(y.length === 2 ? 2000 + Number(y) : Number(y)), Number(m) - 1, Number(d));
  }
  const parsed = new Date(asString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysDiff(value) {
  const date = parseDate(value);
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date - now) / (1000 * 60 * 60 * 24));
}

function getDaysLeftToPayment(value) {
  if (value === null || value === undefined || value === "") return null;
  const dateObj = parseDate(value);
  if (dateObj) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    return Math.round((dateObj - now) / (1000 * 60 * 60 * 24));
  }
  const numVal = parseInt(String(value).replace(/\D/g, ""), 10);
  if (numVal >= 1 && numVal <= 31) {
    const now = new Date();
    let targetDate = new Date(now.getFullYear(), now.getMonth(), numVal);
    let diff = Math.round((targetDate - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, numVal);
      diff = Math.round((targetDate - now) / (1000 * 60 * 60 * 24));
    }
    return diff;
  }
  return null;
}

function getRowValue(row, headers, key) {
  if (!key) return "";
  return row[key] ?? "";
}

function cleanComplexName(name) {
  if (!name) return "Не указан";
  let cleaned = String(name).trim();
  
  // Remove duplicates and prefixes
  cleaned = cleaned.replace(/жилой комплекс/i, "");
  cleaned = cleaned.replace(/ж\.к\./i, "");
  cleaned = cleaned.replace(/жк/i, "");
  
  cleaned = cleaned.trim();
  
  if (cleaned.includes(",")) {
    cleaned = cleaned.split(",")[0].trim();
  }
  cleaned = cleaned.replace(/\s(д|дом|улица|ул|кв|квартира)\b.*/i, "");
  cleaned = cleaned.trim();

  // Map to canonical short names as on employee cards
  const lower = cleaned.toLowerCase();
  if (lower.includes("акку") || lower.includes("аққу")) return "ЖК Акку";
  if (lower.includes("браво")) return "ЖК Браво";
  if (lower.includes("виктори")) return "ЖК Виктория";
  if (lower.includes("жагалау")) return "ЖК Жагалау-3";
  if (lower.includes("зерде")) return "ЖК Зерде";
  if (lower.includes("лазурн")) return "ЖК Лазурный квартал";
  if (lower.includes("москва")) return "ЖК Москва";
  if (lower.includes("нурсая") || lower.includes("нур-сая")) return "ЖК НУР-САЯ";
  if (lower.includes("общежитие")) return "ЖК Общежитие";
  if (lower.includes("азирбаев") || lower.includes("азірбаев")) return "ЖК ул. К.Азирбаева";
  if (lower.includes("сапа")) return "ЖК Сапа-2007";
  if (lower.includes("сармат")) return "ЖК Сармат";
  if (lower.includes("хан тенгри") || lower.includes("хан-тенгри")) return "ЖК Хан-тенгри";
  if (lower.includes("compass") || lower.includes("компас")) return "ЖК Compass North";
  if (lower.includes("respublika") || lower.includes("республика")) return "ЖК Respublika";
  
  if (cleaned && cleaned !== "Не указан") {
    return "ЖК " + cleaned;
  }
  return "Не указан";
}

function getDistrict(row, headers, addressKey, complexKey) {
  const districtKey = headers.find(h => /район|округ|district/i.test(h));
  let rawVal = "";
  if (districtKey && row[districtKey]) {
    rawVal = String(row[districtKey]).toLowerCase();
  } else {
    const addr = String(row[addressKey] || "").toLowerCase();
    const complex = String(row[complexKey] || "").toLowerCase();
    rawVal = addr + " " + complex;
  }

  // Map strictly to official 6 districts of Astana
  if (rawVal.includes("алмат")) return "Алматинский район";
  if (rawVal.includes("байкон") || rawVal.includes("байконыр")) return "Байконурский район";
  if (rawVal.includes("есиль")) return "Есильский район";
  if (rawVal.includes("нур") || rawVal.includes("нура")) return "Нуринский район";
  if (rawVal.includes("сарыарк")) return "Сарыаркинский район";
  if (rawVal.includes("сарайш")) return "Район Сарайшык";
  
  // Fallbacks based on typical complexes
  const complexLower = String(row[complexKey] || "").toLowerCase();
  if (complexLower.includes("зерде")) return "Нуринский район";
  if (complexLower.includes("лазурн")) return "Есильский район";
  if (complexLower.includes("жагалау")) return "Нуринский район";
  if (complexLower.includes("времена года")) return "Есильский район";
  if (complexLower.includes("хан тенгри") || complexLower.includes("хан-тенгри")) return "Есильский район";
  
  return "Есильский район";
}

// ==========================================
// 1. DbieaRentDashboard
// ==========================================
export function DbieaRentDashboard({ headers = [], rows = [] }) {
  const fioKey = useMemo(() => findHeader(headers, ["фио", "fio", "сотрудник", "name"]), [headers]);
  const positionKey = useMemo(() => findHeader(headers, ["должност", "position", "role"]), [headers]);
  const addressKey = useMemo(() => findHeader(headers, ["адрес", "address"]), [headers]);
  const complexKey = useMemo(() => findHeader(headers, ["жк", "complex", "жилой"]), [headers]);
  const penaltyKey = useMemo(() => findHeader(headers, ["пеня", "penalty", "штраф"]), [headers]);
  const overdueDaysKey = useMemo(() => findHeader(headers, ["просроч", "overdue", "days", "дней", "задолж"]), [headers]);
  const paymentDayKey = useMemo(() => findHeader(headers, ["платеж", "оплата", "payment", "day", "число", "день"]), [headers]);
  const contractEndKey = useMemo(() => findHeader(headers, ["договор", "contract", "оконч", "end", "датаоконч"]), [headers]);
  const debtKey = useMemo(() => findHeader(headers, ["долг", "debt", "остаток", "balance", "remaining", "задолженность"]), [headers]);
  const rentCostKey = useMemo(() => findHeader(headers, ["начислен", "аренд", "плата", "стоимост", "rent", "cost", "сумма"]), [headers]);

  // UI Interactive States
  const [groupDim, setGroupDim] = useState("position"); // 'position', 'complex', 'district'
  const [activeCategoryDetails, setActiveCategoryDetails] = useState(null);

  // Extract resolved value for a row based on active grouping dimension
  const getRowGroupVal = (row) => {
    if (groupDim === "position") {
      return String(getRowValue(row, headers, positionKey) || "").trim() || "Не указана";
    } else if (groupDim === "complex") {
      const raw = getRowValue(row, headers, complexKey) || getRowValue(row, headers, addressKey) || "Не указан";
      return cleanComplexName(raw);
    } else {
      return getDistrict(row, headers, addressKey, complexKey);
    }
  };

  // Aggregate Rent Data based on rows
  const analytics = useMemo(() => {
    let penaltySum = 0;
    let overdueDaysSum = 0;
    
    // Pre-populate if grouping by District, else empty object
    const positionsMap = groupDim === "district" ? getInitialDistrictsRent() : {};
    
    const soonPaymentsList = [];
    const contractExpirationsList = [];

    rows.forEach((row) => {
      const penaltyVal = parseNumber(getRowValue(row, headers, penaltyKey));
      const overdueVal = parseNumber(getRowValue(row, headers, overdueDaysKey));
      const debtVal = parseNumber(getRowValue(row, headers, debtKey));
      const rentVal = parseNumber(getRowValue(row, headers, rentCostKey));
      
      penaltySum += penaltyVal;
      overdueDaysSum += overdueVal;

      // Group aggregation for chart
      const groupVal = getRowGroupVal(row);
      if (!positionsMap[groupVal]) {
        positionsMap[groupVal] = { name: groupVal, value: 0, totalPenalty: 0, totalDebt: 0, totalRent: 0 };
      }
      positionsMap[groupVal].value += 1;
      positionsMap[groupVal].totalPenalty += penaltyVal;
      positionsMap[groupVal].totalDebt += debtVal;
      positionsMap[groupVal].totalRent += (rentVal || debtVal || 0);

      // Soon Payments (Payment due in <= 3 days)
      const payVal = getRowValue(row, headers, paymentDayKey);
      const daysLeftPay = getDaysLeftToPayment(payVal);
      if (daysLeftPay !== null && daysLeftPay >= 0 && daysLeftPay <= 3) {
        soonPaymentsList.push({
          fio: getRowValue(row, headers, fioKey) || "Сотрудник",
          complex: getRowValue(row, headers, complexKey) || getRowValue(row, headers, addressKey) || "—",
          daysLeft: daysLeftPay,
          paymentDay: payVal,
          penalty: penaltyVal
        });
      }

      // Contract Expirations (Ends in <= 30 days)
      const expiryDateVal = getRowValue(row, headers, contractEndKey);
      const daysLeftContract = getDaysDiff(expiryDateVal);
      if (daysLeftContract !== null && daysLeftContract <= 30) {
        contractExpirationsList.push({
          fio: getRowValue(row, headers, fioKey) || "Сотрудник",
          complex: getRowValue(row, headers, complexKey) || getRowValue(row, headers, addressKey) || "—",
          daysLeft: daysLeftContract,
          expiryDate: expiryDateVal ? String(expiryDateVal).split("T")[0] : "—"
        });
      }
    });

    const positionData = Object.values(positionsMap).sort((a, b) => b.value - a.value);
    soonPaymentsList.sort((a, b) => a.daysLeft - b.daysLeft);
    contractExpirationsList.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      penaltySum,
      overdueDaysSum,
      positionData,
      soonPayments: soonPaymentsList,
      contractExpirations: contractExpirationsList
    };
  }, [rows, headers, fioKey, positionKey, addressKey, complexKey, penaltyKey, overdueDaysKey, paymentDayKey, contractEndKey, debtKey, rentCostKey, groupDim]);

  const totalRentCost = useMemo(() => {
    return analytics.positionData.reduce((acc, curr) => acc + curr.totalRent, 0);
  }, [analytics.positionData]);

  const maxVal = useMemo(() => {
    return analytics.positionData[0]?.value || 1;
  }, [analytics.positionData]);

  // Full dataset rendered in progress bar widget
  const fullGroupedData = useMemo(() => {
    return analytics.positionData;
  }, [analytics.positionData]);

  const getSegmentColor = (name, index, value) => {
    if (value === 0) {
      return "#e2e8f0"; // light gray segment for 0 data
    }
    if (groupDim === "district") {
      return DISTRICT_COLORS[name] || DISTRICT_COLOR_LIST[index % DISTRICT_COLOR_LIST.length];
    }
    return getRentColor(name, index);
  };

  const CustomTooltipContent = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-custom-tooltip" style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          padding: '0.8rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
        }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>{data.name}</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "0.8rem", color: "#475569" }}>
            Количество: <strong>{data.value} чел.</strong>
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#dc2626", fontWeight: 700 }}>
            Общая сумма: <strong>{formatMoney(data.totalRent)}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  const handleScrollToTable = () => {
    const tableElement = document.querySelector(".dbiea-table-section");
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="rent-dashboard-container">
      {/* 1. KPIs */}
      <div className="dbiea-kpi-grid">
        <div className="dbiea-kpi-card accent-green">
          <div className="dbiea-kpi-icon"><Award size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Сотрудников на аренде</span>
            <span className="dbiea-kpi-value">
              {rows.length} <span className="dbiea-kpi-unit">чел.</span>
            </span>
          </div>
        </div>

        <div className={`dbiea-kpi-card ${analytics.penaltySum > 0 ? "accent-red" : "accent-green"}`}>
          <div className="dbiea-kpi-icon"><ShieldAlert size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Сумма пени</span>
            <span className="dbiea-kpi-value warning-text">{formatMoney(analytics.penaltySum)}</span>
          </div>
        </div>

        <div className={`dbiea-kpi-card ${analytics.overdueDaysSum > 0 ? "accent-orange" : "accent-green"}`}>
          <div className="dbiea-kpi-icon"><Calendar size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Просроченные дни</span>
            <span className="dbiea-kpi-value warning-text">{analytics.overdueDaysSum} <span className="dbiea-kpi-unit">дн.</span></span>
          </div>
        </div>

        <div className="dbiea-kpi-card accent-blue">
          <div className="dbiea-kpi-icon"><Sparkles size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Скоро оплата (≤3 дн.)</span>
            <span className="dbiea-kpi-value">{analytics.soonPayments.length} <span className="dbiea-kpi-unit">зап.</span></span>
          </div>
        </div>
      </div>

      {/* Grouping Control Bar */}
      <div className="dbiea-group-control-bar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Группировать кольцо по:</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => { setGroupDim("position"); setActiveCategoryDetails(null); }}
            style={groupDim === "position" ? activeTabStyle : inactiveTabStyle}
          >
            Должностям
          </button>
          <button 
            onClick={() => { setGroupDim("complex"); setActiveCategoryDetails(null); }}
            style={groupDim === "complex" ? activeTabStyle : inactiveTabStyle}
          >
            ЖК
          </button>
          <button 
            onClick={() => { setGroupDim("district"); setActiveCategoryDetails(null); }}
            style={groupDim === "district" ? activeTabStyle : inactiveTabStyle}
          >
            Районам
          </button>
        </div>
      </div>

      {/* 2. Grid for Donut Chart & Details List (Layout 50/50) */}
      <div className="dbiea-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Left Column: Donut Chart with Overlay text inside center */}
        <div className="dbiea-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          <div className="dbiea-card-header">
            <h3 className="dbiea-card-title">
              Аналитика: {groupDim === "position" ? "Должности" : groupDim === "complex" ? "Жилые Комплексы" : "Районы"}
            </h3>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {analytics.positionData.length === 0 ? (
              <div className="dbiea-empty-chart">Нет активных данных</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.positionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={106}
                    paddingAngle={2.5}
                    minAngle={15} // Enforce minimum angle to avoid invisible slices
                    dataKey="value"
                    onClick={(entry) => setActiveCategoryDetails(entry)}
                    style={{ cursor: "pointer" }}
                  >
                    {analytics.positionData.map((entry, index) => {
                      const isDetailSelected = activeCategoryDetails && activeCategoryDetails.name === entry.name;
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getSegmentColor(entry.name, index, entry.value)}
                          stroke={isDetailSelected ? "#0f172a" : "#ffffff"}
                          strokeWidth={isDetailSelected ? 3.5 : 1}
                          opacity={activeCategoryDetails && !isDetailSelected ? 0.4 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Overlay Center Content */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '140px'
            }}>
              <span style={{ fontSize: '1.15rem', color: '#0f172a', fontWeight: 900, lineHeight: 1.1, letterSpacing: '0.01em' }}>
                {rows.length} чел.
              </span>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ВСЕГО: {formatCompactMoney(totalRentCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Full Details Progress List with scrollbar container */}
        <div className="dbiea-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '380px' }}>
          <div>
            <div className="dbiea-card-header">
              <h3 className="dbiea-card-title">
                Детальная статистика
              </h3>
            </div>
            
            <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
              {analytics.positionData.length === 0 ? (
                <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>Нет данных</div>
              ) : (
                <div 
                  className="dbiea-scroll-container" 
                  style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}
                >
                  <div className="dbiea-top5-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {fullGroupedData.map((item, idx) => {
                      const percentage = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 800, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={item.name}>
                              {item.name}
                            </span>
                            <span style={{ color: '#475569', fontWeight: 600 }}>
                              {item.value} чел. <span style={{ color: '#cbd5e1', fontWeight: 400 }}>|</span> <span style={{ color: '#2d5a47' }}>{formatCompactMoney(item.totalRent)}</span>
                            </span>
                          </div>
                          {/* Minimalist Thin Progress Bar */}
                          <div style={{ width: '100%', height: '5px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              background: item.value > 0 ? 'linear-gradient(90deg, #0f4c3a, #14b8a6)' : '#cbd5e1',
                              borderRadius: '9999px',
                              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            {activeCategoryDetails ? (
              <div className="active-category-details-card animate-fade-in" style={{
                padding: '0.85rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 850, fontSize: '0.82rem' }}>
                    Выбрано: {activeCategoryDetails.name}
                  </h4>
                  <button 
                    onClick={() => setActiveCategoryDetails(null)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800 }}
                  >
                    Сбросить
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  <div style={{ background: '#ffffff', padding: '0.4rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Кадры</span>
                    <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>{activeCategoryDetails.value} чел.</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.4rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Сумма</span>
                    <strong style={{ fontSize: '0.82rem', color: '#2d5a47' }}>{formatCompactMoney(activeCategoryDetails.totalRent)}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.4rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Пеня</span>
                    <strong style={{ fontSize: '0.82rem', color: activeCategoryDetails.totalPenalty > 0 ? '#dc2626' : '#10b981' }}>
                      {formatMoney(activeCategoryDetails.totalPenalty)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              onClick={handleScrollToTable}
              style={{
                width: '100%',
                padding: '0.65rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1b3a2e'; e.currentTarget.style.color = '#1b3a2e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
            >
              <ListCollapse size={14} />
              Показать все категории в таблице
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Lists: Notifications */}
      <div className="dbiea-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dbiea-card">
          <div className="dbiea-card-header bg-yellow-soft">
            <h3 className="dbiea-card-title flex-align">
              <AlertCircle size={18} className="text-amber" />
              Уведомления: Список "Скоро оплата" (≤3 дней)
            </h3>
          </div>
          <div className="dbiea-list-container">
            {analytics.soonPayments.length === 0 ? (
              <div className="dbiea-empty-list">Все оплаты по графику</div>
            ) : (
              analytics.soonPayments.map((item, idx) => (
                <div key={idx} className="dbiea-list-item warning-border">
                  <div className="dbiea-list-main">
                    <strong className="dbiea-list-title">{item.fio}</strong>
                    <span className="dbiea-list-sub">{item.complex}</span>
                  </div>
                  <div className="dbiea-list-badge warning">
                    {item.daysLeft === 0 ? "Сегодня" : `${item.daysLeft} дн.`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dbiea-card">
          <div className="dbiea-card-header">
            <h3 className="dbiea-card-title flex-align">
              <Calendar size={18} className="text-green" />
              Истечение договора найма служебного жилья
            </h3>
          </div>
          <div className="dbiea-horizontal-scroller" style={{ maxHeight: '270px', overflowY: 'auto' }}>
            {analytics.contractExpirations.length === 0 ? (
              <div className="dbiea-empty-list">Нет договоров со сроком аренды под контролем</div>
            ) : (
              <table className="dbiea-mini-table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>ЖК</th>
                    <th>Окончание</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.contractExpirations.map((item, idx) => {
                    const isOverdue = item.daysLeft < 0;
                    return (
                      <tr key={idx} className={isOverdue ? "danger-row" : ""}>
                        <td><strong>{item.fio}</strong></td>
                        <td>{item.complex}</td>
                        <td>
                          <span className={`dbiea-status-badge ${isOverdue ? "expired" : "soon"}`}>
                            {isOverdue ? "Истек" : `${item.daysLeft} дн.`} ({item.expiryDate})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. DbieaPurchaseDashboard
// ==========================================
export function DbieaPurchaseDashboard({ headers = [], rows = [] }) {
  const fioKey = useMemo(() => findHeader(headers, ["фио", "fio", "сотрудник", "name"]), [headers]);
  const positionKey = useMemo(() => findHeader(headers, ["должност", "position", "role"]), [headers]);
  const complexKey = useMemo(() => findHeader(headers, ["жк", "complex", "жилой"]), [headers]);
  const addressKey = useMemo(() => findHeader(headers, ["адрес", "address"]), [headers]);
  const monthlyPaymentKey = useMemo(() => findHeader(headers, ["ежемесяч", "monthly", "payment", "платеж", "взнос"]), [headers]);
  const debtKey = useMemo(() => findHeader(headers, ["долг", "debt", "остаток", "balance", "remaining"]), [headers]);
  const penaltyKey = useMemo(() => findHeader(headers, ["пеня", "penalty", "штраф"]), [headers]);
  const termKey = useMemo(() => findHeader(headers, ["срок", "рассроч", "выкуп", "term", "basis", "услов"]), [headers]);
  const yearKey = useMemo(() => findHeader(headers, ["год", "year", "дата", "date"]), [headers]);

  // UI Interactive States
  const [groupDim, setGroupDim] = useState("position"); // 'position', 'complex', 'district'
  const [activeCategoryDetails, setActiveCategoryDetails] = useState(null);

  // Extract resolved value for a row based on active grouping dimension
  const getRowGroupVal = (row) => {
    if (groupDim === "position") {
      return String(getRowValue(row, headers, positionKey) || "").trim() || "Не указана";
    } else if (groupDim === "complex") {
      const raw = getRowValue(row, headers, complexKey) || getRowValue(row, headers, addressKey) || "Не указан";
      return cleanComplexName(raw);
    } else {
      return getDistrict(row, headers, addressKey, complexKey);
    }
  };

  // Aggregate Purchase data
  const analytics = useMemo(() => {
    let monthlyPaymentsSum = 0;
    let debtSum = 0;
    let penaltySum = 0;

    // Pre-populate if grouping by District, else empty object
    const groupTotals = groupDim === "district" ? getInitialDistrictsPurchase() : {};
    
    const termStats = {
      "Полный выкуп (100%)": 0,
      "Рассрочка на 5 лет": 0,
      "Рассрочка на 10 лет": 0,
      "Рассрочка на 15 лет": 0,
      "Другие условия": 0
    };

    const yearlyContracts = {}; 
    const yearlyPositions = {}; 

    rows.forEach((row) => {
      const monthlyVal = parseNumber(getRowValue(row, headers, monthlyPaymentKey));
      const debtVal = parseNumber(getRowValue(row, headers, debtKey));
      const penaltyVal = parseNumber(getRowValue(row, headers, penaltyKey));

      monthlyPaymentsSum += monthlyVal;
      debtSum += debtVal;
      penaltySum += penaltyVal;

      // Grouping aggregates
      const groupVal = getRowGroupVal(row);
      if (!groupTotals[groupVal]) {
        groupTotals[groupVal] = { name: groupVal, value: 0, totalDebt: 0, monthlyPayment: 0, totalPenalty: 0 };
      }
      groupTotals[groupVal].value += 1;
      groupTotals[groupVal].totalDebt += debtVal;
      groupTotals[groupVal].monthlyPayment += monthlyVal;
      groupTotals[groupVal].totalPenalty += penaltyVal;

      // Installment Term Categorization
      const termRaw = String(getRowValue(row, headers, termKey) || "").toLowerCase();
      if (termRaw.includes("100") || termRaw.includes("полн") || termRaw.includes("100%")) {
        termStats["Полный выкуп (100%)"] += 1;
      } else if (termRaw.includes("15") || termRaw.includes("15л") || termRaw.includes("15 л")) {
        termStats["Рассрочка на 15 лет"] += 1;
      } else if (termRaw.includes("10") || termRaw.includes("10л") || termRaw.includes("10 л")) {
        termStats["Рассрочка на 10 лет"] += 1;
      } else if (termRaw.includes("5") || termRaw.includes("5л") || termRaw.includes("5 л")) {
        termStats["Рассрочка на 5 лет"] += 1;
      } else {
        termStats["Другие условия"] += 1;
      }

      // Yearly agreements registration
      const yearRaw = String(getRowValue(row, headers, yearKey) || "").trim();
      const yearMatch = yearRaw.match(/(\d{4})/);
      if (yearMatch) {
        const year = yearMatch[1];
        yearlyContracts[year] = (yearlyContracts[year] || 0) + 1;

        const pos = String(getRowValue(row, headers, positionKey) || "Не указана").trim();
        if (!yearlyPositions[year]) yearlyPositions[year] = {};
        yearlyPositions[year][pos] = (yearlyPositions[year][pos] || 0) + 1;
      }
    });

    // Formatting Grouped List
    const positionList = Object.values(groupTotals).sort((a, b) => b.totalDebt - a.totalDebt);

    // Formatting Terms pie data
    const termsData = Object.entries(termStats)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);

    // Format Yearly Data
    const yearlyList = Object.keys(yearlyContracts)
      .sort((a, b) => Number(a) - Number(b))
      .map((year) => {
        const posMap = yearlyPositions[year] || {};
        let topPos = "Нет данных";
        let topCount = 0;
        Object.entries(posMap).forEach(([pos, count]) => {
          if (count > topCount) {
            topCount = count;
            topPos = pos;
          }
        });
        return {
          year,
          agreements: yearlyContracts[year],
          topPosition: `${topPos} (${topCount} чел.)`
        };
      });

    // Identify Peak Year
    let peakYearStr = "—";
    let peakAgreementsCount = 0;
    let peakTopPosition = "";
    yearlyList.forEach((y) => {
      if (y.agreements > peakAgreementsCount) {
        peakAgreementsCount = y.agreements;
        peakYearStr = y.year;
        peakTopPosition = y.topPosition;
      }
    });

    // Filter top debtors
    const topDebtors = rows
      .map((row) => ({
        fio: getRowValue(row, headers, fioKey) || "Сотрудник",
        complex: getRowValue(row, headers, complexKey) || "—",
        monthly: parseNumber(getRowValue(row, headers, monthlyPaymentKey)),
        debt: parseNumber(getRowValue(row, headers, debtKey)),
        penalty: parseNumber(getRowValue(row, headers, penaltyKey))
      }))
      .filter((item) => item.debt > 0 || item.penalty > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);

    return {
      monthlyPaymentsSum,
      debtSum,
      penaltySum,
      positionList,
      termsData,
      yearlyData: yearlyList,
      peakYear: { year: peakYearStr, count: peakAgreementsCount, position: peakTopPosition },
      topDebtors
    };
  }, [rows, headers, fioKey, positionKey, complexKey, addressKey, monthlyPaymentKey, debtKey, penaltyKey, termKey, yearKey, groupDim]);

  const maxDebt = useMemo(() => {
    return analytics.positionList[0]?.totalDebt || 1;
  }, [analytics.positionList]);

  // Full dataset rendered in progress bar widget for Purchase
  const fullGroupedDebt = useMemo(() => {
    return analytics.positionList;
  }, [analytics.positionList]);

  const getSegmentColor = (name, index, value) => {
    if (value === 0) {
      return "#e2e8f0"; // light gray segment for 0 data
    }
    if (groupDim === "district") {
      return DISTRICT_COLORS[name] || DISTRICT_COLOR_LIST[index % DISTRICT_COLOR_LIST.length];
    }
    return getPurchaseColor(name, index);
  };

  const CustomTooltipContent = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-custom-tooltip" style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          padding: '0.8rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
        }}>
          <p style={{ margin: "0 0 6px 0", fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>{data.name}</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "0.8rem", color: "#475569" }}>
            Договоров: <strong>{data.value} шт.</strong>
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#dc2626", fontWeight: 700 }}>
            Остаток долга: <strong>{formatMoney(data.totalDebt)}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  const handleScrollToTable = () => {
    const tableElement = document.getElementById("dbiea-detailed-values-table");
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="purchase-dashboard-container">
      {/* 1. KPIs */}
      <div className="dbiea-kpi-grid">
        <div className="dbiea-kpi-card accent-green">
          <div className="dbiea-kpi-icon"><Award size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Активных договоров</span>
            <span className="dbiea-kpi-value">
              {rows.length} <span className="dbiea-kpi-unit">шт.</span>
            </span>
          </div>
        </div>

        <div className="dbiea-kpi-card accent-blue">
          <div className="dbiea-kpi-icon"><DollarSign size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Платежей в месяц</span>
            <span className="dbiea-kpi-value">{formatMoney(analytics.monthlyPaymentsSum)}</span>
          </div>
        </div>

        <div className="dbiea-kpi-card accent-emerald">
          <div className="dbiea-kpi-icon"><TrendingUp size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Остаток долга</span>
            <span className="dbiea-kpi-value">{formatMoney(analytics.debtSum)}</span>
          </div>
        </div>

        <div className={`dbiea-kpi-card ${analytics.penaltySum > 0 ? "accent-red" : "accent-green"}`}>
          <div className="dbiea-kpi-icon"><ShieldAlert size={24} /></div>
          <div className="dbiea-kpi-info">
            <span className="dbiea-kpi-label">Начислено пени</span>
            <span className="dbiea-kpi-value warning-text">{formatMoney(analytics.penaltySum)}</span>
          </div>
        </div>
      </div>

      {/* Grouping Control Bar */}
      <div className="dbiea-group-control-bar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Группировать кольцо по:</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => { setGroupDim("position"); setActiveCategoryDetails(null); }}
            style={groupDim === "position" ? activeTabStyle : inactiveTabStyle}
          >
            Должностям
          </button>
          <button 
            onClick={() => { setGroupDim("complex"); setActiveCategoryDetails(null); }}
            style={groupDim === "complex" ? activeTabStyle : inactiveTabStyle}
          >
            ЖК
          </button>
          <button 
            onClick={() => { setGroupDim("district"); setActiveCategoryDetails(null); }}
            style={groupDim === "district" ? activeTabStyle : inactiveTabStyle}
          >
            Районам
          </button>
        </div>
      </div>

      {/* 2. Grid for Donut Chart & Details List (Layout 50/50) */}
      <div className="dbiea-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Left Column: Donut Chart with Overlay text inside center */}
        <div className="dbiea-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          <div className="dbiea-card-header">
            <h3 className="dbiea-card-title">
              Выкуп: {groupDim === "position" ? "Должности" : groupDim === "complex" ? "Жилые Комплексы" : "Районы"}
            </h3>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {analytics.positionList.length === 0 ? (
              <div className="dbiea-empty-chart">Нет активных данных</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.positionList}
                    cx="50%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={106}
                    paddingAngle={2.5}
                    minAngle={15} // Enforce minimum angle to avoid invisible slices
                    dataKey="value"
                    onClick={(entry) => setActiveCategoryDetails(entry)}
                    style={{ cursor: "pointer" }}
                  >
                    {analytics.positionList.map((entry, index) => {
                      const isDetailSelected = activeCategoryDetails && activeCategoryDetails.name === entry.name;
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getSegmentColor(entry.name, index, entry.value)}
                          stroke={isDetailSelected ? "#0f172a" : "#ffffff"}
                          strokeWidth={isDetailSelected ? 3.5 : 1}
                          opacity={activeCategoryDetails && !isDetailSelected ? 0.4 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Overlay Center Content */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '140px'
            }}>
              <span style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 900, lineHeight: 1.1, letterSpacing: '0.01em' }}>
                {formatCompactMoney(analytics.debtSum)}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Остаток долга
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Full Details Progress List with scrollbar container */}
        <div className="dbiea-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '380px' }}>
          <div>
            <div className="dbiea-card-header">
              <h3 className="dbiea-card-title">
                Детальная статистика
              </h3>
            </div>
            
            <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
              {analytics.positionList.length === 0 ? (
                <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>Нет данных</div>
              ) : (
                <div 
                  className="dbiea-scroll-container" 
                  style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}
                >
                  <div className="dbiea-top5-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {fullGroupedDebt.map((item, idx) => {
                      const percentage = maxDebt > 0 ? (item.totalDebt / maxDebt) * 100 : 0;
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 800, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={item.name}>
                              {item.name}
                            </span>
                            <span style={{ color: '#475569', fontWeight: 600 }}>
                              {formatCompactMoney(item.totalDebt)} <span style={{ color: '#cbd5e1', fontWeight: 400 }}>({item.value} дог.)</span>
                            </span>
                          </div>
                          {/* Minimalist Thin Progress Bar */}
                          <div style={{ width: '100%', height: '5px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              background: item.totalDebt > 0 ? 'linear-gradient(90deg, #1e3a8a, #3b82f6)' : '#cbd5e1',
                              borderRadius: '9999px',
                              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            {activeCategoryDetails ? (
              <div className="active-category-details-card animate-fade-in" style={{
                padding: '0.85rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 850, fontSize: '0.82rem' }}>
                    Выбрано: {activeCategoryDetails.name}
                  </h4>
                  <button 
                    onClick={() => setActiveCategoryDetails(null)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800 }}
                  >
                    Сбросить
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                  <div style={{ background: '#ffffff', padding: '0.35rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Договоры</span>
                    <strong style={{ fontSize: '0.8rem', color: '#1e293b' }}>{activeCategoryDetails.value} шт.</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.35rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>В месяц</span>
                    <strong style={{ fontSize: '0.8rem', color: '#2563eb' }}>{formatCompactMoney(activeCategoryDetails.monthlyPayment)}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.35rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Долг</span>
                    <strong style={{ fontSize: '0.8rem', color: '#1b3a2e' }}>{formatCompactMoney(activeCategoryDetails.totalDebt)}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '0.35rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Пеня</span>
                    <strong style={{ fontSize: '0.8rem', color: activeCategoryDetails.totalPenalty > 0 ? '#dc2626' : '#10b981' }}>
                      {formatMoney(activeCategoryDetails.totalPenalty)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              onClick={handleScrollToTable}
              style={{
                width: '100%',
                padding: '0.65rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1e3a8a'; e.currentTarget.style.color = '#1e3a8a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
            >
              <ListCollapse size={14} />
              Показать все категории в таблице
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="dbiea-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dbiea-card">
          <div className="dbiea-card-header">
            <h3 className="dbiea-card-title">Статистика по срокам выкупа</h3>
          </div>
          <div className="dbiea-chart-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '270px' }}>
            {analytics.termsData.length === 0 ? (
              <div className="dbiea-empty-chart">Нет данных</div>
            ) : (
              <>
                <div style={{ height: '170px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.termsData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                        {analytics.termsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pie-legends-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', width: '100%', padding: '0 0.5rem' }}>
                  {analytics.termsData.map((item, idx) => (
                    <div key={idx} className="pie-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
                      <span className="pie-color-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="pie-legend-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}: <strong>{item.value} шт.</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="dbiea-card">
          <div className="dbiea-card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className="dbiea-card-title flex-align">
                <TrendingUp size={18} className="text-green" />
                Временной анализ оформления выкупа
              </h3>
              {analytics.peakYear.year !== "—" && (
                <span className="dbiea-badge-pill">
                  Пик: <strong>{analytics.peakYear.year} г.</strong> ({analytics.peakYear.count} дог.)
                </span>
              )}
            </div>
          </div>
          <div className="dbiea-chart-wrapper" style={{ height: '270px' }}>
            {analytics.yearlyData.length === 0 ? (
              <div className="dbiea-empty-chart">Нет данных по годам</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.yearlyData} margin={{ top: 15, right: 15, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d5a47" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2d5a47" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="year" stroke="#64748b" />
                  <YAxis allowDecimals={false} stroke="#64748b" />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="chart-custom-tooltip" style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '0.8rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '0.8rem' }}>
                          <p className="tooltip-year"><strong>{data.year} год</strong></p>
                          <p className="tooltip-value">Договоров: <strong>{data.agreements}</strong></p>
                          <p className="tooltip-lead-pos" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem' }}>
                            Чаще оформляли: <br /><span style={{ color: '#2d5a47', fontWeight: 700 }}>{data.topPosition}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Area type="monotone" dataKey="agreements" name="Количество оформлений" stroke="#2d5a47" strokeWidth={3} fill="url(#areaGradient)" dot={{ r: 5, fill: "#2d5a47" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Detailed categories values details table */}
      <div id="dbiea-detailed-values-table" className="dbiea-card span-2" style={{ marginBottom: '1.5rem' }}>
        <div className="dbiea-card-header">
          <h3 className="dbiea-card-title font-bold">Финансовые показатели в разрезе категорий ({groupDim === "position" ? "должности" : groupDim === "complex" ? "ЖК" : "районы"})</h3>
        </div>
        <div className="dbiea-card-list-scroller" style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {analytics.positionList.length === 0 ? (
            <div className="dbiea-empty-list">Нет данных для вывода</div>
          ) : (
            <table className="dbiea-mini-table table-striped">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Договоров</th>
                  <th>Оплата в месяц</th>
                  <th>Остаток долга</th>
                </tr>
              </thead>
              <tbody>
                {analytics.positionList.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.value} шт.</td>
                    <td>{formatMoney(item.monthlyPayment)}</td>
                    <td className="text-green-strong font-semibold" style={{ color: '#15803d', fontWeight: 700 }}>{formatMoney(item.totalDebt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom Section: Payment Control & Delinquencies */}
      <div className="dbiea-card span-2">
        <div className="dbiea-card-header">
          <h3 className="dbiea-card-title flex-align text-red">
            <ShieldAlert size={18} />
            Контроль оплаты и задолженностей
          </h3>
        </div>
        <div className="dbiea-horizontal-scroller" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {analytics.topDebtors.length === 0 ? (
            <div className="dbiea-empty-list">Отлично! Все платежи погашены</div>
          ) : (
            <table className="dbiea-mini-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>ЖК</th>
                  <th>Платеж в месяц</th>
                  <th>Остаток долга</th>
                  <th>Пеня</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topDebtors.map((item, idx) => (
                  <tr key={idx} className={item.penalty > 0 ? "highlight-overdue" : ""}>
                    <td><strong>{item.fio}</strong></td>
                    <td>{item.complex}</td>
                    <td>{formatMoney(item.monthly)}</td>
                    <td className="font-semibold">{formatMoney(item.debt)}</td>
                    <td>
                      <span className={item.penalty > 0 ? "debt-red-badge" : "text-slate"}>
                        {item.penalty > 0 ? formatMoney(item.penalty) : "0 ₸"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Button styles for switcher tabs
const activeTabStyle = {
  background: "#1b3a2e",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "0.45rem 1rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(27, 58, 46, 0.15)"
};

const inactiveTabStyle = {
  background: "#ffffff",
  color: "#475569",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "0.45rem 1rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer"
};

// Fallback component
export default function DbieaFinancialDashboard({ rentData = { headers: [], rows: [] }, purchaseData = { headers: [], rows: [] } }) {
  return (
    <div className="dbiea-financial-dashboard-fallback">
      <h2 style={{ color: '#1b3a2e', marginBottom: '1.5rem', fontWeight: 800 }}>Аналитический дашборд ДБиЭА</h2>
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', borderBottom: '2px solid #2d5a47', paddingBottom: '0.5rem', color: '#2d5a47' }}>Раздел: Аренда</h3>
        <DbieaRentDashboard headers={rentData.headers} rows={rentData.rows} />
      </div>
      <div>
        <h3 style={{ fontSize: '1.25rem', borderBottom: '2px solid #2d5a47', paddingBottom: '0.5rem', color: '#2d5a47' }}>Раздел: Выкупленный / Рассрочка</h3>
        <DbieaPurchaseDashboard headers={purchaseData.headers} rows={purchaseData.rows} />
      </div>
    </div>
  );
}
