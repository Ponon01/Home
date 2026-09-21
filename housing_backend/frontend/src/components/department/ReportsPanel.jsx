import { useEffect, useMemo, useState } from "react";
import ExportExcelButton from "./ExportExcelButton";
import { loadHousingDataSafe } from "../../data/housingStore";
import {
  computeHousingAnalytics,
  formatMoneyKzt,
} from "../../utils/computeHousingAnalytics";
import "./registry-panels.css";

export default function ReportsPanel() {
  const [apartments, setApartments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await loadHousingDataSafe();
      if (!cancelled) {
        setApartments(data.apartments || []);
        setContracts(data.contracts || []);
        setPayments(data.payments || []);
        setLoading(false);
      }
    })();
    const onChanged = async () => {
      const data = await loadHousingDataSafe();
      setApartments(data.apartments || []);
      setContracts(data.contracts || []);
      setPayments(data.payments || []);
    };
    window.addEventListener("hf:data-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("hf:data-changed", onChanged);
    };
  }, []);

  const stats = useMemo(
    () => computeHousingAnalytics(apartments, contracts, { months: 6 }),
    [apartments, contracts]
  );

  const byComplex = stats.byComplex || [];

  const summaryRows = [
    { metric: "Квартир всего", value: apartments.length },
    { metric: "Занято", value: stats.occupiedCount },
    { metric: "Айлық төлем (все ЖК / мес)", value: formatMoneyKzt(stats.monthlyTotal) },
    { metric: "Аренда (год)", value: formatMoneyKzt(stats.annualRent) },
    { metric: "Рассрочка/Выкуп (год)", value: formatMoneyKzt(stats.annualSold) },
    { metric: "Общежитие (год)", value: formatMoneyKzt(stats.annualDorm) },
    { metric: "Общий доход (год)", value: formatMoneyKzt(stats.annualTotal) },
    { metric: "Договоров", value: contracts.length },
    { metric: "Платежей в реестре", value: payments.length },
  ];

  return (
    <section className="reg-panel">
      <div className="reg-head">
        <div>
          <h2 className="reg-title">Отчеты</h2>
          <p className="reg-sub">Сводные таблицы по жилому фонду и выгрузка данных</p>
        </div>
        <div className="reg-actions">
          <ExportExcelButton
            filename="report-summary.xlsx"
            label="Сводка Excel"
            columns={[
              { key: "metric", label: "Показатель" },
              { key: "value", label: "Значение" },
            ]}
            rows={summaryRows}
          />
          <ExportExcelButton
            filename="report-by-complex.xlsx"
            label="По ЖК Excel"
            columns={[
              { key: "name", label: "ЖК" },
              { key: "total", label: "Всего" },
              { key: "rent", label: "Аренда" },
              { key: "installment", label: "Рассрочка" },
              { key: "sold", label: "Выкуп" },
              { key: "guest", label: "Гостевые" },
              { key: "free", label: "Свободно" },
              { key: "monthly", label: "Айлық төлем / мес" },
              { key: "annual", label: "Доход / год" },
            ]}
            rows={byComplex}
          />
        </div>
      </div>

      {loading ? <p className="reg-muted">Загрузка…</p> : null}

      <div className="reg-cards">
        <article className="reg-card">
          <div className="reg-card-label">Общий доход (год)</div>
          <div className="reg-card-value">{formatMoneyKzt(stats.annualTotal)}</div>
          <div className="reg-card-hint">= {formatMoneyKzt(stats.monthlyTotal)} × 12</div>
        </article>
        <article className="reg-card">
          <div className="reg-card-label">Аренда (год)</div>
          <div className="reg-card-value">{formatMoneyKzt(stats.annualRent)}</div>
          <div className="reg-card-hint">{stats.rentPct}%</div>
        </article>
        <article className="reg-card">
          <div className="reg-card-label">Рассрочка / Выкуп (год)</div>
          <div className="reg-card-value">{formatMoneyKzt(stats.annualSold)}</div>
          <div className="reg-card-hint">{stats.soldPct}%</div>
        </article>
        <article className="reg-card">
          <div className="reg-card-label">Общежитие (год)</div>
          <div className="reg-card-value">{formatMoneyKzt(stats.annualDorm)}</div>
          <div className="reg-card-hint">{stats.dormPct}%</div>
        </article>
      </div>

      <h3 className="reg-section-title">Сводка по жилым комплексам</h3>
      <div className="reg-table-wrap">
        <table className="reg-table">
          <thead>
            <tr>
              <th>ЖК</th>
              <th>Всего</th>
              <th>Аренда</th>
              <th>Рассрочка</th>
              <th>Выкуп</th>
              <th>Гостевые</th>
              <th>Свободно</th>
              <th>Айлық төлем / мес</th>
              <th>Доход / год</th>
            </tr>
          </thead>
          <tbody>
            {byComplex.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.total}</td>
                <td>{row.rent}</td>
                <td>{row.installment}</td>
                <td>{row.sold}</td>
                <td>{row.guest}</td>
                <td>{row.free}</td>
                <td className="reg-money">{formatMoneyKzt(row.monthly)}</td>
                <td className="reg-money">{formatMoneyKzt(row.annual ?? row.monthly * 12)}</td>
              </tr>
            ))}
            <tr className="reg-total-row">
              <td colSpan={7}><strong>Итого</strong></td>
              <td className="reg-money"><strong>{formatMoneyKzt(stats.monthlyTotal)}</strong></td>
              <td className="reg-money"><strong>{formatMoneyKzt(stats.annualTotal)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="reg-section-title">Доходы по департаментам</h3>
      <div className="reg-table-wrap">
        <table className="reg-table">
          <thead>
            <tr>
              <th>Департамент</th>
              <th>Доля</th>
              <th>Сумма (год)</th>
            </tr>
          </thead>
          <tbody>
            {stats.departments.length === 0 ? (
              <tr>
                <td colSpan={3} className="reg-muted">
                  Нет данных по отделам (колонка в Excel не заполнена)
                </td>
              </tr>
            ) : (
              stats.departments.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>{d.pct}%</td>
                  <td className="reg-money">{formatMoneyKzt(d.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
