/** Кнопка «Редактировать» для строк таблиц ДЖСВ и ДБиЭА */
export default function EditActionButton({ onClick, label = "Редактировать" }) {
  return (
    <button type="button" className="admin-edit-btn" onClick={onClick}>
      <span aria-hidden="true">✏️</span>
      <span>{label}</span>
    </button>
  );
}
