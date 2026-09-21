import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import ExportExcelButton from "./department/ExportExcelButton";

const YEAR_COLUMNS = [
  { field: "sold_2019", header: "2019" },
  { field: "sold_2020", header: "2020" },
  { field: "sold_2021", header: "2021" },
  { field: "sold_2022", header: "2022" },
  { field: "sold_2023", header: "2023" },
  { field: "sold_2024", header: "2024" },
  { field: "sold_2025", header: "2025" },
  { field: "sold_2026", header: "2026" },
];

/** Fields summed in the ИТОГО row (same order as body columns after name). */
const SUM_FIELDS = [
  "total_count",
  "not_for_sale_count",
  "for_sale_count",
  ...YEAR_COLUMNS.map((c) => c.field),
  "sold_total",
  "remaining_total",
  "rent_count",
  "guest_count",
  "guest_gph_count",
];

const SUMMARY_EXPORT_COLUMNS = [
  { key: "residential_complex_name", label: "Наименование ЖК" },
  { key: "total_count", label: "Количество" },
  { key: "not_for_sale_count", label: "Не подлежат реализации" },
  { key: "for_sale_count", label: "К реализации" },
  { key: "transfer_year", label: "Год передачи" },
  ...YEAR_COLUMNS.map((c) => ({ key: c.field, label: c.header })),
  { key: "sold_total", label: "Итого реализовано" },
  { key: "remaining_total", label: "Всего осталось квартир" },
  { key: "rent_count", label: "В аренде" },
  { key: "guest_count", label: "Гостевые" },
  { key: "guest_gph_count", label: "Гостевые ГПХ" },
];

/** @param {number | null | undefined} v */
function cellYear(v) {
  return v == null ? "" : String(v);
}

/** @param {number | undefined} v */
function cellNum(v) {
  return v == null ? "" : v;
}

