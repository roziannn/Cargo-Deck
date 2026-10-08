import { chrome } from "@/lib/i18n/messages/chrome";
import { common } from "@/lib/i18n/messages/common";
import { dashboard } from "@/lib/i18n/messages/dashboard";
import { incidentAudit } from "@/lib/i18n/messages/incidentAudit";
import { master } from "@/lib/i18n/messages/master";
import { plan } from "@/lib/i18n/messages/plan";
import { planDialogs } from "@/lib/i18n/messages/planDialogs";
import { settings } from "@/lib/i18n/messages/settings";
import type { Messages } from "@/lib/i18n/messages/types";

/**
 * Every dictionary, merged. One file per area of the app (dashboard, shipping, master, settings, ...), so people
 * working on different screens do not edit the same file. Add a new file here when you add an area.
 *
 * The merge is per language: when two files define the same text, one for each language, both survive; when they
 * disagree on the same language, the file listed last wins.
 */
const AREAS: Messages[] = [common, chrome, dashboard, plan, planDialogs, incidentAudit, master, settings];

export const MESSAGES: Messages = AREAS.reduce<Messages>((all, area) => {
  for (const [text, translations] of Object.entries(area)) all[text] = { ...all[text], ...translations };
  return all;
}, {});
