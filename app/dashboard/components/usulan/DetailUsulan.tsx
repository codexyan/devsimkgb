"use client";

import { useState } from "react";
import { Catatan } from "@/app/dashboard/components/kgb";
import { formatTanggalId } from "@/lib/waktu";
import type { KeadaanSkDilaporkan } from "@/lib/dasarSkUsulan";
import { KOLOM_DASAR_GAJI } from "@/lib/tandaUsulan";

/* Isi tinjauan satu usulan data UPT (ADR-014): perubahan lama → baru, dampaknya pada KGB yang berjalan, laporan
   hukuman disiplin, SK dasar, catatan UPT, dan berkas pendukungnya. Dipakai halaman Usulan UPT (panel detail)
   dan jendela tinjauan di antrian kerja, sehingga keduanya selalu menampilkan hal yang sama. Tombol Setujui dan
   Kembalikan tetap milik pemanggil. */

/** Satu baris GET /api/usulan. */
export interface UsulanKanwil {
  id: string;
  pegawaiId: string | null;
  jenis: string;
  nama: string;
  nip: string;
  unitKerja: string;
  status: string;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
  perubahan: { kunci: string; label: string; sekarang: string; diusulkan: string }[];
  nilaiDiusulkan: { kunci: string; label: string; nilai: string }[];
  hukdis: string | null;
  hukdisKeterangan: string | null;
  nomorSkTerakhir: string | null;
  /** SK yang menetapkan gaji pokok baru pada usulan ini (ADR-030); null bila tidak ada. */
  dasarBaru?: string | null;
  /**
   * Hasil hitungan SK yang dilaporkan: keadaan pada SK KGB terakhir atau hitungan mundurnya bagi pegawai baru (ADR-065),
   * dan cocok tidaknya masa kerja menurut SK kenaikan pangkat dengan hitungan sistem (ADR-078).
   */
  catatanSkBaru?: string | null;
  /** Keadaan pencocokan yang sama, sebagai tanda untuk Setujui yang dicentang (ADR-099); hanya usulan yang menunggu. */
  keadaanSk?: KeadaanSkDilaporkan | null;
  tanggalSkTerakhir: string | null;
  /** Pejabat penetap SK itu, isian UPT atau saran dari awalan nomornya (ADR-086). */
  penetapSkTerakhir?: string | null;
  catatanUpt: string | null;
  diajukanOleh: string | null;
  diajukanAt: string | null;
  ditinjauOleh: string | null;
  ditinjauAt: string | null;
  alasanTolak: string | null;
  /** KGB yang tersentuh bila usulan disetujui; hanya untuk usulan yang menunggu. */
  kgb?: { status: string; tmtKgbBaru: string | null; skDibuat: boolean } | null;
  /**
   * Diajukan sebagai pegawai baru padahal NIP-nya sudah tercatat (ADR-091). Di satker yang sama usulan ini sudah tampil
   * sebagai perbaikan data pegawai itu; di satker lain tidak dapat disetujui.
   */
  nipTercatat?: { nama: string; unitKerja: string; satkerSama: boolean } | null;
}

const tgl = (iso: string | null | undefined) => (iso ? formatTanggalId(iso, { day: "numeric", month: "short", year: "numeric" }) : "-");

/** Kalimat dampak persetujuan pada KGB pegawai, menurut keadaan KGB-nya sekarang. */
function dampakKgb(u: UsulanKanwil): { nada: "amber" | "merah" | "navy"; teks: string } | null {
  const k = u.kgb;
  if (!k || u.status !== "menunggu") return null;
  const tmt = k.tmtKgbBaru ? `TMT ${tgl(k.tmtKgbBaru)}` : "berjalan";
  const menyentuhGaji = u.perubahan.some((p) => KOLOM_DASAR_GAJI.has(p.kunci));
  if (k.status === "menunggu_keuangan")
    return menyentuhGaji
      ? { nada: "merah", teks: `SK KGB ${tmt} sudah ditandatangani dan diunggah. Usulan yang mengubah dasar gaji tidak dapat disetujui lagi: kembalikan usulan ini, atau batalkan KGB-nya lebih dulu.` }
      : { nada: "navy", teks: `SK KGB ${tmt} sudah diunggah. Perubahan ini hanya memperbarui data pegawai; SK-nya tidak berubah.` };
  if (k.status === "sedang_diproses")
    return {
      nada: "amber",
      teks: `KGB ${tmt} sedang diproses dan tertahan sampai usulan ini ditinjau. Bila disetujui, ${
        menyentuhGaji ? "hitungannya diperbarui dari data baru" : "data pegawainya diperbarui"
      }${k.skDibuat ? ", dan SK yang sudah dibuat harus dibuat ulang dengan nomor yang sama" : ""}.`,
    };
  return {
    nada: "amber",
    teks: `KGB ${tmt} belum diinput dan tertahan sampai usulan ini ditinjau. Bila disetujui, jadwalnya ${menyentuhGaji ? "diselaraskan dengan" : "memakai"} data baru.`,
  };
}

