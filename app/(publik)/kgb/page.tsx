import type { Metadata } from "next";
import Link from "next/link";
import { JAM_LAYANAN } from "@/lib/jamLayanan";
import { jadwalPengusulan } from "@/lib/jadwalPengusulan";
import { STATUS_KGB, type StatusKgb } from "@/lib/statusKgb";
import { getGajiPokok, getPangkat, kalkulasiKGB, tanggaGaji } from "@/lib/tabelGaji";
import { formatTanggalId } from "@/lib/waktu";
import GarisTangga from "../GarisTangga";
import { StatusLayanan } from "../JamLayanan";
import Kata from "../Kata";
import CekStatus from "./CekStatus";
import PerjalananUsulan, { type ContohUsulan } from "./PerjalananUsulan";
import PenjelajahTangga from "./tangga/PenjelajahTangga";
import "./beranda.css";

export const metadata: Metadata = {
  title: "Cek Status KGB",
  description:
    "Cek status dan jadwal kenaikan gaji berkala pegawai Kanwil Ditjenpas Kalimantan Selatan dan UPT di wilayahnya, jelajahi tangga gaji pokok PNS, dan pahami alur pengusulannya.",
};

// Jadwal pengusulan dihitung dari tanggal hari ini (WITA), jadi halaman dirender per permintaan.
export const dynamic = "force-dynamic";

/* Contoh kasus yang sama dengan panduan: usulan Rutan Kelas IIB Rantau untuk eks CPNS golongan II/a. */
const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const KASUS = kalkulasiKGB({
  golonganRuang: "II/a",
  mkgTahun: 0,
  mkgBulan: 0,
  tmtKgbBerikutnya: new Date(2026, 5, 1),
  tmtKgbTerakhir: new Date(2025, 5, 1),
});
const CONTOH: ContohUsulan = {
  satker: "Rutan Kelas IIB Rantau",
  golongan: `${getPangkat("II/a")} (II/a)`,
  gajiLama: rupiah(getGajiPokok("II/a", 0, 0)),
  gajiBaru: rupiah(KASUS.gajiPokokBaru),
  masaKerjaBaru: `${KASUS.mkgTahunBaru} tahun ${KASUS.mkgBulanBaru} bulan`,
  tmt: formatTanggalId(KASUS.tmtKgbBaru),
  tmtBerikutnya: formatTanggalId(KASUS.tmtKgbBerikutnya),
};

const URUTAN_STATUS: StatusKgb[] = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai"];

const bulanTahun = (d: Date) => formatTanggalId(d, { month: "long", year: "numeric" });
const tanggalPendek = (d: Date) => formatTanggalId(d, { day: "numeric", month: "short", year: "numeric" });
const tanggalBulan = (d: Date) => formatTanggalId(d, { day: "numeric", month: "short" });

function Status({ status }: { status: StatusKgb }) {
  const info = STATUS_KGB[status];
  return <span className={`pub-status ${info.kelas}`}>{info.label}</span>;
}

function KepalaBagian({ nomor, id, judul, keterangan, aksi }: {
  nomor: number;
  id: string;
  judul: string;
  keterangan: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="sx-kepala" data-muncul="">
      <div className="sx-kiri">
        <p className="sx-nomor" aria-hidden="true">
          <GarisTangga anak={nomor} className="sx-nomor-garis" />
          {String(nomor).padStart(2, "0")}
        </p>
        <h2 id={id} className="sx-judul">
          <Kata teks={judul} />
        </h2>
      </div>
      <div className="sx-kanan">
        <p className="sx-ket">{keterangan}</p>
        {aksi && <div className="sx-aksi">{aksi}</div>}
      </div>
    </div>
  );
}

