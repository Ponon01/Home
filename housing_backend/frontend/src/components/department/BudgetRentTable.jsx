import { useMemo, useState } from "react";
import { formatNum } from "../../utils/apartmentRowData";
import { BUDGET_RENT_COLUMNS } from "../../config/budgetRentColumns";

function formatCell(row, col) {
  const v = row[col.field];
  if (v == null || v === "") return "";
  if (col.type === "num") return formatNum(v);
  if (col.type === "int") return String(v);
  return String(v);
}

function thClass(col) {
  const classes = ["budget-rent-th"];
  if (col.sticky === 1) classes.push("sticky-col-1", "col-complex");
  if (col.sticky === 2) classes.push("sticky-col-2", "col-jk");
  if (col.wide) classes.push("col-wide");
  if (col.type === "num" || col.type === "int") classes.push("col-num-sm");
  if (col.field === "fio") classes.push("col-fio");
  if (col.field === "rental_contract_number_date") classes.push("col-doc");
  return classes.join(" ");
}

function tdClass(col) {
  const classes = ["budget-rent-td", "table-cell-wrap"];
  if (col.type === "num" || col.type === "int") classes.push("complex-wt-num", "col-num-sm");
  else classes.push("complex-wt-left");
  if (col.sticky === 1) classes.push("sticky-col-1", "col-complex");
  if (col.sticky === 2) classes.push("sticky-col-2", "col-jk");
  if (col.wide) classes.push("col-wide");
  if (col.field === "fio") classes.push("col-fio");
  if (col.field === "rental_contract_number_date") classes.push("col-doc");
  return classes.join(" ");
}

export default function BudgetRentTable({ rows = [], title }) {
  const [fioSearch, setFioSearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [complexName, setComplexName] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const complexOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.residential_complex_name).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ru")
      ),
    [rows]
  );

  const statusOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.contract_status).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [rows]
  );

  const filtered = useMemo(() => {
    const fio = fioSearch.trim().toLowerCase();
    const addr = addressSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (fio && !(r.fio || "").toLowerCase().includes(fio)) return false;
      if (addr && !(r.address || "").toLowerCase().includes(addr)) return false;
      if (complexName && (r.residential_complex_name || "") !== complexName) return false;
      if (statusSearch && (r.contract_status || "") !== statusSearch) return false;
      return true;
    });
  }, [rows, fioSearch, addressSearch, complexName, statusSearch]);

  return (
    <div className="complex-working-root budget-rent-root">
      {title ? <h1 className="complex-working-title">{title}</h1> : null}
      <div className="complex-working-filters">
        <label className="complex-working-filter">
          Поиск по ФИО
          <input className="complex-working-input" value={fioSearch} onChange={(e) => setFioSearch(e.target.value)} />
        </label>
        <label className="complex-working-filter">
          Поиск по адресу
          <input
            className="complex-working-input"
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
          />
        </label>
        <label className="complex-working-filter">
          ЖК
          <select className="complex-working-select" value={complexName} onChange={(e) => setComplexName(e.target.value)}>
            <option value="">Все</option>
            {complexOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="complex-working-filter">
          Статус
          <select className="complex-working-select" value={statusSearch} onChange={(e) => setStatusSearch(e.target.value)}>
            <option value="">Все</option>
            {statusOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted complex-working-sub">
        Показано: {filtered.length} из {rows.length} · колонок: {BUDGET_RENT_COLUMNS.length}
      </p>
      <div className="table-wrapper budget-rent-scroll">
        <table className="table-excel table-budget-rent">
          <thead>
            <tr>
              {BUDGET_RENT_COLUMNS.map((col) => (
                <th key={col.field} className={thClass(col)} title={col.label}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                {BUDGET_RENT_COLUMNS.map((col) => (
                  <td key={col.field} className={tdClass(col)}>
                    {formatCell(row, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
