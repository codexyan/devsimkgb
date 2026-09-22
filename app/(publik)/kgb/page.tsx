import type { Metadata } from "next";
import Link from "next/link";
import { JAM_LAYANAN } from "@/lib/jamLayanan";
import { jadwalPengusulan } from "@/lib/jadwalPengusulan";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { STATUS_KGB, type StatusKgb } from "@/lib/statusKgb";
import { tanggaGaji } from "@/lib/tabelGaji";
import { formatTanggalId } from "@/lib/waktu";
import { StatusLayanan } from "../JamLayanan";
import Kata from "../Kata";
import CekStatus from "./CekStatus";
import PenjelajahTangga from "./tangga/PenjelajahTangga";
import "./beranda.css";

export const metadata: Metadata = {
  title: "Cek Status KGB",
  description:
    "Cek status dan jadwal kenaikan gaji berkala pegawai Kanwil Ditjenpas Kalimantan Selatan dan UPT di wilayahnya, jelajahi tangga gaji pokok PNS, dan pahami alur pengusulannya.",
};

// Jadwal pengusulan dihitung dari tanggal hari ini (WITA), jadi halaman dirender per permintaan.
export const dynamic = "force-dynamic";

/* Tujuh langkah satu usulan KGB, sama dengan alur singkat di panduan. */
const LANGKAH: { judul: string; pelaksana: string; isi: string; status?: StatusKgb }[] = [
  {
    judul: "UPT mengirim surat permohonan",
    pelaksana: "Admin kepegawaian dan Kepala UPT",
    isi: "Surat berisi daftar pegawai yang diusulkan beserta lampirannya, ditandatangani elektronik dan dikirim lewat Srikandi kepada Kepala Kanwil.",
  },
  {
    judul: "Agenda dan disposisi",
    pelaksana: "Tata Usaha, Kepala Kanwil, Kabag TU dan Umum",
    isi: "Tata Usaha mencatat surat pada Lembar Disposisi. Kepala Kanwil memberi disposisi yang diteruskan kepada Ketua Tim SDM.",
  },
  {
    judul: "Input KGB dan buat SK",
    pelaksana: "Tim SDM Kanwil",
    isi: "Data dicocokkan dengan lampiran. Masa kerja dan gaji pokok baru dihitung dari tabel gaji, lalu SK dibuat di SIM-KGB.",
    status: "sedang_diproses",
  },
  {
    judul: "Tanda tangan elektronik",
    pelaksana: "Kepala Kanwil, Plh, Plt, atau Dirjen",
    isi: "SK versi Srikandi ditandatangani secara elektronik oleh pejabat yang berwenang pada tanggal SK.",
  },
  {
    judul: "Pengiriman SK",
    pelaksana: "Tim SDM Kanwil",
    isi: "SK yang sudah ditandatangani dikirim kepada UPT pengusul, bagian keuangan UPT, dan KPPN mitra satker.",
  },
  {
    judul: "Unggah SK ke SIM-KGB",
    pelaksana: "Tim SDM Kanwil",
    isi: "Berkas PDF SK yang sudah ditandatangani diunggah lewat tombol Unggah SK TTE.",
    status: "menunggu_keuangan",
  },
  {
    judul: "Konfirmasi keuangan",
    pelaksana: "Bagian keuangan",
    isi: "SK diperiksa dan dikonfirmasi, termasuk bila ada rapelan. SIM-KGB lalu menjadwalkan KGB berikutnya.",
    status: "selesai",
  },
];

const FAKTA = [
  { nilai: "2 tahun", label: "Selang kenaikan gaji berkala" },
  { nilai: "7 tahap", label: "Dari surat UPT sampai konfirmasi keuangan" },
  { nilai: "PP 5/2024", label: "Dasar tabel gaji pokok yang dipakai" },
];

const URUTAN_STATUS: StatusKgb[] = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai"];

const bulanTahun = (d: Date) => formatTanggalId(d, { month: "long", year: "numeric" });
const tanggalPendek = (d: Date) => formatTanggalId(d, { day: "numeric", month: "short", year: "numeric" });
const tanggalBulan = (d: Date) => formatTanggalId(d, { day: "numeric", month: "short" });
const dua = (n: number) => String(n).padStart(2, "0");

