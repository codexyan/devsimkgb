import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { jadwalPengusulan } from "@/lib/jadwalPengusulan";
import { STATUS_KGB, type StatusKgb } from "@/lib/statusKgb";
import { formatTanggalId } from "@/lib/waktu";
import Huruf from "../Huruf";
import CekStatus from "./CekStatus";
import KanvasLogo from "./KanvasLogo";
import "./beranda.css";

export const metadata: Metadata = {
  title: "Cek Status KGB",
  description:
    "Cek status dan jadwal kenaikan gaji berkala pegawai Kanwil Ditjenpas Kalimantan Selatan dan UPT di wilayahnya, beserta alur dan jadwal pengusulannya.",
};

// Jadwal pengusulan dihitung dari tanggal hari ini (WITA), jadi halaman dirender per permintaan.
export const dynamic = "force-dynamic";

const LANGKAH: { judul: string; pelaksana: string; hasil: string | StatusKgb }[] = [
  { judul: "UPT mengirim surat permohonan", pelaksana: "Admin kepegawaian dan Kepala UPT", hasil: "Surat masuk ke Kanwil lewat Srikandi" },
  { judul: "Agenda dan disposisi", pelaksana: "Tata Usaha, Kepala Kanwil, Kabag Tata Usaha dan Umum", hasil: "Tim SDM menerima disposisi" },
  { judul: "Input KGB dan buat SK", pelaksana: "Tim SDM Kanwil", hasil: "sedang_diproses" },
  { judul: "Tanda tangan elektronik SK", pelaksana: "Kepala Kanwil, atau Plh, Plt, Direktur Jenderal", hasil: "SK sah di Srikandi" },
  { judul: "Pengiriman SK", pelaksana: "Tim SDM Kanwil", hasil: "UPT, keuangan UPT, dan KPPN mitra" },
  { judul: "Unggah SK ke SIM-KGB", pelaksana: "Tim SDM Kanwil", hasil: "menunggu_keuangan" },
  { judul: "Konfirmasi keuangan", pelaksana: "Bagian keuangan", hasil: "selesai" },
];

const PANDUAN_CEPAT = [
  { href: "/panduan#untuk-upt", label: "Surat permohonan" },
  { href: "/panduan#kewenangan", label: "Siapa menetapkan" },
  { href: "/panduan#pengiriman-sk", label: "KPPN mitra" },
];

const tanggalPanjang = (d: Date) => formatTanggalId(d);
const bulanTahun = (d: Date) => formatTanggalId(d, { month: "long", year: "numeric" });
const tanggalPendek = (d: Date) => formatTanggalId(d, { day: "numeric", month: "short", year: "numeric" });

function Status({ status }: { status: StatusKgb }) {
  const info = STATUS_KGB[status];
  return <span className={`pub-status ${info.kelas}`}>{info.label}</span>;
}

function KepalaBagian({ id, judul, keterangan, aksi }: { id: string; judul: string; keterangan: string; aksi?: React.ReactNode }) {
  return (
    <div className="sx-kepala" data-muncul="">
      <div>
        <h2 id={id} className="sx-judul" aria-label={judul}>
          <Huruf teks={judul} kelasKata="sx-kata" kelasHuruf="sx-huruf" />
        </h2>
        <p className="sx-ket">{keterangan}</p>
      </div>
      {aksi && <div className="sx-aksi">{aksi}</div>}
    </div>
  );
}

