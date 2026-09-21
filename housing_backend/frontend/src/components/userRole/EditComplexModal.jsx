import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, Camera, Trash2 } from "lucide-react";
import { getComplexPhotoUrl } from "../../utils/getComplexPhotoUrl";

const DISTRICT_OPTIONS = [
  "",
  "Есильский район",
  "Алматинский район",
  "Сарыаркинский район",
  "район Нура",
  "район Байконур",
  "район Сарайшык",
];

export default function EditComplexModal({ isOpen, onClose, complexData, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    district: "",
    image: "",
    total: 0,
    notForSale: 0,
    forSale: 0,
    sold: 0,
    remaining: 0,
    rent: 0,
    guest: 0,
    rent_as_flat: 0,
    rent_as_dorm: 0,
    dorm_flats_info: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (complexData && isOpen) {
      // Попробуем подтянуть фото из localStorage по id
      let existingPhoto = "";
      try {
        const cardId = complexData.id || complexData.key;
        existingPhoto =
          localStorage.getItem(`complex_photo_${cardId}`) ||
          localStorage.getItem(`complex_photo_${complexData.name}`) ||
          "";
      } catch (e) {
        // ignore
      }

      setFormData({
        name: complexData.name || "",
        address: complexData.address || "",
        district: complexData.district || "",
        image: complexData.image || existingPhoto || "",
        total: complexData.total || 0,
        notForSale: complexData.notForSale || 0,
        forSale: complexData.forSale || 0,
        sold: complexData.sold || 0,
        remaining: complexData.remaining || 0,
        rent: complexData.rent || 0,
        guest: complexData.guest || 0,
        rent_as_flat: complexData.rent_as_flat ?? (complexData.rent || 0),
        rent_as_dorm: complexData.rent_as_dorm || 0,
        dorm_flats_info: complexData.dorm_flats_info || "",
      });
    }
  }, [complexData, isOpen]);

  if (!isOpen || !complexData) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "name" || name === "address" || name === "district" ? value : Number(value) || 0,
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      if (base64) {
        setFormData((prev) => ({ ...prev, image: base64 }));
      }
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedData = {
      ...formData,
      total: Number(formData.total) || 0,
      notForSale: Number(formData.notForSale) || 0,
      forSale: Number(formData.forSale) || 0,
      sold: Number(formData.sold) || 0,
      remaining: Number(formData.remaining) || 0,
      rent: Number(formData.rent) || 0,
      guest: Number(formData.guest) || 0,
      rent_as_flat: Number(formData.rent_as_flat) || 0,
      rent_as_dorm: Number(formData.rent_as_dorm) || 0,
      dorm_flats_info: (formData.dorm_flats_info || "").trim(),
    };
    onSave(complexData.id, updatedData);
  };

  const labelStyle = { fontSize: "12px", fontWeight: "600", color: "#475569", textTransform: "uppercase" };
  const inputStyle = { padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" };

  const previewSrc =
    formData.image ||
    getComplexPhotoUrl(
      {
        id: complexData?.id,
        name: formData.name || complexData?.name,
        imagePath: complexData?.imagePath,
        image: "",
      },
      {}
    );

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        width: "90%",
        maxWidth: "500px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: "18px", fontWeight: "bold" }}>Редактирование ЖК</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", maxHeight: "70vh", overflowY: "auto" }}>
          <form id="edit-complex-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Фото ЖК */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Camera size={12} /> Фото ЖК
                </span>
              </label>
              <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(197, 160, 89, 0.45)" }}>
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
                  {formData.image && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        background: "rgba(120, 30, 30, 0.85)", backdropFilter: "blur(4px)",
                        color: "#ff9b9b", border: "1px solid rgba(255,100,100,0.5)",
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

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>Ссылка на фото (URL)</label>
              <input
                type="text"
                name="image"
                value={formData.image.startsWith("data:") ? "" : formData.image}
                onChange={handleChange}
                placeholder="https://example.com/photo.jpg"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>Название ЖК</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>Адрес (Например, ул. Сарайшык 5)</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} style={inputStyle} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={12} /> Район
              </label>
              <select
                name="district"
                value={formData.district}
                onChange={handleChange}
                style={{
                  ...inputStyle,
                  background: "#fff",
                  color: formData.district ? "#0f172a" : "#94a3b8",
                  cursor: "pointer",
                  appearance: "auto",
                }}
              >
                {DISTRICT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} style={{ color: opt ? "#0f172a" : "#94a3b8" }}>
                    {opt || "— Выберите район —"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <label style={labelStyle}>Всего квартир</label>
              <input type="number" name="total" value={formData.total} onChange={handleChange} style={{ ...inputStyle, marginBottom: "8px" }} />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Не подлежат реализации</label>
                  <input type="number" name="notForSale" value={formData.notForSale} onChange={handleChange} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", outline: "none" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>К реализации</label>
                  <input type="number" name="forSale" value={formData.forSale} onChange={handleChange} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", outline: "none" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#166534", textTransform: "uppercase" }}>Реализовано (Продано)</label>
              <input type="number" name="sold" value={formData.sold} onChange={handleChange} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #86efac", fontSize: "14px", outline: "none" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "#eff6ff", padding: "12px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#1e40af", textTransform: "uppercase" }}>Осталось в фонде</label>
              <input type="number" name="remaining" value={formData.remaining} onChange={handleChange} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #93c5fd", fontSize: "14px", outline: "none", marginBottom: "8px" }} />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#3b82f6" }}>В аренде (сотрудникам)</label>
                  <input type="number" name="rent" value={formData.rent} onChange={handleChange} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "13px", outline: "none" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#3b82f6" }}>Гостевой фонд (гастроли)</label>
                  <input type="number" name="guest" value={formData.guest} onChange={handleChange} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "13px", outline: "none" }} />
                </div>
              </div>
              {Number(formData.rent) > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "12px", borderLeft: "2px solid #93c5fd", marginTop: "8px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "#60a5fa" }}>↳ Как квартира</label>
                      <input type="number" name="rent_as_flat" value={formData.rent_as_flat} onChange={handleChange} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "#60a5fa" }}>↳ Как общежитие</label>
                      <input type="number" name="rent_as_dorm" value={formData.rent_as_dorm} onChange={handleChange} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "13px", outline: "none" }} />
                    </div>
                  </div>
                  {Number(formData.rent_as_dorm) > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "#60a5fa" }}>↳ Номера квартир-общежитий</label>
                      <input type="text" name="dorm_flats_info" value={formData.dorm_flats_info} onChange={handleChange} placeholder="Например: кв. 43, 44" style={{ padding: "8px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "13px", outline: "none" }} />
                    </div>
                  )}
                </div>
              )}
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: "600", cursor: "pointer" }}>Отмена</button>
          <button type="submit" form="edit-complex-form" style={{ padding: "8px 24px", borderRadius: "8px", border: "none", background: "#C5A059", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
