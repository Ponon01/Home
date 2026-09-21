import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Eye, Upload, X, Pencil } from "lucide-react";
import Loading from "../Loading";
import { getHousingFundApartment } from "../../api/housingFund";
import { downloadDocument, openDocument, uploadDocument } from "../../api/documents";
import { useLanguage } from "../../context/LanguageContext";
import { formatPeople, statusLabel, statusLabelPlain } from "../../i18n/housingCard";
import EditApartmentModal from "./EditApartmentModal";
import "./housing-fund.css";

function formatMoney(value) {
  if (value == null || value === "") return "—";
  return `${Number(value).toLocaleString("ru-RU")} тг`;
}

function formatArea(value, empty = "—") {
  if (value == null || value === "") return empty;
  return `${Number(value).toLocaleString("ru-RU")} м²`;
}

function fullComplexTitle(name, t) {
  const raw = (name || "").trim();
  if (!raw) return t("complexFallback");
  const lower = raw.toLowerCase();
  if (lower.startsWith("жилой комплекс") || lower.startsWith("тұрғын үй кешені") || lower.startsWith("жк ")) {
    return raw;
  }
  return `${t("complexPrefix")} ${raw}`;
}

function usageFormatLabel(apt, occupantCount, t) {
  const key = apt?.status_key;
  const complex = (apt?.residential_complex_name || "").toLowerCase();
  if (key === "guest") return t("usageGuest");
  if (complex.includes("общежит") || occupantCount > 1) return t("usageDorm");
  return t("usageFamily");
}

function localizeRoomTitle(room, lang, t) {
  if (room.room_number) {
    const areaPart =
      room.room_area != null ? ` — ${Number(room.room_area).toLocaleString("ru-RU")} ${t("sqm")}` : "";
    const people = formatPeople(lang, room.occupants?.length || 0);
    return `${t("room")} ${room.room_number}${areaPart} (${people})`;
  }
  const n = room.occupants?.length || 0;
  if (n > 1) return `${t("occupants")} (${n})`;
  return t("occupant");
}

