import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import type { JenisPenandatangan } from "./penandatangan";
import { formatTanggalId, type NilaiTanggal } from "./waktu";
import { dataUrlAsetPublik } from "./asetPublik";

// Nonaktifkan hyphenation otomatis, cegah pemisahan kata seperti "Kali-mantan"
Font.registerHyphenationCallback((word) => [word]);

/** Logo dan label Srikandi sebagai data URL, disiapkan oleh siapkanAsetSurat(). */
export interface AsetSurat {
  logoSrc: string;
  labelSrikandiSrc: string | null;
}

let fontTerdaftar: Promise<void> | null = null;

// Font didaftarkan sebagai data URL, bukan path disk, karena Cloudflare Workers tidak punya
// filesystem. Cukup sekali per isolate; @react-pdf menyimpan hasil parsing font di memori.
function daftarkanFont(): Promise<void> {
  fontTerdaftar ??= Promise.all([
    dataUrlAsetPublik("fonts/arial.ttf", "font/ttf"),
    dataUrlAsetPublik("fonts/arialbd.ttf", "font/ttf"),
    dataUrlAsetPublik("fonts/ariali.ttf", "font/ttf"),
  ]).then(([biasa, tebal, miring]) => {
    Font.register({
      family: "Arial",
      fonts: [
        { src: biasa },
        { src: tebal, fontWeight: "bold" },
        { src: miring, fontStyle: "italic" },
      ],
    });
  });
  // Gagal memuat font tidak di-cache, agar permintaan berikutnya mencoba lagi.
  fontTerdaftar.catch(() => {
    fontTerdaftar = null;
  });
  return fontTerdaftar;
}

/** Wajib dipanggil sebelum merender SuratKGBDocument: mendaftarkan font dan memuat gambar. */
export async function siapkanAsetSurat(srikandi: boolean): Promise<AsetSurat> {
  const [, logoSrc, labelSrikandiSrc] = await Promise.all([
    daftarkanFont(),
    dataUrlAsetPublik("logo-imipas.png", "image/png"),
    srikandi ? dataUrlAsetPublik("label-srikandi.png", "image/png") : Promise.resolve(null),
  ]);
  return { logoSrc, labelSrikandiSrc };
}

// Ukuran dalam pt, diambil dari template Word "Template KGB.docx": Arial 10,5 pt berspasi 1,15,
// margin kiri 62 pt. Kop surat diletakkan mutlak terhadap halaman, seperti gambar dan garis di template.
const BARIS = 13.87;
const KIRI = 62;
const TITIK_DUA = 218.1 - KIRI;
const NILAI = 232.2 - KIRI;
const KOLOM_TTD = 366.9 - KIRI;
const SELA = 9.3;

const S = StyleSheet.create({
  page: {
    fontFamily: "Arial",
    fontSize: 10.5,
    lineHeight: BARIS / 10.5,
    paddingTop: 116,
    paddingBottom: 14,
    paddingLeft: KIRI,
    paddingRight: 61,
  },
  logo: { position: "absolute", left: 67.1, top: 32.7, width: 64.8, height: 64.8 },
  // Baris kop tidak tepat segaris tengah di template; geseran `left` meniru letaknya.
  kop: { position: "absolute", left: KIRI + 50, right: 61, top: 32.4, alignItems: "center" },
  kopBiasa: { fontSize: 10, lineHeight: 1.32 },
  kopTebal: { fontSize: 11, fontWeight: "bold", lineHeight: 1.2 },
  kopL1: { left: 2 },
  kopL2: { left: 0.6, marginTop: 3.7 },
  kopL3: { left: 12.9 },
  kopL45: { left: -7.1 },
  kopSurel: { fontStyle: "italic", color: "#0563C1" },
  garisKop: {
    position: "absolute",
    left: 58.3,
    top: 108.1,
    width: 478.25,
    borderTopWidth: 0.63,
    borderTopColor: "#000",
  },
  row: { flexDirection: "row" },
  kepalaLabel: { width: 118.7 - KIRI },
  kepalaTitikDua: { width: 132.9 - 118.7 },
  isi: { flex: 1 },
  label: { width: TITIK_DUA },
  titikDua: { width: NILAI - TITIK_DUA },
  huruf: { width: 21.3 },
  labelHuruf: { width: TITIK_DUA - 21.3 },
  tanggal: { position: "absolute", right: 0, top: 0 },
  p: { textAlign: "justify" },
  tebal: { fontWeight: "bold" },
  ttd: { marginTop: BARIS + 0.2 },
  ttdKolom: { marginLeft: KOLOM_TTD },
  // Ruang antara jabatan dan nama: tempat label Srikandi, atau tanda tangan basah pada surat reguler.
  ruangTtd: { height: 55.5, justifyContent: "center" },
  labelSrikandi: { width: 150, height: 41.3, objectFit: "contain" },
  ttdPengirim: { position: "absolute", left: 133 - KIRI, top: 644.3 - 602.7 },
  tembusan: { marginTop: 2 * BARIS },
  tembusanJudul: { fontSize: 9.5, lineHeight: 12.5 / 9.5 },
  tembusanItem: { flexDirection: "row", fontSize: 9, lineHeight: 11.9 / 9 },
  tembusanNo: { width: 14.2 },
});

