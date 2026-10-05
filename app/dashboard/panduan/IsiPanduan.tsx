import Link from "next/link";
import { getGajiPokok, getPangkat, hitungKirimSurat, hitungRekonGaji, kalkulasiKGB } from "@/lib/tabelGaji";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { satkerPerKppn } from "@/lib/satker";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { STATUS_KGB, type StatusKgb } from "@/lib/statusKgb";
import { formatTanggalId } from "@/lib/waktu";
import { DaftarIsiPanduan, LanjutBagian, PanduanPeran, PilihPeran } from "./NavigasiPanduan";
import { BUTIR_KONFIRMASI_UPT } from "@/lib/konfirmasiUpt";
import { ATURAN_DASAR_BARU, KOLOM_DASAR_BARU, LEMBAR_DATA_UPT, PANDUAN_DASAR_BARU } from "@/lib/imporUsulanUpt";
import { KIRIM_SURAT_BATAS } from "@/lib/batasInputSdm";
import { bagianUntukPeran, peranUntuk, type IdBagian } from "./peran";
// Replika layar SIM-KGB untuk bagian Admin UPT; alasan memakai HTML alih-alih tangkapan layar ada di berkasnya.
import {
  LayarDataPegawai,
  LayarKolektif1,
  LayarKolektif2,
  LayarKolektif3,
  LayarMenu,
  LayarPapan,
  LayarPengingat,
  LayarSkTerbit,
  LayarUnggah,
} from "./LayarUpt";
// Isi panduan memakai kelas bersama halaman publik (.pub-prose, .pub-table, ...), semuanya di bawah .pub.
import "@/app/(publik)/publik.css";
import "./panduan.css";

/* ── Format (tanggal kalender WITA, sama dengan SIM-KGB) ───────────────── */
const tgl = (d: Date) => formatTanggalId(d);
const bulanTahun = (d: Date) => formatTanggalId(d, { month: "long", year: "numeric" });
const rp = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const mkg = (tahun: number, bulan: number) => `${tahun} tahun ${bulan} bulan`;

/* ── Contoh kasus: usulan Rumah Tahanan Negara Kelas IIB Rantau (data pribadi disamarkan) ── */
const GOLONGAN = "II/a";
const PANGKAT = `${getPangkat(GOLONGAN)} (${GOLONGAN})`;
const TMT_CPNS = new Date(2025, 5, 1);
const TMT_KGB = new Date(2026, 5, 1);
/* Pengangkatan PNS pada contoh ini terbit tiga bulan setelah KGB pertama; lihat bagian cpns-pns. */
const TMT_PNS = new Date(2026, 8, 1);
const PORSI_CPNS = 0.8;
const PERSEN_CPNS = Math.round(PORSI_CPNS * 100);
const gajiCpns = (gajiPokok: number) => Math.round(gajiPokok * PORSI_CPNS);
const selisihBulan = (dari: Date, sampai: Date) =>
  (sampai.getFullYear() - dari.getFullYear()) * 12 + (sampai.getMonth() - dari.getMonth());
const akhirBulanSebelum = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 0);

const TANGGAL_SURAT = new Date(2026, 8, 8);
const TANGGAL_DITERIMA = new Date(2026, 8, 10);
const TANGGAL_DISPOSISI = new Date(2026, 8, 14);

/* Dihitung per permintaan, setelah batas input Tim SDM dimuat dari Pengaturan (lihat PanduanPage). */
function hitungKasus() {
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
  return { kasus, siklusBerikutnya, rekon: hitungRekonGaji(TMT_KGB) };
}

const GAJI_MKG_0 = getGajiPokok(GOLONGAN, 0, 0);
const GAJI_MKG_1 = getGajiPokok(GOLONGAN, 1, 0);
const GAJI_MKG_3 = getGajiPokok(GOLONGAN, 3, 0);

/* Aturan praktis UPT: surat dikirim tanggal 1 sampai 10 bulan kedua sebelum TMT, yaitu bulan yang sama
   dengan dibukanya jendela proses di SIM-KGB (lib/tabelGaji.ts, hitungKirimSurat). */
const bulanKirim = (tmt: Date) => hitungKirimSurat(tmt).mulai;
const jendelaKirim = (tmt: Date) => {
  const { mulai, batas } = hitungKirimSurat(tmt);
  return `${formatTanggalId(mulai, { day: "numeric" })} sampai ${tgl(batas)}`;
};

const HAL_SURAT = "Permohonan Penerbitan Surat Keputusan Kenaikan Gaji Berkala";
const KANWIL = "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";

const URUTAN_STATUS: StatusKgb[] = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai", "ditolak"];

function Status({ status }: { status: StatusKgb }) {
  const info = STATUS_KGB[status];
  return <span className={`pub-status ${info.kelas}`}>{info.label}</span>;
}

function TandaRapelan() {
  return <span className="pub-status pub-status-rapelan">Berpotensi rapelan</span>;
}

/**
 * Satu bagian panduan. Yang tidak terbuka bagi akun pembaca menghasilkan null, bukan bagian tersembunyi:
 * isi kerja Kanwil tidak boleh ikut terkirim ke halaman Admin UPT lalu sekadar ditutupi CSS. Atribut
 * data-peran tetap dipasang, sebab Super Admin berpindah peran tanpa memuat ulang halaman.
 */
function Bagian({
  id,
  tampil,
  children,
}: {
  id: IdBagian;
  tampil: ReadonlySet<IdBagian>;
  children: React.ReactNode;
}) {
  if (!tampil.has(id)) return null;
  return (
    <section className="pub-prose pg-bagian" data-bagian={id} data-peran={peranUntuk(id)}>
      {children}
    </section>
  );
}

/**
 * Isi panduan SIM-KGB di dashboard. `bawaan` adalah peran yang tampil lebih dulu (dari role akun),
 * `milik` peran akun itu sendiri untuk penanda di pilihan peran, dan `boleh` daftar peran yang terbuka
 * bagi akun itu. Bagian di luar `boleh` tidak ikut dirender sama sekali.
 */
