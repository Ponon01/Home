import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Generic admin edit modal.
 * fields: [{ key, label, type?: 'text'|'number'|'textarea'|'select', options?: string[] }]
 */
export default function AdminEditModal({
  open,
  title,
  fields = [],
  initialValues = {},
  saving = false,
  error = "",
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (open) {
      const next = {};
      fields.forEach((f) => {
        next[f.key] = initialValues[f.key] ?? "";
      });
      setDraft(next);
    }
  }, [open, initialValues, fields]);

  if (!open) return null;

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(draft);
  };

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="admin-modal admin-edit-modal">
        <div className="admin-modal-head">
          <div>
            <h3 className="admin-modal-title">{title}</h3>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Закрыть">
            <X size={22} />
          </button>
        </div>

        <form className="admin-edit-form" onSubmit={handleSubmit}>
          <div className="admin-edit-fields">
            {fields.map((field) => (
              <label key={field.key} className="housing-app-field">
                {field.label}
                {field.type === "textarea" ? (
                  <textarea
                    className="admin-modal-input admin-edit-textarea"
                    rows={field.rows || 3}
                    value={draft[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="admin-modal-input"
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
                    className="admin-modal-input"
                    type={field.type === "number" ? "number" : "text"}
                    value={draft[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>

          {error ? <div className="state error">{error}</div> : null}

          <div className="admin-modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="button admin-modal-primary" disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
