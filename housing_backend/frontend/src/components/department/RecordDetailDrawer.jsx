import { useEffect, useState } from "react";
import { X, MapPin } from "lucide-react";
import "./record-detail-drawer.css";

export default function RecordDetailDrawer({
  open,
  title,
  subtitle = "",
  blocks = [],
  initialValues = {},
  saving = false,
  error = "",
  extraContent = null,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (!open) return;
    const next = {};
    blocks.forEach((block) => {
      block.fields.forEach((field) => {
        next[field.key] = initialValues[field.key] ?? "";
      });
    });
    setDraft(next);
  }, [open, initialValues, blocks]);

  if (!open) return null;

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(draft);
  };

  // Intelligently identify FIO and Address to put FIO in the main heading
  const isAddressStr = (str) => {
    if (!str) return false;
    return /\d/.test(str) || /улиц|дом|кв|мкр|жк|ул\.|д\./i.test(str);
  };

  let displayFio = title || "Детальная карточка";
  let displaySub = subtitle || "";

  if (title && subtitle) {
    if (isAddressStr(title)) {
      displayFio = subtitle;
      displaySub = title;
    } else {
      displayFio = title;
      displaySub = subtitle;
    }
  }

  return (
    <>
      <div className="record-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="record-drawer" role="dialog" aria-modal="true" aria-label={displayFio}>
        <div className="record-drawer-head">
          <div className="record-drawer-head-top">
            <div>
              {displaySub ? <p className="record-drawer-title">{displaySub}</p> : null}
              <h2 className="record-drawer-subtitle">{displayFio}</h2>
            </div>
            <button type="button" className="record-drawer-close" onClick={onClose} aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>
        </div>

        <form className="record-drawer-body" onSubmit={handleSubmit}>
          {blocks.map((block) => {
            const isPersonal = block.title.toLowerCase().includes("личные");
            return (
              <section key={block.title} className={`record-drawer-block ${isPersonal ? "personal-block" : ""}`}>
                <h3 className="record-drawer-block-title">{block.title}</h3>
                <div className={isPersonal ? "personal-plaques-grid" : "record-drawer-fields"}>
                  {block.fields.map((field) => {
                    const val = draft[field.key] ?? "";
                    if (isPersonal) {
                      return (
                        <div key={field.key} className="personal-plaque">
                          <span className="personal-plaque-label">{field.label}</span>
                          <div className="personal-plaque-value">
                            {val ? String(val) : <span className="plaque-empty">—</span>}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={field.key} className="record-drawer-field">
                        <label>
                          {field.label}
                          {field.type === "textarea" ? (
                            <textarea
                              className="record-drawer-textarea"
                              rows={field.rows || 3}
                              value={draft[field.key] ?? ""}
                              onChange={(e) => setField(field.key, e.target.value)}
                            />
                          ) : field.type === "select" ? (
                            <select
                              className="record-drawer-select"
                              value={draft[field.key] ?? ""}
                              onChange={(e) => setField(field.key, e.target.value)}
                            >
                              {(field.options || []).map((opt) => (
                                <option key={opt.value ?? opt} value={opt.value ?? opt}>
                                  {opt.label ?? opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="record-drawer-input"
                              type={field.type === "number" ? "number" : "text"}
                              value={draft[field.key] ?? ""}
                              onChange={(e) => setField(field.key, e.target.value)}
                            />
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {extraContent}
          {error ? <div className="state error">{error}</div> : null}
        </form>

        <div className="record-drawer-foot">
          <button type="button" className="record-drawer-btn record-drawer-btn-ghost" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button
            type="button"
            className="record-drawer-btn record-drawer-btn-primary"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </aside>
    </>
  );
}

export function ClickableAddressCell({ value, onClick, fallback = "—" }) {
  const text = value?.trim() ? value : fallback;
  if (!value?.trim()) {
    return <span className="muted">{fallback}</span>;
  }
  return (
    <button type="button" className="table-address-link" onClick={onClick}>
      <MapPin size={12} className="table-address-pin" />
      <span className="table-address-text">{text}</span>
    </button>
  );
}
