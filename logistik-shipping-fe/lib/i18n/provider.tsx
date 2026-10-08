"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { DEFAULT_LANG, LANG_COOKIE, setCurrentLang, type Lang } from "@/lib/i18n/locale";
import { translate, type Params } from "@/lib/i18n/translate";

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translates interface text; see `translate`. */
  t: (text: string, params?: Params) => string;
};

const I18nContext = createContext<I18n>({ lang: DEFAULT_LANG, setLang: () => undefined, t: (text, params) => translate(DEFAULT_LANG, text, params) });

/** `initialLang` comes from the language cookie on the server, so the first render already uses the right language. */
export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  setCurrentLang(lang);

  const setLang = useCallback((next: Lang) => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(() => ({ lang, setLang, t: (text, params) => translate(lang, text, params) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
