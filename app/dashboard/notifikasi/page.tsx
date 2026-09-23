"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTanggalId } from "@/lib/waktu";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { isSuperAdmin, ROLES } from "@/lib/auth";

interface Notifikasi {
  id: string;
  judul: string;
  pesan: string;
  tipe: string;
  dibaca: boolean;
  createdAt: string;
  prioritas: string;
  linkHref: string | null;
  kategori: string | null;
}

interface HasilPeriksa {
  created?: number;
  details?: string[];
  error?: string;
}

/* Server hanya mengirim tipe notifikasi yang boleh dilihat peran pengguna (GET /api/notifikasi),
   jadi daftar saringan disusun dari notifikasi yang benar-benar diterima. */
type KunciKategori = "kgb" | "rapelan" | "sk" | "followup" | "hukdis";

const KATEGORI: { key: KunciKategori; label: string; tipe: readonly string[]; nada: string }[] = [
  { key: "rapelan", label: "KGB terlambat", tipe: ["rapelan"], nada: "merah" },
  { key: "kgb", label: "Jatuh tempo", tipe: ["kgb_jatuh_tempo"], nada: "navy" },
  { key: "sk", label: "SK & keuangan", tipe: ["sk_menunggu_keuangan", "sk_terbit"], nada: "ungu" },
  { key: "followup", label: "Follow up", tipe: ["followup_keuangan"], nada: "kuning" },
  { key: "hukdis", label: "Hukuman disiplin", tipe: ["hukdis_berakhir"], nada: "kuning" },
];

const NADA_TIPE: Record<string, string> = {
  rapelan: "merah",
  kgb_jatuh_tempo: "navy",
  sk_menunggu_keuangan: "ungu",
  sk_terbit: "hijau",
  followup_keuangan: "kuning",
  hukdis_berakhir: "kuning",
};

const LABEL_PRIORITAS: Record<string, string> = {
  critical: "Mendesak",
  warning: "Perhatian",
  info: "Informasi",
  normal: "Biasa",
};

const NADA_PRIORITAS: Record<string, string> = { critical: "merah", warning: "kuning", info: "biru", normal: "navy" };

function IkonTipe({ tipe }: { tipe: string }) {
  const umum = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;
  switch (tipe) {
    case "hukdis_berakhir":
      return <svg {...umum}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case "rapelan":
      return <svg {...umum}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case "followup_keuangan":
      return <svg {...umum}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case "sk_terbit":
      return <svg {...umum}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 11 17 15 12" /></svg>;
    case "sk_menunggu_keuangan":
      return <svg {...umum}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    default:
      return <svg {...umum}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  }
}

function waktuRelatif(dateStr: string): string {
  const d = new Date(dateStr);
  const menit = Math.floor((Date.now() - d.getTime()) / 60000);
  if (menit < 1) return "Baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari === 1) return "Kemarin";
  if (hari < 30) return `${hari} hari lalu`;
  return formatTanggalId(d, { day: "numeric", month: "short", year: "numeric" });
}

