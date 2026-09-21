import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createResident,
  getApartmentFullCard,
  updateApartment,
  updateResident,
} from "../api/apartments";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import SectionCard from "../components/SectionCard";
import DocumentsList from "../components/DocumentsList";
import AppHeader from "../components/AppHeader";
import { deleteDocument, uploadDocument } from "../api/documents";
import { getChangeHistory } from "../api/history";
import { getToken } from "../api/tokenStorage";

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : null;
}

function formatApiError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (status === 422 && Array.isArray(data?.detail)) {
    const details = data.detail
      .map((d) => `${(d.loc || []).join(".")}: ${d.msg}`)
      .join("; ");
    return `Ошибка валидации (422): ${details}`;
  }

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return `Ошибка ${status || ""}: ${data.detail}`.trim();
  }

  if (typeof data === "string" && data.trim()) {
    return `Ошибка ${status || ""}: ${data}`.trim();
  }

  return `Ошибка ${status || ""}: ${err?.message || "Неизвестная ошибка"}`.trim();
}

function logRequest(method, url, payload) {
  const token = getToken();
  const authHeader = token ? `Bearer ${token.slice(0, 12)}...` : "(missing)";
  console.log("[SAVE][REQUEST]", {
    method,
    url,
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    payload,
  });
}

function logResponse(method, url, status, body) {
  console.log("[SAVE][RESPONSE]", { method, url, status, body });
}

