import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import {
  createManualSummaryRow,
  deleteManualSummaryRow,
  getManualDashboardSummary,
  patchManualSummaryRow,
} from "../api/manualDashboard";

const SOLD_FIELDS = [
  "sold_2019",
  "sold_2020",
  "sold_2021",
  "sold_2022",
  "sold_2023",
  "sold_2024",
  "sold_2025",
  "sold_2026",
];

const PREFIX_COUNTS = ["total_count", "not_for_sale_count", "for_sale_count"];

const SUFFIX_COUNTS = [
  "sold_total",
  "remaining_total",
  "rent_count",
  "guest_count",
  "guest_gph_count",
];

const COUNT_FIELDS = [...PREFIX_COUNTS, ...SOLD_FIELDS, ...SUFFIX_COUNTS];

function emptyDraft() {
  const row = {
    id: null,
    residential_complex_name: "",
    transfer_year: "",
    notes: "",
    updated_at: null,
  };
  for (const f of COUNT_FIELDS) {
    row[f] = 0;
  }
  return row;
}

function serverRowToDraft(r) {
  return {
    id: r.id,
    residential_complex_name: r.residential_complex_name ?? "",
    transfer_year: r.transfer_year != null ? String(r.transfer_year) : "",
    notes: r.notes ?? "",
    updated_at: r.updated_at,
    ...Object.fromEntries(COUNT_FIELDS.map((f) => [f, r[f] ?? 0])),
  };
}

