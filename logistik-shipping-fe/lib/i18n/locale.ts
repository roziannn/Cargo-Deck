/** The language of the interface. Indonesian is the default. */
export type Lang = "id" | "en";

export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: "id", label: "Bahasa Indonesia", short: "ID" },
  { value: "en", label: "English", short: "EN" },
];

export const LANG_COOKIE = "cd_lang";
export const DEFAULT_LANG: Lang = "id";

export const isLang = (value: unknown): value is Lang => value === "id" || value === "en";

// The provider keeps these in step with the chosen language while rendering, so plain helper functions
// (date and number formatting) can follow the language without being passed it.
let currentLang: Lang = DEFAULT_LANG;
export const setCurrentLang = (lang: Lang) => {
  currentLang = lang;
};
export const getCurrentLang = () => currentLang;

/** BCP 47 tag for Intl: Indonesian dates and numbers, or day-first English (not month-first US style). */
export const localeTag = (lang: Lang = currentLang) => (lang === "en" ? "en-GB" : "id-ID");
