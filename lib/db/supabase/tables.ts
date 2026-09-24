// Repository Supabase dengan kunci dan tipe baris yang sama dengan `sheets` di lib/sheets/tables.ts.

import {
  defs,
  type AuditLogRow,
  type NotifikasiRow,
  type PegawaiRow,
  type PenandatanganRow,
  type RiwayatKGBRow,
  type RiwayatPangkatRow,
  type RiwayatMutasiRow,
  type UsulanPegawaiRow,
  type UserRow,
} from "../../sheets/tables";
import { SupabaseTable } from "./table";

export const supabase = {
  user: new SupabaseTable<UserRow>(defs.User),
  profileChangeRequest: new SupabaseTable(defs.ProfileChangeRequest),
  pegawai: new SupabaseTable<PegawaiRow>(defs.Pegawai),
  riwayatKGB: new SupabaseTable<RiwayatKGBRow>(defs.RiwayatKGB),
  suratKGB: new SupabaseTable(defs.SuratKGB),
  serahTerima: new SupabaseTable(defs.SerahTerima),
  konfigurasiKanwil: new SupabaseTable(defs.KonfigurasiKanwil),
  penandatangan: new SupabaseTable<PenandatanganRow>(defs.Penandatangan),
  notifikasi: new SupabaseTable<NotifikasiRow>(defs.Notifikasi),
  riwayatHukdis: new SupabaseTable(defs.RiwayatHukdis),
  riwayatPangkat: new SupabaseTable<RiwayatPangkatRow>(defs.RiwayatPangkat),
  riwayatMutasi: new SupabaseTable<RiwayatMutasiRow>(defs.RiwayatMutasi),
  usulanPegawai: new SupabaseTable<UsulanPegawaiRow>(defs.UsulanPegawai),
  hukdisJenis: new SupabaseTable(defs.HukdisJenis),
  hukdisKonfigurasi: new SupabaseTable(defs.HukdisKonfigurasi),
  regulasi: new SupabaseTable(defs.Regulasi),
  auditLog: new SupabaseTable<AuditLogRow>(defs.AuditLog),
  rekonBulanan: new SupabaseTable(defs.RekonBulanan),
};
