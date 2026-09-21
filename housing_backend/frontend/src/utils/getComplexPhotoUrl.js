import { API_BASE_URL } from "../api/client";
import { getComplexImage } from "./getComplexImage";

export const COMPLEX_PHOTO_FALLBACK = "/modern_housing_hero_bg.png";

const PHOTO_MIGRATION_KEY = "housing_photos_v4_public_only";

/** Устаревшие SVG-заглушки (зелёная арка и т.п.) — никогда не показываем. */
export function isSvgPlaceholderPhoto(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  if (
    trimmed.startsWith("data:image/svg+xml") ||
    trimmed.includes("data:image/svg+xml") ||
    trimmed.includes("image/svg+xml")
  ) {
    return true;
  }

  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) return true;

  const lower = trimmed.toLowerCase();
  if (lower.includes("<svg") || lower.includes("%3csvg") || lower.includes("%3c?xml")) {
    return true;
  }

  if (trimmed.startsWith("PHN2Zy") || trimmed.includes("PHN2ZyB")) return true;

  return false;
}

/** Только реальные загрузки пользователя / бэкенда — не SVG. */
export function isRealUploadedPhoto(url) {
  if (!url || typeof url !== "string" || isSvgPlaceholderPhoto(url)) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
  if (trimmed.includes("/uploads/")) return true;
  if (/^data:image\/(jpeg|jpg|png|webp|gif|avif)/i.test(trimmed)) return true;
  return false;
}

export function getComplexName(complex) {
  if (typeof complex === "string") return complex;
  return complex?.name || complex?.residential_complex_name || "";
}

function backendPhotoUrl(entity) {
  const imagePath = entity?.image_path || entity?.imagePath;
  if (!imagePath || isSvgPlaceholderPhoto(imagePath)) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  return `${API_BASE_URL}/uploads/${imagePath}`;
}

function sessionPhotoUrl(entity, localPhotos = {}) {
  const cardId = entity?.id ?? entity?.key ?? entity?.name;
  const name = getComplexName(entity);
  const candidate =
    (cardId != null && localPhotos[cardId]) || (name && localPhotos[name]) || null;
  return candidate && isRealUploadedPhoto(candidate) ? candidate : null;
}

/**
 * URL для отображения на карточках:
 * бэкенд → фото текущей сессии → public/complexes → hero fallback.
 * localStorage НЕ используется (там лежат старые зелёные заглушки).
 */
export function getComplexPhotoUrl(complexOrName, localPhotos = {}) {
  const name = getComplexName(complexOrName);
  const entity =
    typeof complexOrName === "string" ? { name: complexOrName } : complexOrName || { name };

  return (
    backendPhotoUrl(entity) ||
    sessionPhotoUrl(entity, localPhotos) ||
    getComplexImage(name) ||
    COMPLEX_PHOTO_FALLBACK
  );
}

export function hasCustomComplexPhoto(complex, localPhotos = {}) {
  const entity = typeof complex === "string" ? { name: complex } : complex || {};
  return Boolean(backendPhotoUrl(entity) || sessionPhotoUrl(entity, localPhotos));
}

/** Однократно удаляет ВСЕ legacy complex_photo_* из localStorage. */
export function purgeAllLegacyComplexPhotos() {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(PHOTO_MIGRATION_KEY)) return;

    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("complex_photo_")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(PHOTO_MIGRATION_KEY, String(Date.now()));
    console.info("[housing] Purged legacy complex_photo_* entries:", keys.length);
  } catch (e) {
    console.warn("[housing] Photo purge failed:", e);
  }
}

purgeAllLegacyComplexPhotos();
