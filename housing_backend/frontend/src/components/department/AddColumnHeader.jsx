import { useEffect, useRef, useState } from "react";
import "./record-detail-drawer.css";

export default function AddColumnHeader({ onAdd, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setName("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <th className="add-column-th">
      <div className="add-column-wrap" ref={wrapRef}>
        <button
          type="button"
          className="add-column-btn"
          title="Добавить столбец"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          +
        </button>
        {open ? (
          <div className="add-column-popover">
            <input
              type="text"
              placeholder="Название столбца"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setOpen(false);
              }}
              autoFocus
            />
            <div className="add-column-popover-actions">
              <button type="button" className="record-drawer-btn record-drawer-btn-ghost" onClick={() => setOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="record-drawer-btn record-drawer-btn-primary"
                disabled={saving || !name.trim()}
                onClick={submit}
              >
                {saving ? "..." : "Добавить"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </th>
  );
}
