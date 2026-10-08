import { HttpError, currentActor, optNumber, optString, requireDate, requireEnum, requireGuid, requireString } from "@/lib/server/http";
import {
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  OPEN_INCIDENT_STATUSES,
  shippingIncidentRepository,
  type IncidentRow,
  type IncidentStatus,
} from "@/lib/server/repositories/shipping-incident.repository";
import { shippingPlanRepository } from "@/lib/server/repositories/shipping-plan.repository";
import { INCIDENT_REPORT_DAYS, canReportIncident } from "@/lib/server/services/shipping-plan.service";

const STATUS_LABEL: Record<IncidentStatus, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Diproses",
  CLAIM_FILED: "Klaim diajukan",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
};

async function getOrThrow(newId: string) {
  const row = await shippingIncidentRepository.getByNewId(requireGuid(newId, "incident id"));
  if (!row) throw new HttpError(404, "Incident not found.");
  return row;
}

function optDate(value: unknown, label: string) {
  return value === undefined || value === null || value === "" ? null : requireDate(value, label);
}

function claimFields(body: Record<string, unknown>) {
  const claimAmount = optNumber(body.claimAmount, "claimAmount");
  if (claimAmount !== null && (!Number.isInteger(claimAmount) || claimAmount < 0)) throw new HttpError(400, "claimAmount must be a whole rupiah amount, 0 or more.");
  const claimParty = optString(body.claimParty);
  if (claimParty && claimParty.length > 100) throw new HttpError(400, "claimParty is too long (max 100).");
  return { claimAmount, claimParty };
}

export const shippingIncidentService = {
  getAll: () => shippingIncidentRepository.getAll(),
  /** The incident with its timeline, newest entry first. */
  async getByNewId(newId: string) {
    const incident = await getOrThrow(newId);
    return { ...incident, history: await shippingIncidentRepository.getHistory(incident.newId) };
  },

  async create(body: Record<string, unknown>) {
    const planNewId = requireGuid(requireString(body.planNewId, "planNewId"), "planNewId");
    await shippingPlanRepository.autoComplete();
    const plan = await shippingPlanRepository.getByNewId(planNewId);
    if (!plan) throw new HttpError(404, "Shipping plan not found.");
    if (!canReportIncident(plan)) {
      throw new HttpError(409, `Insiden hanya bisa dilaporkan untuk plan yang sedang dikirim atau selesai dalam ${INCIDENT_REPORT_DAYS} hari terakhir (status ${plan.status}).`);
    }

    // one open incident per plan: it has to be closed before the next one can be reported
    const open = (await shippingIncidentRepository.getByPlan(plan.newId)).find((i) => OPEN_INCIDENT_STATUSES.includes(i.status));
    if (open) {
      throw new HttpError(
        409,
        `Plan ${plan.planNo} masih punya insiden ${open.incidentNo} dengan status **${STATUS_LABEL[open.status]}**. Selesaikan atau tolak insiden itu dulu sebelum melaporkan yang baru.`,
      );
    }

    const description = requireString(body.description, "description");
    const by = await currentActor();
    const newId = await shippingIncidentRepository.create(
      {
        planNewId: plan.newId,
        type: requireEnum(body.type, INCIDENT_TYPES, "type"),
        occurredDate: body.occurredDate ? requireDate(body.occurredDate, "occurredDate") : new Date().toISOString().slice(0, 10),
        description,
        targetDate: optDate(body.targetDate, "targetDate"),
        ...claimFields(body),
      },
      by,
    );
    return this.getByNewId(newId);
  },

  /** Updates the handling: status, target date, solution and claim. */
  async update(newId: string, body: Record<string, unknown>) {
    const incident: IncidentRow = await getOrThrow(newId);
    const status = requireEnum(body.status, INCIDENT_STATUSES, "status");
    const solution = optString(body.solution);
    const claim = claimFields(body);

    if ((status === "RESOLVED" || status === "REJECTED") && !solution) {
      throw new HttpError(400, status === "RESOLVED" ? "Solusi wajib diisi untuk menyelesaikan insiden." : "Alasan penolakan wajib diisi di kolom solusi.");
    }
    if (status === "CLAIM_FILED" && (!claim.claimAmount || !claim.claimParty)) {
      throw new HttpError(400, "Nilai klaim dan pihak yang ditagih wajib diisi untuk klaim.");
    }

    const by = await currentActor();
    await shippingIncidentRepository.update(incident.newId, incident, { status, targetDate: optDate(body.targetDate, "targetDate"), solution, ...claim, note: optString(body.note) }, by);
    // closing the last open incident lets a plan past its ETA complete
    await shippingPlanRepository.autoComplete();
    return this.getByNewId(incident.newId);
  },
};
