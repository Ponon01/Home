import { useEffect } from "react";
import { getComplexImage } from "../utils/getComplexImage";

const DEFAULT_CLASS = "user-jk-card-photo-img w-full h-36 object-cover rounded-t-xl";
const PURGE_FLAG = "housing_complex_photo_purged_v5";

/** Удаляет все legacy SVG/base64 заглушки `complex_photo_*` из localStorage. */
function purgeComplexPhotoCache() {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(PURGE_FLAG)) return;

    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("complex_photo_")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(PURGE_FLAG, String(Date.now()));
  } catch {
    /* ignore quota / private mode */
  }
}

export default function ComplexPhotoImg({
  complex,
  name,
  title,
  className = DEFAULT_CLASS,
  alt,
  loading = "lazy",
}) {
  useEffect(() => {
    purgeComplexPhotoCache();
  }, []);

  const complexName =
    name ||
    title ||
    complex?.name ||
    complex?.residential_complex_name ||
    complex?.title ||
    "";

  // Жёстко только статика из public/complexes/ — без localStorage / SVG / uploads
  const photoUrl = getComplexImage(complexName);

  return (
    <img
      src={photoUrl}
      alt={alt || complexName || "ЖК"}
      className={className}
      loading={loading}
      onError={(e) => {
        e.target.onerror = null;
        // Последний запасной файл из готового списка complexes/
        e.target.src = "/complexes/lazurka.png";
      }}
    />
  );
}
