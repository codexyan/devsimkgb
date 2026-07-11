export const ROLES = {
  SUPER_ADMIN:  "superAdminCore",
  KEUANGAN:     "keuangan",
  SDM_KGB:      "sdm_kgb",
  SDM_HUKDIS:   "sdm_hukdis",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// KGB: superAdminCore + sdm_kgb
export const canProcessKGB = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.SDM_KGB;

// Hukdis detail & management: superAdminCore + sdm_hukdis
export const canManageHukdis = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.SDM_HUKDIS;

// Keuangan fitur: superAdminCore + keuangan
export const canAccessKeuangan = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.KEUANGAN;

// Edit/hapus pegawai: superAdminCore + sdm_kgb (sdm_hukdis hanya baca)
export const canEditPegawai = (role: string) =>
  role === ROLES.SUPER_ADMIN || role === ROLES.SDM_KGB;

// Fitur admin eksklusif
export const isSuperAdmin = (role: string) => role === ROLES.SUPER_ADMIN;

// Label tampil untuk setiap role
export const ROLE_LABEL: Record<string, string> = {
  superAdminCore: "Super Admin",
  keuangan:       "Keuangan",
  sdm_kgb:        "SDM KGB",
  sdm_hukdis:     "SDM Hukdis",
};
