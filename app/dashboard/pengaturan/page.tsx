"use client";

import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { ROLES } from "@/lib/auth";
import PenandatanganManager from "./PenandatanganManager";
import PemeriksaanData from "./PemeriksaanData";
import { aturBatasInputSdm, BATAS_INPUT_SDM_BAWAAN, normalisasiBatasInputSdm } from "@/lib/batasInputSdm";
import { hitungDeadlineSDM, hitungRekonGaji, hitungUnlockDate } from "@/lib/tabelGaji";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";

/* ─────────────────────────────────────────────────────────────────────────
   Pengaturan (Super Admin). Satu bagian tampil sekaligus supaya halaman pas satu layar:
   daftar bagian di kolom kanan, isinya di panel kiri yang bergulir sendiri.
     1. Penandatangan surat KGB: definitif, Plh, Plt, Dirjen, dengan masa berlaku
     2. Dasar hukum KGB
     3. Jadwal proses KGB:       tanggal batas input Tim SDM
     4. Notifikasi KGB:          ambang H-… peringatan
     5. Keamanan sesi:           durasi keluar otomatis
     6. Kontak WhatsApp:         dipakai tombol lupa password
     7. Pemeriksaan data:        temuan data pegawai tidak konsisten (hanya membaca)
   ───────────────────────────────────────────────────────────────────────── */

interface Konfigurasi {
  nomorPP: string; tahunPP: string;
  waAdmin: string; notifKgbH1: number; notifKgbH2: number; sesiTimeoutMenit: number;
  batasInputSdm: number;
  updatedAt?: string; updatedBy?: string | null;
}

const KOSONG: Konfigurasi = {
  nomorPP: "Nomor 5 Tahun 2024", tahunPP: "2024",
  waAdmin: "", notifKgbH1: 14, notifKgbH2: 7, sesiTimeoutMenit: 60,
  batasInputSdm: BATAS_INPUT_SDM_BAWAAN,
};

type IdBagian = "pejabat" | "dokumen" | "jadwal" | "kppn" | "notifikasi" | "keamanan" | "kontak" | "pemeriksaan";

/** Satu satker beserta KPPN mitra yang berlaku dan bawaannya, dikirim rute Pengaturan. */
interface SatkerKppn {
  kode: string;
  nama: string;
  kppn: string;
  bawaan: string;
}

function Bidang({ label, petunjuk, nilai, onUbah, contoh, jenis = "text", satuan }: {
  label: string; petunjuk?: string; nilai: string; onUbah: (v: string) => void;
  contoh?: string; jenis?: string; satuan?: string;
}) {
  return (
    <label className="atr-bidang">
      <span className="atr-label">{label}</span>
      <span className="atr-isian">
        <input
          type={jenis}
          inputMode={jenis === "number" ? "numeric" : undefined}
          value={nilai}
          onChange={(e) => onUbah(e.target.value)}
          placeholder={contoh}
          className="dsb-cari"
          style={{ width: "100%", paddingRight: satuan ? 62 : undefined }}
        />
        {satuan && <span className="atr-satuan">{satuan}</span>}
      </span>
      {petunjuk && <span className="dsb-kecil">{petunjuk}</span>}
    </label>
  );
}

/* Contoh jadwal untuk TMT dua bulan ke depan dengan batas yang sedang diisi: jendela input Tim SDM, lalu
   rekon gaji keuangan di Gaji Web. SK harus sudah dikonfirmasi keuangan sebelum rekon itu dikirim. */
