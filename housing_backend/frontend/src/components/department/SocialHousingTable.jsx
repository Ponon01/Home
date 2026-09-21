import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { formatNum } from "../../utils/apartmentRowData";
import { addHousingColumn, updateHousingRecord } from "../../api/housingDepartment";
import { HOUSING_RECORD_FIELDS } from "../../config/housingRecordFields";
import {
  ACQUISITION_CONDITION_OPTIONS,
  HOUSING_STATUS_OPTIONS,
  matchesAcquisitionCondition,
} from "../../config/adminFilters";
import {
  buildHousingDrawerFields,
  housingDraftToPayload,
  rowToHousingDraft,
} from "../../config/drawerFieldBlocks";
import ExportExcelButton from "./ExportExcelButton";
import RecordDetailDrawer, { ClickableAddressCell } from "./RecordDetailDrawer";
import AddColumnHeader from "./AddColumnHeader";

function parseErrorDetail(detail, fallback = "Не удалось сохранить изменения") {
  if (Array.isArray(detail)) return detail.map((x) => x?.msg || JSON.stringify(x)).join("; ");
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return fallback;
}

export default function SocialHousingTable({
  rows = [],
  customHeaders = [],
  title,
  onRefresh,
  onDataChange,
  onRowsChange,
  onCustomHeadersChange,
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [localCustomHeaders, setLocalCustomHeaders] = useState(customHeaders);
  const [fioSearch, setFioSearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [complexName, setComplexName] = useState("");
  const [status, setStatus] = useState("");
  const [position, setPosition] = useState("");
  const [acquisition, setAcquisition] = useState("");
  const [drawerRow, setDrawerRow] = useState(null);
  const [drawerError, setDrawerError] = useState("");
  const [saving, setSaving] = useState(false);

  // Column visibility states
  const [hiddenKeys, setHiddenKeys] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setLocalRows(rows), [rows]);
  useEffect(() => setLocalCustomHeaders(customHeaders), [customHeaders]);

  const complexOptions = useMemo(() => {
    const s = new Set();
    localRows.forEach((r) => {
      const name = r.residential_complex_name;
      if (name?.trim()) s.add(name.trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [localRows]);

  const positionOptions = useMemo(() => {
    const s = new Set();
    localRows.forEach((r) => {
      if (r.position?.trim()) s.add(r.position.trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [localRows]);

  const filtered = useMemo(() => {
    const fio = fioSearch.trim().toLowerCase();
    const addr = addressSearch.trim().toLowerCase();
    return localRows.filter((r) => {
      if (fio && !(r.fio || "").toLowerCase().includes(fio)) return false;
      if (addr && !(r.address || "").toLowerCase().includes(addr)) return false;
      if (complexName && (r.residential_complex_name || "").trim() !== complexName) return false;
      if (status && (r.status || "").trim() !== status) return false;
      if (position && (r.position || "").trim() !== position) return false;
      if (acquisition && !matchesAcquisitionCondition(r.occupancy_and_purchase_basis, acquisition)) return false;
      return true;
    });
  }, [localRows, fioSearch, addressSearch, complexName, status, position, acquisition]);

  const columns = useMemo(() => {
    const base = [
      { key: "residential_complex_name", label: "Наименование ЖК" },
      { key: "address", label: "Адрес", sticky: true, className: "sticky-col-1" },
      { key: "fio", label: "ФИО", sticky: true, className: "sticky-col-2" },
      { key: "family_composition", label: "Состав семьи" },
      { key: "initial_cost", label: "Первоначальная стоимость" },
      { key: "market_price", label: "Рыночная стоимость" },
      { key: "reimbursement_cost_monthly", label: "Сумма удержания из ЗП" },
      { key: "taxable_base", label: "Налогооблагаемая база" },
      { key: "status", label: "Статус квартиры по приказу" },
      { key: "residence_period", label: "Период проживания" },
      { key: "room_count", label: "Количество комнат" },
      { key: "total_area", label: "Общая площадь" },
      { key: "build_year", label: "Год постройки" },
      { key: "personal_account", label: "Лицевой счет" },
      { key: "position", label: "Должность" },
      { key: "department", label: "Подразделение" },
      { key: "occupancy_and_purchase_basis", label: "Протокол / Основание для заселения" },
      { key: "rental_contract", label: "Договор найма" },
      { key: "purchase_contract", label: "Договор купли-продажи" },
      { key: "payment_schedule", label: "График платежей" },
      { key: "ownership_document", label: "Акт приема-передачи / Документ права собственности" }
    ];
    const custom = localCustomHeaders.map((h) => ({
      key: `custom_${h}`,
      label: h,
      isCustom: true,
      originalName: h
    }));
    return [...base, ...custom];
  }, [localCustomHeaders]);

  const toggleVisibility = (key) => {
    setHiddenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const renderCell = (row, col) => {
    if (col.isCustom) {
      return row.extra_fields?.[col.originalName] ?? "—";
    }
    const val = row[col.key];
    if (col.key === "address") {
      return (
        <ClickableAddressCell
          value={val}
          onClick={() => {
            setDrawerError("");
            setDrawerRow(row);
          }}
        />
      );
    }
    if (col.key === "fio") {
      return (
        <span
          className="table-fio-badge"
          onClick={() => {
            setDrawerError("");
            setDrawerRow(row);
          }}
        >
          {val || "—"}
        </span>
      );
    }
    if (col.key === "status") {
      if (!val) return "—";
      let statusClass = "status-pending";
      const s = String(val).toLowerCase();
      if (s.includes("выкуп")) statusClass = "status-approved";
      else if (s.includes("аренд")) statusClass = "status-rent";
      else if (s.includes("общежит")) statusClass = "status-hostel";
      else if (s.includes("гостинич")) statusClass = "status-hotel";
      
      return (
        <span className={`table-status-badge ${statusClass}`}>
          {val}
        </span>
      );
    }
    if (["initial_cost", "market_price", "reimbursement_cost_monthly", "taxable_base", "total_area"].includes(col.key)) {
      return val != null ? formatNum(val) : "—";
    }
    return val || "—";
  };


  const drawerBlocks = useMemo(() => buildHousingDrawerFields(localCustomHeaders), [localCustomHeaders]);

  const exportColumns = useMemo(
    () => [
      ...HOUSING_RECORD_FIELDS.map((f) => ({ key: f.key, label: f.label })),
      ...localCustomHeaders.map((h) => ({
        key: h,
        label: h,
        getValue: (row) => row.extra_fields?.[h] ?? "",
      })),
    ],
    [localCustomHeaders]
  );

  const handleAddColumn = async (name) => {
    const data = await addHousingColumn(name);
    setLocalRows(data.rows);
    setLocalCustomHeaders(data.custom_headers);
    onDataChange?.(data);
    onRowsChange?.(data.rows);
    onCustomHeadersChange?.(data.custom_headers);
  };

  const handleSaveDrawer = async (draft) => {
    if (!drawerRow?.id) return;
    setSaving(true);
    setDrawerError("");
    try {
      const updated = await updateHousingRecord(drawerRow.id, housingDraftToPayload(draft, localCustomHeaders));
      const nextRows = localRows.map((x) => (x.id === drawerRow.id ? updated : x));
      setLocalRows(nextRows);
      onRowsChange?.(nextRows);
      setDrawerRow(null);
      onRefresh?.();
    } catch (err) {
      setDrawerError(parseErrorDetail(err?.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="table-page">
      <div className="table-page-header">{title ? <h1 className="complex-working-title">{title}</h1> : null}</div>

      <div className="table-toolbar">
        <label className="complex-working-filter">
          Поиск по ФИО
          <input className="complex-working-input" value={fioSearch} onChange={(e) => setFioSearch(e.target.value)} />
        </label>
        <label className="complex-working-filter">
          Поиск по адресу
          <input className="complex-working-input" value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)} />
        </label>
        <label className="complex-working-filter">
          ЖК
          <select className="complex-working-select" value={complexName} onChange={(e) => setComplexName(e.target.value)}>
            <option value="">Все ЖК</option>
            {complexOptions.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="complex-working-filter">
          Должность
          <select className="complex-working-select" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">Все должности</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="complex-working-filter">
          Статус
          <select className="complex-working-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {HOUSING_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="complex-working-filter">
          Условия приобретения
          <select className="complex-working-select" value={acquisition} onChange={(e) => setAcquisition(e.target.value)}>
            {ACQUISITION_CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <div className="table-toolbar-actions">
          <span className="budget-excel-count">Показано: {filtered.length} из {localRows.length}</span>
          
          <div className="column-selector-container">
            <button
              type="button"
              className="column-selector-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span>{menuOpen ? "−" : "+"} Управление столбцами</span>
            </button>
            {menuOpen && (
              <div className="column-selector-dropdown">
                <div className="column-selector-dropdown-header">
                  <span>Столбцы</span>
                  <button
                    type="button"
                    className="button-link-accent"
                    onClick={() => setHiddenKeys([])}
                  >
                    Показать все
                  </button>
                </div>
                <div className="column-selector-dropdown-list">
                  {columns.map((col) => (
                    <label key={col.key} className="column-selector-item">
                      <input
                        type="checkbox"
                        checked={!hiddenKeys.includes(col.key)}
                        onChange={() => toggleVisibility(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ExportExcelButton filename="ДЖСВ_База_сотрудников.xlsx" columns={exportColumns} rows={filtered} />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table-excel table-social-housing">
          <thead>
            <tr>
              {columns.map((col) => {
                if (hiddenKeys.includes(col.key)) return null;
                let className = "";
                if (col.key === "residential_complex_name") className = "col-complex";
                else if (col.key === "address") className = "col-address sticky-col-1";
                else if (col.key === "fio") className = "col-fio sticky-col-2";
                else if (col.key === "family_composition") className = "col-family";
                else if (["initial_cost", "market_price", "reimbursement_cost_monthly", "taxable_base", "room_count", "total_area", "build_year"].includes(col.key)) className = "col-number";
                else if (col.key === "status") className = "col-status";
                else if (col.key === "position") className = "col-position";
                else if (col.key === "occupancy_and_purchase_basis") className = "col-basis";
                else if (col.isCustom) className = "col-custom";
                
                return (
                  <th key={col.key} className={className}>
                    {col.key === 'address' ? (
                      <span className="th-with-icon">
                        <MapPin size={12} className="th-pin-icon" />
                        {col.label}
                      </span>
                    ) : col.key === 'fio' ? (
                      <span className="th-with-icon">
                        <MapPin size={12} className="th-pin-icon" />
                        {col.label}
                      </span>
                    ) : col.label}
                  </th>
                );
              })}
              <AddColumnHeader onAdd={handleAddColumn} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => {
                  if (hiddenKeys.includes(col.key)) return null;
                  
                  let className = "complex-wt-left";
                  if (col.key === "address") {
                    className = "complex-wt-left col-address sticky-col-1";
                  } else if (col.key === "fio") {
                    className = "complex-wt-left col-fio sticky-col-2";
                  } else if (["initial_cost", "market_price", "reimbursement_cost_monthly", "taxable_base", "total_area"].includes(col.key)) {
                    className = "complex-wt-num";
                  } else if (["room_count", "build_year"].includes(col.key)) {
                    className = "complex-wt-num";
                  }
                  
                  return (
                    <td key={col.key} className={className}>
                      {renderCell(row, col)}
                    </td>
                  );
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecordDetailDrawer
        open={Boolean(drawerRow)}
        title={drawerRow?.fio || "Карточка сотрудника"}
        subtitle={drawerRow?.address || ""}
        blocks={drawerBlocks}
        initialValues={drawerRow ? rowToHousingDraft(drawerRow, localCustomHeaders) : {}}
        saving={saving}
        error={drawerError}
        onClose={() => setDrawerRow(null)}
        onSave={handleSaveDrawer}
      />
    </section>
  );
}
