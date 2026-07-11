"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

// Kolom wajib yang harus ada di CSV
// gajiPokok tidak wajib : jika kosong, auto-lookup dari Tabel PP 5/2024
const REQUIRED_COLUMNS = [
  "nip",
  "nama",
  "jabatan",
  "pangkat",
  "golonganRuang",
  "tmtGolongan",
  "mkgTahun",
  "mkgBulan",
  "tmtKgbTerakhir",
  "tmtKgbBerikutnya",
];

// Template CSV header
const TEMPLATE_HEADER = [
  "nip",
  "nama",
  "jabatan",
  "pangkat",
  "golonganRuang",
  "tmtGolongan",
  "mkgTahun",
  "mkgBulan",
  "gajiPokok",
  "tmtKgbTerakhir",
  "tmtKgbBerikutnya",
  "tempatLahir",
  "tanggalLahir",
  "jenisKelamin",
  "pendidikanTerakhir",
  "eselon",
  "statusHukdis",
  "keteranganHukdis",
];

const TEMPLATE_EXAMPLE = [
  "197701102000031002",
  "MUHIDI ASPARI",
  "Penata Muda Tk. I",
  "Penata Muda Tingkat I",
  "III/b",
  "2024-04-01",
  "19",
  "1",
  "3838300",
  "2024-03-01",
  "2026-03-01",
  "Banjarmasin",
  "1977-01-10",
  "Laki-laki",
  "S1",
  "Non Eselon",
  "false",
  "",
];

interface RowData {
  [key: string]: string;
}

interface ValidationResult {
  valid: RowData[];
  errors: { row: number; nip: string; nama: string; pesan: string }[];
}

