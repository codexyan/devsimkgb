"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { infoStatusKgb } from "@/lib/statusKgb";

/* Bentuk tanggapan GET /api/public/cek-kgb. Semua kolom diperlakukan opsional
   karena data berasal dari spreadsheet dan bisa kosong. */
interface KgbTerbaru {
  status?: string | null;
  tmtKgbBaru?: string | null;
  tmtKgbBerikutnya?: string | null;
  flagRapelan?: boolean | string | null;
  nomorSurat?: string | null;
}

interface HasilCek {
  nama?: string | null;
  jabatan?: string | null;
  golonganRuang?: string | null;
  unitKerja?: string | null;
  tmtKgbBerikutnya?: string | null;
  kgbTerbaru?: KgbTerbaru | null;
}

interface Galat {
  judul: string;
  pesan: string;
  saran?: string;
}

const POLA_NIP = /^\d{18}$/;

// Tanggal disimpan sebagai waktu ISO. Tampilkan menurut WITA (zona waktu
// Kalimantan Selatan) agar TMT tanggal 1 tidak bergeser ke bulan sebelumnya.
const ZONA_WAKTU = "Asia/Makassar";

function teks(nilai: unknown): string {
  if (typeof nilai === "number" && Number.isFinite(nilai)) return String(nilai);
  return typeof nilai === "string" && nilai.trim() ? nilai.trim() : "-";
}

function tanggal(nilai: unknown, opsi: Intl.DateTimeFormatOptions): string {
  if (typeof nilai !== "string" || !nilai.trim()) return "-";
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { ...opsi, timeZone: ZONA_WAKTU }).format(d);
}

function benar(nilai: unknown): boolean {
  return nilai === true || (typeof nilai === "string" && nilai.trim().toLowerCase() === "true");
}

function kalimat(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function pesanDariApi(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const pesan = (data as { error: unknown }).error;
    if (typeof pesan === "string" && pesan.trim()) return kalimat(pesan.trim());
  }
  return null;
}

