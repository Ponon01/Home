import { useEffect, useMemo, useState, useRef } from "react";
import { LayoutGrid, Table2, ArrowLeft, MapPin, Pencil, Building2, Camera, Trash2 } from "lucide-react";
import Loading from "../Loading";
import ApartmentDetailDrawer from "./ApartmentDetailDrawer";
import EditComplexModal from "./EditComplexModal";
import {
  listHousingFundApartments,
  listHousingFundComplexes,
} from "../../api/housingFund";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { statusLabel } from "../../i18n/housingCard";
import { uploadComplexPhoto, deleteComplexPhoto } from "../../api/manualDashboard";
import {
  hasCustomComplexPhoto,
  isSvgPlaceholderPhoto,
  purgeAllLegacyComplexPhotos,
} from "../../utils/getComplexPhotoUrl";
import { getExcelDefaults } from "../../utils/complexExcelDefaults";
import {
  buildFallbackComplexes,
  normalizeComplexesResponse,
} from "../../utils/complexMockFallback";
import ComplexPhotoImg from "../ComplexPhotoImg";
import "./housing-fund.css";

const STATUS_FILTERS = [
  { value: "all", label: "Все", countKey: "all" },
  { value: "sold", label: "🔴 Выкуп", countKey: "sold" },
  { value: "installment", label: "🔵 Рассрочка", countKey: "installment" },
  { value: "rent", label: "🟡 Аренда", countKey: "rent" },
  { value: "guest", label: "🟣 Гостевая", countKey: "guest" },
  { value: "empty", label: "⚪ Пустые", countKey: "empty" },
];

function apartmentsWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "квартира";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "квартиры";
  return "квартир";
}

function formatComplexAddress(meta) {
  if (!meta) return "Район, адрес";
  const address = String(meta.address || "").trim();
  const district = String(meta.district || "").trim();
  if (address) return address;
  if (district) return district;
  return "Район, адрес";
}
function dormHint(t, count) {
  if (count === 1) return t("cardDormHintOne");
  if (count >= 2 && count <= 4) return t("cardDormHint", { n: count });
  return t("cardDormHintMany", { n: count });
}

function ApartmentGridCard({ apt, onOpen, t, lang }) {
  const count = Number(apt.occupants_count || 0);
  const isEmpty = Boolean(apt.is_empty) || apt.occupancy_status === "empty";
  const isTrulyFree = apt.status_key === "free";
  const isDorm = !isEmpty && count >= 2;
  const aptNo = apt.apartment_number || apt.id;
  const house = apt.house_number;

  let bodyPrimary = apt.current_resident_name || t("cardFree");
  let bodyHint = null;
  if (isTrulyFree) {
    bodyPrimary = t("cardFree");
  } else if (isEmpty) {
    bodyPrimary = apt.vacancy_note || "";
  } else if (isDorm) {
    bodyPrimary = t("cardDorm", { n: count || 1 });
    bodyHint = dormHint(t, count || 1);
  }

  return (
    <button
      type="button"
      className={`hf-apartment-card status-${apt.status_key}${isEmpty ? " is-empty" : ""}`}
      onClick={() => onOpen(apt.id)}
    >
      <div className="hf-apartment-card-top">
        <span className="hf-apartment-number">
          {t("cardApartment", { n: aptNo })}
          {house ? ` (д. ${house})` : ""}
        </span>
        <span className={`hf-status-tag status-${apt.status_key}`}>
          {((apt.residential_complex_name || "").trim() === "Жагалау-3" && (apt.apartment_number === "43" || apt.apartment_number === "44")) ? (
            lang === "kk" ? "🟡 Жатақхана" : "🟡 Общежитие"
          ) : ((apt.residential_complex_name || "").trim() === "Жагалау-3" && apt.status_key === "sold") ? (
            lang === "kk" ? "🔴 Сатып алу (100%)" : "🔴 Выкуп (100%)"
          ) : (
            statusLabel(lang, apt.status_key)
          )}
        </span>
      </div>
      <div className={`hf-apartment-body${isTrulyFree || (isEmpty && !apt.vacancy_note) ? " is-free" : ""}`}>
        {bodyPrimary ? <div className="hf-apartment-primary">{bodyPrimary}</div> : null}
        {isEmpty && !isTrulyFree ? (
          <div className="hf-apartment-empty-tag">{t("cardEmpty")}</div>
        ) : null}
        {bodyHint ? <div className="hf-apartment-hint">{bodyHint}</div> : null}
      </div>
    </button>
  );
}

