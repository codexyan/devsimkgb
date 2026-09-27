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
import LatarNavy from "@/app/_bersama/LatarNavy";
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

/* Enam langkah satu usulan KGB, sama dengan alur singkat di panduan dashboard (app/dashboard/panduan). */
const LANGKAH: { judul: string; pelaksana: string; isi: string; status?: StatusKgb }[] = [
  {
    judul: "UPT menyiapkan dan mengajukan usulan",
    pelaksana: "Admin UPT dan Kepala UPT",
    isi: "Data pegawai yang KGB-nya jatuh tempo diperiksa di SIM-KGB, perbaikan dan berkas SK dasarnya disiapkan, lalu diajukan ke Kanwil bersama surat usulan Srikandi yang ditandatangani Kepala UPT.",
  },
  {
    judul: "Kanwil meninjau usulan",
    pelaksana: "Tim SDM Kanwil",
    isi: "Surat dicatat dan didisposisikan. Usulan perbaikan data disetujui atau dikembalikan untuk diperbaiki; selama belum ditinjau, proses KGB pegawainya tertahan.",
  },
  {
    judul: "Input KGB dan buat SK",
    pelaksana: "Tim SDM Kanwil",
    isi: "Masa kerja dan gaji pokok baru dihitung dari tabel gaji PP 5/2024, lalu SK dibuat di SIM-KGB.",
    status: "sedang_diproses",
  },
  {
    judul: "Tanda tangan elektronik",
    pelaksana: "Kepala Kanwil, Plh, Plt, atau Dirjen",
    isi: "SK versi Srikandi ditandatangani secara elektronik oleh pejabat yang berwenang pada tanggal SK.",
  },
  {
    judul: "Unggah dan kirim SK",
    pelaksana: "Tim SDM Kanwil",
    isi: "SK bertanda tangan diunggah ke SIM-KGB, sehingga langsung dapat diunduh UPT, dan dikirim kepada UPT serta KPPN mitra satker.",
    status: "menunggu_keuangan",
  },
  {
    judul: "Rekam di Gaji Web",
    pelaksana: "Keuangan Kanwil atau keuangan satker",
    isi: "Pegawai Kanwil oleh keuangan Kanwil; pegawai UPT oleh keuangan satkernya lewat akun Admin UPT. Rapelan ditetapkan, SK direkam di Gaji Web, lalu SIM-KGB menjadwalkan KGB berikutnya.",
    status: "selesai",
  },
];

const FAKTA = [
  { nilai: "2 tahun", label: "Selang kenaikan gaji berkala" },
  { nilai: "6 tahap", label: "Dari usulan UPT sampai direkam di Gaji Web" },
  { nilai: "PP 5/2024", label: "Dasar tabel gaji pokok yang dipakai" },
];

