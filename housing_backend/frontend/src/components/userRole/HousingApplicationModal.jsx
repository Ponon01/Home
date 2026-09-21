import { useState, useEffect } from "react";
import { Download, FileUp, Plus, Trash2, X, Upload, CheckCircle2, ChevronDown } from "lucide-react";
import { submitHousingApplication } from "../../api/housingApplications";
import { APPLICATION_TYPES } from "../../constants/housingApplicationTypes";

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

function getFileExtension(name) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function validateHousingFile(file) {
  if (!file) return null;
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Файл «${file.name}»: допустимы только PDF, JPG, JPEG, PNG`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Файл «${file.name}» слишком большой (макс. 10 МБ)`;
  }
  return null;
}

/* ─── Inline styles ─── */
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  modal: {
    background: "#053526",
    border: "1px solid #C5A059",
    borderRadius: "20px",
    width: "100%",
    maxWidth: "680px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "28px 32px 20px",
    borderBottom: "1px solid rgba(197,160,89,0.2)",
  },
  title: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "bold",
    fontFamily: "Georgia, serif",
    margin: 0,
  },
  subtitle: {
    color: "#a0aec0",
    fontSize: "13px",
    marginTop: "4px",
  },
  closeBtn: {
    background: "rgba(197,160,89,0.1)",
    border: "1px solid rgba(197,160,89,0.3)",
    borderRadius: "10px",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#C5A059",
    transition: "all 0.2s",
  },
  body: {
    padding: "28px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  label: {
    color: "#C5A059",
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.03em",
    display: "block",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    background: "#032b1e",
    border: "1px solid rgba(197,160,89,0.4)",
    borderRadius: "10px",
    color: "#ffffff",
    padding: "12px 16px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    background: "#032b1e",
    border: "1px solid rgba(197,160,89,0.4)",
    borderRadius: "10px",
    color: "#ffffff",
    padding: "12px 44px 12px 16px",
    fontSize: "14px",
    outline: "none",
    appearance: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  selectWrap: {
    position: "relative",
  },
  selectArrow: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  divider: {
    height: "1px",
    background: "rgba(197,160,89,0.15)",
  },
  templateBlock: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "rgba(197,160,89,0.08)",
    border: "1px solid rgba(197,160,89,0.3)",
    borderRadius: "12px",
    padding: "16px 20px",
    flexWrap: "wrap",
  },
  templateBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid rgba(197,160,89,0.6)",
    color: "#C5A059",
    padding: "8px 18px",
    borderRadius: "10px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: "600",
    background: "transparent",
    marginLeft: "auto",
    whiteSpace: "nowrap",
  },
  fileSlot: (hasFile, hasError) => ({
    border: hasError
      ? "2px dashed #ef4444"
      : hasFile
        ? "2px solid rgba(197,160,89,0.6)"
        : "2px dashed rgba(197,160,89,0.4)",
    borderRadius: "14px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    background: hasFile ? "rgba(197,160,89,0.06)" : "rgba(3,43,30,0.5)",
    transition: "all 0.2s",
    textAlign: "center",
    position: "relative",
  }),
  fileSlotLabel: {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600",
  },
  fileSlotHint: {
    color: "#6b7280",
    fontSize: "12px",
  },
  fileSlotName: {
    color: "#C5A059",
    fontSize: "13px",
    fontWeight: "500",
  },
  fileSlotError: {
    color: "#ef4444",
    fontSize: "12px",
    marginTop: "4px",
  },
  hiddenInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
  },
  sectionTitle: {
    color: "#C5A059",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    margin: "0 0 12px",
  },
  familyCard: {
    background: "rgba(3,43,30,0.6)",
    border: "1px solid rgba(197,160,89,0.25)",
    borderRadius: "14px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  familyCardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid rgba(197,160,89,0.5)",
    color: "#C5A059",
    background: "transparent",
    padding: "10px 20px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  removeBtn: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: "8px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#ef4444",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#fca5a5",
    fontSize: "14px",
  },
  success: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "48px 32px",
    textAlign: "center",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    padding: "20px 32px 28px",
    borderTop: "1px solid rgba(197,160,89,0.15)",
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid rgba(197,160,89,0.3)",
    color: "#a0aec0",
    padding: "12px 24px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #C5A059 0%, #E2C78A 50%, #C5A059 100%)",
    color: "#032b1e",
    fontWeight: "bold",
    padding: "12px 28px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontSize: "15px",
    boxShadow: "0 4px 20px rgba(197,160,89,0.3)",
  },
};

/* ─── File Upload Slot ─── */
function FileSlot({ label, required, file, onChange, error }) {
  return (
    <div>
      <div style={S.fileSlot(!!file, !!error)}>
        <input
          type="file"
          accept={ACCEPT}
          style={S.hiddenInput}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <>
            <CheckCircle2 size={22} color="#C5A059" />
            <span style={S.fileSlotName}>{file.name}</span>
          </>
        ) : (
          <>
            <Upload size={22} color="rgba(197,160,89,0.6)" />
            <span style={S.fileSlotLabel}>
              {label} {required && <span style={{ color: "#C5A059" }}>*</span>}
            </span>
            <span style={S.fileSlotHint}>PDF, JPG, JPEG, PNG — макс. 10 МБ</span>
          </>
        )}
      </div>
      {error && <span style={S.fileSlotError}>{error}</span>}
    </div>
  );
}

