import { useEffect, useMemo, useState } from "react";
import {
  listHousingApplications,
  openFamilyMemberDocument,
  openHousingApplicationDocument,
  updateHousingApplication,
} from "../../api/housingApplications";
import { APPLICATION_STATUS_OPTIONS } from "../../config/housingRecordFields";
import { APPLICATION_TYPES } from "../../constants/housingApplicationTypes";
import ExportExcelButton from "./ExportExcelButton";
import RecordDetailDrawer from "./RecordDetailDrawer";
import "./housing-fund.css";
import "./housing-fund-executive.css";

const DOC_LINKS = [
  { field: "signed_application", label: "📄 Заявление", flag: "has_signed_application" },
  { field: "housing_certificate", label: "📄 Справка eGov", flag: "has_housing_certificate" },
  { field: "id_document", label: "📄 Удостоверение", flag: "has_id_document" },
];

const FAMILY_DOC_LINKS = [
  { field: "id_document", label: "📄 Удостоверение", flag: "has_id_document" },
  { field: "housing_certificate", label: "📄 Справка eGov", flag: "has_housing_certificate" },
];

const APPLICATION_EXPORT_COLUMNS = [
  { key: "id", label: "№" },
  { key: "created_at", label: "Дата", getValue: (row) => new Date(row.created_at).toLocaleString("ru-RU") },
  { key: "application_type", label: "Тип заявления" },
  { key: "fio", label: "ФИО" },
  { key: "position", label: "Должность" },
  { key: "department", label: "Отдел" },
  { key: "status_label", label: "Статус" },
];

const APPLICATION_DRAWER_BLOCKS = [
  {
    title: "Личные данные",
    fields: [
      { key: "application_type", label: "Тип заявления", type: "text" },
      { key: "fio", label: "ФИО", type: "text" },
      { key: "position", label: "Должность", type: "text" },
      { key: "department", label: "Отдел", type: "text" },
      {
        key: "status",
        label: "Статус",
        type: "select",
        options: APPLICATION_STATUS_OPTIONS,
      },
    ],
  },
];

const APPLICATION_TYPE_FILTERS = [
  { value: "all", label: "Все заявки" },
  ...APPLICATION_TYPES.map((item) => ({
    value: item.label,
    label: item.shortLabel,
  })),
];

function DocLinks({ row }) {
  return (
    <div className="housing-app-doc-links">
      {DOC_LINKS.map((doc) =>
        row[doc.flag] ? (
          <button
            key={doc.field}
            type="button"
            className="housing-app-doc-link"
            onClick={() => openHousingApplicationDocument(row.id, doc.field)}
          >
            {doc.label}
          </button>
        ) : null
      )}
    </div>
  );
}