export default function HousingFundPanel() {
  const { lang, t } = useLanguage();
  const { isAdmin } = useAuth();
  const [level, setLevel] = useState("complexes");
  const [complexes, setComplexes] = useState([]);
  const [selectedComplex, setSelectedComplex] = useState(null);
  const [viewMode, setViewMode] = useState("cards");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataWarning, setDataWarning] = useState("");
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [editingComplex, setEditingComplex] = useState(null);
  const [apartmentsReloadKey, setApartmentsReloadKey] = useState(0);
  const [uploadingId, setUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Фото текущей сессии (загрузка через «Добавить фото»); localStorage не читаем
  const [localPhotos, setLocalPhotos] = useState(() => {
    purgeAllLegacyComplexPhotos();
    return {};
  });

  // Локальные данные карточек из localStorage (v3)
  const [localOverrides, setLocalOverrides] = useState(() => {
    const initial = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("complex_data_v3_")) {
          const id = k.replace("complex_data_v3_", "");
          initial[id] = JSON.parse(localStorage.getItem(k));
        }
      }
    } catch (e) {
      console.warn("localStorage init error:", e);
    }
    return initial;
  });

  const savePhotoLocally = (id, name, base64) => {
    if (isSvgPlaceholderPhoto(base64)) return;
    try {
      if (id) localStorage.setItem(`complex_photo_${id}`, base64);
      if (name) localStorage.setItem(`complex_photo_${name}`, base64);
    } catch (e) {
      console.warn("localStorage photo save error:", e);
    }
  };

  const removePhotoLocally = (id, name) => {
    try {
      if (id) localStorage.removeItem(`complex_photo_${id}`);
      if (name) localStorage.removeItem(`complex_photo_${name}`);
    } catch (e) {
      console.warn("localStorage photo remove error:", e);
    }
  };

  const handlePhotoUpload = (cardId, cardName, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(cardId);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target.result;
      if (base64Image) {
        savePhotoLocally(cardId, cardName, base64Image);
        setLocalPhotos((prev) => ({
          ...prev,
          [cardId]: base64Image,
          ...(cardName ? { [cardName]: base64Image } : {}),
        }));
      }
      if (typeof cardId === "number" || (!isNaN(Number(cardId)) && Number(cardId) > 0)) {
        try {
          await uploadComplexPhoto(Number(cardId), file);
          reloadComplexes();
        } catch (err) {
          console.warn("Backend upload warning:", err);
        }
      }
      setUploadingId(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoDelete = async (cardId, cardName) => {
    if (!window.confirm("Удалить фото этого ЖК?")) return;
    setDeletingId(cardId);
    removePhotoLocally(cardId, cardName);
    setLocalPhotos((prev) => {
      const next = { ...prev };
      delete next[cardId];
      if (cardName) delete next[cardName];
      return next;
    });
    if (typeof cardId === "number" || (!isNaN(Number(cardId)) && Number(cardId) > 0)) {
      try {
        await deleteComplexPhoto(Number(cardId));
        reloadComplexes();
      } catch (err) {
        console.warn("Backend delete warning:", err);
      }
    }
    setDeletingId(null);
  };

  const loadComplexesSafe = async () => {
    try {
      const data = await listHousingFundComplexes();
      const list = normalizeComplexesResponse(data);
      if (list && list.length > 0) {
        setComplexes(list);
        setDataWarning("");
        return;
      }
      console.warn("[HousingFundPanel] API returned empty complex list, using local fallback");
      setComplexes(buildFallbackComplexes());
      setDataWarning("Сервер вернул пустой список — показан локальный каталог ЖК.");
    } catch (err) {
      console.error("[HousingFundPanel] Failed to load complexes:", err);
      setComplexes(buildFallbackComplexes());
      setDataWarning(
        "Сервер недоступен — показан локальный каталог ЖК. Список квартир может быть неполным."
      );
    }
  };

  const reloadComplexes = () => loadComplexesSafe();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataWarning("");
    listHousingFundComplexes()
      .then((data) => {
        if (cancelled) return;
        const list = normalizeComplexesResponse(data);
        if (list && list.length > 0) {
          setComplexes(list);
          setDataWarning("");
          return;
        }
        console.warn("[HousingFundPanel] API returned empty complex list, using local fallback");
        setComplexes(buildFallbackComplexes());
        setDataWarning("Сервер вернул пустой список — показан локальный каталог ЖК.");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[HousingFundPanel] Failed to load complexes:", err);
        setComplexes(buildFallbackComplexes());
        setDataWarning(
          "Сервер недоступен — показан локальный каталог ЖК. Список квартир может быть неполным."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (level !== "apartments" || !selectedComplex) return undefined;
    let cancelled = false;
    setLoading(true);
    listHousingFundApartments({ complex_name: selectedComplex })
      .then((data) => {
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(
            "[HousingFundPanel] Failed to load apartments:",
            err,
            selectedComplex
          );
          setRows([]);
          setDataWarning((prev) =>
            prev ||
            `Не удалось загрузить квартиры для «${selectedComplex}». Показаны только сводные данные ЖК.`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, selectedComplex, apartmentsReloadKey]);

  const selectedMeta = useMemo(
    () => complexes.find((c) => c.name === selectedComplex) || null,
    [complexes, selectedComplex]
  );

  const statusCounts = useMemo(() => {
    const counts = { all: 0, sold: 0, installment: 0, rent: 0, guest: 0, empty: 0 };
    for (const apt of rows) {
      counts.all += 1;
      const key = apt.status_key;
      if (key && counts[key] != null) counts[key] += 1;
      if (apt.is_empty || apt.occupancy_status === "empty") counts.empty += 1;
    }
    // Prefer live apartment rows; fall back to complex card totals while loading
    if (rows.length === 0 && selectedMeta) {
      return {
        all: Number(selectedMeta.total_count || 0),
        sold: Number(selectedMeta.sold_count || 0),
        installment: Number(selectedMeta.installment_count || 0),
        rent: Number(selectedMeta.rent_count || 0),
        guest: Number(selectedMeta.guest_count || 0),
        empty: Number(selectedMeta.free_count || 0),
      };
    }
    return counts;
  }, [rows, selectedMeta]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((apt) => {
      if (status === "empty") {
        if (!(apt.is_empty || apt.occupancy_status === "empty")) return false;
      } else if (status !== "all" && apt.status_key !== status) {
        return false;
      }
      if (!q) return true;
      return [apt.apartment_number, apt.current_resident_name, apt.current_resident_iin, apt.address].some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
  }, [rows, status, search]);

  const totalApartments = statusCounts.all;
  const headerAddress = formatComplexAddress(selectedMeta);

  const visibleStatusFilters = useMemo(
    () =>
      STATUS_FILTERS.filter(
        (opt) => opt.value === "all" || (statusCounts[opt.countKey] ?? 0) > 0
      ),
    [statusCounts]
  );

  useEffect(() => {
    if (status === "all") return;
    const stillVisible = visibleStatusFilters.some((opt) => opt.value === status);
    if (!stillVisible) setStatus("all");
  }, [status, visibleStatusFilters]);

  const openComplex = (name) => {
    setSelectedComplex(name);
    setStatus("all");
    setSearch("");
    setViewMode("cards");
    setLevel("apartments");
  };

  const backToComplexes = () => {
    setLevel("complexes");
    setSelectedComplex(null);
    setRows([]);
    setSelectedApartmentId(null);
    setDataWarning("");
  };

  // Helper: safe number
  const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const cards = useMemo(() => {
    return complexes.map((c) => {
      try {
        const cardId = c.id || c.name;
        const override = localOverrides[cardId] || {};
        const excel = getExcelDefaults(c.name || "");

        const getVal = (field, backendVal) => {
          if (override[field] !== undefined) return override[field];
          if (excel && excel[field] !== undefined) return excel[field];
          return backendVal;
        };

        return {
          ...c,
          id: cardId,
          name: getVal("name", c.name),
          district: getVal("district", c.district),
          address: getVal("address", c.address),
          total_count: getVal("total", c.total_count),
          not_for_sale_count: getVal("notForSale", c.not_for_sale_count),
          for_sale_count: getVal("forSale", c.for_sale_count),
          sold_count: getVal("sold", c.sold_count),
          free_count: getVal("remaining", c.free_count),
          rent_count: getVal("rent", c.rent_count),
          guest_count: getVal("guest", c.guest_count),
          rent_as_flat: getVal("rent_as_flat", c.rent_as_flat != null ? safeNum(c.rent_as_flat) : safeNum(c.rent_count)),
          rent_as_dorm: getVal("rent_as_dorm", safeNum(c.rent_as_dorm)),
          dorm_flats_info: getVal("dorm_flats_info", c.dorm_flats_info || ""),
          image:
            override.image && !isSvgPlaceholderPhoto(override.image) ? override.image : "",
        };
      } catch (err) {
        console.error("[HousingFundPanel] Card build error:", err, c);
        return {
          ...c,
          id: c?.id || c?.name || "unknown",
          name: c?.name || "ЖК",
        };
      }
    });
  }, [complexes, localOverrides]);

  if (level === "complexes") {
    return (
      <div className="hf-fund">
        <div className="hf-level-header">
          <div>
            <h2 className="hf-level-title">Жилищный фонд</h2>
            <p className="muted user-jk-gallery-sub">
              {cards.length > 0
                ? `${cards.length} жилых комплексов — выберите ЖК, чтобы открыть квартиры`
                : "Обзор доступных жилых комплексов"}
            </p>
          </div>
        </div>

        {loading && <Loading />}
        {dataWarning ? (
          <p className="hf-data-warning" role="status">{dataWarning}</p>
        ) : null}

        {!loading && (
          <div className="user-role-cards-grid">
            {cards.length === 0 ? (
              <p className="user-role-empty muted">Список ЖК пока пуст</p>
            ) : (
              cards.map((complex) => {
                const cardId = complex.id || complex.name;
                const hasCustomPhoto = hasCustomComplexPhoto(complex, localPhotos);
                const total = safeNum(complex.total_count);
                const sold = safeNum(complex.sold_count);
                const remaining = safeNum(complex.free_count);
                const rent = safeNum(complex.rent_count);
                const guest = safeNum(complex.guest_count);
                const notForSale = safeNum(complex.not_for_sale_count);
                const forSale = safeNum(complex.for_sale_count);
                const address = String(complex.address || "").trim();
                const district = String(complex.district || "").trim();

                return (
                  <article
                    key={complex.id || complex.name}
                    className="user-jk-card hf-jk-card"
                    onClick={() => openComplex(complex.name)}
                  >
                    <div className="user-jk-card-photo hf-jk-photo-hero">
                      <ComplexPhotoImg
                        complex={complex}
                        name={complex.name}
                        className="user-jk-card-photo-img w-full h-full object-cover rounded-t-2xl"
                        alt={complex.name}
                      />
                      <div className="hf-jk-photo-gradient" aria-hidden="true" />

                      {isAdmin && (
                        <div
                          className="hf-jk-admin-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label
                            htmlFor={`hf-upload-photo-${cardId}`}
                            className="hf-jk-icon-btn"
                            title={
                              uploadingId === cardId
                                ? "Загрузка..."
                                : hasCustomPhoto
                                ? "Изменить фото"
                                : "Добавить фото"
                            }
                          >
                            <Camera size={15} />
                            <input
                              type="file"
                              id={`hf-upload-photo-${cardId}`}
                              accept="image/*"
                              onChange={(e) => handlePhotoUpload(cardId, complex.name, e)}
                              style={{ display: "none" }}
                              disabled={uploadingId === cardId}
                            />
                          </label>

                          {hasCustomPhoto && (
                            <button
                              type="button"
                              className="hf-jk-icon-btn hf-jk-icon-btn-danger"
                              onClick={() => handlePhotoDelete(cardId, complex.name)}
                              disabled={deletingId === cardId}
                              title={deletingId === cardId ? "Удаление..." : "Удалить фото"}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="hf-jk-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingComplex(complex);
                            }}
                            title="Редактировать данные"
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="user-jk-card-body hf-jk-card-body">
                      <div className="hf-jk-card-meta">
                        <h3 className="hf-jk-title">{complex.name}</h3>
                        {(address || district) && (
                          <div className="hf-jk-meta-row">
                            {address && (
                              <div className="hf-jk-address">
                                <MapPin size={12} style={{ flexShrink: 0 }} />
                                <span>{address}</span>
                              </div>
                            )}
                            {district && <span className="hf-jk-district">{district}</span>}
                          </div>
                        )}
                      </div>

                      {total > 0 && (
                        <div className="hf-jk-stats-panel">
                          <div className="hf-jk-stat-total">
                            <div className="hf-jk-stat-row">
                              <div className="hf-jk-stat-label">
                                <Building2 size={12} /> Всего квартир
                              </div>
                              <div className="hf-jk-stat-value">{total}</div>
                            </div>
                            <div className="hf-jk-stat-nested">
                              <div className="hf-jk-stat-sub">
                                <span>Не подлежат реализации</span>
                                <strong>{notForSale}</strong>
                              </div>
                              <div className="hf-jk-stat-sub">
                                <span>К реализации</span>
                                <strong>{forSale}</strong>
                              </div>
                            </div>
                          </div>

                          {(sold > 0 || remaining > 0) && (
                            <div className="hf-jk-stat-group">
                              {sold > 0 && (
                                <div className="hf-jk-stat-sold">
                                  <span className="hf-jk-stat-label">Реализовано</span>
                                  <span className="hf-jk-stat-value">{sold}</span>
                                </div>
                              )}

                              {remaining > 0 && (
                                <div className="hf-jk-stat-remaining">
                                  <div className="hf-jk-stat-row">
                                    <span className="hf-jk-stat-label">В фонде театра</span>
                                    <span className="hf-jk-stat-value">{remaining}</span>
                                  </div>

                                  {(rent > 0 || guest > 0) && (
                                    <div className="hf-jk-stat-usage">
                                      {rent > 0 && (
                                        <>
                                          <div className="hf-jk-stat-usage-row">
                                            <span>В аренде</span>
                                            <strong>{rent}</strong>
                                          </div>
                                          <div className="hf-jk-stat-usage-nested">
                                            <div className="hf-jk-stat-usage-sub">
                                              <span>Как квартира</span>
                                              <strong>{complex.rent_as_flat || rent}</strong>
                                            </div>
                                            {Number(complex.rent_as_dorm) > 0 && (
                                              <div className="hf-jk-stat-usage-sub">
                                                <span>
                                                  Как общежитие
                                                  {complex.dorm_flats_info ? (
                                                    <span className="hf-jk-stat-usage-hint">
                                                      {" "}
                                                      ({complex.dorm_flats_info})
                                                    </span>
                                                  ) : null}
                                                </span>
                                                <strong>{complex.rent_as_dorm}</strong>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}
                                      {guest > 0 && (
                                        <div className="hf-jk-stat-usage-row">
                                          <span>Гостевой фонд</span>
                                          <strong>{guest}</strong>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {editingComplex ? (
          <EditComplexModal
            complex={editingComplex}
            onClose={() => setEditingComplex(null)}
            onSaved={(saved) => {
              const prevName = editingComplex.name;
              setEditingComplex(null);
              const cardId = saved.id || saved.name;
              setLocalOverrides((prev) => ({
                ...prev,
                [cardId]: saved,
              }));
              setComplexes((prev) =>
                prev.map((c) =>
                  c.id === saved.id
                    ? {
                        ...c,
                        name: saved.name,
                        district: saved.district,
                        address: saved.address || c.address,
                        build_year: saved.build_year,
                      }
                    : c
                )
              );
              reloadComplexes();
              if (saved?.name && selectedComplex === prevName) {
                setSelectedComplex(saved.name);
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="hf-fund">
      <section className="hf-complex-hero-section">
        <button type="button" className="hf-back-btn hf-complex-hero-back" onClick={backToComplexes}>
          <ArrowLeft size={16} /> Назад к списку ЖК
        </button>

        <div className="hf-complex-hero-head">
          <h2 className="hf-level-title hf-complex-hero-title">
            Жилой комплекс «{selectedComplex}»
          </h2>
          {selectedMeta?.id ? (
            <button
              type="button"
              className="hf-edit-jk-btn"
              onClick={() => setEditingComplex(selectedMeta)}
            >
              <Pencil size={14} /> Редактировать ЖК
            </button>
          ) : null}
        </div>

        <div className="hf-complex-hero-banner">
          <div className="hf-complex-hero-grid">
            <div className="hf-complex-hero-item">
              <span className="hf-complex-hero-label">Адрес / район</span>
              <span className="hf-complex-hero-value hf-complex-hero-value-gold">{headerAddress}</span>
            </div>
            <div className="hf-complex-hero-item">
              <span className="hf-complex-hero-label">Год постройки</span>
              <span className="hf-complex-hero-value">
                {selectedMeta?.build_year != null ? `${selectedMeta.build_year} г.` : "—"}
              </span>
            </div>
            <div className="hf-complex-hero-item">
              <span className="hf-complex-hero-label">Всего квартир в фонде</span>
              <span className="hf-complex-hero-value hf-complex-hero-value-count">
                {totalApartments} {apartmentsWord(totalApartments)}
              </span>
            </div>
          </div>
        </div>

        <div className="hf-complex-hero-toolbar">
          <div className="hf-view-toggle" role="group" aria-label="Режим отображения">
            <button
              type="button"
              className={`hf-view-btn${viewMode === "cards" ? " is-active" : ""}`}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid size={16} /> Карточки
            </button>
            <button
              type="button"
              className={`hf-view-btn${viewMode === "table" ? " is-active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              <Table2 size={16} /> Таблица
            </button>
          </div>
        </div>
      </section>

      <div className="hf-fund-toolbar">
        <div className="hf-status-chips" role="group" aria-label="Фильтр по статусу">
          {visibleStatusFilters.map((opt) => {
            const count = statusCounts[opt.countKey] ?? 0;
            return (
              <button
                key={opt.value}
                type="button"
                className={`hf-status-chip${status === opt.value ? " is-active" : ""}`}
                onClick={() => setStatus(opt.value)}
                aria-pressed={status === opt.value}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
        <label className="complex-working-filter hf-search-wide">
          Поиск (№ квартиры / ФИО)
          <input
            className="complex-working-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Например: 12 или Иванов"
          />
        </label>
        <span className="hf-fund-count">Показано: {filtered.length}</span>
      </div>

      {loading && <Loading />}
      {dataWarning ? (
        <p className="hf-data-warning" role="status">{dataWarning}</p>
      ) : null}

      {!loading && viewMode === "cards" && (
        <div className="hf-apartment-grid">
          {filtered.map((apt) => (
            <ApartmentGridCard
              key={apt.id}
              apt={apt}
              onOpen={setSelectedApartmentId}
              t={t}
              lang={lang}
            />
          ))}
          {filtered.length === 0 && (
            <div className="muted">Нет квартир по выбранным фильтрам (данные появятся после импорта Excel)</div>
          )}
        </div>
      )}

      {!loading && viewMode === "table" && (
        <div className="table-wrapper hf-apartment-table-wrap">
          <table className="table-excel hf-apartment-table">
            <thead>
              <tr>
                <th>№ Кв</th>
                <th>Этаж</th>
                <th>Площадь</th>
                <th>Статус</th>
                <th>ФИО Жильца</th>
                <th>ИИН</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((apt) => (
                <tr key={apt.id}>
                  <td>
                    {apt.apartment_number || apt.id}
                    {apt.house_number ? ` (д. ${apt.house_number})` : ""}
                  </td>
                  <td>{apt.floor ?? "—"}</td>
                  <td>{apt.total_area != null ? `${apt.total_area} м²` : "—"}</td>
                  <td>
                    <span className={`hf-status-tag status-${apt.status_key}`}>
                      {((apt.residential_complex_name || "").trim() === "Жагалау-3" && (apt.apartment_number === "43" || apt.apartment_number === "44")) ? (
                        lang === "kk" ? "🟡 Жатақхана" : "🟡 Общежитие"
                      ) : ((apt.residential_complex_name || "").trim() === "Жагалау-3" && apt.status_key === "sold") ? (
                        lang === "kk" ? "🔴 Сатып алу (100%)" : "🔴 Выкуп (100%)"
                      ) : (
                        statusLabel(lang, apt.status_key)
                      )}
                    </span>
                    {apt.is_empty && apt.status_key !== "free" ? (
                      <span className="hf-apartment-empty-tag hf-apartment-empty-tag--inline">
                        {t("cardEmpty")}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {Number(apt.occupants_count || 0) >= 2 && !(apt.is_empty || apt.occupancy_status === "empty")
                      ? t("cardDorm", { n: Number(apt.occupants_count || 0) })
                      : apt.is_empty
                      ? apt.status_key === "free"
                        ? t("cardFree")
                        : apt.vacancy_note || t("cardEmpty")
                      : apt.current_resident_name || "—"}
                  </td>
                  <td>{apt.current_resident_iin || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-ghost hf-table-action"
                      onClick={() => setSelectedApartmentId(apt.id)}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Нет квартир по выбранным фильтрам
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ApartmentDetailDrawer
        apartmentId={selectedApartmentId}
        onClose={() => setSelectedApartmentId(null)}
        onChanged={() => setApartmentsReloadKey((k) => k + 1)}
      />

      {editingComplex ? (
        <EditComplexModal
          complex={editingComplex}
          onClose={() => setEditingComplex(null)}
          onSaved={(saved) => {
            const prevName = editingComplex.name;
            setEditingComplex(null);
            const cardId = saved.id || saved.name;
            setLocalOverrides((prev) => ({
              ...prev,
              [cardId]: saved,
            }));
            setComplexes((prev) =>
              prev.map((c) =>
                c.id === saved.id
                  ? {
                      ...c,
                      name: saved.name,
                      district: saved.district,
                      address: saved.address || c.address,
                      build_year: saved.build_year,
                    }
                  : c
              )
            );
            if (saved?.name && saved.name !== prevName) {
              setSelectedComplex(saved.name);
            }
            reloadComplexes();
            setApartmentsReloadKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}

