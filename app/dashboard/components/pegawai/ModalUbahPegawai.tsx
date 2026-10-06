"use client";

import { useState } from "react";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR, denganNilaiSaatIni } from "@/lib/pilihanPegawai";
import { SATKER } from "@/lib/satker";
import { GOLONGAN_PANGKAT, getMKGOptions } from "@/lib/tabelGaji";
import { gajiPokokUntuk, mkgSetelahGantiGolongan, tmtKgbBerikutnyaHitung } from "@/lib/koreksiDasarGaji";
import { formatTanggalId, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";
import PanelDokumenRujukan, { unggahKeArsip, type LampiranSk } from "@/app/dashboard/components/pegawai/PanelDokumenRujukan";

/* Ubah data pegawai per bagian (ADR-025): Identitas, Kepegawaian, dan Dasar KGB disimpan terpisah, sehingga
   mengubah satu bagian tidak menimpa bagian lain (PATCH menerima perubahan sebagian).

   Golongan, masa kerja golongan, dan TMT KGB tidak diubah di sini, melainkan lewat Catat kenaikan pangkat atau
   Catat PMK, supaya riwayat dan jadwal KGB tetap konsisten. Salah ketik tetap dapat diperbaiki lewat Koreksi
   data, yang sengaja dipisahkan dan tercatat di log aktivitas.

   Modalnya dua kolom (ADR-028): isian di kiri, dokumen rujukan dari arsip pegawai di kanan. Bagian Kepegawaian dan
   Dasar KGB dapat melampirkan SK (jabatan, KGB, atau CPNS) yang diunggah ke arsip setelah perubahan tersimpan. */

export type BagianUbah = "identitas" | "kepegawaian" | "dasar";

export const LABEL_BAGIAN: Record<BagianUbah, string> = {
  identitas: "Identitas",
  kepegawaian: "Kepegawaian",
  dasar: "Dasar KGB",
};

/** Label dalam kalimat, mis. "Ubah dasar KGB"; singkatan tetap huruf besar. */
export const LABEL_BAGIAN_KECIL: Record<BagianUbah, string> = {
  identitas: "identitas",
  kepegawaian: "kepegawaian",
  dasar: "dasar KGB",
};

/** Isian tiap bagian; kolomnya sama dengan yang diterima PATCH /api/pegawai/[id]. */
const KOLOM_BAGIAN: Record<BagianUbah, readonly string[]> = {
  identitas: ["nip", "nama", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir"],
  kepegawaian: ["jabatan", "jenisJabatan", "eselon", "unitKerja"],
  dasar: ["nomorSkDasar", "tanggalSkDasar", "penetapSkDasar"],
};

/** Kolom dasar gaji: hanya dikirim dalam mode koreksi. */
const KOLOM_KOREKSI = ["golonganRuang", "tmtGolongan", "mkgTahun", "mkgBulan", "tmtKgbTerakhir", "tmtKgbBerikutnya"] as const;

export interface PegawaiUbah {
  id: string;
  nip: string;
  nama: string;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  jenisKelamin?: string | null;
  pendidikanTerakhir?: string | null;
  jabatan: string;
  jenisJabatan?: string | null;
  eselon?: string | null;
  unitKerja: string;
  golonganRuang: string;
  pangkat?: string | null;
  tmtGolongan?: string | null;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbTerakhir?: string | null;
  tmtKgbBerikutnya?: string | null;
  nomorSkDasar?: string | null;
  tanggalSkDasar?: string | null;
  penetapSkDasar?: string | null;  /** Keadaan kepegawaian untuk tab Data pegawai; tidak diubah lewat modal ini. */
  satkerTugas?: string | null;
  berhentiTmt?: string | null;
  berhentiAlasan?: string | null;
  aktif?: boolean;
}

const teks = (v: string | null | undefined) => v ?? "";
const tgl = (v: string | null | undefined) => {
  const t = tanggalKalender(v);
  return t ? isoTanggalLokal(t) : "";
};
const rp = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");
const tglTampil = (v: string | null | undefined) => {
  const t = tanggalKalender(v);
  return t ? formatTanggalId(t, { day: "numeric", month: "long", year: "numeric" }) : "-";
};
const labelMkg = (tahun: number, bulan: number) => `${tahun} thn ${bulan} bln`;

export default function ModalUbahPegawai({
  pegawai,
  bagian,
  onTutup,
  onBerhasil,
}: {
  pegawai: PegawaiUbah;
  bagian: BagianUbah;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    nip: pegawai.nip,
    nama: teks(pegawai.nama),
    tempatLahir: teks(pegawai.tempatLahir),
    tanggalLahir: tgl(pegawai.tanggalLahir),
    jenisKelamin: teks(pegawai.jenisKelamin),
    pendidikanTerakhir: teks(pegawai.pendidikanTerakhir),
    jabatan: teks(pegawai.jabatan),
    jenisJabatan: teks(pegawai.jenisJabatan),
    eselon: teks(pegawai.eselon),
    unitKerja: teks(pegawai.unitKerja),
    nomorSkDasar: teks(pegawai.nomorSkDasar),
    tanggalSkDasar: tgl(pegawai.tanggalSkDasar),
    penetapSkDasar: teks(pegawai.penetapSkDasar),
    golonganRuang: pegawai.golonganRuang,
    tmtGolongan: tgl(pegawai.tmtGolongan),
    mkg: `${pegawai.mkgTahun}_${pegawai.mkgBulan}`,
    tmtKgbTerakhir: tgl(pegawai.tmtKgbTerakhir),
    tmtKgbBerikutnya: tgl(pegawai.tmtKgbBerikutnya),
  }));
  const [koreksi, setKoreksi] = useState(false);
  /** Terisi bila penggantian golongan memaksa masa kerja menyesuaikan; dinyatakan di layar, tidak diam-diam. */
  const [catatanMkg, setCatatanMkg] = useState<string | null>(null);
  /** TMT KGB berikutnya dihitung sistem, kecuali operator memilih menimpanya (mis. penundaan hukdis). */
  const [timpaTmt, setTimpaTmt] = useState(false);
  const [lampiran, setLampiran] = useState<LampiranSk | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const ubah = (kolom: string) => (nilai: string) => setForm((f) => ({ ...f, [kolom]: nilai }));

  /* ── Hitungan turunan koreksi ──────────────────────────────────────────────
     Gaji pokok dan TMT KGB berikutnya tidak diketik, melainkan dibaca dari tabel gaji PP 5/2024 dan
     dari langkah yang sama dengan yang dipakai impor maupun formulir UPT (bulanKeKgbBerikutnya).
     Keduanya ditampilkan hidup di layar, sebab akibat sebuah koreksi memang terletak di situ. */
  const [mkgTahunForm, mkgBulanForm] = (form.mkg ?? "0_0").split("_").map(Number);
  const opsiMkg = getMKGOptions(form.golonganRuang);
  const gajiBaru = gajiPokokUntuk(form.golonganRuang, mkgTahunForm, mkgBulanForm);
  const tmtBerikutnyaHitung = tmtKgbBerikutnyaHitung(form.golonganRuang, mkgTahunForm, mkgBulanForm, form.tmtKgbTerakhir);
  // Tanpa TMT KGB terakhir tidak ada yang dapat dihitung; jadwal yang sudah tercatat dipertahankan
  // apa adanya, bukan dikosongkan, supaya koreksi kolom lain tidak ikut menghapusnya.
  const tmtBerikutnyaDipakai = timpaTmt
    ? form.tmtKgbBerikutnya
    : tgl(tmtBerikutnyaHitung?.toISOString() ?? null) || tgl(pegawai.tmtKgbBerikutnya);

  /**
   * Ganti golongan tanpa menghapus masa kerja. Sebelumnya masa kerja dipaksa kembali ke 0 thn 0 bln,
   * sehingga membetulkan salah ketik golongan diam-diam menjatuhkan gaji pokok ke angka terendah.
   */
  function gantiGolongan(golBaru: string) {
    const dipakai = mkgSetelahGantiGolongan(golBaru, mkgTahunForm, mkgBulanForm);
    setCatatanMkg(
      dipakai?.disesuaikan
        ? `Masa kerja ${labelMkg(mkgTahunForm, mkgBulanForm)} tidak ada pada golongan ${golBaru}; disesuaikan ke ${labelMkg(dipakai.tahun, dipakai.bulan)}. Cocokkan dengan SK sebelum menyimpan.`
        : null,
    );
    setForm((f) => ({
      ...f,
      golonganRuang: golBaru,
      mkg: dipakai ? `${dipakai.tahun}_${dipakai.bulan}` : f.mkg,
    }));
  }

  async function simpan() {
    setGalat("");
    setSibuk(true);
    try {
      // Hanya kolom bagian ini yang dikirim; PATCH memakai nilai tersimpan untuk kolom lain (ADR-025).
      const badan: Record<string, unknown> = {};
      for (const k of KOLOM_BAGIAN[bagian]) badan[k] = form[k] ?? "";
      if (bagian === "dasar" && koreksi) {
        for (const k of KOLOM_KOREKSI) {
          if (k === "mkgTahun") badan.mkgTahun = String(mkgTahunForm);
          else if (k === "mkgBulan") badan.mkgBulan = String(mkgBulanForm);
          // Jadwal berikutnya mengikuti hitungan, kecuali sengaja ditimpa operator.
          else if (k === "tmtKgbBerikutnya") badan.tmtKgbBerikutnya = tmtBerikutnyaDipakai;
          else badan[k] = form[k] ?? "";
        }
        // Gaji pokok dihitung ulang dari golongan dan masa kerja yang dikoreksi, juga bila keduanya tidak berubah:
        // layar memperlihatkan gaji menurut tabel sebagai "Menjadi", dan gaji tercatat yang salah ketik (tidak
        // sejalan dengan golongan dan masa kerja yang sudah benar) hanya dapat dibetulkan lewat sini (ADR-054).
        badan.gajiPokok = "";
      }
      const res = await fetch(`/api/pegawai/${pegawai.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; selaras?: string[] };
      if (!res.ok) throw new Error(d.error ?? "Data pegawai gagal disimpan.");
      // SK dasar yang dibetulkan ikut ke KGB, arsip pindaian, dan riwayat bernomor sama (ADR-070).
      const selaras = (d.selaras ?? []).map((s) => ` ${s}.`).join("");
      const tambahan = await unggahKeArsip(pegawai.id, lampiran, {
        nomorSK: bagian === "dasar" ? form.nomorSkDasar : "",
        tanggalSK: bagian === "dasar" ? form.tanggalSkDasar : "",
        keterangan: `Dilampirkan saat mengubah ${LABEL_BAGIAN_KECIL[bagian]}`,
      });
      onBerhasil(`${LABEL_BAGIAN[bagian]} ${pegawai.nama} tersimpan.${selaras}${tambahan}`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data pegawai gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  const bidang = (label: string, kolom: string, jenis: "text" | "date" = "text", petunjuk?: string) => (
    <label className="inv-bidang">
      <span>{label}</span>
      <input type={jenis} className="dsb-cari" value={form[kolom] ?? ""} onChange={(e) => ubah(kolom)(e.target.value)} disabled={sibuk} />
      {petunjuk && <small className="inv-bantu">{petunjuk}</small>}
    </label>
  );
  const pilihan = (label: string, kolom: string, daftar: readonly string[], kosong = "Belum diisi") => (
    <label className="inv-bidang">
      <span>{label}</span>
      <select className="dsb-cari" value={form[kolom] ?? ""} onChange={(e) => ubah(kolom)(e.target.value)} disabled={sibuk}>
        <option value="">{kosong}</option>
        {denganNilaiSaatIni(daftar, form[kolom]).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
  );

  return (
    <KerangkaModal
      judul={`Ubah ${LABEL_BAGIAN_KECIL[bagian]}`}
      subjudul={`${pegawai.nama} · ${pegawai.nip}`}
      ukuran="lg"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" disabled={sibuk} onClick={onTutup}>Batal</button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </>
      }
    >
      <div className="pgw-kerja">
        <div className="pgw-kerja-form">
          <div className="inv-atur pgw-ubah">
            {bagian === "identitas" && (
              <>
                <label className="inv-bidang inv-lebar">
                  <span>Nama lengkap dengan gelar</span>
                  <input className="dsb-cari" value={form.nama} onChange={(e) => ubah("nama")(e.target.value)} disabled={sibuk} data-autofocus />
                </label>
                <label className="inv-bidang inv-lebar">
                  <span>NIP</span>
                  <input className="dsb-cari" inputMode="numeric" value={form.nip} onChange={(e) => ubah("nip")(e.target.value.replace(/\D/g, "").slice(0, 18))} disabled={sibuk} />
                  {form.nip !== pegawai.nip && (
                    <small className="inv-bantu" style={{ color: "var(--st-amber)" }}>
                      NIP diubah dari {pegawai.nip}. Pastikan sesuai SK CPNS; SK yang sudah terbit tetap memuat NIP lama.
                    </small>
                  )}
                </label>
                {bidang("Tempat lahir", "tempatLahir")}
                {bidang("Tanggal lahir", "tanggalLahir", "date")}
                {pilihan("Jenis kelamin", "jenisKelamin", JENIS_KELAMIN)}
                {pilihan("Pendidikan terakhir", "pendidikanTerakhir", PENDIDIKAN_TERAKHIR)}
              </>
            )}

            {bagian === "kepegawaian" && (
              <>
                <label className="inv-bidang inv-lebar">
                  <span>Jabatan</span>
                  <input className="dsb-cari" value={form.jabatan} onChange={(e) => ubah("jabatan")(e.target.value)} disabled={sibuk} data-autofocus />
                </label>
                {pilihan("Jenis jabatan", "jenisJabatan", JENIS_JABATAN)}
                {pilihan("Eselon", "eselon", ESELON, "Non Eselon")}
                <label className="inv-bidang inv-lebar">
                  <span>Unit kerja</span>
                  <select className="dsb-cari" value={form.unitKerja} onChange={(e) => ubah("unitKerja")(e.target.value)} disabled={sibuk}>
                    {denganNilaiSaatIni(SATKER.map((s) => s.nama), form.unitKerja).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <small className="inv-bantu">Pindah satker sebaiknya dicatat lewat Mutasi, agar riwayatnya tersimpan.</small>
                </label>
              </>
            )}

            {bagian === "dasar" && (
              <>
                <label className="inv-bidang inv-lebar">
                  <span>Nomor SK dasar</span>
                  <input className="dsb-cari" value={form.nomorSkDasar} onChange={(e) => ubah("nomorSkDasar")(e.target.value)} disabled={sibuk} data-autofocus />
                  <small className="inv-bantu">SK CPNS bagi pegawai yang belum pernah KGB; sesudahnya SK KGB terakhir.</small>
                </label>
                {bidang("Tanggal SK dasar", "tanggalSkDasar", "date")}
                <label className="inv-bidang inv-lebar">
                  <span>Ditetapkan oleh</span>
                  <input className="dsb-cari" value={form.penetapSkDasar} onChange={(e) => ubah("penetapSkDasar")(e.target.value)} disabled={sibuk} />
                </label>

                <div className="inv-lebar pgw-gaji">
                  <h3>Golongan dan masa kerja</h3>
                  {!koreksi ? (
                    <>
                      <dl className="pgw-ringkas-dl">
                        <div>
                          <dt>Golongan</dt>
                          <dd>{pegawai.golonganRuang} · {GOLONGAN_PANGKAT[pegawai.golonganRuang] ?? pegawai.pangkat ?? "-"}</dd>
                        </div>
                        <div>
                          <dt>Masa kerja golongan</dt>
                          <dd>{labelMkg(pegawai.mkgTahun, pegawai.mkgBulan)}</dd>
                        </div>
                        <div>
                          <dt>TMT KGB terakhir</dt>
                          <dd>{pegawai.tmtKgbTerakhir ? formatTanggalId(pegawai.tmtKgbTerakhir) : "-"}</dd>
                        </div>
                        <div>
                          <dt>TMT KGB berikutnya</dt>
                          <dd>{pegawai.tmtKgbBerikutnya ? formatTanggalId(pegawai.tmtKgbBerikutnya) : "-"}</dd>
                        </div>
                      </dl>
                      <Catatan>
                        Golongan, masa kerja golongan, dan TMT KGB berubah lewat <strong>Catat kenaikan pangkat</strong> atau{" "}
                        <strong>Catat PMK</strong>, supaya riwayat dan jadwal KGB tetap konsisten.{" "}
                        <button type="button" className="pgw-tautan" onClick={() => setKoreksi(true)}>
                          Koreksi data yang salah ketik
                        </button>
                      </Catatan>
                    </>
                  ) : (
                    /* Ringkasan abu-abu sengaja tidak ikut tampil di sini: dulu isinya berlabel sama dengan
                       isian di bawahnya, tanpa keterangan mana yang tercatat dan mana yang akan disimpan.
                       Keduanya kini digabung menjadi satu tabel berlajur "Tercatat" dan "Menjadi". */
                    <>
                      <Catatan nada="amber">
                        Koreksi ini mengubah dasar gaji <strong>tanpa</strong> mencatat riwayat kenaikan pangkat atau PMK,
                        jadi pakai hanya bila angka yang tercatat memang salah ketik. Kenaikan pangkat yang sah dicatat
                        lewat <strong>Catat kenaikan pangkat</strong>. Perubahannya tercatat di Log Aktivitas.
                      </Catatan>

                      <div className="pgw-koreksi-tabel">
                        <div className="pgw-koreksi-kepala" aria-hidden="true">
                          <span />
                          <span>Tercatat</span>
                          <span>Menjadi</span>
                        </div>

                        <div className="pgw-koreksi-baris">
                          <label htmlFor="koreksi-golongan">
                            Golongan ruang
                            <small>Hanya bila golongan yang tercatat salah ketik sejak awal.</small>
                          </label>
                          <span className="pgw-koreksi-lama">
                            {pegawai.golonganRuang} · {GOLONGAN_PANGKAT[pegawai.golonganRuang] ?? pegawai.pangkat ?? "-"}
                          </span>
                          <select
                            id="koreksi-golongan"
                            className="dsb-cari"
                            value={form.golonganRuang}
                            onChange={(e) => gantiGolongan(e.target.value)}
                            disabled={sibuk}
                          >
                            {Object.entries(GOLONGAN_PANGKAT).map(([g, p]) => (
                              <option key={g} value={g}>{g} · {p}</option>
                            ))}
                          </select>
                        </div>

                        <div className="pgw-koreksi-baris">
                          <label htmlFor="koreksi-mkg">
                            Masa kerja golongan
                            <small>Angka pada SK KGB atau SK pangkat terakhir. Inilah yang menentukan gaji pokok.</small>
                          </label>
                          <span className="pgw-koreksi-lama">{labelMkg(pegawai.mkgTahun, pegawai.mkgBulan)}</span>
                          <select id="koreksi-mkg" className="dsb-cari" value={form.mkg} onChange={(e) => ubah("mkg")(e.target.value)} disabled={sibuk}>
                            {opsiMkg.map((m) => (
                              <option key={`${m.tahun}_${m.bulan}`} value={`${m.tahun}_${m.bulan}`}>
                                {labelMkg(m.tahun, m.bulan)} · {rp(m.gaji)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="pgw-koreksi-baris">
                          <label htmlFor="koreksi-tmt-golongan">
                            TMT golongan
                            <small>Keterangan saja; tidak dipakai menghitung KGB.</small>
                          </label>
                          <span className="pgw-koreksi-lama">{tglTampil(pegawai.tmtGolongan)}</span>
                          <input id="koreksi-tmt-golongan" type="date" className="dsb-cari" value={form.tmtGolongan ?? ""} onChange={(e) => ubah("tmtGolongan")(e.target.value)} disabled={sibuk} />
                        </div>

                        <div className="pgw-koreksi-baris">
                          <label htmlFor="koreksi-tmt-kgb">
                            TMT KGB terakhir
                            <small>TMT pada SK KGB terakhir; menjadi titik hitung jadwal berikutnya.</small>
                          </label>
                          <span className="pgw-koreksi-lama">{tglTampil(pegawai.tmtKgbTerakhir)}</span>
                          <input id="koreksi-tmt-kgb" type="date" className="dsb-cari" value={form.tmtKgbTerakhir ?? ""} onChange={(e) => ubah("tmtKgbTerakhir")(e.target.value)} disabled={sibuk} />
                        </div>

                        {catatanMkg && (
                          <p className="pgw-koreksi-catatan" role="status">{catatanMkg}</p>
                        )}

                        {/* Akibat koreksi, dihitung hidup dari tabel gaji PP 5/2024. Inilah yang sebenarnya
                            menentukan benar atau tidaknya koreksi, jadi ditampilkan, bukan disembunyikan. */}
                        <div className="pgw-koreksi-baris pgw-koreksi-hasil">
                          <label>Gaji pokok</label>
                          <span className="pgw-koreksi-lama">{rp(pegawai.gajiPokok)}</span>
                          <span className="pgw-koreksi-baru" data-berubah={gajiBaru !== null && gajiBaru !== pegawai.gajiPokok ? "" : undefined}>
                            {gajiBaru === null ? "masa kerja tidak ada di tabel golongan ini" : rp(gajiBaru)}
                          </span>
                        </div>

                        <div className="pgw-koreksi-baris pgw-koreksi-hasil">
                          <label>TMT KGB berikutnya</label>
                          <span className="pgw-koreksi-lama">{tglTampil(pegawai.tmtKgbBerikutnya)}</span>
                          {timpaTmt ? (
                            <span>
                              <input type="date" className="dsb-cari" aria-label="TMT KGB berikutnya" value={form.tmtKgbBerikutnya ?? ""} onChange={(e) => ubah("tmtKgbBerikutnya")(e.target.value)} disabled={sibuk} />
                              <button type="button" className="pgw-tautan" onClick={() => setTimpaTmt(false)} disabled={sibuk}>
                                Kembali ke hitungan sistem
                              </button>
                            </span>
                          ) : (
                            <span
                              className="pgw-koreksi-baru"
                              data-berubah={tmtBerikutnyaDipakai && tmtBerikutnyaDipakai !== tgl(pegawai.tmtKgbBerikutnya) ? "" : undefined}
                            >
                              {tmtBerikutnyaHitung ? tglTampil(tmtBerikutnyaDipakai) : "isi TMT KGB terakhir lebih dulu"}
                              <small>
                                dihitung dari {form.golonganRuang} · {labelMkg(mkgTahunForm, mkgBulanForm)}
                                {". "}
                                <button type="button" className="pgw-tautan" onClick={() => { setTimpaTmt(true); ubah("tmtKgbBerikutnya")(tmtBerikutnyaDipakai); }} disabled={sibuk}>
                                  Tulis sendiri
                                </button>{" "}
                                bila jadwalnya memang bergeser, misalnya karena penundaan hukuman disiplin.
                              </small>
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <PesanGalat pesan={galat || null} />
        </div>
        <PanelDokumenRujukan
          pegawaiId={pegawai.id}
          tindakan={bagian}
          lampiran={lampiran}
          onLampiran={bagian === "identitas" ? undefined : setLampiran}
          nonaktif={sibuk}
        />
      </div>
    </KerangkaModal>
  );
}