// Tanggal di surat dibaca menurut WITA, bukan zona server (Cloudflare Workers berjalan dalam UTC).
// Hari selalu dua angka, "07 Maret 2024", mengikuti template.
function tgl(date: NilaiTanggal): string {
  return formatTanggalId(date, { day: "2-digit", month: "long", year: "numeric" });
}

function rp(n: number): string {
  return `Rp. ${n.toLocaleString("id-ID")},-`;
}

function masaKerja(tahun: number, bulan: number): string {
  return `${tahun} Tahun ${String(bulan).padStart(2, "0")} Bulan`;
}

interface SuratKGBProps {
  nomorSurat: string;
  tanggalSurat: NilaiTanggal;
  /**
   * KPPN mitra satker pegawai (lib/satker.ts), dicetak pada tujuan surat. Unit kerja kosong berarti
   * Kanwil; route PDF menolak unit kerja di luar daftar satker, jadi nilai ini selalu KPPN yang dikenal.
   */
  kppn: string;
  /** Satker pegawai menurut daftar satker: namanya dicetak sebagai tempat bertugas dan pada tembusan. */
  satker: { nama: string; kanwil: boolean };
  pegawai: {
    nama: string;
    nip: string;
    pangkat: string;
    golonganRuang: string;
  };
  kgb: {
    gajiPokokLama: number;
    nomorSK: string;
    tanggalSK: NilaiTanggal;
    tmtSK: NilaiTanggal;
    /** Pejabat penetap SK dasar, dicetak pada baris "Oleh Pejabat". */
    penetapSkDasar: string;
    mkgTahunLama: number;
    mkgBulanLama: number;
    gajiPokokBaru: number;
    mkgTahunBaru: number;
    mkgBulanBaru: number;
    /** "Penata (III/c)": nama pangkat beserta golongan barunya. */
    pangkatGolonganBaru: string;
    tmtKgbBaru: NilaiTanggal;
    tmtKgbBerikutnya: NilaiTanggal;
  };
  /** Hasil tentukanPenandatangan(); jabatan sudah berawalan Plh./Plt. bila perlu. */
  penandatangan: {
    jenis: JenisPenandatangan;
    jabatan: string;
    nama: string;
  };
  /** Nomor peraturan gaji yang dirujuk, mis. "Nomor 5 Tahun 2024". */
  dasarHukum: string;
  /** Render versi Srikandi: placeholder ${ttd_pengirim} + label Srikandi di area TTD */
  srikandi?: boolean;
  /** Hasil siapkanAsetSurat() dengan nilai srikandi yang sama. */
  aset: AsetSurat;
}

function Baris({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <View style={S.row}>
      <Text style={S.label}>{label}</Text>
      <Text style={S.titikDua}>:</Text>
      <Text style={tebal ? [S.isi, S.tebal] : S.isi}>{nilai}</Text>
    </View>
  );
}