function downloadTemplate() {
  const rows = [TEMPLATE_HEADER, TEMPLATE_EXAMPLE];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_import_pegawai.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function validateRows(rows: RowData[]): ValidationResult {
  const valid: RowData[] = [];
  const errors: { row: number; nip: string; nama: string; pesan: string }[] =
    [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 karena baris 1 = header
    // Strip Excel text formula prefix ="..." jika ada (dari hasil export CSV)
    if (row.nip) row.nip = row.nip.replace(/^="(.*)"$/, "$1").trim();

    // Deteksi NIP rusak akibat Excel menyimpan angka panjang sebagai scientific notation
    if (row.nip && /^[\d.]+[Ee][+\-]?\d+$/.test(row.nip.trim())) {
      errors.push({
        row: rowNum,
        nip: row.nip,
        nama: row.nama || "-",
        pesan: `NIP rusak, Excel mengubah NIP menjadi "${row.nip}" (scientific notation). Jangan simpan file CSV dari Excel. Gunakan Notepad/VS Code untuk edit CSV, atau ketik NIP di Excel dengan format ="199804022090120010" agar tidak dikonversi.`,
      });
      return;
    }

    const missing = REQUIRED_COLUMNS.filter((col) => !row[col]?.trim());

    if (missing.length > 0) {
      errors.push({
        row: rowNum,
        nip: row.nip || "-",
        nama: row.nama || "-",
        pesan: `Kolom wajib kosong: ${missing.join(", ")}`,
      });
      return;
    }

    // Validasi format tanggal
    const dateFields = ["tmtGolongan", "tmtKgbTerakhir", "tmtKgbBerikutnya"];
    for (const field of dateFields) {
      if (row[field] && isNaN(new Date(row[field]).getTime())) {
        errors.push({
          row: rowNum,
          nip: row.nip,
          nama: row.nama,
          pesan: `Format tanggal ${field} tidak valid (gunakan YYYY-MM-DD)`,
        });
        return;
      }
    }

    // Validasi golongan
    const golonganValid = [
      "I/a",
      "I/b",
      "I/c",
      "I/d",
      "II/a",
      "II/b",
      "II/c",
      "II/d",
      "III/a",
      "III/b",
      "III/c",
      "III/d",
      "IV/a",
      "IV/b",
      "IV/c",
      "IV/d",
      "IV/e",
    ];
    if (!golonganValid.includes(row.golonganRuang)) {
      errors.push({
        row: rowNum,
        nip: row.nip,
        nama: row.nama,
        pesan: `Golongan ruang tidak valid: ${row.golonganRuang}`,
      });
      return;
    }

    valid.push(row);
  });

  return { valid, errors };
}

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "hasil">("upload");
  const [showPanduan, setShowPanduan] = useState(false);
  const [fileName, setFileName] = useState("");
  const [validRows, setValidRows] = useState<RowData[]>([]);
  const [errorRows, setErrorRows] = useState<
    { row: number; nip: string; nama: string; pesan: string }[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [hasil, setHasil] = useState<{
    berhasil: number;
    gagal: number;
    errors: string[];
  } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as RowData[];

        // Cek apakah header sesuai
        const headers = Object.keys(rows[0] || {});
        const missingHeaders = REQUIRED_COLUMNS.filter(
          (col) => !headers.includes(col),
        );

        if (missingHeaders.length > 0) {
          setErrorRows([
            {
              row: 1,
              nip: "-",
              nama: "-",
              pesan: `Header CSV tidak sesuai template. Kolom tidak ditemukan: ${missingHeaders.join(", ")}`,
            },
          ]);
          setValidRows([]);
          setStep("preview");
          return;
        }

        const { valid, errors } = validateRows(rows);
        setValidRows(valid);
        setErrorRows(errors);
        setStep("preview");
      },
      error: () => {
        setErrorRows([
          { row: 0, nip: "-", nama: "-", pesan: "File CSV tidak bisa dibaca" },
        ]);
        setStep("preview");
      },
    });
  }

  async function handleImport() {
    setImporting(true);
    const res = await fetch("/api/pegawai/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    const data = await res.json() as any;
    setHasil(data);
    setStep("hasil");
    setImporting(false);
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setValidRows([]);
    setErrorRows([]);
    setHasil(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/dashboard/pegawai")}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ background: "var(--sub)", color: "var(--dt3)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>
            Import Pegawai dari CSV
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            Upload file CSV untuk menambahkan banyak pegawai sekaligus
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: "upload", label: "1. Upload" },
          { key: "preview", label: "2. Preview" },
          { key: "hasil", label: "3. Hasil" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step === s.key ? "var(--navy-solid)" : "var(--ln2)",
                  color: step === s.key ? "#fff" : "var(--dt5)",
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: step === s.key ? "var(--dtn)" : "var(--dt5)" }}
              >
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div className="w-8 h-px" style={{ background: "var(--ln1)" }} />
            )}
          </div>
        ))}
      </div>

      {/* -- STEP 1: UPLOAD -- */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Download template */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: "var(--tint-navy)", border: "1px solid var(--ln0)" }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                Download Template CSV
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt3)" }}>
                Gunakan template ini sebagai panduan format data
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: "var(--navy-solid)" }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Template
            </button>
          </div>

          {/* Panduan */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
            <button
              onClick={() => setShowPanduan((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between transition hover:opacity-80"
              style={{ background: "var(--sub)", borderBottom: showPanduan ? "1px solid var(--ln1)" : "none" }}
            >
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Panduan Pengisian Kolom CSV</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--dt4)" }}>{showPanduan ? "Sembunyikan" : "Lihat panduan"}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8a9eb5" strokeWidth="2.5"
                  style={{ transform: showPanduan ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {showPanduan && (
              <>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--sub)", borderBottom: "1px solid var(--ln1)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Panduan Pengisian Kolom CSV</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Wajib</span>
                  <span className="text-xs" style={{ color: "var(--dt4)" }}>harus diisi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "var(--sub)", color: "var(--dt4)", border: "1px solid var(--ln1)" }}>Opsional</span>
                  <span className="text-xs" style={{ color: "var(--dt4)" }}>boleh kosong</span>
                </div>
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: "var(--ln2)" }}>
              {[
                {
                  kolom: "nip",
                  wajib: true,
                  deskripsi: "Nomor Induk Pegawai",
                  format: "18 digit angka",
                  contoh: "197701102000031002",
                },
                {
                  kolom: "nama",
                  wajib: true,
                  deskripsi: "Nama lengkap pegawai",
                  format: "Teks bebas, gunakan huruf kapital",
                  contoh: "MUHIDI ASPARI",
                },
                {
                  kolom: "jabatan",
                  wajib: true,
                  deskripsi: "Nama jabatan struktural/fungsional",
                  format: "Teks bebas",
                  contoh: "Penata Muda Tk. I",
                },
                {
                  kolom: "pangkat",
                  wajib: true,
                  deskripsi: "Nama pangkat lengkap",
                  format: "Teks bebas",
                  contoh: "Penata Muda Tingkat I",
                },
                {
                  kolom: "golonganRuang",
                  wajib: true,
                  deskripsi: "Golongan dan ruang",
                  format: "I/a · I/b · I/c · I/d · II/a · II/b · II/c · II/d · III/a · III/b · III/c · III/d · IV/a · IV/b · IV/c · IV/d · IV/e",
                  contoh: "III/b",
                },
                {
                  kolom: "tmtGolongan",
                  wajib: true,
                  deskripsi: "Tanggal Mulai Terhitung (TMT) golongan saat ini",
                  format: "YYYY-MM-DD",
                  contoh: "2024-04-01",
                },
                {
                  kolom: "mkgTahun",
                  wajib: true,
                  deskripsi: "Masa Kerja Golongan dalam tahun",
                  format: "Angka bulat",
                  contoh: "19",
                },
                {
                  kolom: "mkgBulan",
                  wajib: true,
                  deskripsi: "Masa Kerja Golongan sisa bulan (0–11)",
                  format: "Angka 0–11",
                  contoh: "1",
                },
                {
                  kolom: "gajiPokok",
                  wajib: false,
                  deskripsi: "Gaji pokok saat ini (rupiah). Jika kosong, sistem otomatis mengambil dari Tabel PP 5/2024 berdasarkan golonganRuang + mkgTahun",
                  format: "Angka bulat tanpa titik/koma (opsional)",
                  contoh: "3838300",
                },
                {
                  kolom: "tmtKgbTerakhir",
                  wajib: true,
                  deskripsi: "TMT KGB yang terakhir diterima",
                  format: "YYYY-MM-DD",
                  contoh: "2024-03-01",
                },
                {
                  kolom: "tmtKgbBerikutnya",
                  wajib: true,
                  deskripsi: "TMT KGB periode berikutnya (biasanya +2 tahun dari terakhir)",
                  format: "YYYY-MM-DD",
                  contoh: "2026-03-01",
                },
                {
                  kolom: "tempatLahir",
                  wajib: false,
                  deskripsi: "Kota/kabupaten tempat lahir",
                  format: "Teks bebas",
                  contoh: "Banjarmasin",
                },
                {
                  kolom: "tanggalLahir",
                  wajib: false,
                  deskripsi: "Tanggal lahir pegawai",
                  format: "YYYY-MM-DD",
                  contoh: "1977-01-10",
                },
                {
                  kolom: "jenisKelamin",
                  wajib: false,
                  deskripsi: "Jenis kelamin",
                  format: "Laki-laki · Perempuan",
                  contoh: "Laki-laki",
                },
                {
                  kolom: "pendidikanTerakhir",
                  wajib: false,
                  deskripsi: "Pendidikan terakhir",
                  format: "SD · SMP · SMA/SMK · D3 · S1 · S2 · S3",
                  contoh: "S1",
                },
                {
                  kolom: "eselon",
                  wajib: false,
                  deskripsi: "Eselon jabatan struktural",
                  format: "Eselon I · Eselon II · Eselon III · Eselon IV · Non Eselon",
                  contoh: "Non Eselon",
                },
                {
                  kolom: "statusHukdis",
                  wajib: false,
                  deskripsi: "Status Hukuman Disiplin aktif",
                  format: "true · false (default: false)",
                  contoh: "false",
                },
                {
                  kolom: "keteranganHukdis",
                  wajib: false,
                  deskripsi: "Keterangan hukuman disiplin jika ada",
                  format: "Teks bebas, kosongkan jika tidak ada",
                  contoh: "",
                },
              ].map((item) => (
                <div key={item.kolom} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-start hover:bg-gray-50 transition-colors">
                  <div className="col-span-3 flex items-center gap-2">
                    <code className="text-xs font-mono font-semibold" style={{ color: "var(--dtn)" }}>{item.kolom}</code>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0"
                      style={item.wajib
                        ? { background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "9px" }
                        : { background: "var(--sub)", color: "var(--dt5)", border: "1px solid var(--ln1)", fontSize: "9px" }}
                    >
                      {item.wajib ? "Wajib" : "Opsional"}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <p className="text-xs" style={{ color: "var(--dt3)" }}>{item.deskripsi}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>{item.format}</p>
                  </div>
                  <div className="col-span-2">
                    {item.contoh ? (
                      <code className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--sub)", color: "var(--dtn)" }}>{item.contoh}</code>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--ln0)" }}>-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Catatan penting */}
            <div className="px-4 py-3 space-y-1.5" style={{ background: "var(--tint-amber-bg)", borderTop: "1px solid var(--tint-amber-ln)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--st-amber2)" }}>Catatan Penting</p>
              {[
                "Baris pertama CSV harus berisi header kolom persis seperti template.",
                "NIP yang sudah terdaftar di sistem akan dilewati secara otomatis (tidak duplikat).",
                "Urutan kolom tidak harus sama dengan template, yang penting nama kolomnya sesuai.",
                "Kolom opsional tetap harus ada di header, isinya boleh kosong.",
              ].map((note, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: "var(--amber-solid)" }} />
                  <p className="text-xs" style={{ color: "var(--st-amber2)" }}>{note}</p>
                </div>
              ))}
            </div>
              </>
            )}
          </div>

          {/* Upload area */}
          <div
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-12 cursor-pointer transition"
            style={{ borderColor: "var(--ln0)" }}
            onClick={() => fileRef.current?.click()}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a0b4c8"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p
              className="text-xs font-medium mt-3"
              style={{ color: "var(--dt3)" }}
            >
              Klik untuk pilih file CSV
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--dt5)" }}>
              Hanya file .csv yang didukung
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {/* -- STEP 2: PREVIEW -- */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-ln)" }}
            >
              <p className="text-xs" style={{ color: "var(--st-green)" }}>
                Data valid siap diimport
              </p>
              <p
                className="text-2xl font-bold mt-1"
                style={{ color: "var(--st-green)" }}
              >
                {validRows.length}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#5dcaa5" }}>
                baris
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                background: errorRows.length > 0 ? "var(--tint-red-bg)" : "var(--sub)",
                border: `1px solid ${errorRows.length > 0 ? "var(--tint-red-ln)" : "var(--ln1)"}`,
              }}
            >
              <p
                className="text-xs"
                style={{ color: errorRows.length > 0 ? "var(--st-red)" : "var(--dt4)" }}
              >
                Data bermasalah
              </p>
              <p
                className="text-2xl font-bold mt-1"
                style={{ color: errorRows.length > 0 ? "var(--st-red)" : "var(--dt5)" }}
              >
                {errorRows.length}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: errorRows.length > 0 ? "#f09595" : "var(--dt5)" }}
              >
                baris
              </p>
            </div>
          </div>

          {/* File info */}
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5a7a9a"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
              {fileName}
            </span>
          </div>

          {/* Error list */}
          {errorRows.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--tint-red-ln)" }}
            >
              <div className="px-4 py-2.5" style={{ background: "var(--tint-red-bg)" }}>
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--st-red)" }}
                >
                  Baris bermasalah, tidak akan diimport
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--tint-red-bg)" }}>
                {errorRows.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "var(--tint-red-ln)" }}
                    >
                      Baris {e.row}
                    </span>
                    <div>
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--st-red)" }}
                      >
                        {e.nama} ({e.nip})
                      </p>
                      <p className="text-xs" style={{ color: "#f87171" }}>
                        {e.pesan}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid preview table */}
          {validRows.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "0.5px solid var(--ln1)" }}
            >
              <div className="px-4 py-2.5" style={{ background: "var(--sub)" }}>
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--dtn)" }}
                >
                  Preview data valid ({validRows.length} baris)
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid var(--ln1)" }}>
                      {[
                        "NIP",
                        "Nama",
                        "Jabatan",
                        "Golongan",
                        "TMT KGB Berikutnya",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2 text-xs font-semibold"
                          style={{ color: "var(--dt4)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 10).map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom:
                            i < Math.min(validRows.length, 10) - 1
                              ? "0.5px solid var(--ln2)"
                              : "none",
                        }}
                      >
                        <td
                          className="px-4 py-2 text-xs"
                          style={{ color: "var(--dt4)" }}
                        >
                          {row.nip}
                        </td>
                        <td
                          className="px-4 py-2 text-xs font-medium"
                          style={{ color: "var(--dtn)" }}
                        >
                          {row.nama}
                        </td>
                        <td
                          className="px-4 py-2 text-xs"
                          style={{ color: "var(--dt3)" }}
                        >
                          {row.jabatan}
                        </td>
                        <td
                          className="px-4 py-2 text-xs"
                          style={{ color: "var(--dt3)" }}
                        >
                          {row.golonganRuang}
                        </td>
                        <td
                          className="px-4 py-2 text-xs"
                          style={{ color: "var(--dt3)" }}
                        >
                          {row.tmtKgbBerikutnya}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > 10 && (
                  <div
                    className="px-4 py-2 text-xs text-center"
                    style={{
                      color: "var(--dt5)",
                      borderTop: "0.5px solid var(--ln2)",
                    }}
                  >
                    ...dan {validRows.length - 10} baris lainnya
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={reset}
              className="flex-1 text-xs py-2.5 rounded-xl transition"
              style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
            >
              Upload Ulang
            </button>
            {validRows.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                style={{ background: "var(--navy-solid)" }}
              >
                {importing
                  ? "Mengimport..."
                  : `Import ${validRows.length} Pegawai`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* -- STEP 3: HASIL -- */}
      {step === "hasil" && hasil && (
        <div className="space-y-4">
          {/* Summary hasil */}
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "var(--tint-navy)", border: "1px solid var(--ln0)" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: hasil.berhasil > 0 ? "var(--tint-green-bg)" : "var(--tint-red-bg)" }}
            >
              {hasil.berhasil > 0 ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0f6e56"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>
              Import Selesai
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--dt3)" }}>
              <span style={{ color: "var(--st-green)", fontWeight: 600 }}>
                {hasil.berhasil} berhasil
              </span>
              {hasil.gagal > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span style={{ color: "var(--st-red)", fontWeight: 600 }}>
                    {hasil.gagal} gagal
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Error dari server */}
          {hasil.errors.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--tint-red-ln)" }}
            >
              <div className="px-4 py-2.5" style={{ background: "var(--tint-red-bg)" }}>
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--st-red)" }}
                >
                  Detail kegagalan
                </p>
              </div>
              <div className="divide-y px-4 py-2 space-y-1">
                {hasil.errors.map((e, i) => (
                  <p
                    key={i}
                    className="text-xs py-1"
                    style={{ color: "#f87171" }}
                  >
                    {e}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 text-xs py-2.5 rounded-xl transition"
              style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
            >
              Import Lagi
            </button>
            <button
              onClick={() => router.push("/dashboard/pegawai")}
              className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white transition"
              style={{ background: "var(--navy-solid)" }}
            >
              Lihat Data Pegawai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
