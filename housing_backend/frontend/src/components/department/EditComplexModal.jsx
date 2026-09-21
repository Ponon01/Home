import { useEffect, useState, useRef } from "react";
import { X, Camera, Trash2 } from "lucide-react";
import { updateComplex } from "../../api/complexes";
import { getComplexPhotoUrl } from "../../utils/getComplexPhotoUrl";
import "./housing-fund.css";

const DISTRICT_OPTIONS = [
  "",
  "Есильский район",
  "Алматинский район",
  "Сарыаркинский район",
  "район Нура",
  "район Байконур",
  "район Сарайшык",
];

export default function EditComplexModal({ complex, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [buildYear, setBuildYear] = useState("");
  const [image, setImage] = useState("");
  
  const [total, setTotal] = useState(0);
  const [nonRealizable, setNonRealizable] = useState(0);
  const [toRealize, setToRealize] = useState(0);
  const [realized, setRealized] = useState(0);
  const [remained, setRemained] = useState(0);
  const [inRent, setInRent] = useState(0);
  const [guest, setGuest] = useState(0);
  const [rentAsFlat, setRentAsFlat] = useState(0);
  const [rentAsDorm, setRentAsDorm] = useState(0);
  const [dormFlatsInfo, setDormFlatsInfo] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (complex) {
      setName(complex.name || "");
      setDistrict(complex.district || "");
      setAddress(complex.address || "");
      setBuildYear(complex.build_year != null ? String(complex.build_year) : "");
      
      // Load override values if exist
      const cardId = complex.id || complex.name;
      let localData = null;
      try {
        const stored = localStorage.getItem(`complex_data_v3_${cardId}`);
        if (stored) localData = JSON.parse(stored);
      } catch (e) {}

      setImage(localData?.image || complex.image || "");
      setTotal(localData?.total ?? complex.total_count ?? 0);
      setNonRealizable(localData?.notForSale ?? complex.not_for_sale_count ?? 0);
      setToRealize(localData?.forSale ?? complex.for_sale_count ?? 0);
      setRealized(localData?.sold ?? complex.sold_count ?? 0);
      setRemained(localData?.remaining ?? (
        (complex.free_count ?? 0) + (complex.rent_count ?? 0) + (complex.guest_count ?? 0)
      ) ?? 0);
      setInRent(localData?.rent ?? complex.rent_count ?? 0);
      setGuest(localData?.guest ?? complex.guest_count ?? 0);
      setRentAsFlat(localData?.rent_as_flat ?? complex.rent_as_flat ?? (localData?.rent ?? complex.rent_count ?? 0));
      setRentAsDorm(localData?.rent_as_dorm ?? complex.rent_as_dorm ?? 0);
      setDormFlatsInfo(localData?.dorm_flats_info ?? complex.dorm_flats_info ?? "");
    }
  }, [complex]);

  if (!complex?.id) {
    return null;
  }

  const previewSrc =
    image ||
    getComplexPhotoUrl(
      { ...complex, name, image_path: complex.image_path, image: "" },
      {}
    );

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      if (base64) {
        setImage(base64);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = () => {
    setImage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    
    const cardId = complex.id || complex.name;
    const localData = {
      name: name.trim(),
      district: district.trim() || null,
      address: address.trim() || null,
      total: Number(total) || 0,
      notForSale: Number(nonRealizable) || 0,
      forSale: Number(toRealize) || 0,
      sold: Number(realized) || 0,
      remaining: Number(remained) || 0,
      rent: Number(inRent) || 0,
      guest: Number(guest) || 0,
      rent_as_flat: Number(rentAsFlat) || 0,
      rent_as_dorm: Number(rentAsDorm) || 0,
      dorm_flats_info: dormFlatsInfo.trim()
    };

    try {
      // 1. Save photo separately to complex_photo_ (synchronizes with UserRoleViews!)
      if (image) {
        try {
          localStorage.setItem(`complex_photo_${cardId}`, image);
          localStorage.setItem(`complex_photo_${name.trim()}`, image);
        } catch (photoErr) {
          console.warn("Photo save error:", photoErr);
        }
      } else {
        try {
          localStorage.removeItem(`complex_photo_${cardId}`);
          localStorage.removeItem(`complex_photo_${name.trim()}`);
        } catch (photoErr) {
          console.warn("Photo remove error:", photoErr);
        }
      }

      // 2. Save remaining data locally to localStorage
      localStorage.setItem(`complex_data_v3_${cardId}`, JSON.stringify(localData));
      
      // 3. Call backend updateComplex for name, address, district, build_year
      let yearValue = null;
      if (buildYear.trim()) {
        const year = Number(buildYear);
        if (!Number.isFinite(year) || !Number.isInteger(year) || year < 1900 || year > 2100) {
          throw new Error("Год постройки должен быть в диапазоне 1900–2100");
        }
        yearValue = year;
      }
      
      const payload = {
        name: name.trim(),
        district: district.trim() || null,
        address: address.trim() || null,
        build_year: yearValue,
      };
      
      const saved = await updateComplex(complex.id, payload);
      
      // 4. Callback
      onSaved?.({
        ...saved,
        ...localData,
        image: image
      });
    } catch (err) {
      setError(err?.message || "Не удалось сохранить ЖК");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hf-modal-root hf-edit-modal-root" role="presentation">
      <div className="hf-modal-backdrop" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div className="hf-modal hf-edit-modal" style={{ maxHeight: "85vh", overflowY: "auto" }} role="dialog" aria-modal="true" aria-labelledby="hf-edit-jk-title">
        <div className="hf-modal-head">
          <h2 id="hf-edit-jk-title" className="hf-edit-modal-title">
            ✏️ Редактировать ЖК
          </h2>
          <button type="button" className="hf-modal-close" onClick={onClose} aria-label="Закрыть" disabled={saving}>
            <X size={20} />
          </button>
        </div>
        <form className="hf-modal-body hf-edit-form" onSubmit={handleSubmit}>
          {error ? <p className="hf-docs-error">{error}</p> : null}
          
          {/* Фото ЖК */}
          <div className="hf-edit-field">
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Фото ЖК</span>
            <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
              <img
                src={previewSrc}
                alt="Превью ЖК"
                style={{ width: "100%", height: "140px", objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(11,15,25,0.75) 0%, transparent 55%)",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              />
              <div style={{ position: "absolute", bottom: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 2 }}>
                <label
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)",
                    color: "#C5A059", border: "1px solid rgba(197,160,89,0.5)",
                    borderRadius: "8px", padding: "4px 10px", fontSize: "11px",
                    fontWeight: "600", cursor: "pointer",
                  }}
                >
                  <Camera size={12} /> Заменить
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                </label>
                {image && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      background: "rgba(120, 30, 30, 0.85)", backdropFilter: "blur(4px)",
                      color: "#ff9b9b",
                      border: "1px solid rgba(255,100,100,0.5)",
                      borderRadius: "8px", padding: "4px 10px", fontSize: "11px",
                      fontWeight: "600", cursor: "pointer",
                    }}
                  >
                    <Trash2 size={12} /> Удалить
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="hf-edit-field">
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase" }}>Ссылка на фото (URL)</span>
            <input
              type="text"
              value={image.startsWith("data:") ? "" : image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          <div className="hf-edit-field">
            Название ЖК
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="hf-edit-grid">
            <div className="hf-edit-field">
              Район
              <select
                value={district || ""}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {DISTRICT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt || "— Выберите район —"}
                  </option>
                ))}
              </select>
            </div>
            <div className="hf-edit-field">
              Год постройки
              <input
                type="number"
                min={1900}
                max={2100}
                value={buildYear}
                onChange={(e) => setBuildYear(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div className="hf-edit-field">
            Адрес / улица (только улица и дом)
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Например: ул. Сарайшык 5"
            />
          </div>

          <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="hf-edit-field">
              Всего квартир
              <input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value) || 0)} />
            </div>
            <div className="hf-edit-grid">
              <div className="hf-edit-field">
                Не подлежат реализации
                <input type="number" value={nonRealizable} onChange={(e) => setNonRealizable(Number(e.target.value) || 0)} />
              </div>
              <div className="hf-edit-field">
                К реализации
                <input type="number" value={toRealize} onChange={(e) => setToRealize(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="hf-edit-field" style={{ background: "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            Реализовано (Продано)
            <input type="number" value={realized} onChange={(e) => setRealized(Number(e.target.value) || 0)} />
          </div>

          <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "8px", border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="hf-edit-field">
              Осталось в фонде театра
              <input type="number" value={remained} onChange={(e) => setRemained(Number(e.target.value) || 0)} />
            </div>
            <div className="hf-edit-grid">
              <div className="hf-edit-field">
                В аренде (сотрудникам)
                <input type="number" value={inRent} onChange={(e) => setInRent(Number(e.target.value) || 0)} />
              </div>
              <div className="hf-edit-field">
                Гостевой фонд (гастроли)
                <input type="number" value={guest} onChange={(e) => setGuest(Number(e.target.value) || 0)} />
              </div>
            </div>
            {inRent > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "12px", borderLeft: "2px solid #93c5fd", marginTop: "4px" }}>
                <div className="hf-edit-grid">
                  <div className="hf-edit-field">
                    ↳ Как квартира
                    <input type="number" value={rentAsFlat} onChange={(e) => setRentAsFlat(Number(e.target.value) || 0)} />
                  </div>
                  <div className="hf-edit-field">
                    ↳ Как общежитие
                    <input type="number" value={rentAsDorm} onChange={(e) => setRentAsDorm(Number(e.target.value) || 0)} />
                  </div>
                </div>
                {rentAsDorm > 0 && (
                  <div className="hf-edit-field">
                    ↳ Номера квартир-общежитий
                    <input type="text" value={dormFlatsInfo} onChange={(e) => setDormFlatsInfo(e.target.value)} placeholder="Например: кв. 43, 44" />
                  </div>
                )}
              </div>
            )}
          </div>

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
