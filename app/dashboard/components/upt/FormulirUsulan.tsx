"use client";

import { useMemo, useState } from "react";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import KolomBerkas from "./KolomBerkas";
import { BERKAS_USULAN, berkasWajib, hitungUsulan, type WajibBerkas } from "@/lib/usulanPegawai";
import { BIDANG_DIISI } from "@/lib/usulanFormulir";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR, denganNilaiSaatIni } from "@/lib/pilihanPegawai";
import { formatTanggalId } from "@/lib/waktu";

/* Formulir data pegawai UPT: dipakai untuk menyiapkan pegawai baru maupun mengusulkan perbaikan data
   pegawai yang sudah tercatat. Isiannya selalu disimpan sebagai draf lebih dulu; pengirimannya ke
   Kanwil dilakukan terpisah, sekali untuk satu surat usulan yang biasanya memuat beberapa pegawai.

   Gaji pokok, pangkat, dan TMT KGB berikutnya tidak diketik operator melainkan dihitung dari golongan,
   masa kerja golongan, dan TMT KGB terakhir. Ketiganya menentukan uang, dan salah ketik di situ berbuah
   kekurangan rapelan atau kelebihan yang harus dikembalikan ke kas negara. */

export interface DrafUsulanUpt {
  id: string;
  jenis: string;
  nama: string;
  nip: string;
  /** "draf" untuk yang belum pernah dikirim, "revisi" untuk yang dikembalikan Kanwil. */
  status?: string;
  /** Catatan peninjau Kanwil pada usulan yang dikembalikan; kolomnya dipakai bersama alasan penolakan lama. */
  alasanTolak?: string | null;
  nilai: Record<string, string> | null;
  surat: { nomorSurat: string; tanggalSurat: string; nomorSkTerakhir: string; tanggalSkTerakhir: string; catatanUpt: string } | null;
  hukdis: { ada: boolean; jenis: string; nomorSk: string; tmtMulai: string; tmtBerakhir: string; keterangan: string } | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
}

export interface PegawaiUntukUsulan {
  id: string;
  nama: string;
  nip: string;
  dataSekarang: Record<string, string>;
}

/**
 * Berkas milik tiap pegawai. Surat usulan Srikandi tidak termasuk: satu surat memuat banyak pegawai,
 * jadi suratnya diunggah sekali pada langkah Ajukan dan dipasang ke semua pegawai pada surat itu.
 */
const BERKAS_PEGAWAI = BERKAS_USULAN.filter((b) => b.wajibUntuk !== "saat_mengajukan");

const HUKDIS_KOSONG = { ada: false, jenis: "", nomorSk: "", tmtMulai: "", tmtBerakhir: "", keterangan: "" };
const SK_KOSONG = { nomorSkTerakhir: "", tanggalSkTerakhir: "", catatanUpt: "" };

