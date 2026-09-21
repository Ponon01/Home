import { downloadExcel } from "../../utils/exportToExcel";
import "./export-excel.css";

export default function ExportExcelButton({
  filename,
  columns,
  rows,
  label = "Скачать Excel",
  disabled = false,
  className = "",
}) {
  const handleClick = () => {
    if (!rows?.length) return;
    downloadExcel({ filename, columns, rows });
  };

  return (
    <button
      type="button"
      className={`export-excel-btn${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      disabled={disabled || !rows?.length}
      title={rows?.length ? `Выгрузить ${rows.length} строк` : "Нет данных для выгрузки"}
    >
      <span className="export-excel-btn-icon" aria-hidden="true">
        📥
      </span>
      {label}
    </button>
  );
}