/* ─── Family member helper ─── */
function createFamilyMember() {
  return {
    key: crypto.randomUUID(),
    fio: "",
    relationship: "супруг(а)",
    document: null,
    documentError: "",
  };
}

/* ─── Main Modal ─── */
export default function HousingApplicationModal({ open, onClose, initialTypeId = 1 }) {
  const [typeId, setTypeId] = useState(initialTypeId);
  const [fio, setFio] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");

  const [signedApp, setSignedApp] = useState(null);
  const [idDoc, setIdDoc] = useState(null);
  const [housingCert, setHousingCert] = useState(null);
  const [extraDocs, setExtraDocs] = useState(null);

  const [fileErrors, setFileErrors] = useState({});
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  // Sync initialTypeId from CTA when modal opens
  useEffect(() => {
    if (open) setTypeId(initialTypeId);
  }, [open, initialTypeId]);

  const selectedType = APPLICATION_TYPES.find((t) => t.id === typeId) || APPLICATION_TYPES[0];

  const reset = () => {
    setFio(""); setPosition(""); setDepartment(""); setPhone("");
    setSignedApp(null); setIdDoc(null); setHousingCert(null); setExtraDocs(null);
    setFileErrors({}); setFamilyMembers([]); setError(""); setSuccess(null); setLoading(false);
  };

  const handleClose = () => { reset(); onClose?.(); };

  const setFile = (field, file) => {
    const err = validateHousingFile(file);
    setFileErrors((p) => ({ ...p, [field]: err || "" }));
    if (field === "signedApp") setSignedApp(file);
    if (field === "idDoc") setIdDoc(file);
    if (field === "housingCert") setHousingCert(file);
    if (field === "extraDocs") setExtraDocs(file);
  };

  const addFamily = () => setFamilyMembers((p) => [...p, createFamilyMember()]);
  const removeFamily = (key) => setFamilyMembers((p) => p.filter((m) => m.key !== key));
  const updateFamily = (key, patch) => setFamilyMembers((p) => p.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const setFamilyFile = (key, file) => {
    const err = validateHousingFile(file);
    updateFamily(key, { document: file, documentError: err || "" });
  };

  const validateForm = () => {
    const errs = {};
    if (!signedApp) errs.signedApp = "Загрузите файл";
    else { const e = validateHousingFile(signedApp); if (e) errs.signedApp = e; }
    if (!idDoc) errs.idDoc = "Загрузите файл";
    else { const e = validateHousingFile(idDoc); if (e) errs.idDoc = e; }
    if (!housingCert) errs.housingCert = "Загрузите файл";
    else { const e = validateHousingFile(housingCert); if (e) errs.housingCert = e; }
    setFileErrors(errs);

    let familyOk = true;
    const updated = familyMembers.map((m) => {
      const de = validateHousingFile(m.document) || (!m.document ? "Загрузите документ" : "");
      if (!m.fio.trim() || de) familyOk = false;
      return { ...m, documentError: de };
    });
    setFamilyMembers(updated);

    return Object.keys(errs).length === 0 && familyOk;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) { setError("Проверьте поля и файлы"); return; }
    setLoading(true); setError("");
    try {
      const result = await submitHousingApplication({
        fio,
        position,
        department,
        application_type: selectedType.label,
        signedApplication: signedApp,
        housingCertificate: housingCert,
        idDocument: idDoc,
        familyMembers,
      });
      setSuccess(result);
    } catch (err) {
      const d = err?.response?.data?.detail;
      setError(typeof d === "string" ? d : "Не удалось отправить. Проверьте данные.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={S.backdrop}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h3 style={S.title}>Заявление на жильё</h3>
            <p style={S.subtitle}>Заполните данные и загрузите сканы документов</p>
          </div>
          <button type="button" style={S.closeBtn} onClick={handleClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div style={S.success}>
            <CheckCircle2 size={48} color="#C5A059" />
            <p style={{ color: "#ffffff", fontSize: "20px", fontWeight: "bold", fontFamily: "Georgia, serif" }}>
              Заявление отправлено
            </p>
            <p style={{ color: "#a0aec0", fontSize: "14px" }}>
              Статус: <strong style={{ color: "#C5A059" }}>{success.status_label || "В ожидании"}</strong>
            </p>
            <p style={{ color: "#6b7280", fontSize: "13px" }}>Номер заявки: #{success.id}</p>
            <button type="button" style={S.submitBtn} onClick={handleClose}>Закрыть</button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={S.body}>

              {/* ── Тип заявления (Select) ── */}
              <div>
                <span style={S.label}>Тип заявления</span>
                <div style={S.selectWrap}>
                  <select
                    value={typeId}
                    onChange={(e) => setTypeId(Number(e.target.value))}
                    style={S.select}
                  >
                    {APPLICATION_TYPES.map((t) => (
                      <option key={t.id} value={t.id} style={{ background: "#032b1e" }}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} color="#C5A059" style={S.selectArrow} />
                </div>
              </div>

              {/* ── Скачать бланк (динамическая ссылка сразу под выбором типа) ── */}
              <div style={S.templateBlock}>
                <Download size={20} color="#C5A059" />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: "#ffffff", fontSize: "14px" }}>
                    Скачать бланк для этого заявления
                  </strong>
                  <p style={{ color: "#6b7280", fontSize: "12px", margin: "2px 0 0" }}>
                    {selectedType.templateName}
                  </p>
                </div>
                <a
                  href={encodeURI(selectedType.template)}
                  download={selectedType.templateName}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={S.templateBtn}
                >
                  <Download size={14} /> Скачать
                </a>
              </div>

              {/* Divider */}
              <div style={S.divider} />

              {/* Info banner */}
              <div style={{
                background: "rgba(197,160,89,0.08)",
                border: "1px solid rgba(197,160,89,0.2)",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "#a0aec0",
                fontSize: "13px",
                lineHeight: "1.5",
              }}>
                Форматы: PDF, JPG, JPEG, PNG. Макс. 10 МБ на файл. Для членов семьи — отдельные документы.
              </div>

              {/* Text fields */}
              <div>
                <span style={S.label}>ФИО <span style={{ color: "#ef4444" }}>*</span></span>
                <input style={S.input} value={fio} onChange={(e) => setFio(e.target.value)} required />
              </div>
              <div>
                <span style={S.label}>Должность</span>
                <input style={S.input} value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div>
                <span style={S.label}>Департамент / Отдел</span>
                <input style={S.input} value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div>
                <span style={S.label}>Телефон</span>
                <input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" />
              </div>

              {/* Divider */}
              <div style={S.divider} />

              {/* File upload slots */}
              <p style={S.sectionTitle}>Документы заявителя</p>

              <FileSlot
                label="Слот 1: Заполненное заявление с подписью"
                required
                file={signedApp}
                onChange={(f) => setFile("signedApp", f)}
                error={fileErrors.signedApp}
              />
              <FileSlot
                label="Слот 2: Удостоверение личности"
                required
                file={idDoc}
                onChange={(f) => setFile("idDoc", f)}
                error={fileErrors.idDoc}
              />
              <FileSlot
                label="Слот 3: Справка об отсутствии жилья (eGov)"
                required
                file={housingCert}
                onChange={(f) => setFile("housingCert", f)}
                error={fileErrors.housingCert}
              />
              <FileSlot
                label="Слот 4: Дополнительные документы (при необходимости)"
                required={false}
                file={extraDocs}
                onChange={(f) => setFile("extraDocs", f)}
                error={fileErrors.extraDocs}
              />

              {/* Divider */}
              <div style={S.divider} />

              {/* Family members */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <p style={{ ...S.sectionTitle, margin: 0 }}>Члены семьи</p>
                  <button type="button" style={S.addBtn} onClick={addFamily}>
                    <Plus size={16} /> Добавить члена семьи
                  </button>
                </div>

                {familyMembers.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: "13px", fontStyle: "italic" }}>
                    При необходимости добавьте членов семьи — для каждого потребуются документы.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {familyMembers.map((member, idx) => (
                      <div key={member.key} style={S.familyCard}>
                        <div style={S.familyCardHead}>
                          <strong style={{ color: "#ffffff", fontSize: "15px" }}>Член семьи {idx + 1}</strong>
                          <button type="button" style={S.removeBtn} onClick={() => removeFamily(member.key)} aria-label="Удалить">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div>
                          <span style={S.label}>ФИО <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            style={S.input}
                            value={member.fio}
                            onChange={(e) => updateFamily(member.key, { fio: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <span style={S.label}>Степень родства</span>
                          <div style={S.selectWrap}>
                            <select
                              style={S.select}
                              value={member.relationship}
                              onChange={(e) => updateFamily(member.key, { relationship: e.target.value })}
                            >
                              <option value="супруг(а)" style={{ background: "#032b1e" }}>Супруг(а)</option>
                              <option value="ребенок" style={{ background: "#032b1e" }}>Ребёнок</option>
                              <option value="родитель" style={{ background: "#032b1e" }}>Родитель</option>
                              <option value="другое" style={{ background: "#032b1e" }}>Другое</option>
                            </select>
                            <ChevronDown size={14} color="#C5A059" style={S.selectArrow} />
                          </div>
                        </div>
                        <FileSlot
                          label="Документ члена семьи (удостоверение / свидетельство)"
                          required
                          file={member.document}
                          onChange={(f) => setFamilyFile(member.key, f)}
                          error={member.documentError}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div style={S.error}>{error}</div>}
            </div>

            {/* Footer */}
            <div style={S.actions}>
              <button type="button" style={S.cancelBtn} onClick={handleClose} disabled={loading}>
                Отмена
              </button>
              <button type="submit" style={{ ...S.submitBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? "Отправка..." : "Отправить заявление"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
