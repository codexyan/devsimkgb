"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KerangkaModal } from "@/app/dashboard/components/kgb";
import { formatTanggalId } from "@/lib/waktu";

/* ─── Bentuk data ──────────────────────────────────────────────────────── */
interface LogItem {
  id: string;
  waktu: string;
  user: string;
  aksi: string;
  detail: string;
  targetNama: string | null;
  ipAddress: string | null;
}
interface LogResponse {
  data: LogItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Jumlah per jenis aksi untuk seluruh hasil saringan, bukan hanya halaman ini. */
  ringkasan: { aksi: string; jumlah: number }[];
  hariIni: number;
  jumlahPelaku: number;
}

/* ─── Jenis aktivitas ──────────────────────────────────────────────────── */
/* Dipetakan dari nilai `aksi` yang dipakai logAudit di codebase, ditambah serah_terima dan
   rekon_keuangan yang fiturnya sudah dihapus tetapi entrinya masih ada di log lama. */
type NadaAksi = "navy" | "hijau" | "kuning" | "merah" | "ungu" | "abu";

const AKSI_CONFIG: Record<string, { label: string; nada: NadaAksi; kelompok: string }> = {
  input_kgb:                { label: "Input KGB",              nada: "navy",   kelompok: "KGB" },
  input_kgb_arsip:          { label: "Arsip KGB",              nada: "kuning", kelompok: "KGB" },
  generate_surat:           { label: "Buat SK",                nada: "hijau",  kelompok: "KGB" },
  upload_sk:                { label: "Unggah SK TTE",          nada: "hijau",  kelompok: "KGB" },
  ubah_penetap_sk:          { label: "Ubah penetap SK",        nada: "abu",    kelompok: "KGB" },
  reject_kgb:               { label: "Batalkan KGB",           nada: "merah",  kelompok: "KGB" },
  fix_arsip:                { label: "Koreksi arsip historis", nada: "kuning", kelompok: "KGB" },
  serah_terima:             { label: "Serah terima",           nada: "hijau",  kelompok: "KGB" },
  konfirmasi_keuangan:      { label: "Konfirmasi keuangan",    nada: "ungu",   kelompok: "Keuangan" },
  rekon_keuangan:           { label: "Rekon keuangan",         nada: "ungu",   kelompok: "Keuangan" },
  tambah_pegawai:           { label: "Tambah pegawai",         nada: "navy",   kelompok: "Pegawai" },
  edit_pegawai:             { label: "Ubah pegawai",           nada: "abu",    kelompok: "Pegawai" },
  hapus_pegawai:            { label: "Hapus pegawai",          nada: "merah",  kelompok: "Pegawai" },
  import_pegawai:           { label: "Impor pegawai",          nada: "navy",   kelompok: "Pegawai" },
  kenaikan_pangkat:         { label: "Kenaikan pangkat",       nada: "hijau",  kelompok: "Pegawai" },
  input_hukdis:             { label: "Input hukuman disiplin", nada: "kuning", kelompok: "Hukuman disiplin" },
  hapus_hukdis:             { label: "Hapus hukuman disiplin", nada: "merah",  kelompok: "Hukuman disiplin" },
  tambah_jenis_hukdis:      { label: "Tambah jenis hukdis",    nada: "kuning", kelompok: "Hukuman disiplin" },
  ubah_jenis_hukdis:        { label: "Ubah jenis hukdis",      nada: "kuning", kelompok: "Hukuman disiplin" },
  hapus_jenis_hukdis:       { label: "Hapus jenis hukdis",     nada: "merah",  kelompok: "Hukuman disiplin" },
  tambah_penandatangan:     { label: "Tambah penandatangan",   nada: "kuning", kelompok: "Pengaturan" },
  ubah_penandatangan:       { label: "Ubah penandatangan",     nada: "kuning", kelompok: "Pengaturan" },
  hapus_penandatangan:      { label: "Hapus penandatangan",    nada: "merah",  kelompok: "Pengaturan" },
  edit_konfigurasi:         { label: "Ubah pengaturan",        nada: "kuning", kelompok: "Pengaturan" },
  edit_profil:              { label: "Ubah profil",            nada: "abu",    kelompok: "Akun" },
  ajukan_perubahan_profil:  { label: "Ajuan profil",           nada: "abu",    kelompok: "Akun" },
  approve_perubahan_profil: { label: "Setujui profil",         nada: "hijau",  kelompok: "Akun" },
  reject_perubahan_profil:  { label: "Tolak profil",           nada: "merah",  kelompok: "Akun" },
  tambah_pengguna:          { label: "Tambah pengguna",        nada: "navy",   kelompok: "Akun" },
  ubah_pengguna:            { label: "Ubah pengguna",          nada: "abu",    kelompok: "Akun" },
  reset_password:           { label: "Atur ulang password",    nada: "kuning", kelompok: "Akun" },
  hapus_pengguna:           { label: "Hapus pengguna",         nada: "merah",  kelompok: "Akun" },
  hapus_riwayat:            { label: "Hapus log",              nada: "merah",  kelompok: "Administrasi" },
};

