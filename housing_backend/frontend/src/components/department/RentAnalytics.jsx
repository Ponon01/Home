// Обновлено для ДБиЭА (Аренда)
import { useMemo, useState } from "react";
import RecordDetailDrawer, { ClickableAddressCell } from "./RecordDetailDrawer";
import ExportExcelButton from "./ExportExcelButton";
import { updateBudgetRentRow } from "../../api/budgetExcel";
import { buildBudgetDrawerBlocks } from "../../config/drawerFieldBlocks";
import { findHeader } from "../../config/adminFilters";

function parseNum(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function buildDraft(row, headers) {
  const draft = {};
  headers.forEach((h) => {
    if (h !== "_id") draft[h] = row[h] ?? "";
  });
  return draft;
}

export default function RentAnalytics({ rows = [], headers = [], onRowUpdated }) {
  const [drawerRow, setDrawerRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dataHeaders = useMemo(() => headers.filter((h) => h !== "_id" && !h.startsWith("col_0")), [headers]);

  const accruedKey = findHeader(dataHeaders, /начислен/i) || "Всего начислено";
  const withheldKey = findHeader(dataHeaders, /удержан/i) || "Всего удержано";
  const debtKey = findHeader(dataHeaders, /долг/i) || "Общий долг";
  const penaltyKey = findHeader(dataHeaders, /пеня/i) || "Пеня";
  const statusKey = findHeader(dataHeaders, /статус/i) || "Статус";
  const addressKey = findHeader(dataHeaders, /^адрес$/i) || findHeader(dataHeaders, /адрес/i);
  const fioKey = findHeader(dataHeaders, /фио/i);

  const drawerBlocks = useMemo(() => buildBudgetDrawerBlocks(dataHeaders), [dataHeaders]);
  const exportColumns = useMemo(() => dataHeaders.map((h) => ({ key: h, label: h })), [dataHeaders]);

  const { totalAccrued, totalWithheld, totalDebt, penaltyCount, dormCount, sortedRows } = useMemo(() => {
    let accrued = 0;
    let withheld = 0;
    let debt = 0;
    let penalty = 0;
    let dorms = 0;

    const rowData = [];

    rows.forEach((row) => {
      const a = parseNum(row[accruedKey]);
      const w = parseNum(row[withheldKey]);
      const d = parseNum(row[debtKey]);
      const p = parseNum(row[penaltyKey]);

      accrued += a;
      withheld += w;
      debt += d;
      if (p > 0) penalty++;

      const status = String(row[statusKey] || "").toLowerCase();
      if (status.includes("общежити")) {
        dorms++;
      }

      let flag = "none";
      if (d > 0) flag = "debt";
      else if (p > 0) flag = "penalty";

      rowData.push({ ...row, _flag: flag, _debt: d, _penalty: p });
    });

    rowData.sort((a, b) => {
      if (a._flag === "debt" && b._flag !== "debt") return -1;
      if (a._flag !== "debt" && b._flag === "debt") return 1;
      if (a._flag === "debt" && b._flag === "debt") return b._debt - a._debt;

      if (a._flag === "penalty" && b._flag !== "penalty") return -1;
      if (a._flag !== "penalty" && b._flag === "penalty") return 1;
      
      return 0;
    });

    return {
      totalAccrued: accrued,
      totalWithheld: withheld,
      totalDebt: debt,
      penaltyCount: penalty,
      dormCount: dorms,
      sortedRows: rowData,
    };
  }, [rows, accruedKey, withheldKey, debtKey, penaltyKey, statusKey]);

  const handleSave = async (draft) => {
    if (!drawerRow?._id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {};
      dataHeaders.forEach((h) => {
        payload[h] = draft[h] ?? null;
      });
      const result = await updateBudgetRentRow(drawerRow._id, payload);
      onRowUpdated?.(drawerRow._id, { ...result.data, _id: result.id });
      setDrawerRow(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="analytics-panel">
      <div className="dashboard-metrics" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div className="dashboard-metric-card" style={{ flex: 1, minWidth: '200px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Всего начислено</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalAccrued.toLocaleString('ru-RU')} ₸</p>
        </div>
        <div className="dashboard-metric-card" style={{ flex: 1, minWidth: '200px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Удержано</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalWithheld.toLocaleString('ru-RU')} ₸</p>
        </div>
        <div className="dashboard-metric-card" style={{ flex: 1, minWidth: '200px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Общий долг</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: totalDebt > 0 ? '#dc3545' : 'inherit' }}>{totalDebt.toLocaleString('ru-RU')} ₸</p>
        </div>
      </div>

      <div className="dashboard-metrics" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="dashboard-metric-card" style={{ padding: '1rem', background: '#e2e3e5', borderRadius: '8px', flex: 1, marginRight: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Блок "Переселение" (Общежития)</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem' }}>Количество квартир в статусе общежития: <strong>{dormCount}</strong></p>
        </div>
        <ExportExcelButton
          filename="ДБиЭА_Аренда_Аналитика.xlsx"
          columns={exportColumns}
          rows={sortedRows}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="budget-excel-table">
          <thead>
            <tr>
              {dataHeaders.map((h) => (
                <th key={h} className="budget-excel-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              let bg = "inherit";
              if (row._flag === "debt") bg = "#ffe6e6"; // light-red
              else if (row._flag === "penalty") bg = "#fffccc"; // light-yellow
              
              return (
                <tr key={row._id || i} style={{ background: bg }}>
                  {dataHeaders.map((h) => (
                    <td key={h} className="budget-excel-td">
                      {h === addressKey ? (
                        <ClickableAddressCell
                          value={row[h] != null ? String(row[h]) : ""}
                          onClick={() => {
                            setError("");
                            setDrawerRow(row);
                          }}
                        />
                      ) : row[h] != null ? (
                        String(row[h])
                      ) : (
                        ""
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <RecordDetailDrawer
        open={Boolean(drawerRow)}
        title={addressKey && drawerRow?.[addressKey] ? String(drawerRow[addressKey]) : "Детальная карточка"}
        subtitle={fioKey && drawerRow?.[fioKey] ? String(drawerRow[fioKey]) : ""}
        blocks={drawerBlocks}
        initialValues={drawerRow ? buildDraft(drawerRow, dataHeaders) : {}}
        saving={saving}
        error={error}
        onClose={() => setDrawerRow(null)}
        onSave={handleSave}
      />
    </div>
  );
}