function BarisHuruf({ huruf, label, nilai }: { huruf: string; label: string; nilai: string }) {
  return (
    <View style={S.row}>
      <Text style={S.huruf}>{huruf}.</Text>
      <Text style={S.labelHuruf}>{label}</Text>
      <Text style={S.titikDua}>:</Text>
      <Text style={S.isi}>{nilai}</Text>
    </View>
  );
}

export function SuratKGBDocument({
  nomorSurat,
  tanggalSurat,
  kppn,
  satker,
  pegawai,
  kgb,
  penandatangan,
  dasarHukum,
  srikandi = false,
  aset,
}: SuratKGBProps) {
  const { logoSrc, labelSrikandiSrc } = aset;
  // KGB milik pimpinan Kanwil ditandatangani Dirjen, sehingga suratnya berkop Direktorat Jenderal.
  const kopDitjen = penandatangan.jenis === "dirjen";
  // Pegawai Kanwil tidak ditembuskan ke Kepala Kanwil, karena Kepala Kanwil sendiri penandatangannya.
  const tembusan = [
    "Sekretaris Jenderal Kementerian Imigrasi dan Pemasyarakatan;",
    "Kepala Kantor Wilayah Regional VIII Badan Kepegawaian Negara Banjarmasin;",
    ...(satker.kanwil ? [] : [`Kepala ${satker.nama};`]),
    `Pejabat Pembuat Daftar Gaji ${satker.nama};`,
    "Pegawai yang bersangkutan.",
  ];

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* KOP SURAT */}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image @react-pdf/renderer (PDF), bukan elemen DOM; prop alt tidak ada di tipenya */}
        <Image style={S.logo} src={logoSrc} />
        <View style={S.kop}>
          <Text style={[S.kopBiasa, S.kopL1]}>
            KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA
          </Text>
          {kopDitjen ? (
            <Text style={[S.kopTebal, S.kopL2]}>DIREKTORAT JENDERAL PEMASYARAKATAN</Text>
          ) : (
            <>
              <Text style={[S.kopBiasa, S.kopL2]}>DIREKTORAT JENDERAL PEMASYARAKATAN</Text>
              <Text style={[S.kopTebal, S.kopL3]}>KANTOR WILAYAH KALIMANTAN SELATAN</Text>
              <Text style={[S.kopBiasa, S.kopL45]}>
                Jalan Jendral A. Yani Km. 5,5 No. 24, Banjarmasin, Kalimantan Selatan
              </Text>
              <Text style={[S.kopBiasa, S.kopL45]}>
                Telepon 085252502005, Pos-el :{" "}
                <Text style={S.kopSurel}>kanwilditjenpaskalsel@gmail.com</Text>
              </Text>
            </>
          )}
        </View>
        <View style={S.garisKop} />

        {/* NOMOR, SIFAT, LAMPIRAN, HAL + TANGGAL */}
        <View style={{ position: "relative" }}>
          {[
            ["Nomor", nomorSurat],
            ["Sifat", "Segera"],
            ["Lampiran", "-"],
            ["Hal", "Kenaikan Gaji Berkala"],
          ].map(([label, nilai]) => (
            <View key={label} style={S.row}>
              <Text style={S.kepalaLabel}>{label}</Text>
              <Text style={S.kepalaTitikDua}>:</Text>
              <Text style={S.isi}>{nilai}</Text>
            </View>
          ))}
          <View style={S.row}>
            <Text style={{ width: 132.9 - KIRI }} />
            <Text style={S.isi}>
              a.n. <Text style={S.tebal}>{pegawai.nama}</Text>
            </Text>
          </View>
          <Text style={S.tanggal}>{tgl(tanggalSurat)}</Text>
        </View>

        {/* TUJUAN */}
        <View style={{ marginTop: SELA }}>
          <Text>Yth. Kepala Kantor Pelayanan Perbendaharaan Negara {kppn}</Text>
          <Text>di tempat</Text>
        </View>

        {/* PEMBUKA */}
        <Text style={[S.p, { marginTop: 7.9, textIndent: 28.35 }]}>
          Dengan ini diberitahukan bahwa, sesungguhnya dengan telah terpenuhinya masa kerja dan
          syarat – syarat lainnya atas nama:
        </Text>

        {/* DATA PEGAWAI */}
        <View style={{ marginTop: 6.6 }}>
          <Baris label="Nama" nilai={pegawai.nama} tebal />
          <Baris label="NIP" nilai={pegawai.nip} />
          <Baris label="Pangkat/Golongan" nilai={`${pegawai.pangkat} (${pegawai.golonganRuang})`} />
          <Baris label="Kantor/Tempat bertugas" nilai={satker.nama} />
          <Baris label="Gaji Pokok Lama" nilai={rp(kgb.gajiPokokLama)} />
        </View>

        {/* DASAR SK */}
        <Text style={[S.p, { marginTop: SELA }]}>
          dan atas dasar Surat Keterangan Pembayaran (SKP) terakhir tentang Gaji/Pangkat yang
          ditetapkan:
        </Text>
        <View style={{ marginTop: SELA }}>
          <BarisHuruf huruf="a" label="Oleh Pejabat" nilai={kgb.penetapSkDasar} />
          <BarisHuruf huruf="b" label="Tanggal" nilai={tgl(kgb.tanggalSK)} />
          <BarisHuruf huruf="c" label="Nomor" nilai={kgb.nomorSK} />
          <BarisHuruf huruf="d" label="Tanggal Mulai Berlakunya" nilai={tgl(kgb.tmtSK)} />
          <BarisHuruf
            huruf="e"
            label="Masa kerja golongan pada tanggal tersebut"
            nilai={masaKerja(kgb.mkgTahunLama, kgb.mkgBulanLama)}
          />
        </View>

        {/* HASIL KGB */}
        <Text style={[S.p, { marginTop: SELA }]}>
          maka kepada yang bersangkutan dapat diberikan{" "}
          <Text style={S.tebal}>kenaikan gaji berkala</Text> hingga memperoleh :
        </Text>
        <View style={{ marginTop: SELA }}>
          <Baris label="Gaji Pokok Baru" nilai={rp(kgb.gajiPokokBaru)} />
          <Baris label="Berdasarkan Masa Kerja" nilai={masaKerja(kgb.mkgTahunBaru, kgb.mkgBulanBaru)} />
          <Baris label="Dalam Pangkat/Golongan" nilai={kgb.pangkatGolonganBaru} />
          <Baris label="Mulai Tanggal" nilai={tgl(kgb.tmtKgbBaru)} />
          <Baris label="Kenaikan yang akan datang" nilai={tgl(kgb.tmtKgbBerikutnya)} />
        </View>

        {/* DASAR HUKUM */}
        <Text style={[S.p, { marginTop: SELA }]}>
          sesuai dengan Peraturan Pemerintah {dasarHukum} kepada Pegawai tersebut dapat dibayarkan
          penghasilannya berdasarkan gaji pokok baru.
        </Text>

        {/* TTD: delegasi, jadi ditandatangani atas nama jabatan sendiri (tanpa a.n. Menteri).
            Nama tanpa NIP pada kedua versi, mengikuti template. */}
        <View style={S.ttd}>
          {srikandi && <Text style={S.ttdPengirim}>{"${ttd_pengirim}"}</Text>}
          <View style={S.ttdKolom}>
            <Text>{penandatangan.jabatan},</Text>
            <View style={S.ruangTtd}>
              {srikandi && labelSrikandiSrc && (
                // eslint-disable-next-line jsx-a11y/alt-text -- Image @react-pdf/renderer (PDF), bukan elemen DOM; prop alt tidak ada di tipenya
                <Image style={S.labelSrikandi} src={labelSrikandiSrc} />
              )}
            </View>
            <Text>{penandatangan.nama}</Text>
          </View>
        </View>

        {/* TEMBUSAN */}
        <View style={S.tembusan}>
          <Text style={S.tembusanJudul}>Tembusan :</Text>
          {tembusan.map((isi, i) => (
            <View key={isi} style={S.tembusanItem}>
              <Text style={S.tembusanNo}>{i + 1}.</Text>
              <Text style={S.isi}>{isi}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
