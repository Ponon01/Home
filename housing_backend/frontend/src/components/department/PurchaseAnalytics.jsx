// Обновлено для ДБиЭА (Выкупленные)
import { useMemo, useState } from "react";
import RecordDetailDrawer, { ClickableAddressCell } from "./RecordDetailDrawer";
import ExportExcelButton from "./ExportExcelButton";
import { updateBudgetPurchaseRow } from "../../api/budgetExcel";
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

export default function PurchaseAnalytics({ rows = [], headers = [], onRowUpdated }) {
  const [filterCat, setFilterCat] = useState("all");
  const [drawerRow, setDrawerRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dataHeaders = useMemo(() => headers.filter((h) => h !== "_id" && !h.startsWith("col_0")), [headers]);

  const initialCostKey = findHeader(dataHeaders, /первоначальн/i) || "Первоначальная стоимость";
  const marketPriceKey = findHeader(dataHeaders, /рыночн/i) || "Рыночная стоимость";
  const paidKey = findHeader(dataHeaders, /выплачен/i) || "Всего выплачено";
  const debtKey = findHeader(dataHeaders, /остаток|долг/i) || "Остаток долга";
  const conditionKey = findHeader(dataHeaders, /услов|рассроч|выкуп/i) || "Условия приобретения";
  const penaltyKey = findHeader(dataHeaders, /пеня/i) || "Пеня";
  const addressKey = findHeader(dataHeaders, /^адрес$/i) || findHeader(dataHeaders, /адрес/i);
  const fioKey = findHeader(dataHeaders, /фио/i);

  const drawerBlocks = useMemo(() => buildBudgetDrawerBlocks(dataHeaders), [dataHeaders]);
  const exportColumns = useMemo(() => dataHeaders.map((h) => ({ key: h, label: h })), [dataHeaders]);

  const { totalInitial, totalMarket, totalPaid, totalDebt, sortedRows } = useMemo(() => {
    let initial = 0;
    let market = 0;
    let paid = 0;
    let debt = 0;

    const rowData = [];

    rows.forEach((row) => {
      const condition = String(row[conditionKey] || "").toLowerCase();
      
      let cat = "other";
      if (condition.includes("100%")) cat = "100";
      else if (condition.includes("5") || condition.includes("пять")) cat = "5";
      else if (condition.includes("10") || condition.includes("десять")) cat = "10";
      else if (condition.includes("15") || condition.includes("пятнадцать")) cat = "15";

      if (filterCat !== "all" && filterCat !== cat) return;

      const iCost = parseNum(row[initialCostKey]);
      const mCost = parseNum(row[marketPriceKey]);
      const p = parseNum(row[paidKey]);
      const d = parseNum(row[debtKey]);
      const pen = parseNum(row[penaltyKey]);

      initial += iCost;
      market += mCost;
      paid += p;
      debt += d;

      let flag = "none";
      const overdueKey = dataHeaders.find(h => /просроч/i.test(h));
      const overdue = overdueKey ? parseNum(row[overdueKey]) : 0;
      
      if (overdue > 0 || pen > 0) flag = "overdue";

      rowData.push({ ...row, _flag: flag, _overdue: overdue || pen });
    });

    rowData.sort((a, b) => {
      if (a._flag === "overdue" && b._flag !== "overdue") return -1;
      if (a._flag !== "overdue" && b._flag === "overdue") return 1;
      if (a._flag === "overdue" && b._flag === "overdue") return b._overdue - a._overdue;
      return 0;
    });

    return {
      totalInitial: initial,
      totalMarket: market,
      totalPaid: paid,
      totalDebt: debt,
      sortedRows: rowData,
    };
  }, [rows, filterCat, initialCostKey, marketPriceKey, paidKey, debtKey, conditionKey, penaltyKey, dataHeaders]);

  const handleSave = async (draft) => {
    if (!drawerRow?._id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {};
      dataHeaders.forEach((h) => {
        payload[h] = draft[h] ?? null;
      });
      const result = await updateBudgetPurchaseRow(drawerRow._id, payload);
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
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Общая первоначальная стоимость</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalInitial.toLocaleString('ru-RU')} ₸</p>
        </div>
        <div className="dashboard-metric-card" style={{ flex: 1, minWidth: '200px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Общая рыночная стоимость</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalMarket.toLocaleString('ru-RU')} ₸</p>
        </div>
        <div className="dashboard-metric-card" style={{ flex: 1, minWidth: '200px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Всего выплачено</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalPaid.toLocaleString('ru-RU')} ₸</p>
        </div>
        <div className="dashboard-metric-card" style={{ flex: 1, minWidth: '200px', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>Остаток долга</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalDebt.toLocaleString('ru-RU')} ₸</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>Фильтр по категории: </label>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="all">Все</option>
            <option value="100">100% выкуп</option>
            <option value="5">Рассрочка 5 лет</option>
            <option value="10">Рассрочка 10 лет</option>
            <option value="15">Рассрочка 15 лет</option>
          </select>
        </div>
        <ExportExcelButton
          filename="ДБиЭА_Выкупленные_Аналитика.xlsx"
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
            {sortedRows.length === 0 ? (
              <tr><td colSpan={dataHeaders.length}>Нет данных</td></tr>
            ) : (
              sortedRows.map((row, i) => {
                let bg = "inherit";
                if (row._flag === "overdue") bg = "#ffe6e6"; // light-red
                
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
              })
            )}
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