export default function CekStatus() {
  const id = useId();
  const idNip = `${id}-nip`;
  const idPetunjuk = `${id}-petunjuk`;
  const idGalatNip = `${id}-galat-nip`;
  const idJudulHasil = `${id}-judul-hasil`;

  const [nip, setNip] = useState("");
  const [galatNip, setGalatNip] = useState("");
  const [percobaan, setPercobaan] = useState(0);
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<HasilCek | null>(null);
  const [galat, setGalat] = useState<Galat | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const judulRef = useRef<HTMLHeadingElement>(null);
  const nomorRef = useRef(0);
  const pengendaliRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const pengendali = pengendaliRef;
    return () => pengendali.current?.abort();
  }, []);

  useEffect(() => {
    if (hasil) judulRef.current?.focus();
  }, [hasil]);

  async function cari(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (memuat) return;

    const bersih = nip.replace(/\s+/g, "");
    if (bersih !== nip) setNip(bersih);

    if (!POLA_NIP.test(bersih)) {
      setGalatNip("NIP harus 18 angka.");
      setPercobaan((n) => n + 1);
      setHasil(null);
      setGalat(null);
      inputRef.current?.focus();
      return;
    }

    setGalatNip("");
    pengendaliRef.current?.abort();
    const pengendali = new AbortController();
    pengendaliRef.current = pengendali;
    // Hanya tanggapan dari pencarian terakhir yang ditampilkan
    const nomor = ++nomorRef.current;

    setMemuat(true);
    setHasil(null);
    setGalat(null);

    try {
      const res = await fetch(`/api/public/cek-kgb?nip=${encodeURIComponent(bersih)}`, {
        signal: pengendali.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data: unknown = await res.json().catch(() => null);
      if (nomor !== nomorRef.current) return;

      if (res.status === 404) {
        setGalat({
          judul: "Data tidak ditemukan",
          pesan: pesanDariApi(data) ?? "Pegawai tidak ditemukan dalam sistem.",
          saran:
            "Pastikan NIP sudah benar. Bila tetap tidak ditemukan, hubungi pengelola kepegawaian di satker Anda.",
        });
      } else if (!res.ok) {
        setGalat({
          judul: "Pencarian gagal",
          pesan: pesanDariApi(data) ?? "Terjadi kesalahan sistem. Coba lagi.",
        });
      } else if (data && typeof data === "object") {
        setHasil(data as HasilCek);
      } else {
        setGalat({ judul: "Pencarian gagal", pesan: "Tanggapan server tidak dapat dibaca. Coba lagi." });
      }
    } catch {
      if (nomor !== nomorRef.current) return;
      setGalat({ judul: "Pencarian gagal", pesan: "Gagal menghubungi server. Coba lagi." });
    } finally {
      if (nomor === nomorRef.current) setMemuat(false);
    }
  }

  const kgb = hasil?.kgbTerbaru ?? null;
  const status = typeof kgb?.status === "string" ? kgb.status : "";
  const info = infoStatusKgb(status);
  const nomorSk = teks(kgb?.nomorSurat);
  // Tanda rapelan ditetapkan saat Input KGB, jadi hanya berarti untuk KGB yang sudah diinput dan belum
  // dikonfirmasi keuangan. Nilai pada jadwal Belum Diproses tidak diperbarui sehingga tidak dipakai.
  const tampilkanRapel =
    kgb !== null && benar(kgb.flagRapelan) && (status === "sedang_diproses" || status === "menunggu_keuangan");

  return (
    <div>
      <form role="search" aria-label="Cek status KGB berdasarkan NIP" onSubmit={cari} noValidate>
        <div className="pub-field">
          <label htmlFor={idNip} className="pub-label">
            NIP
          </label>
          <p id={idPetunjuk} className="pub-hint">
            18 angka, tanpa spasi
          </p>
          {galatNip && (
            <p key={percobaan} id={idGalatNip} className="pub-field-error" role="alert">
              {galatNip}
            </p>
          )}
          <div className="ck-baris">
            <input
              ref={inputRef}
              id={idNip}
              name="nip"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              spellCheck={false}
              className="pub-input ck-input"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              aria-describedby={galatNip ? `${idGalatNip} ${idPetunjuk}` : idPetunjuk}
              aria-invalid={galatNip ? true : undefined}
            />
            <button type="submit" className="pub-btn ck-tombol" disabled={memuat}>
              {memuat ? "Mencari..." : "Cek status"}
            </button>
          </div>
        </div>
      </form>

      <p className="pub-visually-hidden" role="status">
        {memuat ? "Mencari data KGB..." : ""}
      </p>

      <div className="ck-hasil" aria-busy={memuat}>
        {galat && (
          <div className="pub-note-bad ck-galat" role="alert">
            <p className="pub-note-title">{galat.judul}</p>
            <p>{galat.pesan}</p>
            {galat.saran && <p>{galat.saran}</p>}
          </div>
        )}

        {hasil && (
          <section aria-labelledby={idJudulHasil}>
            <h2 id={idJudulHasil} ref={judulRef} tabIndex={-1} className="pub-h2 ck-judul-hasil">
              Hasil pencarian
            </h2>

            <dl className="pub-dl">
              <div>
                <dt>Nama</dt>
                <dd>{teks(hasil.nama)}</dd>
              </div>
              <div>
                <dt>Jabatan</dt>
                <dd>{teks(hasil.jabatan)}</dd>
              </div>
              <div>
                <dt>Golongan</dt>
                <dd>{teks(hasil.golonganRuang)}</dd>
              </div>
              <div>
                <dt>Unit kerja</dt>
                <dd>{teks(hasil.unitKerja)}</dd>
              </div>
              <div>
                <dt>Status KGB</dt>
                <dd>
                  {kgb ? (
                    <>
                      <span className="ck-lencana">
                        {info.label ? (
                          <span className={`pub-status ${info.kelas}`.trim()}>{info.label}</span>
                        ) : (
                          "-"
                        )}
                        {tampilkanRapel && <span className="pub-status pub-status-rapelan">Berpotensi rapelan</span>}
                      </span>
                      {info.keterangan && <p className="pub-hint ck-keterangan">{info.keterangan}</p>}
                    </>
                  ) : (
                    <>
                      Belum ada data KGB
                      <p className="pub-hint ck-keterangan">
                        Hubungi pengelola kepegawaian di satker Anda untuk memastikan data KGB sudah dicatat.
                      </p>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>Periode KGB</dt>
                <dd>{tanggal(kgb?.tmtKgbBaru, { month: "long", year: "numeric" })}</dd>
              </div>
              <div>
                <dt>TMT KGB berikutnya</dt>
                <dd>{tanggal(hasil.tmtKgbBerikutnya, { day: "numeric", month: "long", year: "numeric" })}</dd>
              </div>
              {nomorSk !== "-" && (
                <div>
                  <dt>Nomor SK</dt>
                  <dd>{nomorSk}</dd>
                </div>
              )}
            </dl>

            {tampilkanRapel && (
              <div className="pub-note-warn ck-catatan">
                <p className="pub-note-title">Diproses setelah batas waktu</p>
                <p>
                  KGB ini diproses setelah batas waktu, tetapi TMT tidak berubah. Jika SK KGB terbit setelah
                  TMT, selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji (rapel): operator gaji satker
                  merekam SK KGB di aplikasi Gaji Web, lalu satker mengajukan SPM-LS kekurangan gaji ke KPPN.
                </p>
              </div>
            )}

            <p className="ck-tautan-status">
              <Link href="/panduan#status">Arti setiap status</Link>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
