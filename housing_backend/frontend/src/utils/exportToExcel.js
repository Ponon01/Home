import * as XLSX from "xlsx";

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  return value;
}

/**
 * @param {{ filename: string, columns: { key?: string, label: string, getValue?: (row: object) => unknown }[], rows: object[] }} options
 */
export function downloadExcel({ filename, columns, rows }) {
  if (!rows.length) return;

  const sheetRows = rows.map((row) => {
    const out = {};
    for (const col of columns) {
      const raw = col.getValue ? col.getValue(row) : row[col.key];
      out[col.label] = cellValue(raw);
    }
    return out;
  });

  const headerLabels = columns.map((c) => c.label);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: headerLabels });

  worksheet["!cols"] = columns.map((col, index) => {
    const labelLen = col.label.length;
    const maxDataLen = sheetRows.reduce((max, row) => {
      const len = String(row[col.label] ?? "").length;
      return len > max ? len : max;
    }, 0);
    const width = Math.min(Math.max(labelLen, maxDataLen) + 2, 60);
    return { wch: width || 10, ...(worksheet["!cols"]?.[index] || {}) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Данные");

  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeName);
}
