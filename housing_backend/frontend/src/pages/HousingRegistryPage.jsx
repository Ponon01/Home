import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import RecordDetailDrawer from "../components/department/RecordDetailDrawer";
import { getRegistryResident, listRegistryResidents } from "../api/housingRegistry";

const CATEGORY_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "Выкуплено (100%)", label: "🔴 Выкуплено" },
  { value: "Рассрочка (Выкуп)", label: "🔵 Рассрочка" },
  { value: "Аренда", label: "🟡 Аренда" },
  { value: "Гостевой фонд", label: "🏨 Гостевой фонд" },
];

function detailToBlocks(detail) {
  if (!detail) return [];
  return [
    {
      title: "Инфо",
      fields: [
        { key: "full_name", label: "ФИО", type: "text" },
        { key: "iin", label: "ИИН", type: "text" },
        { key: "position", label: "Должность", type: "text" },
        { key: "department", label: "Блок / Отдел", type: "text" },
        { key: "family_composition", label: "Состав семьи", type: "textarea" },
      ],
    },
    {
      title: "Договор",
      fields: [
        { key: "category", label: "Категория", type: "text" },
        { key: "contract_occupancy_basis", label: "Основание", type: "textarea" },
        { key: "contract_rental_contract_number", label: "Номер договора найма", type: "text" },
        { key: "contract_purchase_contract", label: "Договор купли-продажи", type: "text" },
        { key: "contract_realization_period", label: "Период реализации", type: "text" },
      ],
    },
    {
      title: "Платежи",
      fields: [
        { key: "finance_monthly_rent_payment", label: "Ежемесячная аренда", type: "text" },
        { key: "finance_monthly_installment_payment", label: "Ежемесячный платеж рассрочки", type: "text" },
        { key: "finance_remaining_debt", label: "Остаток долга", type: "text" },
      ],
    },
  ];
}

function detailToDraft(detail) {
  if (!detail) return {};
  return {
    full_name: detail.full_name || "",
    iin: detail.iin || "",
    position: detail.position || "",
    department: detail.department || "",
    family_composition: detail.family_composition || "",
    category: detail.category || "",
    contract_occupancy_basis: detail.contract?.occupancy_basis || "",
    contract_rental_contract_number: detail.contract?.rental_contract_number || "",
    contract_purchase_contract: detail.contract?.purchase_contract || "",
    contract_realization_period: detail.contract?.realization_period || "",
    finance_monthly_rent_payment: detail.finance?.monthly_rent_payment ?? "",
    finance_monthly_installment_payment: detail.finance?.monthly_installment_payment ?? "",
    finance_remaining_debt: detail.finance?.remaining_debt ?? "",
  };
}

export default function HousingRegistryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listRegistryResidents({
        category: category === "all" ? undefined : category,
        search: search || undefined,
      });
      setRows(data);
    } catch {
      setError("Не удалось загрузить реестр жильцов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.iin, r.residential_complex_name, r.address].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const openDetail = async (residentId) => {
    setSelectedId(residentId);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const data = await getRegistryResident(residentId);
      setDetail(data);
    } catch {
      setDetailError("Не удалось загрузить карточку жильца");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <main className="container complex-page-container">
      <AppHeader />
      <nav className="dept-breadcrumb muted">
        <Link to="/departments/housing">ДЖСВ</Link>
        {" / "}
        <span>Реестр жильцов</span>
      </nav>

      <h1 className="complex-working-title">Реестр жильцов</h1>
      <div className="table-toolbar">
        <label className="complex-working-filter">
          Поиск (ФИО / ИИН / ЖК / Адрес)
          <input className="complex-working-input" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="complex-working-filter">
          Категория
          <select className="complex-working-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button button-ghost" onClick={loadList}>
          Обновить
        </button>
      </div>

      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && (
        <div className="table-wrapper">
          <table className="table-excel">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>ИИН</th>
                <th>Категория</th>
                <th>ЖК</th>
                <th>Адрес</th>
                <th>Должность</th>
                <th>Платеж / долг</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.resident_id}>
                  <td>
                    <button type="button" className="table-address-link" onClick={() => openDetail(row.resident_id)}>
                      {row.full_name}
                    </button>
                  </td>
                  <td>{row.iin || "—"}</td>
                  <td>{row.category}</td>
                  <td>{row.residential_complex_name}</td>
                  <td>{row.address || "—"}</td>
                  <td>{row.position || "—"}</td>
                  <td>
                    {row.monthly_payment != null ? `${row.monthly_payment.toLocaleString("ru-RU")} тг` : "—"}
                    {row.remaining_debt != null ? ` / ${row.remaining_debt.toLocaleString("ru-RU")} тг` : ""}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Нет данных по выбранному фильтру
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <RecordDetailDrawer
        open={Boolean(selectedId)}
        title={detail?.full_name || "Карточка жильца"}
        subtitle={detail?.category || ""}
        blocks={detailToBlocks(detail)}
        initialValues={detailToDraft(detail)}
        saving={false}
        error={detailLoading ? "Загрузка..." : detailError}
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
          setDetailError("");
        }}
        onSave={() => {}}
      />
    </main>
  );
}
