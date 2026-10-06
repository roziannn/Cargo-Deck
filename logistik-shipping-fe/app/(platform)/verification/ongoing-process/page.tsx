"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, Plus, Printer, Eye, MoreHorizontal, EditIcon, Archive, FileText, CheckCircle2, Lock, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { generateCppReport } from "@/lib/report-cpp";
import { generateCqaReport } from "@/lib/report-cqa";
import { generateTrendReport } from "@/lib/report-trend";

type BatchRow = {
  id: number;
  productName: string;
  batchNo: string;
  category: "Process Validation Stage 2" | "On Process Verification Stage 3A" | "On Process Verification Stage 3B";
  createdBy: string;
  createdAt: string;
  status: string;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export default function OnGoingProcessPage() {
  const router = useRouter();

  const [printType, setPrintType] = useState<"CPP" | "CQA" | "TREND">("CPP");

  const [selectedTrendParameters, setSelectedTrendParameters] = useState<string[]>([]);
  const [selectedTrendAttributes, setSelectedTrendAttributes] = useState<string[]>([]);

  const [openPrint, setOpenPrint] = useState(false);

  const trendParameters = ["Assay", "Dissolution", "Uniformity", "Hardness", "Friability"];
  const trendAttribute = ["Attribute 1", "Attribute 2", "Attribute 3", "Attribute 4", "Attribute 5"];

  function toggleTrendParameter(p: string) {
    setSelectedTrendParameters((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function toggleTrendAttribute(a: string) {
    setSelectedTrendAttributes((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  const data: BatchRow[] = useMemo(
    () => [
      {
        id: 1,
        productName: "GABAPENTIN 300 MG KAPSUL/10X10",
        batchNo: "KGBTB56181",
        category: "Process Validation Stage 2",
        createdBy: "firda.tanjung",
        createdAt: "2025-08-20",
        status: "Draft",
      },
      {
        id: 2,
        productName: "GABAPENTIN 300 MG KAPSUL/10X10",
        batchNo: "KGBTB56182",
        category: "On Process Verification Stage 3A",
        createdBy: "firda.tanjung",
        createdAt: "2025-10-26",
        status: "Submit",
      },
      {
        id: 3,
        productName: "GABAPENTIN 300 MG KAPSUL/10X10",
        batchNo: "KGBTB56183",
        category: "On Process Verification Stage 3A",
        createdBy: "firda.tanjung",
        createdAt: "2025-10-26",
        status: "Lock",
      },
      {
        id: 4,
        productName: "GABAPENTIN 300 MG KAPSUL/10X10",
        batchNo: "KGBTB56184",
        category: "On Process Verification Stage 3B",
        createdBy: "firda.tanjung",
        createdAt: "2025-10-26",
        status: "Draft",
      },
      {
        id: 5,
        productName: "CRAVIT 200 MG",
        batchNo: "CRV200-001",
        category: "On Process Verification Stage 3A",
        createdBy: "grace.nababan",
        createdAt: "2025-10-25",
        status: "Submit",
      },
      {
        id: 6,
        productName: "CRAVIT 200 MG",
        batchNo: "CRV200-002",
        category: "On Process Verification Stage 3A",
        createdBy: "grace.nababan",
        createdAt: "2025-10-26",
        status: "Draft",
      },
      {
        id: 7,
        productName: "GABAPENTIN 300 MG KAPSUL/10X10",
        batchNo: "KGBTB56184",
        category: "On Process Verification Stage 3A",
        createdBy: "grace.nababan",
        createdAt: "2025-10-26",
        status: "Archive",
      },
    ],
    [],
  );

  const [search, setSearch] = useState("");

  const products = useMemo(() => Array.from(new Set(data.map((x) => x.productName))), [data]);

  const [selectedProduct, setSelectedProduct] = useState<string>(products[0]);
  const categories = useMemo(() => Array.from(new Set(data.map((x) => x.category))), [data]);

  const [selectedCategory, setSelectedCategory] = useState<string>("All Stage");

  const [selectedStatus, setSelectedStatus] = useState<string>("All Status");

  const statuses = useMemo(() => Array.from(new Set(data.map((x) => x.status))), [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return data.filter((x) => {
      const matchProduct = x.productName === selectedProduct;

      const matchCategory = selectedCategory === "All Stage" || x.category === selectedCategory;

      const matchStatus = selectedStatus === "All Status" || x.status === selectedStatus;

      const matchSearch = x.batchNo.toLowerCase().includes(q) || x.productName.toLowerCase().includes(q);

      return matchProduct && matchCategory && matchStatus && matchSearch;
    });
  }, [data, search, selectedProduct, selectedCategory, selectedStatus]);

  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [printSearch, setPrintSearch] = useState("");

  const filteredForPrint = useMemo(() => {
    const q = printSearch.toLowerCase();

    return filtered.filter((x) => x.batchNo.toLowerCase().includes(q) || x.createdBy.toLowerCase().includes(q));
  }, [filtered, printSearch]);

  const allSelected = filteredForPrint.length > 0 && filteredForPrint.every((x) => selectedBatchIds.includes(x.id));

  function toggleSelectAll() {
    const ids = filteredForPrint.map((x) => x.id);

    if (allSelected) {
      setSelectedBatchIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedBatchIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }

  function toggleOne(id: number) {
    setSelectedBatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const [openAdd, setOpenAdd] = useState(false);

  const [form, setForm] = useState({
    recipeRuah: "",
    recipeKemas: "",
    batchNo: "",
    description: "",
  });

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ongoing Process
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage ongoing process for manufacturing process control and monitoring.
        </p>
      </div>

      <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Warning</p>
            <p className="text-sm">Module verification ongoing process masih dalam pengembangan.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-md text-muted-foreground font-semibold">
          <span className="inline-flex items-center rounded-md border border-dashed border-primary bg-primary/10 px-2 py-0.5 text-foreground">
            {selectedProduct} - {selectedCategory}
          </span>
        </div>

        <div className="flex gap-2">
          {/* product filter */}
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            {products.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* category filter */}
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="All Stage">All Category Stage</option>

            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="search batch..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="All Status">All Status</option>

            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {/* PRINT REPORT*/}
          <Dialog open={openPrint} onOpenChange={setOpenPrint}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Printer className="mr-1 h-4 w-4" />
                Print Report
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Print Report</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto_1fr]">
                <div className="space-y-4">
                  <div className="text-sm font-medium">Select Batch</div>

                  <Input placeholder="Search batch or created by..." value={printSearch} onChange={(e) => setPrintSearch(e.target.value)} />

                  <div className="flex items-center gap-2">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                    <span className="text-sm">Select All (filtered)</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-md border p-2 space-y-2">
                    {filteredForPrint.map((row) => (
                      <label key={row.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={selectedBatchIds.includes(row.id)} onCheckedChange={() => toggleOne(row.id)} />
                        <span className="flex-1">{row.batchNo}</span>
                        <span className="text-xs text-muted-foreground">{row.createdBy}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator orientation="vertical" className="hidden md:block" />

                <div className="space-y-4">
                  <div className="text-sm font-medium">Report Type</div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="printType" checked={printType === "CPP"} onChange={() => setPrintType("CPP")} />
                      Lembar hasil CPP
                    </label>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="printType" checked={printType === "CQA"} onChange={() => setPrintType("CQA")} />
                      Lembar hasil CQA
                    </label>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="printType" checked={printType === "TREND"} onChange={() => setPrintType("TREND")} />
                      Grafik Trend
                    </label>
                  </div>

                  {printType === "TREND" && (
                    <div className="space-y-3 pt-2">
                      <div className="text-sm font-medium">Select Parameter Or Attribute</div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* kiri - parameter */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Parameter</div>

                          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                            {trendParameters.map((p) => (
                              <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={selectedTrendParameters.includes(p)} onCheckedChange={() => toggleTrendParameter(p)} />
                                <span>{p}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* kanan - attribute */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Attribute</div>

                          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                            {trendAttribute.map((a) => (
                              <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={selectedTrendAttributes.includes(a)} onCheckedChange={() => toggleTrendAttribute(a)} />
                                <span>{a}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setOpenPrint(false)}>
                  Cancel
                </Button>

                <Button
                  disabled={selectedBatchIds.length === 0 || (printType === "TREND" && (selectedTrendParameters.length === 0 || selectedTrendAttributes.length === 0))}
                  onClick={async () => {
                    const header = {
                      productName: selectedProduct,
                      batchNo: filtered.find((x) => selectedBatchIds.includes(x.id))?.batchNo ?? "",
                      ppiRuah: "KGBT2 10-10",
                      ppiKemas: "KGBT2 10-11",
                      keterangan: "On Process Verification On Process Verification Stage 3A",
                    };

                    const rows = [
                      {
                        no: 1,
                        tahapan: "Pengayakan Gabapentin",
                        parameter: "Kondisi Ayakan Sebelum Proses",
                        tipe: "CPP",
                        persyaratan: "Baik",
                        hasil: "Baik",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 2,
                        tahapan: "Pengayakan Gabapentin",
                        parameter: "Ukuran Mesh",
                        tipe: "CPP",
                        persyaratan: "Mesh 12",
                        hasil: "Mesh 12",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 3,
                        tahapan: "Pengayakan Sodium Starch Glycolate",
                        parameter: "Kondisi Ayakan Sebelum Proses",
                        tipe: "CPP",
                        persyaratan: "Baik",
                        hasil: "Baik",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 4,
                        tahapan: "Pengayakan Sodium Starch Glycolate",
                        parameter: "Ukuran Mesh",
                        tipe: "CPP",
                        persyaratan: "Mesh 30",
                        hasil: "Mesh 30",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 5,
                        tahapan: "Pengayakan Magnesium Stearat",
                        parameter: "Kondisi Ayakan Sebelum Proses",
                        tipe: "CPP",
                        persyaratan: "Baik",
                        hasil: "Baik",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 6,
                        tahapan: "Pengayakan Magnesium Stearat",
                        parameter: "Ukuran Mesh",
                        tipe: "CPP",
                        persyaratan: "Mesh 30",
                        hasil: "Mesh 30",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 7,
                        tahapan: "Final Mixing I",
                        parameter: "Impeller (RPM)",
                        tipe: "CPP",
                        persyaratan: "50",
                        hasil: "50",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 8,
                        tahapan: "Final Mixing I",
                        parameter: "Chopper (RPM)",
                        tipe: "CPP",
                        persyaratan: "500",
                        hasil: "500",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 9,
                        tahapan: "Final Mixing I",
                        parameter: "Waktu Mixing (detik)",
                        tipe: "CPP",
                        persyaratan: "300",
                        hasil: "300",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 10,
                        tahapan: "Final Mixing I",
                        parameter: "Suhu (°C)",
                        tipe: "CPP",
                        persyaratan: "Max 25",
                        hasil: "25",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 11,
                        tahapan: "Final Mixing II",
                        parameter: "Impeller (RPM)",
                        tipe: "CPP",
                        persyaratan: "50",
                        hasil: "50",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 12,
                        tahapan: "Final Mixing II",
                        parameter: "Chopper (RPM)",
                        tipe: "CPP",
                        persyaratan: "500",
                        hasil: "500",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 13,
                        tahapan: "Final Mixing II",
                        parameter: "Waktu Mixing (detik)",
                        tipe: "CPP",
                        persyaratan: "300",
                        hasil: "300",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 14,
                        tahapan: "Final Mixing II",
                        parameter: "Suhu (°C)",
                        tipe: "CPP",
                        persyaratan: "Max 25",
                        hasil: "24",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 15,
                        tahapan: "Filling",
                        parameter: "RH (%)",
                        tipe: "CPP",
                        persyaratan: "Max 50",
                        hasil: "48",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 16,
                        tahapan: "Filling",
                        parameter: "Suhu Ruangan (°C)",
                        tipe: "CPP",
                        persyaratan: "20 - 25",
                        hasil: "24",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 17,
                        tahapan: "Filling",
                        parameter: "Kecepatan Filling (capsule/hour)",
                        tipe: "CPP",
                        persyaratan: "0 - 35000",
                        hasil: "34000",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 18,
                        tahapan: "Filling",
                        parameter: "Berat Isi Rata-rata (mg)",
                        tipe: "CPP",
                        persyaratan: "±5%",
                        hasil: "OK",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 19,
                        tahapan: "In Process Control",
                        parameter: "Kebersihan Area",
                        tipe: "CPP",
                        persyaratan: "Bersih",
                        hasil: "Bersih",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                      {
                        no: 20,
                        tahapan: "In Process Control",
                        parameter: "Ketersediaan Line Clearance",
                        tipe: "CPP",
                        persyaratan: "Ada",
                        hasil: "Ada",
                        kesimpulan: "MEMENUHI SYARAT",
                      },
                    ];

                    if (printType === "CPP") {
                      generateCppReport(header, rows);
                      setOpenPrint(false);
                      return;
                    }

                    if (printType === "CQA") {
                      generateCqaReport(header, rows);
                      setOpenPrint(false);
                      return;
                    }

                    if (printType === "TREND") {
                      const selectedBatches = filtered.filter((x) => selectedBatchIds.includes(x.id));

                      await generateTrendReport(
                        {
                          header,
                          batches: selectedBatches,
                          parameters: selectedTrendParameters,
                          attributes: selectedTrendAttributes,
                        },
                        1,
                      );

                      setOpenPrint(false);
                      return;
                    }
                  }}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                Add New
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Product Name</label>
                  <Input value={selectedProduct} disabled />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Recipe Ruah</label>
                  <Input
                    value={form.recipeRuah}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        recipeRuah: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Recipe Kemas</label>
                  <Input
                    value={form.recipeKemas}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        recipeKemas: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Batch No.</label>
                  <Input
                    value={form.batchNo}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        batchNo: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Description</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select stage</option>
                    <option value="Process Validation Stage 2">Process Validation Stage 2</option>
                    <option value="On Process Verification Stage 3A">On Process Verification Stage 3A</option>
                    <option value="On Process Verification Stage 3B">On Process Verification Stage 3B</option>
                  </select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenAdd(false)}>
                  Cancel
                </Button>

                <Button
                  onClick={() => {
                    const payload = {
                      productName: selectedProduct,
                      ...form,
                    };

                    console.log("CREATE:", payload);

                    setForm({
                      recipeRuah: "",
                      recipeKemas: "",
                      batchNo: "",
                      description: "",
                    });

                    setOpenAdd(false);
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>Batch No.</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.productName}</TableCell>
              <TableCell>{row.batchNo}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.status === "Draft"
                      ? "warning"
                      : row.status === "Submit"
                        ? "info"
                        : row.status === "Lock"
                          ? "destructive"
                          : "secondary"
                  }
                >
                  {row.status === "Draft" && <FileText className="h-3.5 w-3.5" />}
                  {row.status === "Submit" && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {row.status === "Lock" && <Lock className="h-3.5 w-3.5" />}
                  {row.status === "Archive" && <Archive className="h-3.5 w-3.5" />}

                  {row.status}
                </Badge>
              </TableCell>

              <TableCell>{row.createdBy}</TableCell>
              <TableCell>{dateFormatter.format(new Date(row.createdAt))}</TableCell>

              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <MoreHorizontal className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/validation/ongoing-process/${row.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => console.log("archive", row.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => console.log("edit", row.id)}>
                      <EditIcon className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}

          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                No data found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