function toInt(v) {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function toYear(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function rowToApiBody(row) {
  return {
    residential_complex_name: row.residential_complex_name.trim(),
    total_count: toInt(row.total_count),
    not_for_sale_count: toInt(row.not_for_sale_count),
    for_sale_count: toInt(row.for_sale_count),
    transfer_year: toYear(row.transfer_year),
    sold_2019: toInt(row.sold_2019),
    sold_2020: toInt(row.sold_2020),
    sold_2021: toInt(row.sold_2021),
    sold_2022: toInt(row.sold_2022),
    sold_2023: toInt(row.sold_2023),
    sold_2024: toInt(row.sold_2024),
    sold_2025: toInt(row.sold_2025),
    sold_2026: toInt(row.sold_2026),
    sold_total: toInt(row.sold_total),
    remaining_total: toInt(row.remaining_total),
    rent_count: toInt(row.rent_count),
    guest_count: toInt(row.guest_count),
    guest_gph_count: toInt(row.guest_gph_count),
    notes: row.notes?.trim() ? row.notes.trim() : null,
  };
}

export default function ManualSummaryEditPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getManualDashboardSummary();
      setRows((data.rows || []).map(serverRowToDraft));
    } catch {
      setError("Не удалось загрузить сводку");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      load();
    } else if (!authLoading && !isAdmin) {
      setLoading(false);
    }
  }, [authLoading, isAdmin, load]);

  const setField = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setRowError((e) => ({ ...e, [index]: "" }));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyDraft()]);
  };

  const saveRow = async (index) => {
    const row = rows[index];
    setRowError((e) => ({ ...e, [index]: "" }));
    if (!row.residential_complex_name?.trim()) {
      setRowError((e) => ({ ...e, [index]: "Укажите наименование ЖК" }));
      return;
    }
    const body = rowToApiBody(row);
    const key = row.id ?? `new-${index}`;
    setSavingId(key);
    try {
      if (row.id == null) {
        const created = await createManualSummaryRow(body);
        setRows((prev) => {
          const next = [...prev];
          next[index] = serverRowToDraft(created);
          return next;
        });
      } else {
        const updated = await patchManualSummaryRow(row.id, body);
        setRows((prev) => {
          const next = [...prev];
          next[index] = serverRowToDraft(updated);
          return next;
        });
      }
    } catch (err) {
      const d = err?.response?.data?.detail;
      const msg = Array.isArray(d)
        ? d.map((x) => (typeof x === "string" ? x : x.msg || JSON.stringify(x))).join("; ")
        : typeof d === "string"
          ? d
          : "Ошибка сохранения";
      setRowError((e) => ({ ...e, [index]: msg }));
    } finally {
      setSavingId(null);
    }
  };

  const removeRow = async (index) => {
    const row = rows[index];
    if (row.id == null) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (!window.confirm("Удалить строку для этого ЖК?")) return;
    setRowError((e) => ({ ...e, [index]: "" }));
    const key = row.id;
    setSavingId(key);
    try {
      await deleteManualSummaryRow(row.id);
      setRows((prev) => prev.filter((_, i) => i !== index));
    } catch {
      setRowError((e) => ({ ...e, [index]: "Не удалось удалить" }));
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading) {
    return (
      <main className="container">
        <AppHeader />
        <Loading />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="container">
        <AppHeader />
        <h1>Ручная сводка</h1>
        <p className="muted">Доступ только для администратора.</p>
        <Link to="/">На главную</Link>
      </main>
    );
  }

  return (
    <main className="container">
      <AppHeader />
      <h1>Редактирование сводки (вручную)</h1>
      <p className="muted manual-summary-hint">
        Числа вводятся вручную. Сохранение строки записывает изменения в базу и журнал аудита.
      </p>
      <div className="actions-row">
        <button type="button" className="button" onClick={addRow}>
          Добавить строку
        </button>
        <Link className="button button-ghost" to="/">
          На главную
        </Link>
      </div>
      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && (
        <div className="manual-summary-edit-wrap">
          <table className="table manual-summary-edit-table">
            <thead>
              <tr>
                <th>ЖК</th>
                <th>Кол-во</th>
                <th>Не реал.</th>
                <th>К реал.</th>
                <th>Год</th>
                {SOLD_FIELDS.map((f) => (
                  <th key={f}>{f.replace("sold_", "")}</th>
                ))}
                <th>Итого</th>
                <th>Осталось</th>
                <th>Аренда</th>
                <th>Гост.</th>
                <th>ГПХ</th>
                <th>Заметки</th>
                <th>Обновлено</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={21} className="muted">
                    Нет строк. Добавьте первую строку или импортируйте данные отдельно.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id ?? `draft-${index}`}>
                    <td>
                      <input
                        className="manual-summary-input"
                        value={row.residential_complex_name}
                        onChange={(e) => setField(index, "residential_complex_name", e.target.value)}
                        placeholder="Наименование ЖК"
                      />
                    </td>
                    {PREFIX_COUNTS.map((f) => (
                      <td key={f}>
                        <input
                          type="number"
                          min={0}
                          className="manual-summary-input manual-summary-input-num"
                          value={row[f] === "" ? "" : row[f]}
                          onChange={(e) =>
                            setField(index, f, e.target.value === "" ? "" : Number(e.target.value))
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <input
                        type="number"
                        className="manual-summary-input manual-summary-input-num"
                        value={row.transfer_year}
                        onChange={(e) => setField(index, "transfer_year", e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    {SOLD_FIELDS.map((f) => (
                      <td key={f}>
                        <input
                          type="number"
                          min={0}
                          className="manual-summary-input manual-summary-input-num"
                          value={row[f] === "" ? "" : row[f]}
                          onChange={(e) =>
                            setField(index, f, e.target.value === "" ? "" : Number(e.target.value))
                          }
                        />
                      </td>
                    ))}
                    {SUFFIX_COUNTS.map((f) => (
                      <td key={f}>
                        <input
                          type="number"
                          min={0}
                          className="manual-summary-input manual-summary-input-num"
                          value={row[f] === "" ? "" : row[f]}
                          onChange={(e) =>
                            setField(index, f, e.target.value === "" ? "" : Number(e.target.value))
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <input
                        className="manual-summary-input"
                        value={row.notes ?? ""}
                        onChange={(e) => setField(index, "notes", e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className="manual-summary-meta">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleString("ru-RU", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="manual-summary-actions">
                      <button
                        type="button"
                        className="button"
                        disabled={savingId != null}
                        onClick={() => saveRow(index)}
                      >
                        {savingId === (row.id ?? `new-${index}`) ? "…" : "Сохранить"}
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        disabled={savingId != null}
                        onClick={() => removeRow(index)}
                      >
                        Удалить
                      </button>
                      {rowError[index] ? (
                        <div className="state error manual-summary-row-err">{rowError[index]}</div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