const Panah = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function HalamanBeranda() {
  const jadwal = jadwalPengusulan(6);

  return (
    <div className="beranda">
      {/* ── Panggung ───────────────────────────────────────────────────── */}
      <section id="beranda" className="pb" aria-labelledby="pb-judul">
        <div className="pb-lapis">
          <KanvasLogo />

          <div className="pb-isi">
            <div className="pb-teks">
              <h1 id="pb-judul" className="pb-judul" aria-label="Kenaikan Gaji Berkala">
                <Huruf teks="Kenaikan Gaji Berkala" kelasKata="pb-kata" kelasHuruf="pb-huruf" />
              </h1>
              <p className="pb-sub pb-masuk" style={{ "--d": 620 } as React.CSSProperties}>
                Status dan jadwal KGB pegawai Kanwil Ditjenpas Kalimantan Selatan dan UPT di wilayahnya, beserta
                alur pengusulannya.
              </p>
              <div className="pb-cari pb-masuk" style={{ "--d": 760 } as React.CSSProperties}>
                <CekStatus />
              </div>
              <nav className="pb-topik pb-masuk" style={{ "--d": 900 } as React.CSSProperties} aria-label="Panduan singkat">
                <span className="pb-topik-label">Panduan</span>
                {PANDUAN_CEPAT.map((p) => (
                  <Link key={p.href} href={p.href} className="pb-chip">
                    {p.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="pb-logo" aria-hidden="true">
              <Image src="/icons.svg" alt="" width={141} height={112} loading="eager" fetchPriority="high" />
            </div>
          </div>

          <div className="pb-kaki pb-masuk" style={{ "--d": 1040 } as React.CSSProperties}>
            <div className="pb-kaki-dalam">
              <p className="lt-label" id="lt-label">
                Layanan terkait
              </p>
              <ul className="lt-daftar" aria-labelledby="lt-label">
                <li>
                  <a href="https://paskalsel.online" className="lt-butir" target="_blank" rel="noopener noreferrer">
                    <span className="lt-logo">
                      <Image src="/icons.svg" alt="" width={34} height={27} loading="eager" />
                    </span>
                    <span className="lt-nama">Portal SDM Pas Kalsel</span>
                    <span className="pub-visually-hidden"> (membuka tab baru)</span>
                  </a>
                </li>
                <li>
                  <a href="https://myasn.bkn.go.id" className="lt-butir" target="_blank" rel="noopener noreferrer">
                    <span className="lt-logo lt-logo-lebar">
                      <Image src="/logo-myasn.png" alt="" width={62} height={20} />
                    </span>
                    <span className="lt-nama">MyASN</span>
                    <span className="pub-visually-hidden"> (membuka tab baru)</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Lembar isi ─────────────────────────────────────────────────── */}
      <div className="lembar">
        <div className="pub-container">
          <section className="sx" aria-labelledby="judul-alur" id="alur">
            <KepalaBagian
              id="judul-alur"
              judul="Alur pengajuan"
              keterangan="Satu usulan KGB pegawai UPT melewati tujuh langkah, dari surat permohonan sampai jadwal KGB berikutnya tercatat."
              aksi={
                <Link href="/panduan#ringkasan" className="sx-tautan">
                  Alur lengkap di panduan
                </Link>
              }
            />
            <ol className="al-daftar">
              {LANGKAH.map((l, i) => (
                <li key={l.judul} className="al-langkah" data-muncul="" style={{ "--i": i } as React.CSSProperties}>
                  <span className="al-nomor" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="al-teks">
                    <h3 className="al-judul">
                      <span className="pub-visually-hidden">Langkah {i + 1}: </span>
                      {l.judul}
                    </h3>
                    <p className="al-siapa">{l.pelaksana}</p>
                  </div>
                  <p className="al-hasil">
                    <span className="pub-visually-hidden">Hasil: </span>
                    {l.hasil in STATUS_KGB ? <Status status={l.hasil as StatusKgb} /> : l.hasil}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="sx" aria-labelledby="judul-jadwal" id="jadwal">
            <KepalaBagian
              id="judul-jadwal"
              judul="Jadwal pengusulan"
              keterangan="Dihitung dari hari ini. Kirim surat permohonan sebelum input untuk TMT itu dibuka, agar SK terbit tepat waktu."
              aksi={
                <Link href="/panduan#jadwal" className="sx-tautan">
                  Aturan jadwal
                </Link>
              }
            />
            <div className="jd-kisi">
              <div className="jd-kartu" data-muncul="">
                <table className="jd-tabel">
                  <caption className="pub-visually-hidden">Jadwal pengusulan KGB untuk enam bulan TMT berikutnya</caption>
                  <thead>
                    <tr>
                      <th scope="col">TMT KGB</th>
                      <th scope="col">Kirim surat</th>
                      <th scope="col">Input di SIM-KGB</th>
                      <th scope="col">Keadaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jadwal.map((b) => (
                      <tr key={b.tmt.getTime()} data-keadaan={b.keadaan}>
                        <th scope="row" data-label="TMT KGB">
                          {tanggalPanjang(b.tmt)}
                        </th>
                        <td data-label="Kirim surat">{bulanTahun(b.kirimSurat)}</td>
                        <td data-label="Input di SIM-KGB">
                          {b.inputDibuka.getDate()}–{tanggalPendek(b.batasInput)}
                        </td>
                        <td data-label="Keadaan">
                          {b.keadaan === "terbuka" ? (
                            <span className="jd-terbuka">Input sedang dibuka</span>
                          ) : (
                            <span className="jd-nanti">Dibuka {tanggalPendek(b.inputDibuka)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="jd-catatan">
                <div data-muncul="" style={{ "--i": 0 } as React.CSSProperties}>
                  <h3>Setiap dua tahun</h3>
                  <p>
                    KGB diberikan setiap dua tahun. PNS yang pertama kali diangkat dalam golongan II/a menerima KGB
                    pertama setelah masa kerja satu tahun.
                  </p>
                </div>
                <div data-muncul="" style={{ "--i": 1 } as React.CSSProperties}>
                  <h3>Surat tetap wajib</h3>
                  <p>Walaupun data pegawai sudah ada di SIM-KGB, surat UPT tetap menjadi dasar agenda dan disposisi.</p>
                </div>
                <div data-muncul="" style={{ "--i": 2 } as React.CSSProperties}>
                  <h3>Terlambat tetap diproses</h3>
                  <p>TMT tidak berubah. Selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="sx" aria-labelledby="judul-status" id="status">
            <KepalaBagian
              id="judul-status"
              judul="Arti status"
              keterangan="Status yang tampil saat NIP dicari, sesuai tahap usulan yang sedang berjalan."
              aksi={
                <Link href="/panduan#pertanyaan" className="sx-tautan">
                  Pertanyaan umum
                </Link>
              }
            />
            <dl className="st-kisi">
              {(Object.keys(STATUS_KGB) as StatusKgb[]).map((s, i) => (
                <div key={s} className="st-butir" data-muncul="" style={{ "--i": i } as React.CSSProperties}>
                  <dt>
                    <Status status={s} />
                  </dt>
                  <dd>{STATUS_KGB[s].keterangan}</dd>
                </div>
              ))}
              <div className="st-butir" data-muncul="" style={{ "--i": 5 } as React.CSSProperties}>
                <dt>
                  <span className="pub-status pub-status-rapelan">Berpotensi rapelan</span>
                </dt>
                <dd>Tanda tambahan, bukan status: KGB diinput setelah batas waktu. TMT tetap sama.</dd>
              </div>
            </dl>
          </section>

          <section className="pt" aria-labelledby="judul-bantuan" id="bantuan">
            <div className="pt-dalam" data-muncul="">
              <svg className="pt-cincin" viewBox="0 0 1100 560" aria-hidden="true" focusable="false">
                <ellipse cx="550" cy="280" rx="520" ry="150" transform="rotate(-9 550 280)" pathLength={1} />
                <ellipse cx="550" cy="280" rx="430" ry="230" transform="rotate(14 550 280)" pathLength={1} />
              </svg>
              <h2 id="judul-bantuan" className="pt-judul">
                Butuh bantuan?
              </h2>
              <p className="pt-teks">
                Tim SDM Kanwil Ditjenpas Kalimantan Selatan melayani pada <span className="pt-jam">Senin–Kamis 07.30–16.00</span>{" "}
                dan <span className="pt-jam">Jumat 07.30–16.30 WITA</span>. Admin UPT dianjurkan membaca panduan sebelum
                mengirim surat permohonan.
              </p>
              <div className="pt-aksi">
                <Link href="/panduan" className="pt-utama">
                  Baca panduan KGB
                  <span className="pt-utama-ikon">{Panah}</span>
                </Link>
                <Link href="/login" className="pt-kedua">
                  Masuk ke SIM-KGB
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