function FamilyMembersCell({ row }) {
  const members = row.family_members || [];
  if (members.length === 0) return <span className="muted">—</span>;
  return (
    <div className="housing-app-family-list">
      {members.map((member) => (
        <div key={member.id} className="housing-app-family-row">
          <div className="housing-app-family-info">
            <strong>{member.fio}</strong>
            {member.relationship_degree ? <span className="muted"> ({member.relationship_degree})</span> : null}
          </div>
          <div className="housing-app-doc-links">
            {FAMILY_DOC_LINKS.map((doc) =>
              member[doc.flag] ? (
                <button
                  key={doc.field}
                  type="button"
                  className="housing-app-doc-link"
                  onClick={() => openFamilyMemberDocument(row.id, member.id, doc.field)}
                >
                  {doc.label}
                </button>
              ) : null
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HousingApplicationsAdminTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerRow, setDrawerRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [activeType, setActiveType] = useState("all");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listHousingApplications();
      setRows(data);
    } catch {
      setError("Не удалось загрузить заявления");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const drawerInitial = useMemo(() => {
    if (!drawerRow) return {};
    return {
      application_type: drawerRow.application_type || "",
      fio: drawerRow.fio || "",
      position: drawerRow.position || "",
      department: drawerRow.department || "",
      status: drawerRow.status || "",
    };
  }, [drawerRow]);

  const typeCounts = useMemo(() => {
    const counts = { all: rows.length };
    APPLICATION_TYPES.forEach((item) => {
      counts[item.label] = rows.filter((row) => row.application_type === item.label).length;
    });
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (activeType === "all") return rows;
    return rows.filter((row) => row.application_type === activeType);
  }, [rows, activeType]);

  const handleSave = async (draft) => {
    if (!drawerRow?.id) return;
    setSaving(true);
    setDrawerError("");
    try {
      const updated = await updateHousingApplication(drawerRow.id, {
        fio: draft.fio?.trim(),
        application_type: draft.application_type?.trim() || null,
        position: draft.position?.trim() || null,
        department: draft.department?.trim() || null,
        status: draft.status,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setDrawerRow(null);
    } catch (err) {
      setDrawerError(err?.response?.data?.detail || "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const drawerDocs = drawerRow ? (
    <section className="record-drawer-block">
      <h3 className="record-drawer-block-title">Документы заявителя</h3>
      <div className="housing-app-family-list">
        <DocLinks row={drawerRow} />
      </div>
      <h3 className="record-drawer-block-title" style={{ marginTop: 16 }}>Члены семьи</h3>
      <FamilyMembersCell row={drawerRow} />
    </section>
  ) : null;

  return (
    <section className="housing-app-admin-section">
      <h2 className="housing-app-admin-title">Заявления на жильё</h2>
      <p className="muted housing-app-admin-sub">
        Нажмите на ФИО, чтобы открыть карточку заявления
      </p>
      {loading && <p className="muted">Загрузка...</p>}
      {error && <p className="state error">{error}</p>}
      {!loading && !error && (
        <>
          <div className="housing-app-admin-toolbar">
            <ExportExcelButton
              filename="ДЖСВ_Заявления.xlsx"
              columns={APPLICATION_EXPORT_COLUMNS}
              rows={filteredRows}
            />
          </div>
          <div className="hf-status-chips housing-app-type-scroll" role="group" aria-label="Фильтр по типу заявления">
            {APPLICATION_TYPE_FILTERS.map((item) => {
              const count = typeCounts[item.value] ?? 0;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`hf-status-chip${activeType === item.value ? " is-active" : ""}`}
                  onClick={() => setActiveType(item.value)}
                  aria-pressed={activeType === item.value}
                >
                  {item.label} ({count})
                </button>
              );
            })}
          </div>
          <div className="table-wrapper housing-app-admin-scroll">
            <table className="table-excel housing-app-admin-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Тип заявления</th>
                  <th>ФИО</th>
                  <th>Должность</th>
                  <th>Отдел</th>
                  <th>Статус</th>
                  <th>Документы заявителя</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="muted">Заявлений по выбранному типу пока нет</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{new Date(row.created_at).toLocaleString("ru-RU")}</td>
                      <td>{row.application_type || "—"}</td>
                      <td>
                        <span
                          className="table-fio-badge"
                          onClick={() => {
                            setDrawerError("");
                            setDrawerRow(row);
                          }}
                        >
                          {row.fio}
                        </span>
                      </td>
                      <td>{row.position || "—"}</td>
                      <td>{row.department || "—"}</td>
                      <td><span className={`housing-app-status-badge status-${row.status}`}>{row.status_label}</span></td>
                      <td><DocLinks row={row} /></td>
                      <td>
                        <button
                          type="button"
                          className="button button-ghost hf-table-action"
                          onClick={() => {
                            setDrawerError("");
                            setDrawerRow(row);
                          }}
                        >
                          Открыть
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RecordDetailDrawer
        open={Boolean(drawerRow)}
        title={drawerRow?.fio || "Заявление"}
        subtitle={`Заявление №${drawerRow?.id || ""}`}
        blocks={APPLICATION_DRAWER_BLOCKS}
        initialValues={drawerInitial}
        saving={saving}
        error={drawerError}
        extraContent={drawerDocs}
        onClose={() => setDrawerRow(null)}
        onSave={handleSave}
      />
    </section>
  );
}