const Panah = (
  <svg className="pub-btn-panah" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

function Status({ status }: { status: StatusKgb }) {
  const info = STATUS_KGB[status];
  return <span className={`pub-status ${info.kelas}`}>{info.label}</span>;
}

function KepalaBagian({ nomor, label, id, judul, keterangan, aksi }: {
  nomor: number;
  label: string;
  id: string;
  judul: string;
  keterangan: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="sx-kepala" data-muncul="">
      <div className="sx-kiri">
        <p className="pub-eyebrow">
          <span className="pub-eyebrow-nomor">{dua(nomor)}</span>
          {label}
        </p>
        <h2 id={id} className="sx-judul">
          <Kata teks={judul} />
        </h2>
      </div>
      <div className="sx-kanan">
        <p className="sx-ket">{keterangan}</p>
        {aksi}
      </div>
    </div>
  );
}

export default async function HalamanBeranda() {
  await muatBatasInputSdm();
  const jadwal = jadwalPengusulan(6);
  const tangga = tanggaGaji();

  return (
    <div className="beranda">
      {/* ── Pembuka: cek status dan tangga gaji ──────────────────────────── */}
      <section id="beranda" className="hr" aria-labelledby="hr-judul">
        <div className="pub-container">
          <div className="hr-kisi">
            <div className="hr-teks">
              <p className="pub-eyebrow masuk" style={{ "--d": 0 } as React.CSSProperties}>
                Kenaikan gaji berkala · Kanwil Ditjenpas Kalsel
              </p>
              <h1 id="hr-judul" className="hr-judul">
                <span className="hr-judul-a">
                  <Kata teks="Setiap dua tahun," jeda={1} />
                </span>{" "}
                <span className="hr-judul-b">
                  <Kata teks="satu anak tangga." jeda={4} />
                </span>
              </h1>
              <p className="hr-lead masuk" style={{ "--d": 220 } as React.CSSProperties}>
                Cek status KGB dengan NIP, lalu lihat kapan anak tangga berikutnya tiba. Untuk pegawai Kanwil Ditjenpas
                Kalimantan Selatan dan UPT di wilayahnya.
              </p>
              <div className="hr-cari masuk" style={{ "--d": 300 } as React.CSSProperties}>
                <CekStatus />
              </div>
              <p className="hr-bantu masuk" style={{ "--d": 380 } as React.CSSProperties}>
                Admin UPT yang akan mengusulkan? <Link href="/panduan#untuk-upt">Baca panduan menyiapkan surat</Link>
              </p>
            </div>

            <div className="hr-visual masuk" style={{ "--d": 160 } as React.CSSProperties}>
              <PenjelajahTangga baris={tangga} />
            </div>
          </div>

          <dl className="hr-fakta">
            {FAKTA.map((f, i) => (
              <div key={f.nilai} className="masuk" style={{ "--d": 460 + i * 70 } as React.CSSProperties}>
                <dt>{f.label}</dt>
                <dd>{f.nilai}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Alur ─────────────────────────────────────────────────────────── */}
      <section id="alur" className="sx" aria-labelledby="judul-alur">
        <div className="pub-container">
          <KepalaBagian
            nomor={1}
            label="Alur"
            id="judul-alur"
            judul="Perjalanan satu usulan"
            keterangan="Dari surat UPT sampai SK dikonfirmasi keuangan. Status KGB berubah di tiga titik sepanjang jalan."
          />

          <ol className="al">
            {LANGKAH.map((l, i) => (
              <li key={l.judul} className="al-kartu" data-muncul="" style={{ "--i": i } as React.CSSProperties}>
                <span className="al-nomor" aria-hidden="true">
                  {dua(i + 1)}
                </span>
                <h3 className="al-judul">
                  <span className="pub-visually-hidden">Langkah {i + 1}: </span>
                  {l.judul}
                </h3>
                <p className="al-pelaksana">{l.pelaksana}</p>
                <p className="al-isi">{l.isi}</p>
                {l.status && (
                  <p className="al-status">
                    <span>Status menjadi</span> <Status status={l.status} />
                  </p>
                )}
              </li>
            ))}
            <li className="al-kartu al-ajak" data-muncul="" style={{ "--i": LANGKAH.length } as React.CSSProperties}>
              <p className="al-ajak-judul">Tujuh langkah, satu SK.</p>
              <p className="al-ajak-isi">Rincian tiap langkah, contoh surat, dan lembar disposisi ada di panduan.</p>
              <Link href="/panduan#ringkasan" className="al-ajak-tautan">
                Alur lengkap di panduan
                {Panah}
              </Link>
            </li>
          </ol>
        </div>
      </section>

      {/* ── Jadwal ───────────────────────────────────────────────────────── */}
      <section id="jadwal" className="sx" aria-labelledby="judul-jadwal">
        <div className="pub-container">
          <KepalaBagian
            nomor={2}
            label="Jadwal"
            id="judul-jadwal"
            judul="Jadwal pengusulan"
            keterangan="Dihitung dari hari ini. Kirim surat sebelum input dibuka; SK harus selesai sebelum keuangan merekon gaji di Gaji Web, agar gaji baru terbayar mulai TMT."
            aksi={
              <Link href="/panduan#jadwal" className="sx-tautan">
                Aturan jadwal
                {Panah}
              </Link>
            }
          />

          <ol className="jd" aria-label="Jadwal pengusulan untuk enam TMT KGB berikutnya">
            {jadwal.map((b, i) => (
              <li
                key={b.tmt.getTime()}
                className="jd-kartu"
                data-keadaan={b.keadaan}
                data-muncul=""
                style={{ "--i": i } as React.CSSProperties}
              >
                <p className="jd-label">TMT KGB</p>
                <p className="jd-tmt">{formatTanggalId(b.tmt)}</p>
                <dl className="jd-rinci">
                  <div>
                    <dt>Kirim surat</dt>
                    <dd>{bulanTahun(b.kirimSurat)}</dd>
                  </div>
                  <div>
                    <dt>Input SIM-KGB</dt>
                    <dd>
                      {tanggalBulan(b.inputDibuka)} sampai {tanggalPendek(b.batasInput)}
                    </dd>
                  </div>
                  <div>
                    <dt>Rekon Gaji Web</dt>
                    <dd>
                      {tanggalBulan(b.rekonMulai)} sampai {tanggalPendek(b.rekonBatas)}
                    </dd>
                  </div>
                </dl>
                <p className="jd-keadaan">
                  {b.keadaan === "terbuka" ? "Input sedang dibuka" : `Dibuka ${tanggalPendek(b.inputDibuka)}`}
                </p>
              </li>
            ))}
          </ol>

          <ul className="jd-catatan">
            <li data-muncul="" style={{ "--i": 0 } as React.CSSProperties}>
              <h3>Setiap dua tahun</h3>
              <p>
                KGB diberikan setiap dua tahun. PNS yang pertama kali diangkat dalam golongan II/a menerima KGB pertama
                setelah masa kerja satu tahun.
              </p>
            </li>
            <li data-muncul="" style={{ "--i": 1 } as React.CSSProperties}>
              <h3>Surat tetap wajib</h3>
              <p>Walaupun data pegawai sudah ada di SIM-KGB, surat UPT tetap menjadi dasar agenda dan disposisi.</p>
            </li>
            <li data-muncul="" style={{ "--i": 2 } as React.CSSProperties}>
              <h3>Terlambat tetap diproses</h3>
              <p>TMT tidak berubah. Selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji.</p>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Arti status ──────────────────────────────────────────────────── */}
      <section id="status" className="sx" aria-labelledby="judul-status">
        <div className="pub-container">
          <KepalaBagian
            nomor={3}
            label="Status"
            id="judul-status"
            judul="Arti status"
            keterangan="Status yang tampil saat NIP dicek, berurutan sesuai tahap usulan yang sedang berjalan."
            aksi={
              <Link href="/panduan#pertanyaan" className="sx-tautan">
                Pertanyaan umum
                {Panah}
              </Link>
            }
          />

          <ol className="st">
            {URUTAN_STATUS.map((s, i) => (
              <li key={s} className="st-kartu" data-muncul="" style={{ "--i": i } as React.CSSProperties}>
                <span className="st-urut" aria-hidden="true">
                  {i + 1}
                </span>
                <Status status={s} />
                <p>{STATUS_KGB[s].keterangan}</p>
              </li>
            ))}
          </ol>

          <div className="st-cabang" data-muncul="">
            <p className="st-cabang-judul">Di luar urutan</p>
            <dl>
              <div>
                <dt>
                  <Status status="ditolak" />
                </dt>
                <dd>{STATUS_KGB.ditolak.keterangan}</dd>
              </div>
              <div>
                <dt>
                  <span className="pub-status pub-status-rapelan">Berpotensi rapelan</span>
                </dt>
                <dd>Tanda tambahan, bukan status: KGB diinput setelah batas waktu. TMT tetap sama.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── Bantuan ──────────────────────────────────────────────────────── */}
      <section id="bantuan" className="bt" aria-labelledby="judul-bantuan">
        <div className="pub-container">
          <div className="bt-kartu" data-muncul="">
            <div className="bt-teks">
              <h2 id="judul-bantuan" className="bt-judul">
                Butuh bantuan?
              </h2>
              <p>
                Tim SDM Kanwil Ditjenpas Kalimantan Selatan melayani pertanyaan KGB pada jam kerja. Admin UPT dianjurkan
                membaca panduan sebelum mengirim surat permohonan.
              </p>
              <div className="bt-aksi">
                <Link href="/panduan" className="bt-btn">
                  Baca panduan KGB
                  {Panah}
                </Link>
                <Link href="/login" className="bt-btn-kedua">
                  Masuk ke SIM-KGB
                </Link>
              </div>
            </div>

            <div className="bt-jam">
              <p className="bt-jam-judul">Jam layanan</p>
              <StatusLayanan />
              <dl>
                {JAM_LAYANAN.map((b) => (
                  <div key={b.hari}>
                    <dt>{b.hari}</dt>
                    <dd>{b.jam}</dd>
                  </div>
                ))}
              </dl>
              <p className="bt-jam-catatan">Waktu Indonesia Tengah (WITA).</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