export default async function IsiPanduan({
  bawaan,
  milik,
  boleh,
}: {
  bawaan: string;
  milik: string | null;
  boleh: readonly string[];
}) {
  const tampil = new Set(bagianUntukPeran(boleh).map((b) => b.id));
  const batas = await muatBatasInputSdm();
  const { kasus, siklusBerikutnya, rekon } = hitungKasus();
  const selisihGaji = kasus.gajiPokokBaru - GAJI_MKG_0;
  const suratSetelahBatas = TANGGAL_SURAT > kasus.deadlineSDM;
  // Daftar KPPN mitra mengikuti Pengaturan, sehingga panduan tidak menyebut kemitraan yang usang.
  await muatKppnSatker();
  const kppn = satkerPerKppn();

  return (
    <div className="dsb-halaman pg-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Bantuan</p>
          <h1 className="dsb-halaman-judul">Panduan SIM-KGB</h1>
          <p className="dsb-sub">
            Langkah kerja menurut peran, dari usulan UPT sampai SK direkam di Gaji Web. Nama menu dan tombol ditulis
            sama dengan yang tampil di SIM-KGB.
          </p>
        </div>
      </header>

      <PanduanPeran bawaan={bawaan} boleh={boleh}>
        <PilihPeran milik={milik} boleh={boleh} />

        <div className="pg-kisi" id="panduan-isi">
          <DaftarIsiPanduan />

          <div className="pg-isi">
              {/* 1. Alur singkat */}
              <Bagian id="ringkasan" tampil={tampil}>
                <h2 id="ringkasan" className="pub-h2 pub-h2-flush">
                  Alur singkat
                </h2>
                <p>
                  Satu usulan KGB melewati tujuh langkah berikut, dari usulan UPT sampai SIM-KGB menjadwalkan KGB
                  berikutnya.
                </p>
                <ol className="pub-steps">
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">UPT menyiapkan dan mengajukan usulan</h3>
                    <p className="pub-step-who">Admin UPT dan Kepala UPT</p>
                    <p>
                      Admin UPT memeriksa data pegawai yang KGB-nya jatuh tempo, menyiapkan perbaikan data dan berkas SK
                      dasarnya di SIM-KGB, lalu mengajukannya dengan Ajukan ke Kanwil. Surat usulan yang ditandatangani
                      elektronik Kepala UPT dikirim lewat Srikandi kepada Kepala Kanwil, dan nomornya diisi saat
                      mengajukan.
                    </p>
                    <p className="pg-hasil">Hasil: usulan dan surat masuk ke Kanwil.</p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Agenda, disposisi, dan tinjauan usulan</h3>
                    <p className="pub-step-who">Tata Usaha, Kepala Kanwil, dan Tim SDM KGB</p>
                    <p>
                      Tata Usaha mencatat surat pada Lembar Disposisi, dan disposisi Kepala Kanwil diteruskan kepada Ketua
                      Tim SDM. Tim SDM KGB atau Super Admin meninjau usulan data di menu Usulan UPT: Setujui menerapkannya
                      ke data pegawai, Kembalikan mengirimnya kembali ke UPT dengan catatan. Bila usulan menyebut SK
                      kenaikan pangkat, penyesuaian ijazah, atau PMK, persetujuannya sekaligus mencatat riwayat SK itu
                      dan menghitung ulang masa kerja golongan serta gaji pokoknya. Selama usulan belum ditinjau,
                      proses KGB pegawainya tertahan.
                    </p>
                    <p className="pg-hasil">
                      Hasil: data pegawai sesuai SK yang dilampirkan UPT, dan SK itu menjadi dasar KGB berikutnya.
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Input KGB dan Buat SK</h3>
                    <p className="pub-step-who">Tim SDM KGB</p>
                    <p>
                      Tim SDM memilih Input KGB di SIM-KGB, lalu Buat SK. SIM-KGB menghasilkan SK biasa dan SK versi
                      Srikandi.
                    </p>
                    <p className="pg-hasil">
                      Hasil: status <Status status="sedang_diproses" />.
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Tanda tangan elektronik SK</h3>
                    <p className="pub-step-who">Kepala Kanwil, atau Plh, Plt, atau Direktur Jenderal sesuai keadaan</p>
                    <p>SK versi Srikandi ditandatangani secara elektronik di Srikandi.</p>
                    <p className="pg-hasil">Hasil: SK sah dan siap dikirim.</p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Pengiriman SK</h3>
                    <p className="pub-step-who">Tim SDM KGB</p>
                    <p>
                      SK yang sudah ditandatangani dikirim kepada UPT pengusul, bagian keuangan UPT, dan KPPN mitra
                      satker.
                    </p>
                    <p className="pg-hasil">Hasil: ketiga penerima memegang SK yang sama.</p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Unggah SK ke SIM-KGB</h3>
                    <p className="pub-step-who">Tim SDM KGB</p>
                    <p>
                      Berkas PDF SK yang sudah ditandatangani diunggah dengan tombol Unggah SK TTE. SK pegawai UPT
                      langsung dapat diunduh UPT-nya.
                    </p>
                    <p className="pg-hasil">
                      Hasil: status <Status status="menunggu_keuangan" />.
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Rekam di Gaji Web dan jadwal berikutnya</h3>
                    <p className="pub-step-who">Keuangan Kanwil untuk pegawai Kanwil; keuangan UPT untuk pegawai UPT</p>
                    <p>
                      Pegawai Kanwil: keuangan Kanwil memeriksa SK dan memilih Konfirmasi, atau Tinjau dan Konfirmasi
                      untuk KGB yang berpotensi rapelan. Pegawai UPT: keuangan satkernya sendiri, lewat akun Admin UPT,
                      menetapkan rapelan dan menandai Sudah direkam di Gaji Web. Keduanya membuat SIM-KGB memperbarui
                      data pegawai dan membuat jadwal KGB berikutnya.
                    </p>
                    <p className="pg-hasil">
                      Hasil: status <Status status="selesai" />, dan KGB berikutnya tercatat{" "}
                      <Status status="belum_diproses" />.
                    </p>
                  </div>
                  </li>
                </ol>
                <div className="pub-note">
                  <strong className="pub-note-title">Surat permohonan tetap wajib</strong>
                  <p>
                    Walaupun usulan disiapkan dan diajukan di SIM-KGB, UPT tetap mengirim surat permohonan lewat Srikandi.
                    Surat itu menjadi dasar agenda dan disposisi di Kanwil.
                  </p>
                </div>
                <LanjutBagian dari="ringkasan" />
              </Bagian>

              {/* 2. Kewenangan */}
              <Bagian id="kewenangan" tampil={tampil}>
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
                <LanjutBagian dari="kewenangan" />
              </Bagian>

              {/* 3. Jadwal */}
              <Bagian id="jadwal" tampil={tampil}>
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
                  UPT melaporkan hukuman disiplin pegawainya lewat menu <strong>Lapor Hukdis</strong>; yang
                  menetapkan hukumannya dan menggeser jadwal KGB tetap Kanwil (lihat{" "}
                  <a href="#hukdis">hukuman disiplin dari UPT</a>).
                </p>

                <h3 className="pub-h3">Jendela proses di Kanwil</h3>
                <p>
                  Ajukan usulan KGB pada awal bulan kedua sebelum TMT, yaitu bulan yang sama dengan dibukanya jendela
                  proses, karena PP 7/1977
                  Pasal 12 ayat (2) mengatur pemberitahuan KGB diterbitkan 2 bulan sebelum KGB berlaku; batas waktu
                  pengiriman usulan mengikuti jadwal yang ditetapkan Kanwil.
                </p>
                <p>
                  Jadwal Kanwil mengikuti jendela proses di SIM-KGB. Untuk TMT pada tanggal 1 suatu bulan, input KGB
                  dibuka pada tanggal 1 bulan kedua sebelum TMT, dan Tim SDM harus selesai menginput paling lambat
                  tanggal {batas} bulan itu. Input sebelum jendela dibuka ditolak SIM-KGB. Input setelah batas tetap
                  diterima, tetapi ditandai <TandaRapelan />.
                </p>
                <p>
                  Batas itu sengaja sebelum akhir bulan. Setelah Input KGB masih ada Buat SK, tanda tangan elektronik,
                  unggah SK, dan perekaman oleh keuangan, dan semuanya harus selesai sebelum bagian keuangan satker
                  merekonsiliasi data gaji di aplikasi Gaji Web. Rekon gaji dan pengajuan SPM gaji induk berlangsung
                  tanggal 1 sampai paling lambat tanggal 15 bulan sebelum TMT, secara daring tanpa berkas fisik ke KPPN.
                  Keuangan dapat mengirimnya lebih awal dari tanggal 15; SK KGB yang baru masuk setelah pengiriman itu
                  tidak ikut gaji bulan TMT dan dibayar sebagai kekurangan gaji. Karena itu Tim SDM dan keuangan
                  memverifikasi data bersama sebelum penginputan di Gaji Web.
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
                        <th scope="row">UPT sebaiknya mengajukan usulan dan mengirim surat</th>
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
                        <th scope="row">SK ditandatangani, diunggah, dan direkam keuangan</th>
                        <td>sebelum {tgl(rekon.mulai)}</td>
                      </tr>
                      <tr>
                        <th scope="row">Rekon gaji dan pengajuan di Gaji Web oleh keuangan</th>
                        <td>
                          {tgl(rekon.mulai)} sampai {tgl(rekon.batas)}
                        </td>
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
                    Ajukan usulan dan kirim suratnya tanggal 1 sampai 10 bulan kedua sebelum TMT, yaitu bulan yang sama
                    dengan dibukanya jendela proses di SIM-KGB. Dengan begitu Tim SDM masih punya sisa bulan itu untuk input, membuat SK,
                    menandatanganinya lewat Srikandi, dan mengirimkannya sebelum keuangan merekon gaji bulan berikutnya.
                    Untuk TMT {tgl(TMT_KGB)}: kirim {jendelaKirim(TMT_KGB)}.
                  </p>
                </div>

                <h3 className="pub-h3">Bila usulan terlambat</h3>
                <p>
                  Usulan yang datang setelah jendela proses tetap diproses dan TMT tidak bergeser. Jika SK KGB terbit
                  setelah TMT, selisih gaji sejak TMT dibayarkan sebagai kekurangan gaji: operator gaji satker merekam SK
                  KGB di aplikasi Gaji Web, lalu satker mengajukan SPM-LS kekurangan gaji ke KPPN. Pembayaran ini
                  sehari-hari disebut rapel atau rapelan.
                </p>
                <LanjutBagian dari="jadwal" />
              </Bagian>


              {/* 4. KGB pertama setelah CPNS diangkat PNS */}
              <Bagian id="cpns-pns" tampil={tampil}>
                <h2 id="cpns-pns" className="pub-h2">
                  KGB pertama setelah CPNS diangkat menjadi PNS
                </h2>
                <p>
                  Masa kerja golongan dihitung sejak TMT CPNS, bukan sejak TMT PNS. Karena itu KGB pertama tetap jatuh
                  pada tanggalnya walaupun surat keputusan pengangkatan menjadi PNS baru terbit belakangan. Pengangkatan
                  yang melewati satu tahun masa percobaan diproses lebih dahulu oleh instansi ke BKN, dan TMT PNS
                  mengikuti tanggal pada SK pengangkatan; tanggal itu tidak berlaku surut.
                </p>

                <h3 className="pub-h3">Tiga hal yang membedakan</h3>
                <ul>
                  <li>
                    <strong>Masa kerja golongan berjalan sejak TMT CPNS.</strong> Untuk {PANGKAT}, KGB pertama jatuh
                    ketika masa kerja golongan mencapai 1 tahun, yaitu satu tahun setelah TMT CPNS.
                  </li>
                  <li>
                    <strong>Selama berstatus CPNS gaji dibayar {PERSEN_CPNS} persen</strong> dari gaji pokok. Gaji pokok
                    tetap naik pada TMT KGB, tetapi yang dibayarkan masih {PERSEN_CPNS} persen sampai TMT PNS.
                  </li>
                  <li>
                    <strong>SK pengangkatan PNS memuat gaji pokok penuh.</strong> Periksa angkanya: bila sudah memakai
                    gaji pokok hasil KGB, sejak TMT PNS tidak ada lagi kekurangan yang harus dirapel.
                  </li>
                </ul>

                <h3 className="pub-h3">
                  Contoh: CPNS {tgl(TMT_CPNS)}, diangkat PNS {tgl(TMT_PNS)}
                </h3>
                <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel gaji CPNS sampai diangkat PNS">
                  <table className="pub-table">
                    <caption>Gaji pokok dan gaji yang dibayarkan, {PANGKAT}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Periode</th>
                        <th scope="col">Status dan masa kerja</th>
                        <th scope="col" className="pub-num">Gaji pokok</th>
                        <th scope="col" className="pub-num">Dibayarkan</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">
                          {tgl(TMT_CPNS)} – {tgl(akhirBulanSebelum(TMT_KGB))}
                        </th>
                        <td>CPNS, masa kerja golongan {mkg(0, 0)}</td>
                        <td className="pub-num">{rp(GAJI_MKG_0)}</td>
                        <td className="pub-num">{rp(gajiCpns(GAJI_MKG_0))}</td>
                      </tr>
                      <tr>
                        <th scope="row">
                          {tgl(TMT_KGB)} – {tgl(akhirBulanSebelum(TMT_PNS))}
                        </th>
                        <td>CPNS, masa kerja golongan {mkg(1, 0)}, KGB pertama berlaku</td>
                        <td className="pub-num">{rp(GAJI_MKG_1)}</td>
                        <td className="pub-num">{rp(gajiCpns(GAJI_MKG_1))}</td>
                      </tr>
                      <tr>
                        <th scope="row">mulai {tgl(TMT_PNS)}</th>
                        <td>PNS, gaji pokok dibayar penuh</td>
                        <td className="pub-num">{rp(GAJI_MKG_1)}</td>
                        <td className="pub-num">{rp(GAJI_MKG_1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="pub-h3">Berapa yang dibayar sebagai kekurangan gaji</h3>
                <p>
                  Yang dirapel hanya bulan yang benar-benar terlanjur dibayar dengan gaji pokok lama. Pada contoh di
                  atas KGB berlaku {tgl(TMT_KGB)} sementara pengangkatan PNS berlaku {tgl(TMT_PNS)}, sehingga
                  kekurangannya {selisihBulan(TMT_KGB, TMT_PNS)} bulan.
                </p>
                <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel perhitungan kekurangan gaji">
                  <table className="pub-table">
                    <caption>
                      Kekurangan gaji pokok {bulanTahun(TMT_KGB)} sampai {bulanTahun(akhirBulanSebelum(TMT_PNS))}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Uraian</th>
                        <th scope="col" className="pub-num">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Seharusnya dibayar: {PERSEN_CPNS} persen dari {rp(GAJI_MKG_1)}</th>
                        <td className="pub-num">{rp(gajiCpns(GAJI_MKG_1))}</td>
                      </tr>
                      <tr>
                        <th scope="row">Sudah dibayar: {PERSEN_CPNS} persen dari {rp(GAJI_MKG_0)}</th>
                        <td className="pub-num">{rp(gajiCpns(GAJI_MKG_0))}</td>
                      </tr>
                      <tr>
                        <th scope="row">Selisih per bulan</th>
                        <td className="pub-num">{rp(gajiCpns(GAJI_MKG_1) - gajiCpns(GAJI_MKG_0))}</td>
                      </tr>
                      <tr>
                        <th scope="row">Kekurangan {selisihBulan(TMT_KGB, TMT_PNS)} bulan</th>
                        <td className="pub-num">
                          {rp((gajiCpns(GAJI_MKG_1) - gajiCpns(GAJI_MKG_0)) * selisihBulan(TMT_KGB, TMT_PNS))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="pub-note">
                  <strong className="pub-note-title">Yang ikut terbawa</strong>
                  <p>
                    Tunjangan yang dihitung dari gaji pokok, seperti tunjangan keluarga dan tunjangan beras, ikut
                    dihitung ulang oleh operator gaji satker. Angka pastinya keluar dari aplikasi Gaji Web setelah SK
                    KGB direkam, lalu diajukan ke KPPN sebagai SPM-LS kekurangan gaji.
                  </p>
                </div>

                <h3 className="pub-h3">KGB berikutnya</h3>
                <p>
                  Siklus berikutnya tetap dua tahun setelah KGB pertama, yaitu{" "}
                  {tgl(new Date(TMT_KGB.getFullYear() + 2, TMT_KGB.getMonth(), 1))} pada masa kerja golongan {mkg(3, 0)}{" "}
                  dengan gaji pokok {rp(GAJI_MKG_3)}. Pengangkatan PNS yang terlambat tidak menggeser jadwal ini, karena
                  masa kerja golongan tetap dihitung dari TMT CPNS.
                </p>
                <LanjutBagian dari="cpns-pns" />
              </Bagian>

              {/* 5. Kenaikan pangkat dan dampaknya pada KGB */}
              <Bagian id="kenaikan-pangkat" tampil={tampil}>
                <h2 id="kenaikan-pangkat" className="pub-h2">
                  Kenaikan pangkat, PMK, dan dampaknya pada KGB
                </h2>
                <p>
                  Kenaikan pangkat mengubah golongan ruang, dan karena itu mengubah kolom tabel gaji yang dipakai. Yang
                  sering terlewat: masa kerja golongan tidak dibawa utuh ke golongan baru. Saat pindah ke golongan yang
                  lebih tinggi, masa kerja golongan dipotong sesuai ketentuan penetapan gaji pokok.
                </p>
                <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel potongan masa kerja golongan">
                  <table className="pub-table">
                    <caption>Potongan masa kerja golongan saat naik golongan</caption>
                    <thead>
                      <tr>
                        <th scope="col">Dari</th>
                        <th scope="col">Ke</th>
                        <th scope="col" className="pub-num">Masa kerja golongan dipotong</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Golongan I</th>
                        <td>II/a</td>
                        <td className="pub-num">6 tahun</td>
                      </tr>
                      <tr>
                        <th scope="row">Golongan II</th>
                        <td>III/a</td>
                        <td className="pub-num">5 tahun</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  Kenaikan pangkat di dalam golongan yang sama, misalnya III/a ke III/b, tidak memotong masa kerja
                  golongan. Yang berubah hanya kolom gaji pokok yang dipakai.
                </p>

                <h3 className="pub-h3">Yang berubah dan yang tetap</h3>
                <ul>
                  <li>
                    <strong>Berubah:</strong> golongan ruang, masa kerja golongan, dan gaji pokok. Berubah pula SK yang
                    menjadi dasarnya: SK kenaikan pangkat itu menggantikan SK KGB terakhir pada bagian Atas Dasar SK
                    KGB berikutnya, sebab SK itulah yang terakhir menetapkan gaji pokok.
                  </li>
                  <li>
                    <strong>Tetap:</strong> jadwal KGB. Selang dua tahun dihitung dari KGB terakhir, bukan diulang dari
                    tanggal kenaikan pangkat. Yang dapat menggesernya hanya PMK, lihat di bawah.
                  </li>
                  <li>
                    <strong>Perlu ditinjau:</strong> KGB yang sedang diproses ketika kenaikan pangkat dicatat. Golongan
                    dan gaji pokok pada KGB itu masih memakai data lama, sehingga harus diperiksa ulang sebelum SK
                    dibuat.
                  </li>
                </ul>

                <h3 className="pub-h3">Peninjauan masa kerja (PMK)</h3>
                <p>
                  PMK adalah SK yang menambah masa kerja golongan yang diakui, misalnya dengan memperhitungkan masa
                  kerja sebelum CPNS, dan karena itu menetapkan gaji pokok baru. Bedanya dengan kenaikan pangkat:
                  golongan ruangnya tidak berubah, tetapi <strong>jadwal KGB dapat maju</strong>. Masa kerja golongan
                  bertambah sebesar tambahan pada SK PMK, sehingga langkah berikutnya di tabel gaji tercapai lebih
                  cepat; TMT KGB berikutnya dihitung ulang dari TMT PMK.
                </p>
                <p>
                  SK PMK juga menggantikan SK KGB terakhir sebagai dasar SK KGB berikutnya. SK PMK yang TMT-nya lebih
                  awal dari TMT KGB terakhir ditolak, sebab KGB itu telanjur dihitung tanpa PMK: koreksi KGB tersebut
                  lebih dulu, atau catat KGB yang terbit sesudah PMK lewat Arsip KGB.
                </p>

                <h3 className="pub-h3">Di SIM-KGB</h3>
                <p>
                  Keduanya dicatat dari halaman pegawai: buka pegawainya di Data Pegawai, lalu pada tab Data pegawai
                  tekan <strong>Catat kenaikan pangkat</strong> atau <strong>Catat PMK</strong>{" "}
                  di kartu Dasar KGB (lewat menu Tindakan namanya Catat peninjauan masa kerja). Di sisi kanan jendela, panel Dokumen
                  rujukan menampilkan SK sejenis yang sudah ada di arsip pegawai; SK baru dapat dilampirkan dan
                  otomatis masuk arsip setelah pencatatannya tersimpan. Sistem menghitung masa kerja golongan baru
                  beserta gaji pokoknya, menyimpan riwayatnya di tab Pangkat &amp; PMK, lalu menyelaraskan rencana KGB
                  berikutnya. Bila ada KGB yang sedang berjalan, sistem menandainya untuk ditinjau Tim SDM.
                </p>
                <p>
                  Untuk pegawai UPT, SK itu umumnya masuk lewat <a href="#untuk-upt">usulan UPT</a>, bukan diketik Tim
                  SDM: usulan yang mengubah golongan atau masa kerja golongan wajib menyebut SK sebabnya, dan
                  persetujuan Kanwil mencatat riwayatnya lewat jalur yang sama dengan kedua tombol di atas.
                </p>
                <LanjutBagian dari="kenaikan-pangkat" />
              </Bagian>

              {/* 6. Untuk admin UPT */}
              <Bagian id="untuk-upt" tampil={tampil}>
                <h2 id="untuk-upt" className="pub-h2">
                  Untuk Admin UPT: dari data pegawai sampai SK direkam
                </h2>
                <p>
                  Bagian ini menerangkan seluruh pekerjaan Admin UPT, urut sejak membuka SIM-KGB sampai SK KGB direkam
                  di Gaji Web satker. Tiap langkah disertai gambar layarnya. Angka bernomor pada gambar dijelaskan tepat
                  di bawahnya, dan nama menu serta tombol ditulis sama persis dengan yang tampil di layar Anda.
                </p>

                <div className="pub-note">
                  <strong className="pub-note-title">Yang dapat dan tidak dapat Anda lakukan</strong>
                  <p>
                    Akun Admin UPT hanya melihat pegawai satker Anda sendiri. Dari akun ini Anda menyiapkan dan
                    mengajukan usulan data pegawai, melaporkan mutasi, pemberhentian, dan hukuman disiplin, mengunduh SK
                    begitu diunggah Kanwil, lalu menandai SK yang sudah direkam di Gaji Web satker.
                  </p>
                  <p>
                    Yang <strong>tidak</strong> dapat Anda lakukan: mengubah data pegawai secara langsung. Setiap
                    perubahan harus lewat usulan, dan Kanwil meninjaunya lebih dulu. Hukuman disiplin yang sudah dicatat
                    Kanwil pun tampil terbatas bagi Anda: hanya masih berlaku atau tidak, menunda KGB atau tidak, dan
                    sampai kapan. Jenis dan nomor SK-nya tidak ditampilkan.
                  </p>
                </div>

                <h3 className="pub-h3">Enam langkah yang berulang tiap periode</h3>
                <ol>
                  <li>Buka SIM-KGB dan kenali enam menu Anda.</li>
                  <li>Tunggu pengingat masa kirim, atau lihat sendiri pita jadwal di dashboard.</li>
                  <li>Pastikan data pegawai sudah sama dengan SK; yang keliru dibetulkan lewat usulan.</li>
                  <li>Siapkan usulan di Usulan kolektif: pilih pegawainya, lengkapi data dan berkasnya.</li>
                  <li>Kirim surat usulan lewat Srikandi, lalu ajukan ke Kanwil dengan nomor surat itu.</li>
                  <li>Setelah SK terbit: unduh, rekam di Gaji Web satker, lalu tandai di SIM-KGB.</li>
                </ol>

                <h3 className="pub-h3">Langkah 1: Kenali menu Anda</h3>
                <p>
                  Sesudah masuk, menu di sisi kiri layar hanya berisi enam pilihan. Seluruhnya terbatas pada satker
                  Anda: pegawai satker lain tidak pernah tampil, dan tidak ada menu Kanwil di sana.
                </p>
                <LayarMenu />

                <h3 className="pub-h3">Langkah 2: Kapan usulan harus dikirim</h3>
                <p>
                  Surat usulan dikirim ke Kanwil pada <strong>tanggal 1 sampai {KIRIM_SURAT_BATAS}</strong>, di{" "}
                  <strong>bulan kedua sebelum TMT</strong> KGB pegawainya. Untuk KGB yang TMT-nya{" "}
                  {bulanTahun(TMT_KGB)}, berarti suratnya dikirim {jendelaKirim(TMT_KGB)}. Jaraknya dibuat dua bulan
                  supaya Kanwil sempat meninjau, membuat SK, dan menandatanganinya sebelum gaji bulan itu dibayarkan.
                </p>
                <p>
                  Anda tidak perlu mengingatnya sendiri. Begitu masa kirim dibuka, dashboard menampilkan jendela
                  pengingat berisi nama pegawai yang belum Anda ajukan.
                </p>
                <LayarPengingat namaBulan={bulanTahun(TMT_KGB)} batas={tgl(hitungKirimSurat(TMT_KGB).batas)} />
                <p>
                  Terlambat mengirim surat tidak membatalkan hak KGB pegawai, tetapi menggeser prosesnya: SK terbit
                  setelah gaji bulan itu dibayarkan, sehingga selisihnya dibayar belakangan sebagai rapelan. Itu
                  pekerjaan tambahan bagi keuangan satker Anda sendiri.
                </p>

                <h3 className="pub-h3">Langkah 3: Pastikan data pegawai sudah benar</h3>
                <p>
                  Dokumen aslinya ada di UPT, sedangkan yang mengetik datanya selama ini Kanwil. Pengetikan ganda itulah
                  sumber salah masa kerja golongan. Karena itu UPT mendata sendiri pegawainya. Ada empat jalan masuk,
                  semuanya dari menu <strong>Data Pegawai</strong>.
                </p>
                <LayarDataPegawai />
                <p>
                  Apa pun jalannya, isian Anda tersimpan sebagai <strong>draf milik satker</strong>: belum terlihat
                  Kanwil, boleh ditinggal dan dilanjutkan kapan saja, dan boleh dihapus bila keliru. NIP yang tercatat
                  salah juga dibetulkan lewat <strong>Usulkan perbaikan data</strong>: ketik NIP yang benar, lalu Kanwil
                  mencocokkannya dengan SK CPNS sebelum menyetujui.
                </p>

                <h4 className="pub-h3">Mengisi banyak pegawai sekaligus dengan Unggah daftar</h4>
                <p>
                  Untuk mengisi data pertama kali, atau meremajakan banyak data sekaligus, pakai{" "}
                  <strong>Unggah daftar</strong>. Unduh <strong>templat Excel</strong>-nya dari layar itu, isi lembar{" "}
                  <strong>{LEMBAR_DATA_UPT}</strong> satu baris untuk satu pegawai, lalu unggah kembali berkas .xlsx itu.
                  Isinya diperiksa dan ditampilkan lebih dulu; tidak ada yang tersimpan sebelum Anda mencentang dan
                  menekan Simpan.
                </p>
                <p>
                  Templat Excel sudah menyiapkan tiga hal yang dulu paling sering salah: kolom <code>nip</code> berformat
                  Text sehingga NIP tidak berubah menjadi <code>1,97E+17</code>, kolom tanggal berformat tanggal, dan
                  kolom berpilihan (golongan, jenis jabatan, eselon, jenis kelamin, pendidikan, dan sebab perubahan)
                  berupa daftar pilihan. Di dalamnya ada juga lembar <em>Panduan kolom</em>, <em>Panduan dasarBaru</em>,
                  dan <em>Contoh</em>; hanya lembar {LEMBAR_DATA_UPT} yang terbaca saat diunggah. Templat CSV tetap
                  tersedia dan tetap diterima.
                </p>
                <LayarUnggah />
                <p>
                  Pegawai yang <strong>sudah tercatat tidak ditolak</strong>. Barisnya dibandingkan dengan data yang ada:
                  bila ada yang berbeda, barisnya menjadi usulan perbaikan dan Anda dapat melihat data lama berdampingan
                  dengan data berkas; bila sama persis, barisnya dilewati karena memang tidak ada yang perlu diusulkan.
                  Jadi satu berkas boleh berisi seluruh pegawai satker Anda, tanpa perlu memilah lebih dulu mana yang
                  sudah ada.
                </p>
                <p>
                  <strong>Masa kerja golongan pegawai baru.</strong> Angkanya disalin dari SK KGB terakhir, dan TMT KGB
                  terakhir tetap TMT pada SK itu. Bila sesudah KGB itu pegawai naik dari golongan II ke III/a
                  (penyesuaian ijazah atau ujian dinas), masa kerja golongannya <strong>dikurangi 5 tahun</strong>; dari
                  golongan I ke II/a, 6 tahun. Contoh: KGB terakhir 1 Desember 2024 masih golongan II dengan masa kerja 7
                  tahun, lalu naik ke III/a pada 2026. Barisnya ditulis III/a, masa kerja 2 tahun, TMT KGB terakhir 1
                  Desember 2024, sehingga KGB berikutnya jatuh 1 Desember 2026. Bila masa kerjanya ditulis 7, sistem
                  membacanya sebagai masa kerja golongan III, menjadwalkan KGB setahun lebih awal, dan gaji pokoknya salah.
                  Tandanya mudah dikenali: pada golongan III dan IV masa kerja itu lazimnya genap.
                </p>

                <h4 className="pub-h3" id="kolom-dasar-baru">Enam kolom dasarBaru: sebab golongan atau masa kerja berubah</h4>
                <p>
                  Kolom <code>dasarBaruJenis</code> sampai <code>dasarBaruPenetap</code> menjawab satu pertanyaan:{" "}
                  <strong>mengapa golongan atau masa kerja golongan pada baris itu berbeda dari yang tercatat</strong>{" "}
                  di SIM-KGB. Untuk pegawai baru, dan untuk baris yang golongan serta masa kerjanya tidak berubah,
                  keenamnya dikosongkan. Untuk pegawai yang baru naik pangkat atau baru menerima SK PMK, SK-nya ditulis
                  di sini sehingga peremajaan sesudah kenaikan pangkat periode selesai sekali unggah. Kanwil mencatatnya
                  sebagai riwayat, menghitung ulang gaji pokoknya, dan SK itulah yang menjadi dasar SK KGB berikutnya.
                </p>
                <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Cara mengisi kolom dasarBaru">
                  <table className="pub-table">
                    <caption>Isian keenam kolom dasarBaru menurut keadaan pegawai (nomor SK fiktif)</caption>
                    <thead>
                      <tr>
                        <th scope="col">Keadaan</th>
                        <th scope="col">Isian kolom dasarBaru</th>
                        <th scope="col">Golongan, masa kerja, dan TMT pada baris yang sama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PANDUAN_DASAR_BARU.map((p) => {
                        const terisi = KOLOM_DASAR_BARU.filter((k) => p.isian[k]);
                        return (
                          <tr key={p.keadaan}>
                            <th scope="row">
                              {p.keadaan}
                              <br />
                              <small>{p.misalnya}</small>
                            </th>
                            <td>
                              {terisi.length === 0
                                ? "Keenam kolom kosong"
                                : terisi.map((k) => (
                                    <span key={k} className="pg-isian-dasar">
                                      <code>{k}</code>: {p.isian[k]}
                                    </span>
                                  ))}
                            </td>
                            <td>{p.barisLain}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul>
                  {ATURAN_DASAR_BARU.slice(2).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <h4 className="pub-h3">Yang paling sering merusak berkas: NIP di Excel</h4>
                <p>
                  Templat Excel sudah menjaga kolom NIP. Bagian ini berlaku bila Anda memakai templat CSV, atau menyalin
                  NIP dari daftar lain.
                </p>
                <p>
                  Excel memperlakukan NIP sebagai <em>angka</em>, bukan teks. Karena 18 digit tidak muat di lebar
                  kolom, Excel menampilkannya sebagai <code>1,97E+17</code>. Sampai di sini belum ada yang rusak.
                  Kerusakan terjadi <strong>saat berkasnya disimpan sebagai CSV</strong>: Excel menuliskan angka yang
                  tampil itu, sehingga NIP <code>197112051998031004</code> tersimpan menjadi{" "}
                  <code>197112000000000000</code>. Angka aslinya hilang dari berkas dan tidak dapat dikembalikan
                  dengan melebarkan kolom.
                </p>
                <p>
                  Yang membuatnya berbahaya: NIP rusak itu <strong>tetap 18 angka</strong>, jadi sekilas terlihat
                  wajar. Karena itu SIM-KGB tidak hanya menghitung panjangnya, melainkan memeriksa{" "}
                  <strong>susunannya</strong>: delapan angka pertama harus berupa tanggal lahir yang ada, enam
                  berikutnya bulan dan tahun TMT CPNS, lalu angka jenis kelamin (1 atau 2) dan nomor urut. Pada NIP
                  yang rusak, tanggal lahirnya menjadi 00 dan angka jenis kelaminnya 0, sehingga barisnya ditolak
                  dengan keterangan bahwa NIP-nya kemungkinan dirusak Excel, bukan diam-diam tersimpan sebagai
                  pegawai baru dengan NIP palsu.
                </p>
                <p>
                  <strong>Cara menghindarinya.</strong> Jangan membuka CSV dengan klik ganda. Buka Excel lebih dulu,
                  lalu <strong>Data → From Text/CSV</strong>, dan pada jendela pratinjau setel kolom <code>nip</code>{" "}
                  sebagai <strong>Text</strong> sebelum ditarik masuk. Bila mengetik NIP secara manual, awali dengan
                  tanda petik satu: <code>&apos;197112051998031004</code>.
                </p>
                <p>
                  <strong>Bila sudah telanjur.</strong> Selama berkasnya <em>belum</em> disimpan, NIP aslinya masih
                  utuh: tutup tanpa menyimpan, lalu buka ulang dengan cara di atas. Bila sudah telanjur disimpan,
                  berkas itu tidak dapat diperbaiki; ambil salinan aslinya, atau ketik ulang NIP yang rusak dari SK
                  pegawai yang bersangkutan.
                </p>
                <p>
                  Satu hal lagi yang sering menyulitkan: <strong>tanggal</strong>. Excel berbahasa Indonesia
                  menyimpannya sebagai dd/mm/yyyy, dan itu terbaca benar, tetapi periksalah tetap pada layar
                  pratinjau, sebab tanggal yang tertukar hari dan bulannya tidak dapat dikenali sistem sebagai
                  kekeliruan.
                </p>

                <h3 className="pub-h3">Langkah 4: Siapkan usulan di Usulan kolektif</h3>
                <p>
                  Inilah tempat kerja utama Anda tiap periode. <strong>Usulan kolektif</strong> menyiapkan banyak
                  pegawai untuk satu surat, dalam tiga langkah. Draf pegawai baru hasil Unggah daftar ikut otomatis.
                </p>
                <LayarKolektif1 namaBulan={bulanTahun(TMT_KGB)} />
                <p>
                  Sesudah memilih, Anda melengkapi data dan berkas tiap pegawai satu per satu. Daftar di kiri
                  menunjukkan siapa yang belum lengkap; kerjakan sampai lingkaran kelengkapannya penuh.
                </p>
                <LayarKolektif2 />

                <h4 className="pub-h3">Lima aturan yang menentukan benar atau tidaknya isian</h4>
                <ol>
                  <li>
                    <strong>Pilih dulu keadaan pegawainya.</strong> <em>Belum pernah KGB</em> hanya meminta TMT CPNS,
                    dan masa kerjanya 0 tahun 0 bulan. <em>Sudah pernah KGB</em> meminta TMT dan masa kerja golongan
                    yang tertulis pada SK KGB terakhir.
                  </li>
                  <li>
                    <strong>Golongan dan masa kerja golongan disalin dari SK, bukan dihitung sendiri.</strong> TMT-nya
                    tetap dari siklus KGB sebelumnya walau pegawainya baru naik pangkat, sebab kenaikan pangkat tidak
                    mengulang hitungan KGB. Bila sesudah SK KGB itu terbit SK kenaikan pangkat, penyesuaian ijazah, atau
                    peninjauan masa kerja, isikan golongan dan masa kerja dari SK yang paling baru.
                  </li>
                  <li>
                    <strong>Pangkat, gaji pokok, dan TMT KGB berikutnya dihitung sistem</strong> dari tabel PP 5/2024,
                    lengkap dengan keterangan asal angkanya. Ketiganya sengaja tidak dapat diketik, karena salah ketik
                    di situ langsung menggeser uang. Perhatikan pegawai golongan II/a: KGB pertamanya jatuh{" "}
                    <strong>satu tahun</strong> setelah TMT CPNS, bukan dua tahun seperti golongan lain.
                  </li>
                  <li>
                    <strong>Bila golongan atau masa kerja berubah, sebutkan SK penyebabnya.</strong> Keduanya hanya
                    berubah karena kenaikan pangkat (termasuk penyesuaian ijazah), peninjauan masa kerja, atau salah
                    ketik. Untuk SK baru, isi nomor, tanggal, TMT, dan pejabat penetapnya. Kanwil mencatatnya sebagai
                    riwayat, menghitung ulang gaji pokoknya, dan <strong>SK itulah yang menjadi dasar SK KGB
                    berikutnya</strong>. Untuk kenaikan pangkat, masa kerja yang Anda ketik hanya menjadi keterangan:
                    sistem menghitungnya sendiri, dan naik dari golongan II ke III memotong masa kerja 5 tahun.
                  </li>
                  <li>
                    <strong>Unggah pindaian SK-nya</strong>, masing-masing PDF paling besar 500 KB. Pindai sebagai
                    dokumen, bukan foto kamera, agar ukurannya muat. Tiap berkas dapat dipratinjau sebelum diunggah,
                    lalu diganti atau dihapus, supaya dapat dipastikan tidak tertukar.
                  </li>
                </ol>
                <p>
                  Berkas yang diminta mengikuti keadaan pegawai. Yang <strong>sudah pernah KGB</strong>:{" "}
                  <strong>SK KGB terakhir</strong> dan <strong>SK kenaikan pangkat terakhir</strong>, keduanya wajib.
                  Yang <strong>belum pernah KGB</strong>: <strong>SK CPNS</strong>, wajib karena SK inilah acuan
                  pertamanya, sebab TMT CPNS menjadi awal masa kerja golongan, dan nomor serta tanggalnya tercetak sebagai SK
                  dasar pada surat KGB pertama, dan <strong>SK pengangkatan PNS</strong> bila sudah terbit, boleh
                  digabung dengan SPMT. Berkas ini diminta tim keuangan agar masa kerja golongan dapat dicocokkan dengan
                  dokumen aslinya, bukan dengan ingatan.
                </p>
                <p>
                  Berkas wajib ditagih saat diajukan: bagi pegawai baru selalu, bagi usulan perbaikan hanya bila
                  golongan, TMT golongan, masa kerja golongan, atau TMT KGB terakhirnya ikut diubah. Pada usulan
                  perbaikan berikutnya, nomor dan tanggal SK dasar serta berkas terakhir yang sudah disetujui Kanwil{" "}
                  <strong>terisi sendiri</strong> dan bertanda <em>disetujui</em>; pilih PDF baru hanya bila SK-nya
                  memang berganti.
                </p>
                <p>
                  Dua hal yang <strong>tidak</strong> diisi di sini. <strong>Hukuman disiplin</strong> dilaporkan lewat
                  menu <strong>Lapor Hukdis</strong> beserta pindaian SK-nya (lihat{" "}
                  <a href="#hukdis">hukuman disiplin dari UPT</a>). <strong>Surat usulan Srikandi</strong> diunggah
                  sekali saja pada langkah berikutnya, karena satu surat memuat banyak pegawai.
                </p>
                <p>
                  Setelah SK KGB direkam di Gaji Web, SK itulah dasar KGB reguler berikutnya. Kolom{" "}
                  <em>Dasar KGB berikutnya</em> di Data Pegawai menunjukkan SK mana yang berlaku sekarang, dan berpindah
                  sendiri begitu ada SK kenaikan pangkat, penyesuaian ijazah, atau peninjauan masa kerja yang lebih baru
                  disetujui Kanwil. Bagi pegawai yang belum pernah KGB di SIM-KGB, kolom itu menampilkan SK dasar yang
                  tercatat di data pegawainya: SK KGB terakhir yang terbit di luar SIM-KGB, atau SK CPNS.
                </p>
                <p>
                  SK yang Anda unggah pada draf atau usulan perbaikan <strong>belum</strong> menjadi dasar sebelum Kanwil
                  menyetujuinya. Sampai saat itu SK tersebut tampil di bawah kolom yang sama dengan penanda{" "}
                  <em>Di draf, belum diajukan</em> atau <em>Menunggu Kanwil</em>, supaya terlihat bahwa berkasnya sudah
                  masuk dan sedang menunggu apa.
                </p>

                <h3 className="pub-h3">Langkah 5: Kirim surat lewat Srikandi, lalu ajukan</h3>
                <p>
                  Urutannya penting: <strong>kirim suratnya dulu lewat Srikandi</strong>, baru ajukan di SIM-KGB dengan
                  nomor surat yang sama. Nomor, tanggal, dan PDF suratnya diisi sekali dan berlaku untuk semua pegawai
                  pada surat itu, karena satu surat usulan lazim memuat beberapa pegawai.
                </p>
                <LayarKolektif3 />
                <p>
                  Sesudah diajukan, usulannya pindah ke kolom <strong>Di Kanwil</strong> dan tidak lagi dapat disunting,
                  sebab peninjau di Kanwil harus melihat persis apa yang dikirim UPT. Yang telanjur salah dapat
                  dibatalkan dengan <strong>Batalkan usulan</strong> selama belum ditinjau.
                </p>
                <p>
                  Usulan tidak langsung mengubah data. Super Admin atau Tim SDM KGB meninjaunya lebih dulu, lalu memilih{" "}
                  <strong>Setujui</strong> atau <strong>Kembalikan</strong> untuk revisi dengan catatan. Usulan yang
                  dikembalikan muncul lagi di Perlu dikerjakan beserta catatannya: perbaiki, lalu ajukan ulang; nomor
                  surat yang lama sudah terisi di jendela Ajukan ke Kanwil. Selama usulan menunggu tinjauan, proses KGB
                  pegawainya (Input KGB, Buat SK, Unggah SK TTE) tertahan agar SK dibuat dari data yang sudah
                  diperbarui. Hasil tinjauan tercatat di <strong>Riwayat → Usulan dan laporan</strong>. Satu pegawai
                  hanya boleh punya satu usulan yang belum selesai, agar antrian tinjauan tidak berisi dua versi yang
                  saling menimpa.
                </p>

                <h4 className="pub-h3">Memantau semuanya dari papan Alur KGB</h4>
                <p>
                  Dashboard Anda memuat satu papan berisi empat kolom. Tiap pegawai berada di kolom tahapnya, jadi
                  cukup melihat papan ini untuk tahu apa yang masih menunggu Anda dan apa yang sedang di Kanwil.
                </p>
                <LayarPapan />
                <p>
                  Perhatikan arti kolom terakhir. <strong>Selesai</strong> berisi satu hal saja: KGB yang SK-nya sudah
                  Anda rekam di Gaji Web satker. Usulan perbaikan data yang disetujui Kanwil <em>tidak</em> masuk ke
                  sana, sebab yang berubah hanya datanya, bukan gajinya; hasil tinjauannya ada di{" "}
                  <strong>Riwayat → Usulan dan laporan</strong>. Dengan begitu jumlah pada kolom Selesai selalu dapat
                  dibaca sebagai &ldquo;sudah beres sampai Gaji Web&rdquo;.
                </p>

                <h3 className="pub-h3">Langkah 6: Setelah SK terbit, unduh dan rekam di Gaji Web</h3>
                <p>
                  Tiap UPT adalah satuan kerja tersendiri dengan daftar isian pelaksanaan anggaran, bagian keuangan, dan
                  akun Gaji Web sendiri. Karena itu keuangan Kanwil hanya menindaklanjuti <strong>pegawai Kanwil</strong>.
                  Begitu Tim SDM Kanwil mengunggah SK bertanda tangan, SK pegawai UPT langsung dapat diunduh UPT-nya, dan
                  keuangan UPT yang menetapkan rapelan serta merekamnya di Gaji Web satker.
                </p>
                <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel pembagian tugas setelah SK terbit">
                  <table className="pub-table">
                    <caption>Siapa mengerjakan apa setelah SK diunggah Tim SDM Kanwil</caption>
                    <thead>
                      <tr>
                        <th scope="col">Langkah</th>
                        <th scope="col">Pegawai Kanwil</th>
                        <th scope="col">Pegawai UPT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Memeriksa SK dan menetapkan rapelan</th>
                        <td>Keuangan Kanwil</td>
                        <td>Keuangan UPT (akun Admin UPT)</td>
                      </tr>
                      <tr>
                        <th scope="row">Merekam di Gaji Web</th>
                        <td>Keuangan Kanwil</td>
                        <td>Keuangan UPT, di akun Gaji Web satker</td>
                      </tr>
                      <tr>
                        <th scope="row">Arti status Selesai</th>
                        <td>Sudah dikonfirmasi dan direkam di Gaji Web</td>
                        <td>Sudah dikonfirmasi dan direkam di Gaji Web satker</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <LayarSkTerbit />
                <p>
                  Urutan yang benar: <strong>unduh SK, rekam di Gaji Web satker, baru tandai di SIM-KGB</strong>. Jangan
                  menandainya lebih dulu, sebab penandaan itu sekaligus menjadi konfirmasi keuangan: data pegawai
                  diperbarui, jadwal KGB berikutnya dibuat, dan tidak dapat dibatalkan dari layar itu. Kanwil hanya
                  memantau SK yang belum direkam lewat panel SK UPT belum direkam. Batas waktunya sama untuk semua
                  satuan kerja, karena SPM gaji induk bulan berjalan tetap paling lambat tanggal 15 bulan sebelumnya.
                </p>

                <h4 className="pub-h3">Menu Riwayat: dua catatan yang berbeda</h4>
                <p>
                  Menu <strong>Riwayat</strong> terbuka pada <strong>Riwayat KGB</strong>: satu baris untuk tiap
                  pegawai satker Anda, berisi KGB terakhirnya, golongan dan gaji pokok sebelum dan sesudahnya, serta
                  jumlah siklus yang pernah dijalani. Buka satu baris untuk melihat seluruh siklusnya dari yang
                  terbaru, lengkap dengan nomor SK, masa kerja golongan, dan tanggal perekamannya di Gaji Web. SK
                  lama yang direkam Kanwil sebagai arsip ikut tampil di sini, sehingga dasar KGB berikutnya dapat
                  ditelusuri sampai ke belakang. Inilah yang dibuka bila ada yang bertanya &ldquo;gaji pegawai ini
                  terakhir naik kapan, dan berapa&rdquo;.
                </p>
                <p>
                  Tombol <strong>Usulan dan laporan</strong> di kanan atas membuka catatan yang lain: semua usulan
                  data dan laporan mutasi atau pemberhentian yang pernah Anda kirim ke Kanwil beserta hasil
                  tinjauannya. Dua hal ini sengaja dipisah karena menjawab pertanyaan yang berbeda, yang satu tentang
                  perjalanan gaji pegawai, yang lain tentang kiriman Anda sudah ditinjau atau belum.
                </p>

                <h3 className="pub-h3">Yang wajib dipastikan sebelum surat dikirim</h3>
                <p>
                  Permintaan tim keuangan: UPT memastikan sendiri masa kerja golongan dan status hukuman disiplin
                  pegawai yang diusulkan. Masa kerja golongan yang keliru membuat gaji pokok pada SK salah hitung,
                  dan hukuman disiplin yang tidak dilaporkan membuat KGB tetap terbit padahal seharusnya ditunda.
                  Kekurangan gaji masih dapat dibayar sebagai rapel, tetapi kelebihan gaji harus disetor kembali ke
                  kas negara oleh pegawai yang bersangkutan.
                </p>
                <ol>
                  {BUTIR_KONFIRMASI_UPT.map((butir) => (
                    <li key={butir}>{butir}</li>
                  ))}
                </ol>
                <div className="pub-note">
                  <strong className="pub-note-title">Menindaklanjutinya di SIM-KGB</strong>
                  <p>
                    Pegawai yang KGB-nya masuk bulan usulan muncul di kolom <strong>Perlu dikerjakan</strong> sebagai
                    pengingat <em>Perlu diperiksa</em>, lengkap dengan batas input Kanwil. Draf usulan data (perbaikan atau
                    pegawai baru) juga ada di kolom itu berapa pun TMT KGB-nya, sebab yang diajukan adalah datanya, bukan
                    KGB-nya: KGB yang belum dibuka tetap terkunci, dan kartunya menyebut kapan KGB itu diusulkan. Bila ada yang keliru, pilih{" "}
                    <strong>Usulkan perbaikan data</strong> sebelum batas itu. Hukuman disiplin yang belum dilaporkan
                    disampaikan lewat menu <strong>Lapor Hukdis</strong>; pegawai yang pindah, BKO, atau berhenti
                    dilaporkan dengan <strong>Laporkan mutasi</strong> pada barisnya. Pegawai yang sedang{" "}
                    <strong>BKO</strong> tetap tampil di daftar satker Anda dengan penanda kuning{" "}
                    <em>BKO di …</em>, sebab penugasan itu tidak memindahkan unit kerjanya: KGB-nya tetap Anda
                    usulkan dan Anda rekam di Gaji Web satker ini.
                  </p>
                  <p>
                    <strong>Kenaikan pangkat, penyesuaian ijazah, dan peninjauan masa kerja.</strong> Sesudah SK
                    KGB terakhir pun masih mungkin terbit SK kenaikan pangkat atau SK PMK, dan SK itulah yang
                    menggeser masa kerja golongan sekaligus menjadi dasar SK KGB berikutnya. Laporkan lewat{" "}
                    <strong>Laporkan kenaikan pangkat</strong> atau <strong>Laporkan peninjauan masa kerja</strong>{" "}
                    pada baris pegawainya. Masing-masing membuka jendelanya sendiri yang hanya memuat apa yang
                    tertulis di SK itu: golongan baru atau masa kerja menurut SK, nomor, tanggal, TMT, pejabat
                    penetapnya, dan <strong>pindaian SK-nya</strong>. Akibat SK itu langsung terlihat di kotak
                    <em> Dihitung sistem</em> sebelum disimpan. Masa kerja golongan dan gaji pokoknya dihitung Kanwil
                    saat menyetujui; naik dari golongan II ke III tetap memotong masa kerja 5 tahun, sehingga angka
                    yang Anda ketik tidak pernah diam-diam menggeser uang.
                  </p>
                  <p>
                    Laporan SK <strong>tidak menumpang surat usulan Srikandi</strong>: SK-nya sudah terbit dan
                    pindaiannya ikut terkirim, jadi yang disampaikan adalah kejadian yang sudah selesai, sama
                    seperti laporan mutasi dan laporan hukuman disiplin. Kartunya meminta sekalian berkas lain yang
                    akan ditagih (SK KGB terakhir dan SK kenaikan pangkat terakhir), dan begitu semuanya terlampir,
                    tombol <strong>Kirim ke Kanwil</strong> menyalakan dirinya: satu jendela, selesai, tanpa mampir
                    ke Usulan kolektif. Berkas yang pemindaiannya belum selesai tidak membuat isian hilang; simpan
                    sebagai draf, lalu kirim setelah lengkap. Usulan yang sekalian mengubah jabatan atau kolom lain
                    tetap berangkat bersurat lewat Usulan kolektif seperti biasa. SK
                    yang sudah dicatat Kanwil terlihat di <strong>Riwayat KGB</strong>, pada baris pegawai yang
                    dibuka, dan pada kolom <em>Dasar KGB berikutnya</em> baris itu bertanda <em>Dari KP/PI</em> atau{" "}
                    <em>Dari PMK</em>.
                  </p>
                  <p>
                    Untuk baris yang <strong>seharusnya tidak pernah tercatat</strong>, yaitu entri ganda, NIP salah
                    ketik, atau orang yang tidak pernah bertugas di satker Anda; pakai tautan{" "}
                    <strong>Seharusnya tidak tercatat?</strong> di bawah tombol Laporkan mutasi. Isinya alasan dan
                    keterangan, tanpa SK dan tanpa TMT. Admin UPT memang tidak dapat menghapus data pegawai: Kanwil
                    yang meninjau lalu menonaktifkannya, sehingga riwayat KGB dan berkas SK-nya tetap utuh dan masih
                    dapat dipulihkan bila laporannya yang keliru.
                  </p>
                  <p>
                    Bila sampai batas input tidak ada usulan, data pegawai dianggap benar dan pengingatnya hilang
                    sendiri; tidak ada tombol untuk menyatakannya. Usulan yang disetujui Kanwil tercatat beserta nama
                    pengusulnya dan terlihat oleh Tim SDM saat memproses KGB.
                  </p>
                </div>

                <h3 className="pub-h3">Daftar periksa surat</h3>
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
                    Kirim tanggal 1 sampai 10 bulan kedua sebelum TMT; surat paling lambat diterima awal
                    bulan kedua sebelum TMT agar dapat diinput sebelum batas proses Tim SDM (lihat{" "}
                    <a href="#jadwal">jadwal</a>).
                  </li>
                </ul>

                <div className="pub-table-wrap" tabIndex={0} role="region" aria-label="Tabel lampiran surat permohonan">
                  <table className="pub-table">
                    <caption>Lampiran surat permohonan di Srikandi</caption>
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
                            <li>SK pengangkatan PNS, bila sudah terbit</li>
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
                  Daftar ini untuk lampiran surat di Srikandi, menurut praktik Kanwil dan bukan daftar yang ditetapkan
                  peraturan; Tim SDM Kanwil dapat meminta dokumen lain bila diperlukan. Berkas yang diunggah ke SIM-KGB
                  lebih ringkas dan mengikuti keadaan pegawai seperti pada langkah di atas: SKP tidak diunggah.
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
                  <li>SK dasar tidak dilampirkan, misalnya SK KGB terakhir, atau SK CPNS bagi pegawai yang belum pernah KGB.</li>
                  <li>NIP salah ketik. Betulkan lewat Usulkan perbaikan data sebelum KGB-nya diproses.</li>
                  <li>
                    Surat diterima setelah batas proses Tim SDM, sehingga SK berisiko terbit setelah TMT dan selisih gaji
                    dibayar kemudian sebagai kekurangan gaji.
                  </li>
                </ul>
                <LanjutBagian dari="untuk-upt" />
              </Bagian>

              {/* 5. Di Kanwil */}
              <Bagian id="di-kanwil" tampil={tampil}>
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
                    <strong>Tim SDM</strong> meninjau usulan UPT yang menyertai surat itu, lalu memproses KGB di SIM-KGB
                    (lihat <a href="#di-sim-kgb">langkah Tim SDM</a>).
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
                          <td>Rumah Tahanan Negara Kelas IIB Rantau</td>
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
                  SIM-KGB sudah mencatat jadwal KGB dan usulan data dari UPT, tetapi keduanya bukan naskah dinas. Surat
                  permohonan tetap diperlukan karena:
                </p>
                <ul>
                  <li>surat menjadi dasar pencatatan agenda dan disposisi Kepala Kanwil;</li>
                  <li>disposisi memberi Tim SDM perintah tertulis untuk menerbitkan SK;</li>
                  <li>surat memuat usulan resmi Kepala UPT beserta lampiran yang menjadi bahan pemeriksaan;</li>
                  <li>surat dan disposisi menjadi arsip bila SK perlu diperiksa kemudian.</li>
                </ul>
                <LanjutBagian dari="di-kanwil" />
              </Bagian>

              {/* 6. Di SIM-KGB */}
              <Bagian id="di-sim-kgb" tampil={tampil}>
                <h2 id="di-sim-kgb" className="pub-h2">
                  Di SIM-KGB: langkah Tim SDM
                </h2>
                <p>
                  Langkah berikut dikerjakan setelah disposisi sampai ke Tim SDM. Nama menu dan tombol ditulis sama
                  dengan yang tampil di SIM-KGB.
                </p>
                <ol className="pub-steps">
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Tinjau usulan UPT</h3>
                    <p className="pub-step-who">
                      Tim SDM KGB atau Super Admin, menu Usulan UPT atau tombol Tinjau usulan UPT di Antrian kerja KGB
                    </p>
                    <p>
                      Daftar berisi satu nama per pegawai, dikelompokkan per UPT dan dapat disaring per UPT; usulan lain
                      pegawai yang sama ada di Riwayat usulan pada detailnya. Periksa perbedaan isian dengan data yang tercatat, berkas SK dasar,
                      dan dampaknya pada KGB yang sedang berjalan, lalu pilih Setujui atau Kembalikan. Kembalikan wajib
                      disertai catatan; UPT memperbaikinya lalu mengajukan ulang dengan surat yang sama.
                    </p>
                    <p>
                      Usulan yang mengubah golongan ruang atau masa kerja golongan wajib menyebut sebabnya, dan panel
                      tinjauan menampilkan SK yang disebut UPT beserta akibat persetujuannya. Bila sebabnya SK kenaikan
                      pangkat, penyesuaian ijazah, atau PMK, Setujui membentuk riwayat pangkat atau PMK-nya, sehingga SK
                      itu menjadi Atas dasar SK KGB berikutnya, sama seperti Catat kenaikan pangkat dan Catat PMK di
                      halaman pegawai. Masa kerja golongan dan gaji pokoknya dihitung sistem, bukan diambil apa adanya
                      dari angka yang diketik UPT: naik dari golongan II ke III tetap memotong masa kerja 5 tahun, dan
                      PMK tetap menghitung pergeseran jadwal KGB-nya. Bila sebabnya koreksi salah ketik, nilainya
                      dipakai apa adanya dan dasar KGB berikutnya tidak berpindah.
                    </p>
                    <p>
                      Usulan pegawai baru yang disetujui langsung menambahkan pegawai beserta jadwal KGB-nya, dan SK yang
                      diketik UPT (misalnya SK CPNS) menjadi SK dasar Input KGB pertama. Bila KGB pegawai sedang berjalan
                      dan SK-nya belum diunggah, perhitungannya disesuaikan otomatis saat usulan disetujui. Selama usulan
                      menunggu, baris pegawai bertanda Tertahan usulan UPT dan langkah prosesnya ditolak.
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Periksa data pegawai</h3>
                    <p className="pub-step-who">Tim SDM, menu Data Pegawai</p>
                    <p>
                      Cari setiap pegawai pada surat menurut NIP. Pegawai UPT yang belum terdaftar masuk lewat usulan
                      pegawai baru dari UPT; pegawai Kanwil ditambahkan dengan tombol Tambah Pegawai, atau Impor CSV
                      untuk banyak pegawai sekaligus. Golongan, masa kerja golongan, dan TMT KGB
                      terakhir harus sama dengan SK yang dilampirkan UPT; gaji pokok dan TMT KGB berikutnya terisi
                      sendiri dari ketiganya menurut tabel PP 5/2024, sehingga tidak perlu diketik. Isi TMT KGB
                      berikutnya hanya bila memang bergeser, misalnya karena penundaan hukuman disiplin. Pegawai yang
                      baru ditambahkan langsung mendapat jadwal KGB berstatus <Status status="belum_diproses" />.
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
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Pastikan data penandatangan berlaku</h3>
                    <p className="pub-step-who">Super Admin, menu Pengaturan</p>
                    <p>
                      Buka bagian Penandatangan Surat KGB. Pastikan ada penandatangan yang berlaku pada tanggal SK yang
                      akan dibuat: Kepala Kanwil, atau Plh atau Plt dengan dasar penunjukannya. Untuk KGB milik Kepala
                      Kanwil, data Direktur Jenderal juga harus terisi.
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Input KGB</h3>
                    <p className="pub-step-who">Tim SDM, menu Dashboard atau Proses KGB</p>
                    <p>
                      Di Dashboard, buka Antrian kerja KGB pada ubin Perlu diproses, lalu pilih Input KGB pada kartu
                      pegawai. Antrian itu kini hanya bertampilan papan; tampilan Daftar sudah dilepas karena kolom
                      papan sudah menjawab pertanyaan yang sama. Di menu Proses KGB, pilih Input KGB pada baris
                      berstatus Belum Diproses. Jendela Input KGB menampilkan
                      data kepegawaian saat ini dan hasil perhitungan: masa kerja golongan baru, gaji pokok baru, TMT KGB
                      baru, TMT KGB berikutnya, dan batas input SDM.
                    </p>
                    <p>
                      Bagian <strong>Atas Dasar</strong> berisi SK terbaru yang menetapkan gaji pokok pegawai, dan
                      judul serta nama isiannya menyesuaikan SK itu: Atas Dasar SK KGB Terakhir, SK Kenaikan Pangkat,
                      SK PMK, atau SK CPNS bagi pegawai yang belum pernah KGB. Aturannya: SK KGB terakhir dipakai,
                      kecuali ada SK kenaikan pangkat, penyesuaian ijazah, atau PMK yang TMT-nya sesudah SK KGB itu.
                      Isiannya terisi sendiri dari riwayat KGB, riwayat pangkat dan PMK, atau SK dasar yang tercatat
                      pada data pegawai, misalnya SK CPNS yang diketik UPT pada usulannya. Cocokkan dengan SK yang
                      dilampirkan. Nomor, Tanggal, dan TMT-nya wajib diisi; Oleh wajib dilengkapi paling lambat saat
                      Buat SK. Isian Oleh adalah pejabat yang menetapkan SK dasar itu, bukan yang menandatangani SK KGB
                      yang sedang dibuat. Pilih Simpan Input KGB. Status berubah menjadi{" "}
                      <Status status="sedang_diproses" />.
                    </p>
                    <p>
                      Baris <em>Masa kerja golongan pada tanggal tersebut</em> yang tercetak di SK KGB mengikuti SK
                      dasar itu: masa kerja golongan pegawai pada TMT SK dasar, bukan pada TMT KGB yang sedang dibuat.
                    </p>
                    <p>SIM-KGB menolak Input KGB bila:</p>
                    <ul>
                      <li>
                        jendela proses belum dibuka, yaitu sebelum tanggal 1 bulan kedua sebelum TMT. Kartu pegawai belum
                        tampil di Dashboard, dan barisnya di menu Proses KGB bertuliskan Terkunci beserta tanggal jendela
                        proses dibuka;
                      </li>
                      <li>pegawai sedang menjalani hukuman disiplin yang menunda KGB;</li>
                      <li>
                        masih ada usulan perbaikan data dari UPT yang belum ditinjau. Barisnya bertanda Tertahan usulan
                        UPT dan tombolnya menjadi Tinjau usulan UPT; aturan yang sama berlaku untuk Buat SK dan Unggah SK
                        TTE; atau
                      </li>
                      <li>pegawai masih memiliki KGB berstatus Sedang Diproses atau Menunggu Keuangan.</li>
                    </ul>
                    <p>
                      Pegawai yang tercatat berhenti sebelum TMT KGB-nya tidak lagi muncul di antrian. Pemberhentian
                      dilaporkan UPT lewat Laporkan mutasi dan ditetapkan Kanwil.
                    </p>
                    <p>
                      Input setelah batas proses tetap diterima dan KGB ditandai <TandaRapelan />. Tanda ini dihitung
                      otomatis dari tanggal Input KGB dan tidak dapat diubah Tim SDM.
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Buat SK</h3>
                    <p className="pub-step-who">Tim SDM, kartu atau baris berstatus Sedang Diproses</p>
                    <p>
                      Buat SK hanya tersedia setelah Input KGB, yaitu untuk KGB berstatus{" "}
                      <Status status="sedang_diproses" />. Pilih Buat SK untuk membuka jendela Buat Surat Keputusan KGB.
                      Periksa bagian Atas Dasar SK Terakhir; keempat isiannya wajib, termasuk Oleh. Lalu isi
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
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
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
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Unggah SK yang sudah ditandatangani</h3>
                    <p className="pub-step-who">Tim SDM, kartu atau baris berstatus Sedang Diproses</p>
                    <p>
                      Tombol Unggah SK TTE muncul setelah SK dibuat dengan Buat SK. Unduh naskah yang sudah ditandatangani
                      dari Srikandi, pilih Unggah SK TTE, pilih berkas PDF (paling besar 500 KB) pada jendela Unggah SK yang
                      Sudah Ditandatangani, lalu pilih Unggah SK. Status berubah menjadi{" "}
                      <Status status="menunggu_keuangan" />. KGB pegawai Kanwil muncul di menu Keuangan; SK pegawai UPT
                      langsung dapat diunduh UPT-nya dan menunggu keuangan satker merekamnya di Gaji Web (ubin Di
                      keuangan, bagian rekam UPT).
                    </p>
                  </div>
                  </li>
                  <li>
                    <div className="pg-langkah">
                    <h3 className="pub-step-title">Bila ada data yang salah</h3>
                    <p className="pub-step-who">
                      Tim SDM, kartu Sedang Diproses di Dashboard atau Detail KGB di menu Proses KGB
                    </p>
                    <p>
                      Pilih Batalkan KGB pada kartu Sedang Diproses di Dashboard, atau di Detail KGB pada menu Proses KGB
                      untuk status Belum Diproses maupun Sedang Diproses, lalu tulis alasannya. Alasan wajib diisi, lalu
                      pilih Batalkan KGB pada jendela konfirmasi. Status menjadi{" "}
                      <Status status="ditolak" />. Perbaiki data pegawai, lalu pilih Input Ulang KGB pada kartu di kolom
                      Belum Diproses atau di Detail KGB. KGB yang sudah Menunggu Keuangan tidak dapat dibatalkan langsung;
                      Keuangan yang mengembalikannya lebih dulu.
                    </p>
                    <p>
                      <strong>Dikembalikan Keuangan.</strong> Bila Keuangan menemukan kekeliruan pada SK yang menunggu
                      konfirmasi, ia memilih <strong>Kembalikan</strong> pada baris antreannya beserta alasannya. Status
                      kembali ke <Status status="sedang_diproses" />, kartunya kembali ke kolom Sedang Diproses, dan
                      alasannya muncul di panel tindakan dasbor Tim SDM. Data pegawai belum berubah sama sekali, sebab
                      gaji pokok dan jadwal KGB berikutnya baru ditulis saat konfirmasi. Dari kolom itu, SK-nya dapat
                      diganti dengan Unggah SK TTE, atau prosesnya dibatalkan sekalian bila yang keliru justru angkanya.
                    </p>
                    <p>
                      Bila selama KGB berjalan tercatat hukuman disiplin yang menunda KGB berikutnya, pembatalan ditolak.
                      Hapus catatan hukuman disiplin itu terlebih dahulu, batalkan KGB, lalu catat kembali hukuman disiplin
                      setelah KGB diinput ulang.
                    </p>
                  </div>
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
                    SK, Tanggal SK, TMT SK, dan Oleh bila diketahui, pilih Berkas SK (PDF) paling besar 500 KB,
                    lalu pilih Simpan Arsip. KGB langsung berstatus <Status status="selesai" /> tanpa konfirmasi keuangan, data gaji pegawai
                    diperbarui, dan jadwal KGB berikutnya dibuat. Arsip KGB mengikuti jendela proses yang sama dengan
                    Input KGB. Bila berkas SK gagal terunggah, unggah dari Detail KGB dengan Unggah SK TTE.
                  </li>
                  <li>
                    <strong>Angka pada SK dicocokkan lebih dulu.</strong> Jendela Arsip KGB meminta{" "}
                    <strong>masa kerja golongan</strong> dan <strong>gaji pokok yang tertulis pada SK</strong>. Keduanya
                    tidak disimpan: yang tersimpan tetap hasil hitungan dari tabel PP 5/2024. Gunanya memastikan arsip
                    ini sama dengan SK-nya, dan selama keduanya berbeda tombol Simpan Arsip tidak aktif. Ketidakcocokan
                    hampir selalu berarti <strong>golongan atau masa kerja golongan pegawai di Data Pegawai belum sesuai
                    SK dasarnya</strong>; perbaiki data pegawainya lebih dulu, jangan memaksakan arsipnya, sebab angka
                    yang keliru akan terkunci menjadi dasar KGB berikutnya. KGB yang terlambat bertahun-tahun tidak perlu
                    perlakuan khusus: masa kerja golongan dihitung sebesar jarak nyata dari TMT terakhir, bukan dua tahun
                    tetap, sehingga hasilnya sudah sama dengan SK selama data dasarnya benar.
                  </li>
                  <li>
                    <strong>Detail dan riwayat.</strong> Di menu Proses KGB, tombol Detail membuka Detail KGB berisi data
                    pegawai, perhitungan, SK KGB Baru, tautan Lihat SK Tertandatangani, dan tombol aksi sesuai status.
                    Halaman pegawai sendiri punya lima tab: <strong>Data pegawai</strong> (kartu Identitas, Kepegawaian,
                    Dasar KGB, serta Status &amp; mutasi, masing-masing dengan tombol ubah dan catatnya),{" "}
                    <strong>Riwayat KGB</strong>, <strong>Pangkat &amp; PMK</strong>, <strong>Dokumen</strong>, dan{" "}
                    <strong>Riwayat Hukdis</strong>. Tab Dokumen adalah arsip dokumen pegawai, tempat SK yang dilampirkan
                    lewat panel Dokumen rujukan atau disalin dari kiriman inventarisasi tersimpan permanen; tab ini hanya
                    tampil bagi Super Admin dan Tim SDM KGB. Riwayat KGB menampilkan seluruh KGB pegawai. Di halaman riwayat pegawai, tombol Proses KGB membuka
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
                    <strong>Notifikasi menurut peran.</strong> Tim SDM KGB menerima pengingat batas proses, KGB
                    terlambat, permintaan tindak lanjut dari keuangan, hukuman disiplin yang segera berakhir, KGB yang
                    perlu ditinjau ulang, serta usulan data dan laporan mutasi dari UPT. Tim SDM Hukdis menerima laporan
                    hukuman disiplin dari UPT dan hukuman disiplin yang segera berakhir. Keuangan Kanwil menerima SK KGB
                    menunggu konfirmasi dan KGB yang perlu ditinjau ulang. Admin UPT menerima pengingat jatuh tempo dan
                    rapelan, SK terbit, serta usulan dan laporan yang dikembalikan, hanya untuk satkernya, dan tidak
                    dapat menandainya dibaca. Super Admin menerima semuanya. Tanda sudah dibaca pada satu notifikasi
                    berlaku untuk semua pengguna.
                  </li>
                </ul>
                <LanjutBagian dari="di-sim-kgb" />
              </Bagian>

              {/* Hukuman disiplin dari UPT (ADR-016) */}
              <Bagian id="hukdis" tampil={tampil}>
                <h2 id="hukdis" className="pub-h2">
                  Hukuman disiplin dari UPT
                </h2>
                <p>
                  UPT memegang SK hukuman disiplin pegawainya, tetapi yang mencatatnya dan menggeser jadwal KGB adalah
                  Tim SDM Hukdis Kanwil. Laporannya berjalan lewat modul <strong>Lapor Hukdis</strong>, terpisah dari
                  usulan data.
                </p>
                <p>
                  Pembagian wewenangnya tegas, dan nama menunya sengaja dibedakan supaya tidak tertukar. Hukuman
                  disiplin dijatuhkan dengan SK pejabat yang berwenang, di luar SIM-KGB. Di dalam SIM-KGB, hanya
                  Tim SDM Hukdis Kanwil yang dapat <em>mencatat</em> hukuman itu dan karenanya menunda KGB; menu Admin
                  UPT bernama <strong>Lapor Hukdis</strong> dan tidak pernah mengubah data pegawai maupun jadwal KGB.
                  Karena itu pula UPT tidak dapat menghapus hukuman yang sudah tercatat: yang salah dibetulkan Kanwil.
                </p>

                <h3 className="pub-h3">Di UPT: melaporkan</h3>
                <ol>
                  <li>
                    Buka menu <strong>Lapor Hukdis</strong>, lalu pilih <strong>Laporkan hukuman disiplin</strong>.
                  </li>
                  <li>
                    Pilih pegawai dan jenis hukuman sesuai SK, lalu isi nomor dan tanggal SK serta TMT mulai. TMT berakhir
                    terisi dari masa hukuman jenisnya; sesuaikan bila SK berkata lain.
                  </li>
                  <li>
                    Unggah pindaian SK hukuman disiplin (PDF, paling besar 500 KB, wajib), tambahkan keterangan bila perlu,
                    lalu <strong>Kirim laporan</strong>.
                  </li>
                </ol>
                <p>
                  Laporan belum mengubah data pegawai maupun jadwal KGB. Satu pegawai hanya boleh punya satu laporan yang
                  belum selesai. Selama masih Menunggu tinjauan, laporan dapat dibatalkan. Laporan yang Dikembalikan untuk
                  diperbaiki membawa catatan Kanwil; pilih <strong>Kirim ulang</strong>, betulkan isiannya, lalu kirim.
                </p>

                <h3 className="pub-h3">Di Kanwil: mencatat atau mengembalikan</h3>
                <ol>
                  <li>
                    Laporan baru memunculkan notifikasi bagi Tim SDM Hukdis dan Super Admin, dan tampil di panel{" "}
                    <strong>Laporan dari UPT</strong> pada menu Hukuman Disiplin.
                  </li>
                  <li>
                    Buka <strong>Pindaian SK</strong> dan cocokkan jenis, nomor, tanggal, dan masa berlakunya.
                  </li>
                  <li>
                    Pilih <strong>Catat</strong> untuk membuka formulir input hukuman disiplin yang sudah terisi dari
                    laporan. Dampak pada KGB, lama penundaan, dan dasar hukum mengikuti jenisnya dan masih dapat diubah.
                    TMT berakhir wajib diisi saat mencatat. Setelah disimpan, laporan berstatus Sudah dicatat Kanwil.
                  </li>
                  <li>
                    Pilih <strong>Kembalikan</strong> bila SK tidak cocok atau berkas kurang jelas. Catatan wajib diisi;
                    UPT menerimanya sebagai notifikasi.
                  </li>
                </ol>

                <h3 className="pub-h3">Dampaknya pada KGB</h3>
                <p>
                  Hukuman yang jenisnya menunda KGB menahan proses selama masih berlaku: Input KGB dan Arsip KGB pegawai
                  itu ditolak, dan jadwal KGB bergeser sesuai lama penundaan (lihat <a href="#jadwal">jadwal</a>).
                </p>
                <p>
                  UPT melihat hukuman yang sudah dicatat di bagian Tercatat di Kanwil secara terbatas: masih berlaku
                  atau tidak, menunda KGB atau tidak, dan berlaku sampai kapan. Jenis, nomor SK, keterangan, dan dasar
                  hukumnya hanya terlihat di Kanwil.
                </p>
                <LanjutBagian dari="hukdis" />
              </Bagian>

              {/* 7. Keuangan */}
              <Bagian id="keuangan" tampil={tampil}>
                <h2 id="keuangan" className="pub-h2">
                  Konfirmasi keuangan Kanwil
                </h2>
                <p>
                  Bagian ini untuk pengguna SIM-KGB dengan akses Keuangan Kanwil. KGB yang perlu dikonfirmasi berstatus{" "}
                  <Status status="menunggu_keuangan" />. Modul Keuangan hanya memuat pegawai Kanwil; SK pegawai UPT
                  dikonfirmasi dan direkam keuangan satkernya sendiri, dan hanya dipantau lewat panel SK UPT belum
                  direkam di dashboard.
                </p>
                <div className="pub-note">
                  <strong className="pub-note-title">Sebelum rekon gaji dikirim</strong>
                  <p>
                    Konfirmasi SK di SIM-KGB dan rekam perubahan gajinya di Gaji Web sebelum rekon gaji dikirim, yaitu
                    tanggal 1 sampai paling lambat tanggal 15 bulan sebelum TMT. Untuk TMT {tgl(TMT_KGB)}: rekon{" "}
                    {tgl(rekon.mulai)} sampai {tgl(rekon.batas)}. Bila rekon sudah dikirim lebih awal, SK yang masuk
                    sesudahnya dibayar sebagai kekurangan gaji. Kabari Tim SDM sebelum mengirim rekon.
                  </p>
                </div>
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
                <LanjutBagian dari="keuangan" />
              </Bagian>

              {/* 8. Pengiriman SK */}
              <Bagian id="pengiriman-sk" tampil={tampil}>
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
                  Bila pegawai pindah satker, UPT melaporkannya dengan Laporkan mutasi dan Kanwil menetapkannya sebelum
                  Buat SK: mutasi definitif memperbarui Unit Kerja, sedangkan BKO tidak mengubah Unit Kerja maupun KPPN
                  mitra. Bila kemitraan KPPN sebuah satker
                  berpindah, Super Admin mengubahnya di Pengaturan, bagian KPPN mitra satker; tabel ini dan tujuan SK
                  langsung mengikuti.
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
                <LanjutBagian dari="pengiriman-sk" />
              </Bagian>

              {/* 9. Contoh kasus */}
              <Bagian id="contoh-kasus" tampil={tampil}>
                <h2 id="contoh-kasus" className="pub-h2">
                  Contoh kasus: usulan Rumah Tahanan Negara Kelas IIB Rantau
                </h2>
                <p>
                  Rumah Tahanan Negara Kelas IIB Rantau mengusulkan KGB untuk lima pegawai dengan data yang sama: {PANGKAT}, jabatan
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
                        <td>Waktu yang disarankan untuk mengajukan usulan dan mengirim surat</td>
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
                        <td>Tanggal surat permohonan Rumah Tahanan Negara Kelas IIB Rantau</td>
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
                    Di SIM-KGB, Rumah Tahanan Negara Kelas IIB Rantau menyiapkan kelima pegawai sekaligus lewat Usulan
                    kolektif, lalu mengajukannya dengan nomor surat itu. Bila ada usulan perbaikan data, Tim SDM
                    meninjaunya lebih dulu; selama itu proses KGB pegawainya tertahan.
                  </li>
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
                    merekam SK KGB di aplikasi Gaji Web, lalu satker mengajukan SPM-LS kekurangan gaji ke KPPN. Karena
                    pegawainya pegawai UPT, keuangan satker itu sendiri yang memilih Rapelan saat menandai Sudah direkam
                    di Gaji Web, lewat akun Admin UPT.
                  </li>
                  <li>
                    Agar KGB berikutnya terbit sebelum TMT, Rumah Tahanan Negara Kelas IIB Rantau sebaiknya mengirim surat pada{" "}
                    {bulanTahun(bulanKirim(kasus.tmtKgbBerikutnya))}.
                  </li>
                </ul>
                <LanjutBagian dari="contoh-kasus" />
              </Bagian>

              {/* 10. Status */}
              <Bagian id="status" tampil={tampil}>
                <h2 id="status" className="pub-h2">
                  Arti status
                </h2>
                <p>
                  Status yang sama tampil di SIM-KGB dan di halaman <Link href="/kgb">Cek status</Link> publik, yang
                  dibuka pegawai dengan NIP dan tempat lahir. Pegawai tidak memerlukan akun. Halaman publik hanya
                  menampilkan status, tanggal, dan nama yang disamarkan, jadi pastikan tempat lahir pegawai tercatat
                  di data pegawai; tanpa itu pegawai tidak dapat mengecek statusnya.
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
                          gaji sejak TMT dibayarkan kemudian sebagai kekurangan gaji. Keuangan Kanwil menetapkannya saat
                          konfirmasi; keuangan satker saat menandai Sudah direkam di Gaji Web.
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">
                          <span className="pub-status pg-tanda">Tertahan usulan UPT</span>
                        </th>
                        <td>
                          Keterangan di dashboard Kanwil, bukan status. UPT mengusulkan perbaikan data pegawai ini, dan
                          Input KGB, Buat SK, serta Unggah SK TTE menunggu usulan itu ditinjau. Status KGB tidak berubah
                          sampai usulannya disetujui atau dikembalikan.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <LanjutBagian dari="status" />
              </Bagian>

              {/* 11. Pertanyaan */}
              <Bagian id="pertanyaan" tampil={tampil}>
                <h2 id="pertanyaan" className="pub-h2">
                  Pertanyaan umum
                </h2>
                <div className="pub-faq">
                  <details name="faq-panduan">
                    <summary>Apakah surat permohonan masih wajib walaupun data sudah ada di SIM-KGB?</summary>
                    <p>
                      Ya. Usulan di SIM-KGB adalah data, bukan naskah dinas. Surat permohonan Kepala UPT lewat Srikandi
                      menjadi dasar agenda dan disposisi Kepala Kanwil, dan disposisi itulah yang menjadi perintah bagi
                      Tim SDM untuk menerbitkan SK.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Bolehkah Kepala UPT menandatangani SK KGB?</summary>
                    <p>
                      Tidak. Kepala UPT menandatangani surat permohonan. Kewenangan KGB pegawai Kanwil dan UPT dilimpahkan
                      kepada Kepala Kantor Wilayah, sehingga SK KGB ditandatangani Kepala Kanwil atau pejabat pengganti
                      sesuai <a href="#kewenangan">tabel penandatangan</a>.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Mengapa KGB pertama golongan II/a diberikan setelah 1 tahun?</summary>
                    <p>
                      PNS yang pertama kali diangkat dalam golongan II/a menerima KGB pertama setelah mempunyai masa kerja 1
                      tahun, lalu setiap 2 tahun berikutnya. Tabel gaji PP 5/2024 mengikuti pola ini: gaji pokok golongan
                      II/a naik dari {rp(GAJI_MKG_0)} (MKG 0 tahun) menjadi {rp(GAJI_MKG_1)} (MKG 1 tahun), lalu{" "}
                      {rp(GAJI_MKG_3)} (MKG 3 tahun). Golongan III berubah pada MKG genap, sehingga KGB pertamanya pada MKG
                      2 tahun.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>NIP pegawai tidak ditemukan di SIM-KGB</summary>
                    <p>
                      Pegawai UPT yang belum tercatat ditambahkan Admin UPT dengan Tambah pegawai atau Unggah daftar, lalu
                      diajukan ke Kanwil. NIP yang tercatat keliru dibetulkan lewat Usulkan perbaikan data; Kanwil
                      mencocokkannya dengan SK CPNS sebelum menyetujui.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Status KGB pegawai tidak berubah dalam waktu lama</summary>
                    <p>
                      Belum Diproses biasanya berarti usulan belum diajukan atau jendela proses belum dibuka. Bila di
                      dashboard Kanwil barisnya bertanda Tertahan usulan UPT, usulan perbaikan data pegawai itu belum
                      ditinjau. Sedang Diproses berarti SK sedang disiapkan atau menunggu tanda tangan elektronik.
                      Menunggu Keuangan berarti SK sudah diunggah dan menunggu direkam: oleh keuangan Kanwil untuk pegawai
                      Kanwil, atau oleh keuangan satker lewat Sudah direkam di Gaji Web untuk pegawai UPT.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Usulan terlambat dikirim. Apakah KGB hilang?</summary>
                    <p>
                      Tidak. KGB tetap diproses dan TMT tidak bergeser. Jika SK KGB terbit setelah TMT, selisih gaji sejak
                      TMT dibayarkan sebagai kekurangan gaji: operator gaji satker merekam SK KGB di aplikasi Gaji Web, lalu
                      satker mengajukan SPM-LS kekurangan gaji ke KPPN.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Mengapa tombol Buat SK atau Unggah SK TTE tidak muncul?</summary>
                    <p>
                      Buat SK baru tersedia setelah Input KGB disimpan dan status menjadi Sedang Diproses. Unggah SK TTE
                      baru muncul setelah SK dibuat dengan Buat SK. KGB yang jendela prosesnya belum dibuka tidak tampil di
                      Dashboard dan bertuliskan Terkunci di menu Proses KGB, disertai tanggal jendela proses dibuka. Baris
                      bertanda Tertahan usulan UPT hanya menampilkan Tinjau usulan UPT sampai usulannya ditinjau.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Bisakah tanda Berpotensi rapelan diubah secara manual?</summary>
                    <p>
                      Tidak. Tanda itu dihitung otomatis: KGB yang diinput setelah batas proses Tim SDM ditandai Berpotensi
                      rapelan. Keputusan rapelan diambil keuangan Kanwil saat konfirmasi, atau keuangan satker saat menandai
                      Sudah direkam di Gaji Web, dengan memilih Rapelan atau Tidak Rapelan.
                    </p>
                    <p>
                      Pengecualiannya hanya untuk KGB historis berstatus Selesai yang masih membawa penanda rapelan
                      padahal SK-nya terbit tepat waktu. Penanda itu hanya dapat dihapus Super Admin dengan Koreksi sebagai
                      Arsip Historis, disertai alasan yang dicatat di Log Aktivitas (lihat{" "}
                      <a href="#keadaan-khusus">keadaan khusus</a>).
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Pegawai pindah satker atau berhenti sebelum SK terbit</summary>
                    <p>
                      Admin UPT satker asal memilih Laporkan mutasi pada baris pegawai: mutasi definitif, BKO, selesai
                      BKO, atau pemberhentian, beserta TMT dan nomor SK-nya. Tim SDM Kanwil menetapkannya sebelum Buat SK,
                      lewat kartu Status &amp; mutasi pada tab Data pegawai; SK mutasi atau SK pemberhentiannya dapat
                      dilampirkan di panel Dokumen rujukan dan langsung masuk arsip pegawai. Mutasi definitif memperbarui
                      Unit Kerja, sehingga SK ditujukan ke KPPN mitra satker baru; BKO tidak mengubah Unit Kerja maupun
                      KPPN. Karena itu tanggung jawab KGB pegawai BKO tetap pada satker asal, dan penugasannya hanya
                      menjadi keterangan tambahan pada barisnya, di daftar pegawai Admin UPT maupun di Data Pegawai
                      Kanwil. Selesainya dicatat dengan <em>Selesai BKO, kembali ke satker asal</em>.
                    </p>
                  </details>
                  <details name="faq-panduan">
                    <summary>Lupa password SIM-KGB</summary>
                    <p>
                      Akun SIM-KGB hanya untuk pengelola: Tim SDM KGB, Tim SDM Hukdis, Keuangan Kanwil, Admin UPT, dan
                      Super Admin. Pegawai tidak memerlukan akun untuk melihat status KGB. Pengelola yang lupa password dapat memakai tautan Lupa
                      password di halaman <Link href="/login">Masuk</Link> untuk menghubungi admin SIM-KGB.
                    </p>
                    <p>
                      Setelah password direset admin atau diganti sendiri melalui Profil Saya, sesi yang masih terbuka
                      berakhir. Masuk kembali dengan password baru. Setelah beberapa kali gagal masuk, halaman Masuk
                      menampilkan pesan terlalu banyak percobaan; tunggu 15 menit sebelum mencoba lagi.
                    </p>
                  </details>
                </div>
                <LanjutBagian dari="pertanyaan" />
              </Bagian>

              {/* 12. Dasar hukum */}
              <Bagian id="dasar-hukum" tampil={tampil}>
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
                    <a href="https://peraturan.bpk.go.id/Details/5573/pp-no-11-tahun-2017">
                      Peraturan Pemerintah Nomor 11 Tahun 2017 tentang Manajemen Pegawai Negeri Sipil
                    </a>{" "}
                    sebagaimana diubah dengan{" "}
                    <a href="https://peraturan.bpk.go.id/Details/135658/pp-no-17-tahun-2020">
                      Peraturan Pemerintah Nomor 17 Tahun 2020
                    </a>
                    . Dipakai untuk masa percobaan calon PNS, pengangkatan menjadi PNS, dan ketentuan kenaikan pangkat.
                  </li>
                  <li>
                    <a href="https://www.bkn.go.id/unggahan/2022/07/Surat-Edaran-Kepala-BKN-Nomor-10-Tahun-2022.pdf">
                      Surat Edaran Kepala Badan Kepegawaian Negara Nomor 10 Tahun 2022
                    </a>{" "}
                    tentang tata cara pengangkatan calon PNS menjadi PNS yang melewati satu tahun masa percobaan:
                    usul instansi, rekomendasi BKN, lalu keputusan pejabat pembina kepegawaian, dengan TMT mengikuti
                    keputusan dan tidak berlaku surut.
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
                  <li>
                    <a href="https://djpb.kemenkeu.go.id/kppn/merauke/id/data-publikasi/artikel/3022-ketentuan-penyampaian-spm-gaji-induk.html">
                      Ketentuan Penyampaian SPM Gaji Induk
                    </a>
                    , KPPN Merauke, Direktorat Jenderal Perbendaharaan: SPM gaji induk paling lambat tanggal 15 sebelum
                    bulan pembayaran dan rekon data gaji berakhir tanggal 15 bulan pengajuan (PMK Nomor 62 Tahun 2023
                    Pasal 225).
                  </li>
                </ul>
                <p className="pub-meta">
                  Ketentuan penundaan KGB karena hukuman disiplin berlaku sampai peraturan pemerintah mengenai gaji dan
                  tunjangan PNS mulai berlaku. Bila peraturan itu terbit, bagian terkait panduan ini perlu disesuaikan.
                </p>
                <LanjutBagian dari="dasar-hukum" />
              </Bagian>
          </div>
        </div>
      </PanduanPeran>
    </div>
  );
}
