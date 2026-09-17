import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import type { JenisPenandatangan } from "./penandatangan";
import { formatTanggalId, type NilaiTanggal } from "./waktu";

Font.register({
  family: "Times",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/times.ttf") },
    {
      src: path.join(process.cwd(), "public/fonts/timesbd.ttf"),
      fontWeight: "bold",
    },
    {
      src: path.join(process.cwd(), "public/fonts/timesi.ttf"),
      fontStyle: "italic",
    },
  ],
});

// Nonaktifkan hyphenation otomatis, cegah pemisahan kata seperti "Kali-mantan"
Font.registerHyphenationCallback((word) => [word]);

const S = StyleSheet.create({
  page: {
    fontFamily: "Times",
    fontSize: 11,
    paddingTop: 42,
    paddingBottom: 28,
    paddingHorizontal: 56,
    lineHeight: 1.15,
  },
  kopContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 5,
    gap: 10,
  },
  logo: { width: 60, height: 60 },
  kopText: { flex: 1, alignItems: "center" },
  kopL1: { fontSize: 9.5, textAlign: "center" },
  kopL2: { fontSize: 9.5, textAlign: "center" },
  kopL3: { fontSize: 11.5, fontWeight: "bold", textAlign: "center" },
  kopL4: { fontSize: 8.5, textAlign: "center" },
  row: { flexDirection: "row", marginBottom: 1.5 },
  colLabel: { width: 58, fontSize: 11 },
  colColon: { width: 10, fontSize: 11 },
  colValue: { flex: 1, fontSize: 11 },
  tanggal: { position: "absolute", right: 0, top: 0, fontSize: 11 },
  tujuan: { marginTop: 5, marginBottom: 5 },
  p: { marginBottom: 5, textAlign: "justify", fontSize: 11 },
  li: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 16 },
  liNo: { width: 24, fontSize: 11 },
  liLabel: { width: 138, fontSize: 11 },
  liColon: { width: 10, fontSize: 11 },
  liValue: { flex: 1, fontSize: 11 },
  sub: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 32 },
  subLabel: { width: 18, fontSize: 11 },
  subKey: { width: 128, fontSize: 11 },
  subColon: { width: 10, fontSize: 11 },
  subValue: { flex: 1, fontSize: 11 },
  kgbTitle: {
    textAlign: "center",
    textDecoration: "underline",
    marginBottom: 5,
    marginTop: 3,
    fontSize: 11,
  },
  ki: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 16 },
  kiNo: { width: 28, fontSize: 11 },
  kiLabel: { width: 138, fontSize: 11 },
  kiColon: { width: 10, fontSize: 11 },
  kiValue: { flex: 1, fontSize: 11 },
  dasarHukum: {
    marginTop: 5,
    marginBottom: 5,
    textAlign: "justify",
    fontSize: 11,
  },
  ttdBlock: { marginTop: 5, alignItems: "flex-end" },
  ttdNama: { fontSize: 11, fontWeight: "bold", textDecoration: "underline" },
  ttdNip: { fontSize: 11 },
  tembusan: { marginTop: 6 },
  tembusanTitle: { fontSize: 10, marginBottom: 2 },
  tembusanItem: { fontSize: 10, paddingLeft: 8 },
});

// Tanggal di surat dibaca menurut WITA, bukan zona server (Cloudflare Workers berjalan dalam UTC).
function tgl(date: NilaiTanggal): string {
  return formatTanggalId(date);
}

function rp(n: number): string {
  return `Rp. ${n.toLocaleString("id-ID")},-`;
}