const cfgAksi = (aksi: string) => AKSI_CONFIG[aksi] ?? { label: aksi, nada: "abu" as NadaAksi, kelompok: "Lainnya" };

/* Pilihan jenis aktivitas dikelompokkan agar daftarnya mudah ditelusuri. */
const KELOMPOK_AKSI = [...new Set(Object.values(AKSI_CONFIG).map((v) => v.kelompok))].map((kelompok) => ({
  kelompok,
  pilihan: Object.entries(AKSI_CONFIG)
    .filter(([, v]) => v.kelompok === kelompok)
    .map(([value, v]) => ({ value, label: v.label })),
}));

function waktuRelatif(iso: string) {
  const menit = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (menit < 1) return "Baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari === 1) return "Kemarin";
  if (hari < 30) return `${hari} hari lalu`;
  return formatTanggalId(new Date(iso), { day: "numeric", month: "short", year: "numeric" });
}

/* Tanggal LOKAL (bukan UTC) — toISOString bisa mundur sehari di zona WIB/WITA. */
const isoLokal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hariLalu = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoLokal(d);
};

const judulHari = (kunci: string) => {
  const [y, m, d] = kunci.split("-").map(Number);
  const tanggal = new Date(y, m - 1, d);
  const kini = new Date();
  const selisih = Math.round((new Date(kini.getFullYear(), kini.getMonth(), kini.getDate()).getTime() - tanggal.getTime()) / 86_400_000);
  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Kemarin";
  return formatTanggalId(tanggal, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const inisial = (nama: string) => (nama === "Sistem" ? "SYS" : nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase());

/* ─── Halaman ──────────────────────────────────────────────────────────── */
type Rentang = "all" | "today" | "7d" | "30d";

export default function LogAktivitasPage() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [halaman, setHalaman] = useState(1);
  const perPage = 25;
  const [filterAksi, setFilterAksi] = useState("");
  const [filterUser, setFilterUser] = useState("");
  /* Saringan awal 30 hari terakhir; log lama tetap dapat dibuka lewat pilihan "Semua". */
  const [filterDari, setFilterDari] = useState(() => hariLalu(30));
  const [filterSampai, setFilterSampai] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [rentang, setRentang] = useState<Rentang>("30d");
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [menghapus, setMenghapus] = useState(false);
  const [dialogHapus, setDialogHapus] = useState(false);

  /* Input teks ditunda agar tidak memuat ulang di setiap ketikan. */
  const [debUser, setDebUser] = useState("");
  const [debQ, setDebQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebUser(filterUser), 400); return () => clearTimeout(t); }, [filterUser]);
  useEffect(() => { const t = setTimeout(() => setDebQ(filterQ), 400); return () => clearTimeout(t); }, [filterQ]);

  const muat = useCallback(async () => {
    setMemuat(true);
    const params = new URLSearchParams({ page: String(halaman), perPage: String(perPage) });
    if (filterAksi) params.set("aksi", filterAksi);
    if (debUser) params.set("user", debUser);
    if (filterDari) params.set("dari", filterDari);
    if (filterSampai) params.set("sampai", filterSampai);
    if (debQ) params.set("q", debQ);
    const res = await fetch(`/api/audit-log?${params}`);
    if (res.ok) setData((await res.json()) as LogResponse);
    setMemuat(false);
  }, [halaman, filterAksi, debUser, filterDari, filterSampai, debQ]);

  useEffect(() => { const t = setTimeout(() => void muat(), 0); return () => clearTimeout(t); }, [muat]);

  function pakaiRentang(r: Rentang) {
    setRentang(r);
    setHalaman(1);
    setFilterSampai("");
    setFilterDari(r === "all" ? "" : r === "today" ? hariLalu(0) : r === "7d" ? hariLalu(7) : hariLalu(30));
  }

  function pilih(id: string) {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function pilihSemua() {
    if (!data) return;
    setTerpilih((prev) => (prev.size === data.data.length ? new Set() : new Set(data.data.map((d) => d.id))));
  }
  async function hapusTerpilih() {
    if (terpilih.size === 0) return;
    setMenghapus(true);
    const res = await fetch("/api/audit-log", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...terpilih] }),
    });
    setMenghapus(false);
    setDialogHapus(false);
    if (res.ok) { setTerpilih(new Set()); void muat(); }
  }
  function aturUlang() {
    setFilterAksi(""); setFilterUser(""); setFilterSampai(""); setFilterQ("");
    setHalaman(1); pakaiRentang("30d");
  }

  const perHari = useMemo(() => {
    const peta = new Map<string, LogItem[]>();
    for (const item of data?.data ?? []) {
      const d = new Date(item.waktu);
      const kunci = isoLokal(d);
      const isi = peta.get(kunci);
      if (isi) isi.push(item);
      else peta.set(kunci, [item]);
    }
    return [...peta.entries()];
  }, [data]);

  const adaSaringan = !!(filterAksi || filterUser || filterQ || filterSampai || rentang !== "30d");
  const rentangChip: { key: Rentang; label: string }[] = [
    { key: "today", label: "Hari ini" },
    { key: "7d", label: "7 hari" },
    { key: "30d", label: "30 hari" },
    { key: "all", label: "Semua" },
  ];

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Administrasi</p>
          <h1 className="dsb-halaman-judul">Log aktivitas</h1>
          <p className="dsb-sub">
            Jejak audit setiap aksi pengguna: input KGB, pembuatan SK, konfirmasi keuangan, perubahan data pegawai,
            dan perubahan pengaturan. Hanya Super Admin yang dapat membukanya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dsb-ikon-tombol" onClick={() => void muat()} title="Muat ulang" aria-label="Muat ulang log">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={memuat ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
          {terpilih.size > 0 && (
            <button type="button" className="dsb-tombol" data-nada="merah" onClick={() => setDialogHapus(true)} disabled={menghapus}>
              Hapus {terpilih.size} entri
            </button>
          )}
        </div>
      </header>

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Entri pada saringan</span>
          <span className="dsb-angka-nilai">{memuat && !data ? "–" : data?.total ?? 0}</span>
          <span className="dsb-angka-meta">
            {data && data.totalPages > 1 ? `Halaman ${data.page} dari ${data.totalPages}` : "Tampil seluruhnya"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Aktivitas hari ini</span>
          <span className="dsb-angka-nilai">{memuat && !data ? "–" : data?.hariIni ?? 0}</span>
          <span className="dsb-angka-meta">Dihitung menurut tanggal WITA</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Pelaku berbeda</span>
          <span className="dsb-angka-nilai">{memuat && !data ? "–" : data?.jumlahPelaku ?? 0}</span>
          <span className="dsb-angka-meta">Termasuk entri otomatis oleh Sistem</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Jenis terbanyak</span>
          <span className="dsb-angka-nilai" style={{ fontSize: "20px" }}>
            {data?.ringkasan?.[0] ? cfgAksi(data.ringkasan[0].aksi).label : "–"}
          </span>
          <span className="dsb-angka-meta">{data?.ringkasan?.[0] ? `${data.ringkasan[0].jumlah} entri` : "Belum ada aktivitas"}</span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Jejak aktivitas <small>{data?.data.length ?? 0} entri di halaman ini</small>
              </h2>
              <div className="dsb-alat">
                <div className="dsb-segmen" role="group" aria-label="Rentang waktu">
                  {rentangChip.map((c) => (
                    <button key={c.key} type="button" aria-pressed={rentang === c.key} onClick={() => pakaiRentang(c.key)}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  className="dsb-cari"
                  aria-label="Cari di log aktivitas"
                  placeholder="Cari nama, sasaran, atau detail…"
                  value={filterQ}
                  onChange={(e) => { setFilterQ(e.target.value); setHalaman(1); }}
                />
              </div>
            </div>

            {memuat && !data ? (
              <p className="dsb-kosong">Memuat log aktivitas…</p>
            ) : perHari.length === 0 ? (
              <p className="dsb-kosong">
                Tidak ada aktivitas pada saringan ini.
                {adaSaringan && " Coba perluas rentang waktu atau atur ulang saringan."}
              </p>
            ) : (
              <div className="dsb-gulir dsb-log" data-pilihan="">
                {perHari.map(([kunci, daftar]) => (
                  <section key={kunci}>
                    <h3 className="dsb-log-hari">
                      <span>{judulHari(kunci)}</span>
                      <span>{daftar.length} aktivitas</span>
                    </h3>
                    <ol>
                      {daftar.map((item) => {
                        const cfg = cfgAksi(item.aksi);
                        const dipilih = terpilih.has(item.id);
                        return (
                          <li key={item.id} className="dsb-log-baris" style={dipilih ? { background: "var(--tint-navy)" } : undefined}>
                            <span className="dsb-log-jam">
                              {new Date(item.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <input
                              type="checkbox"
                              className="dsb-cek"
                              checked={dipilih}
                              onChange={() => pilih(item.id)}
                              aria-label={`Pilih entri ${cfg.label} oleh ${item.user}`}
                            />
                            <div className="min-w-0">
                              <p className="dsb-nama" style={{ margin: 0 }}>{item.detail}</p>
                              <p className="dsb-kecil" style={{ margin: 0 }}>
                                {item.targetNama ? `Sasaran: ${item.targetNama} · ` : ""}
                                {waktuRelatif(item.waktu)}
                                {item.ipAddress ? ` · IP ${item.ipAddress}` : ""}
                              </p>
                            </div>
                            <span className="dsb-log-tanda">
                              <span className="dsb-tag" data-garis="" data-nada={cfg.nada === "abu" ? undefined : cfg.nada}>
                                <span className="dsb-titik" data-nada={cfg.nada === "abu" ? "navy" : cfg.nada} aria-hidden="true" />
                                {cfg.label}
                              </span>
                            </span>
                            <span className="dsb-log-oleh" title={item.user}>
                              <span className="dsb-avatar" aria-hidden="true">{inisial(item.user)}</span> {item.user}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            )}

            {data && (
              <div className="dsb-kaki">
                <label className="dsb-kecil" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" className="dsb-cek" checked={terpilih.size === data.data.length && data.data.length > 0} onChange={pilihSemua} />
                  Pilih semua di halaman ini
                </label>
                <span className="flex items-center gap-2">
                  <button type="button" className="dsb-tombol-kecil dsb-tombol" data-jenis="garis" disabled={halaman === 1} onClick={() => setHalaman((h) => Math.max(1, h - 1))}>
                    Sebelumnya
                  </button>
                  <span className="dsb-kecil">{data.page} / {Math.max(1, data.totalPages)}</span>
                  <button type="button" className="dsb-tombol-kecil dsb-tombol" data-jenis="garis" disabled={halaman >= data.totalPages} onClick={() => setHalaman((h) => Math.min(data.totalPages, h + 1))}>
                    Selanjutnya
                  </button>
                </span>
              </div>
            )}
          </section>
        </div>

        <aside className="dsb-samping" data-urutan="tetap">
          <section className="dsb-panel dsb-susut">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">Saringan</h2>
              {adaSaringan && (
                <button type="button" className="dsb-tautan" onClick={aturUlang}>Atur ulang</button>
              )}
            </div>
            <div className="dsb-gulir dsb-panel-isi" style={{ display: "grid", gap: 10 }}>
              <label className="dsb-kecil" style={{ display: "grid", gap: 4 }}>
                Jenis aktivitas
                <select className="dsb-pilih" style={{ maxWidth: "100%" }} value={filterAksi} onChange={(e) => { setFilterAksi(e.target.value); setHalaman(1); }}>
                  <option value="">Semua jenis</option>
                  {KELOMPOK_AKSI.map((g) => (
                    <optgroup key={g.kelompok} label={g.kelompok}>
                      {g.pilihan.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="dsb-kecil" style={{ display: "grid", gap: 4 }}>
                Pengguna
                <input className="dsb-cari" style={{ width: "100%" }} value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setHalaman(1); }} placeholder="Nama pengguna" />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label className="dsb-kecil" style={{ display: "grid", gap: 4 }}>
                  Dari
                  <input type="date" className="dsb-cari" style={{ width: "100%" }} value={filterDari} onChange={(e) => { setFilterDari(e.target.value); setRentang("all"); setHalaman(1); }} />
                </label>
                <label className="dsb-kecil" style={{ display: "grid", gap: 4 }}>
                  Sampai
                  <input type="date" className="dsb-cari" style={{ width: "100%" }} value={filterSampai} onChange={(e) => { setFilterSampai(e.target.value); setRentang("all"); setHalaman(1); }} />
                </label>
              </div>
            </div>
          </section>

          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Jenis pada rentang ini <small>{data?.ringkasan?.length ?? 0} jenis</small>
              </h2>
            </div>
            <div className="dsb-gulir">
              {(data?.ringkasan ?? []).length === 0 ? (
                <p className="dsb-kosong">Belum ada aktivitas.</p>
              ) : (
                <ul className="dsb-daftar-ringkas" style={{ maxHeight: "none", border: 0, borderRadius: 0 }}>
                  {(data?.ringkasan ?? []).map((r) => {
                    const cfg = cfgAksi(r.aksi);
                    return (
                      <li key={r.aksi}>
                        <button
                          type="button"
                          className="dsb-pilih-baris"
                          aria-pressed={filterAksi === r.aksi}
                          onClick={() => { setFilterAksi(filterAksi === r.aksi ? "" : r.aksi); setHalaman(1); }}
                        >
                          <span>
                            <span className="dsb-titik" data-nada={cfg.nada === "abu" ? "navy" : cfg.nada} aria-hidden="true" /> {cfg.label}
                          </span>
                          <strong>{r.jumlah}</strong>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </aside>
      </div>

      {dialogHapus && (
        <KerangkaModal
          judul={`Hapus ${terpilih.size} entri log?`}
          subjudul="Jejak audit tidak dapat dikembalikan setelah dihapus"
          nada="merah"
          ukuran="sm"
          sibuk={menghapus}
          onTutup={() => setDialogHapus(false)}
          onKirim={() => void hapusTerpilih()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogHapus(false)} disabled={menghapus}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={menghapus}>
                {menghapus ? "Menghapus…" : "Ya, hapus"}
              </button>
            </>
          }
        >
          <p className="dsb-sub" style={{ margin: 0 }}>
            Entri yang dihapus tidak dapat dikembalikan. Penghapusan ini sendiri tercatat sebagai aktivitas baru
            beserta jumlah entri yang dihapus.
          </p>
        </KerangkaModal>
      )}

    </div>
  );
}
