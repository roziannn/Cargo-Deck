import { MESSAGES } from "@/lib/i18n/messages";
import type { Lang } from "@/lib/i18n/locale";

export type Params = Record<string, string | number>;

/**
 * Translates a piece of interface text. The text itself is the key, written in whichever language the code already used,
 * and the dictionary only holds the other language(s). Unknown text, or a missing translation, comes back unchanged,
 * so nothing ever shows up blank. `{name}` placeholders are filled from `params`.
 */
export function translate(lang: Lang, text: string, params?: Params) {
  const found = MESSAGES[text]?.[lang] ?? text;
  return params ? found.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole)) : found;
}
