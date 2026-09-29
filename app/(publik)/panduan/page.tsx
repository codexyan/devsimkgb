import type { Metadata } from "next";
import Link from "next/link";
import { getGajiPokok, getPangkat, kalkulasiKGB } from "@/lib/tabelGaji";
import { satkerPerKppn } from "@/lib/satker";
import { STATUS_KGB, type StatusKgb } from "@/lib/statusKgb";
import { formatTanggalId } from "@/lib/waktu";
import GarisTangga from "../GarisTangga";
import Kata from "../Kata";
import { DaftarIsiPanduan, PilihPeran } from "./NavigasiPanduan";
import "./panduan.css";

export const metadata: Metadata = {
  title: "Panduan KGB",
  description:
    "Cara mengusulkan dan memproses SK kenaikan gaji berkala pegawai Kanwil dan UPT di lingkungan Kanwil Ditjenpas Kalimantan Selatan.",
};

/* ── Format (tanggal kalender WITA, sama dengan SIM-KGB) ───────────────── */
const tgl = (d: Date) => formatTanggalId(d);
const bulanTahun = (d: Date) => formatTanggalId(d, { month: "long", year: "numeric" });
const rp = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const mkg = (tahun: number, bulan: number) => `${tahun} tahun ${bulan} bulan`;

/* ── Contoh kasus: usulan Rutan Kelas IIB Rantau (data pribadi disamarkan) ── */
const GOLONGAN = "II/a";
const PANGKAT = `${getPangkat(GOLONGAN)} (${GOLONGAN})`;
const TMT_CPNS = new Date(2025, 5, 1);
const TMT_KGB = new Date(2026, 5, 1);
const TANGGAL_SURAT = new Date(2026, 8, 8);
const TANGGAL_DITERIMA = new Date(2026, 8, 10);
const TANGGAL_DISPOSISI = new Date(2026, 8, 14);

const kasus = kalkulasiKGB({
  golonganRuang: GOLONGAN,
  mkgTahun: 0,
  mkgBulan: 0,
  tmtKgbBerikutnya: TMT_KGB,
  tmtKgbTerakhir: TMT_CPNS,
});
const siklusBerikutnya = kalkulasiKGB({
  golonganRuang: GOLONGAN,
  mkgTahun: kasus.mkgTahunBaru,
  mkgBulan: kasus.mkgBulanBaru,
  tmtKgbBerikutnya: kasus.tmtKgbBerikutnya,
  tmtKgbTerakhir: kasus.tmtKgbBaru,
});

const GAJI_MKG_0 = getGajiPokok(GOLONGAN, 0, 0);
const GAJI_MKG_1 = getGajiPokok(GOLONGAN, 1, 0);
const GAJI_MKG_3 = getGajiPokok(GOLONGAN, 3, 0);
const selisihGaji = kasus.gajiPokokBaru - GAJI_MKG_0;
const suratSetelahBatas = TANGGAL_SURAT > kasus.deadlineSDM;

/* Aturan praktis UPT: kirim pada bulan ketiga sebelum TMT; surat paling lambat diterima awal bulan kedua. */
const bulanKirim = (tmt: Date) => new Date(tmt.getFullYear(), tmt.getMonth() - 3, 1);

const HAL_SURAT = "Permohonan Penerbitan Surat Keputusan Kenaikan Gaji Berkala";
const KANWIL = "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";

const DAFTAR_ISI = [
  { id: "ringkasan", judul: "Alur singkat" },
  { id: "kewenangan", judul: "Siapa yang menetapkan KGB" },
  { id: "jadwal", judul: "Kapan KGB diberikan dan diusulkan" },
  { id: "untuk-upt", judul: "Untuk admin UPT" },
  { id: "di-kanwil", judul: "Di Kanwil: agenda dan disposisi" },
  { id: "di-sim-kgb", judul: "Di SIM-KGB: langkah Tim SDM" },
  { id: "keuangan", judul: "Konfirmasi keuangan" },
  { id: "pengiriman-sk", judul: "Pengiriman SK dan KPPN mitra" },
  { id: "contoh-kasus", judul: "Contoh kasus Rutan Rantau" },
  { id: "status", judul: "Arti status" },
  { id: "pertanyaan", judul: "Pertanyaan umum" },
  { id: "dasar-hukum", judul: "Dasar hukum dan rujukan" },
] as const;

const URUTAN_STATUS: StatusKgb[] = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai", "ditolak"];

function Status({ status }: { status: StatusKgb }) {
  const info = STATUS_KGB[status];
  return <span className={`pub-status ${info.kelas}`}>{info.label}</span>;
}

function TandaRapelan() {
  return <span className="pub-status pub-status-rapelan">Berpotensi rapelan</span>;
}

