export const ROLES = {
  SUPER_ADMIN:  "superAdminCore",
  KEUANGAN:     "keuangan",
  SDM_KGB:      "sdm_kgb",
  SDM_HUKDIS:   "sdm_hukdis",
  // Operator UPT: data satkernya sendiri. Mengusulkan data dan melaporkan mutasi (ditinjau Kanwil), serta
  // merangkap keuangan UPT: menetapkan rapelan dan merekam KGB pegawai satkernya di Gaji Web (ADR-009).
  ADMIN_UPT:    "admin_upt",
} as const;

// KGB: superAdminCore + sdm_kgb
export const canProcessKGB = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.SDM_KGB;

// Hukdis detail & management: superAdminCore + sdm_hukdis
export const canManageHukdis = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.SDM_HUKDIS;

// Keuangan fitur (lihat halaman keuangan, rekon, riwayat): superAdminCore + keuangan
export const canAccessKeuangan = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.KEUANGAN;

// Konfirmasi keuangan dan follow up ke Tim SDM: keuangan saja. Super Admin hanya melihat, supaya
// verifikasi SDM dan verifikasi Keuangan tetap dilakukan dua orang berbeda.
export const canKonfirmasiKeuangan = (role: string) => role === ROLES.KEUANGAN;

// Membaca data KGB (daftar, ringkasan dashboard): peran KGB + keuangan. SDM Hukdis tidak.
export const canViewKGB = (role: string) =>
  canProcessKGB(role) || role === ROLES.KEUANGAN;

// Edit/hapus pegawai: superAdminCore + sdm_kgb (sdm_hukdis hanya baca)
export const canEditPegawai = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.SDM_KGB;

// Fitur admin eksklusif
export const isSuperAdmin = (role: string) => role === ROLES.SUPER_ADMIN;

// Admin UPT: hanya dashboard satkernya sendiri (lihat saja). Peran ini sengaja tidak masuk ke helper
// mana pun di atas, sehingga seluruh modul Kanwil menolaknya.
export const isAdminUpt = (role: string) => role === ROLES.ADMIN_UPT;

// Peran yang boleh mengunduh berkas SK dari penyimpanan lewat /api/blob/download. Admin UPT memakai
// /api/upt/sk/[id] yang memeriksa satker dan status KGB.
export const PERAN_UNDUH_SK: string[] = [ROLES.SUPER_ADMIN, ROLES.SDM_KGB, ROLES.SDM_HUKDIS, ROLES.KEUANGAN];
export const bolehUnduhBerkasSk = (role: string) => PERAN_UNDUH_SK.includes(role);

// Label tampil untuk setiap role
export const ROLE_LABEL: Record<string, string> = {
  superAdminCore: "Super Admin",
  keuangan:       "Keuangan",
  sdm_kgb:        "SDM KGB",
  sdm_hukdis:     "SDM Hukdis",
  admin_upt:      "Admin UPT",
};
