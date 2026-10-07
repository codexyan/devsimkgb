import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  pdf,
} from "@react-pdf/renderer";
import type { JenisPenandatangan } from "./penandatangan";
import { mkgPadaSkDasar } from "./prosesKgb";
import { formatTanggalId, type NilaiTanggal } from "./waktu";
import {
  TEMPLATE_BAWAAN,
  isiPenanda,
  mmKePt,
  potongSurel,
  potongTebal,
  type BarisKop,
  type IsiTemplateSurat,
  type NilaiPenanda,
} from "./templateSurat";

// Surat KGB disusun di peramban, bukan di Worker: satu PDF memakan ±1 detik CPU, jauh di atas batas
// CPU per permintaan Cloudflare Workers Free. Server hanya memeriksa dan mengirim datanya lewat
// POST /api/kgb/[id]/pdf; modul ini dimuat dinamis oleh lib/kgbAksi.ts saat PDF diminta.

// Nonaktifkan hyphenation otomatis, cegah pemisahan kata seperti "Kali-mantan"
Font.registerHyphenationCallback((word) => [word]);

/** Logo dan label Srikandi: URL (peramban) atau path berkas (skrip Node). */
export interface AsetSurat {
  /** Logo bawaan (Kementerian); logo unggahan template dimuat dari logoUnggahan. */
  logoSrc: string;
  labelSrikandiSrc: string | null;
  /** Alamat logo unggahan dari kuncinya di R2; tanpa ini logo unggahan diganti logo bawaan. */
  logoUnggahan?: (kunci: string) => string;
}

let fontTerdaftar = false;

/**
 * Daftarkan Arial sekali per halaman. `akar` adalah asal situs di peramban, atau folder public/
 * saat dirender dari skrip Node; @react-pdf memuat berkasnya sendiri saat PDF pertama disusun.
 */
export function daftarkanFontSurat(akar: string): void {
  if (fontTerdaftar) return;
  Font.register({
    family: "Arial",
    fonts: [
      { src: `${akar}/fonts/arial.ttf` },
      { src: `${akar}/fonts/arialbd.ttf`, fontWeight: "bold" },
      { src: `${akar}/fonts/ariali.ttf`, fontStyle: "italic" },
    ],
  });
  fontTerdaftar = true;
}

/**
 * PDF surat KGB dari data yang dikirim server. Hanya dipanggil di peramban. `draf` berisi teks tanda air untuk SK yang
 * belum boleh ditandatangani, mis. SK pegawai UPT yang belum disetujui Admin UPT (ADR-077).
 */
export async function buatPdfSuratKgb(data: DataSuratKGB, srikandi: boolean, opsi: { draf?: string | null } = {}): Promise<Blob> {
  const akar = window.location.origin;
  daftarkanFontSurat(akar);
  const aset: AsetSurat = {
    logoSrc: `${akar}/logo-imipas.png`,
    labelSrikandiSrc: srikandi ? `${akar}/label-srikandi.png` : null,
    logoUnggahan: (kunci) => `${akar}/api/template-surat/logo?key=${encodeURIComponent(kunci)}`,
  };
  return pdf(<SuratKGBDocument {...data} srikandi={srikandi} aset={aset} draf={opsi.draf ?? null} />).toBlob();
}

// Ukuran halaman, margin, kop, dan huruf berasal dari template berversi (lib/templateSurat.ts, ADR-019).
// Yang tetap di sini adalah letak kolom isian, diukur dari margin kiri dalam pt seperti di template Word
// "Template KGB.docx" (margin kiri 62 pt: titik dua pada 218,1 pt, nilai pada 232,2 pt, blok tanda tangan
// pada 366,9 pt).
const KIRI_WORD = 62;
const TITIK_DUA = 218.1 - KIRI_WORD;
const NILAI = 232.2 - KIRI_WORD;
const KOLOM_TTD = 366.9 - KIRI_WORD;
const SELA = 9.3;

