import { common } from "@/lib/i18n/messages/common";
import { chrome } from "@/lib/i18n/messages/chrome";
import { dashboard } from "@/lib/i18n/messages/dashboard";
import { plan } from "@/lib/i18n/messages/plan";
import { planDialogs } from "@/lib/i18n/messages/planDialogs";
import { incidentAudit } from "@/lib/i18n/messages/incidentAudit";
import { master } from "@/lib/i18n/messages/master";
import { settings } from "@/lib/i18n/messages/settings";
import type { Messages } from "@/lib/i18n/messages/types";

/**
 * Every dictionary, merged. One file per area of the app (dashboard, shipping, master, settings, ...), so people
 * working on different screens do not edit the same file. Add a new file here when you add an area.
 */
export const MESSAGES: Messages = { ...common, ...chrome, ...dashboard, ...plan, ...planDialogs, ...incidentAudit, ...master, ...settings };
