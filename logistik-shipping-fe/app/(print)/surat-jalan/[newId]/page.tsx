"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";

import { getStoredAuthToken } from "@/lib/api/auth";
import { formatPlanDate, formatPlanDateTime, getDeliveryNote, type DeliveryNote } from "@/lib/api/shipping-plan";

const HANDLING: Record<string, string> = { COLD_CHAIN: "Cold chain (jaga suhu)", FRAGILE: "Mudah pecah", HAZARDOUS: "Barang berbahaya" };
const PRIORITY: Record<string, string> = { LOW: "Rendah", NORMAL: "Normal", HIGH: "Tinggi", URGENT: "Mendesak" };

function Party({ title, name, address, city, contact, phone }: { title: string; name: string; address: string | null; city: string | null; contact: string | null; phone: string | null }) {
  return (
    <div className="border border-black p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{title}</div>
      <div className="mt-1 text-sm font-semibold">{name}</div>
      <div className="mt-0.5 text-xs leading-snug">
        {address || "-"}
        {city ? `, ${city}` : ""}
      </div>
      <div className="mt-1 text-xs">
        {contact || "-"}
        {phone ? ` · ${phone}` : ""}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-28 shrink-0 text-neutral-600">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

export default function DeliveryNotePage() {
  const { newId } = useParams<{ newId: string }>();
  const [data, setData] = useState<DeliveryNote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDeliveryNote(newId, getStoredAuthToken() ?? undefined)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal mengambil surat jalan."));
  }, [newId]);

  if (error) return <div className="p-8 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-sm text-neutral-600">Memuat surat jalan...</div>;

  const { plan, note, items, preview } = data;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalWeight = items.reduce((sum, item) => sum + (item.unitWeightKg ? Number(item.unitWeightKg) * item.qty : 0), 0);
  const issuedAt = note.dispatchedAt ? formatPlanDateTime(note.dispatchedAt) : null;

  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; } }`}</style>

      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-4 print:hidden">
        <div className="space-y-1">
          <Link href={`/shipping/plan/${newId}`} className="inline-flex items-center text-sm text-neutral-600 hover:text-black">
            <ChevronLeft className="mr-1 h-4 w-4" /> Kembali ke plan
          </Link>
          <div className="text-sm text-neutral-700">
            {preview ? "Preview — surat jalan belum diterbitkan, nomor akan muncul setelah plan diberangkatkan." : `Surat jalan ${note.deliveryNoteNo}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="relative mx-auto mb-8 min-h-[297mm] max-w-[210mm] bg-white p-[12mm] shadow-lg print:mb-0 print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        {preview && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="-rotate-30 text-7xl font-bold tracking-widest text-neutral-200 print:text-neutral-300">PREVIEW</div>
          </div>
        )}

        <div className="relative space-y-4">
          <div className="flex items-start justify-between border-b-2 border-black pb-3">
            <div>
              <div className="text-lg font-bold tracking-wide">CARGO DECK</div>
              <div className="text-xs text-neutral-600">Logistic Shipping System</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold tracking-wider">SURAT JALAN</div>
              <div className="text-sm font-semibold">{note.deliveryNoteNo ?? "(belum diterbitkan)"}</div>
              <div className="text-xs text-neutral-600">{issuedAt ? `Diterbitkan ${issuedAt}` : `Rencana kirim ${formatPlanDate(plan.plannedShipDate)}`}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Party title="Pengirim" name={note.originName} address={note.originAddress} city={note.originCity} contact={note.originContact} phone={note.originPhone} />
            <Party title="Penerima" name={note.destinationName} address={note.destinationAddress} city={note.destinationCity} contact={note.destinationContact} phone={note.destinationPhone} />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 border border-black p-3">
            <Info label="No. Shipping Plan" value={plan.planNo} />
            <Info label="Carrier" value={`${note.carrierName ?? "-"}${note.carrierType === "OWN" ? " (armada sendiri)" : ""}`} />
            <Info label="Tanggal kirim" value={formatPlanDate(plan.plannedShipDate)} />
            <Info label="Jenis kendaraan" value={[note.vehicleName, note.vehicleType].filter(Boolean).join(" · ")} />
            <Info label="Permintaan tiba" value={formatPlanDate(plan.requestedDeliveryDate)} />
            <Info label="No. Polisi" value={plan.plateNo ?? ""} />
            <Info label="Prioritas" value={PRIORITY[plan.priority] ?? plan.priority} />
            <Info label="Driver" value={note.driverName ?? ""} />
            <Info label="Penanganan khusus" value={plan.specialHandling ? (HANDLING[plan.specialHandling] ?? plan.specialHandling) : "Tidak ada"} />
            <Info label="No. HP / SIM" value={[note.driverPhone, note.driverLicenseNo].filter(Boolean).join(" / ")} />
          </div>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="w-8 border border-black px-2 py-1.5 text-center">No</th>
                <th className="w-24 border border-black px-2 py-1.5 text-left">Kode</th>
                <th className="border border-black px-2 py-1.5 text-left">Nama barang</th>
                <th className="w-20 border border-black px-2 py-1.5 text-right">Jumlah (karton)</th>
                <th className="w-24 border border-black px-2 py-1.5 text-right">Berat satuan (kg)</th>
                <th className="w-24 border border-black px-2 py-1.5 text-right">Berat total (kg)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.cubstoolNewId}>
                  <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                  <td className="border border-black px-2 py-1">{item.itemCode}</td>
                  <td className="border border-black px-2 py-1">{item.itemName}</td>
                  <td className="border border-black px-2 py-1 text-right">{item.qty}</td>
                  <td className="border border-black px-2 py-1 text-right">{item.unitWeightKg ?? "-"}</td>
                  <td className="border border-black px-2 py-1 text-right">{item.unitWeightKg ? +(Number(item.unitWeightKg) * item.qty).toFixed(2) : "-"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={3} className="border border-black px-2 py-1.5 text-right">
                  Total
                </td>
                <td className="border border-black px-2 py-1.5 text-right">{totalQty}</td>
                <td className="border border-black px-2 py-1.5" />
                <td className="border border-black px-2 py-1.5 text-right">{+totalWeight.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="border border-black p-3 text-xs">
            <div className="font-semibold">Catatan</div>
            <div className="mt-1 min-h-8">{plan.notes || "-"}</div>
          </div>

          <p className="text-[11px] leading-snug text-neutral-700">
            Barang di atas diterima oleh penerima dalam keadaan baik dan jumlah sesuai dengan surat jalan ini. Selisih atau kerusakan harus dicatat pada kolom catatan dan diketahui driver sebelum surat jalan ditandatangani.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-2 text-center text-xs">
            {["Pengirim (Gudang)", "Driver", "Penerima"].map((role) => (
              <div key={role}>
                <div className="font-semibold">{role}</div>
                <div className="mt-14 border-t border-black pt-1 text-neutral-600">Nama jelas, tanggal, tanda tangan &amp; cap</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