const URUTAN_STATUS: StatusKgb[] = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai"];

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
      <section id="beranda" className="pub-navy pub-hero hr" aria-labelledby="hr-judul">
        <LatarNavy />
        <div className="pub-container">
          <div className="hr-kisi">
            <div className="hr-teks">
              <p className="pub-eyebrow masuk" style={{ "--d": 0 } as React.CSSProperties}>
                Kenaikan gaji berkala · Kantor Wilayah Ditjenpas Kalimantan Selatan
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
                Cek status KGB dengan NIP dan tempat lahir, lalu lihat kapan anak tangga berikutnya tiba. Untuk pegawai Kanwil Ditjenpas
                Kalimantan Selatan dan UPT di wilayahnya.
              </p>
              <div className="hr-cari masuk" style={{ "--d": 300 } as React.CSSProperties}>
                <CekStatus />
              </div>
              <p className="hr-bantu masuk" style={{ "--d": 380 } as React.CSSProperties}>
                Admin UPT atau petugas Kanwil? <Link href="/login">Masuk ke SIM-KGB</Link> untuk membaca panduan sesuai
                peran Anda.
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
            keterangan="Dari usulan UPT sampai SK direkam keuangan di Gaji Web. Status KGB berubah di tiga titik sepanjang jalan."
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
            <li className="al-kartu al-ajak pub-navy" data-muncul="" style={{ "--i": LANGKAH.length } as React.CSSProperties}>
              <LatarNavy />
              <p className="al-ajak-judul">Enam langkah, satu SK.</p>
              <p className="al-ajak-isi">
                Rincian tiap langkah untuk petugas UPT dan Kanwil ada di panduan di dalam SIM-KGB, sesuai peran
                masing-masing.
              </p>
              <Link href="/login" className="al-ajak-tautan">
                Masuk untuk petugas
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
            keterangan="Dihitung dari hari ini dan bergeser sendiri ke TMT berikutnya setelah batas input Tim SDM lewat. SK harus selesai sebelum keuangan merekon gaji di Gaji Web, agar gaji baru terbayar mulai TMT."
            aksi={
              <a href="#info-jadwal" className="sx-tautan">
                Aturan jadwal
                {Panah}
              </a>
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
                    <dt><span className="jd-titik" data-tahap="surat" aria-hidden="true" />Kirim surat</dt>
                    <dd>
                      {tanggalBulan(b.kirimSurat)} sampai {tanggalPendek(b.kirimSuratBatas)}
                    </dd>
                  </div>
                  <div>
                    <dt><span className="jd-titik" data-tahap="input" aria-hidden="true" />Input SIM-KGB</dt>
                    <dd>
                      {tanggalBulan(b.inputDibuka)} sampai {tanggalPendek(b.batasInput)}
                    </dd>
                  </div>
                  <div>
                    <dt><span className="jd-titik" data-tahap="rekon" aria-hidden="true" />Rekon Gaji Web</dt>
                    <dd>
                      {tanggalBulan(b.rekonMulai)} sampai {tanggalPendek(b.rekonBatas)}
                    </dd>
                  </div>
                </dl>
                {/* Garis tiga tahap dari kirim surat sampai akhir rekon, dengan penanda hari ini bila jatuh di dalamnya.
                    Hiasan saja: tahap dan sisa harinya sudah tertulis pada kalimat di bawahnya. */}
                <div
                  className="jd-lini"
                  aria-hidden="true"
                  style={{ "--posisi": b.sekarang.posisi ?? 0 } as React.CSSProperties}
                >
                  {b.ruas.map((r) => (
                    <span
                      key={r.tahap}
                      className="jd-ruas"
                      data-tahap={r.tahap}
                      data-kini={b.sekarang.keadaan === "berjalan" && b.sekarang.tahap === r.tahap ? "" : undefined}
                      style={{ "--awal": r.awal, "--akhir": r.akhir } as React.CSSProperties}
                    />
                  ))}
                  {b.sekarang.posisi !== null && (
                    <>
                      <span className="jd-lewat" />
                      <span className="jd-kini">
                        <span className="jd-kini-label">Hari ini</span>
                      </span>
                    </>
                  )}
                </div>
                <p className="jd-keadaan" data-sekarang={b.sekarang.keadaan}>
                  {b.sekarang.keadaan === "menunggu" && b.sekarang.tahap === "surat"
                    ? `Dibuka ${tanggalPendek(b.kirimSurat)} · ${b.sekarang.sisaHari === 1 ? "besok" : `${b.sekarang.sisaHari} hari lagi`}`
                    : b.sekarang.teks}
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
              <p>
                Usulan disiapkan di SIM-KGB, tetapi surat usulan UPT lewat Srikandi tetap menjadi dasar agenda dan
                disposisi di Kanwil.
              </p>
            </li>
            <li data-muncul="" style={{ "--i": 2 } as React.CSSProperties}>
              <h3>Terlambat tetap diproses</h3>
              <p>TMT tidak berubah. Selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji.</p>
            </li>
            <li data-muncul="" style={{ "--i": 3 } as React.CSSProperties}>
              <h3>Baru diangkat PNS</h3>
              <p>
                Masa kerja golongan dihitung sejak TMT CPNS, jadi KGB pertama tidak bergeser walau SK pengangkatan PNS
                terbit belakangan. <a href="#info-cpns">Cara menghitung dan merapelnya</a>.
              </p>
            </li>
            <li data-muncul="" style={{ "--i": 4 } as React.CSSProperties}>
              <h3>Setelah naik pangkat</h3>
              <p>
                Golongan baru memotong masa kerja golongan, sehingga dasar gaji KGB berikutnya berubah, tetapi jadwal dua
                tahunannya tetap. <a href="#info-pangkat">Aturan potongannya</a>.
              </p>
            </li>
            <li data-muncul="" style={{ "--i": 5 } as React.CSSProperties}>
              <h3>Akun untuk UPT</h3>
              <p>
                Setiap UPT memegang akun Admin UPT untuk menyiapkan usulan, melaporkan mutasi dan hukuman disiplin,
                mengunduh SK begitu diunggah Kanwil, dan menandai SK yang sudah direkam di Gaji Web satker.
              </p>
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
              <a href="#info-tanya" className="sx-tautan">
                Pertanyaan umum
                {Panah}
              </a>
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
              <div>
                <dt>
                  <span className="pub-status st-tanda">Tertahan usulan UPT</span>
                </dt>
                <dd>
                  Keterangan di SIM-KGB, bukan status: satker mengusulkan perbaikan data pegawai, dan proses KGB-nya
                  menunggu Kanwil meninjau usulan itu. Status di halaman ini tidak berubah sampai usulan ditinjau.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ── Info untuk pegawai ───────────────────────────────────────────── */}
      <section id="info-pegawai" className="sx" aria-labelledby="judul-info">
        <div className="pub-container">
          <KepalaBagian
            nomor={4}
            label="Info pegawai"
            id="judul-info"
            judul="Yang perlu Anda ketahui"
            keterangan="Aturan KGB yang paling sering ditanyakan pegawai. Langkah kerja petugas ada di panduan di dalam SIM-KGB."
          />

          <div className="ip-kisi">
            <article className="ip-kartu" id="info-jadwal" data-muncul="" style={{ "--i": 0 } as React.CSSProperties}>
              <h3>Kapan KGB diberikan</h3>
              <ul>
                <li>
                  Setiap 2 tahun. PNS yang pertama kali diangkat dalam golongan II/a menerima KGB pertama setelah masa
                  kerja 1 tahun, lalu setiap 2 tahun.
                </li>
                <li>TMT KGB jatuh pada tanggal 1 bulan ketika masa kerja golongan yang dipersyaratkan tercapai.</li>
                <li>
                  Syaratnya masa kerja golongan tercapai dan penilaian kinerja sekurang-kurangnya cukup (PP 7/1977
                  Pasal 11).
                </li>
                <li>
                  KGB ditunda bila pegawai menjalani hukuman disiplin yang menunda KGB, atau penilaian kinerjanya belum
                  memenuhi syarat.
                </li>
                <li>
                  Usulan yang terlambat tetap diproses. TMT tidak bergeser; selisih gaji dibayar sebagai kekurangan
                  gaji.
                </li>
              </ul>
            </article>

            <article className="ip-kartu" id="info-cpns" data-muncul="" style={{ "--i": 1 } as React.CSSProperties}>
              <h3>KGB pertama setelah CPNS menjadi PNS</h3>
              <ul>
                <li>
                  Masa kerja golongan dihitung sejak TMT CPNS, bukan TMT PNS. KGB pertama tidak bergeser walau SK
                  pengangkatan PNS terbit belakangan.
                </li>
                <li>
                  Selama berstatus CPNS gaji dibayar 80 persen dari gaji pokok; gaji pokoknya tetap naik pada TMT KGB.
                </li>
                <li>
                  Yang dirapel hanya bulan yang terlanjur dibayar dengan gaji pokok lama. Periksa gaji pokok pada SK
                  pengangkatan PNS: bila sudah memakai gaji pokok hasil KGB, sejak TMT PNS tidak ada lagi kekurangan.
                </li>
                <li>KGB berikutnya tetap 2 tahun setelah KGB pertama.</li>
              </ul>
            </article>

            <article className="ip-kartu" id="info-pangkat" data-muncul="" style={{ "--i": 2 } as React.CSSProperties}>
              <h3>Setelah naik pangkat</h3>
              <ul>
                <li>
                  Naik dari golongan I ke II/a memotong masa kerja golongan 6 tahun; dari golongan II ke III/a
                  memotong 5 tahun. Kenaikan di dalam golongan yang sama, misalnya III/a ke III/b, tidak memotong.
                </li>
                <li>Golongan dan gaji pokok yang menjadi dasar KGB berikutnya ikut berubah.</li>
                <li>
                  Jadwal KGB tetap: 2 tahun dihitung dari KGB terakhir, tidak diulang dari tanggal kenaikan pangkat.
                </li>
              </ul>
            </article>
          </div>

          <div className="ip-tanya" id="info-tanya">
            <h3 className="ip-tanya-judul">Pertanyaan umum</h3>
            <div className="pub-faq">
              <details>
                <summary>NIP saya tidak ditemukan</summary>
                <p>
                  Periksa kembali NIP yang diketik. Bila tetap tidak ditemukan, data Anda belum terdaftar atau NIP-nya
                  tercatat keliru. Minta admin kepegawaian satker Anda mendaftarkan atau membetulkannya lewat SIM-KGB;
                  perubahannya berlaku setelah disetujui Kanwil.
                </p>
              </details>
              <details>
                <summary>Status KGB saya tidak berubah dalam waktu lama</summary>
                <p>
                  Belum Diproses biasanya berarti jendela proses belum dibuka, usulan dari satker belum masuk, atau
                  usulan perbaikan data Anda masih ditinjau Kanwil. Sedang Diproses berarti SK sedang disiapkan atau
                  menunggu tanda tangan elektronik. Menunggu Keuangan berarti SK sudah terbit dan menunggu direkam di
                  Gaji Web oleh keuangan Kanwil atau keuangan satker Anda. Bila jauh melewati jadwal, tanyakan melalui
                  admin kepegawaian satker.
                </p>
              </details>
              <details>
                <summary>Usulan terlambat dikirim. Apakah KGB hilang?</summary>
                <p>
                  Tidak. KGB tetap diproses dan TMT tidak bergeser. Bila SK terbit setelah TMT, selisih gaji sejak TMT
                  dibayarkan sebagai kekurangan gaji: operator gaji satker merekam SK di Gaji Web, lalu satker
                  mengajukan SPM-LS kekurangan gaji ke KPPN.
                </p>
              </details>
              <details>
                <summary>Saya pindah satker atau berhenti sebelum SK terbit</summary>
                <p>
                  Admin kepegawaian satker asal melaporkannya lewat SIM-KGB, lalu Kanwil mencatatnya. Satker tempat Anda
                  bertugas menentukan KPPN mitra yang menjadi tujuan SK.
                </p>
              </details>
              <details>
                <summary>Apakah saya perlu akun SIM-KGB?</summary>
                <p>
                  Tidak. Status KGB dapat dicek dengan NIP dan tempat lahir di halaman ini. Akun SIM-KGB hanya untuk Tim SDM dan keuangan
                  Kanwil serta Admin UPT.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bantuan ──────────────────────────────────────────────────────── */}
      <section id="bantuan" className="bt" aria-labelledby="judul-bantuan">
        <div className="pub-container">
          <div className="bt-kartu pub-navy" data-muncul="">
            <LatarNavy />
            <div className="bt-teks">
              <h2 id="judul-bantuan" className="bt-judul">
                Butuh bantuan?
              </h2>
              <p>
                Tim SDM Kanwil Ditjenpas Kalimantan Selatan melayani pertanyaan KGB pada jam kerja. Pegawai bertanya
                melalui admin kepegawaian satkernya; petugas membaca panduan di dalam SIM-KGB.
              </p>
              <div className="bt-aksi">
                <Link href="/login" className="bt-btn">
                  Masuk ke SIM-KGB
                  {Panah}
                </Link>
                <a href="#info-tanya" className="bt-btn-kedua">
                  Pertanyaan umum
                </a>
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