export default function DetailUsulan({ usulan: u, pratinjauDiTempat = false }: { usulan: UsulanKanwil; pratinjauDiTempat?: boolean }) {
  const [berkasTerbuka, setBerkasTerbuka] = useState<string | null>(null);
  const dampak = dampakKgb(u);
  const urlBerkas = (medan: string) => `/api/usulan/${encodeURIComponent(u.id)}/berkas?berkas=${medan}`;
  const berkasAktif = u.berkas.find((b) => b.medan === berkasTerbuka) ?? null;

  return (
    <div className="usl-detail">
      {u.nipTercatat?.satkerSama ? (
        <Catatan nada="amber">
          UPT mengirim ini sebagai usulan pegawai baru, tetapi NIP {u.nip} sudah tercatat atas nama {u.nipTercatat.nama}.
          Menyetujuinya menerapkan usulan ini sebagai perbaikan data pegawai tersebut, bukan menambah pegawai baru;
          {u.perubahan.length > 0
            ? " yang berubah hanya kolom di bawah."
            : " isiannya sama dengan data tercatat, jadi tidak ada data yang berubah."}
        </Catatan>
      ) : u.nipTercatat ? (
        <Catatan nada="merah">
          NIP {u.nip} sudah tercatat atas nama {u.nipTercatat.nama} di {u.nipTercatat.unitKerja || "satker lain"}. Usulan
          pegawai baru ini tidak dapat disetujui: kembalikan ke UPT agar dihapus. Pemindahan antarsatker dicatat Kanwil.
        </Catatan>
      ) : u.jenis === "baru" && (
        <Catatan nada="hijau">
          Pegawai ini belum tercatat di SIM-KGB. Menyetujui usulan menambahkannya ke data induk beserta jadwal KGB-nya;
          periksa NIP, golongan, masa kerja golongan, dan TMT terhadap berkasnya.
        </Catatan>
      )}

      {dampak && <Catatan nada={dampak.nada}>{dampak.teks}</Catatan>}

      {u.perubahan.length > 0 ? (
        <section className="usl-bagian" aria-label="Perubahan yang diusulkan">
          <p className="usl-bagian-judul">Perubahan yang diusulkan <span>{u.perubahan.length}</span></p>
          <ul className="usl-beda">
            {u.perubahan.map((p) => (
              <li key={p.kunci} data-gaji={KOLOM_DASAR_GAJI.has(p.kunci) ? "" : undefined}>
                <span className="usl-beda-label">
                  {p.label}
                  {KOLOM_DASAR_GAJI.has(p.kunci) && <span className="usl-chip">dasar gaji</span>}
                </span>
                <span className="usl-beda-lama">{p.sekarang}</span>
                <span className="usl-beda-panah" aria-label="menjadi">→</span>
                <span className="usl-beda-baru">{p.diusulkan}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : u.nilaiDiusulkan.length > 0 ? (
        <section className="usl-bagian" aria-label="Data yang diusulkan">
          <p className="usl-bagian-judul">{u.jenis === "baru" ? "Data pegawai baru" : "Nilai yang diusulkan"}</p>
          <dl className="usl-nilai">
            {u.nilaiDiusulkan.map((n) => (
              <div key={n.kunci}>
                <dt>{n.label}</dt>
                <dd>{n.nilai}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : u.nipTercatat?.satkerSama ? null : (
        // Pegawai baru yang sudah tercatat dengan isian yang sama sudah dijelaskan catatan di atas (ADR-091).
        <Catatan>Tidak ada kolom data yang diusulkan berubah; usulan ini berisi laporan atau lampiran saja.</Catatan>
      )}

      {/* SK kenaikan pangkat atau PMK yang disebut UPT; persetujuan membentuk riwayatnya (ADR-030). */}
      {u.dasarBaru && (
        <div className="usl-sk-baru">
          <strong>SK yang mengubah gaji pokok</strong>
          <span>{u.dasarBaru}</span>
          <span>
            {u.dasarBaru.startsWith("Koreksi")
              ? "Tidak ada SK baru; dasar SK KGB berikutnya tidak berubah, dan pembetulannya tercatat di Log Aktivitas."
              : "Persetujuan mencatatnya sebagai riwayat, menghitung ulang gaji pokoknya, dan menjadikan SK ini dasar SK KGB berikutnya."}
          </span>
          {u.catatanSkBaru && <span>{u.catatanSkBaru}</span>}
        </div>
      )}

      {u.hukdis && (
        <Catatan nada="merah">
          Laporan hukuman disiplin: {u.hukdis}
          {u.hukdisKeterangan ? `. ${u.hukdisKeterangan}` : ""}. Persetujuan tidak mencatat hukumannya; catat di modul
          Hukuman Disiplin agar penundaan KGB-nya berlaku.
        </Catatan>
      )}
      {(u.nomorSkTerakhir || u.tanggalSkTerakhir) && (
        <p className="usl-baris-info">
          <span>SK dasar dari UPT</span>
          {u.nomorSkTerakhir ?? "-"}
          {u.tanggalSkTerakhir ? `, ${tgl(u.tanggalSkTerakhir)}` : ""}
          {u.penetapSkTerakhir ? `, oleh ${u.penetapSkTerakhir}` : ""}
        </p>
      )}
      {u.catatanUpt && <blockquote className="usl-kutipan">{u.catatanUpt}</blockquote>}
      {u.alasanTolak && (
        <Catatan nada="amber">
          {u.status === "revisi" ? "Dikembalikan untuk diperbaiki: " : "Catatan peninjau: "}
          {u.alasanTolak}
        </Catatan>
      )}

      {u.berkas.length > 0 && (
        <section className="usl-bagian" aria-label="Berkas pendukung">
          <p className="usl-bagian-judul">Berkas pendukung <span>{u.berkas.length}</span></p>
          <div className="usl-berkas">
            {u.berkas.map((b) =>
              pratinjauDiTempat ? (
                <button
                  key={b.medan}
                  type="button"
                  className="usl-berkas-tombol"
                  aria-pressed={berkasTerbuka === b.medan}
                  title={b.nama ?? undefined}
                  onClick={() => setBerkasTerbuka(berkasTerbuka === b.medan ? null : b.medan)}
                >
                  {b.label}
                </button>
              ) : (
                <a key={b.medan} className="usl-berkas-tombol" href={urlBerkas(b.medan)} target="_blank" rel="noopener noreferrer" title={b.nama ?? undefined}>
                  {b.label} ↗
                </a>
              ),
            )}
          </div>
          {pratinjauDiTempat && berkasAktif && (
            <div className="usl-pratinjau">
              <iframe src={urlBerkas(berkasAktif.medan)} title={`Pratinjau ${berkasAktif.label}`} />
              <a href={urlBerkas(berkasAktif.medan)} target="_blank" rel="noopener noreferrer" className="dsb-tautan">
                Buka {berkasAktif.label} di tab baru →
              </a>
            </div>
          )}
        </section>
      )}

      <p className="usl-meta">
        Diajukan {u.diajukanOleh ?? "UPT"} · {tgl(u.diajukanAt)}
        {u.nomorSurat ? ` · surat ${u.nomorSurat}${u.tanggalSurat ? ` (${tgl(u.tanggalSurat)})` : ""}` : ""}
        {u.ditinjauAt ? ` · ditinjau ${u.ditinjauOleh ?? ""} ${tgl(u.ditinjauAt)}` : ""}
      </p>
    </div>
  );
}
