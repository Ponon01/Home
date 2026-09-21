const TABS = [
  { id: "analytics", label: "📊 Аналитика" },
  { id: "fund", label: "🏢 Жилищный фонд" },
  { id: "applications", label: "📥 Заявления" },
  { id: "payments", label: "💳 Платежи" },
  { id: "contracts", label: "📄 Договоры" },
  { id: "reports", label: "📁 Отчеты" },
];

export default function HousingDepartmentTabs({ activeTab, onChange }) {
  return (
    <nav className="dept-housing-tabs" aria-label="Разделы ДЖСВ">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`dept-housing-tab ${activeTab === tab.id ? "dept-housing-tab-active" : ""}`}
          onClick={() => onChange(tab.id)}
          aria-selected={activeTab === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export { TABS };
