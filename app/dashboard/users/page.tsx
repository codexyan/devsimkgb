"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL, ROLES } from "@/lib/auth";
import { SATKER_UPT } from "@/lib/aksesUpt";
import { namaTampilSatker } from "@/app/dashboard/satker/labelSatker";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { formatTanggalId } from "@/lib/waktu";

interface User {
  id: string;
  nip: string;
  nama: string;
  role: string;
  /** Kode satker untuk peran admin_upt; kosong untuk peran Kanwil. */
  satker?: string | null;
  createdAt: string;
}

interface ReassignCounts {
  kgbCount: number;
  suratCount: number;
  serahTerimaCount: number;
  hukdisCount: number;
}

interface ProfileRequest {
  id: string;
  nama: string | null;
  jabatan: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  user: { id: string; nip: string; nama: string; jabatan: string | null; email: string | null; role: string };
}

/* ─── Peran ────────────────────────────────────────────────────────────── */
type NadaPeran = "kuning" | "navy" | "merah" | "ungu" | "hijau";

const PERAN: { id: string; label: string; nada: NadaPeran; tugas: string }[] = [
  { id: ROLES.SUPER_ADMIN, label: "Super Admin",   nada: "kuning", tugas: "Mengatur penandatangan, jadwal proses, pengguna, dan log." },
  { id: ROLES.SDM_KGB,     label: "SDM KGB",       nada: "navy",   tugas: "Input KGB, membuat dan mengirim SK kenaikan gaji berkala." },
  { id: ROLES.SDM_HUKDIS,  label: "SDM Hukdis",    nada: "merah",  tugas: "Mencatat hukuman disiplin dan dampaknya pada KGB." },
  { id: ROLES.KEUANGAN,    label: "Keuangan",      nada: "ungu",   tugas: "Mengonfirmasi SK dan merekon gaji di Gaji Web." },
  { id: ROLES.ADMIN_UPT,   label: "Admin UPT",     nada: "hijau",  tugas: "Melihat data pegawai satkernya sendiri; tidak dapat mengubah data." },
];

const cfgPeran = (id: string) => PERAN.find((p) => p.id === id) ?? { id, label: ROLE_LABEL[id] ?? id, nada: "navy" as NadaPeran, tugas: "" };
const inisial = (nama: string) => nama.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
const namaSatkerAkun = (kode: string | null | undefined) => {
  const s = SATKER_UPT.find((x) => x.kode === kode);
  return s ? namaTampilSatker(s) : kode ?? "";
};

const kosongTambah = { nip: "", nama: "", role: ROLES.SDM_KGB as string, password: "", satker: "" };

