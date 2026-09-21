import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import {
  addBudgetPurchaseColumn,
  addBudgetRentColumn,
  updateBudgetPurchaseRow,
  updateBudgetRentRow,
} from "../../api/budgetExcel";
import {
  ACQUISITION_CONDITION_OPTIONS,
  HOUSING_STATUS_OPTIONS,
  findHeader,
  matchesAcquisitionCondition,
} from "../../config/adminFilters";
import { buildBudgetDrawerBlocks } from "../../config/drawerFieldBlocks";
import ExportExcelButton from "./ExportExcelButton";
import RecordDetailDrawer, { ClickableAddressCell } from "./RecordDetailDrawer";
import AddColumnHeader from "./AddColumnHeader";

const EXPORT_FILENAMES = {
  rent: "ДБиЭА_Аренда.xlsx",
  purchase: "ДБиЭА_Выкупленные.xlsx",
};

function buildDraft(row, headers) {
  const draft = {};
  headers.forEach((h) => {
    if (h !== "_id") draft[h] = row[h] ?? "";
  });
  return draft;
}

export default function BudgetExcelTable({
  headers = [],
  rows = [],
  title = "",
  source = "rent",
  onRowUpdated,
  onDatasetChange,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [acquisitionFilter, setAcquisitionFilter] = useState("");
  const [drawerRow, setDrawerRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dataHeaders = useMemo(
    () => headers.filter((h) => h !== "_id"),
    [headers]
  );

  const statusKey = useMemo(() => findHeader(dataHeaders, /статус/i), [dataHeaders]);
  const positionKey = useMemo(() => findHeader(dataHeaders, /должност/i), [dataHeaders]);
  const basisKey = useMemo(
    () => findHeader(dataHeaders, /услов|основан|рассроч|выкуп|приобрет/i),
    [dataHeaders]
  );

  const positionOptions = useMemo(() => {
    if (!positionKey) return [];
    const s = new Set();
    rows.forEach((r) => {
      const v = r[positionKey];
      if (v != null && String(v).trim()) s.add(String(v).trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows, positionKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const hit = Object.values(row).some(
          (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q)
        );
        if (!hit) return false;
      }
      if (statusFilter && statusKey && String(row[statusKey] || "").trim() !== statusFilter) return false;
      if (positionFilter && positionKey && String(row[positionKey] || "").trim() !== positionFilter) return false;
      if (acquisitionFilter) {
        const basisText = basisKey
          ? row[basisKey]
          : Object.values(row).filter((v) => v != null).join(" ");
        if (!matchesAcquisitionCondition(basisText, acquisitionFilter)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, positionFilter, acquisitionFilter, statusKey, positionKey, basisKey]);

  const addressKey = useMemo(
    () => findHeader(dataHeaders, /^адрес$/i) || findHeader(dataHeaders, /адрес/i),
    [dataHeaders]
  );

  const fioKey = useMemo(() => findHeader(dataHeaders, /фио/i), [dataHeaders]);

  const drawerBlocks = useMemo(() => buildBudgetDrawerBlocks(dataHeaders), [dataHeaders]);

  const exportColumns = useMemo(
    () => dataHeaders.map((h) => ({ key: h, label: h })),
    [dataHeaders]
  );

  const handleAddColumn = async (name) => {
    const adder = source === "purchase" ? addBudgetPurchaseColumn : addBudgetRentColumn;
    const data = await adder(name);
    onDatasetChange?.(data);
  };

  const handleSave = async (draft) => {
    if (!drawerRow?._id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {};
      dataHeaders.forEach((h) => {
        payload[h] = draft[h] ?? null;
      });
      const updater = source === "purchase" ? updateBudgetPurchaseRow : updateBudgetRentRow;
      const result = await updater(drawerRow._id, payload);
      onRowUpdated?.(drawerRow._id, { ...result.data, _id: result.id });
      setDrawerRow(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="budget-excel-root">
      {title && <h2 className="budget-excel-title">{title}</h2>}

      <div className="budget-excel-filters">
        <input
          className="budget-excel-search"
          type="text"
          placeholder="Поиск по всем полям (ФИО, ЖК, статус…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {statusKey ? (
          <label className="complex-working-filter">
            Статус
            <select className="complex-working-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {HOUSING_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        {positionKey ? (
          <label className="complex-working-filter">
            Должность
            <select className="complex-working-select" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
              <option value="">Все должности</option>
              {positionOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="complex-working-filter">
          Условия приобретения
          <select className="complex-working-select" value={acquisitionFilter} onChange={(e) => setAcquisitionFilter(e.target.value)}>
            {ACQUISITION_CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <span className="budget-excel-count">Показано: {filtered.length} из {rows.length}</span>
        <ExportExcelButton
          filename={EXPORT_FILENAMES[source] || "ДБиЭА_Данные.xlsx"}
          columns={exportColumns}
          rows={filtered}
        />
      </div>

      <div style={{ overflowX: "auto", width: "100%" }}>
        <table className="budget-excel-table">
          <thead>
            <tr>
              {dataHeaders.map((h) => (
                <th key={h} className="budget-excel-th">
                  {/адрес/i.test(h) || /^фио$/i.test(h) || /ф\.и\.о/i.test(h) ? (
                    <span className="th-with-icon">
                      <MapPin size={11} className="th-pin-icon" />
                      {h}
                    </span>
                  ) : h}
                </th>
              ))}
              <AddColumnHeader onAdd={handleAddColumn} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={dataHeaders.length + 1} className="budget-excel-empty">Нет строк по запросу</td>
              </tr>
            ) : (
              filtered.map((row, ri) => (
                <tr key={row._id ?? ri} className={ri % 2 === 0 ? "budget-excel-even" : "budget-excel-odd"}>
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
                      ) : h === fioKey ? (
                        <span
                          className="table-fio-badge"
                          onClick={() => {
                            setError("");
                            setDrawerRow(row);
                          }}
                        >
                          {row[h] != null ? String(row[h]) : ""}
                        </span>
                      ) : row[h] !== null && row[h] !== undefined ? (
                        String(row[h])
                      ) : (
                        ""
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              ))
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
