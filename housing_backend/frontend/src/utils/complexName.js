/**
 * Normalize a residential complex name for fuzzy matching across dashboard vs apartments DB.
 * - Trims and collapses internal whitespace
 * - Lowercase (locale-aware)
 * - Strips leading prefixes (repeated): "Жилой комплекс", "ЖК"
 */
const PREFIX_REGEXES = [/^жилой\s+комплекс\s*/iu, /^жк\s*/iu];

export function normalizeComplexName(raw) {
  if (raw == null) return "";
  let s = String(raw).trim().replace(/\s+/g, " ").toLowerCase();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of PREFIX_REGEXES) {
      const next = s.replace(re, "").trim().replace(/\s+/g, " ");
      if (next !== s) {
        s = next;
        changed = true;
      }
    }
  }
  return s;
}