/** Isian identitas; sisanya dikelompokkan sendiri karena punya pemandu. */
const BIDANG_IDENTITAS = new Set(["nama", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir"]);

/**
 * Isian yang nilainya terbatas, ditawarkan sebagai pilihan agar seragam dengan data Kanwil. Mengetik
 * bebas membuat "Non Eselon", "non eselon", dan "Eselon IV" hidup berdampingan pada kolom yang sama.
 */
const PILIHAN_BIDANG: Record<string, readonly string[]> = {
  jenisKelamin: JENIS_KELAMIN,
  pendidikanTerakhir: PENDIDIKAN_TERAKHIR,
  jenisJabatan: JENIS_JABATAN,
  eselon: ESELON,
};

/**
 * Kalimat singkat tentang kewajiban satu berkas bagi pegawai yang sedang didata. Disebutkan juga
 * ketika tidak wajib: operator yang melihat kolom kosong tanpa keterangan cenderung mengisinya dengan
 * dokumen apa saja yang ada di tangan, dan SK yang salah kolom lebih sulit ditemukan daripada kolom
 * yang memang kosong.
 */
function catatanWajib(wajibUntuk: WajibBerkas, wajib: boolean): string {
  if (wajib) return "Wajib untuk keadaan pegawai ini.";
  if (wajibUntuk === "pernah_naik_pangkat") return "Lampirkan hanya bila pegawai pernah naik pangkat.";
  if (wajibUntuk === "sudah_pns") return "Lampirkan bila pegawai sudah diangkat PNS.";
  return "Tidak wajib untuk keadaan pegawai ini.";
}

/** Isian pilihan; nilai lama yang di luar daftar tetap ditampilkan agar tidak hilang saat disimpan. */
function IsianPilihan({
  label,
  daftar,
  nilai,
  onUbah,
}: {
  label: string;
  daftar: readonly string[];
  nilai: string;
  onUbah: (nilai: string) => void;
}) {
  return (
    <label className="kgbm-label">
      {label}
      <select className="kgbm-input" value={nilai} onChange={(e) => onUbah(e.target.value)}>
        <option value="">Belum diisi</option>
        {denganNilaiSaatIni(daftar, nilai).map((pilihan) => (
          <option key={pilihan} value={pilihan}>{pilihan}</option>
        ))}
      </select>
    </label>
  );
}

/** Isian tanggal dengan tombol pengosong: isian date yang terisi tidak dapat dikosongkan dari ponsel. */
export function IsianTanggal({
  label,
  nilai,
  onUbah,
  wajib = false,
  bantuan,
}: {
  label: string;
  nilai: string;
  onUbah: (nilai: string) => void;
  wajib?: boolean;
  bantuan?: string;
}) {
  return (
    <label className="kgbm-label">
      {wajib ? <span className="kgbm-wajib">{label}</span> : label}
      <input className="kgbm-input" type="date" value={nilai} onChange={(e) => onUbah(e.target.value)} />
      {bantuan && <span className="kgbm-bantuan">{bantuan}</span>}
      {nilai && (
        <button type="button" className="kgbm-kosongkan" onClick={() => onUbah("")}>
          Kosongkan
        </button>
      )}
    </label>
  );
}

export default function FormulirUsulan({
  jenis,
  pegawai,
  draf,
  onTutup,
  onSelesai,
}: {
  jenis: "perubahan" | "baru";
  pegawai: PegawaiUntukUsulan | null;
  draf: DrafUsulanUpt | null;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const tersimpan: Record<string, string> = draf?.nilai ?? pegawai?.dataSekarang ?? {};
  // Pegawai yang belum pernah KGB memakai TMT CPNS sebagai awal hitungan, dan TMT golongan pertamanya
  // adalah tanggal yang sama. Isian yang masih kosong diisikan dari sana daripada dibiarkan menebak;
  // operator tetap dapat menggantinya bila SK-nya berkata lain.
  const awal: Record<string, string> = {
    ...tersimpan,
    tmtKgbTerakhir: tersimpan.tmtKgbTerakhir || tersimpan.tmtGolongan || "",
  };
  const [isian, setIsian] = useState<Record<string, string>>({ ...awal });
  const [nip, setNip] = useState(draf?.nip && draf.nip !== "-" ? draf.nip : "");
  const [sk, setSk] = useState({
    nomorSkTerakhir: draf?.surat?.nomorSkTerakhir ?? "",
    tanggalSkTerakhir: draf?.surat?.tanggalSkTerakhir ?? "",
    catatanUpt: draf?.surat?.catatanUpt ?? "",
  });
  const [hukdis, setHukdis] = useState(draf?.hukdis ?? HUKDIS_KOSONG);
  const [berkas, setBerkas] = useState<Record<string, File | null>>({});
  // Berkas tersimpan yang ditandai operator untuk dihapus; dihapus server saat data disimpan.
  const [hapusTersimpan, setHapusTersimpan] = useState<Set<string>>(() => new Set());
  // Pegawai yang belum pernah KGB mengisi TMT CPNS dan masa kerja 0; yang sudah pernah menyalin SK KGB
  // terakhirnya. Pemisahan ini yang menghilangkan tebak-tebakan pada dua isian tersulit.
  const [pernahKgb, setPernahKgb] = useState(() => {
    const tahun = Number(awal.mkgTahun ?? 0);
    const bulan = Number(awal.mkgBulan ?? 0);
    return tahun > 0 || bulan > 0;
  });
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  /** Berkas tersimpan yang sedang dibuka, agar operator dapat memastikan yang diunggah memang benar. */
  const [pratinjau, setPratinjau] = useState<{ judul: string; url: string; lokal: boolean } | null>(null);

  const ubah = (kunci: string, nilai: string) => setIsian((f) => ({ ...f, [kunci]: nilai }));
  /** Usulan yang dilempar kembali Kanwil; isinya utuh, yang berubah hanya kalimat pemandunya. */
  const dikembalikan = draf?.status === "revisi";

  /**
   * Isian identitas yang wajib, dan hanya pada pegawai baru. Pada usulan perbaikan, isian yang
   * dikosongkan berarti "tidak diusulkan berubah", jadi menandainya wajib justru menyesatkan: yang
   * benar-benar wajib di situ hanya yang menentukan uang, yaitu golongan dan hitungan KGB-nya.
   */
  const wajibIdentitas = (kunci: string) => jenis === "baru" && (kunci === "nama" || kunci === "jabatan");
  const label = (kunci: string, teks: string) =>
    wajibIdentitas(kunci) ? <span className="kgbm-wajib">{teks}</span> : teks;

  const hitung = useMemo(
    () => hitungUsulan({
      golonganRuang: isian.golonganRuang ?? "",
      mkgTahun: isian.mkgTahun ?? "0",
      mkgBulan: isian.mkgBulan ?? "0",
      tmtKgbTerakhir: isian.tmtKgbTerakhir || null,
    }),
    [isian.golonganRuang, isian.mkgTahun, isian.mkgBulan, isian.tmtKgbTerakhir],
  );

  function tandaiHapus(medan: string, hapus: boolean) {
    setHapusTersimpan((lama) => {
      const baru = new Set(lama);
      if (hapus) baru.add(medan);
      else baru.delete(medan);
      return baru;
    });
  }

  // Berkas yang baru dipilih hanya ada di peramban sampai data disimpan; menutup formulir tanpa
  // menyimpan membuangnya, jadi ditanyakan dulu agar tidak hilang tanpa disadari.
  const adaBerkasBelumDisimpan = Object.values(berkas).some(Boolean) || hapusTersimpan.size > 0;
  function tutup() {
    if (
      adaBerkasBelumDisimpan &&
      !window.confirm("Ada berkas yang belum disimpan. Bila formulir ditutup sekarang, berkas itu tidak ikut tersimpan. Tutup tanpa menyimpan?")
    )
      return;
    onTutup();
  }

  function tutupPratinjau() {
    // Blob URL berkas yang baru dipilih dicabut agar memorinya dilepas.
    if (pratinjau?.lokal) URL.revokeObjectURL(pratinjau.url);
    setPratinjau(null);
  }

  async function simpan() {
    setMengirim(true);
    setGalat(null);
    try {
      const form = new FormData();
      form.set("status", "draf");
      form.set("jenis", jenis);
      if (pegawai) form.set("pegawaiId", pegawai.id);
      if (jenis === "baru") form.set("nip", nip);
      for (const bidang of BIDANG_DIISI) form.set(bidang.kunci, isian[bidang.kunci] ?? "");
      form.set("nomorSkTerakhir", sk.nomorSkTerakhir);
      form.set("tanggalSkTerakhir", sk.tanggalSkTerakhir);
      form.set("catatanUpt", sk.catatanUpt);
      form.set("hukdisAda", String(hukdis.ada));
      if (hukdis.ada) {
        form.set("hukdisJenis", hukdis.jenis);
        form.set("hukdisNomorSk", hukdis.nomorSk);
        form.set("hukdisTmtMulai", hukdis.tmtMulai);
        form.set("hukdisTmtBerakhir", hukdis.tmtBerakhir);
        form.set("hukdisKeterangan", hukdis.keterangan);
      }
      for (const b of BERKAS_PEGAWAI) {
        const isi = berkas[b.medan];
        if (isi) form.set(b.medan, isi);
        else if (draf && hapusTersimpan.has(b.medan)) form.append("hapusBerkas", b.medan);
      }

      const res = draf
        ? await fetch(`/api/upt/usulan/${draf.id}`, { method: "PATCH", body: form })
        : await fetch("/api/upt/usulan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Data gagal disimpan");
        return;
      }
      const nama = isian.nama || pegawai?.nama || "pegawai";
      onSelesai(
        dikembalikan
          ? `Perbaikan data ${nama} tersimpan. Kirim ulang ke Kanwil dari panel Data disiapkan.`
          : draf
            ? `Draf data ${nama} diperbarui. Ajukan ke Kanwil bila sudah lengkap.`
            : `Data ${nama} tersimpan sebagai draf. Lengkapi kapan saja, lalu ajukan bersama pegawai lain dalam satu surat.`,
      );
    } catch {
      setGalat("Data gagal disimpan");
    } finally {
      setMengirim(false);
    }
  }

  const judul = dikembalikan
    ? "Perbaiki usulan yang dikembalikan"
    : jenis === "baru"
      ? (draf ? "Lanjutkan data pegawai baru" : "Tambah data pegawai")
      : (draf ? "Lanjutkan usulan perbaikan data" : "Usulkan perbaikan data pegawai");

  return (
    <KerangkaModal
      judul={judul}
      subjudul={
        pegawai
          ? `${pegawai.nama} · ${pegawai.nip}`
          : "Pegawai yang belum tercatat di SIM-KGB, misalnya CPNS yang baru dilantik"
      }
      ukuran="lg"
      sibuk={mengirim}
      onTutup={tutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutup} disabled={mengirim}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={mengirim}>
            {mengirim ? "Menyimpan…" : dikembalikan ? "Simpan perbaikan" : draf ? "Simpan perubahan" : "Simpan data"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      {dikembalikan && (
        <Catatan nada="amber">
          Kanwil mengembalikan usulan ini untuk diperbaiki: {draf?.alasanTolak ?? "tanpa catatan"}. Betulkan yang
          disebut lalu simpan; usulannya belum kembali ke Kanwil sampai dikirim ulang dari panel Data disiapkan.
        </Catatan>
      )}
      <Catatan>
        {jenis === "baru"
          ? "Data disimpan dulu sebagai daftar milik satker, belum dikirim ke Kanwil. Setelah semua pegawai yang akan diusulkan lengkap, kirimkan sekaligus dengan satu surat usulan."
          : "Isian sudah diisi dengan data yang tercatat di Kanwil. Ubah yang perlu diperbaiki saja; yang dikosongkan berarti tidak diusulkan berubah. Perubahan berlaku setelah ditinjau dan disetujui Kanwil."}
      </Catatan>
      <p className="kgbm-legenda">
        Isian dan berkas bertanda <i>*</i> wajib. Daftarnya berubah menurut keadaan pegawai:{" "}
        <b>{pernahKgb ? "sudah pernah KGB" : "belum pernah KGB"}</b>
        {pernahKgb
          ? " menuntut TMT KGB terakhir, masa kerja golongan yang disalin dari SK KGB itu, dan lampiran SK KGB terakhirnya."
          : " menuntut TMT CPNS, masa kerja golongan 0 tahun 0 bulan, serta nomor, tanggal, dan lampiran SK CPNS sebagai acuan pertama; SK KGB terakhir justru dikosongkan."}{" "}
        Pilihannya diatur pada bagian Pangkat, gaji pokok, dan KGB di bawah.
      </p>

      {/* ── Identitas ─────────────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Identitas</p>
          <p className="kgbm-bagian-ket">Sesuai SK pengangkatan</p>
        </div>
        <div className="kgbm-bagian-isi">
          {jenis === "baru" && (
            <label className="kgbm-label">
              <span className="kgbm-wajib">NIP (18 digit)</span>
              <input
                className="kgbm-input"
                data-autofocus
                inputMode="numeric"
                value={nip}
                onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 18))}
                placeholder="198809042025062014"
              />
              <span className="kgbm-bantuan">
                Delapan angka pertama tanggal lahir, enam berikutnya TMT CPNS. NIP dipakai sebagai penanda
                data ini, jadi tidak dapat diubah setelah disimpan.
              </span>
            </label>
          )}
          <div className="kgbm-grid2">
            {BIDANG_DIISI.filter((b) => BIDANG_IDENTITAS.has(b.kunci)).map((bidang) =>
              bidang.jenis === "tanggal" ? (
                <IsianTanggal
                  key={bidang.kunci}
                  label={bidang.label}
                  nilai={isian[bidang.kunci] ?? ""}
                  onUbah={(v) => ubah(bidang.kunci, v)}
                />
              ) : PILIHAN_BIDANG[bidang.kunci] ? (
                <IsianPilihan
                  key={bidang.kunci}
                  label={bidang.label}
                  daftar={PILIHAN_BIDANG[bidang.kunci]}
                  nilai={isian[bidang.kunci] ?? ""}
                  onUbah={(v) => ubah(bidang.kunci, v)}
                />
              ) : (
                <label className="kgbm-label" key={bidang.kunci}>
                  {label(bidang.kunci, bidang.label)}
                  <input
                    className="kgbm-input"
                    value={isian[bidang.kunci] ?? ""}
                    onChange={(e) => ubah(bidang.kunci, e.target.value)}
                  />
                </label>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── Jabatan ───────────────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Jabatan</p>
        </div>
        <div className="kgbm-bagian-isi">
          <div className="kgbm-grid2">
            {BIDANG_DIISI.filter((b) => ["jabatan", "jenisJabatan", "eselon"].includes(b.kunci)).map((bidang) =>
              PILIHAN_BIDANG[bidang.kunci] ? (
                <IsianPilihan
                  key={bidang.kunci}
                  label={bidang.label}
                  daftar={PILIHAN_BIDANG[bidang.kunci]}
                  nilai={isian[bidang.kunci] ?? ""}
                  onUbah={(v) => ubah(bidang.kunci, v)}
                />
              ) : (
                <label className="kgbm-label" key={bidang.kunci}>
                  {label(bidang.kunci, bidang.label)}
                  <input
                    className="kgbm-input"
                    value={isian[bidang.kunci] ?? ""}
                    onChange={(e) => ubah(bidang.kunci, e.target.value)}
                    placeholder="Penjaga Tahanan, Analis Kepegawaian, dan sebagainya"
                  />
                </label>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── Pangkat, gaji, dan KGB: bagian yang paling mudah keliru ───── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Pangkat, gaji pokok, dan KGB</p>
          <p className="kgbm-bagian-ket">Salin dari SK yang menjadi dasar gaji pokok sekarang</p>
        </div>
        <div className="kgbm-bagian-isi">
          <div className="kgbm-grid2">
            <label className="kgbm-label">
              <span className="kgbm-wajib">Golongan/ruang</span>
              <select
                className="kgbm-input"
                value={isian.golonganRuang ?? ""}
                onChange={(e) => ubah("golonganRuang", e.target.value)}
              >
                <option value="">Pilih golongan</option>
                {Object.entries(GOLONGAN_PANGKAT).map(([golongan, pangkat]) => (
                  <option key={golongan} value={golongan}>{golongan} · {pangkat}</option>
                ))}
              </select>
            </label>
            <IsianTanggal
              label="TMT golongan"
              nilai={isian.tmtGolongan ?? ""}
              onUbah={(v) => ubah("tmtGolongan", v)}
              bantuan="Tanggal berlakunya golongan sekarang, dari SK kenaikan pangkat atau SK pengangkatan."
            />
          </div>

          <div className="kgbm-pilihan" role="radiogroup" aria-label="Keadaan KGB pegawai">
            <button
              type="button"
              role="radio"
              aria-checked={!pernahKgb}
              onClick={() => { setPernahKgb(false); ubah("mkgTahun", "0"); ubah("mkgBulan", "0"); }}
            >
              Belum pernah KGB
            </button>
            <button type="button" role="radio" aria-checked={pernahKgb} onClick={() => setPernahKgb(true)}>
              Sudah pernah KGB
            </button>
          </div>

          {pernahKgb ? (
            <>
              <div className="kgbm-grid2">
                <IsianTanggal
                  label="TMT KGB terakhir"
                  wajib
                  nilai={isian.tmtKgbTerakhir ?? ""}
                  onUbah={(v) => ubah("tmtKgbTerakhir", v)}
                  bantuan="TMT pada SK KGB terakhir. Baru naik pangkat? Tanggal ini tetap dari siklus KGB sebelumnya, sebab kenaikan pangkat tidak mengulang hitungan KGB."
                />
                <div className="kgbm-grid2">
                  <label className="kgbm-label">
                    <span className="kgbm-wajib">Masa kerja (tahun)</span>
                    <input
                      className="kgbm-input"
                      inputMode="numeric"
                      value={isian.mkgTahun ?? ""}
                      onChange={(e) => ubah("mkgTahun", e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <label className="kgbm-label">
                    Masa kerja (bulan)
                    <input
                      className="kgbm-input"
                      inputMode="numeric"
                      value={isian.mkgBulan ?? ""}
                      onChange={(e) => ubah("mkgBulan", e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                </div>
              </div>
              <p className="kgbm-bantuan">
                Masa kerja golongan disalin dari SK KGB terakhir, bukan dihitung sendiri dari lama bekerja.
              </p>
            </>
          ) : (
            <>
              <div className="kgbm-grid2">
                <IsianTanggal
                  label="TMT CPNS"
                  wajib
                  nilai={isian.tmtKgbTerakhir ?? ""}
                  onUbah={(v) => { ubah("tmtKgbTerakhir", v); if (!isian.tmtGolongan) ubah("tmtGolongan", v); }}
                  bantuan="Dari SK pengangkatan CPNS. Inilah tanggal awal hitungan KGB pertama, dan bagi CPNS sama dengan TMT golongan."
                />
              </div>
              <Catatan nada="amber">
                Masa kerja golongan diisi 0 tahun 0 bulan. Bila SK pengangkatan PNS terbit terlambat, SK itu
                biasanya sudah memuat KGB yang belum dibayarkan. Jangan menyalin masa kerja dan gaji pokok
                dari sana, sebab KGB beserta rapelannya justru yang sedang diusulkan.
              </Catatan>
            </>
          )}

          <div className="kgbm-hitungan">
            <p className="kgbm-hitungan-judul">Dihitung sistem</p>
            <dl>
              <div><dt>Pangkat</dt><dd>{hitung.pangkat || "-"}</dd></div>
              <div>
                <dt>Gaji pokok</dt>
                <dd>{hitung.gajiPokok > 0 ? "Rp" + new Intl.NumberFormat("id-ID").format(hitung.gajiPokok) : "-"}</dd>
              </div>
              <div>
                <dt>TMT KGB berikutnya</dt>
                <dd>{hitung.tmtKgbBerikutnya ? formatTanggalId(hitung.tmtKgbBerikutnya) : "-"}</dd>
              </div>
            </dl>
            {hitung.penjelasan && <p className="kgbm-hitungan-ket">{hitung.penjelasan}</p>}
            {hitung.peringatan.map((pesan) => (
              <p className="kgbm-hitungan-ingat" key={pesan}>{pesan}</p>
            ))}
          </div>

          <div className="kgbm-grid2">
            <label className="kgbm-label">
              {pernahKgb ? "Nomor SK dasar gaji pokok" : "Nomor SK CPNS"}
              <input
                className="kgbm-input"
                value={sk.nomorSkTerakhir}
                onChange={(e) => setSk((f) => ({ ...f, nomorSkTerakhir: e.target.value }))}
              />
              <span className="kgbm-bantuan">
                {pernahKgb
                  ? "Nomor SK KGB terakhir, atau SK kenaikan pangkat bila itu yang terakhir."
                  : "Bagi pegawai yang belum pernah KGB, SK CPNS inilah SK dasar yang tercetak pada surat KGB pertamanya."}
              </span>
            </label>
            <IsianTanggal
              label={pernahKgb ? "Tanggal SK" : "Tanggal SK CPNS"}
              nilai={sk.tanggalSkTerakhir}
              onUbah={(v) => setSk((f) => ({ ...f, tanggalSkTerakhir: v }))}
            />
          </div>
        </div>
      </div>

      {/* ── Hukuman disiplin ──────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Hukuman disiplin</p>
          <p className="kgbm-bagian-ket">Hanya laporan; penetapannya tetap dicatat Kanwil di modul Hukuman Disiplin</p>
        </div>
        <div className="kgbm-bagian-isi">
          <label className="kgbm-label" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              className="dsb-cek"
              checked={hukdis.ada}
              onChange={(e) => setHukdis((f) => ({ ...f, ada: e.target.checked }))}
            />
            Pegawai ini sedang atau pernah menjalani hukuman disiplin yang belum dilaporkan
          </label>
          {hukdis.ada && (
            <>
              <div className="kgbm-grid2">
                <label className="kgbm-label">
                  Jenis hukuman
                  <input
                    className="kgbm-input"
                    value={hukdis.jenis}
                    onChange={(e) => setHukdis((f) => ({ ...f, jenis: e.target.value }))}
                    placeholder="Penundaan kenaikan gaji berkala"
                  />
                </label>
                <label className="kgbm-label">
                  Nomor SK hukuman
                  <input
                    className="kgbm-input"
                    value={hukdis.nomorSk}
                    onChange={(e) => setHukdis((f) => ({ ...f, nomorSk: e.target.value }))}
                  />
                </label>
                <IsianTanggal label="TMT mulai" nilai={hukdis.tmtMulai} onUbah={(v) => setHukdis((f) => ({ ...f, tmtMulai: v }))} />
                <IsianTanggal label="TMT berakhir" nilai={hukdis.tmtBerakhir} onUbah={(v) => setHukdis((f) => ({ ...f, tmtBerakhir: v }))} />
              </div>
              <label className="kgbm-label">
                Keterangan
                <textarea
                  className="kgbm-input"
                  rows={2}
                  value={hukdis.keterangan}
                  onChange={(e) => setHukdis((f) => ({ ...f, keterangan: e.target.value }))}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* ── Berkas ────────────────────────────────────────────────────── */}
      <div className="kgbm-bagian" style={{ flexShrink: 0 }}>
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Berkas pendukung</p>
          <p className="kgbm-bagian-ket">Pindai sebagai dokumen, bukan foto: tiap berkas paling besar 1 MB</p>
        </div>
        <div className="kgbm-bagian-isi">
          {BERKAS_PEGAWAI.map((b) => {
            const wajib = berkasWajib(b.wajibUntuk, pernahKgb);
            const simpanan = draf?.berkas.find((x) => x.medan === b.medan) ?? null;
            return (
              <KolomBerkas
                key={b.medan}
                label={b.label}
                wajib={wajib}
                bantuan={`${b.keterangan} ${catatanWajib(b.wajibUntuk, wajib)}`.trim()}
                dipilih={berkas[b.medan] ?? null}
                urlTersimpan={draf && simpanan ? `/api/usulan/${draf.id}/berkas?berkas=${b.medan}` : null}
                namaTersimpan={simpanan?.nama ?? null}
                ditandaiHapus={hapusTersimpan.has(b.medan)}
                onPilih={(f) => {
                  setBerkas((lama) => ({ ...lama, [b.medan]: f }));
                  // Berkas pengganti menggantikan yang tersimpan; tanda hapusnya tidak diperlukan lagi.
                  if (f) tandaiHapus(b.medan, false);
                }}
                onHapusTersimpan={() => tandaiHapus(b.medan, true)}
                onBatalHapus={() => tandaiHapus(b.medan, false)}
                onPratinjau={(judul, url, lokal) => setPratinjau({ judul, url, lokal })}
              />
            );
          })}
          <label className="kgbm-label">
            Catatan untuk Kanwil
            <textarea
              className="kgbm-input"
              rows={2}
              value={sk.catatanUpt}
              onChange={(e) => setSk((f) => ({ ...f, catatanUpt: e.target.value }))}
            />
          </label>
        </div>
      </div>
      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={`${isian.nama || pegawai?.nama || "Pegawai"} · berkas tersimpan`}
          url={pratinjau.url}
          onTutup={tutupPratinjau}
        />
      )}
    </KerangkaModal>
  );
}

export { SK_KOSONG };