interface SuratKGBProps {
  nomorSurat: string;
  tanggalSurat: NilaiTanggal;
  /**
   * KPPN mitra satker pegawai (lib/satker.ts), dicetak pada tujuan surat. Unit kerja kosong berarti
   * Kanwil; route PDF menolak unit kerja di luar daftar satker, jadi nilai ini selalu KPPN yang dikenal.
   */
  kppn: string;
  pegawai: {
    nama: string;
    nip: string;
    jabatan: string;
    pangkat: string;
    golonganRuang: string;
    unitKerja: string;
  };
  kgb: {
    gajiPokokLama: number;
    nomorSK: string;
    tanggalSK: NilaiTanggal;
    tmtSK: NilaiTanggal;
    /** Pejabat penetap SK dasar, dicetak pada baris "Oleh". */
    penetapSkDasar: string;
    mkgTahunLama: number;
    mkgBulanLama: number;
    gajiPokokBaru: number;
    mkgTahunBaru: number;
    mkgBulanBaru: number;
    golonganBaru: string;
    tmtKgbBaru: NilaiTanggal;
    tmtKgbBerikutnya: NilaiTanggal;
    flagRapelan: boolean;
  };
  /** Hasil tentukanPenandatangan(); jabatan sudah berawalan Plh./Plt. bila perlu. */
  penandatangan: {
    jenis: JenisPenandatangan;
    jabatan: string;
    nama: string;
    nip: string;
  };
  /** Nomor peraturan gaji yang dirujuk, mis. "Nomor 5 Tahun 2024". */
  dasarHukum: string;
  /** Render versi Srikandi: placeholder ${ttd_pengirim} + label Srikandi di area TTD */
  srikandi?: boolean;
}

