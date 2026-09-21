import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import BudgetExcelTable from "../components/department/BudgetExcelTable";
import { DbieaRentDashboard, DbieaPurchaseDashboard } from "../components/department/DbieaFinancialDashboard";
import {
  getBudgetRentExcel,
  getBudgetPurchaseExcel,
  uploadBudgetExcel,
} from "../api/budgetExcel";
import { getHousingRecords } from "../api/housingDepartment";
import { Upload, FileSpreadsheet, RefreshCw } from "lucide-react";

export default function DepartmentBudgetPage() {
  const [activeTab, setActiveTab] = useState("rent"); // 'rent' or 'purchase'

  const [rentData, setRentData] = useState({ headers: [], rows: [] });
  const [rentLoading, setRentLoading] = useState(false);
  const [rentError, setRentError] = useState(null);

  const [purchaseData, setPurchaseData] = useState({ headers: [], rows: [] });
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

  const [housingRows, setHousingRows] = useState([]);
  const [housingLoading, setHousingLoading] = useState(false);

  const [rentUploadFile, setRentUploadFile] = useState(null);
  const [rentUploading, setRentUploading] = useState(false);
  const [rentUploadError, setRentUploadError] = useState("");

  const [purchaseUploadFile, setPurchaseUploadFile] = useState(null);
  const [purchaseUploading, setPurchaseUploading] = useState(false);
  const [purchaseUploadError, setPurchaseUploadError] = useState("");
  const [rentPositionFilter, setRentPositionFilter] = useState("");

  const loadRent = (silent = false) => {
    if (!silent) setRentLoading(true);
    setRentError(null);
    getBudgetRentExcel()
      .then((d) => setRentData(d))
      .catch((e) => setRentError(e?.response?.data?.detail || e.message || "Ошибка загрузки данных аренды"))
      .finally(() => {
        if (!silent) setRentLoading(false);
      });
  };

  const loadPurchase = (silent = false) => {
    if (!silent) setPurchaseLoading(true);
    setPurchaseError(null);
    getBudgetPurchaseExcel()
      .then((d) => setPurchaseData(d))
      .catch((e) => setPurchaseError(e?.response?.data?.detail || e.message || "Ошибка загрузки данных выкупленного жилья"))
      .finally(() => {
        if (!silent) setPurchaseLoading(false);
      });
  };

  const loadHousing = (silent = false) => {
    if (!silent) setHousingLoading(true);
    getHousingRecords()
      .then((data) => setHousingRows(data.rows || []))
      .catch((e) => console.error("Error loading housing rows:", e))
      .finally(() => {
        if (!silent) setHousingLoading(false);
      });
  };

  useEffect(() => {
    loadRent();
    loadPurchase();
    loadHousing();
  }, []);

  const handleRentUpload = async () => {
    if (!rentUploadFile) {
      setRentUploadError("Выберите файл для загрузки");
      return;
    }
    setRentUploading(true);
    setRentUploadError("");
    try {
      const data = await uploadBudgetExcel(rentUploadFile, "rent");
      setRentData(data);
      setRentUploadFile(null);
      const input = document.getElementById("rent-upload-input");
      if (input) input.value = "";
    } catch (err) {
      setRentUploadError(err?.response?.data?.detail || err.message || "Ошибка загрузки файла аренды");
    } finally {
      setRentUploading(false);
    }
  };

  const handlePurchaseUpload = async () => {
    if (!purchaseUploadFile) {
      setPurchaseUploadError("Выберите файл для загрузки");
      return;
    }
    setPurchaseUploading(true);
    setPurchaseUploadError("");
    try {
      const data = await uploadBudgetExcel(purchaseUploadFile, "purchase");
      setPurchaseData(data);
      setPurchaseUploadFile(null);
      const input = document.getElementById("purchase-upload-input");
      if (input) input.value = "";
    } catch (err) {
      setPurchaseUploadError(err?.response?.data?.detail || err.message || "Ошибка загрузки файла выкупленного жилья");
    } finally {
      setPurchaseUploading(false);
    }
  };

  // --- Dynamic Mapping / Join FIO -> Position ---
  const normalizeFio = (val) => {
    if (!val) return "";
    try {
      return String(val)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "")
        .trim();
    } catch (e) {
      return String(val)
        .toLowerCase()
        .replace(/[\s\.,\-_'"()]/g, "")
        .trim();
    }
  };

  const housingMap = useMemo(() => {
    const map = new Map();
    housingRows.forEach((item) => {
      if (item.fio) {
        const norm = normalizeFio(item.fio);
        if (norm) {
          map.set(norm, item.position || "");
        }
      }
    });
    return map;
  }, [housingRows]);

  const anyKeyMatch = (header, keywords) => {
    const hLower = String(header || "").toLowerCase();
    return keywords.some(k => hLower.includes(k));
  };

  const findHeader = (headersList, keywords) => {
    return headersList.find((h) => anyKeyMatch(h, keywords)) || "";
  };

  const enrichDataset = (dataset) => {
    if (!dataset || !dataset.rows || dataset.rows.length === 0) {
      return dataset;
    }
    const headers = [...(dataset.headers || [])];
    const fioKey = findHeader(headers, ["фио", "fio", "сотрудник", "name"]);
    const hasPosition = headers.some(h => /должност|position|role/i.test(h));
    
    // Append 'Должность' to headers if not exists
    if (!hasPosition) {
      headers.push("Должность");
    }

    const positionKey = findHeader(headers, ["должност", "position", "role"]);

    const enrichedRows = dataset.rows.map((row) => {
      const fioVal = fioKey ? row[fioKey] : "";
      const normFio = normalizeFio(fioVal);
      
      let position = "";
      if (housingMap.has(normFio)) {
        position = housingMap.get(normFio);
      }
      
      if (!position) {
        position = "Должность не найдена в базе ДЖСВ";
      }

      return {
        ...row,
        [positionKey]: position
      };
    });

    return {
      headers,
      rows: enrichedRows
    };
  };

  const enrichedRentData = useMemo(() => enrichDataset(rentData), [rentData, housingMap]);
  const enrichedPurchaseData = useMemo(() => enrichDataset(purchaseData), [purchaseData, housingMap]);

  const displayedRentRows = useMemo(() => {
    if (!rentPositionFilter) return enrichedRentData.rows;
    return enrichedRentData.rows.filter((row) => {
      const positionKey = findHeader(enrichedRentData.headers, ["должност", "position", "role"]);
      const posVal = String(row[positionKey] || "").trim();
      return posVal === rentPositionFilter;
    });
  }, [enrichedRentData, rentPositionFilter]);

  const currentLoading = activeTab === "rent" ? rentLoading : purchaseLoading;
  const currentError = activeTab === "rent" ? rentError : purchaseError;

  return (
    <main className="container complex-page-container banking-dashboard">
      <AppHeader />
      
      <div className="dept-header-row">
        <nav className="dept-breadcrumb muted">
          <Link to="/departments/housing">ДЖСВ</Link>
          {" / "}
          <span>ДБиЭА</span>
        </nav>
        <button 
          className="dbiea-refresh-btn"
          onClick={() => {
            loadHousing(true);
            if (activeTab === "rent") loadRent();
            else loadPurchase();
          }}
          title="Обновить данные с сервера"
        >
          <RefreshCw size={15} />
          Обновить
        </button>
      </div>

      <div className="dbiea-dashboard-intro">
        <h1>Департамент бюджетного и экономического анализа</h1>
        <p className="muted">
          Аналитическая панель financial контроля, взаиморасчетов, аренды и выкупа жилья сотрудниками.
        </p>
      </div>

      {/* Main Sections Switcher (Tabs) */}
      <div className="dbiea-tab-headers">
        <button
          className={`dbiea-tab-trigger ${activeTab === "rent" ? "active" : ""}`}
          onClick={() => setActiveTab("rent")}
        >
          <FileSpreadsheet size={18} />
          <span>Аренда служебного жилья</span>
        </button>
        <button
          className={`dbiea-tab-trigger ${activeTab === "purchase" ? "active" : ""}`}
          onClick={() => setActiveTab("purchase")}
        >
          <FileSpreadsheet size={18} />
          <span>Выкупленный / Рассрочка</span>
        </button>
      </div>

      {currentLoading ? (
        <Loading />
      ) : currentError ? (
        <ErrorMessage message={currentError} />
      ) : (
        <div className="dbiea-tab-content">
          {activeTab === "rent" && (
            <div className="dbiea-section-panel animate-fade-in">
              
              <DbieaRentDashboard 
                headers={enrichedRentData.headers} 
                rows={enrichedRentData.rows} 
              />

              {/* Excel File Importer for Rent */}
              <div className="dbiea-upload-card">
                <div className="dbiea-upload-info">
                  <div className="dbiea-upload-icon-box">
                    <Upload size={22} />
                  </div>
                  <div>
                    <h3>Импорт Excel-файла (Раздел: Аренда)</h3>
                    <p className="muted">Загрузите актуальный файл Excel "Аренда.xlsx" для обновления базы данных и аналитики.</p>
                  </div>
                </div>
                <div className="dbiea-upload-actions">
                  <input
                    id="rent-upload-input"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(e) => setRentUploadFile(e.target.files[0])}
                  />
                  <button
                    className="dbiea-btn-action"
                    onClick={handleRentUpload}
                    disabled={rentUploading || !rentUploadFile}
                  >
                    {rentUploading ? "Загрузка..." : "Импортировать Аренду"}
                  </button>
                </div>
                {rentUploadError && <div className="dbiea-upload-error">{rentUploadError}</div>}
              </div>

              {/* Rent Interactive Table */}
              <div className="dbiea-table-section">
                <div className="dbiea-table-section-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2>Исходный реестр: Аренда служебного жилья</h2>
                    <span className="dbiea-table-badge">Показано: {displayedRentRows.length} из {rentData.rows.length}</span>
                  </div>
                  {rentPositionFilter && (
                    <div className="dbiea-active-filter-badge" style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#eff5f2',
                      border: '1px solid rgba(45, 70, 62, 0.18)',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      color: '#1b3a2e',
                      fontWeight: 600
                    }}>
                      <span>Фильтр по должности: <strong>{rentPositionFilter}</strong></span>
                      <button 
                        onClick={() => setRentPositionFilter("")}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#dc2626',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <BudgetExcelTable
                  headers={enrichedRentData.headers}
                  rows={displayedRentRows}
                  source="rent"
                  title=""
                  onDatasetChange={(newData) => setRentData(newData)}
                  onRowUpdated={(rowId, updatedRow) => {
                    setRentData((prev) => ({
                      ...prev,
                      rows: prev.rows.map((r) => (r._id === rowId ? updatedRow : r)),
                    }));
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "purchase" && (
            <div className="dbiea-section-panel animate-fade-in">

              {/* Purchase Advanced Analytics */}
              <DbieaPurchaseDashboard headers={enrichedPurchaseData.headers} rows={enrichedPurchaseData.rows} />

              {/* Excel File Importer for Purchase */}
              <div className="dbiea-upload-card">
                <div className="dbiea-upload-info">
                  <div className="dbiea-upload-icon-box">
                    <Upload size={22} />
                  </div>
                  <div>
                    <h3>Импорт Excel-файла (Раздел: Выкупленные)</h3>
                    <p className="muted">Загрузите актуальный файл Excel "рассрочка.xlsx" для обновления базы данных и аналитики.</p>
                  </div>
                </div>
                <div className="dbiea-upload-actions">
                  <input
                    id="purchase-upload-input"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(e) => setPurchaseUploadFile(e.target.files[0])}
                  />
                  <button
                    className="dbiea-btn-action"
                    onClick={handlePurchaseUpload}
                    disabled={purchaseUploading || !purchaseUploadFile}
                  >
                    {purchaseUploading ? "Загрузка..." : "Импортировать Выкуп"}
                  </button>
                </div>
                {purchaseUploadError && <div className="dbiea-upload-error">{purchaseUploadError}</div>}
              </div>

              {/* Purchase Interactive Table */}
              <div className="dbiea-table-section">
                <div className="dbiea-table-section-header">
                  <h2>Исходный реестр: Выкупленные квартиры / Рассрочка</h2>
                  <span className="dbiea-table-badge">Всего записей: {purchaseData.rows.length}</span>
                </div>
                <BudgetExcelTable
                  headers={enrichedPurchaseData.headers}
                  rows={enrichedPurchaseData.rows}
                  source="purchase"
                  title=""
                  onDatasetChange={(newData) => setPurchaseData(newData)}
                  onRowUpdated={(rowId, updatedRow) => {
                    setPurchaseData((prev) => ({
                      ...prev,
                      rows: prev.rows.map((r) => (r._id === rowId ? updatedRow : r)),
                    }));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Styled Embed for premium visuals */}
      <style dangerouslySetInnerHTML={{ __html: `
        .banking-dashboard {
          font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          padding-bottom: 5rem;
        }
        .dept-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .dbiea-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #ffffff;
          border: 1px solid rgba(45, 70, 62, 0.18);
          color: #2d5a47;
          border-radius: 8px;
          padding: 0.5rem 0.9rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .dbiea-refresh-btn:hover {
          background: #eff5f2;
          border-color: #2d5a47;
        }
        .dbiea-dashboard-intro {
          margin-bottom: 2rem;
        }
        .dbiea-dashboard-intro h1 {
          font-size: 2.1rem;
          font-weight: 800;
          color: #111827;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
        }
        .dbiea-dashboard-intro p {
          margin: 0;
          font-size: 1.05rem;
        }
        
        /* Premium Tabs Switcher */
        .dbiea-tab-headers {
          display: flex;
          gap: 1rem;
          background: #f1f5f9;
          padding: 0.4rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          width: fit-content;
        }
        .dbiea-tab-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          border: none;
          background: transparent;
          color: #475569;
          padding: 0.75rem 1.4rem;
          font-size: 0.95rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s ease-in-out;
        }
        .dbiea-tab-trigger:hover {
          color: #1e293b;
          background: rgba(255,255,255,0.4);
        }
        .dbiea-tab-trigger.active {
          background: #1b3a2e;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(27, 58, 46, 0.15);
        }

        /* Metrics grid */
        .dbiea-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .dbiea-kpi-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(45, 70, 62, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.1rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .dbiea-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(27, 58, 46, 0.06);
        }
        .dbiea-kpi-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff5f2;
          color: #2d5a47;
          flex-shrink: 0;
        }
        .dbiea-kpi-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .dbiea-kpi-label {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          font-weight: 700;
        }
        .dbiea-kpi-value {
          font-size: 1.55rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;
        }
        .dbiea-kpi-unit {
          font-size: 0.95rem;
          font-weight: 600;
          color: #64748b;
        }
        
        .dbiea-kpi-card.accent-red .dbiea-kpi-icon { background: #fef2f2; color: #dc2626; }
        .dbiea-kpi-card.accent-red .warning-text { color: #dc2626; }
        .dbiea-kpi-card.accent-orange .dbiea-kpi-icon { background: #fff7ed; color: #ea580c; }
        .dbiea-kpi-card.accent-orange .warning-text { color: #ea580c; }
        .dbiea-kpi-card.accent-blue .dbiea-kpi-icon { background: #eff6ff; color: #2563eb; }
        .dbiea-kpi-card.accent-emerald .dbiea-kpi-icon { background: #ecfdf5; color: #059669; }
        .dbiea-kpi-card.accent-emerald .dbiea-kpi-value { color: #059669; }

        /* Grid */
        .dbiea-grid-2col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        @media (max-width: 992px) {
          .dbiea-grid-2col {
            grid-template-columns: 1fr;
          }
          .dbiea-card.span-2 {
            grid-column: span 1 !important;
          }
        }
        
        .dbiea-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(45, 70, 62, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .dbiea-card.span-2 {
          grid-column: span 2;
        }
        .dbiea-card-header {
          padding: 1.1rem 1.4rem;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .bg-yellow-soft {
          background-color: #fffbeb;
        }
        .dbiea-card-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .flex-align {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .text-amber { color: #ea580c; }
        .text-green { color: #16a34a; }
        .text-red { color: #dc2626; }
        
        .dbiea-chart-wrapper {
          padding: 1.25rem;
          height: 270px;
          position: relative;
        }
        .dbiea-empty-chart, .dbiea-empty-list {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          font-size: 0.9rem;
          text-align: center;
          padding: 2rem;
        }
        
        /* Lists & tables within cards */
        .dbiea-list-container {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 270px;
          overflow-y: auto;
        }
        .dbiea-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1.1rem;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          transition: transform 0.15s ease;
        }
        .dbiea-list-item:hover {
          transform: translateX(3px);
        }
        .dbiea-list-item.warning-border {
          border-left: 4px solid #f59e0b;
        }
        .dbiea-list-main {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .dbiea-list-title {
          color: #1e293b;
          font-size: 0.9rem;
          font-weight: 700;
        }
        .dbiea-list-sub {
          font-size: 0.8rem;
          color: #64748b;
        }
        .dbiea-list-badge {
          font-size: 0.78rem;
          font-weight: 700;
          padding: 0.3rem 0.6rem;
          border-radius: 8px;
        }
        .dbiea-list-badge.warning {
          background: #fff7ed;
          color: #ea580c;
          border: 1px solid rgba(234, 88, 12, 0.15);
        }
        
        /* Mini Tables */
        .dbiea-horizontal-scroller {
          overflow-x: auto;
          width: 100%;
          padding: 0.5rem;
        }
        .dbiea-mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.83rem;
          text-align: left;
        }
        .dbiea-mini-table th, .dbiea-mini-table td {
          padding: 0.75rem 1.1rem;
          border-bottom: 1px solid #f1f5f9;
          white-space: nowrap;
        }
        .dbiea-mini-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
        }
        .dbiea-mini-table tr.danger-row td {
          background: #fff5f5;
        }
        .dbiea-mini-table tr.highlight-overdue td {
          background: #fffbeb;
        }
        .dbiea-status-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.55rem;
          border-radius: 6px;
        }
        .dbiea-status-badge.expired { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.12); }
        .dbiea-status-badge.soon { background: #fffbeb; color: #ea580c; border: 1px solid rgba(234,88,12,0.12); }
        .debt-red-badge { background: #fef2f2; color: #dc2626; font-weight: 700; padding: 0.2rem 0.4rem; border-radius: 4px; }
        
        .pie-legends-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
          padding: 0 1rem 1rem;
          width: 100%;
        }
        .pie-legend-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          color: #475569;
        }
        .pie-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Time Series Custom Tooltip */
        .chart-custom-tooltip {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 0.8rem;
          border-radius: 8px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.06);
          font-size: 0.82rem;
        }
        .chart-custom-tooltip p { margin: 0 0 0.25rem 0; }
        .tooltip-lead-pos { font-size: 0.75rem; color: #64748b; margin-top: 0.4rem !important; }
        .text-highlight { color: #2d5a47; font-weight: 700; }
        .dbiea-badge-pill {
          background: #eff5f2;
          color: #2d5a47;
          font-size: 0.8rem;
          padding: 0.25rem 0.65rem;
          border-radius: 8px;
          border: 1px solid rgba(45,70,62,0.12);
        }

        /* Upload Area styling */
        .dbiea-upload-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(45, 70, 62, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          padding: 1.5rem;
          margin-bottom: 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.5rem;
          border-left: 4px solid #1b3a2e;
        }
        .dbiea-upload-info {
          display: flex;
          align-items: center;
          gap: 1.1rem;
        }
        .dbiea-upload-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #eff5f2;
          color: #2d5a47;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dbiea-upload-info h3 {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 0.2rem 0;
        }
        .dbiea-upload-info p {
          margin: 0;
          font-size: 0.88rem;
        }
        .dbiea-upload-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .dbiea-upload-actions input[type="file"] {
          font-size: 0.82rem;
          color: #475569;
        }
        .dbiea-btn-action {
          background: #1b3a2e;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 0.65rem 1.4rem;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 10px rgba(27, 58, 46, 0.12);
        }
        .dbiea-btn-action:hover {
          background: #2d5a47;
          transform: translateY(-1px);
        }
        .dbiea-btn-action:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .dbiea-upload-error {
          width: 100%;
          color: #dc2626;
          font-size: 0.82rem;
          font-weight: 600;
          margin-top: 0.5rem;
        }

        /* Main table section */
        .dbiea-table-section {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(45, 70, 62, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          padding: 1.5rem;
        }
        .dbiea-table-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 0.85rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
          gap: 8px;
        }
        .dbiea-table-section-header h2 {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .dbiea-table-badge {
          background: #f1f5f9;
          color: #475569;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </main>
  );
}
