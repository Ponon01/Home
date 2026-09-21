import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { updateHousingFundApartment, uploadResidentContract } from "../../api/housingFund";
import "./housing-fund.css";

const STATUS_OPTIONS = [
  { value: "rent", label: "🟡 Аренда" },
  { value: "installment", label: "🔵 Рассрочка" },
  { value: "sold", label: "🔴 Выкуп" },
  { value: "guest", label: "🟣 Гостевая" },
  { value: "free", label: "🟢 Свободно" },
];

function formatApiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .filter(Boolean)
      .join("; ");
  }
  return fallback;
}

/** Empty input → null so backend clears the DB field. */
function nullableText(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function nullableNumber(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function notifySuccess(message) {
  if (window?.toast?.success) {
    window.toast.success(message);
    return;
  }
  window.dispatchEvent(new CustomEvent("hf:toast", { detail: { type: "success", message } }));
}

export default function EditApartmentModal({ detail, onClose, onSaved }) {
  const apt = detail?.apartment;
  const primary = detail?.occupants?.[0] || null;

  const defaultLastPaidMonth = (() => {
    const now = new Date();
    // default: previous month (for easier first calculation)
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const [apartmentNumber, setApartmentNumber] = useState(apt?.apartment_number || "");
  const [entrance, setEntrance] = useState(apt?.entrance || "");
  const [floor, setFloor] = useState(apt?.floor != null ? String(apt.floor) : "");
  const [totalArea, setTotalArea] = useState(apt?.total_area != null ? String(apt.total_area) : "");
  const [personalAccount, setPersonalAccount] = useState(detail?.personal_account || "");
  const [paymentDueDay, setPaymentDueDay] = useState(
    apt?.payment_due_day != null ? String(apt.payment_due_day) : "10"
  );
  const [statusKey, setStatusKey] = useState(apt?.status_key || "rent");
  const [fullName, setFullName] = useState(primary?.full_name || "");
  const [position, setPosition] = useState(primary?.position || "");
  const [department, setDepartment] = useState(primary?.department || "");
  const [contractType, setContractType] = useState(primary?.occupancy_basis || "");
  const [monthlyPayment, setMonthlyPayment] = useState(
    primary?.monthly_payment != null ? String(primary.monthly_payment) : ""
  );
  const [monthlyDeduction, setMonthlyDeduction] = useState(
    apt?.monthly_deduction != null ? String(apt.monthly_deduction) : ""
  );
  const [amortizationCost, setAmortizationCost] = useState(
    apt?.amortization_cost != null ? String(apt.amortization_cost) : ""
  );
  const [taxableBase, setTaxableBase] = useState(
    apt?.taxable_base != null ? String(apt.taxable_base) : ""
  );
  const [contractStartDate, setContractStartDate] = useState(primary?.contract_start_date || "");
  const [contractEndDate, setContractEndDate] = useState(primary?.contract_end_date || "");
  const [contractFileName, setContractFileName] = useState(primary?.contract_file_name || "");
  const [contractFilePath, setContractFilePath] = useState(primary?.contract_file_path || "");
  const contractInputRef = useRef(null);
  const [lastPaidMonth, setLastPaidMonth] = useState(
    primary?.last_paid_month || defaultLastPaidMonth || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lastPaidMonthOptions = (() => {
    const MONTHS_RU = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];
    const now = new Date();
    const out = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const value = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ value, label: `${MONTHS_RU[d.getMonth()]} ${y}` });
    }
    // Add empty option at the top for clearing
    return [{ value: "", label: "— (не задано)" }, ...out];
  })();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  if (!apt?.id) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        apartment_number: nullableText(apartmentNumber),
        entrance: nullableText(entrance),
        floor: nullableNumber(floor),
        total_area: nullableNumber(totalArea),
        personal_account: nullableText(personalAccount),
        payment_due_day: nullableNumber(paymentDueDay),
        status_key: statusKey,
        resident_id: primary?.id ?? null,
        monthly_deduction: nullableNumber(monthlyDeduction),
        amortization_cost: nullableNumber(amortizationCost),
        taxable_base: nullableNumber(taxableBase),
        // Always send resident fields when not free so clears reach the API
        full_name: statusKey === "free" ? null : nullableText(fullName),
        position: statusKey === "free" ? null : nullableText(position),
        department: statusKey === "free" ? null : nullableText(department),
        occupancy_basis: statusKey === "free" ? null : nullableText(contractType),
        monthly_payment: statusKey === "free" ? null : nullableNumber(monthlyPayment),
        contract_start_date: (statusKey === "rent" || statusKey === "installment") ? (contractStartDate || null) : null,
        contract_end_date: (statusKey === "rent" || statusKey === "installment") ? (contractEndDate || null) : null,
        last_paid_month: statusKey === "free" ? null : nullableText(lastPaidMonth),
      };
      const saved = await updateHousingFundApartment(apt.id, payload);
      onSaved?.(saved);
      notifySuccess("Данные успешно сохранены");
      window.dispatchEvent(new Event("hf:data-changed"));
    } catch (err) {
      setError(formatApiError(err, "Не удалось сохранить квартиру"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hf-modal-root hf-edit-modal-root" role="presentation" style={{ zIndex: 60 }}>
      <div className="hf-modal-backdrop" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div className="hf-modal hf-edit-modal" role="dialog" aria-modal="true" aria-labelledby="hf-edit-apt-title">
        <div className="hf-modal-head">
          <h2 id="hf-edit-apt-title" className="hf-edit-modal-title">
            ✏️ Редактировать данные
          </h2>
          <button type="button" className="hf-modal-close" onClick={onClose} aria-label="Закрыть" disabled={saving}>
            <X size={20} />
          </button>
        </div>
        <form className="hf-modal-body hf-edit-form" onSubmit={handleSubmit}>
          {error ? <p className="hf-docs-error">{error}</p> : null}

          <div className="hf-edit-grid">
            <label className="hf-edit-field">
              № квартиры
              <input value={apartmentNumber} onChange={(e) => setApartmentNumber(e.target.value)} />
            </label>
            <label className="hf-edit-field">
              Подъезд
              <input value={entrance} onChange={(e) => setEntrance(e.target.value)} />
            </label>
            <label className="hf-edit-field">
              Этаж
              <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </label>
            <label className="hf-edit-field">
              Общая площадь (м²)
              <input type="number" step="0.01" value={totalArea} onChange={(e) => setTotalArea(e.target.value)} />
            </label>
          </div>

          <label className="hf-edit-field">
            Лицевой счет
            <input value={personalAccount} onChange={(e) => setPersonalAccount(e.target.value)} />
          </label>

          <label className="hf-edit-field">
            День ежемесячной оплаты
            <input
              type="number"
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(e.target.value)}
              min="1"
              max="31"
            />
          </label>

          <label className="hf-edit-field">
            Последний оплаченный месяц
            <select value={lastPaidMonth} onChange={(e) => setLastPaidMonth(e.target.value)}>
              {lastPaidMonthOptions.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="hf-edit-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
            <label className="hf-edit-field">
              Сумма ЕРЦ / Удержание из ЗП (₸)
              <input
                type="text"
                inputMode="decimal"
                value={monthlyDeduction}
                onChange={(e) => setMonthlyDeduction(e.target.value)}
                placeholder="например: 51999,99"
              />
            </label>
            <label className="hf-edit-field">
              Себестоимость (амортизация) (₸)
              <input type="number" step="0.01" value={amortizationCost} onChange={(e) => setAmortizationCost(e.target.value)} />
            </label>
          </div>

          <details className="hf-edit-details">
            <summary>Дополнительные поля</summary>
            <label className="hf-edit-field" style={{ marginTop: 6 }}>
              Налогооблагаемая база (₸)
              <input type="number" step="0.01" value={taxableBase} onChange={(e) => setTaxableBase(e.target.value)} />
            </label>
          </details>

          <label className="hf-edit-field">
            Статус
            <select value={statusKey} onChange={(e) => setStatusKey(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {statusKey !== "free" ? (
            <>
              <h3 className="hf-edit-section-title">Данные жильца</h3>
              <label className="hf-edit-field">
                ФИО
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <div className="hf-edit-grid">
                <label className="hf-edit-field">
                  Должность
                  <input value={position} onChange={(e) => setPosition(e.target.value)} />
                </label>
                <label className="hf-edit-field">
                  Отдел
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} />
                </label>
              </div>
              <label className="hf-edit-field">
                Вид договора
                <input value={contractType} onChange={(e) => setContractType(e.target.value)} />
              </label>
              <label className="hf-edit-field">
                Ежемесячный платеж (тг)
                <input
                  type="text"
                  inputMode="decimal"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  placeholder="например: 120000,50"
                />
              </label>

              {(statusKey === "rent" || statusKey === "installment") ? (
                <>
                  <h3 className="hf-edit-section-title">Договор найма</h3>
                  <div className="hf-edit-grid">
                    <label className="hf-edit-field">
                      Дата начала
                      <input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
                    </label>
                    <label className="hf-edit-field">
                      Дата окончания
                      <input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
                    </label>
                  </div>
                  <div className="hf-edit-field" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                    <button
                      type="button"
                      className="hf-docs-btn"
                      onClick={() => contractInputRef.current?.click()}
                      disabled={saving || !primary?.id}
                    >
                      {contractFileName ? "Заменить договор" : "Загрузить договор"}
                    </button>
                    {contractFileName ? (
                      <span style={{ fontSize: 12, color: "#64748b" }}>{contractFileName}</span>
                    ) : null}
                    {contractFilePath ? (
                      <button
                        type="button"
                        className="hf-docs-btn"
                        style={{ marginLeft: "auto" }}
                        onClick={() => {
                          const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
                          window.open(`${base}/uploads/${contractFilePath}`, "_blank");
                        }}
                      >
                        Просмотреть
                      </button>
                    ) : null}
                    <input
                      ref={contractInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !primary?.id) return;
                        try {
                          const res = await uploadResidentContract(primary.id, file);
                          setContractFileName(res.contract_file_name);
                          setContractFilePath(res.contract_file_path);
                        } catch {
                          setError("Не удалось загрузить файл договора");
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          <div className="hf-modal-foot hf-edit-foot">
            <button type="button" className="hf-docs-btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="hf-docs-btn hf-docs-btn-primary hf-btn-save-gradient" disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