function ContohJadwal({ batas }: { batas: number }) {
  const hariIni = hariIniWita();
  const tmt = new Date(hariIni.getFullYear(), hariIni.getMonth() + 2, 1);
  const rekon = hitungRekonGaji(tmt);
  const baris: [string, string][] = [
    ["Input Tim SDM", `${formatTanggalId(hitungUnlockDate(tmt), { day: "numeric", month: "short" })} – ${formatTanggalId(hitungDeadlineSDM(tmt, batas))}`],
    ["SK TTE, unggah, konfirmasi keuangan", "sebelum rekon dikirim"],
    ["Rekon gaji Gaji Web (keuangan)", `${formatTanggalId(rekon.mulai, { day: "numeric", month: "short" })} – ${formatTanggalId(rekon.batas)}`],
  ];
  return (
    <div className="dsb-panel" style={{ boxShadow: "none" }}>
      <div className="dsb-panel-kepala">
        <h3 className="dsb-panel-judul">Contoh untuk TMT {formatTanggalId(tmt)}</h3>
      </div>
      <div className="dsb-panel-isi">
        <ul className="dsb-jadwal">
          {baris.map(([k, v]) => (
            <li key={k}>
              <strong>{k}</strong>
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <p className="dsb-kecil" style={{ marginTop: 8 }}>
          Keuangan dapat mengirim rekon lebih awal dari tanggal {rekon.batas.getDate()}. SK yang masuk setelah rekon
          dikirim dibayar sebagai kekurangan gaji (rapel).
        </p>
      </div>
    </div>
  );
}

export default function PengaturanPage() {
  const role = useRole();
  const [form, setForm] = useState<Konfigurasi>(KOSONG);
  const [awal, setAwal] = useState<Konfigurasi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const [tersimpan, setTersimpan] = useState(false);
  const [adaPenandatangan, setAdaPenandatangan] = useState(false);
  const [bagian, setBagian] = useState<IdBagian>("pejabat");
  // KPPN mitra disimpan terpisah dari isian lain karena bentuknya peta kode satker ke nama KPPN.
  const [satkerKppn, setSatkerKppn] = useState<SatkerKppn[]>([]);
  const [opsiKppn, setOpsiKppn] = useState<string[]>([]);
  const [kppn, setKppn] = useState<Record<string, string>>({});
  const [kppnAwal, setKppnAwal] = useState<Record<string, string>>({});

  useEffect(() => {
    let batal = false;
    fetch("/api/konfigurasi")
      .then((r) => r.json() as Promise<Record<string, unknown> | null>)
      .catch(() => null)
      .then((cfg) => {
        if (batal) return;
        if (cfg && cfg.id) {
          const ambilTeks = (k: string, bawaan: string) => (typeof cfg[k] === "string" ? (cfg[k] as string) : bawaan);
          const ambilAngka = (k: string, bawaan: number) => (typeof cfg[k] === "number" ? (cfg[k] as number) : bawaan);
          const c: Konfigurasi = {
            nomorPP: ambilTeks("nomorPP", KOSONG.nomorPP),
            tahunPP: ambilTeks("tahunPP", KOSONG.tahunPP),
            waAdmin: ambilTeks("waAdmin", ""),
            notifKgbH1: ambilAngka("notifKgbH1", 14),
            notifKgbH2: ambilAngka("notifKgbH2", 7),
            sesiTimeoutMenit: ambilAngka("sesiTimeoutMenit", 60),
            batasInputSdm: normalisasiBatasInputSdm(cfg.batasInputSdm),
            updatedAt: typeof cfg.updatedAt === "string" ? cfg.updatedAt : undefined,
            updatedBy: typeof cfg.updatedBy === "string" ? cfg.updatedBy : null,
          };
          setForm(c);
          setAwal(c);
        } else setAwal(null);
        if (cfg) {
          const daftar = Array.isArray(cfg.satkerKppn) ? (cfg.satkerKppn as SatkerKppn[]) : [];
          const peta = Object.fromEntries(daftar.map((s) => [s.kode, s.kppn]));
          setSatkerKppn(daftar);
          setOpsiKppn(Array.isArray(cfg.pilihanKppn) ? (cfg.pilihanKppn as string[]) : []);
          setKppn(peta);
          setKppnAwal(peta);
        }
      })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, []);

  const kppnBerubah = satkerKppn.some((s) => (kppn[s.kode] ?? s.bawaan) !== (kppnAwal[s.kode] ?? s.bawaan));
  const berubah = !awal || kppnBerubah || (Object.keys(KOSONG) as (keyof Konfigurasi)[]).some((k) => form[k] !== awal[k]);
  const angka = (v: string, bawaan: number) => {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : bawaan;
  };

  async function simpan() {
    setGalat(""); setTersimpan(false); setMenyimpan(true);
    try {
      const res = await fetch("/api/konfigurasi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomorPP: form.nomorPP.trim(), tahunPP: form.tahunPP.trim(),
          waAdmin: form.waAdmin.trim(), notifKgbH1: form.notifKgbH1,
          notifKgbH2: form.notifKgbH2, sesiTimeoutMenit: form.sesiTimeoutMenit,
          batasInputSdm: form.batasInputSdm,
          kppnSatker: kppn,
        }),
      });
      const d = (await res.json()) as Record<string, unknown> & { error?: string };
      if (!res.ok) { setGalat(d.error || "Gagal menyimpan pengaturan"); return; }
      const c: Konfigurasi = {
        nomorPP: String(d.nomorPP ?? ""), tahunPP: String(d.tahunPP ?? ""),
        waAdmin: typeof d.waAdmin === "string" ? d.waAdmin : "",
        notifKgbH1: Number(d.notifKgbH1 ?? 14), notifKgbH2: Number(d.notifKgbH2 ?? 7),
        sesiTimeoutMenit: Number(d.sesiTimeoutMenit ?? 60),
        batasInputSdm: normalisasiBatasInputSdm(d.batasInputSdm),
        updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : undefined,
        updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : null,
      };
      // Halaman dashboard lain di tab ini langsung memakai batas yang baru disimpan.
      aturBatasInputSdm(c.batasInputSdm);
      if (Array.isArray(d.satkerKppn)) {
        const daftar = d.satkerKppn as SatkerKppn[];
        const peta = Object.fromEntries(daftar.map((s) => [s.kode, s.kppn]));
        setSatkerKppn(daftar);
        setKppn(peta);
        setKppnAwal(peta);
        if (Array.isArray(d.pilihanKppn)) setOpsiKppn(d.pilihanKppn as string[]);
      }
      setForm(c); setAwal(c); setTersimpan(true);
      setTimeout(() => setTersimpan(false), 4000);
    } catch {
      setGalat("Gagal menghubungi server");
    } finally {
      setMenyimpan(false);
    }
  }

  const daftarBagian = useMemo(
    () => [
      { id: "pejabat" as const, label: "Penandatangan surat", ket: "Dipilih otomatis menurut tanggal surat", lengkap: adaPenandatangan },
      { id: "dokumen" as const, label: "Dasar hukum KGB", ket: "Peraturan Pemerintah yang dirujuk SK", lengkap: !!form.nomorPP.trim() },
      { id: "jadwal" as const, label: "Jadwal proses KGB", ket: "Batas input Tim SDM sebelum rekon gaji", lengkap: true },
      { id: "kppn" as const, label: "KPPN mitra satker", ket: "Kantor bayar tujuan SK tiap satker", lengkap: true },
      { id: "notifikasi" as const, label: "Notifikasi KGB", ket: "Kapan pengingat mulai dikirim", lengkap: true },
      { id: "keamanan" as const, label: "Keamanan sesi", ket: "Keluar otomatis saat perangkat menganggur", lengkap: true },
      { id: "kontak" as const, label: "Kontak WhatsApp", ket: "Tombol lupa password di halaman masuk", lengkap: !!form.waAdmin.trim() },
      { id: "pemeriksaan" as const, label: "Pemeriksaan data", ket: "Temuan data pegawai yang tidak konsisten", lengkap: true, luar: true },
    ],
    [adaPenandatangan, form.nomorPP, form.waAdmin],
  );

  const bagianAktif = daftarBagian.find((b) => b.id === bagian) ?? daftarBagian[0];
  const dihitung = daftarBagian.filter((b) => !b.luar);
  const lengkap = dihitung.filter((b) => b.lengkap).length;

  if (role !== ROLES.SUPER_ADMIN) {
    return (
      <div className="dsb-halaman">
        <section className="dsb-panel">
          <p className="dsb-kosong">
            <strong style={{ color: "var(--dtn)" }}>Akses ditolak</strong>
            Halaman Pengaturan hanya untuk Super Admin.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <style href="sim-kgb-pengaturan" precedence="default">{GAYA}</style>

      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Administrasi</p>
          <h1 className="dsb-halaman-judul">Pengaturan</h1>
          <p className="dsb-sub">
            Penandatangan surat, dasar hukum, jadwal proses, pengingat, keamanan sesi, dan kontak.
            Perubahan berlaku untuk seluruh pengguna begitu disimpan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tersimpan ? (
            <span className="dsb-tag" data-garis="" data-nada="hijau">Tersimpan</span>
          ) : berubah ? (
            <span className="dsb-tag" data-garis="" data-nada="kuning">Ada perubahan belum disimpan</span>
          ) : (
            <span className="dsb-kecil">Semua tersimpan</span>
          )}
          <button type="button" className="dsb-tombol" onClick={() => void simpan()} disabled={menyimpan || !berubah}>
            {menyimpan ? "Menyimpan…" : "Simpan pengaturan"}
          </button>
        </div>
      </header>

      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setGalat("")}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {!memuat && !awal && (
        <div role="status" className="dsb-pesan" data-nada="kuning">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>Dasar hukum, notifikasi, dan kontak belum pernah disimpan, jadi nilai bawaan yang dipakai.</p>
        </div>
      )}

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Kelengkapan</span>
          <span className="dsb-angka-nilai">
            {lengkap}
            <small>/ {dihitung.length} bagian</small>
          </span>
          <span className="dsb-angka-meta">
            <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true">
              <span style={{ width: `${Math.round((lengkap / dihitung.length) * 100)}%` }} />
            </span>
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Batas input Tim SDM</span>
          <span className="dsb-angka-nilai">
            {form.batasInputSdm}
            <small>tiap bulan M-2</small>
          </span>
          <span className="dsb-angka-meta">
            {form.batasInputSdm === 31 ? "31 berarti akhir bulan" : "Input setelahnya ditandai berpotensi rapelan"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Pengingat KGB</span>
          <span className="dsb-angka-nilai" style={{ fontSize: 22 }}>
            H-{form.notifKgbH1} &amp; H-{form.notifKgbH2}
          </span>
          <span className="dsb-angka-meta">Lalu pengingat mendesak pada hari batas input</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Terakhir diubah</span>
          <span className="dsb-angka-nilai" style={{ fontSize: 20 }}>
            {awal?.updatedAt ? formatTanggalId(new Date(awal.updatedAt), { day: "numeric", month: "short", year: "numeric" }) : "–"}
          </span>
          <span className="dsb-angka-meta">{awal?.updatedBy ? `Oleh NIP ${awal.updatedBy}` : awal?.updatedAt ? "Pelaku tidak tercatat" : "Belum pernah disimpan"}</span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                {bagianAktif.label} <small>{bagianAktif.ket}</small>
              </h2>
              {!bagianAktif.luar && (
                <span className="dsb-tag" data-garis="" data-nada={bagianAktif.lengkap ? "hijau" : "kuning"}>
                  {bagianAktif.lengkap ? "Terisi" : "Belum diatur"}
                </span>
              )}
            </div>

            {memuat ? (
              <p className="dsb-kosong">Memuat pengaturan…</p>
            ) : (
              <div className="dsb-gulir dsb-panel-isi atr-isi">
                {bagian === "pejabat" && <PenandatanganManager onStatus={setAdaPenandatangan} />}

                {bagian === "dokumen" && (
                  <>
                    <div className="atr-kisi2">
                      <Bidang label="Nomor PP" nilai={form.nomorPP} onUbah={(v) => setForm((f) => ({ ...f, nomorPP: v }))} contoh="Nomor 5 Tahun 2024" />
                      <Bidang label="Tahun PP" nilai={form.tahunPP} onUbah={(v) => setForm((f) => ({ ...f, tahunPP: v }))} contoh="2024" />
                    </div>
                    <p className="dsb-catatan">
                      Nilai ini dicetak pada bagian &quot;Mengingat&quot; surat keputusan kenaikan gaji berkala.
                    </p>
                  </>
                )}

                {bagian === "jadwal" && (
                  <>
                    <Bidang
                      label="Batas input Tim SDM"
                      jenis="number"
                      satuan="tanggal"
                      nilai={String(form.batasInputSdm)}
                      onUbah={(v) => setForm((f) => ({ ...f, batasInputSdm: Math.min(31, Math.max(1, angka(v, BATAS_INPUT_SDM_BAWAAN))) }))}
                      petunjuk="Tanggal 1–31 pada bulan kedua sebelum TMT (31 berarti akhir bulan). Input setelah tanggal ini tetap diterima, tetapi ditandai berpotensi rapelan."
                    />
                    <ContohJadwal batas={form.batasInputSdm} />
                  </>
                )}

                {bagian === "kppn" && (
                  <>
                    <p className="dsb-catatan">
                      SK kenaikan gaji berkala ditujukan ke KPPN mitra satker, sehingga daftar ini menentukan ke
                      kantor bayar mana SK dikirim. Ubah hanya bila kemitraannya memang berpindah; satker yang tidak
                      diubah mengikuti daftar bawaan aplikasi.
                    </p>
                    <ul className="atr-kppn">
                      {satkerKppn.map((s) => {
                        const nilai = kppn[s.kode] ?? s.bawaan;
                        const manual = nilai === "" || !opsiKppn.includes(nilai);
                        return (
                          <li key={s.kode}>
                            <span className="min-w-0">
                              <span className="dsb-nama">{s.nama}</span>
                              {nilai !== s.bawaan && (
                                <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-amber)" }}>
                                  Disesuaikan, bawaannya KPPN {s.bawaan}
                                </p>
                              )}
                            </span>
                            <span className="atr-kppn-isian">
                              <select
                                className="dsb-pilih"
                                aria-label={`KPPN mitra ${s.nama}`}
                                value={manual ? "__lain__" : nilai}
                                onChange={(e) =>
                                  setKppn((k) => ({ ...k, [s.kode]: e.target.value === "__lain__" ? "" : e.target.value }))
                                }
                              >
                                {opsiKppn.map((o) => (
                                  <option key={o} value={o}>KPPN {o}</option>
                                ))}
                                <option value="__lain__">KPPN lain, ketik sendiri</option>
                              </select>
                              {manual && (
                                <input
                                  className="dsb-cari"
                                  value={nilai}
                                  placeholder="Nama KPPN"
                                  aria-label={`Nama KPPN mitra ${s.nama}`}
                                  onChange={(e) => setKppn((k) => ({ ...k, [s.kode]: e.target.value }))}
                                />
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {bagian === "notifikasi" && (
                  <>
                    <div className="atr-kisi2">
                      <Bidang label="Peringatan awal" jenis="number" satuan="hari" nilai={String(form.notifKgbH1)} onUbah={(v) => setForm((f) => ({ ...f, notifKgbH1: angka(v, 14) }))} petunjuk="Prioritas informasi" />
                      <Bidang label="Peringatan mendesak" jenis="number" satuan="hari" nilai={String(form.notifKgbH2)} onUbah={(v) => setForm((f) => ({ ...f, notifKgbH2: angka(v, 7) }))} petunjuk="Prioritas perhatian" />
                    </div>
                    <p className="dsb-catatan">
                      H-{form.notifKgbH1 || 14} muncul lebih dulu, lalu H-{form.notifKgbH2 || 7}. Pada hari batas input
                      pengingat menjadi mendesak, dan setelah batas lewat berubah menjadi peringatan KGB terlambat yang
                      diulang tiap 30 hari sampai KGB diinput.
                    </p>
                  </>
                )}

                {bagian === "keamanan" && (
                  <>
                    <Bidang
                      label="Durasi menganggur sebelum keluar otomatis"
                      jenis="number"
                      satuan="menit"
                      nilai={String(form.sesiTimeoutMenit)}
                      onUbah={(v) => setForm((f) => ({ ...f, sesiTimeoutMenit: angka(v, 60) }))}
                      petunjuk="Peringatan muncul 2 menit sebelum keluar. Rentang aman 5–480 menit."
                    />
                    <p className="dsb-catatan">
                      Mengganti password pengguna juga mengakhiri sesinya yang masih terbuka.
                    </p>
                  </>
                )}

                {bagian === "kontak" && (
                  <>
                    <Bidang
                      label="Nomor WhatsApp admin"
                      nilai={form.waAdmin}
                      onUbah={(v) => setForm((f) => ({ ...f, waAdmin: v.replace(/\D/g, "") }))}
                      contoh="6281234567890"
                      petunjuk="Format internasional tanpa tanda plus atau spasi. Kosongkan untuk menyembunyikan tombol lupa password."
                    />
                    {form.waAdmin && (
                      <p className="dsb-catatan">
                        Pratinjau tautan: <strong style={{ fontFamily: "monospace" }}>wa.me/{form.waAdmin}</strong>
                      </p>
                    )}
                  </>
                )}

                {bagian === "pemeriksaan" && <PemeriksaanData />}
              </div>
            )}

            <div className="dsb-kaki">
              <span className="dsb-kecil">
                {awal?.updatedAt
                  ? `Terakhir diubah ${formatTanggalId(new Date(awal.updatedAt), { day: "numeric", month: "long", year: "numeric" })}`
                  : "Belum ada perubahan tercatat"}
              </span>
              <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => void simpan()} disabled={menyimpan || !berubah}>
                {menyimpan ? "Menyimpan…" : "Simpan pengaturan"}
              </button>
            </div>
          </section>
        </div>

        <aside className="dsb-samping" data-urutan="tetap">
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Bagian pengaturan <small>{lengkap} dari {dihitung.length} terisi</small>
              </h2>
            </div>
            <div className="dsb-gulir">
              <ul className="dsb-daftar-ringkas" style={{ maxHeight: "none", border: 0, borderRadius: 0 }}>
                {daftarBagian.map((b) => (
                  <li key={b.id}>
                    <button type="button" className="dsb-pilih-baris" aria-pressed={bagian === b.id} onClick={() => setBagian(b.id)}>
                      <span>
                        <span className="dsb-titik" data-nada={b.luar ? "navy" : b.lengkap ? "hijau" : "kuning"} aria-hidden="true" /> {b.label}
                        <br />
                        <span className="dsb-kecil">{b.ket}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const GAYA = `
.atr-isi { display: grid; gap: 14px; align-content: start; }
.atr-kisi2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.atr-bidang { display: grid; gap: 4px; }
.atr-label { font-size: 13px; font-weight: 600; color: var(--dt2); }
.atr-isian { position: relative; display: block; }
.atr-satuan { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--dt5); pointer-events: none; }
.atr-isi .dsb-jadwal li { grid-template-columns: minmax(0, 1fr) auto; }
.atr-kppn { display: grid; gap: 8px; }
.atr-kppn li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 240px); gap: 10px; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--ln2); }
.atr-kppn li:last-child { border-bottom: 0; }
.atr-kppn-isian { display: grid; gap: 6px; }
@media (max-width: 640px) { .atr-kppn li { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .atr-kisi2 { grid-template-columns: 1fr; } }
`;
