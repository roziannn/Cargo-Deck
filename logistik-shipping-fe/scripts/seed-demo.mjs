// Fills the database with demo shipments (plans, items, history, incidents) spread over the last ~100 days,
// so the dashboard has something to show. Master data must exist already (run `pnpm db:migrate` first).
//
//   pnpm db:seed-demo           add demo data (does nothing if it is already there)
//   pnpm db:seed-demo --reset   remove the demo data first, then add it again
//
// Demo rows are recognisable: plan numbers SP-DEMO-xxxx, incidents INC-DEMO-xxxx, created_by "demo".
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: fall back to variables already in the environment
}

const env = process.env;
const client = new pg.Client({
  host: env.DB_HOST ?? env.PGHOST,
  port: Number(env.DB_PORT ?? env.PGPORT ?? 5432),
  user: env.DB_USER ?? env.PGUSER,
  password: env.DB_PASSWORD ?? env.PGPASSWORD,
  database: env.DB_NAME ?? env.PGDATABASE,
  ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

// small deterministic random generator, so every run produces the same demo data
let seed = 20260507;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const weighted = (entries) => {
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [value, w] of entries) if ((r -= w) < 0) return value;
  return entries[0][0];
};

const PATH = ["DRAFT", "PLANNED", "APPROVED", "BOOKED", "PICKING", "LOADING", "DISPATCHED", "COMPLETED"];
const NAMES = ["Bu Sari", "Pak Hendra", "Bu Ratna", "Pak Dedi", "Bu Wulan", "Pak Anton", "Bu Maya", "Pak Rudi"];
const INCIDENTS = [
  ["DELAY", 34, ["Truk terjebak macet panjang di jalur utama", "Kendaraan menunggu antrean bongkar di gudang tujuan", "Cuaca buruk, perjalanan tertunda"]],
  ["DAMAGED", 28, ["Beberapa karton penyok di sisi pintu", "Karton basah terkena rembesan atap bak", "Produk pecah saat bongkar muat"]],
  ["SHORTAGE", 14, ["Jumlah karton kurang dari surat jalan", "Satu palet tidak ikut terkirim"]],
  ["TEMPERATURE", 10, ["Suhu bak naik di atas batas selama 2 jam", "Unit pendingin sempat mati di perjalanan"]],
  ["ACCIDENT", 6, ["Truk tergelincir di tikungan, muatan aman", "Senggolan dengan kendaraan lain, bak penyok"]],
  ["RETURN", 8, ["Penerima menolak sebagian barang, diretur", "Salah alamat kirim, barang dikembalikan"]],
];

const day = (offset) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const iso = (d) => d.toISOString().slice(0, 10);
const at = (d, hours) => new Date(d.getTime() + hours * 3_600_000);

await client.connect();
try {
  if (process.argv.includes("--reset")) {
    await client.query("DELETE FROM shipping_incident WHERE incident_no LIKE 'INC-DEMO-%'");
    await client.query("DELETE FROM shipping_plan WHERE plan_no LIKE 'SP-DEMO-%'");
    console.log("Removed existing demo data.");
  }
  const existing = await client.query("SELECT COUNT(*)::int AS n FROM shipping_plan WHERE plan_no LIKE 'SP-DEMO-%'");
  if (existing.rows[0].n > 0) {
    console.log(`Demo data is already there (${existing.rows[0].n} plans). Use --reset to rebuild it.`);
    process.exit(0);
  }

  // one after the other: a pg client runs a single query at a time
  const warehouses = await client.query("SELECT new_id, name FROM mst_location WHERE type = 'WAREHOUSE' AND is_active");
  const customers = await client.query("SELECT new_id, name FROM mst_location WHERE type = 'CUSTOMER' AND is_active");
  const vehicles = await client.query("SELECT new_id, type, max_payload::float8 AS max_payload, base_fee::float8 AS base_fee, rate_per_km::float8 AS rate_per_km FROM mst_vehicle WHERE is_active AND max_payload IS NOT NULL AND base_fee IS NOT NULL");
  const carriers = await client.query("SELECT new_id FROM mst_carrier WHERE is_active");
  const drivers = await client.query("SELECT new_id, carrier_new_id FROM mst_driver WHERE is_active AND carrier_new_id IS NOT NULL");
  const items = await client.query("SELECT new_id, item_code, name, weight::float8 AS weight FROM mst_cubstool WHERE is_active AND weight > 0");
  for (const [name, rows] of Object.entries({ warehouses, customers, vehicles, carriers, drivers, items })) {
    if (rows.rows.length === 0) throw new Error(`No ${name} found. Run "pnpm db:migrate" first so the master data exists.`);
  }
  const driversByCarrier = new Map();
  for (const d of drivers.rows) driversByCarrier.set(d.carrier_new_id, [...(driversByCarrier.get(d.carrier_new_id) ?? []), d.new_id]);
  const carriersWithDrivers = carriers.rows.filter((c) => driversByCarrier.has(c.new_id));

  await client.query("BEGIN");
  let planCount = 0;
  let incidentCount = 0;
  const total = 150;

  for (let n = 1; n <= total; n += 1) {
    // ship dates run from ~100 days back to 10 days ahead, denser in recent weeks
    const age = rand() < 0.14 ? -int(0, 9) : Math.round(100 * rand() ** 1.6); // days ago; negative = still to leave
    const ship = day(-age);
    const origin = pick(warehouses.rows);
    const destination = pick(customers.rows);
    const vehicle = pick(vehicles.rows);
    const handling = weighted([[null, 78], ["COLD_CHAIN", 10], ["FRAGILE", 9], ["HAZARDOUS", 3]]);

    // final status depends on how long ago the plan was due to leave
    let finalIdx;
    if (age < 0) finalIdx = weighted([[0, 25], [1, 30], [2, 30], [3, 15]]);
    else if (age <= 1) finalIdx = weighted([[3, 20], [4, 20], [5, 20], [6, 40]]);
    else if (age <= 4) finalIdx = weighted([[6, 55], [7, 40], [2, 5]]);
    else finalIdx = weighted([[7, 92], [6, 8]]);
    const cancelled = age >= 0 && rand() < 0.06;
    const path = cancelled ? [...PATH.slice(0, int(1, 4)), "CANCELLED"] : PATH.slice(0, finalIdx + 1);
    const status = path[path.length - 1];
    const idx = PATH.indexOf(status);

    // load: 1-3 products, utilisation in a believable range
    const chosen = [...new Set(Array.from({ length: int(1, 3) }, () => pick(items.rows)))];
    const lines = chosen.map((it) => ({ it, qty: int(5, 60) }));
    const totalUnits = lines.reduce((s, l) => s + l.qty, 0);
    const weightKg = Math.round(lines.reduce((s, l) => s + l.qty * l.it.weight, 0) * 100) / 100;
    const utilization = Math.round((40 + rand() * 58) * 100) / 100;

    const booked = idx >= 3 && status !== "CANCELLED";
    const distance = booked ? int(80, 2400) : null;
    const carrier = booked ? pick(carriersWithDrivers) : null;
    const driver = booked ? pick(driversByCarrier.get(carrier.new_id)) : null;
    const freight = booked ? Math.ceil((vehicle.base_fee + vehicle.rate_per_km * distance) / 1000) * 1000 : null;
    const loadingFee = booked ? pick([0, 0, 50000, 100000]) : null;
    const otherFee = booked ? pick([0, 0, 0, 25000]) : null;

    const dispatched = idx >= 6 && status !== "CANCELLED";
    const eta = dispatched ? day(-age + Math.max(1, Math.ceil(distance / 400))) : null;
    const dispatchedAt = dispatched ? at(ship, int(7, 16)) : null;
    const completed = status === "COMPLETED";
    const received = completed && rand() < 0.6;
    const deliveredAt = completed ? at(eta, received ? int(8, 18) : 24 * 2 + 6) : null;
    const created = at(ship, -24 * int(2, 9));

    const plan = await client.query(
      `INSERT INTO shipping_plan (plan_no, status, origin_location_new_id, destination_location_new_id, requested_delivery_date, planned_ship_date,
         priority, special_handling, notes, vehicle_new_id, total_units, total_weight_kg, utilization_pct,
         carrier_new_id, driver_new_id, plate_no, distance_km, base_fee, per_km_fee, freight_cost, loading_fee, other_fee, total_cost,
         delivery_note_no, dispatched_at, eta_date, grace_days, delivered_at, received_by,
         chk_vehicle_papers, chk_vehicle_clean, chk_vehicle_condition, chk_driver_ready, chk_cargo_secured, seal_no,
         created_by, created_date, updated_by, updated_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[DEMO] data contoh', $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
         $23, $24, $25, 1, $26, $27,
         $28, $28, $28, $28, $28, $29,
         'demo', $30, 'demo', $31)
       RETURNING new_id`,
      [
        `SP-DEMO-${String(n).padStart(4, "0")}`, status, origin.new_id, destination.new_id, iso(day(-age + int(2, 6))), iso(ship),
        weighted([["LOW", 10], ["NORMAL", 60], ["HIGH", 22], ["URGENT", 8]]), handling, idx >= 1 || cancelled ? vehicle.new_id : null, idx >= 1 ? totalUnits : 0, idx >= 1 ? weightKg : 0, idx >= 1 ? utilization : null,
        carrier?.new_id ?? null, driver ?? null, booked ? `B ${int(1000, 9999)} ${pick(["XY", "KD", "FA", "TR"])}` : null, distance, booked ? vehicle.base_fee : null, booked ? vehicle.rate_per_km : null, freight, loadingFee, otherFee, booked ? freight + loadingFee + otherFee : null,
        dispatched ? `SJ-DEMO-${String(n).padStart(4, "0")}` : null, dispatchedAt, eta ? iso(eta) : null, deliveredAt, received ? pick(NAMES) : null,
        idx >= 6 && status !== "CANCELLED", dispatched ? `SEG-${int(100000, 999999)}` : null,
        created, at(ship, idx * 3),
      ],
    );
    const planId = plan.rows[0].new_id;
    planCount += 1;

    if (idx >= 1 || cancelled) {
      for (const l of lines) {
        const done = dispatched;
        await client.query(
          `INSERT INTO shipping_plan_item (plan_new_id, cubstool_new_id, item_code, item_name, unit_weight_kg, qty, picked_qty, loaded_qty) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [planId, l.it.new_id, l.it.item_code, l.it.name, l.it.weight, l.qty, done ? l.qty : null, done ? l.qty : null],
        );
      }
    }

    // history: one entry per status step, a few hours apart
    let previous = null;
    for (const [step, to] of path.entries()) {
      await client.query(
        `INSERT INTO shipping_plan_history (plan_new_id, from_status, to_status, note, changed_by, changed_date) VALUES ($1, $2, $3, $4, 'demo', $5)`,
        [planId, previous, to, to === "DRAFT" ? "Plan created" : to === "CANCELLED" ? "Dibatalkan: permintaan berubah" : to === "COMPLETED" ? (received ? "Diterima" : "Selesai otomatis: tidak ada insiden sampai batas ETA") : null, at(created, step * 5)],
      );
      previous = to;
    }

    // incidents on about one in seven shipped plans
    if (dispatched && rand() < 0.15) {
      const [type, , texts] = weighted(INCIDENTS.map((e) => [e, e[1]]));
      const occurred = day(-Math.max(0, age - int(0, 2)));
      const recent = age <= 8;
      const state = recent ? weighted([["OPEN", 35], ["IN_PROGRESS", 40], ["CLAIM_FILED", 25]]) : weighted([["RESOLVED", 65], ["REJECTED", 10], ["CLAIM_FILED", 25]]);
      const claim = ["DAMAGED", "SHORTAGE", "TEMPERATURE", "ACCIDENT"].includes(type) && state !== "OPEN" && rand() < 0.7;
      const closed = state === "RESOLVED" || state === "REJECTED";
      const target = day(-Math.max(0, age - int(0, 2)) + int(3, 7));
      const claimAmount = claim ? int(2, 40) * 100000 : null;
      const newIncident = await client.query(
        `INSERT INTO shipping_incident (incident_no, plan_new_id, type, status, occurred_date, description, target_date, solution, claim_amount, claim_party, resolved_at, created_by, created_date, updated_by, updated_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'demo', $12, 'demo', $13) RETURNING new_id`,
        [
          `INC-DEMO-${String(++incidentCount).padStart(4, "0")}`, planId, type, state, iso(occurred), pick(texts), iso(target),
          closed ? (state === "REJECTED" ? "Laporan tidak terbukti, ditutup" : pick(["Carrier mengganti barang", "Dipotong dari tagihan carrier", "Dikirim ulang tanpa biaya"])) : null,
          claimAmount, claim ? "Carrier" : null, closed ? at(target, -24) : null, at(occurred, 9), at(occurred, 9 + (state === "OPEN" ? 0 : 20)),
        ],
      );
      const incidentId = newIncident.rows[0].new_id;
      const trail = ["OPEN", ...(state === "OPEN" ? [] : ["IN_PROGRESS"]), ...(state === "CLAIM_FILED" ? ["CLAIM_FILED"] : []), ...(closed ? [state] : [])];
      let from = null;
      for (const [step, to] of trail.entries()) {
        await client.query(
          `INSERT INTO shipping_incident_history (incident_new_id, from_status, to_status, note, changed_by, changed_date) VALUES ($1, $2, $3, $4, 'demo', $5)`,
          [incidentId, from, to, to === "OPEN" ? "Insiden dilaporkan" : null, at(occurred, 9 + step * 10)],
        );
        from = to;
      }
    }
  }

  await client.query("COMMIT");
  console.log(`Added ${planCount} demo plans and ${incidentCount} incidents.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