export default function PanduanPage() {
  const kppn = satkerPerKppn();

  return (
    <div className="pub-container pg">
      <header className="pg-kepala">
        <p className="pg-atas masuk">
          <GarisTangga anak={2} className="pg-atas-garis" />
          Panduan untuk UPT dan Kanwil
        </p>
        <h1 className="pub-h1 pg-judul">
          <Kata teks="Panduan kenaikan gaji berkala" />
        </h1>
        <div className="pg-pengantar masuk" style={{ "--d": 180 } as React.CSSProperties}>
          <p className="pub-lead">
            Panduan ini untuk admin kepegawaian UPT yang mengusulkan kenaikan gaji berkala (KGB), serta Tata Usaha, Tim
            SDM, dan bagian keuangan Kanwil yang memprosesnya. Isinya mencakup kewenangan, jadwal, cara menyusun surat
            permohonan, langkah di SIM-KGB, sampai pengiriman SK.
          </p>
          <p className="pub-meta">
            Berlaku untuk pegawai Kanwil dan UPT di lingkungan Kanwil Ditjenpas Kalimantan Selatan. Diperbarui September
            2026.
          </p>
        </div>
      </header>

      <div className="masuk" style={{ "--d": 260 } as React.CSSProperties}>
        <PilihPeran />
      </div>

      <div className="pg-kisi">
        <DaftarIsiPanduan daftar={DAFTAR_ISI} />

        <div className="pg-isi">
          {/* 1. Alur singkat */}
          <section className="pub-prose pg-bagian">
            <h2 id="ringkasan" className="pub-h2 pub-h2-flush">
              Alur singkat
            </h2>
            <p>
              Satu usulan KGB melewati tujuh langkah berikut, dari surat UPT sampai SIM-KGB menjadwalkan KGB
              berikutnya.
            </p>
            <ol className="pub-steps">
              <li>
                <h3 className="pub-step-title">UPT mengirim surat permohonan</h3>
                <p className="pub-step-who">Admin kepegawaian UPT dan Kepala UPT</p>
                <p>
                  Surat dinas ditandatangani secara elektronik oleh Kepala UPT dan dikirim melalui Srikandi kepada
                  Kepala Kanwil, lengkap dengan lampirannya.
                </p>
                <p className="pg-hasil">Hasil: surat usulan masuk ke Kanwil.</p>
              </li>
              <li>
                <h3 className="pub-step-title">Agenda dan disposisi</h3>
                <p className="pub-step-who">Tata Usaha, Kepala Kanwil, Kepala Bagian Tata Usaha dan Umum</p>
                <p>
                  Tata Usaha mencatat surat pada Lembar Disposisi. Kepala Kanwil memberi disposisi “u/
                  ditindaklanjuti” kepada Kepala Bagian Tata Usaha dan Umum, yang meneruskannya kepada Ketua Tim SDM.
                </p>
                <p className="pg-hasil">Hasil: Tim SDM menerima perintah tertulis untuk memproses usulan.</p>
              </li>
              <li>
                <h3 className="pub-step-title">Pemeriksaan, Input KGB, dan Buat SK</h3>
                <p className="pub-step-who">Tim SDM Kanwil</p>
                <p>
                  Tim SDM mencocokkan data dan lampiran, memilih Input KGB di SIM-KGB, lalu Buat SK. SIM-KGB
                  menghasilkan SK biasa dan SK versi Srikandi.
                </p>
                <p className="pg-hasil">
                  Hasil: status <Status status="sedang_diproses" />.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Tanda tangan elektronik SK</h3>
                <p className="pub-step-who">Kepala Kanwil, atau Plh, Plt, atau Direktur Jenderal sesuai keadaan</p>
                <p>SK versi Srikandi ditandatangani secara elektronik di Srikandi.</p>
                <p className="pg-hasil">Hasil: SK sah dan siap dikirim.</p>
              </li>
              <li>
                <h3 className="pub-step-title">Pengiriman SK</h3>
                <p className="pub-step-who">Tim SDM Kanwil</p>
                <p>
                  SK yang sudah ditandatangani dikirim kepada UPT pengusul, bagian keuangan UPT, dan KPPN mitra
                  satker.
                </p>
                <p className="pg-hasil">Hasil: ketiga penerima memegang SK yang sama.</p>
              </li>
              <li>
                <h3 className="pub-step-title">Unggah SK ke SIM-KGB</h3>
                <p className="pub-step-who">Tim SDM Kanwil</p>
                <p>Berkas PDF SK yang sudah ditandatangani diunggah dengan tombol Unggah SK TTE.</p>
                <p className="pg-hasil">
                  Hasil: status <Status status="menunggu_keuangan" />.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Konfirmasi keuangan dan jadwal berikutnya</h3>
                <p className="pub-step-who">Bagian keuangan</p>
                <p>
                  Bagian keuangan memeriksa SK dan memilih Konfirmasi, atau Tinjau dan Konfirmasi untuk KGB yang
                  berpotensi rapelan. SIM-KGB memperbarui data pegawai dan membuat jadwal KGB berikutnya.
                </p>
                <p className="pg-hasil">
                  Hasil: status <Status status="selesai" />, dan KGB berikutnya tercatat{" "}
                  <Status status="belum_diproses" />.
                </p>
              </li>
            </ol>
            <div className="pub-note">
              <strong className="pub-note-title">Surat permohonan tetap wajib</strong>
              <p>
                Walaupun data pegawai dan jadwal KGB sudah ada di SIM-KGB, UPT tetap mengirim surat permohonan. Surat
                itu menjadi dasar agenda dan disposisi di Kanwil.
              </p>
            </div>
          </section>

          {/* 2. Kewenangan */}
          <section className="pub-prose pg-bagian">
            <h2 id="kewenangan" className="pub-h2">
              Siapa yang menetapkan KGB
            </h2>
            <p>
              Berdasarkan Keputusan Menteri Imigrasi dan Pemasyarakatan Nomor M.IP-01.OT.01.01 Tahun 2025 tentang
              Wewenang dan Pelimpahan Kewenangan pada Bidang Sumber Daya Manusia di Lingkungan Kementerian Imigrasi dan
              Pemasyarakatan, kewenangan KGB pegawai Kanwil dan UPT dilimpahkan kepada Kepala Kantor Wilayah.
            </p>
            <ul>
              <li>
                <strong>Kepala UPT mengusulkan.</strong> Kepala UPT menandatangani surat permohonan, bukan SK KGB.
              </li>
              <li>
                <strong>Kepala Kanwil menetapkan.</strong> SK KGB pegawai Kanwil dan seluruh UPT ditandatangani
                Kepala Kanwil.
              </li>
            </ul>
            <p>
              Untuk keadaan yang tidak diatur secara tegas dalam keputusan tersebut, Kanwil memakai ketentuan pada
              tabel berikut.
            </p>
            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel penandatangan SK KGB">
              <table className="pub-table">
                <caption>Penandatangan SK KGB menurut keadaan</caption>
                <thead>
                  <tr>
                    <th scope="col">Keadaan</th>
                    <th scope="col">Penandatangan SK</th>
                    <th scope="col">Dasar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Kepala Kanwil ada dan tidak berhalangan</th>
                    <td>Kepala Kanwil</td>
                    <td>Keputusan Menteri tentang pelimpahan kewenangan</td>
                  </tr>
                  <tr>
                    <th scope="row">Kepala Kanwil berhalangan sementara</th>
                    <td>Plh. Kepala Kanwil</td>
                    <td>Ketentuan yang dipakai Kanwil</td>
                  </tr>
                  <tr>
                    <th scope="row">Jabatan Kepala Kanwil kosong</th>
                    <td>Plt. Kepala Kanwil</td>
                    <td>Ketentuan yang dipakai Kanwil</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      KGB milik Kepala Kanwil sendiri, termasuk milik pejabat yang sedang menjadi Plh atau Plt
                    </th>
                    <td>Direktur Jenderal Pemasyarakatan</td>
                    <td>Ketentuan yang dipakai Kanwil</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Data penandatangan dan masa berlakunya disimpan di SIM-KGB pada menu Pengaturan, bagian Penandatangan
              Surat KGB. Saat SK dibuat, SIM-KGB memilih penandatangan yang berlaku pada tanggal SK. Bila belum ada
              penandatangan yang berlaku pada tanggal itu, SK tidak dapat dibuat sampai datanya dilengkapi.
            </p>
          </section>

          {/* 3. Jadwal */}
          <section className="pub-prose pg-bagian">
            <h2 id="jadwal" className="pub-h2">
              Kapan KGB diberikan dan kapan diusulkan
            </h2>

            <h3 className="pub-h3">Selang waktu KGB</h3>
            <p>
              KGB diberikan setiap 2 tahun sekali; PNS yang pertama kali diangkat dalam golongan II/a menerima KGB
              pertama setelah mempunyai masa kerja 1 tahun, lalu setiap 2 tahun berikutnya.
            </p>
            <p>
              Menurut PP 5/2024, gaji pokok golongan II berubah pada masa kerja golongan (MKG) ganjil (1, 3, 5, dan
              seterusnya), sedangkan golongan III pada MKG genap (2, 4, 6, dan seterusnya). TMT KGB ditetapkan pada
              tanggal 1 bulan ketika masa kerja golongan yang dipersyaratkan tercapai.
            </p>
            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel gaji pokok golongan II/a">
              <table className="pub-table">
                <caption>Gaji pokok golongan II/a pada tiga langkah pertama (PP 5/2024)</caption>
                <thead>
                  <tr>
                    <th scope="col">Masa kerja golongan</th>
                    <th scope="col">Keterangan</th>
                    <th scope="col" className="pub-num">
                      Gaji pokok
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{mkg(0, 0)}</th>
                    <td>Saat pertama diangkat</td>
                    <td className="pub-num">{rp(GAJI_MKG_0)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{mkg(1, 0)}</th>
                    <td>KGB pertama, setelah 1 tahun</td>
                    <td className="pub-num">{rp(GAJI_MKG_1)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{mkg(3, 0)}</th>
                    <td>KGB kedua, 2 tahun setelah KGB pertama</td>
                    <td className="pub-num">{rp(GAJI_MKG_3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="pub-h3">Syarat</h3>
            <p>
              Syarat KGB PNS menurut PP 7/1977 Pasal 11: (a) telah mencapai masa kerja golongan yang ditentukan untuk
              kenaikan gaji berkala, dan (b) penilaian pelaksanaan pekerjaan dengan nilai rata-rata sekurang-kurangnya
              “cukup”. Penilaian kinerja dibuktikan dengan SKP terakhir sesuai ketentuan yang berlaku.
            </p>

            <h3 className="pub-h3">Bila pegawai dijatuhi hukuman disiplin</h3>
            <p>
              PP 94/2021 Pasal 8 ayat (3) mengatur hukuman disiplin sedang berupa pemotongan tunjangan kinerja 25%
              selama 6, 9, atau 12 bulan, tetapi menurut Pasal 42, sebelum PP mengenai Gaji dan Tunjangan berlaku,
              hukuman disiplin sedang masih mengikuti Pasal 7 ayat (3) PP 53/2010, termasuk penundaan kenaikan gaji
              berkala selama 1 tahun. Selain karena hukuman disiplin, KGB ditunda paling lama 1 tahun apabila syarat
              penilaian pelaksanaan pekerjaan belum terpenuhi (PP 7/1977 Pasal 13).
            </p>
            <p>
              Di SIM-KGB, hukuman disiplin yang jenisnya menunda KGB menahan proses. Selama hukuman itu masih berlaku,
              Input KGB dan Arsip KGB pegawai tersebut ditolak, dan jadwal KGB bergeser sesuai lama penundaan. Saat
              KGB akhirnya dihitung, selisih waktu sejak TMT KGB terakhir dihitung penuh. Bila pegawai sedang
              memiliki KGB berstatus Sedang Diproses atau Menunggu Keuangan, hukuman disiplin yang menunda KGB hanya
              dapat dicatat bila mulai berlaku setelah TMT KGB tersebut, dan penundaannya menggeser KGB berikutnya.
            </p>

            <h3 className="pub-h3">Jendela proses di Kanwil</h3>
            <p>
              Kirim usulan KGB sebelum jendela proses dibuka, yaitu pada bulan ketiga sebelum TMT, karena PP 7/1977
              Pasal 12 ayat (2) mengatur pemberitahuan KGB diterbitkan 2 bulan sebelum KGB berlaku; batas waktu
              pengiriman usulan mengikuti jadwal yang ditetapkan Kanwil.
            </p>
            <p>
              Jadwal Kanwil mengikuti jendela proses di SIM-KGB. Untuk TMT pada tanggal 1 suatu bulan, input KGB
              dibuka pada tanggal 1 bulan kedua sebelum TMT, dan Tim SDM harus selesai menginput paling lambat hari
              terakhir bulan itu. Input sebelum jendela dibuka ditolak SIM-KGB. Input setelah batas tetap diterima,
              tetapi ditandai <TandaRapelan />.
            </p>
            <p>
              Semua tanggal di SIM-KGB, termasuk pembukaan jendela proses, batas proses Tim SDM, dan TMT, dihitung
              menurut tanggal kalender WITA.
            </p>
            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel jendela proses KGB">
              <table className="pub-table">
                <caption>Contoh jendela proses untuk TMT {tgl(TMT_KGB)}</caption>
                <thead>
                  <tr>
                    <th scope="col">Tahap</th>
                    <th scope="col">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">UPT sebaiknya mengirim surat permohonan</th>
                    <td>{bulanTahun(bulanKirim(TMT_KGB))}</td>
                  </tr>
                  <tr>
                    <th scope="row">Surat paling lambat diterima Kanwil</th>
                    <td>awal {bulanTahun(kasus.unlockDate)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Jendela proses dibuka (input KGB dapat dimulai)</th>
                    <td>{tgl(kasus.unlockDate)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Batas proses Tim SDM</th>
                    <td>{tgl(kasus.deadlineSDM)}</td>
                  </tr>
                  <tr>
                    <th scope="row">TMT KGB</th>
                    <td>{tgl(TMT_KGB)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="pub-note">
              <strong className="pub-note-title">Aturan praktis untuk UPT</strong>
              <p>
                Kirim surat pada bulan ketiga sebelum TMT, sebelum jendela proses dibuka. Surat paling lambat
                diterima Kanwil awal bulan kedua sebelum TMT agar dapat diinput sebelum batas proses Tim SDM. Untuk
                TMT {tgl(TMT_KGB)}: kirim pada {bulanTahun(bulanKirim(TMT_KGB))}, surat paling lambat diterima awal{" "}
                {bulanTahun(kasus.unlockDate)}.
              </p>
            </div>

            <h3 className="pub-h3">Bila usulan terlambat</h3>
            <p>
              Usulan yang datang setelah jendela proses tetap diproses dan TMT tidak bergeser. Jika SK KGB terbit
              setelah TMT, selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji: operator gaji satker merekam SK
              KGB di aplikasi Gaji Web, lalu satker mengajukan SPM-LS kekurangan gaji ke KPPN. Pembayaran ini
              sehari-hari disebut rapel atau rapelan.
            </p>
          </section>

          {/* 4. Untuk admin UPT */}
          <section className="pub-prose pg-bagian">
            <h2 id="untuk-upt" className="pub-h2">
              Untuk admin UPT: menyiapkan surat permohonan
            </h2>
            <p>
              Bagian ini untuk admin kepegawaian UPT. Pakai daftar periksa berikut setiap kali ada pegawai yang
              mendekati jadwal KGB.
            </p>

            <h3 className="pub-h3">Daftar periksa</h3>
            <ul>
              <li>
                Buat surat dinas dari Kepala UPT kepada Kepala {KANWIL}. Surat ditandatangani secara elektronik oleh
                Kepala UPT dan dikirim melalui Srikandi.
              </li>
              <li>Isi Hal dengan “{HAL_SURAT}”.</li>
              <li>
                Satu surat boleh memuat beberapa pegawai. Susun dalam tabel dengan kolom No, Nama, NIP,
                Pangkat/Golongan, Jabatan, TMT CPNS (untuk KGB pertama) atau TMT KGB terakhir, dan Keterangan berisi
                “Usulan KGB”.
              </li>
              <li>Lampirkan dokumen sesuai keadaan setiap pegawai (lihat tabel lampiran di bawah).</li>
              <li>
                Cocokkan NIP, golongan, masa kerja golongan, dan TMT pada tabel dengan SK yang dilampirkan. Salin TMT
                dari SK, bukan tanggal penetapan SK.
              </li>
              <li>
                Kirim pada bulan ketiga sebelum TMT, sebelum jendela proses dibuka; surat paling lambat diterima awal
                bulan kedua sebelum TMT agar dapat diinput sebelum batas proses Tim SDM (lihat{" "}
                <a href="#jadwal">jadwal</a>).
              </li>
            </ul>

            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel lampiran surat permohonan">
              <table className="pub-table">
                <caption>Lampiran surat permohonan</caption>
                <thead>
                  <tr>
                    <th scope="col">Keadaan pegawai</th>
                    <th scope="col">Dokumen yang dilampirkan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">KGB pertama setelah pengangkatan</th>
                    <td>
                      <ul>
                        <li>SK pengangkatan CPNS</li>
                        <li>SK pengangkatan PNS</li>
                        <li>SPMT (surat pernyataan melaksanakan tugas), seperti pada usulan yang biasa diterima Kanwil</li>
                        <li>SKP atau penilaian kinerja terakhir</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">KGB berikutnya</th>
                    <td>
                      <ul>
                        <li>SK kenaikan pangkat terakhir</li>
                        <li>SK KGB terakhir</li>
                        <li>SKP atau penilaian kinerja terakhir</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Daftar ini adalah praktik yang dipakai Kanwil, bukan daftar yang ditetapkan peraturan. Tim SDM Kanwil
              dapat meminta dokumen lain bila diperlukan.
            </p>

            <figure>
              <div className="pub-doc">
                <div className="pub-doc-kop">
                  <p>Direktorat Jenderal Pemasyarakatan</p>
                  <p>Rumah Tahanan Negara Kelas IIB Rantau</p>
                </div>
                <p className="pg-doc-kanan">Rantau, {tgl(TANGGAL_SURAT)}</p>
                <dl className="pg-doc-meta">
                  <div>
                    <dt>Nomor</dt>
                    <dd>(nomor surat UPT)</dd>
                  </div>
                  <div>
                    <dt>Lampiran</dt>
                    <dd>1 berkas</dd>
                  </div>
                  <div>
                    <dt>Hal</dt>
                    <dd>{HAL_SURAT}</dd>
                  </div>
                </dl>
                <p>
                  Yth. Kepala Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan
                </p>
                <p>
                  Dengan hormat, bersama ini kami mengusulkan penerbitan Surat Keputusan Kenaikan Gaji Berkala bagi
                  pegawai Rumah Tahanan Negara Kelas IIB Rantau yang telah memenuhi masa kerja golongan, dengan rincian
                  sebagai berikut:
                </p>
                <div className="pg-doc-gulir" tabIndex={0} role="region" aria-label="Tabel pegawai yang diusulkan">
                  <table className="pub-doc-table">
                    <caption className="pub-visually-hidden">Daftar pegawai yang diusulkan</caption>
                    <thead>
                      <tr>
                        <th scope="col">No</th>
                        <th scope="col">Nama</th>
                        <th scope="col">NIP</th>
                        <th scope="col">Pangkat/Golongan</th>
                        <th scope="col">Jabatan</th>
                        <th scope="col">TMT CPNS</th>
                        <th scope="col">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["Pegawai 1", "Pegawai 2"].map((nama, i) => (
                        <tr key={nama}>
                          <td>{i + 1}</td>
                          <th scope="row">{nama}</th>
                          <td>(disamarkan)</td>
                          <td>{PANGKAT}</td>
                          <td>Penjaga Tahanan</td>
                          <td>{tgl(TMT_CPNS)}</td>
                          <td>Usulan KGB</td>
                        </tr>
                      ))}
                      <tr>
                        <td>3–5</td>
                        <td colSpan={6}>3 pegawai lainnya dengan data serupa</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>Sebagai bahan pertimbangan, kami lampirkan:</p>
                <ol>
                  <li>salinan SK pengangkatan CPNS;</li>
                  <li>salinan SK pengangkatan PNS;</li>
                  <li>salinan SPMT.</li>
                </ol>
                <p>Demikian kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
                <div className="pg-doc-ttd">
                  <p>Kepala Rumah Tahanan Negara Kelas IIB Rantau,</p>
                  <p className="pg-doc-ttd-ruang">Ditandatangani secara elektronik</p>
                </div>
              </div>
              <figcaption className="pub-doc-caption">
                Contoh surat permohonan (disederhanakan). Disusun dari surat usulan yang diterima Kanwil pada September
                2026; nama, NIP, dan nomor surat disamarkan.
              </figcaption>
            </figure>

            <h3 className="pub-h3">Kesalahan yang sering terjadi</h3>
            <ul>
              <li>TMT atau masa kerja golongan pada tabel usulan tidak sama dengan yang tertulis di SK.</li>
              <li>SK dasar tidak dilampirkan, misalnya SK KGB terakhir atau SK pengangkatan PNS.</li>
              <li>NIP salah ketik, sehingga data pegawai tidak ditemukan di SIM-KGB.</li>
              <li>
                Surat diterima setelah batas proses Tim SDM, sehingga SK berisiko terbit setelah TMT dan selisih gaji
                dibayar kemudian sebagai kekurangan gaji.
              </li>
            </ul>
          </section>

          {/* 5. Di Kanwil */}
          <section className="pub-prose pg-bagian">
            <h2 id="di-kanwil" className="pub-h2">
              Di Kanwil: agenda dan disposisi
            </h2>
            <p>Surat permohonan dari UPT diterima Kanwil melalui Srikandi, lalu berjalan sebagai berikut.</p>
            <ol>
              <li>
                <strong>Tata Usaha</strong> mencatat surat pada Lembar Disposisi: nomor agenda, tanggal penerimaan,
                dan sifat surat.
              </li>
              <li>
                <strong>Kepala Kanwil</strong> memberi disposisi “u/ ditindaklanjuti” kepada Kepala Bagian Tata Usaha
                dan Umum.
              </li>
              <li>
                <strong>Kepala Bagian Tata Usaha dan Umum</strong> meneruskan surat kepada Ketua Tim SDM.
              </li>
              <li>
                <strong>Tim SDM</strong> memeriksa data dan lampiran, lalu memproses KGB di SIM-KGB (lihat{" "}
                <a href="#di-sim-kgb">langkah Tim SDM</a>).
              </li>
            </ol>

            <figure>
              <div className="pub-doc">
                <div className="pub-doc-kop">
                  <p>{KANWIL}</p>
                  <p>Lembar Disposisi</p>
                </div>
                <table className="pub-doc-table pg-doc-form">
                  <caption className="pub-visually-hidden">Isian lembar disposisi</caption>
                  <tbody>
                    <tr>
                      <th scope="row">Surat dari</th>
                      <td>Rutan Kelas IIB Rantau</td>
                    </tr>
                    <tr>
                      <th scope="row">Tanggal surat</th>
                      <td>{tgl(TANGGAL_SURAT)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Hal</th>
                      <td>{HAL_SURAT}</td>
                    </tr>
                    <tr>
                      <th scope="row">Diterima tanggal</th>
                      <td>{tgl(TANGGAL_DITERIMA)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Nomor agenda</th>
                      <td>(diisi Tata Usaha)</td>
                    </tr>
                    <tr>
                      <th scope="row">Sifat</th>
                      <td>Biasa</td>
                    </tr>
                    <tr>
                      <th scope="row">Diteruskan kepada</th>
                      <td>Kepala Bagian Tata Usaha dan Umum, lalu Ketua Tim SDM</td>
                    </tr>
                    <tr>
                      <th scope="row">Isi disposisi</th>
                      <td>Untuk ditindaklanjuti</td>
                    </tr>
                    <tr>
                      <th scope="row">Tanggal disposisi</th>
                      <td>{tgl(TANGGAL_DISPOSISI)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <figcaption className="pub-doc-caption">
                Isian Lembar Disposisi untuk surat pada contoh kasus, disederhanakan dari format yang dipakai Kanwil.
              </figcaption>
            </figure>

            <h3 className="pub-h3">Mengapa surat tetap wajib</h3>
            <p>
              SIM-KGB sudah mencatat jadwal KGB setiap pegawai, tetapi jadwal itu hanya pengingat bagi pengelola.
              Surat permohonan tetap diperlukan karena:
            </p>
            <ul>
              <li>surat menjadi dasar pencatatan agenda dan disposisi Kepala Kanwil;</li>
              <li>disposisi memberi Tim SDM perintah tertulis untuk menerbitkan SK;</li>
              <li>surat memuat usulan resmi Kepala UPT beserta lampiran yang menjadi bahan pemeriksaan;</li>
              <li>surat dan disposisi menjadi arsip bila SK perlu diperiksa kemudian.</li>
            </ul>
          </section>

          {/* 6. Di SIM-KGB */}
          <section className="pub-prose pg-bagian">
            <h2 id="di-sim-kgb" className="pub-h2">
              Di SIM-KGB: langkah Tim SDM
            </h2>
            <p>
              Langkah berikut dikerjakan setelah disposisi sampai ke Tim SDM. Nama menu dan tombol ditulis sama
              dengan yang tampil di SIM-KGB.
            </p>
            <ol className="pub-steps">
              <li>
                <h3 className="pub-step-title">Periksa data pegawai</h3>
                <p className="pub-step-who">Tim SDM, menu Data Pegawai</p>
                <p>
                  Cari setiap pegawai pada surat menurut NIP. Bila belum terdaftar, tambahkan dengan tombol Tambah
                  Pegawai, atau Impor CSV untuk banyak pegawai sekaligus. Golongan, masa kerja golongan, dan TMT KGB
                  berikutnya harus sama dengan SK yang dilampirkan UPT. Pegawai yang baru ditambahkan langsung
                  mendapat jadwal KGB berstatus <Status status="belum_diproses" />.
                </p>
                <p>
                  Pada Impor CSV, kolom statusHukdis dan keteranganHukdis hanya dibaca bila impor dilakukan Super
                  Admin. Pada impor oleh pengguna lain, kedua kolom itu diabaikan; hukuman disiplin dicatat melalui
                  menu Hukuman Disiplin.
                </p>
                <p>
                  Unit Kerja dipilih dari daftar satker di lingkungan Kanwil. Formulir menampilkan KPPN mitra satker
                  itu, dan SK KGB pegawai ditujukan ke KPPN tersebut. Pada Impor CSV, kolom unitKerja diisi nama satker
                  sesuai daftar; kolom kosong dibaca sebagai Kanwil, dan baris dengan unit kerja di luar daftar gagal
                  diimpor.
                </p>
                <p>
                  Golongan, masa kerja golongan, dan TMT KGB tidak dapat diubah selama KGB pegawai berstatus{" "}
                  <Status status="sedang_diproses" /> atau <Status status="menunggu_keuangan" />.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Pastikan data penandatangan berlaku</h3>
                <p className="pub-step-who">Super Admin, menu Pengaturan</p>
                <p>
                  Buka bagian Penandatangan Surat KGB. Pastikan ada penandatangan yang berlaku pada tanggal SK yang
                  akan dibuat: Kepala Kanwil, atau Plh atau Plt dengan dasar penunjukannya. Untuk KGB milik Kepala
                  Kanwil, data Direktur Jenderal juga harus terisi.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Input KGB</h3>
                <p className="pub-step-who">Tim SDM, menu Dashboard atau Proses KGB</p>
                <p>
                  Di Dashboard, pada kolom Belum Diproses di Alur Proses KGB, pilih Input KGB pada kartu pegawai. Di
                  menu Proses KGB, pilih Input KGB pada baris berstatus Belum Diproses. Jendela Input KGB menampilkan
                  data kepegawaian saat ini dan hasil perhitungan: masa kerja golongan baru, gaji pokok baru, TMT KGB
                  baru, TMT KGB berikutnya, dan batas input SDM.
                </p>
                <p>
                  Isi bagian Atas Dasar SK Terakhir dari SK dasar yang dilampirkan. Nomor SK Terakhir, Tanggal SK
                  Terakhir, dan TMT SK Terakhir wajib diisi; Ditetapkan oleh wajib dilengkapi paling lambat saat Buat SK.
                  Pilih Simpan Input KGB. Status berubah menjadi <Status status="sedang_diproses" />.
                </p>
                <p>SIM-KGB menolak Input KGB bila:</p>
                <ul>
                  <li>
                    jendela proses belum dibuka, yaitu sebelum tanggal 1 bulan kedua sebelum TMT. Kartu pegawai belum
                    tampil di Dashboard, dan barisnya di menu Proses KGB bertuliskan Terkunci beserta tanggal jendela
                    proses dibuka;
                  </li>
                  <li>pegawai sedang menjalani hukuman disiplin yang menunda KGB; atau</li>
                  <li>pegawai masih memiliki KGB berstatus Sedang Diproses atau Menunggu Keuangan.</li>
                </ul>
                <p>
                  Input setelah batas proses tetap diterima dan KGB ditandai <TandaRapelan />. Tanda ini dihitung
                  otomatis dari tanggal Input KGB dan tidak dapat diubah Tim SDM.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Buat SK</h3>
                <p className="pub-step-who">Tim SDM, kartu atau baris berstatus Sedang Diproses</p>
                <p>
                  Buat SK hanya tersedia setelah Input KGB, yaitu untuk KGB berstatus{" "}
                  <Status status="sedang_diproses" />. Pilih Buat SK untuk membuka jendela Buat Surat Keputusan KGB.
                  Periksa bagian Atas Dasar SK Terakhir; keempat isiannya wajib, termasuk Ditetapkan oleh. Lalu isi
                  bagian SK KGB Baru: Nomor SK Baru dari Tata Usaha dan Tanggal SK Baru. Penandatangan dipilih menurut
                  Tanggal SK Baru sesuai data di Pengaturan.
                </p>
                <p>
                  Periksa pratinjau pada tab SK biasa dan Versi Srikandi, lalu pilih Buat dan Unduh SK. SIM-KGB
                  mengunduh dua berkas PDF: SK biasa dan SK versi Srikandi. Pada versi Srikandi, tempat tanda tangan
                  berisi parameter <code>{"${ttd_pengirim}"}</code> untuk tanda tangan elektronik. Status tetap{" "}
                  <Status status="sedang_diproses" />.
                </p>
                <p>
                  SK ditujukan kepada Kepala KPPN mitra satker menurut Unit Kerja pegawai. Bila Unit Kerja belum sesuai
                  daftar satker, SK tidak dapat dibuat atau diunduh ulang sampai Data Pegawai diperbarui.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Tanda tangan elektronik di Srikandi</h3>
                <p className="pub-step-who">Tim SDM menyiapkan naskah; penandatangan melakukan TTE</p>
                <p>
                  Unggah SK versi Srikandi sebagai naskah keluar. Pilih penandatangan sesuai{" "}
                  <a href="#kewenangan">tabel penandatangan</a>, lalu isi tujuan: UPT pengusul, bagian keuangan UPT,
                  dan KPPN mitra satker (lihat <a href="#pengiriman-sk">pengiriman SK</a>).
                </p>
                <p>
                  Naskah ditandatangani secara elektronik oleh penandatangan menggunakan sertifikat elektronik BSrE.
                  Setelah ditandatangani, pastikan naskah benar-benar dikirim melalui Srikandi kepada tujuan utama dan
                  tembusan yang diisi saat registrasi; pada alur Srikandi, pengiriman dapat merupakan langkah tersendiri
                  setelah tanda tangan.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Unggah SK yang sudah ditandatangani</h3>
                <p className="pub-step-who">Tim SDM, kartu atau baris berstatus Sedang Diproses</p>
                <p>
                  Tombol Unggah SK TTE muncul setelah SK dibuat dengan Buat SK. Unduh naskah yang sudah ditandatangani
                  dari Srikandi, pilih Unggah SK TTE, pilih berkas PDF (paling besar 10 MB) pada jendela Unggah SK yang
                  Sudah Ditandatangani, lalu pilih Unggah SK. Status berubah menjadi <Status status="menunggu_keuangan" /> dan KGB muncul di
                  menu Keuangan.
                </p>
              </li>
              <li>
                <h3 className="pub-step-title">Bila ada data yang salah</h3>
                <p className="pub-step-who">
                  Tim SDM, kartu Sedang Diproses di Dashboard atau Detail KGB di menu Proses KGB
                </p>
                <p>
                  Pilih Batalkan KGB pada kartu Sedang Diproses di Dashboard, atau di Detail KGB pada menu Proses KGB
                  untuk status Belum Diproses maupun Sedang Diproses, lalu tulis alasannya. Alasan wajib diisi, lalu
                  pilih Batalkan KGB pada jendela konfirmasi. Status menjadi{" "}
                  <Status status="ditolak" />. Perbaiki data pegawai, lalu pilih Input Ulang KGB pada kartu di kolom
                  Belum Diproses atau di Detail KGB. KGB yang sudah Menunggu Keuangan tidak dapat dibatalkan.
                </p>
                <p>
                  Bila selama KGB berjalan tercatat hukuman disiplin yang menunda KGB berikutnya, pembatalan ditolak.
                  Hapus catatan hukuman disiplin itu terlebih dahulu, batalkan KGB, lalu catat kembali hukuman disiplin
                  setelah KGB diinput ulang.
                </p>
              </li>
            </ol>

            <div className="pub-note">
              <strong className="pub-note-title">Satu surat, beberapa SK</strong>
              <p>
                Satu SK dibuat untuk satu KGB. Surat permohonan yang memuat lima pegawai berarti lima entri KGB di
                SIM-KGB dan lima SK.
              </p>
            </div>

            <h3 id="keadaan-khusus" className="pub-h3">
              Keadaan khusus
            </h3>
            <ul>
              <li>
                <strong>SK sudah terbit di luar SIM-KGB.</strong> Catat dengan Arsip KGB. Tombol ini ada pada kartu
                Belum Diproses yang terlambat di Dashboard, pada baris Belum Diproses di menu Proses KGB setelah batas
                proses lewat, dan sebagai tautan di jendela Input KGB bila data SK terakhir belum tercatat. Isi Nomor
                SK, Tanggal SK, TMT SK, dan Ditetapkan oleh bila diketahui, pilih Berkas SK (PDF) paling besar 10 MB,
                lalu pilih Simpan Arsip. KGB langsung berstatus <Status status="selesai" /> tanpa konfirmasi keuangan, data gaji pegawai
                diperbarui, dan jadwal KGB berikutnya dibuat. Arsip KGB mengikuti jendela proses yang sama dengan
                Input KGB. Bila berkas SK gagal terunggah, unggah dari Detail KGB dengan Unggah SK TTE.
              </li>
              <li>
                <strong>Detail dan riwayat.</strong> Di menu Proses KGB, tombol Detail membuka Detail KGB berisi data
                pegawai, perhitungan, SK KGB Baru, tautan Lihat SK Tertandatangani, dan tombol aksi sesuai status.
                Riwayat KGB menampilkan seluruh KGB pegawai. Di halaman riwayat pegawai, tombol Proses KGB membuka
                tombol aksi yang sama dan tautan Buka di Halaman Proses KGB. Baris bertanda Dari Data Pegawai dibentuk
                dari TMT KGB berikutnya di Data Pegawai, untuk pegawai aktif yang tidak memiliki entri KGB berstatus
                Belum Diproses, Sedang Diproses, atau Menunggu Keuangan.
              </li>
              <li>
                <strong>Koreksi penanda rapelan KGB historis.</strong> Bila KGB berstatus <Status status="selesai" />{" "}
                masih membawa penanda rapelan padahal SK periode itu sebenarnya terbit tepat waktu, Super Admin dapat
                memilih Koreksi sebagai Arsip Historis di Detail KGB pada menu Proses KGB. Isi Alasan koreksi, lalu
                pilih Simpan Koreksi. Penanda rapelan pada KGB itu dihapus, termasuk Rapelan ditetapkan dari
                konfirmasi keuangan, sehingga KGB itu tidak lagi dihitung sebagai rapelan di rekap dan laporan. KGB
                berikutnya tidak diubah, dan alasan beserta penanda sebelumnya dicatat di Log Aktivitas. Tombol ini
                hanya tampil bagi Super Admin.
              </li>
              <li>
                <strong>Pemeriksaan Data.</strong> Super Admin dapat membuka menu Pengaturan, bagian Pemeriksaan
                Data, lalu memilih Periksa Data. SIM-KGB menampilkan pegawai dalam tiga kelompok: Unit kerja tidak
                dikenali, TMT KGB terakhir tidak sesuai riwayat, dan TMT KGB berikutnya tidak valid. Pemeriksaan hanya
                membaca data; tidak ada data yang diubah otomatis. Perbaiki setiap temuan di Data Pegawai melalui
                tautan Buka di Data Pegawai.
              </li>
              <li>
                <strong>Pengingat.</strong> SIM-KGB memberi notifikasi 14 hari dan 7 hari sebelum batas proses Tim
                SDM, dan pada hari batas itu, selama KGB belum diinput. Jumlah hari dapat diubah di menu Pengaturan,
                bagian Notifikasi KGB (Peringatan awal dan Peringatan mendesak). Setelah batas lewat, muncul notifikasi
                KGB Terlambat dengan nama pegawai.
              </li>
              <li>
                <strong>Notifikasi menurut peran.</strong> Tim SDM KGB menerima pengingat batas proses, KGB terlambat,
                permintaan tindak lanjut dari bagian keuangan, dan hukuman disiplin yang segera berakhir. Tim SDM
                Hukdis hanya menerima notifikasi hukuman disiplin yang segera berakhir. Bagian keuangan hanya
                menerima notifikasi SK KGB Menunggu Konfirmasi. Super Admin menerima semuanya. Tanda
                sudah dibaca pada satu notifikasi berlaku untuk semua pengguna.
              </li>
            </ul>
          </section>

          {/* 7. Keuangan */}
          <section className="pub-prose pg-bagian">
            <h2 id="keuangan" className="pub-h2">
              Konfirmasi keuangan
            </h2>
            <p>
              Bagian ini untuk pengguna SIM-KGB dengan akses Keuangan. KGB yang perlu dikonfirmasi berstatus{" "}
              <Status status="menunggu_keuangan" />.
            </p>
            <ol>
              <li>Buka menu Keuangan. Bagian SK Masuk: Konfirmasi memuat SK yang menunggu konfirmasi.</li>
              <li>
                Pada kartu KGB, pilih tombol SK (Lihat SK Tertandatangani) untuk membuka jendela SK yang Sudah
                Ditandatangani. Di bagian Kalender KGB, tombol itu bertuliskan Lihat SK Tertandatangani. Cocokkan nama,
                NIP, golongan, gaji pokok baru, dan TMT.
              </li>
              <li>
                Untuk kartu biasa, pilih Konfirmasi. Untuk kartu bertanda <TandaRapelan />, pilih Tinjau dan
                Konfirmasi. Pada jendela Konfirmasi KGB, tentukan Status pembayaran:
                <ul>
                  <li>
                    <strong>Rapelan</strong> bila selisih gaji perlu dibayar mundur sejak TMT; atau
                  </li>
                  <li>
                    <strong>Tidak Rapelan</strong> bila gaji baru dapat dibayar mulai TMT.
                  </li>
                </ul>
                Untuk kartu bertanda Berpotensi rapelan, pilihan Rapelan sudah terpilih; periksa sebelum memilih
                Konfirmasi.
              </li>
              <li>
                Beberapa SK tanpa tanda Berpotensi rapelan yang TMT-nya belum lewat dapat dipilih, satu per satu atau
                dengan Pilih semua, lalu dikonfirmasi sekaligus dengan Konfirmasi cepat; semuanya dicatat Tidak
                Rapelan. SK bertanda Berpotensi rapelan dan SK dengan TMT hari ini atau sebelumnya tidak dapat dipilih;
                kartu SK dengan TMT yang sudah lewat bertuliskan “TMT sudah lewat, tinjau satu per satu”. Konfirmasi
                SK tersebut satu per satu melalui Konfirmasi atau Tinjau dan Konfirmasi.
              </li>
            </ol>
            <h3 className="pub-h3">Setelah konfirmasi</h3>
            <ul>
              <li>
                Status menjadi <Status status="selesai" />.
              </li>
              <li>
                Bila dipilih Rapelan, KGB diberi tanda Rapelan ditetapkan di menu Keuangan dan di Riwayat KGB
                pegawai.
              </li>
              <li>
                SIM-KGB memperbarui data pegawai dan membuat jadwal KGB berikutnya berstatus{" "}
                <Status status="belum_diproses" />.
              </li>
              <li>
                Rekap dasar input Gaji Web per bulan TMT dihitung otomatis dari data KGB setiap kali halaman dibuka,
                pada menu Riwayat Aktivitas, tab Rekap Gaji Web. Tidak ada rekap yang perlu dicatat atau disimpan
                manual. KGB arsip tidak dihitung, dan KGB yang dibatalkan lalu diinput ulang dihitung satu kali.
              </li>
            </ul>
            <div className="pub-note-warn">
              <strong className="pub-note-title">Pembayaran kekurangan gaji</strong>
              <p>
                Jika SK KGB terbit setelah TMT, selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji: operator
                gaji satker merekam SK KGB di aplikasi Gaji Web, lalu satker mengajukan SPM-LS kekurangan gaji ke
                KPPN. Pilihan Rapelan di SIM-KGB hanya mencatat keadaan ini; pembayarannya tetap melalui satker.
              </p>
            </div>
          </section>

          {/* 8. Pengiriman SK */}
          <section className="pub-prose pg-bagian">
            <h2 id="pengiriman-sk" className="pub-h2">
              Pengiriman SK dan KPPN mitra
            </h2>
            <p>SK yang sudah ditandatangani dikirim kepada tiga penerima.</p>
            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel penerima SK KGB">
              <table className="pub-table">
                <caption>Penerima SK KGB</caption>
                <thead>
                  <tr>
                    <th scope="col">Penerima</th>
                    <th scope="col">Keperluan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">UPT pengusul</th>
                    <td>Arsip kepegawaian satker dan salinan untuk pegawai yang bersangkutan.</td>
                  </tr>
                  <tr>
                    <th scope="row">Bagian keuangan UPT</th>
                    <td>
                      Dasar perubahan data gaji di aplikasi Gaji Web oleh bendahara atau operator gaji satker, termasuk
                      pengajuan kekurangan gaji bila SK terbit setelah TMT.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">KPPN mitra satker</th>
                    <td>
                      Tembusan untuk KPPN yang menjadi mitra satker. Tembusan ke KPPN mengikuti praktik Kanwil dan
                      permintaan KPPN setempat.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Gunakan tabel berikut untuk menentukan KPPN mitra setiap satker. SIM-KGB mencetak tujuan SK kepada Kepala
              Kantor Pelayanan Perbendaharaan Negara di kota KPPN mitra, menurut Unit Kerja pegawai di Data Pegawai.
              Bila pegawai pindah satker, perbarui Unit Kerja sebelum Buat SK.
            </p>
            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel KPPN mitra per satker">
              <table className="pub-table">
                <caption>KPPN mitra satker di lingkungan Kanwil Ditjenpas Kalimantan Selatan</caption>
                <thead>
                  <tr>
                    <th scope="col">KPPN</th>
                    <th scope="col">Satker</th>
                  </tr>
                </thead>
                <tbody>
                  {kppn.map((k) => (
                    <tr key={k.kppn}>
                      <th scope="row">
                        KPPN {k.kppn}
                        <br />
                        <span className="pub-meta">{k.satker.length} satker</span>
                      </th>
                      <td>
                        <ul>
                          {k.satker.map((s) => (
                            <li key={s.kode}>{s.nama}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 9. Contoh kasus */}
          <section className="pub-prose pg-bagian">
            <h2 id="contoh-kasus" className="pub-h2">
              Contoh kasus: usulan Rutan Kelas IIB Rantau
            </h2>
            <p>
              Rutan Kelas IIB Rantau mengusulkan KGB untuk lima pegawai dengan data yang sama: {PANGKAT}, jabatan
              Penjaga Tahanan, TMT CPNS {tgl(TMT_CPNS)}. Ini adalah KGB pertama mereka. Data pribadi disamarkan.
            </p>

            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel urutan tanggal contoh kasus">
              <table className="pub-table">
                <caption>Urutan tanggal</caption>
                <thead>
                  <tr>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Peristiwa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{tgl(TMT_CPNS)}</th>
                    <td>TMT CPNS, golongan {GOLONGAN}, masa kerja golongan {mkg(0, 0)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{bulanTahun(bulanKirim(TMT_KGB))}</th>
                    <td>Waktu yang disarankan untuk mengirim surat permohonan</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      {tgl(kasus.unlockDate)} sampai {tgl(kasus.deadlineSDM)}
                    </th>
                    <td>Jendela proses KGB di SIM-KGB</td>
                  </tr>
                  <tr>
                    <th scope="row">{tgl(kasus.tmtKgbBaru)}</th>
                    <td>TMT KGB pertama, masa kerja golongan {mkg(kasus.mkgTahunBaru, kasus.mkgBulanBaru)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{tgl(TANGGAL_SURAT)}</th>
                    <td>Tanggal surat permohonan Rutan Kelas IIB Rantau</td>
                  </tr>
                  <tr>
                    <th scope="row">{tgl(TANGGAL_DITERIMA)}</th>
                    <td>Surat diterima Kanwil dan dicatat Tata Usaha</td>
                  </tr>
                  <tr>
                    <th scope="row">{tgl(TANGGAL_DISPOSISI)}</th>
                    <td>
                      Disposisi Kepala Kanwil “u/ ditindaklanjuti” kepada Kepala Bagian Tata Usaha dan Umum, lalu
                      diteruskan kepada Ketua Tim SDM
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel perhitungan KGB contoh kasus">
              <table className="pub-table">
                <caption>Perhitungan untuk setiap pegawai</caption>
                <thead>
                  <tr>
                    <th scope="col">Uraian</th>
                    <th scope="col">Sebelum KGB</th>
                    <th scope="col">Sesudah KGB</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Pangkat, golongan</th>
                    <td>{PANGKAT}</td>
                    <td>{PANGKAT}</td>
                  </tr>
                  <tr>
                    <th scope="row">Masa kerja golongan</th>
                    <td>{mkg(0, 0)}</td>
                    <td>{mkg(kasus.mkgTahunBaru, kasus.mkgBulanBaru)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Berlaku mulai</th>
                    <td>{tgl(TMT_CPNS)} (TMT CPNS)</td>
                    <td>{tgl(kasus.tmtKgbBaru)} (TMT KGB)</td>
                  </tr>
                  <tr>
                    <th scope="row">Gaji pokok</th>
                    <td className="pub-num">{rp(GAJI_MKG_0)}</td>
                    <td className="pub-num">{rp(kasus.gajiPokokBaru)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Kenaikan gaji pokok per bulan</th>
                    <td></td>
                    <td className="pub-num">{rp(selisihGaji)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <dl className="pub-dl">
              <div>
                <dt>TMT KGB berikutnya</dt>
                <dd>{tgl(kasus.tmtKgbBerikutnya)}</dd>
              </div>
              <div>
                <dt>Masa kerja golongan saat itu</dt>
                <dd>{mkg(siklusBerikutnya.mkgTahunBaru, siklusBerikutnya.mkgBulanBaru)}</dd>
              </div>
              <div>
                <dt>Gaji pokok saat itu</dt>
                <dd>{rp(getGajiPokok(GOLONGAN, siklusBerikutnya.mkgTahunBaru, siklusBerikutnya.mkgBulanBaru))}</dd>
              </div>
              <div>
                <dt>Jendela proses berikutnya</dt>
                <dd>
                  {tgl(siklusBerikutnya.unlockDate)} sampai {tgl(siklusBerikutnya.deadlineSDM)}; surat sebaiknya
                  dikirim pada {bulanTahun(bulanKirim(kasus.tmtKgbBerikutnya))}
                </dd>
              </div>
            </dl>

            <h3 className="pub-h3">Cara Kanwil menanganinya</h3>
            <ul>
              <li>
                {suratSetelahBatas ? (
                  <>
                    Surat bertanggal {tgl(TANGGAL_SURAT)}, setelah batas proses {tgl(kasus.deadlineSDM)}. Karena itu,
                    saat Tim SDM memilih Input KGB, SIM-KGB menandai KGB <TandaRapelan />.
                  </>
                ) : (
                  <>Surat bertanggal {tgl(TANGGAL_SURAT)}, masih sebelum batas proses {tgl(kasus.deadlineSDM)}.</>
                )}
              </li>
              <li>
                Kanwil memproses usulan seperti biasa. Keterlambatan tidak menggeser TMT: KGB tetap berlaku{" "}
                {tgl(kasus.tmtKgbBaru)}, dan KGB berikutnya tetap {tgl(kasus.tmtKgbBerikutnya)}.
              </li>
              <li>Lima pegawai berarti lima entri KGB dan lima SK, walaupun usulannya satu surat.</li>
              <li>
                Selisih gaji sejak {tgl(kasus.tmtKgbBaru)} dibayarkan sebagai kekurangan gaji: operator gaji satker
                merekam SK KGB di aplikasi Gaji Web, lalu satker mengajukan SPM-LS kekurangan gaji ke KPPN. Saat
                konfirmasi, bagian keuangan memilih Rapelan.
              </li>
              <li>
                Agar KGB berikutnya terbit sebelum TMT, Rutan Kelas IIB Rantau sebaiknya mengirim surat pada{" "}
                {bulanTahun(bulanKirim(kasus.tmtKgbBerikutnya))}.
              </li>
            </ul>
          </section>

          {/* 10. Status */}
          <section className="pub-prose pg-bagian">
            <h2 id="status" className="pub-h2">
              Arti status di halaman cek status
            </h2>
            <p>
              Pegawai dapat melihat status KGB dengan memasukkan NIP di halaman <Link href="/kgb">Cek status</Link>.
              Status di halaman itu sama dengan status di SIM-KGB.
            </p>
            <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel arti status KGB">
              <table className="pub-table">
                <caption>Status KGB dan artinya</caption>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Arti</th>
                  </tr>
                </thead>
                <tbody>
                  {URUTAN_STATUS.map((s) => (
                    <tr key={s}>
                      <th scope="row">
                        <Status status={s} />
                      </th>
                      <td>{STATUS_KGB[s].keterangan}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">
                      <TandaRapelan />
                    </th>
                    <td>
                      Tanda tambahan, bukan status. Muncul pada KGB berstatus Sedang Diproses atau Menunggu Keuangan
                      yang diinput setelah batas proses Tim SDM. SK dapat terbit setelah TMT; bila demikian, selisih
                      gaji sejak TMT dibayarkan kemudian sebagai kekurangan gaji. Bagian keuangan menetapkannya saat
                      konfirmasi.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 11. Pertanyaan */}
          <section className="pub-prose pg-bagian">
            <h2 id="pertanyaan" className="pub-h2">
              Pertanyaan umum
            </h2>
            <div className="pub-faq">
              <details>
                <summary>Apakah surat permohonan masih wajib walaupun data sudah ada di SIM-KGB?</summary>
                <p>
                  Ya. Jadwal di SIM-KGB hanya pengingat bagi pengelola. Surat permohonan Kepala UPT menjadi dasar agenda
                  dan disposisi Kepala Kanwil, dan disposisi itulah yang menjadi perintah bagi Tim SDM untuk menerbitkan
                  SK.
                </p>
              </details>
              <details>
                <summary>Bolehkah Kepala UPT menandatangani SK KGB?</summary>
                <p>
                  Tidak. Kepala UPT menandatangani surat permohonan. Kewenangan KGB pegawai Kanwil dan UPT dilimpahkan
                  kepada Kepala Kantor Wilayah, sehingga SK KGB ditandatangani Kepala Kanwil atau pejabat pengganti
                  sesuai <a href="#kewenangan">tabel penandatangan</a>.
                </p>
              </details>
              <details>
                <summary>Mengapa KGB pertama golongan II/a diberikan setelah 1 tahun?</summary>
                <p>
                  PNS yang pertama kali diangkat dalam golongan II/a menerima KGB pertama setelah mempunyai masa kerja 1
                  tahun, lalu setiap 2 tahun berikutnya. Tabel gaji PP 5/2024 mengikuti pola ini: gaji pokok golongan
                  II/a naik dari {rp(GAJI_MKG_0)} (MKG 0 tahun) menjadi {rp(GAJI_MKG_1)} (MKG 1 tahun), lalu{" "}
                  {rp(GAJI_MKG_3)} (MKG 3 tahun). Golongan III berubah pada MKG genap, sehingga KGB pertamanya pada MKG
                  2 tahun.
                </p>
              </details>
              <details>
                <summary>NIP saya tidak ditemukan di halaman cek status</summary>
                <p>
                  Periksa kembali NIP yang diketik. Bila tetap tidak ditemukan, berarti data Anda belum terdaftar di
                  SIM-KGB. Minta admin kepegawaian satker Anda menghubungi Tim SDM Kanwil dengan menyertakan SK terakhir
                  Anda.
                </p>
              </details>
              <details>
                <summary>Status KGB saya tidak berubah dalam waktu lama</summary>
                <p>
                  Status Belum Diproses biasanya berarti surat permohonan belum diterima atau jendela proses belum
                  dibuka. Sedang Diproses berarti SK sedang disiapkan atau menunggu tanda tangan elektronik. Menunggu
                  Keuangan berarti SK sudah ditandatangani dan menunggu konfirmasi bagian keuangan. Bila status tidak
                  berubah jauh melewati jadwal, tanyakan melalui admin kepegawaian satker kepada Tim SDM Kanwil dengan
                  menyebut nomor dan tanggal surat permohonan.
                </p>
              </details>
              <details>
                <summary>Usulan terlambat dikirim. Apakah KGB hilang?</summary>
                <p>
                  Tidak. KGB tetap diproses dan TMT tidak bergeser. Jika SK KGB terbit setelah TMT, selisih gaji sejak
                  TMT dibayarkan sebagai kekurangan gaji: operator gaji satker merekam SK KGB di aplikasi Gaji Web, lalu
                  satker mengajukan SPM-LS kekurangan gaji ke KPPN.
                </p>
              </details>
              <details>
                <summary>Mengapa tombol Buat SK atau Unggah SK TTE tidak muncul?</summary>
                <p>
                  Buat SK baru tersedia setelah Input KGB disimpan dan status menjadi Sedang Diproses. Unggah SK TTE
                  baru muncul setelah SK dibuat dengan Buat SK. KGB yang jendela prosesnya belum dibuka tidak tampil di
                  Dashboard dan bertuliskan Terkunci di menu Proses KGB, disertai tanggal jendela proses dibuka.
                </p>
              </details>
              <details>
                <summary>Bisakah tanda Berpotensi rapelan diubah secara manual?</summary>
                <p>
                  Tidak. Tanda itu dihitung otomatis: KGB yang diinput setelah batas proses Tim SDM ditandai Berpotensi
                  rapelan. Keputusan rapelan diambil bagian keuangan saat konfirmasi dengan memilih Rapelan atau Tidak
                  Rapelan.
                </p>
                <p>
                  Pengecualiannya hanya untuk KGB historis berstatus Selesai yang masih membawa penanda rapelan
                  padahal SK-nya terbit tepat waktu. Penanda itu hanya dapat dihapus Super Admin dengan Koreksi sebagai
                  Arsip Historis, disertai alasan yang dicatat di Log Aktivitas (lihat{" "}
                  <a href="#keadaan-khusus">keadaan khusus</a>).
                </p>
              </details>
              <details>
                <summary>Pegawai pindah satker sebelum SK terbit</summary>
                <p>
                  Beri tahu Tim SDM Kanwil secepatnya melalui admin kepegawaian satker asal, dengan menyebut satker
                  tujuan dan dasar kepindahannya. Tim SDM memperbarui Unit Kerja pegawai di Data Pegawai sebelum Buat SK,
                  karena Unit Kerja menentukan KPPN mitra yang menjadi tujuan SK.
                </p>
              </details>
              <details>
                <summary>Lupa password SIM-KGB</summary>
                <p>
                  Akun SIM-KGB hanya untuk pengelola: Tim SDM, bagian keuangan, dan administrator. Pegawai tidak
                  memerlukan akun untuk melihat status KGB. Pengelola yang lupa password dapat memakai tautan Lupa
                  password di halaman <Link href="/login">Masuk</Link> untuk menghubungi admin SIM-KGB.
                </p>
                <p>
                  Setelah password direset admin atau diganti sendiri melalui Profil Saya, sesi yang masih terbuka
                  berakhir. Masuk kembali dengan password baru. Setelah beberapa kali gagal masuk, halaman Masuk
                  menampilkan pesan terlalu banyak percobaan; tunggu 15 menit sebelum mencoba lagi.
                </p>
              </details>
            </div>
          </section>

          {/* 12. Dasar hukum */}
          <section className="pub-prose pg-bagian">
            <h2 id="dasar-hukum" className="pub-h2">
              Dasar hukum dan rujukan
            </h2>
            <h3 className="pub-h3">Peraturan</h3>
            <ul>
              <li>
                <a href="https://jdih.kemenkeu.go.id/fulltext/1977/7TAHUN~1977PP.HTM">
                  Peraturan Pemerintah Nomor 7 Tahun 1977 tentang Peraturan Gaji Pegawai Negeri Sipil
                </a>{" "}
                beserta perubahannya. Dipakai untuk syarat KGB (Pasal 11), penerbitan pemberitahuan KGB 2 bulan
                sebelum berlaku (Pasal 12 ayat (2)), dan penundaan KGB (Pasal 13).
              </li>
              <li>
                <a href="https://peraturan.bpk.go.id/Details/276755/pp-no-5-tahun-2024">
                  Peraturan Pemerintah Nomor 5 Tahun 2024 tentang Perubahan Kesembilan Belas atas Peraturan Pemerintah
                  Nomor 7 Tahun 1977 tentang Peraturan Gaji Pegawai Negeri Sipil
                </a>
                . Mengubah daftar gaji pokok PNS (Lampiran II) dan berlaku mulai 1 Januari 2024. Daftarnya dapat dibaca
                sebagai <Link href="/tabel-gaji">tabel gaji digital</Link>.
              </li>
              <li>
                <a href="https://www.bkn.go.id/storage/2024/02/Peraturan-BKN-1-Tahun-2024-PENYESUAIAN-GAJI-POKOK-PNS.pdf">
                  Peraturan Badan Kepegawaian Negara Nomor 1 Tahun 2024 tentang Ketentuan Teknis Pelaksanaan
                  Penyesuaian Gaji Pokok Pegawai Negeri Sipil
                </a>
                . Daftar gaji pokok di dalamnya menjadi acuan pemeriksaan tabel gaji SIM-KGB.
              </li>
              <li>
                <a href="https://peraturan.bpk.go.id/Details/177031/pp-no-94-tahun-2021">
                  Peraturan Pemerintah Nomor 94 Tahun 2021 tentang Disiplin Pegawai Negeri Sipil
                </a>
                , khususnya Pasal 8 ayat (3) dan ketentuan peralihan Pasal 42.
              </li>
              <li>
                Peraturan Pemerintah Nomor 53 Tahun 2010 tentang Disiplin Pegawai Negeri Sipil, Pasal 7 ayat (3), yang
                masih dirujuk oleh Pasal 42 PP 94/2021.
              </li>
              <li>
                Keputusan Menteri Imigrasi dan Pemasyarakatan Nomor M.IP-01.OT.01.01 Tahun 2025 tentang Wewenang dan
                Pelimpahan Kewenangan pada Bidang Sumber Daya Manusia di Lingkungan Kementerian Imigrasi dan
                Pemasyarakatan. Panduan ini merujuk pada salinan keputusan yang menjadi pegangan Kanwil.
              </li>
            </ul>
            <h3 className="pub-h3">Rujukan praktik</h3>
            <ul>
              <li>
                <a href="https://layanan.arsip.go.id/knowledgebase.php?article=62">
                  Tanda Tangan Elektronik di Aplikasi SRIKANDI
                </a>
                , Helpdesk Nasional SRIKANDI, Arsip Nasional Republik Indonesia.
              </li>
              <li>
                <a href="https://djpb.kemenkeu.go.id/kppn/jakarta1/id/data-publikasi/literasi-keuangan/2889-membuat-kekurangan-gaji-pada-aplikasi-gaji-web.html">
                  Membuat Kekurangan Gaji pada Aplikasi Gaji Web
                </a>
                , KPPN Jakarta I, Direktorat Jenderal Perbendaharaan.
              </li>
            </ul>
            <p className="pub-meta">
              Ketentuan penundaan KGB karena hukuman disiplin berlaku sampai peraturan pemerintah mengenai gaji dan
              tunjangan PNS mulai berlaku. Bila peraturan itu terbit, bagian terkait panduan ini perlu disesuaikan.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
