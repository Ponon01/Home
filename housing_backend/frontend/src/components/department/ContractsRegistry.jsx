import { useEffect, useMemo, useState } from "react";
import ExportExcelButton from "./ExportExcelButton";
import { loadHousingDataSafe, getLocalContracts } from "../../data/housingStore";
import { formatMoneyKzt } from "../../utils/computeHousingAnalytics";
import "./registry-panels.css";

const TYPE_FILTERS = [
  { value: "all", label: "Все типы" },
  { value: "Аренда", label: "Аренда" },
  { value: "Рассрочка", label: "Рассрочка" },
  { value: "Выкуп", label: "Выкуп" },
  { value: "Гостевой", label: "Гостевой" },
];

export default function ContractsRegistry() {
  const [contracts, setContracts] = useState(() => getLocalContracts());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await loadHousingDataSafe();
      if (!cancelled) {
        setContracts(data.contracts || getLocalContracts());
        setLoading(false);
      }
    })();
    const onChanged = async () => {
      const data = await loadHousingDataSafe();
      setContracts(data.contracts || getLocalContracts());
    };
    window.addEventListener("hf:data-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("hf:data-changed", onChanged);
    };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (contracts || []).filter((c) => {
      if (typeFilter !== "all" && c.contract_type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${c.full_name || ""} ${c.department || ""} ${c.residential_complex_name || ""} ${c.apartment_number || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [contracts, query, typeFilter]);

  const activeCount = rows.filter((c) => c.contract_status === "active").length;
  const expiringCount = rows.filter((c) => c.contract_status === "expiring").length;

  return (
    <section className="reg-panel">
      <div className="reg-head">
        <div>
          <h2 className="reg-title">Договоры</h2>
          <p className="reg-sub">Активные договоры: аренда, рассрочка, выкуп</p>
        </div>
        <ExportExcelButton
          filename="contracts.xlsx"
          label="Выгрузить Excel"
          columns={[
            { key: "id", label: "№" },
            { key: "full_name", label: "ФИО" },
            { key: "department", label: "Отдел" },
            { key: "residential_complex_name", label: "ЖК" },
            { key: "apartment_number", label: "Кв." },
            { key: "contract_type", label: "Тип" },
            { key: "contract_start_date", label: "Начало" },
            { key: "contract_end_date", label: "Окончание" },
            { key: "days_left", label: "Дней" },
            { key: "contract_status", label: "Статус" },
            { key: "monthly_payment", label: "Платёж/мес" },
          ]}
          rows={rows}
        />
      </div>

      <div className="reg-toolbar">
        <input
          className="reg-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: ФИО, ЖК, отдел…"
        />
        <select
          className="reg-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="reg-stat">
          {rows.length} · активных {activeCount} · истекают {expiringCount}
        </div>
      </div>

      {loading ? <p className="reg-muted">Загрузка…</p> : null}

      <div className="reg-table-wrap">
        <table className="reg-table">
          <thead>
            <tr>
              <th>№</th>
              <th>ФИО</th>
              <th>Отдел</th>
              <th>ЖК / Кв.</th>
              <th>Тип</th>
              <th>Срок</th>
              <th>Дней</th>
              <th>Статус</th>
              <th>Платёж/мес</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="reg-muted">
                  Нет договоров
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.full_name || "—"}</td>
                  <td>{row.department || "Не указан"}</td>
                  <td>
                    {row.residential_complex_name || "—"} · кв. {row.apartment_number || "?"}
                  </td>
                  <td>{row.contract_type || "—"}</td>
                  <td>
                    {row.contract_start_date || "—"} → {row.contract_end_date || "—"}
                  </td>
                  <td>{row.days_left != null ? row.days_left : "—"}</td>
                  <td>
                    <span
                      className={`reg-badge ${
                        row.contract_status === "expired"
                          ? "is-bad"
                          : row.contract_status === "expiring"
                            ? "is-warn"
                            : "is-ok"
                      }`}
                    >
                      {row.contract_status === "expired"
                        ? "Истёк"
                        : row.contract_status === "expiring"
                          ? "Истекает"
                          : "Активный"}
                    </span>
                  </td>
                  <td className="reg-money">{formatMoneyKzt(row.monthly_payment)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
