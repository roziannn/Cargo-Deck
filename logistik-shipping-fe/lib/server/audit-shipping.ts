import { auditCreate, auditUpdate, describeChanges, diffFields, rupiah, writeAudit, yesNo, type AuditChange, type AuditField } from "@/lib/server/audit";
import type { IncidentRow } from "@/lib/server/repositories/shipping-incident.repository";
import type { ShippingPlanItemRow, ShippingPlanRow } from "@/lib/server/repositories/shipping-plan.repository";

/** What shipping services write to the audit trail: each function describes one action in plain words. */
const MODULE = "Shipping Plan";
const EMPTY = "(kosong)";
const q = (text: string) => `'${text}'`;
const ticked = yesNo("Ya", "Belum");

const HEADER_FIELDS: AuditField[] = [
  { key: "originName", label: "Asal" },
  { key: "destinationName", label: "Tujuan" },
  { key: "plannedShipDate", label: "Tanggal kirim" },
  { key: "requestedDeliveryDate", label: "Permintaan tiba" },
  { key: "priority", label: "Prioritas" },
  { key: "specialHandling", label: "Penanganan khusus" },
  { key: "notes", label: "Catatan" },
];

const BOOKING_FIELDS: AuditField[] = [
  { key: "carrierName", label: "Carrier" },
  { key: "driverName", label: "Driver" },
  { key: "plateNo", label: "Nomor polisi" },
  { key: "distanceKm", label: "Jarak (km)" },
  { key: "freightCost", label: "Ongkos angkut", format: rupiah },
  { key: "loadingFee", label: "Biaya muat", format: rupiah },
  { key: "otherFee", label: "Biaya lain", format: rupiah },
  { key: "totalCost", label: "Total biaya", format: rupiah },
  { key: "bookingNotes", label: "Catatan booking" },
];

const LOADING_FIELDS: AuditField[] = [
  { key: "chkVehiclePapers", label: "KIR dan STNK", format: ticked },
  { key: "chkVehicleClean", label: "Bak bersih", format: ticked },
  { key: "chkVehicleCondition", label: "Kendaraan layak jalan", format: ticked },
  { key: "chkDriverReady", label: "Driver siap", format: ticked },
  { key: "chkCargoSecured", label: "Muatan diamankan", format: ticked },
  { key: "loadingTempC", label: "Suhu bak (C)" },
  { key: "sealNo", label: "Nomor segel" },
  { key: "grossWeightKg", label: "Berat isi (kg)" },
  { key: "tareWeightKg", label: "Berat kosong (kg)" },
  { key: "loadingNotes", label: "Catatan loading" },
];

type Key = "qty" | "pickedQty" | "loadedQty";

/** Per-item quantity differences, e.g. "Item Box A dari 10 menjadi 12". */
function itemChanges(before: ShippingPlanItemRow[], after: ShippingPlanItemRow[], key: Key): AuditChange[] {
  const byId = new Map(before.map((i) => [i.cubstoolNewId.toLowerCase(), i]));
  const seen = new Set<string>();
  const changes: AuditChange[] = [];
  const text = (n: number | null | undefined) => (n === null || n === undefined ? EMPTY : String(n));

  for (const item of after) {
    const id = item.cubstoolNewId.toLowerCase();
    seen.add(id);
    const old = byId.get(id);
    if ((old?.[key] ?? null) === (item[key] ?? null)) continue;
    changes.push({ field: key, label: `Item ${item.itemName}`, from: text(old?.[key]), to: text(item[key]) });
  }
  for (const item of before) {
    if (!seen.has(item.cubstoolNewId.toLowerCase()) && item[key] !== null) {
      changes.push({ field: key, label: `Item ${item.itemName}`, from: text(item[key]), to: "dihapus" });
    }
  }
  return changes;
}

const withChanges = (note: string, changes: AuditChange[]) => (changes.length > 0 ? `${note}: ${describeChanges(changes)}` : note);

function plainChanges(changes: AuditChange[]) {
  return describeChanges(changes).replace(/'dihapus'/g, "dihapus");
}