export function SuratKGBDocument({
  nomorSurat,
  tanggalSurat,
  kppn,
  pegawai,
  kgb,
  penandatangan,
  dasarHukum,
  srikandi = false,
}: SuratKGBProps) {
  const logoSrc = `data:image/png;base64,${fs
    .readFileSync(path.join(process.cwd(), "public/logo-imipas.png"))
    .toString("base64")}`;
  const labelSrikandiSrc = srikandi
    ? `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), "public/label-srikandi.png")).toString("base64")}`
    : null;
  // KGB milik pimpinan Kanwil ditandatangani Dirjen, sehingga suratnya berkop Direktorat Jenderal.
  const kopDitjen = penandatangan.jenis === "dirjen";

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* KOP SURAT */}
        <View style={S.kopContainer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image @react-pdf/renderer (PDF), bukan elemen DOM; prop alt tidak ada di tipenya */}
          <Image style={S.logo} src={logoSrc} />
          <View style={S.kopText}>
            <Text style={S.kopL1}>
              KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA
            </Text>
            {kopDitjen ? (
              <Text style={S.kopL3}>DIREKTORAT JENDERAL PEMASYARAKATAN</Text>
            ) : (
              <>
                <Text style={S.kopL2}>DIREKTORAT JENDERAL PEMASYARAKATAN</Text>
                <Text style={S.kopL3}>KANTOR WILAYAH KALIMANTAN SELATAN</Text>
                <Text style={S.kopL4}>
                  Jalan Jendral A. Yani Km. 5,5 No. 24, Banjarmasin, Kalimantan
                  Selatan
                </Text>
                <Text style={S.kopL4}>
                  Telepon 085252502005, Pos-el : kanwilditjenpaskalsel@gmail.com
                </Text>
              </>
            )}
          </View>
        </View>

        {/* NOMOR, LAMPIRAN, SIFAT, HAL + TANGGAL */}
        <View style={{ position: "relative", marginBottom: 5 }}>
          <View style={S.row}>
            <Text style={S.colLabel}>Nomor</Text>
            <Text style={S.colColon}>:</Text>
            <Text style={S.colValue}>{nomorSurat}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.colLabel}>Lampiran</Text>
            <Text style={S.colColon}>:</Text>
            <Text style={S.colValue}>-</Text>
          </View>
          <View style={S.row}>
            <Text style={S.colLabel}>Sifat</Text>
            <Text style={S.colColon}>:</Text>
            <Text style={S.colValue}>Biasa</Text>
          </View>
          <View style={S.row}>
            <Text style={S.colLabel}>Hal</Text>
            <Text style={S.colColon}>:</Text>
            <Text style={S.colValue}>
              Kenaikan Gaji Berkala a.n. {pegawai.nama}
            </Text>
          </View>
          <Text style={S.tanggal}>{tgl(tanggalSurat)}</Text>
        </View>

        {/* TUJUAN */}
        <View style={S.tujuan}>
          <Text>Yth. Kepala Kantor Pelayanan Perbendaharaan Negara</Text>
          <Text>Di {kppn}</Text>
        </View>

        {/* PEMBUKA */}
        <Text style={S.p}>
          {"      "}Dengan ini diberitahukan, bahwa telah dipenuhinya masa kerja
          dan syarat – syarat lainnya kepada :
        </Text>

        {/* DATA PEGAWAI */}
        <View style={S.li}>
          <Text style={S.liNo}>1.</Text>
          <Text style={S.liLabel}>Nama</Text>
          <Text style={S.liColon}>:</Text>
          <Text style={S.liValue}>{pegawai.nama}</Text>
        </View>
        <View style={S.li}>
          <Text style={S.liNo}>2.</Text>
          <Text style={S.liLabel}>NIP</Text>
          <Text style={S.liColon}>:</Text>
          <Text style={S.liValue}>{pegawai.nip}</Text>
        </View>
        <View style={S.li}>
          <Text style={S.liNo}>3.</Text>
          <Text style={S.liLabel}>Pangkat / Jabatan</Text>
          <Text style={S.liColon}>:</Text>
          <Text style={S.liValue}>
            {pegawai.pangkat} ({pegawai.golonganRuang})
            {pegawai.jabatan?.trim() ? ` / ${pegawai.jabatan.trim()}` : ""}
          </Text>
        </View>
        <View style={S.li}>
          <Text style={S.liNo}>4.</Text>
          <Text style={S.liLabel}>Unit kerja</Text>
          <Text style={S.liColon}>:</Text>
          <Text style={S.liValue}>{pegawai.unitKerja}</Text>
        </View>
        <View style={{ ...S.li, marginBottom: 5 }}>
          <Text style={S.liNo}>5.</Text>
          <Text style={S.liLabel}>Gaji Pokok Lama</Text>
          <Text style={S.liColon}>:</Text>
          <Text style={S.liValue}>{rp(kgb.gajiPokokLama)}</Text>
        </View>

        {/* DASAR SK */}
        <Text style={S.p}>
          {"      "}Atas dasar surat keputusan terakhir tentang penyesuaian gaji
          pokok yang ditetapkan :
        </Text>
        <View style={S.sub}>
          <Text style={S.subLabel}>a.</Text>
          <Text style={S.subKey}>Oleh</Text>
          <Text style={S.subColon}>:</Text>
          <Text style={S.subValue}>{kgb.penetapSkDasar}</Text>
        </View>
        <View style={S.sub}>
          <Text style={S.subLabel}>b.</Text>
          <Text style={S.subKey}>Nomor</Text>
          <Text style={S.subColon}>:</Text>
          <Text style={S.subValue}>{kgb.nomorSK}</Text>
        </View>
        <View style={S.sub}>
          <Text style={S.subLabel}>c.</Text>
          <Text style={S.subKey}>Tanggal</Text>
          <Text style={S.subColon}>:</Text>
          <Text style={S.subValue}>{tgl(kgb.tanggalSK)}</Text>
        </View>
        <View style={S.sub}>
          <Text style={S.subLabel}>d.</Text>
          <Text style={S.subKey}>Tanggal mulai berlaku gaji tersebut.</Text>
          <Text style={S.subColon}>:</Text>
          <Text style={S.subValue}>{tgl(kgb.tmtSK)}</Text>
        </View>
        <View style={{ ...S.sub, marginBottom: 5 }}>
          <Text style={S.subLabel}>e.</Text>
          <Text style={S.subKey}>Masa Kerja Gol. pada tanggal tersebut</Text>
          <Text style={S.subColon}>:</Text>
          <Text style={S.subValue}>
            {kgb.mkgTahunLama} tahun {kgb.mkgBulanLama} bulan
          </Text>
        </View>

        {/* HASIL KGB */}
        <Text style={S.kgbTitle}>
          Diberikan Kenaikan Gaji Berkala, hingga memperoleh :
        </Text>
        <View style={S.ki}>
          <Text style={S.kiNo}>6.</Text>
          <Text style={S.kiLabel}>Gaji Pokok Baru</Text>
          <Text style={S.kiColon}>:</Text>
          <Text style={S.kiValue}>{rp(kgb.gajiPokokBaru)}</Text>
        </View>
        <View style={S.ki}>
          <Text style={S.kiNo}>7.</Text>
          <Text style={S.kiLabel}>Berdasarkan Masa Kerja</Text>
          <Text style={S.kiColon}>:</Text>
          <Text style={S.kiValue}>
            {kgb.mkgTahunBaru} tahun {String(kgb.mkgBulanBaru).padStart(2, "0")}{" "}
            bulan
          </Text>
        </View>
        <View style={S.ki}>
          <Text style={S.kiNo}>8.</Text>
          <Text style={S.kiLabel}>Dalam Golongan</Text>
          <Text style={S.kiColon}>:</Text>
          <Text style={S.kiValue}>{kgb.golonganBaru}</Text>
        </View>
        <View style={S.ki}>
          <Text style={S.kiNo}>9.</Text>
          <Text style={S.kiLabel}>Mulai tanggal</Text>
          <Text style={S.kiColon}>:</Text>
          <Text style={S.kiValue}>{tgl(kgb.tmtKgbBaru)}</Text>
        </View>
        <View style={{ ...S.ki, marginBottom: 5 }}>
          <Text style={S.kiNo}>10.</Text>
          <Text style={S.kiLabel}>Kenaikan gaji berkala yang akan datang</Text>
          <Text style={S.kiColon}>:</Text>
          <Text style={S.kiValue}>{tgl(kgb.tmtKgbBerikutnya)}</Text>
        </View>

        {/* DASAR HUKUM */}
        <Text style={S.dasarHukum}>
          {"      "}Diharap agar sesuai dengan Peraturan Pemerintah{" "}
          <Text style={{ fontWeight: "bold" }}>{dasarHukum},</Text>{" "}
          kepada Pegawai tersebut dapat dibayarkan penghasilannya berdasarkan
          gaji pokok tersebut.
        </Text>

        {/* TTD: delegasi, jadi ditandatangani atas nama jabatan sendiri (tanpa a.n. Menteri) */}
        {srikandi ? (
          /* Srikandi: 2-kolom, kiri ${ttd_pengirim}, kanan blok pejabat */
          <View
            style={{
              marginTop: 5,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {/* Kiri: placeholder ttd_pengirim */}
            <Text style={{ fontSize: 11, marginLeft: 32 }}>
              {"${ttd_pengirim}"}
            </Text>
            {/* Kanan: jabatan + label Srikandi + nama + NIP */}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, marginBottom: 6 }}>
                {penandatangan.jabatan}
              </Text>
              {labelSrikandiSrc && (
                // eslint-disable-next-line jsx-a11y/alt-text -- Image @react-pdf/renderer (PDF), bukan elemen DOM; prop alt tidak ada di tipenya
                <Image
                  style={{
                    width: 110,
                    height: 36,
                    objectFit: "contain",
                    marginBottom: 4,
                  }}
                  src={labelSrikandiSrc}
                />
              )}
              <Text style={S.ttdNama}>{penandatangan.nama}</Text>
              <Text style={S.ttdNip}>NIP. {penandatangan.nip}</Text>
            </View>
          </View>
        ) : (
          /* Reguler: satu blok rata kanan dengan ruang tanda tangan */
          <View style={S.ttdBlock}>
            <Text style={{ fontSize: 11, marginBottom: 4 }}>
              {penandatangan.jabatan}
            </Text>
            <Text style={{ fontSize: 11, marginBottom: 36 }}> </Text>
            <Text style={S.ttdNama}>{penandatangan.nama}</Text>
            <Text style={S.ttdNip}>NIP. {penandatangan.nip}</Text>
          </View>
        )}

        {/* TEMBUSAN */}
        <View style={S.tembusan}>
          <Text style={S.tembusanTitle}>Tembusan :</Text>
          <Text style={S.tembusanItem}>
            1. Pembuat Daftar gaji yang bersangkutan;
          </Text>
          <Text style={S.tembusanItem}>
            2. Pegawai Negeri Sipil yang bersangkutan.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