/** Kunci hari kalender lokal untuk pengelompokan daftar. */
const kunciHari = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const judulHari = (kunci: string) => {
  const [y, m, d] = kunci.split("-").map(Number);
  const tanggal = new Date(y, m - 1, d);
  const hariIni = new Date();
  const selisih = Math.round((new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate()).getTime() - tanggal.getTime()) / 86_400_000);
  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Kemarin";
  return formatTanggalId(tanggal, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

export default function NotifikasiPage() {
  const router = useRouter();
  const role = useRole();
  const superAdmin = isSuperAdmin(role);
  const lihatSaja = role === ROLES.ADMIN_UPT;
  const bolehPeriksa = !lihatSaja;

  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [memeriksa, setMemeriksa] = useState(false);
  const [saring, setSaring] = useState<"semua" | "belum">("belum");
  const [kategori, setKategori] = useState<KunciKategori | "">("");
  const [cari, setCari] = useState("");
  const [menghapus, setMenghapus] = useState<string | null>(null);
  const [menghapusSemua, setMenghapusSemua] = useState(false);
  const [pesan, setPesan] = useState<{ nada: "hijau" | "kuning" | "merah"; teks: string } | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/notifikasi?limit=200");
      const data = (await res.json()) as unknown;
      setNotifikasi(res.ok && Array.isArray(data) ? (data as Notifikasi[]) : []);
    } catch {
      setNotifikasi([]);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  async function periksaSekarang() {
    setMemeriksa(true);
    setPesan(null);
    try {
      const res = await fetch("/api/notifikasi/periksa", { method: "POST" });
      const hasil = (await res.json().catch(() => ({}))) as HasilPeriksa;
      if (!res.ok) {
        setPesan({ nada: "merah", teks: hasil.error ?? "Pemeriksaan notifikasi gagal." });
        return;
      }
      await muat();
      setPesan(
        (hasil.created ?? 0) > 0
          ? { nada: "hijau", teks: `${hasil.created} notifikasi baru dibuat. ${(hasil.details ?? []).join(" · ")}` }
          : {
              nada: "kuning",
              teks:
                (hasil.details ?? []).length > 0
                  ? (hasil.details ?? []).join(" · ")
                  : "Tidak ada pengingat baru: semua KGB yang masuk masa pengingat sudah diinput dan tidak ada SK yang menunggu.",
            },
      );
    } catch {
      setPesan({ nada: "merah", teks: "Pemeriksaan notifikasi gagal." });
    } finally {
      setMemeriksa(false);
    }
  }

  async function tandaiBaca(id: string) {
    if (lihatSaja) return;
    const res = await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (!res?.ok) return;
    setNotifikasi((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
  }

  async function tandaiSemuaBaca() {
    if (lihatSaja) return;
    const res = await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dibacaSemua: true }),
    }).catch(() => null);
    if (!res?.ok) return;
    setNotifikasi((prev) => prev.map((n) => ({ ...n, dibaca: true })));
  }

  function buka(n: Notifikasi) {
    if (!n.dibaca) void tandaiBaca(n.id);
    if (n.linkHref) router.push(n.linkHref);
  }

  async function hapus(id: string) {
    setMenghapus(id);
    try {
      const res = await fetch(`/api/notifikasi?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) setNotifikasi((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setMenghapus(null);
    }
  }

  async function hapusSemua() {
    if (!confirm("Hapus semua notifikasi? Pengingat untuk KGB atau hukuman disiplin yang masih berlaku akan dibuat kembali pada pemeriksaan berikutnya.")) return;
    setMenghapusSemua(true);
    try {
      const res = await fetch("/api/notifikasi?all=true", { method: "DELETE" });
      if (res.ok) setNotifikasi([]);
    } finally {
      setMenghapusSemua(false);
    }
  }

  const belumDibaca = notifikasi.filter((n) => !n.dibaca);
  const mendesak = belumDibaca.filter((n) => n.prioritas === "critical").length;
  const terbaru = notifikasi[0]?.createdAt;

  const kategoriAda = useMemo(
    () => KATEGORI.map((k) => ({ ...k, jumlah: notifikasi.filter((n) => k.tipe.includes(n.tipe)).length })).filter((k) => k.jumlah > 0),
    [notifikasi],
  );

  const tersaring = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    return notifikasi.filter((n) => {
      if (saring === "belum" && n.dibaca) return false;
      if (kategori && !(KATEGORI.find((k) => k.key === kategori)?.tipe.includes(n.tipe) ?? false)) return false;
      if (kunci && !`${n.judul} ${n.pesan}`.toLowerCase().includes(kunci)) return false;
      return true;
    });
  }, [notifikasi, saring, kategori, cari]);

  const perHari = useMemo(() => {
    const peta = new Map<string, Notifikasi[]>();
    for (const n of tersaring) {
      const k = kunciHari(n.createdAt);
      const isi = peta.get(k);
      if (isi) isi.push(n);
      else peta.set(k, [n]);
    }
    return [...peta.entries()];
  }, [tersaring]);

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Pusat notifikasi</p>
          <h1 className="dsb-halaman-judul">Notifikasi</h1>
          <p className="dsb-sub">
            {memuat
              ? "Memuat…"
              : belumDibaca.length > 0
                ? `${belumDibaca.length} belum dibaca dari ${notifikasi.length} notifikasi.`
                : `${notifikasi.length} notifikasi, semuanya sudah dibaca.`}{" "}
            {lihatSaja
              ? "Akun UPT menerima pengingat KGB dan kabar SK pegawai satkernya sendiri."
              : "Status dibaca berlaku untuk semua pengguna yang menerima notifikasi yang sama."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dsb-ikon-tombol" onClick={() => void muat()} title="Muat ulang" aria-label="Muat ulang notifikasi">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={memuat ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
          {bolehPeriksa && (
            <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => void periksaSekarang()} disabled={memeriksa}>
              {memeriksa ? "Memeriksa…" : "Periksa sekarang"}
            </button>
          )}
          {!lihatSaja && belumDibaca.length > 0 && (
            <button type="button" className="dsb-tombol" onClick={() => void tandaiSemuaBaca()}>
              Tandai semua dibaca
            </button>
          )}
          {superAdmin && notifikasi.length > 0 && (
            <button type="button" className="dsb-tombol" data-nada="merah" onClick={() => void hapusSemua()} disabled={menghapusSemua}>
              {menghapusSemua ? "Menghapus…" : "Hapus semua"}
            </button>
          )}
        </div>
      </header>

      {pesan && (
        <div role={pesan.nada === "merah" ? "alert" : "status"} className="dsb-pesan" data-nada={pesan.nada}>
          <span className="dsb-pesan-ikon" aria-hidden="true">{pesan.nada === "hijau" ? "✓" : "!"}</span>
          <p>{pesan.teks}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setPesan(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Belum dibaca</span>
          <span className="dsb-angka-nilai" style={{ color: belumDibaca.length > 0 ? "var(--dtn)" : undefined }}>
            {memuat ? "–" : belumDibaca.length}
          </span>
          <span className="dsb-angka-meta">{notifikasi.length} notifikasi tersimpan</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Mendesak</span>
          <span className="dsb-angka-nilai" style={{ color: mendesak > 0 ? "var(--st-red)" : undefined }}>{memuat ? "–" : mendesak}</span>
          <span className="dsb-angka-meta">
            {mendesak > 0 && <span className="dsb-titik" data-nada="merah" aria-hidden="true" />}
            {mendesak > 0 ? "Batas input lewat atau jatuh hari ini" : "Tidak ada yang mendesak"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Jenis aktif</span>
          <span className="dsb-angka-nilai">{memuat ? "–" : kategoriAda.length}</span>
          <span className="dsb-angka-meta">{kategoriAda.map((k) => k.label).join(" · ") || "Belum ada notifikasi"}</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Notifikasi terbaru</span>
          <span className="dsb-angka-nilai" style={{ fontSize: "20px" }}>{terbaru ? waktuRelatif(terbaru) : "–"}</span>
          <span className="dsb-angka-meta">Pemeriksaan otomatis: tiap 15 menit dan 08.00 WITA</span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Daftar notifikasi <small>{tersaring.length} tampil</small>
              </h2>
              <div className="dsb-alat">
                <div className="dsb-segmen" role="group" aria-label="Saring status dibaca">
                  <button type="button" aria-pressed={saring === "belum"} onClick={() => setSaring("belum")}>Belum dibaca</button>
                  <button type="button" aria-pressed={saring === "semua"} onClick={() => setSaring("semua")}>Semua</button>
                </div>
                <input
                  type="search"
                  className="dsb-cari"
                  aria-label="Cari notifikasi"
                  placeholder="Cari nama atau isi pesan…"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
            </div>

            {memuat ? (
              <p className="dsb-kosong">Memuat notifikasi…</p>
            ) : perHari.length === 0 ? (
              <p className="dsb-kosong">
                {notifikasi.length === 0
                  ? "Belum ada notifikasi. Pengingat dibuat otomatis menjelang batas input KGB, saat SK menunggu konfirmasi keuangan, dan saat masa hukuman disiplin berakhir."
                  : "Tidak ada notifikasi yang cocok dengan saringan ini."}
              </p>
            ) : (
              <div className="dsb-gulir dsb-notif">
                {perHari.map(([hari, daftar]) => (
                  <section key={hari}>
                    <h3 className="dsb-log-hari">
                      <span>{judulHari(hari)}</span>
                      <span>{daftar.length} notifikasi</span>
                    </h3>
                    <ul>
                      {daftar.map((n) => {
                        const nada = NADA_TIPE[n.tipe] ?? "navy";
                        const bisaDibuka = !!n.linkHref;
                        return (
                          <li key={n.id} className="dsb-notif-baris" data-belum={n.dibaca ? undefined : ""}>
                            <span className="dsb-notif-ikon" data-nada={nada} aria-hidden="true"><IkonTipe tipe={n.tipe} /></span>
                            <div className="min-w-0">
                              <p className="dsb-notif-judul">
                                {n.judul}
                                {!n.dibaca && <span className="dsb-titik" data-nada={nada} aria-label="Belum dibaca" />}
                              </p>
                              <p className="dsb-notif-pesan">{n.pesan}</p>
                              <p className="dsb-kecil">
                                {waktuRelatif(n.createdAt)} · {formatTanggalId(new Date(n.createdAt), { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="dsb-notif-aksi">
                              <span className="dsb-tag" data-garis="" data-nada={NADA_PRIORITAS[n.prioritas] ?? "navy"}>
                                {LABEL_PRIORITAS[n.prioritas] ?? n.prioritas}
                              </span>
                              {bisaDibuka && (
                                <button type="button" className="dsb-tombol-kecil" onClick={() => buka(n)}>
                                  Buka
                                </button>
                              )}
                              {!n.dibaca && !lihatSaja && (
                                <button type="button" className="dsb-tombol-kecil" onClick={() => void tandaiBaca(n.id)}>
                                  Tandai dibaca
                                </button>
                              )}
                              {superAdmin && (
                                <button
                                  type="button"
                                  className="dsb-ikon-tombol"
                                  data-nada="merah"
                                  title="Hapus notifikasi"
                                  aria-label={`Hapus notifikasi: ${n.judul}`}
                                  disabled={menghapus === n.id}
                                  onClick={() => void hapus(n.id)}
                                >
                                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="dsb-samping" data-urutan="tetap">
            <section className="dsb-panel dsb-susut">
              <div className="dsb-panel-kepala">
                <h2 className="dsb-panel-judul">Jenis notifikasi</h2>
              </div>
              <div className="dsb-gulir">
                <ul className="dsb-daftar-ringkas">
                  <li>
                    <button type="button" className="dsb-pilih-baris" aria-pressed={kategori === ""} onClick={() => setKategori("")}>
                      <span>Semua jenis</span>
                      <strong>{notifikasi.length}</strong>
                    </button>
                  </li>
                  {kategoriAda.map((k) => (
                    <li key={k.key}>
                      <button
                        type="button"
                        className="dsb-pilih-baris"
                        aria-pressed={kategori === k.key}
                        onClick={() => setKategori(kategori === k.key ? "" : k.key)}
                      >
                        <span>
                          <span className="dsb-titik" data-nada={k.nada} aria-hidden="true" /> {k.label}
                        </span>
                        <strong>{k.jumlah}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="dsb-panel dsb-penuh">
              <div className="dsb-panel-kepala">
                <h2 className="dsb-panel-judul">Cara notifikasi dibuat</h2>
              </div>
              <div className="dsb-gulir dsb-panel-isi">
                <ul className="dsb-jadwal">
                  <li>
                    <strong>Pengingat batas input KGB</strong>
                    <p className="dsb-kecil">H-14 (informasi), H-7 (perhatian), dan hari-H (mendesak) sebelum batas input Tim SDM. Pegawai yang KGB-nya sudah diinput tidak diingatkan lagi.</p>
                  </li>
                  <li>
                    <strong>KGB terlambat</strong>
                    <p className="dsb-kecil">Dibuat saat batas input lewat dan diulang tiap 30 hari sampai KGB diinput. TMT tetap berlaku mundur, selisihnya dibayar sebagai rapelan.</p>
                  </li>
                  <li>
                    <strong>SK menunggu konfirmasi</strong>
                    <p className="dsb-kecil">Dibuat saat SK bertanda tangan diunggah, dan otomatis ditutup begitu keuangan mengonfirmasi.</p>
                  </li>
                  <li>
                    <strong>SK terbit</strong>
                    <p className="dsb-kecil">Kabar untuk admin UPT bahwa SK pegawai satkernya sudah dikonfirmasi keuangan dan berkasnya dapat diunduh.</p>
                  </li>
                  <li>
                    <strong>Hukuman disiplin berakhir</strong>
                    <p className="dsb-kecil">Dibuat paling lambat 30 hari sebelum masa hukuman berakhir, agar KGB yang tertunda dapat segera dijadwalkan.</p>
                  </li>
                </ul>
                <p className="dsb-catatan">
                  Pemeriksaan berjalan otomatis paling sering tiap 15 menit saat aplikasi dibuka, ditambah sekali sehari pukul 08.00 WITA.
                  {bolehPeriksa && " Tombol Periksa sekarang menjalankannya tanpa menunggu."}
                </p>
              </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
