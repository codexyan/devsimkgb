"use client";

import { useMemo, useState } from "react";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { BERKAS_USULAN, hitungUsulan } from "@/lib/usulanPegawai";
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
  nilai: Record<string, string> | null;
  surat: { nomorSurat: string; tanggalSurat: string; nomorSkTerakhir: string; tanggalSkTerakhir: string; catatanUpt: string } | null;
  hukdis: { ada: boolean; jenis: string; nomorSk: string; tmtMulai: string; tmtBerakhir: string; keterangan: string } | null;
  berkas: string[];
}

export interface PegawaiUntukUsulan {
  id: string;
  nama: string;
  nip: string;
  dataSekarang: Record<string, string>;
}

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
  const [ulangBerkas, setUlangBerkas] = useState<Record<string, number>>({});
  // Pegawai yang belum pernah KGB mengisi TMT CPNS dan masa kerja 0; yang sudah pernah menyalin SK KGB
  // terakhirnya. Pemisahan ini yang menghilangkan tebak-tebakan pada dua isian tersulit.
  const [pernahKgb, setPernahKgb] = useState(() => {
    const tahun = Number(awal.mkgTahun ?? 0);
    const bulan = Number(awal.mkgBulan ?? 0);
    return tahun > 0 || bulan > 0;
  });
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const ubah = (kunci: string, nilai: string) => setIsian((f) => ({ ...f, [kunci]: nilai }));

  const hitung = useMemo(
    () => hitungUsulan({
      golonganRuang: isian.golonganRuang ?? "",
      mkgTahun: isian.mkgTahun ?? "0",
      mkgBulan: isian.mkgBulan ?? "0",
      tmtKgbTerakhir: isian.tmtKgbTerakhir || null,
    }),
    [isian.golonganRuang, isian.mkgTahun, isian.mkgBulan, isian.tmtKgbTerakhir],
  );

  function hapusBerkas(medan: string) {
    setBerkas((f) => ({ ...f, [medan]: null }));
    setUlangBerkas((u) => ({ ...u, [medan]: (u[medan] ?? 0) + 1 }));
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
      for (const b of BERKAS_USULAN) {
        const isi = berkas[b.medan];
        if (isi) form.set(b.medan, isi);
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
        draf
          ? `Draf data ${nama} diperbarui. Ajukan ke Kanwil bila sudah lengkap.`
          : `Data ${nama} tersimpan sebagai draf. Lengkapi kapan saja, lalu ajukan bersama pegawai lain dalam satu surat.`,
      );
    } catch {
      setGalat("Data gagal disimpan");
    } finally {
      setMengirim(false);
    }
  }

  const judul = jenis === "baru"
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
      onTutup={onTutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={mengirim}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={mengirim}>
            {mengirim ? "Menyimpan…" : draf ? "Simpan perubahan" : "Simpan data"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan>
        {jenis === "baru"
          ? "Data disimpan dulu sebagai daftar milik satker, belum dikirim ke Kanwil. Setelah semua pegawai yang akan diusulkan lengkap, kirimkan sekaligus dengan satu surat usulan."
          : "Isian sudah diisi dengan data yang tercatat di Kanwil. Ubah yang perlu diperbaiki saja; yang dikosongkan berarti tidak diusulkan berubah. Perubahan berlaku setelah ditinjau dan disetujui Kanwil."}
      </Catatan>

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
                  {bidang.label}
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
                  {bidang.label}
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
              Nomor SK dasar gaji pokok
              <input
                className="kgbm-input"
                value={sk.nomorSkTerakhir}
                onChange={(e) => setSk((f) => ({ ...f, nomorSkTerakhir: e.target.value }))}
              />
            </label>
            <IsianTanggal
              label="Tanggal SK"
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
          {draf && draf.berkas.length > 0 && (
            <p className="kgbm-bantuan">Sudah tersimpan: {draf.berkas.join(", ")}. Mengunggah ulang akan menggantikannya.</p>
          )}
          {BERKAS_USULAN.map((b) => {
            const terpilih = berkas[b.medan];
            return (
              <div key={b.medan}>
                <label className="kgbm-label">
                  {b.label} (PDF, paling besar 1 MB)
                  <input
                    key={ulangBerkas[b.medan] ?? 0}
                    className="kgbm-input"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setBerkas((f) => ({ ...f, [b.medan]: e.target.files?.[0] ?? null }))}
                  />
                </label>
                {terpilih && (
                  <p className="kgbm-berkas-terpilih">
                    <span>
                      {terpilih.name} · {terpilih.size >= 1048576
                        ? `${(terpilih.size / 1048576).toFixed(1)} MB`
                        : `${Math.max(1, Math.round(terpilih.size / 1024))} KB`}
                    </span>
                    <button type="button" onClick={() => hapusBerkas(b.medan)}>Hapus berkas</button>
                  </p>
                )}
              </div>
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
    </KerangkaModal>
  );
}

export { SK_KOSONG };