function ResidentDocsAccordion({ occupant, apartmentId, onUploaded, t }) {
  const [open, setOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRefs = useRef({});
  const checklist = occupant.document_checklist || [];
  const uploadedCount = checklist.filter((s) => s.uploaded).length;

  const handleFileChange = async (slot, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingKey(slot.key);
    setUploadError("");
    try {
      await uploadDocument({
        apartmentId,
        documentType: slot.document_type,
        checklistKey: slot.key,
        residentId: occupant.id,
        file,
      });
      onUploaded?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || t("uploadFailed");
      setUploadError(typeof msg === "string" ? msg : t("uploadFailed"));
    } finally {
      setUploadingKey("");
    }
  };

  return (
    <div className="hf-resident-docs">
      <button
        type="button"
        className={`hf-docs-toggle${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          {t("residentDocs")}
          <span className="hf-docs-count">
            {uploadedCount}/{checklist.length}
          </span>
        </span>
        <ChevronDown size={18} className="hf-docs-chevron" />
      </button>
      <div className={`hf-docs-panel${open ? " is-open" : ""}`}>
        <div className="hf-docs-panel-inner">
          {uploadError ? <p className="hf-docs-error">{uploadError}</p> : null}
          <ul className="hf-docs-list">
            {checklist.map((slot) => (
              <li key={`${occupant.id}-${slot.key}`} className={`hf-docs-item${slot.uploaded ? " is-uploaded" : ""}`}>
                <div className="hf-docs-item-main">
                  <span className={`hf-docs-status-dot${slot.uploaded ? " is-on" : ""}`} aria-hidden />
                  <div>
                    <div className="hf-docs-label">{slot.label}</div>
                    <div className="hf-docs-file muted">
                      {slot.uploaded && slot.document ? slot.document.file_name : t("fileMissing")}
                    </div>
                  </div>
                </div>
                <div className="hf-docs-actions">
                  <input
                    ref={(el) => {
                      fileInputRefs.current[slot.key] = el;
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    hidden
                    onChange={(e) => handleFileChange(slot, e)}
                  />
                  <button
                    type="button"
                    className="hf-docs-btn"
                    disabled={uploadingKey === slot.key}
                    onClick={() => fileInputRefs.current[slot.key]?.click()}
                  >
                    <Upload size={14} />
                    {uploadingKey === slot.key ? "…" : t("upload")}
                  </button>
                  {slot.uploaded && slot.document ? (
                    <>
                      <button type="button" className="hf-docs-btn" onClick={() => openDocument(slot.document.id)}>
                        <Eye size={14} /> {t("view")}
                      </button>
                      <button
                        type="button"
                        className="hf-docs-btn"
                        onClick={() => downloadDocument(slot.document.id, slot.document.file_name || "document")}
                      >
                        <Download size={14} /> {t("download")}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function OccupantBlock({ occupant, apartmentId, apartment, onUploaded, t, lang }) {
  return (
    <article className="hf-occupant-card">
      <dl className="hf-occupant-grid">
        <div>
          <dt>{t("fullName")}</dt>
          <dd>{occupant.full_name}</dd>
        </div>
        <div>
          <dt>{t("position")}</dt>
          <dd>{occupant.position || t("empty")}</dd>
        </div>
        <div>
          <dt>{t("department")}</dt>
          <dd>{occupant.department || t("empty")}</dd>
        </div>
        <div>
          <dt>{t("contractType")}</dt>
          <dd>
            {occupant.occupancy_basis ||
              statusLabelPlain(lang, occupant.status_key) ||
              occupant.contract_type ||
              t("empty")}
          </dd>
        </div>
        <div>
          <dt>{t("contract")}</dt>
          <dd>{occupant.contract_number || t("empty")}</dd>
        </div>
        <div>
          <dt>{t("monthlyPayment")}</dt>
          <dd>{formatMoney(occupant.monthly_payment)}</dd>
        </div>
      </dl>

      {apartment && (
        <div className="hf-occupant-financial">
          <div>
            <span className="hf-occupant-financial-label">Удержание из ЗП (2026):</span>
            <span className="hf-occupant-financial-value">
              {apartment.monthly_deduction ? `${apartment.monthly_deduction.toLocaleString()} тг` : "—"}
            </span>
          </div>
          <div>
            <span className="hf-occupant-financial-label">Себестоимость (амортизация):</span>
            <span className="hf-occupant-financial-value">
              {apartment.amortization_cost ? `${apartment.amortization_cost.toLocaleString()} тг` : "—"}
            </span>
          </div>
          <div>
            <span className="hf-occupant-financial-label">Налогооблагаемая база:</span>
            <span className="hf-occupant-financial-value">
              {apartment.taxable_base ? `${apartment.taxable_base.toLocaleString()} тг` : "—"}
            </span>
          </div>
        </div>
      )}

      <ResidentDocsAccordion occupant={occupant} apartmentId={apartmentId} onUploaded={onUploaded} t={t} />
    </article>
  );
}

export default function ApartmentDetailDrawer({ apartmentId, onClose, onChanged }) {
  const { lang, t } = useLanguage();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const loadDetail = (showSpinner = true) => {
    if (!apartmentId) return;
    if (showSpinner) setLoading(true);
    setError("");
    getHousingFundApartment(apartmentId)
      .then((data) => setDetail(data))
      .catch(() => setError(t("loadFailed")))
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    if (!apartmentId) return undefined;
    setDetail(null);
    loadDetail(true);

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apartmentId]);

  if (!apartmentId) return null;

  const apt = detail?.apartment;
  const empty = t("empty");
  const house = detail?.house_number;
  const occupants = detail?.occupants || [];
  const occupantCount = occupants.length;
  const rooms = detail?.rooms?.length
    ? detail.rooms
    : occupantCount
      ? [{ title: t("occupants"), occupants, room_number: null, room_area: null }]
      : [];

  const personalAccount = detail?.personal_account
    ? t("personalAccountNo", { n: detail.personal_account })
    : empty;
  let statusText = apt?.status_key ? statusLabel(lang, apt.status_key) : empty;
  if (apt && (apt.residential_complex_name || "").trim() === "Жагалау-3") {
    if (apt.apartment_number === "43" || apt.apartment_number === "44") {
      statusText = lang === "kk" ? "🟡 Жатақхана" : "🟡 Общежитие";
    } else if (apt.status_key === "sold") {
      statusText = lang === "kk" ? "🔴 Сатып алу (100%)" : "🔴 Выкуп (100%)";
    }
  }
  const entrance = apt?.entrance || empty;
  const floor = apt?.floor ?? empty;

  return (
    <div className="hf-modal-root" role="presentation">
      <div className="hf-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="hf-modal" role="dialog" aria-modal="true" aria-labelledby="hf-apt-modal-title">
        <div className="hf-modal-head">
          <div className="hf-modal-head-main">
            <p className="hf-modal-complex">{fullComplexTitle(apt?.residential_complex_name, t)}</p>
            <div className="hf-modal-apt-line">
              <h2 id="hf-apt-modal-title" className="hf-modal-apt-title">
                {t("apartmentTitle", { n: apt?.apartment_number || empty })}
                {house ? ` (д. ${house})` : ""}
              </h2>
              <span className="hf-modal-apt-meta">
                {t("entranceFloor", { entrance, floor })}
              </span>
            </div>
          </div>
          <button type="button" className="hf-modal-close" onClick={onClose} aria-label={t("close")}>
            <X size={20} />
          </button>
        </div>

        <div className="hf-modal-body">
          {loading && <Loading />}
          {error && <div className="state error">{error}</div>}

          {!loading && detail && (
            <>
              <section className="hf-metrics-grid" aria-label={t("apartmentCard")}>
                <div className="hf-metric-card">
                  <div className="hf-metric-label">{t("usageFormat")}</div>
                  <div className="hf-metric-value">{usageFormatLabel(apt, occupantCount, t)}</div>
                </div>
                <div className="hf-metric-card">
                  <div className="hf-metric-label">{t("livesCount")}</div>
                  <div className="hf-metric-value">{t("livesCountValue", { n: occupantCount })}</div>
                </div>
                <div className="hf-metric-card">
                  <div className="hf-metric-label">{t("area")}</div>
                  <div className="hf-metric-value">{formatArea(apt?.total_area, empty)}</div>
                </div>
                <div className="hf-metric-card">
                  <div className="hf-metric-label">{t("personalAccount")}</div>
                  <div className="hf-metric-value">{personalAccount}</div>
                </div>
                <div className="hf-metric-card hf-metric-status">
                  <div className="hf-metric-label">{t("status")}</div>
                  <div className={`hf-metric-value hf-status-pill status-${apt?.status_key || "rent"}`}>
                    {statusText}
                  </div>
                </div>
              </section>

              <section className="hf-detail-block">
                <h3>{t("residents")}</h3>
                {!rooms.length ? (
                  <p className="muted">{t("vacant")}</p>
                ) : (
                  <div className="hf-rooms">
                    {rooms.map((room) => (
                      <div key={`${room.room_number || "x"}-${room.title}`} className="hf-room-block">
                        <h4 className="hf-room-title">{localizeRoomTitle(room, lang, t)}</h4>
                        <div className="hf-room-occupants">
                          {(room.occupants || []).map((occ) => (
                            <OccupantBlock
                              key={occ.id}
                              occupant={occ}
                              apartmentId={apt.id}
                              apartment={apt}
                              onUploaded={() => loadDetail(false)}
                              t={t}
                              lang={lang}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {detail.history?.length ? (
                <section className="hf-detail-block">
                  <h3>{t("history")}</h3>
                  <ul className="hf-history-list">
                    {detail.history.map((item) => (
                      <li key={item.resident_id} className={`hf-history-item${item.is_active ? " is-active" : ""}`}>
                        <div className="hf-history-top">
                          <strong>{item.full_name}</strong>
                          <span className="hf-history-badge">{item.is_active ? t("current") : t("archive")}</span>
                        </div>
                        <div className="hf-history-meta">
                          {[item.position, item.department, item.occupancy_basis].filter(Boolean).join(" · ") || empty}
                        </div>
                        {item.note ? <div className="hf-history-note">{item.note}</div> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        <div className="hf-modal-foot">
          <button type="button" className="hf-docs-btn hf-docs-btn-primary" onClick={() => setEditing(true)} disabled={!detail}>
            <Pencil size={16} /> Редактировать данные
          </button>
          <button type="button" className="hf-docs-btn" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>

      {editing && detail ? (
        <EditApartmentModal
          detail={detail}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            loadDetail(false);
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}