export const shippingAudit = {
  created: (plan: ShippingPlanRow) =>
    auditCreate({ module: MODULE, entityType: "Plan", ref: plan.planNo, detail: `${plan.originName} ke ${plan.destinationName}, kirim ${plan.plannedShipDate}` }),

  header: (before: ShippingPlanRow, after: ShippingPlanRow) =>
    auditUpdate({ module: MODULE, entityType: "Plan", ref: before.planNo, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown>, fields: HEADER_FIELDS }),

  async load(before: ShippingPlanRow, beforeItems: ShippingPlanItemRow[], after: ShippingPlanRow, afterItems: ShippingPlanItemRow[]) {
    const changes = [...diffFields({ vehicle: before.vehicleName }, { vehicle: after.vehicleName }, [{ key: "vehicle", label: "Kendaraan" }]), ...itemChanges(beforeItems, afterItems, "qty")];
    if (changes.length === 0) return;
    const first = beforeItems.length === 0;
    const total = afterItems.reduce((s, i) => s + i.qty, 0);
    await writeAudit({
      module: MODULE,
      action: first ? "STATUS_CHANGE" : "UPDATE",
      entityType: "Plan",
      ref: before.planNo,
      note: first
        ? `Menyimpan simulasi muatan plan ${q(before.planNo)}: kendaraan ${q(after.vehicleName ?? "-")}, ${afterItems.length} jenis barang, total ${total} karton (status ${before.status} menjadi ${after.status})`
        : `Mengubah muatan plan ${q(before.planNo)}: ${plainChanges(changes)}`,
      changes,
    });
  },

  statusChanged: (before: ShippingPlanRow, after: ShippingPlanRow, action: "approve" | "cancel", reason: string | null) =>
    writeAudit({
      module: MODULE,
      action: "STATUS_CHANGE",
      entityType: "Plan",
      ref: before.planNo,
      note:
        action === "approve"
          ? `Menyetujui plan ${q(before.planNo)} (status ${before.status} menjadi ${after.status})`
          : `Membatalkan plan ${q(before.planNo)} (status ${before.status} menjadi ${after.status}) dengan alasan: ${reason ?? "-"}`,
    }),

  async booking(before: ShippingPlanRow, after: ShippingPlanRow) {
    if (before.status === "APPROVED") {
      await writeAudit({
        module: MODULE,
        action: "STATUS_CHANGE",
        entityType: "Plan",
        ref: before.planNo,
        note: `Booking armada plan ${q(before.planNo)}: carrier ${q(after.carrierName ?? "-")}, driver ${q(after.driverName ?? "-")}, nomor polisi ${after.plateNo}, total ${rupiah(after.totalCost)} (status APPROVED menjadi BOOKED)`,
      });
      return;
    }
    await auditUpdate({ module: MODULE, entityType: "Booking plan", ref: before.planNo, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown>, fields: BOOKING_FIELDS });
  },

  pickingStarted: (plan: ShippingPlanRow) =>
    writeAudit({ module: MODULE, action: "STATUS_CHANGE", entityType: "Plan", ref: plan.planNo, note: `Memulai picking dan packing plan ${q(plan.planNo)} (status BOOKED menjadi PICKING)` }),

  async picking(before: ShippingPlanRow, beforeItems: ShippingPlanItemRow[], after: ShippingPlanRow, afterItems: ShippingPlanItemRow[]) {
    const changes = itemChanges(beforeItems, afterItems, "pickedQty");
    const notes = diffFields({ n: before.pickingNotes }, { n: after.pickingNotes }, [{ key: "n", label: "Catatan picking" }]);
    const all = [...changes, ...notes];
    if (before.status === "PICKING" && after.status === "LOADING") {
      await writeAudit({
        module: MODULE,
        action: "STATUS_CHANGE",
        entityType: "Plan",
        ref: before.planNo,
        note: withChanges(`Menyelesaikan picking dan packing plan ${q(before.planNo)}, lanjut ke loading (status PICKING menjadi LOADING)`, all),
        changes: all,
      });
      return;
    }
    if (all.length === 0) return;
    await writeAudit({ module: MODULE, action: "UPDATE", entityType: "Plan", ref: before.planNo, note: `Menyimpan hasil picking plan ${q(before.planNo)}: ${describeChanges(all)}`, changes: all });
  },

  async loading(before: ShippingPlanRow, beforeItems: ShippingPlanItemRow[], after: ShippingPlanRow, afterItems: ShippingPlanItemRow[]) {
    const all = [
      ...diffFields(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, LOADING_FIELDS),
      ...itemChanges(beforeItems, afterItems, "loadedQty"),
    ];
    if (all.length === 0) return;
    await writeAudit({ module: MODULE, action: "UPDATE", entityType: "Plan", ref: before.planNo, note: `Menyimpan data loading plan ${q(before.planNo)}: ${describeChanges(all)}`, changes: all });
  },

  dispatched: (plan: ShippingPlanRow) =>
    writeAudit({
      module: MODULE,
      action: "STATUS_CHANGE",
      entityType: "Plan",
      ref: plan.planNo,
      note: `Menerbitkan surat jalan ${plan.deliveryNoteNo} dan memberangkatkan plan ${q(plan.planNo)} (status LOADING menjadi DISPATCHED), ETA ${plan.etaDate}, masa tunggu ${plan.graceDays} hari`,
    }),

  eta: (before: ShippingPlanRow, after: ShippingPlanRow) =>
    auditUpdate({
      module: MODULE,
      entityType: "ETA plan",
      ref: before.planNo,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      fields: [
        { key: "etaDate", label: "ETA" },
        { key: "graceDays", label: "Masa tunggu (hari)" },
      ],
    }),

  received: (plan: ShippingPlanRow, receivedBy: string, notes: string | null) =>
    writeAudit({
      module: MODULE,
      action: "STATUS_CHANGE",
      entityType: "Plan",
      ref: plan.planNo,
      note: `Menandai plan ${q(plan.planNo)} diterima oleh ${receivedBy} (status DISPATCHED menjadi COMPLETED)${notes ? `, catatan: ${notes}` : ""}`,
    }),
};

