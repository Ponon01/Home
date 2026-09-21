import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  downloadDocument,
  listDocuments,
  openDocument,
  uploadDocument,
} from "../api/documents";
import { updateApartment, updateResident } from "../api/apartments";
import { updatePurchaseFinancial, updateRentalFinancial } from "../api/housingData";
import { formatNum, pickDocsByType } from "../utils/apartmentRowData";

const HOUSING_LABEL = {
  rent: "Аренда",
  purchase: "Покупка",
};

const SUBTYPE_LABEL = {
  rent: "Аренда",
  guest: "Гостевой",
  guest_gph: "Гостевой ГПХ",
  full_sold: "Продано",
  installment: "Рассрочка",
};

const DOC_TYPES = [
  { key: "rental_contract", apiType: "rental_contract", title: "Договор найма" },
  { key: "protocol", apiType: "protocol", title: "Протокол" },
  { key: "purchase_contract", apiType: "purchase_contract", title: "Договор купли-продажи" },
  { key: "payment_schedule", apiType: "payment_schedule", title: "График платежей" },
  { key: "act", apiType: "act", title: "Право собственности / акт приема-передачи" },
];

function parseErrorDetail(detail) {
  if (Array.isArray(detail)) {
    return detail.map((x) => x?.msg || JSON.stringify(x)).join("; ");
  }
  if (typeof detail === "string") return detail;
  return "Ошибка сохранения";
}

function toNumOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildDraft(row) {
  const a = row.apartment || {};
  const r = row.resident || {};
  const rf = row.rental || {};
  const pf = row.purchase || {};
  const marketPrice = rf.market_price ?? pf.valuation_cost;
  return {
    address: a.address || row.address || "",
    fio: row.fio || r.full_name || "",
    family_composition: r.family_composition || "",
    position: r.position || "",
    department: r.department || "",
    occupancy_basis: r.occupancy_basis || "",
    purchase_basis_protocol: pf.realization_period || "",
    initial_cost: pf.initial_cost ?? "",
    market_price: marketPrice ?? "",
    reimbursement_cost_monthly: rf.reimbursement_cost_monthly ?? "",
    taxable_base: rf.taxable_base ?? "",
    room_count: a.room_count ?? "",
    total_area: a.total_area ?? "",
    build_year: a.build_year ?? "",
    personal_account: a.personal_account || "",
  };
}

