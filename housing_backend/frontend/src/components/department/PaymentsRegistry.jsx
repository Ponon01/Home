import { useEffect, useMemo, useState } from "react";
import ExportExcelButton from "./ExportExcelButton";
import { loadHousingDataSafe, getLocalPayments } from "../../data/housingStore";
import { formatMoneyKzt } from "../../utils/computeHousingAnalytics";
import "./registry-panels.css";

export default function PaymentsRegistry() {
  const [payments, setPayments] = useState(() => getLocalPayments());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await loadHousingDataSafe();
      if (!cancelled) {
        setPayments(data.payments || getLocalPayments());
        setLoading(false);
      }
    })();
    const onChanged = async () => {
      const data = await loadHousingDataSafe();
      setPayments(data.payments || getLocalPayments());
    };
    window.addEventListener("hf:data-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("hf:data-changed", onChanged);
    };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payments || []).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${p.employee || ""} ${p.department || ""} ${p.residential_complex_name || ""} ${p.apartment_number || ""} ${p.id || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [payments, query, statusFilter]);

  const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

  return (
    <section className="reg-panel">
      <div className="reg-head">
        <div>
          <h2 className="reg-title">Платежи</h2>
          <p className="reg-sub">Реестр проведённых оплат по жилому фонду</p>
        </div>
        <ExportExcelButton
          filename="payments.xlsx"
          label="Выгрузить Excel"
          columns={[
            { key: "id", label: "№" },
            { key: "date", label: "Дата" },
            { key: "employee", label: "Сотрудник" },
            { key: "department", label: "Отдел" },
            { key: "residential_complex_name", label: "ЖК" },
            { key: "apartment_number", label: "Кв." },
            { key: "amount", label: "Сумма" },
            { key: "status", label: "Статус" },
            { key: "method", label: "Способ" },
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Все статусы</option>
          <option value="Оплачено">Оплачено</option>
          <option value="Частично">Частично</option>
        </select>
        <div className="reg-stat">
          {rows.length} записей · {formatMoneyKzt(total)}
        </div>
      </div>

      {loading ? <p className="reg-muted">Загрузка…</p> : null}

      <div className="reg-table-wrap">
        <table className="reg-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Дата</th>
              <th>Сотрудник</th>
              <th>Отдел</th>
              <th>ЖК / Кв.</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th>Способ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="reg-muted">
                  Нет данных о платежах. Реестр заполняется только из Excel / API.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.date}</td>
                  <td>{row.employee || "—"}</td>
                  <td>{row.department || "Не указан"}</td>
                  <td>
                    {row.residential_complex_name || "—"} · кв. {row.apartment_number || "?"}
                  </td>
                  <td className="reg-money">{formatMoneyKzt(row.amount)}</td>
                  <td>
                    <span className={`reg-badge ${row.status === "Оплачено" ? "is-ok" : "is-warn"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.method || "Не указан"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