export default function UsersPage() {
  const router = useRouter();
  const saya = useDashUser();

  const [users, setUsers] = useState<User[]>([]);
  const [memuatUsers, setMemuatUsers] = useState(true);
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [memuatReq, setMemuatReq] = useState(true);

  const [cari, setCari] = useState("");
  const [filterPeran, setFilterPeran] = useState("");

  const [dialogTambah, setDialogTambah] = useState(false);
  const [dialogReset, setDialogReset] = useState<User | null>(null);
  const [dialogSatker, setDialogSatker] = useState<User | null>(null);
  const [dialogHapus, setDialogHapus] = useState<User | null>(null);
  const [dialogTolak, setDialogTolak] = useState<ProfileRequest | null>(null);
  const [reassignCounts, setReassignCounts] = useState<ReassignCounts | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");

  const [formTambah, setFormTambah] = useState(kosongTambah);
  const [formReset, setFormReset] = useState("");
  const [formSatker, setFormSatker] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [berhasil, setBerhasil] = useState("");

  const muatUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.status === 403) { router.push("/dashboard"); return; }
    const d: unknown = await res.json().catch(() => []);
    setUsers(Array.isArray(d) ? (d as User[]) : []);
    setMemuatUsers(false);
  }, [router]);

  const muatRequests = useCallback(async () => {
    const res = await fetch("/api/admin/profile-requests");
    const d: unknown = res.ok ? await res.json().catch(() => []) : [];
    if (Array.isArray(d)) setRequests(d as ProfileRequest[]);
    setMemuatReq(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void muatUsers(); void muatRequests(); }, 0);
    return () => clearTimeout(t);
  }, [muatUsers, muatRequests]);

  function kabar(teks: string) {
    setBerhasil(teks);
    setTimeout(() => setBerhasil(""), 4000);
  }
  function tutupHapus() {
    setDialogHapus(null); setReassignCounts(null); setReassignTo(""); setGalat("");
  }

  async function tambahPengguna() {
    setGalat("");
    // Validasi klien selaras dengan aturan login (NIP 18 digit, sandi minimal 6 karakter).
    if (!/^\d{18}$/.test(formTambah.nip.trim())) { setGalat("NIP harus tepat 18 digit angka"); return; }
    if (!formTambah.nama.trim()) { setGalat("Nama lengkap wajib diisi"); return; }
    if (formTambah.password.length < 6) { setGalat("Password minimal 6 karakter"); return; }
    if (formTambah.role === ROLES.ADMIN_UPT && !formTambah.satker) { setGalat("Pilih satuan kerja untuk peran Admin UPT"); return; }
    setSibuk(true);
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formTambah) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSibuk(false);
    if (!res.ok) { setGalat(data.error ?? "Gagal menambahkan pengguna"); return; }
    kabar(`Akun ${formTambah.nama.trim()} berhasil dibuat.`);
    setDialogTambah(false);
    setFormTambah(kosongTambah);
    void muatUsers();
  }

  async function aturUlangSandi() {
    if (!dialogReset) return;
    setGalat("");
    if (formReset.length < 6) { setGalat("Password minimal 6 karakter"); return; }
    setSibuk(true);
    const res = await fetch(`/api/users/${dialogReset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: formReset }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSibuk(false);
    if (!res.ok) { setGalat(data.error ?? "Gagal mengatur ulang password"); return; }
    kabar(`Password ${dialogReset.nama} berhasil diatur ulang. Pengguna harus masuk kembali.`);
    setDialogReset(null); setFormReset("");
  }

  async function pindahSatker() {
    if (!dialogSatker) return;
    setGalat("");
    if (!formSatker) { setGalat("Pilih satuan kerja tujuan"); return; }
    setSibuk(true);
    const res = await fetch(`/api/users/${dialogSatker.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ satker: formSatker }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSibuk(false);
    if (!res.ok) { setGalat(data.error ?? "Gagal memindahkan satuan kerja"); return; }
    kabar(`Akun ${dialogSatker.nama} kini melihat data ${namaSatkerAkun(formSatker)}.`);
    setDialogSatker(null);
    void muatUsers();
  }

  async function hapusPengguna() {
    if (!dialogHapus) return;
    setGalat(""); setSibuk(true);
    const body: Record<string, string> = {};
    if (reassignTo) body.reassignTo = reassignTo;
    const res = await fetch(`/api/users/${dialogHapus.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string; needsReassign?: boolean; counts?: ReassignCounts; reassigned?: number;
    };
    setSibuk(false);
    if (res.status === 409 && data.needsReassign && data.counts) { setReassignCounts(data.counts); return; }
    if (!res.ok) { setGalat(data.error ?? "Gagal menghapus pengguna"); return; }
    kabar(data.reassigned ? `Pengguna ${dialogHapus.nama} dihapus, ${data.reassigned} data dialihkan.` : `Pengguna ${dialogHapus.nama} berhasil dihapus.`);
    tutupHapus();
    void muatUsers();
  }

  async function setujuiProfil(req: ProfileRequest) {
    setSibuk(true);
    const res = await fetch(`/api/admin/profile-requests/${req.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
    setSibuk(false);
    if (!res.ok) return;
    kabar(`Perubahan profil ${req.user.nama} disetujui.`);
    void muatRequests();
    void muatUsers();
  }

  async function tolakProfil() {
    if (!dialogTolak) return;
    setSibuk(true);
    const res = await fetch(`/api/admin/profile-requests/${dialogTolak.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", alasanTolak }) });
    setSibuk(false);
    if (!res.ok) return;
    kabar(`Permintaan profil ${dialogTolak.user.nama} ditolak.`);
    setDialogTolak(null); setAlasanTolak("");
    void muatRequests();
  }

  const jumlahPeran = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return users
      .filter((u) => (!filterPeran || u.role === filterPeran) && (!q || u.nama.toLowerCase().includes(q) || u.nip.includes(q)))
      .sort((a, b) => PERAN.findIndex((p) => p.id === a.role) - PERAN.findIndex((p) => p.id === b.role) || a.nama.localeCompare(b.nama, "id"));
  }, [users, cari, filterPeran]);

  const jumlahUpt = users.filter((u) => u.role === ROLES.ADMIN_UPT).length;
  const satkerTerpakai = new Set(users.filter((u) => u.role === ROLES.ADMIN_UPT && u.satker).map((u) => u.satker)).size;
  const usersLain = dialogHapus ? users.filter((u) => u.id !== dialogHapus.id) : [];

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Administrasi</p>
          <h1 className="dsb-halaman-judul">Pengguna</h1>
          <p className="dsb-sub">
            Akun beserta perannya menentukan menu yang terbuka dan data yang boleh diubah. Akun Admin UPT hanya
            melihat pegawai satuan kerjanya sendiri.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dsb-ikon-tombol" onClick={() => { void muatUsers(); void muatRequests(); }} title="Muat ulang" aria-label="Muat ulang daftar pengguna">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={memuatUsers ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
          <button type="button" className="dsb-tombol" onClick={() => { setDialogTambah(true); setGalat(""); }}>
            Tambah pengguna
          </button>
        </div>
      </header>

      {berhasil && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{berhasil}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setBerhasil("")}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Total akun</span>
          <span className="dsb-angka-nilai">{memuatUsers ? "–" : users.length}</span>
          <span className="dsb-angka-meta">{users.length - jumlahUpt} akun Kanwil · {jumlahUpt} akun UPT</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Satuan kerja terhubung</span>
          <span className="dsb-angka-nilai">
            {memuatUsers ? "–" : satkerTerpakai}
            <small>/ {SATKER_UPT.length} UPT</small>
          </span>
          <span className="dsb-angka-meta">
            <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true">
              <span style={{ width: `${SATKER_UPT.length ? Math.round((satkerTerpakai / SATKER_UPT.length) * 100) : 0}%` }} />
            </span>
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Permintaan profil</span>
          <span className="dsb-angka-nilai" style={{ color: requests.length > 0 ? "var(--st-amber)" : undefined }}>
            {memuatReq ? "–" : requests.length}
          </span>
          <span className="dsb-angka-meta">
            {requests.length > 0 && <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />}
            {requests.length > 0 ? "Menunggu ditinjau Super Admin" : "Tidak ada yang menunggu"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Peran tanpa akun</span>
          <span className="dsb-angka-nilai">{memuatUsers ? "–" : PERAN.filter((p) => !jumlahPeran[p.id]).length}</span>
          <span className="dsb-angka-meta">
            {PERAN.filter((p) => !jumlahPeran[p.id]).map((p) => p.label).join(" · ") || "Semua peran sudah terisi"}
          </span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Akun pengguna <small>{tersaring.length} dari {users.length}</small>
              </h2>
              <div className="dsb-alat">
                <input
                  type="search"
                  className="dsb-cari"
                  aria-label="Cari pengguna"
                  placeholder="Cari nama atau NIP…"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
                {(cari || filterPeran) && (
                  <button type="button" className="dsb-tautan" onClick={() => { setCari(""); setFilterPeran(""); }}>Hapus saringan</button>
                )}
              </div>
            </div>

            {memuatUsers ? (
              <p className="dsb-kosong">Memuat data pengguna…</p>
            ) : tersaring.length === 0 ? (
              <p className="dsb-kosong">
                {users.length === 0 ? "Belum ada akun pengguna." : "Tidak ada pengguna yang cocok dengan saringan ini."}
              </p>
            ) : (
              <div className="dsb-gulir-tabel">
                <table className="dsb-tabel">
                  <thead>
                    <tr>
                      <th scope="col">Nama dan NIP</th>
                      <th scope="col">Peran</th>
                      <th scope="col">Satuan kerja</th>
                      <th scope="col">Dibuat</th>
                      <th scope="col" className="kanan">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tersaring.map((u) => {
                      const cfg = cfgPeran(u.role);
                      const iniSaya = u.nip === saya.nip;
                      return (
                        <tr key={u.id}>
                          <td style={{ maxWidth: "230px" }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="dsb-avatar" aria-hidden="true">{inisial(u.nama)}</span>
                              <div className="min-w-0">
                                <p className="dsb-nama truncate" style={{ margin: 0 }}>
                                  {u.nama}
                                  {iniSaya && <span className="dsb-tag" data-garis="" style={{ marginLeft: 6 }}>Akun Anda</span>}
                                </p>
                                <p className="dsb-kecil" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{u.nip}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="dsb-tag" data-garis="" data-nada={cfg.nada}>
                              <span className="dsb-titik" data-nada={cfg.nada} aria-hidden="true" />
                              {cfg.label}
                            </span>
                          </td>
                          <td style={{ maxWidth: "200px" }}>
                            {u.role === ROLES.ADMIN_UPT ? (
                              <p style={{ margin: 0, lineHeight: 1.35 }}>{namaSatkerAkun(u.satker) || "Belum ditautkan"}</p>
                            ) : (
                              <span className="dsb-kecil">Kantor Wilayah</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap dsb-kecil">
                            {formatTanggalId(new Date(u.createdAt), { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                          <td className="kanan">
                            <span className="dsb-aksi">
                              {u.role === ROLES.ADMIN_UPT && (
                                <button
                                  type="button"
                                  className="dsb-ikon-tombol"
                                  title="Pindah satuan kerja"
                                  aria-label={`Pindah satuan kerja ${u.nama}`}
                                  onClick={() => { setDialogSatker(u); setFormSatker(u.satker ?? ""); setGalat(""); }}
                                >
                                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M10 21v-6h4v6" /></svg>
                                </button>
                              )}
                              <button
                                type="button"
                                className="dsb-ikon-tombol"
                                title={iniSaya ? "Password akun sendiri diganti lewat Profil Saya" : "Atur ulang password"}
                                aria-label={`Atur ulang password ${u.nama}`}
                                disabled={iniSaya}
                                onClick={() => { setDialogReset(u); setFormReset(""); setLihatSandi(false); setGalat(""); }}
                              >
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                              </button>
                              <button
                                type="button"
                                className="dsb-ikon-tombol"
                                data-nada="merah"
                                title={iniSaya ? "Akun yang sedang login tidak dapat dihapus" : "Hapus pengguna"}
                                aria-label={`Hapus pengguna ${u.nama}`}
                                disabled={iniSaya}
                                onClick={() => { setDialogHapus(u); setReassignCounts(null); setReassignTo(""); setGalat(""); }}
                              >
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="dsb-samping" data-urutan="tetap">
          <section className="dsb-panel dsb-susut">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">Peran</h2>
              {filterPeran && <button type="button" className="dsb-tautan" onClick={() => setFilterPeran("")}>Tampilkan semua</button>}
            </div>
            <div className="dsb-gulir">
              <ul className="dsb-daftar-ringkas" style={{ maxHeight: "none", border: 0, borderRadius: 0 }}>
                {PERAN.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="dsb-pilih-baris"
                      aria-pressed={filterPeran === p.id}
                      title={p.tugas}
                      onClick={() => setFilterPeran(filterPeran === p.id ? "" : p.id)}
                    >
                      <span>
                        <span className="dsb-titik" data-nada={p.nada} aria-hidden="true" /> {p.label}
                      </span>
                      <strong>{jumlahPeran[p.id] ?? 0}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Permintaan perubahan profil <small>{requests.length} menunggu</small>
              </h2>
            </div>
            {memuatReq ? (
              <p className="dsb-kosong">Memuat permintaan…</p>
            ) : requests.length === 0 ? (
              <p className="dsb-kosong">
                Tidak ada permintaan. Pengguna mengajukan perubahan nama, jabatan, atau email dari menu Profil Saya.
              </p>
            ) : (
              <div className="dsb-gulir">
                <ul className="dsb-tindakan-daftar">
                  {requests.map((r) => (
                    <li key={r.id}>
                      <p>
                        <strong>{r.user.nama}</strong> <span className="dsb-kecil">{r.user.nip}</span>
                      </p>
                      <p className="dsb-kecil">
                        {[
                          r.nama && r.nama !== r.user.nama && `Nama → ${r.nama}`,
                          r.jabatan && r.jabatan !== r.user.jabatan && `Jabatan → ${r.jabatan}`,
                          r.email && r.email !== r.user.email && `Email → ${r.email}`,
                        ].filter(Boolean).join(" · ") || "Tidak ada perubahan nilai"}
                      </p>
                      <p className="dsb-kecil">
                        Diajukan {formatTanggalId(new Date(r.createdAt), { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <span className="flex items-center gap-2" style={{ marginTop: 6 }}>
                        <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" disabled={sibuk} onClick={() => void setujuiProfil(r)}>
                          Setujui
                        </button>
                        <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={sibuk} onClick={() => { setDialogTolak(r); setAlasanTolak(""); }}>
                          Tolak
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ── Tambah pengguna ── */}
      {dialogTambah && (
        <KerangkaModal
          judul="Tambah pengguna"
          subjudul="Akun baru dapat langsung dipakai masuk dengan NIP dan password ini"
          ukuran="md"
          sibuk={sibuk}
          onTutup={() => setDialogTambah(false)}
          onKirim={() => void tambahPengguna()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogTambah(false)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>{sibuk ? "Menyimpan…" : "Simpan akun"}</button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <div className="kgbm-grid2">
            <label className="kgbm-label">
              <span className="kgbm-wajib">NIP</span>
              <input
                className="kgbm-input"
                data-autofocus
                inputMode="numeric"
                maxLength={18}
                value={formTambah.nip}
                onChange={(e) => setFormTambah((f) => ({ ...f, nip: e.target.value.replace(/\D/g, "") }))}
                placeholder="18 digit angka"
              />
            </label>
            <label className="kgbm-label">
              <span className="kgbm-wajib">Nama lengkap</span>
              <input className="kgbm-input" value={formTambah.nama} onChange={(e) => setFormTambah((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama dan gelar" />
            </label>
          </div>
          <label className="kgbm-label">
            <span className="kgbm-wajib">Peran</span>
            <select
              className="kgbm-input"
              value={formTambah.role}
              onChange={(e) => setFormTambah((f) => ({ ...f, role: e.target.value, satker: e.target.value === ROLES.ADMIN_UPT ? f.satker : "" }))}
            >
              {PERAN.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <Catatan>{cfgPeran(formTambah.role).tugas}</Catatan>
          {formTambah.role === ROLES.ADMIN_UPT && (
            <label className="kgbm-label">
              <span className="kgbm-wajib">Satuan kerja</span>
              <select className="kgbm-input" value={formTambah.satker} onChange={(e) => setFormTambah((f) => ({ ...f, satker: e.target.value }))}>
                <option value="">Pilih satuan kerja…</option>
                {SATKER_UPT.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
              </select>
            </label>
          )}
          <label className="kgbm-label">
            <span className="kgbm-wajib">Password awal</span>
            <span className="flex items-center gap-2">
              <input
                className="kgbm-input"
                type={lihatSandi ? "text" : "password"}
                value={formTambah.password}
                onChange={(e) => setFormTambah((f) => ({ ...f, password: e.target.value }))}
                placeholder="Minimal 6 karakter"
              />
              <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={() => setLihatSandi((v) => !v)}>
                {lihatSandi ? "Sembunyikan" : "Lihat"}
              </button>
            </span>
          </label>
        </KerangkaModal>
      )}

      {/* ── Atur ulang password ── */}
      {dialogReset && (
        <KerangkaModal
          judul="Atur ulang password"
          subjudul={`${dialogReset.nama} · ${dialogReset.nip}`}
          nada="amber"
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogReset(null)}
          onKirim={() => void aturUlangSandi()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogReset(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>{sibuk ? "Menyimpan…" : "Atur ulang"}</button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <label className="kgbm-label">
            <span className="kgbm-wajib">Password baru</span>
            <input
              className="kgbm-input"
              data-autofocus
              type={lihatSandi ? "text" : "password"}
              value={formReset}
              onChange={(e) => setFormReset(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </label>
          <Catatan nada="amber">
            Sesi yang masih terbuka dengan password lama akan berakhir. Sampaikan password baru ini langsung kepada
            pemilik akun dan minta ia menggantinya dari menu Profil Saya.
          </Catatan>
        </KerangkaModal>
      )}

      {/* ── Pindah satuan kerja ── */}
      {dialogSatker && (
        <KerangkaModal
          judul="Pindah satuan kerja"
          subjudul={`${dialogSatker.nama} · ${dialogSatker.nip}`}
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogSatker(null)}
          onKirim={() => void pindahSatker()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogSatker(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>{sibuk ? "Menyimpan…" : "Simpan"}</button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <label className="kgbm-label">
            <span className="kgbm-wajib">Satuan kerja</span>
            <select className="kgbm-input" data-autofocus value={formSatker} onChange={(e) => setFormSatker(e.target.value)}>
              <option value="">Pilih satuan kerja…</option>
              {SATKER_UPT.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
            </select>
          </label>
          <Catatan>
            Seluruh data yang terlihat akun ini langsung mengikuti satuan kerja baru, termasuk berkas SK yang boleh diunduh.
          </Catatan>
        </KerangkaModal>
      )}

      {/* ── Hapus pengguna ── */}
      {dialogHapus && (
        <KerangkaModal
          judul="Hapus pengguna"
          subjudul={`${dialogHapus.nama} · ${dialogHapus.nip}`}
          nada="merah"
          ukuran="sm"
          sibuk={sibuk}
          onTutup={tutupHapus}
          onKirim={() => void hapusPengguna()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutupHapus} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk || (!!reassignCounts && !reassignTo)}>
                {sibuk ? "Menghapus…" : reassignCounts ? "Alihkan dan hapus" : "Hapus akun"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          {reassignCounts ? (
            <>
              <Catatan nada="amber">
                Akun ini tercatat sebagai pembuat {reassignCounts.kgbCount} KGB, {reassignCounts.suratCount} SK,
                {" "}{reassignCounts.serahTerimaCount} serah terima, dan {reassignCounts.hukdisCount} catatan hukuman disiplin.
                Pilih pengguna yang akan mewarisi catatan itu agar jejaknya tetap utuh.
              </Catatan>
              <label className="kgbm-label">
                <span className="kgbm-wajib">Alihkan data ke</span>
                <select className="kgbm-input" data-autofocus value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  <option value="">Pilih pengguna…</option>
                  {usersLain.map((u) => <option key={u.id} value={u.id}>{u.nama} — {cfgPeran(u.role).label}</option>)}
                </select>
              </label>
            </>
          ) : (
            <Catatan nada="merah">
              Akun dihapus permanen dan pemiliknya tidak dapat masuk lagi. Entri log aktivitas yang pernah dibuatnya tetap
              tersimpan, lengkap dengan nama dan NIP pada catatan penghapusan ini.
            </Catatan>
          )}
        </KerangkaModal>
      )}

      {/* ── Tolak permintaan profil ── */}
      {dialogTolak && (
        <KerangkaModal
          judul="Tolak permintaan profil"
          subjudul={`${dialogTolak.user.nama} · ${dialogTolak.user.nip}`}
          nada="merah"
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogTolak(null)}
          onKirim={() => void tolakProfil()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogTolak(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk}>{sibuk ? "Menyimpan…" : "Tolak permintaan"}</button>
            </>
          }
        >
          <label className="kgbm-label">
            Alasan penolakan
            <textarea
              className="kgbm-input"
              data-autofocus
              rows={3}
              value={alasanTolak}
              onChange={(e) => setAlasanTolak(e.target.value)}
              placeholder="Misalnya: nama tidak sesuai SK terakhir"
            />
          </label>
          <Catatan>Alasan ini ditampilkan kepada pengusul di menu Profil Saya.</Catatan>
        </KerangkaModal>
      )}
    </div>
  );
}