const S = StyleSheet.create({
  kopSurel: { fontStyle: "italic", color: "#0563C1" },
  row: { flexDirection: "row" },
  kepalaLabel: { width: 118.7 - KIRI_WORD },
  kepalaTitikDua: { width: 132.9 - 118.7 },
  isi: { flex: 1 },
  label: { width: TITIK_DUA },
  titikDua: { width: NILAI - TITIK_DUA },
  huruf: { width: 21.3 },
  labelHuruf: { width: TITIK_DUA - 21.3 },
  tanggal: { position: "absolute", right: 0, top: 0 },
  p: { textAlign: "justify" },
  tebal: { fontWeight: "bold" },
  ttdKolom: { marginLeft: KOLOM_TTD },
  // Ruang antara jabatan dan nama: tempat label Srikandi, atau tanda tangan basah pada surat reguler.
  ruangTtd: { height: 55.5, justifyContent: "center" },
  labelSrikandi: { width: 150, height: 41.3, objectFit: "contain" },
  ttdPengirim: { position: "absolute", left: 133 - KIRI_WORD, top: 644.3 - 602.7 },
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

/** Isi surat yang disusun server (POST /api/kgb/[id]/pdf); tanggal tiba sebagai string ISO. */
export interface DataSuratKGB {
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
  /**
   * Template yang berlaku pada tanggal surat (lib/templateSurat.ts pilihVersi, dipilih server). Kosong pada
   * data dari versi aplikasi sebelum ADR-019: templat bawaan yang dipakai.
   */
  template?: IsiTemplateSurat;
}

/** Nilai isian otomatis {…} template untuk satu surat. */
export function nilaiPenandaSurat(d: DataSuratKGB): NilaiPenanda {
  return {
    nama: d.pegawai.nama,
    nip: d.pegawai.nip,
    pangkat_golongan: `${d.pegawai.pangkat} (${d.pegawai.golonganRuang})`,
    satker: d.satker.nama,
    kppn: d.kppn,
    gaji_lama: rp(d.kgb.gajiPokokLama),
    gaji_baru: rp(d.kgb.gajiPokokBaru),
    mkg_lama: masaKerja(d.kgb.mkgTahunLama, d.kgb.mkgBulanLama),
    mkg_baru: masaKerja(d.kgb.mkgTahunBaru, d.kgb.mkgBulanBaru),
    pangkat_golongan_baru: d.kgb.pangkatGolonganBaru,
    tmt_kgb: tgl(d.kgb.tmtKgbBaru),
    tmt_berikutnya: tgl(d.kgb.tmtKgbBerikutnya),
    penetap_sk_dasar: d.kgb.penetapSkDasar,
    nomor_sk_dasar: d.kgb.nomorSK,
    tanggal_sk_dasar: tgl(d.kgb.tanggalSK),
    dasar_hukum: d.dasarHukum,
    nomor_surat: d.nomorSurat,
    tanggal_surat: tgl(d.tanggalSurat),
    jabatan_penandatangan: d.penandatangan.jabatan,
    nama_penandatangan: d.penandatangan.nama,
  };
}

/** Teks template dengan isian terisi dan potongan **tebal** dicetak tebal. */
function TeksTemplate({ teks, nilai }: { teks: string; nilai: NilaiPenanda }) {
  return (
    <>
      {potongTebal(isiPenanda(teks, nilai)).map((p, i) =>
        p.tebal ? (
          <Text key={i} style={S.tebal}>
            {p.teks}
          </Text>
        ) : (
          p.teks
        ),
      )}
    </>
  );
}

/** Satu baris kop. Geseran mendatar meniru letak baris di template Word yang tidak persis segaris tengah. */
function BarisKopSurat({ baris, nilai }: { baris: BarisKop; nilai: NilaiPenanda }) {
  return (
    <Text
      style={{
        fontSize: baris.ukuranPt,
        fontWeight: baris.tebal ? "bold" : "normal",
        lineHeight: baris.tebal ? 1.2 : 1.32,
        left: baris.geserPt,
        marginTop: baris.jarakAtasPt,
      }}
    >
      {potongSurel(isiPenanda(baris.teks, nilai)).map((p, i) =>
        p.surel ? (
          <Text key={i} style={S.kopSurel}>
            {p.teks}
          </Text>
        ) : (
          p.teks
        ),
      )}
    </Text>
  );
}

interface SuratKGBProps extends DataSuratKGB {
  /** Render versi Srikandi: placeholder ${ttd_pengirim} + label Srikandi di area TTD */
  srikandi?: boolean;
  /** Logo dan label Srikandi; label hanya dipakai pada versi Srikandi. */
  aset: AsetSurat;
  /** Teks tanda air DRAF; kosong untuk SK yang boleh dicetak dan ditandatangani (ADR-077). */
  draf?: string | null;
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

export function SuratKGBDocument(props: SuratKGBProps) {
  const { nomorSurat, satker, pegawai, kgb, penandatangan, srikandi = false, aset } = props;
  // MKG pada TMT SK dasar: berbeda dari MKG lama bila SK dasarnya SK kenaikan pangkat atau PMK (ADR-020, ADR-021).
  const mkgDasar = mkgPadaSkDasar(kgb);
  const t = props.template ?? TEMPLATE_BAWAAN;
  const nilai = nilaiPenandaSurat(props);

  const lebar = mmKePt(t.kertas.lebarMm);
  const kiri = mmKePt(t.margin.kiriMm);
  const kanan = mmKePt(t.margin.kananMm);
  const baris = t.huruf.ukuranPt * t.huruf.spasi;
  // Garis kop sedikit melewati margin, seperti di template Word: 3,7 pt ke kiri dan 2,27 pt ke kanan.
  const garisKiri = kiri - 3.7;
  const garisLebar = lebar - kanan + 2.27 - garisKiri;

  // KGB milik pimpinan Kanwil ditandatangani Dirjen, sehingga suratnya berkop Direktorat Jenderal.
  // Satu kop untuk semua surat; varian kop Direktorat Jenderal ditiadakan (ADR-019).
  const barisKop = t.kop.baris;
  const logo =
    t.kop.logo === "tanpa"
      ? null
      : t.kop.logo === "bawaan" || !aset.logoUnggahan
        ? aset.logoSrc
        : aset.logoUnggahan(t.kop.logo);
  // Pegawai Kanwil tidak ditembuskan ke Kepala Kanwil, karena Kepala Kanwil sendiri penandatangannya.
  const tembusan = t.tembusan.filter((b) => !(satker.kanwil && b.kecualiKanwil)).map((b) => isiPenanda(b.teks, nilai));
  const { labelSrikandiSrc } = aset;

  return (
    <Document>
      <Page
        size={[lebar, mmKePt(t.kertas.tinggiMm)]}
        style={{
          fontFamily: "Arial",
          fontSize: t.huruf.ukuranPt,
          lineHeight: t.huruf.spasi,
          paddingTop: mmKePt(t.margin.atasMm),
          paddingBottom: mmKePt(t.margin.bawahMm),
          paddingLeft: kiri,
          paddingRight: kanan,
        }}
      >
        {/* KOP SURAT: diletakkan mutlak terhadap halaman, seperti gambar dan garis di template Word. */}
        {logo && (
          // eslint-disable-next-line jsx-a11y/alt-text -- Image @react-pdf/renderer (PDF), bukan elemen DOM; prop alt tidak ada di tipenya
          <Image
            style={{
              position: "absolute",
              left: mmKePt(t.kop.logoKiriMm),
              top: mmKePt(t.kop.logoAtasMm),
              width: mmKePt(t.kop.logoUkuranMm),
              height: mmKePt(t.kop.logoUkuranMm),
              objectFit: "contain",
            }}
            src={logo}
          />
        )}
        <View
          style={{
            position: "absolute",
            left: kiri + mmKePt(t.kop.teksIndenMm),
            right: kanan,
            top: mmKePt(t.kop.teksAtasMm),
            alignItems: "center",
          }}
        >
          {barisKop.map((b, i) => (
            <BarisKopSurat key={i} baris={b} nilai={nilai} />
          ))}
        </View>
        {t.kop.garis && (
          <View
            style={{
              position: "absolute",
              left: garisKiri,
              top: mmKePt(t.kop.garisAtasMm),
              width: garisLebar,
              borderTopWidth: 0.63,
              borderTopColor: "#000",
            }}
          />
        )}

        {/* NOMOR, SIFAT, LAMPIRAN, HAL + TANGGAL */}
        <View style={{ position: "relative" }}>
          {[
            ["Nomor", nomorSurat],
            ["Sifat", isiPenanda(t.kepala.sifat, nilai)],
            ["Lampiran", isiPenanda(t.kepala.lampiran, nilai)],
            ["Hal", isiPenanda(t.kepala.hal, nilai)],
          ].map(([label, isi]) => (
            <View key={label} style={S.row}>
              <Text style={S.kepalaLabel}>{label}</Text>
              <Text style={S.kepalaTitikDua}>:</Text>
              <Text style={S.isi}>{isi}</Text>
            </View>
          ))}
          {t.kepala.atasNama.trim() !== "" && (
            <View style={S.row}>
              <Text style={{ width: 132.9 - KIRI_WORD }} />
              <Text style={S.isi}>
                <TeksTemplate teks={t.kepala.atasNama} nilai={nilai} />
              </Text>
            </View>
          )}
          <Text style={S.tanggal}>
            <TeksTemplate teks={t.kepala.tanggal} nilai={nilai} />
          </Text>
        </View>

        {/* TUJUAN: tiap baris template dicetak sebagai baris sendiri. */}
        <View style={{ marginTop: SELA }}>
          {t.tujuan.split("\n").map((b, i) => (
            <Text key={i}>
              <TeksTemplate teks={b} nilai={nilai} />
            </Text>
          ))}
        </View>

        {/* PEMBUKA */}
        <Text style={[S.p, { marginTop: 7.9, textIndent: 28.35 }]}>
          <TeksTemplate teks={t.paragraf.pembuka} nilai={nilai} />
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
          <TeksTemplate teks={t.paragraf.dasarSk} nilai={nilai} />
        </Text>
        <View style={{ marginTop: SELA }}>
          <BarisHuruf huruf="a" label="Oleh Pejabat" nilai={kgb.penetapSkDasar} />
          <BarisHuruf huruf="b" label="Tanggal" nilai={tgl(kgb.tanggalSK)} />
          <BarisHuruf huruf="c" label="Nomor" nilai={kgb.nomorSK} />
          <BarisHuruf huruf="d" label="Tanggal Mulai Berlakunya" nilai={tgl(kgb.tmtSK)} />
          <BarisHuruf
            huruf="e"
            label="Masa kerja golongan pada tanggal tersebut"
            nilai={masaKerja(mkgDasar.tahun, mkgDasar.bulan)}
          />
        </View>

        {/* HASIL KGB */}
        <Text style={[S.p, { marginTop: SELA }]}>
          <TeksTemplate teks={t.paragraf.hasil} nilai={nilai} />
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
          <TeksTemplate teks={t.paragraf.penutup} nilai={nilai} />
        </Text>

        {/* TTD: delegasi, jadi ditandatangani atas nama jabatan sendiri (tanpa a.n. Menteri).
            Nama tanpa NIP pada kedua versi, mengikuti template. */}
        <View style={{ marginTop: baris + 0.2 }}>
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
        {tembusan.length > 0 && (
          <View style={{ marginTop: 2 * baris }}>
            <Text style={S.tembusanJudul}>{t.tembusanJudul}</Text>
            {tembusan.map((isi, i) => (
              <View key={i} style={S.tembusanItem}>
                <Text style={S.tembusanNo}>{i + 1}.</Text>
                <Text style={S.isi}>{isi}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Tanda air DRAF: miring besar di tengah halaman dan satu baris di bawah, supaya SK yang belum disetujui UPT
            tidak tercetak untuk ditandatangani (ADR-077). Letaknya mutlak terhadap halaman, seperti logo kop. */}
        {props.draf && (
          <View
            fixed
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: lebar,
              height: mmKePt(t.kertas.tinggiMm),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 40,
                fontWeight: "bold",
                color: "#B42318",
                opacity: 0.16,
                transform: "rotate(-38deg)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {props.draf}
            </Text>
          </View>
        )}
        {props.draf && (
          <Text
            fixed
            style={{
              position: "absolute",
              left: kiri,
              right: kanan,
              bottom: mmKePt(6),
              fontSize: 8,
              color: "#B42318",
              textAlign: "center",
            }}
          >
            {`${props.draf}: belum boleh ditandatangani, dicetak untuk tanda tangan, atau dikirim lewat Srikandi.`}
          </Text>
        )}
      </Page>
    </Document>
  );
}
