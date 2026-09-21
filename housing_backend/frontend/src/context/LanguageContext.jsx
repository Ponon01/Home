import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getHousingCardLang, setHousingCardLang, tHousing } from "../i18n/housingCard";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => getHousingCardLang());

  const setLang = useCallback((next) => {
    setLangState(setHousingCardLang(next));
  }, []);

  const t = useCallback((key, vars) => tHousing(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