// ---------- incidents ----------

const INCIDENT_TYPE: Record<string, string> = {
  DELAY: "Terlambat",
  ACCIDENT: "Kecelakaan",
  DAMAGED: "Barang rusak",
  SHORTAGE: "Barang kurang",
  TEMPERATURE: "Suhu keluar batas",
  RETURN: "Retur",
  OTHER: "Lainnya",
};
const INCIDENT_STATUS: Record<string, string> = { OPEN: "Baru", IN_PROGRESS: "Diproses", CLAIM_FILED: "Klaim diajukan", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const statusText = (v: unknown) => INCIDENT_STATUS[String(v)] ?? String(v ?? EMPTY);

export const incidentAudit = {
  created: (incident: IncidentRow) =>
    writeAudit({
      module: "Insiden & Klaim",
      action: "CREATE",
      entityType: "Insiden",
      ref: incident.incidentNo,
      note: `Melaporkan insiden ${q(incident.incidentNo)} (${INCIDENT_TYPE[incident.type] ?? incident.type}) pada plan ${q(incident.planNo)}: ${incident.description}`,
    }),

  async updated(before: IncidentRow, after: IncidentRow, progressNote: string | null) {
    const changes = diffFields(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, [
      { key: "status", label: "Status", format: statusText },
      { key: "targetDate", label: "Estimasi selesai" },
      { key: "solution", label: "Solusi" },
      { key: "claimAmount", label: "Nilai klaim", format: rupiah },
      { key: "claimParty", label: "Pihak yang ditagih" },
    ]);
    if (changes.length === 0 && !progressNote) return;
    const statusChanged = changes.some((c) => c.field === "status");
    const parts = [changes.length > 0 ? describeChanges(changes) : null, progressNote ? `catatan: ${progressNote}` : null].filter(Boolean).join("; ");
    await writeAudit({
      module: "Insiden & Klaim",
      action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
      entityType: "Insiden",
      ref: before.incidentNo,
      note: `Menangani insiden ${q(before.incidentNo)}: ${parts}`,
      changes,
    });
  },
};