export default function ComplexWorkingTable({ rows = [], complexName }) {
  const [localRows, setLocalRows] = useState(rows);
  const [search, setSearch] = useState("");
  const [housingType, setHousingType] = useState("");
  const [subtype, setSubtype] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [onlyWithDocs, setOnlyWithDocs] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rowError, setRowError] = useState("");
  const [rowMessage, setRowMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [fileByKey, setFileByKey] = useState({});

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const statusOptions = useMemo(() => {
    const s = new Set();
    localRows.forEach((r) => {
      const st = r.apartment?.status;
      if (st && String(st).trim()) s.add(String(st).trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [localRows]);

  const departmentOptions = useMemo(() => {
    const s = new Set();
    localRows.forEach((r) => {
      const d = r.resident?.department;
      if (d && String(d).trim()) s.add(String(d).trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ru"));
  }, [localRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localRows.filter((row) => {
      if (q) {
        const fio = (row.fio || "").toLowerCase();
        const addr = (row.address || "").toLowerCase();
        if (!fio.includes(q) && !addr.includes(q)) return false;
      }
      if (housingType && row.apartment.housing_type !== housingType) return false;
      if (subtype && row.apartment.apartment_subtype !== subtype) return false;
      if (status && (row.apartment.status || "").trim() !== status) return false;
      if (department && (row.resident?.department || "").trim() !== department) return false;
      if (onlyWithDocs) {
        const has = DOC_TYPES.some((t) => row.documents?.[t.key]);
        if (!has) return false;
      }
      return true;
    });
  }, [localRows, search, housingType, subtype, status, department, onlyWithDocs]);

  const onEdit = (row) => {
    setEditingId(row.apartment?.id || null);
    setDraft(buildDraft(row));
    setRowError("");
    setRowMessage("");
  };

  const onCancel = () => {
    setEditingId(null);
    setDraft(null);
    setRowError("");
  };

  const onSave = async (row) => {
    const a = row.apartment || {};
    const r = row.resident || null;
    const rf = row.rental || null;
    const pf = row.purchase || null;
    const rowId = a.id;
    if (!rowId || !draft) return;

    const apartmentPayload = {
      address: draft.address.trim(),
      room_count: toNumOrNull(draft.room_count),
      total_area: toNumOrNull(draft.total_area),
      build_year: toNumOrNull(draft.build_year),
      personal_account: draft.personal_account.trim() || null,
    };

    const residentPayload = {
      full_name: draft.fio.trim(),
      family_composition: draft.family_composition.trim() || null,
      position: draft.position.trim() || null,
      department: draft.department.trim() || null,
      occupancy_basis: draft.occupancy_basis.trim() || null,
    };

    const rentalPayload = rf
      ? {
          market_price: toNumOrNull(draft.market_price),
          reimbursement_cost_monthly: toNumOrNull(draft.reimbursement_cost_monthly),
          taxable_base: toNumOrNull(draft.taxable_base),
        }
      : null;

    const purchasePayload = pf
      ? {
          initial_cost: toNumOrNull(draft.initial_cost),
          valuation_cost: rf ? undefined : toNumOrNull(draft.market_price),
          realization_period: draft.purchase_basis_protocol.trim() || null,
        }
      : null;

    setSaving(true);
    setRowError("");
    try {
      const updatedApartment = await updateApartment(rowId, apartmentPayload);
      let updatedResident = r;
      let updatedRental = rf;
      let updatedPurchase = pf;

      if (r?.id) {
        updatedResident = await updateResident(r.id, residentPayload);
      } else if (
        residentPayload.full_name ||
        residentPayload.family_composition ||
        residentPayload.position ||
        residentPayload.department ||
        residentPayload.occupancy_basis
      ) {
        setRowError("Нет привязанного жильца: поля ФИО и т.п. не сохранены");
        setSaving(false);
        return;
      }

      if (rf?.id && rentalPayload) {
        updatedRental = await updateRentalFinancial(rf.id, rentalPayload);
      }
      if (pf?.id && purchasePayload) {
        updatedPurchase = await updatePurchaseFinancial(pf.id, purchasePayload);
      }

      setLocalRows((prev) =>
        prev.map((x) => {
          if (x.apartment?.id !== rowId) return x;
          const next = {
            ...x,
            apartment: { ...x.apartment, ...updatedApartment },
            resident: updatedResident ? { ...x.resident, ...updatedResident } : x.resident,
            rental: updatedRental ? { ...x.rental, ...updatedRental } : x.rental,
            purchase: updatedPurchase ? { ...x.purchase, ...updatedPurchase } : x.purchase,
          };
          next.address = next.apartment?.address || next.address;
          next.fio = next.resident?.full_name || next.fio;
          return next;
        })
      );
      onCancel();
      setRowMessage("Изменения сохранены");
    } catch (err) {
      const statusCode = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (statusCode === 403) {
        setRowError("Недостаточно прав (403)");
      } else {
        setRowError(parseErrorDetail(detail));
      }
    } finally {
      setSaving(false);
    }
  };

  const docKeyFor = (rowId, docKey) => `${rowId}:${docKey}`;

  const onUploadDoc = async (row, docDef) => {
    const apartmentId = row.apartment?.id;
    if (!apartmentId) return;
    const key = docKeyFor(apartmentId, docDef.key);
    const file = fileByKey[key];
    if (!file) {
      setRowError("Выберите файл для загрузки");
      return;
    }
    setUploadingKey(key);
    setRowError("");
    setRowMessage("");
    try {
      await uploadDocument({
        apartmentId,
        documentType: docDef.apiType,
        file,
      });
      const docs = await listDocuments({ apartment_id: apartmentId, limit: 200 });
      const byType = pickDocsByType(docs || []);
      setLocalRows((prev) =>
        prev.map((x) => (x.apartment?.id === apartmentId ? { ...x, documents: byType } : x))
      );
      setFileByKey((prev) => ({ ...prev, [key]: null }));
      setRowMessage(`Документ «${docDef.title}» загружен`);
    } catch (err) {
      const statusCode = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (statusCode === 403) {
        setRowError("Недостаточно прав для загрузки документа (403)");
      } else {
        setRowError(parseErrorDetail(detail));
      }
    } finally {
      setUploadingKey("");
    }
  };

  const renderDocCell = (row, docDef) => {
    const apartmentId = row.apartment?.id;
    if (!apartmentId) return null;
    const key = docKeyFor(apartmentId, docDef.key);
    const selectedFile = fileByKey[key] || null;
    const doc = row.documents?.[docDef.key] || null;
    const hasFile = Boolean(doc);
    const inputId = `complex-doc-${apartmentId}-${docDef.key}`;
    return (
      <div className="doc-cell">
        <div className="doc-file-name">{hasFile ? doc.file_name : "Нет файла"}</div>
        {hasFile ? (
          <div className="doc-actions">
            <button type="button" className="btn-small btn-secondary" onClick={() => openDocument(doc.id)}>
              Открыть
            </button>
            <button
              type="button"
              className="btn-small btn-secondary"
              onClick={() => downloadDocument(doc.id, doc.file_name || "document")}
            >
              Скачать
            </button>
          </div>
        ) : null}
        <input
          id={inputId}
          type="file"
          className="doc-input-hidden"
          onChange={(e) =>
            setFileByKey((prev) => ({
              ...prev,
              [key]: e.target.files?.[0] || null,
            }))
          }
        />
        <div className="doc-actions">
          <label htmlFor={inputId} className="btn-small btn-secondary">
            Выбрать файл
          </label>
          <button
            type="button"
            className="btn-small btn-primary"
            disabled={uploadingKey === key || !selectedFile}
            onClick={() => onUploadDoc(row, docDef)}
          >
            {uploadingKey === key ? "…" : hasFile ? "Заменить" : "Загрузить"}
          </button>
        </div>
        {selectedFile ? <div className="doc-file-name">Выбрано: {selectedFile.name}</div> : null}
      </div>
    );
  };

  const colCount = 17 + DOC_TYPES.length + 1;

  return (
    <div className="complex-working-root table-page">
      <h1 className="complex-working-title">ЖК: {complexName}</h1>
      <p className="muted complex-working-sub">
        <Link to="/">На главную</Link>
        <span className="complex-working-count">
          {" "}
          · Показано: {filtered.length} из {localRows.length}
        </span>
      </p>

      <div className="complex-working-filters table-toolbar">
        <label className="complex-working-filter">
          Поиск (ФИО / адрес)
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Введите текст…"
            className="complex-working-input"
          />
        </label>
        <label className="complex-working-filter">
          Тип жилья
          <select
            className="complex-working-select"
            value={housingType}
            onChange={(e) => setHousingType(e.target.value)}
          >
            <option value="">Все</option>
            <option value="rent">Аренда</option>
            <option value="purchase">Покупка</option>
          </select>
        </label>
        <label className="complex-working-filter">
          Подтип
          <select className="complex-working-select" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            <option value="">Все</option>
            <option value="rent">Аренда</option>
            <option value="guest">Гостевой</option>
            <option value="guest_gph">Гостевой ГПХ</option>
            <option value="full_sold">Продано</option>
            <option value="installment">Рассрочка</option>
          </select>
        </label>
        <label className="complex-working-filter">
          Статус
          <select className="complex-working-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </label>
        <label className="complex-working-filter">
          Подразделение
          <select
            className="complex-working-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Все</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="complex-working-filter complex-working-toggle">
          <input type="checkbox" checked={onlyWithDocs} onChange={(e) => setOnlyWithDocs(e.target.checked)} />
          Только с документами
        </label>
      </div>

      {rowError ? <div className="state error manual-summary-row-err">{rowError}</div> : null}
      {rowMessage ? <div className="state manual-summary-row-err">{rowMessage}</div> : null}

      <div className="table-wrapper">
        <table className="table-excel table-complex-working">
          <thead>
            <tr>
              <th className="col-address sticky-col-1">Адрес</th>
              <th className="col-fio sticky-col-2">ФИО</th>
              <th className="col-family">Состав семьи</th>
              <th className="col-status col-nowrap">Тип жилья</th>
              <th className="col-status col-nowrap">Подтип</th>
              <th className="col-status col-nowrap">Статус</th>
              <th className="col-number col-nowrap">Комнат</th>
              <th className="col-number col-nowrap">Общ. пл.</th>
              <th className="col-number col-nowrap">Год постр.</th>
              <th className="col-status col-nowrap">Лицевой счёт</th>
              <th className="col-position">Должность</th>
              <th className="col-department">Подразделение</th>
              <th className="col-number col-nowrap">Первонач. стоимость</th>
              <th className="col-number col-nowrap">Рыночная цена</th>
              <th className="col-number col-nowrap">Удержание из ЗП</th>
              <th className="col-number col-nowrap">Налогообл. база</th>
              <th className="col-basis">Основание заселения / протокол</th>
              {DOC_TYPES.map((d) => (
                <th key={d.key} className="complex-working-th-doc col-doc">
                  {d.title}
                </th>
              ))}
              <th className="col-nowrap">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="complex-wt-empty">
                  Нет строк по текущим фильтрам
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const apt = row.apartment;
                const res = row.resident;
                const rental = row.rental;
                const purchase = row.purchase;
                const marketPrice = rental?.market_price ?? purchase?.valuation_cost;
                const isEditing = editingId === apt.id && draft;
                const occBasis = res?.occupancy_basis?.trim();
                const protLine = purchase?.realization_period?.trim();

                return (
                  <tr key={apt.id}>
                    <td className="complex-wt-left col-address sticky-col-1">
                      {isEditing ? (
                        <input
                          className="manual-summary-input"
                          value={draft.address}
                          onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                        />
                      ) : (
                        row.address || "—"
                      )}
                    </td>
                    <td className="complex-wt-left col-fio sticky-col-2">
                      {isEditing ? (
                        <input
                          className="manual-summary-input"
                          value={draft.fio}
                          onChange={(e) => setDraft((d) => ({ ...d, fio: e.target.value }))}
                        />
                      ) : (
                        row.fio || "—"
                      )}
                    </td>
                    <td className="complex-wt-left col-family">
                      {isEditing ? (
                        <input
                          className="manual-summary-input"
                          value={draft.family_composition}
                          onChange={(e) => setDraft((d) => ({ ...d, family_composition: e.target.value }))}
                        />
                      ) : (
                        res?.family_composition || "—"
                      )}
                    </td>
                    <td className="complex-wt-left col-nowrap">
                      {HOUSING_LABEL[apt.housing_type] || apt.housing_type || "—"}
                    </td>
                    <td className="complex-wt-left col-nowrap">
                      {SUBTYPE_LABEL[apt.apartment_subtype] || apt.apartment_subtype || "—"}
                    </td>
                    <td className="complex-wt-left col-nowrap">{apt.status || "—"}</td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.room_count}
                          onChange={(e) => setDraft((d) => ({ ...d, room_count: e.target.value }))}
                        />
                      ) : apt.room_count != null ? (
                        apt.room_count
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.total_area}
                          onChange={(e) => setDraft((d) => ({ ...d, total_area: e.target.value }))}
                        />
                      ) : (
                        formatNum(apt.total_area)
                      )}
                    </td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.build_year}
                          onChange={(e) => setDraft((d) => ({ ...d, build_year: e.target.value }))}
                        />
                      ) : apt.build_year != null ? (
                        apt.build_year
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="complex-wt-left col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input"
                          value={draft.personal_account}
                          onChange={(e) => setDraft((d) => ({ ...d, personal_account: e.target.value }))}
                        />
                      ) : (
                        apt.personal_account || "—"
                      )}
                    </td>
                    <td className="complex-wt-left col-position">
                      {isEditing ? (
                        <input
                          className="manual-summary-input"
                          value={draft.position}
                          onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
                        />
                      ) : (
                        res?.position || "—"
                      )}
                    </td>
                    <td className="complex-wt-left col-department">
                      {isEditing ? (
                        <input
                          className="manual-summary-input"
                          value={draft.department}
                          onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))}
                        />
                      ) : (
                        res?.department || "—"
                      )}
                    </td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.initial_cost}
                          onChange={(e) => setDraft((d) => ({ ...d, initial_cost: e.target.value }))}
                        />
                      ) : (
                        formatNum(purchase?.initial_cost)
                      )}
                    </td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.market_price}
                          onChange={(e) => setDraft((d) => ({ ...d, market_price: e.target.value }))}
                        />
                      ) : (
                        formatNum(marketPrice)
                      )}
                    </td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.reimbursement_cost_monthly}
                          onChange={(e) => setDraft((d) => ({ ...d, reimbursement_cost_monthly: e.target.value }))}
                        />
                      ) : (
                        formatNum(rental?.reimbursement_cost_monthly)
                      )}
                    </td>
                    <td className="complex-wt-num col-nowrap">
                      {isEditing ? (
                        <input
                          className="manual-summary-input manual-summary-input-num"
                          value={draft.taxable_base}
                          onChange={(e) => setDraft((d) => ({ ...d, taxable_base: e.target.value }))}
                        />
                      ) : (
                        formatNum(rental?.taxable_base)
                      )}
                    </td>
                    <td className="complex-wt-left col-basis">
                      {isEditing ? (
                        <div className="complex-wt-basis-edit">
                          <input
                            className="manual-summary-input"
                            placeholder="Основание заселения"
                            value={draft.occupancy_basis}
                            onChange={(e) => setDraft((d) => ({ ...d, occupancy_basis: e.target.value }))}
                          />
                          <input
                            className="manual-summary-input"
                            placeholder="Протокол / основание выкупа"
                            value={draft.purchase_basis_protocol}
                            onChange={(e) => setDraft((d) => ({ ...d, purchase_basis_protocol: e.target.value }))}
                          />
                        </div>
                      ) : !occBasis && !protLine ? (
                        "—"
                      ) : (
                        <>
                          {occBasis ? <div>{occBasis}</div> : null}
                          {protLine ? <div className="complex-wt-protocol-line">{protLine}</div> : null}
                        </>
                      )}
                    </td>
                    {DOC_TYPES.map((d) => (
                      <td key={d.key} className="complex-wt-doc-cell col-doc">
                        {renderDocCell(row, d)}
                      </td>
                    ))}
                    <td className="complex-wt-left col-nowrap">
                      {isEditing ? (
                        <>
                          <button type="button" className="button" disabled={saving} onClick={() => onSave(row)}>
                            {saving ? "…" : "Сохранить"}
                          </button>{" "}
                          <button type="button" className="button button-ghost" disabled={saving} onClick={onCancel}>
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button type="button" className="button button-ghost" onClick={() => onEdit(row)}>
                          Редактировать
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