export default function HalamanBeranda() {
  const jadwal = jadwalPengusulan(6);
  const tangga = tanggaGaji();

  return (
    <div className="beranda">
      {/* ── Panggung: cek status dan tangga gaji ─────────────────────────── */}
      <section id="beranda" className="tg" aria-labelledby="tg-judul">
        <div className="pub-container tg-kisi">
          <div className="tg-teks">
            <p className="tg-atas masuk" style={{ "--d": 0 } as React.CSSProperties}>
              Kenaikan gaji berkala, Kanwil Ditjenpas Kalsel
            </p>
            <h1 id="tg-judul" className="tg-judul">
              <Kata teks="Setiap dua tahun, satu anak tangga." jeda={1} />
            </h1>
            <p className="tg-lead masuk" style={{ "--d": 220 } as React.CSSProperties}>
              Cek status KGB dengan NIP, lalu lihat kapan anak tangga berikutnya tiba. Untuk pegawai Kanwil Ditjenpas
              Kalimantan Selatan dan UPT di wilayahnya.
            </p>
            <div className="tg-cari masuk" style={{ "--d": 300 } as React.CSSProperties}>
              <CekStatus />
            </div>
            <p className="tg-bantu masuk" style={{ "--d": 380 } as React.CSSProperties}>
              Admin UPT yang akan mengusulkan? <Link href="/panduan#untuk-upt">Baca panduan menyiapkan surat</Link>
            </p>
          </div>

          <div className="tg-visual masuk" style={{ "--d": 140 } as React.CSSProperties}>
            <PenjelajahTangga baris={tangga} />
          </div>
        </div>
      </section>

      {/* ── Alur ─────────────────────────────────────────────────────────── */}
      <section id="alur" className="sx" aria-labelledby="judul-alur">
        <div className="pub-container">
          <KepalaBagian
            nomor={1}
            id="judul-alur"
            judul="Perjalanan satu usulan"
            keterangan="Ikuti satu surat usulan KGB dari UPT sampai SK dikonfirmasi keuangan. Dokumennya berubah seiring langkah yang sedang dibaca."
            aksi={
              <Link href="/panduan#ringkasan" className="sx-tautan">
                Alur lengkap di panduan
              </Link>
            }
          />
          <PerjalananUsulan contoh={CONTOH} />
        </div>
      </section>

      {/* ── Jadwal ───────────────────────────────────────────────────────── */}
      <section id="jadwal" className="sx sx-jadwal" aria-labelledby="judul-jadwal">
        <div className="pub-container">
          <KepalaBagian
            nomor={2}
            id="judul-jadwal"
            judul="Jadwal pengusulan"
            keterangan="Dihitung dari hari ini. Kirim surat permohonan sebelum input untuk TMT itu dibuka, agar SK terbit tepat waktu."
            aksi={
              <Link href="/panduan#jadwal" className="sx-tautan">
                Aturan jadwal
              </Link>
            }
          />

          <ol className="jd-tangga" aria-label="Jadwal pengusulan untuk enam TMT KGB berikutnya">
            {jadwal.map((b, i) => (
              <li
                key={b.tmt.getTime()}
                className="jd-anak"
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
      <section id="status" className="sx sx-status" aria-labelledby="judul-status">
        <div className="pub-container">
          <KepalaBagian
            nomor={3}
            id="judul-status"
            judul="Arti status"
            keterangan="Status yang tampil saat NIP dicek, berurutan sesuai tahap usulan yang sedang berjalan."
            aksi={
              <Link href="/panduan#pertanyaan" className="sx-tautan">
                Pertanyaan umum
              </Link>
            }
          />

          <ol className="st-alur">
            {URUTAN_STATUS.map((s, i) => (
              <li key={s} className="st-tahap" data-muncul="" style={{ "--i": i } as React.CSSProperties}>
                <span className="st-titik" aria-hidden="true" />
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
          <div className="bt-kisi" data-muncul="">
            <div className="bt-teks">
              <h2 id="judul-bantuan" className="bt-judul">
                Butuh bantuan?
              </h2>
              <p>
                Tim SDM Kanwil Ditjenpas Kalimantan Selatan melayani pertanyaan KGB pada jam kerja. Admin UPT dianjurkan
                membaca panduan sebelum mengirim surat permohonan.
              </p>
              <div className="bt-aksi">
                <Link href="/panduan" className="pub-btn">
                  Baca panduan KGB
                </Link>
                <Link href="/login" className="pub-btn-secondary">
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