/** @param {unknown} v */
function addNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ComplexSummaryTable({ complexes = [] }) {
  const [hideProblematic, setHideProblematic] = useState(false);

  const isProblematicName = (rawName) => {
    const name = (rawName || "").trim();
    const lower = name.toLowerCase();
    return !name || lower === "unknown" || lower === "жк";
  };

  const isSuspiciousName = (rawName) => {
    const name = (rawName || "").trim();
    const lower = name.toLowerCase();
    return isProblematicName(name) || lower.length < 3;
  };

  const sorted = useMemo(() => {
    let rows = [...complexes];
    if (hideProblematic) {
      rows = rows.filter((row) => !isProblematicName(row.residential_complex_name));
    }
    rows.sort((a, b) =>
      (a.residential_complex_name || "").localeCompare(b.residential_complex_name || "", "ru")
    );
    return rows;
  }, [complexes, hideProblematic]);

  const totals = useMemo(() => {
    const acc = Object.fromEntries(SUM_FIELDS.map((k) => [k, 0]));
    for (const row of sorted) {
      for (const k of SUM_FIELDS) {
        acc[k] += addNum(row[k]);
      }
    }
    return acc;
  }, [sorted]);

  const exportRows = useMemo(() => {
    const dataRows = sorted.map((row) => ({
      residential_complex_name: row.residential_complex_name || "",
      total_count: row.total_count ?? "",
      not_for_sale_count: row.not_for_sale_count ?? "",
      for_sale_count: row.for_sale_count ?? "",
      transfer_year: row.transfer_year ?? "",
      ...Object.fromEntries(YEAR_COLUMNS.map((c) => [c.field, row[c.field] ?? ""])),
      sold_total: row.sold_total ?? "",
      remaining_total: row.remaining_total ?? "",
      rent_count: row.rent_count ?? "",
      guest_count: row.guest_count ?? "",
      guest_gph_count: row.guest_gph_count ?? "",
    }));

    return [
      ...dataRows,
      {
        residential_complex_name: "ИТОГО",
        total_count: totals.total_count,
        not_for_sale_count: totals.not_for_sale_count,
        for_sale_count: totals.for_sale_count,
        transfer_year: "",
        ...Object.fromEntries(YEAR_COLUMNS.map((c) => [c.field, totals[c.field]])),
        sold_total: totals.sold_total,
        remaining_total: totals.remaining_total,
        rent_count: totals.rent_count,
        guest_count: totals.guest_count,
        guest_gph_count: totals.guest_gph_count,
      },
    ];
  }, [sorted, totals]);

  return (
    <>
      <div className="complex-summary-toolbar">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={hideProblematic}
            onChange={(e) => setHideProblematic(e.target.checked)}
          />
          <span>Скрыть проблемные ЖК</span>
        </label>
        <ExportExcelButton
          filename="ДЖСВ_Сводная_таблица.xlsx"
          columns={SUMMARY_EXPORT_COLUMNS}
          rows={exportRows}
        />
      </div>

      <div className="table-complex-summary-wrap">
        <table className="table table-complex-summary">
          <thead>
            <tr>
              <th rowSpan={2} scope="col" className="complex-summary-name-head">
                Наименование ЖК
              </th>
              <th rowSpan={2} scope="col">
                Количество
              </th>
              <th colSpan={2} scope="colgroup" className="complex-summary-group-head">
                из них
              </th>
              <th rowSpan={2} scope="col">
                Год передачи
              </th>
              <th colSpan={9} scope="colgroup" className="complex-summary-group-head">
                Количество реализованных квартир по годам
              </th>
              <th rowSpan={2} scope="col">
                Всего осталось квартир
              </th>
              <th colSpan={3} scope="colgroup" className="complex-summary-group-head">
                из них
              </th>
            </tr>
            <tr>
              <th scope="col">не подлежат реализации</th>
              <th scope="col">к реализации</th>
              {YEAR_COLUMNS.map((c) => (
                <th key={c.field} scope="col">
                  {c.header}
                </th>
              ))}
              <th scope="col">Итого</th>
              <th scope="col">в аренде</th>
              <th scope="col">гостевые</th>
              <th scope="col">гостевые ГПХ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const name = row.residential_complex_name || "";
              const suspicious = isSuspiciousName(name);
              const rowKey = row.id != null ? `id-${row.id}` : row.residential_complex_name;
              return (
                <tr key={rowKey} className={suspicious ? "row-invalid" : ""}>
                  <td className="complex-summary-name">
                    <Link to={`/complex/${encodeURIComponent(row.residential_complex_name)}`}>
                      {row.residential_complex_name || "(пусто)"}
                    </Link>
                    {suspicious && <span className="badge-warn">Проверьте</span>}
                  </td>
                  <td className="complex-summary-num">{cellNum(row.total_count)}</td>
                  <td className="complex-summary-num">{cellNum(row.not_for_sale_count)}</td>
                  <td className="complex-summary-num">{cellNum(row.for_sale_count)}</td>
                  <td className="complex-summary-num complex-summary-year">
                    {cellYear(row.transfer_year)}
                  </td>
                  {YEAR_COLUMNS.map((c) => (
                    <td key={c.field} className="complex-summary-num">
                      {cellNum(row[c.field])}
                    </td>
                  ))}
                  <td className="complex-summary-num">{cellNum(row.sold_total)}</td>
                  <td className="complex-summary-num">{cellNum(row.remaining_total)}</td>
                  <td className="complex-summary-num">{cellNum(row.rent_count)}</td>
                  <td className="complex-summary-num">{cellNum(row.guest_count)}</td>
                  <td className="complex-summary-num">{cellNum(row.guest_gph_count)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="complex-summary-totals-row">
              <td className="complex-summary-totals-label">ИТОГО</td>
              <td className="complex-summary-num">{totals.total_count}</td>
              <td className="complex-summary-num">{totals.not_for_sale_count}</td>
              <td className="complex-summary-num">{totals.for_sale_count}</td>
              <td className="complex-summary-num complex-summary-year" />
              {YEAR_COLUMNS.map((c) => (
                <td key={c.field} className="complex-summary-num">
                  {totals[c.field]}
                </td>
              ))}
              <td className="complex-summary-num">{totals.sold_total}</td>
              <td className="complex-summary-num">{totals.remaining_total}</td>
              <td className="complex-summary-num">{totals.rent_count}</td>
              <td className="complex-summary-num">{totals.guest_count}</td>
              <td className="complex-summary-num">{totals.guest_gph_count}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