function logError(method, url, payload, err) {
  console.error("[SAVE][ERROR]", {
    method,
    url,
    payload,
    status: err?.response?.status,
    body: err?.response?.data,
    message: err?.message,
  });
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ApartmentFullCardPage() {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState("other");
  const [uploadFile, setUploadFile] = useState(null);
  const [replaceDocId, setReplaceDocId] = useState("");
  const [replaceFile, setReplaceFile] = useState(null);
  const [form, setForm] = useState({
    status: "",
    room_count: "",
    total_area: "",
    living_area: "",
    build_year: "",
    personal_account: "",
    resident_full_name: "",
    resident_family_composition: "",
    resident_position: "",
    resident_department: "",
  });

  const loadData = async () => {
    const cardData = await getApartmentFullCard(id);
    setCard(cardData);
    try {
      const historyRows = await getChangeHistory({ entity_id: id, limit: 100 });
      setHistory(historyRows || []);
    } catch {
      setHistory([]);
    }
    const apt = cardData.apartment || {};
    const resident = (cardData.residents || [])[0] || {};
    setForm({
      status: apt.status || "",
      room_count: apt.room_count ?? "",
      total_area: apt.total_area ?? "",
      living_area: apt.living_area ?? "",
      build_year: apt.build_year ?? "",
      personal_account: apt.personal_account || "",
      resident_full_name: resident.full_name || "",
      resident_family_composition: resident.family_composition || "",
      resident_position: resident.position || "",
      resident_department: resident.department || "",
    });
  };

  useEffect(() => {
    loadData()
      .catch(() => setError("Failed to load apartment full card"))
      .finally(() => setLoading(false));
  }, [id]);

  const onSave = async () => {
    if (!card) return;
    setSaving(true);
    setError("");
    const apartmentUrl = `/api/apartments/${card.apartment.id}`;
    const resident = (card.residents || [])[0];
    const residentUrl = resident?.id ? `/api/residents/${resident.id}` : "/api/residents";

    const apartmentPayload = {
      status: form.status || null,
      room_count: toNullableInteger(form.room_count),
      total_area: toNullableNumber(form.total_area),
      living_area: toNullableNumber(form.living_area),
      build_year: toNullableInteger(form.build_year),
      personal_account: form.personal_account || null,
    };

    const residentPayload = {
      apartment_id: card.apartment.id,
      full_name: form.resident_full_name || "Не указано",
      family_composition: form.resident_family_composition || null,
      position: form.resident_position || null,
      department: form.resident_department || null,
      is_active: true,
    };

    try {
      // Save apartment update
      try {
        logRequest("PATCH", apartmentUrl, apartmentPayload);
        const apartmentResp = await updateApartment(card.apartment.id, apartmentPayload);
        logResponse("PATCH", apartmentUrl, 200, apartmentResp);
      } catch (err) {
        logError("PATCH", apartmentUrl, apartmentPayload, err);
        throw new Error(`Сохранение квартиры не удалось. ${formatApiError(err)}`);
      }

      // Save resident update/create
      try {
        if (resident?.id) {
          logRequest("PATCH", residentUrl, residentPayload);
          const residentResp = await updateResident(resident.id, residentPayload);
          logResponse("PATCH", residentUrl, 200, residentResp);
        } else if (form.resident_full_name) {
          logRequest("POST", residentUrl, residentPayload);
          const residentResp = await createResident(residentPayload);
          logResponse("POST", residentUrl, 201, residentResp);
        }
      } catch (err) {
        logError(resident?.id ? "PATCH" : "POST", residentUrl, residentPayload, err);
        throw new Error(`Сохранение проживающего не удалось. ${formatApiError(err)}`);
      }

      await loadData();
      setEditMode(false);
    } catch (err) {
      setError(err?.message || "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const onUploadDocument = async () => {
    if (!card?.apartment?.id || !uploadFile) return;
    setUploading(true);
    setError("");
    try {
      await uploadDocument({
        apartmentId: card.apartment.id,
        documentType: uploadType,
        file: uploadFile,
      });
      setUploadFile(null);
      await loadData();
    } catch {
      setError("Не удалось загрузить документ");
    } finally {
      setUploading(false);
    }
  };

  const onReplaceDocument = async () => {
    if (!replaceDocId || !replaceFile || !card?.apartment?.id) return;
    const target = (card.documents || []).find((d) => String(d.id) === String(replaceDocId));
    if (!target) return;
    setUploading(true);
    setError("");
    try {
      await uploadDocument({
        apartmentId: card.apartment.id,
        documentType: target.document_type,
        file: replaceFile,
      });
      await deleteDocument(target.id);
      setReplaceDocId("");
      setReplaceFile(null);
      await loadData();
    } catch {
      setError("Не удалось заменить документ");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <main className="container"><Loading /></main>;
  if (error) return <main className="container"><ErrorMessage message={error} /></main>;
  if (!card) return null;

  const apt = card.apartment || {};
  const firstRent = (card.rental_financials || [])[0] || {};
  const firstPurchase = (card.purchase_financials || [])[0] || {};
  const firstResident = (card.residents || [])[0] || {};

  return (
    <main className="container">
      <AppHeader />
      <h1>Карточка квартиры #{apt.id}</h1>
      <button className="button" onClick={() => setEditMode((v) => !v)}>
        {editMode ? "Отменить" : "Редактировать"}
      </button>
      <p>
        <Link to="/">На главную</Link>{" "}
        <span className="muted">|</span>{" "}
        <Link to={`/complex/${encodeURIComponent(apt.residential_complex_name || "")}`}>Назад к ЖК</Link>
      </p>

      <SectionCard title="Основная информация">
        <Field label="Адрес" value={apt.address} />
        <Field label="ЖК" value={apt.residential_complex_name} />
        {editMode ? (
          <label className="edit-row">
            Статус квартиры
            <input
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            />
          </label>
        ) : (
          <Field label="Статус квартиры" value={apt.status} />
        )}
      </SectionCard>

      <SectionCard title="Характеристики жилья">
        <Field label="Тип жилья" value={apt.housing_type} />
        <Field label="Подтип" value={apt.apartment_subtype} />
        {editMode ? (
          <>
            <label className="edit-row">
              Количество комнат
              <input
                value={form.room_count}
                onChange={(e) => setForm({ ...form, room_count: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Общая площадь
              <input
                value={form.total_area}
                onChange={(e) => setForm({ ...form, total_area: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Жилая площадь
              <input
                value={form.living_area}
                onChange={(e) => setForm({ ...form, living_area: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Год постройки
              <input
                value={form.build_year}
                onChange={(e) => setForm({ ...form, build_year: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Лицевой счет
              <input
                value={form.personal_account}
                onChange={(e) => setForm({ ...form, personal_account: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <Field label="Количество комнат" value={apt.room_count} />
            <Field label="Общая площадь" value={apt.total_area} />
            <Field label="Жилая площадь" value={apt.living_area} />
            <Field label="Год постройки" value={apt.build_year} />
            <Field label="Лицевой счет" value={apt.personal_account} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Проживающие">
        {editMode ? (
          <>
            <label className="edit-row">
              ФИО
              <input
                value={form.resident_full_name}
                onChange={(e) => setForm({ ...form, resident_full_name: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Состав семьи
              <input
                value={form.resident_family_composition}
                onChange={(e) => setForm({ ...form, resident_family_composition: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Должность
              <input
                value={form.resident_position}
                onChange={(e) => setForm({ ...form, resident_position: e.target.value })}
              />
            </label>
            <label className="edit-row">
              Подразделение
              <input
                value={form.resident_department}
                onChange={(e) => setForm({ ...form, resident_department: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <Field label="ФИО" value={firstResident.full_name} />
            <Field label="Состав семьи" value={firstResident.family_composition} />
            <Field label="Должность" value={firstResident.position} />
            <Field label="Подразделение" value={firstResident.department} />
          </>
        )}
      </SectionCard>

      {editMode ? (
        <div className="actions-row">
          <button className="button" onClick={onSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      ) : null}

      <SectionCard title="Финансовые данные">
        {apt.housing_type === "purchase" ? (
          <>
            <h4>Блок выкупа/рассрочки</h4>
            <Field label="Договор купли-продажи" value={firstPurchase.purchase_contract} />
            <Field label="Первоначальная стоимость" value={firstPurchase.initial_cost} />
            <Field label="Остаток долга" value={firstPurchase.remaining_debt} />
            <Field label="Ежемесячный платеж" value={firstPurchase.monthly_payment} />
          </>
        ) : (
          <>
            <h4>Блок аренды</h4>
            <Field label="Рыночная цена" value={firstRent.market_price} />
            <Field label="Удержание из ЗП" value={firstRent.reimbursement_cost_monthly} />
            <Field label="Налогооблагаемая база" value={firstRent.taxable_base} />
            <Field label="Номер договора найма" value={firstRent.rental_contract_number} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Документы">
        <DocumentsList documents={card.documents || []} />
        <div className="upload-box">
          <h4>Загрузить новый документ</h4>
          <div className="inline-fields">
            <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
              <option value="rental_contract">Договор найма</option>
              <option value="purchase_contract">Договор купли-продажи</option>
              <option value="protocol">Протокол</option>
              <option value="act">Акт</option>
              <option value="payment_schedule">График платежей</option>
              <option value="other">Другое</option>
            </select>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            <button className="button" onClick={onUploadDocument} disabled={!uploadFile || uploading}>
              Загрузить
            </button>
          </div>
        </div>
        <div className="upload-box">
          <h4>Заменить существующий документ</h4>
          <div className="inline-fields">
            <select value={replaceDocId} onChange={(e) => setReplaceDocId(e.target.value)}>
              <option value="">Выберите документ</option>
              {(card.documents || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.file_name}
                </option>
              ))}
            </select>
            <input type="file" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} />
            <button
              className="button"
              onClick={onReplaceDocument}
              disabled={!replaceDocId || !replaceFile || uploading}
            >
              Заменить
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="История изменений">
        {history.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Изменение</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.changed_at).toLocaleString("ru-RU")}</td>
                  <td>{h.changed_by_username || h.changed_by_user_id || "-"}</td>
                  <td>{h.action}</td>
                  <td className="history-value">
                    {h.old_value || ""} {h.old_value || h.new_value ? "→" : ""} {h.new_value || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">История пока пустая или API недоступен.</p>
        )}
      </SectionCard>
    </main>
  );
}
