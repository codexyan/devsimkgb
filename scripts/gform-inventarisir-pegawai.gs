/**
 * Formulir inventarisasi data pegawai Kanwil untuk SIM-KGB.
 *
 * Cara pakai:
 *  1. Buka script.google.com → New project, tempel seluruh berkas ini.
 *  2. Jalankan buatFormulir(). Setujui izin saat diminta. Tautan formulir tercetak di Execution log.
 *  3. Sebarkan tautannya ke grup WhatsApp pegawai.
 *  4. Setelah jawaban terkumpul, jalankan buatLembarImpor(). Fungsi itu menyusun lembar
 *     "impor-simkgb" dengan header persis seperti template impor SIM-KGB, lalu unduh lembar itu
 *     sebagai CSV dan unggah di Dasbor → Pegawai → Import.
 *
 * Pertanyaan disusun mengikuti kolom template impor (lihat TEMPLATE_HEADER di
 * app/dashboard/pegawai/import/page.tsx) supaya jawaban bisa langsung dipakai tanpa diketik ulang.
 *
 * Gaji pokok dan TMT KGB berikutnya yang dilaporkan pegawai sengaja tidak ikut diimpor. SIM-KGB menghitungnya sendiri dari
 * golongan dan masa kerja menurut PP 5/2024; angka yang dilaporkan ditaruh di lembar "cek-gaji"
 * sebagai bahan pembanding, sehingga selisih apa pun terlihat sebelum SK terbit.
 */

var NAMA_FORMULIR = "Inventarisasi Data Pegawai Kanwil SIM-KGB";
var SATKER_KANWIL = "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";
var ZONA = "Asia/Makassar";

/** Golongan dan pangkatnya. Pangkat diturunkan dari golongan agar tidak salah ketik. */
var PANGKAT = {
  "I/a": "Juru Muda",
  "I/b": "Juru Muda Tingkat I",
  "I/c": "Juru",
  "I/d": "Juru Tingkat I",
  "II/a": "Pengatur Muda",
  "II/b": "Pengatur Muda Tingkat I",
  "II/c": "Pengatur",
  "II/d": "Pengatur Tingkat I",
  "III/a": "Penata Muda",
  "III/b": "Penata Muda Tingkat I",
  "III/c": "Penata",
  "III/d": "Penata Tingkat I",
  "IV/a": "Pembina",
  "IV/b": "Pembina Tingkat I",
  "IV/c": "Pembina Utama Muda",
  "IV/d": "Pembina Utama Madya",
  "IV/e": "Pembina Utama",
};

/** Header template impor SIM-KGB, urutannya tidak boleh diubah. */
var TEMPLATE_HEADER = [
  "nip", "nama", "jabatan", "unitKerja", "pangkat", "golonganRuang", "tmtGolongan",
  "mkgTahun", "mkgBulan", "gajiPokok", "tmtKgbTerakhir", "tmtKgbBerikutnya",
  "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir", "eselon",
  "statusHukdis", "keteranganHukdis",
];

/**
 * Daftar pertanyaan. "kolom" menyambungkan jawaban ke kolom impor; kolom null berarti jawaban hanya
 * dipakai untuk verifikasi dan tidak ikut diimpor.
 */
var PERTANYAAN = [
  {
    kolom: "nama", judul: "Nama lengkap (dengan gelar)", tipe: "teks", wajib: true,
    bantuan: "Tulis sesuai SK terakhir, gunakan HURUF KAPITAL.",
  },
  {
    kolom: "nip", judul: "NIP (18 digit)", tipe: "teks", wajib: true, pola: "[0-9]{18}",
    bantuan: "Angka saja, tanpa spasi dan tanpa tanda baca.",
  },
  {
    kolom: null, judul: "Bagian/Bidang tempat bertugas", tipe: "pilihan", wajib: true,
    // Sesuai susunan yang terpakai pada data pegawai Kanwil saat ini.
    pilihan: [
      "Bagian Tata Usaha dan Umum",
      "Bidang Pelayanan dan Pembinaan",
      "Bidang Perawatan, Pengamanan, dan Kepatuhan Internal",
      "Bidang Pembimbingan Kemasyarakatan",
      "Lainnya",
    ],
    bantuan: "Untuk memudahkan kami menghubungi Saudara bila ada data yang perlu dikonfirmasi.",
  },
  { kolom: "jabatan", judul: "Jabatan", tipe: "teks", wajib: true, bantuan: "Contoh: Analis Kepegawaian, Penjaga Tahanan, Pranata Komputer Ahli Pertama." },
  {
    kolom: "golonganRuang", judul: "Golongan/Ruang", tipe: "daftar", wajib: true,
    pilihan: Object.keys(PANGKAT),
    bantuan: "Pangkat akan kami isi otomatis sesuai golongan ini.",
  },
  { kolom: "tmtGolongan", judul: "TMT Golongan", tipe: "tanggal", wajib: true, bantuan: "Tanggal mulai berlaku golongan saat ini, ada di SK kenaikan pangkat terakhir." },
  {
    kolom: "mkgTahun", judul: "Masa Kerja Golongan (tahun)", tipe: "angka", wajib: true, min: 0, maks: 40,
    bantuan: "Lihat SK KGB/kenaikan pangkat terakhir, bagian masa kerja golongan. Contoh: untuk 19 tahun 1 bulan, isi 19.",
  },
  { kolom: "mkgBulan", judul: "Masa Kerja Golongan (bulan)", tipe: "angka", wajib: true, min: 0, maks: 11, bantuan: "Sisa bulannya saja, 0 sampai 11. Contoh: untuk 19 tahun 1 bulan, isi 1." },
  { kolom: null, judul: "Gaji pokok pada SK terakhir (Rp)", tipe: "angka", wajib: true, min: 0, maks: 99999999, bantuan: "Angka saja tanpa titik. Contoh: 3838300. Dipakai untuk memeriksa silang, bukan untuk menetapkan gaji." },
  { kolom: "tmtKgbTerakhir", judul: "TMT KGB terakhir", tipe: "tanggal", wajib: true, bantuan: "Tanggal mulai berlaku pada SK KGB terakhir. Bila belum pernah KGB, isi TMT CPNS." },
  { kolom: null, judul: "Nomor SK KGB/kenaikan pangkat terakhir", tipe: "teks", wajib: true, bantuan: "Salin persis dari SK." },
  { kolom: null, judul: "Tanggal SK terakhir", tipe: "tanggal", wajib: true },
  { kolom: "tempatLahir", judul: "Tempat lahir", tipe: "teks", wajib: true },
  { kolom: "tanggalLahir", judul: "Tanggal lahir", tipe: "tanggal", wajib: true },
  { kolom: "jenisKelamin", judul: "Jenis kelamin", tipe: "pilihan", wajib: true, pilihan: ["Laki-laki", "Perempuan"] },
  { kolom: "pendidikanTerakhir", judul: "Pendidikan terakhir", tipe: "daftar", wajib: true, pilihan: ["SD", "SMP", "SMA/SMK", "D3", "S1", "S2", "S3"] },
  { kolom: "eselon", judul: "Eselon", tipe: "daftar", wajib: true, pilihan: ["Eselon I", "Eselon II", "Eselon III", "Eselon IV", "Non Eselon"], bantuan: "Pilih Non Eselon bila jabatan Saudara fungsional atau pelaksana." },
  {
    kolom: "statusHukdis", judul: "Sedang menjalani hukuman disiplin?", tipe: "pilihan", wajib: true,
    pilihan: ["Tidak", "Ya"],
    bantuan: "Hukuman disiplin tingkat sedang atau berat menunda KGB, karena itu pertanyaan ini wajib dijawab jujur.",
  },
  {
    kolom: "keteranganHukdis", judul: "Bila Ya: jenis hukuman, nomor SK, dan masa berlakunya", tipe: "paragraf", wajib: false,
    bantuan: "Contoh: Penundaan KGB 1 tahun, SK Nomor W.19-123 tanggal 3 Maret 2026, berlaku 1 April 2026 sampai 31 Maret 2027. Kosongkan bila tidak ada.",
  },
  { kolom: null, judul: "Nomor WhatsApp aktif", tipe: "teks", wajib: true, bantuan: "Untuk konfirmasi bila ada data yang perlu diperjelas." },
];

/** Membuat formulir beserta spreadsheet jawabannya. Jalankan sekali. */
function buatFormulir() {
  var form = FormApp.create(NAMA_FORMULIR);
  form.setDescription(
    "Pendataan ini untuk menertibkan data kenaikan gaji berkala (KGB) pegawai Kantor Wilayah " +
    "Direktorat Jenderal Pemasyarakatan Kalimantan Selatan pada aplikasi SIM-KGB.\n\n" +
    "Siapkan SK KGB terakhir atau SK kenaikan pangkat terakhir sebelum mengisi, karena hampir semua " +
    "isian diambil dari sana. Pengisian sekitar 5 menit.\n\n" +
    "Data yang keliru dapat menyebabkan kekurangan bayar atau kelebihan bayar yang harus dikembalikan, " +
    "jadi mohon disalin apa adanya dari SK, bukan dari ingatan.",
  );
  form.setProgressBar(true);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage(
    "Terima kasih. Data Saudara sudah kami terima. Bila ada yang perlu diperjelas, kami menghubungi " +
    "lewat nomor WhatsApp yang dicantumkan.",
  );
  // Formulir disebar lewat grup WhatsApp, jadi tidak boleh menuntut akun Google.
  try { form.setRequireLogin(false); } catch (e) { /* akun pribadi: pengaturan ini memang tidak ada */ }
  try { form.setCollectEmail(false); } catch (e) { /* idem */ }

  for (var i = 0; i < PERTANYAAN.length; i++) tambahPertanyaan(form, PERTANYAAN[i]);

  var ss = SpreadsheetApp.create("Jawaban " + NAMA_FORMULIR);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  var simpanan = PropertiesService.getScriptProperties();
  simpanan.setProperty("formId", form.getId());
  simpanan.setProperty("spreadsheetId", ss.getId());

  Logger.log("Tautan untuk disebar : " + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log("Tautan penyuntingan  : " + form.getEditUrl());
  Logger.log("Spreadsheet jawaban  : " + ss.getUrl());
  return form.getPublishedUrl();
}

/** Menambahkan satu pertanyaan sesuai tipenya. */
function tambahPertanyaan(form, p) {
  var item;
  if (p.tipe === "tanggal") {
    item = form.addDateItem().setIncludesYear(true);
  } else if (p.tipe === "paragraf") {
    item = form.addParagraphTextItem();
  } else if (p.tipe === "pilihan") {
    item = form.addMultipleChoiceItem().setChoiceValues(p.pilihan);
  } else if (p.tipe === "daftar") {
    item = form.addListItem().setChoiceValues(p.pilihan);
  } else if (p.tipe === "angka") {
    item = form.addTextItem().setValidation(
      FormApp.createTextValidation()
        .setHelpText("Isi angka saja, antara " + p.min + " dan " + p.maks + ".")
        .requireNumberBetween(p.min, p.maks)
        .build(),
    );
  } else {
    item = form.addTextItem();
    if (p.pola) {
      item.setValidation(
        FormApp.createTextValidation()
          .setHelpText("Format belum sesuai. NIP harus 18 angka tanpa spasi.")
          .requireTextMatchesPattern(p.pola)
          .build(),
      );
    }
  }
  item.setTitle(p.judul).setRequired(!!p.wajib);
  if (p.bantuan) item.setHelpText(p.bantuan);
}

/**
 * Menyusun lembar "impor-simkgb" (siap diunduh sebagai CSV) dan lembar "cek-gaji" dari jawaban yang
 * masuk. Bila satu NIP mengisi lebih dari sekali, jawaban terakhirlah yang dipakai.
 */
function buatLembarImpor() {
  var simpanan = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(simpanan.getProperty("spreadsheetId"));
  var form = FormApp.openById(simpanan.getProperty("formId"));

  var jawaban = form.getResponses();
  if (!jawaban.length) {
    Logger.log("Belum ada jawaban yang masuk.");
    return;
  }

  var perNip = {};
  var urutanNip = [];
  for (var i = 0; i < jawaban.length; i++) {
    var isi = {};
    var butir = jawaban[i].getItemResponses();
    for (var j = 0; j < butir.length; j++) isi[butir[j].getItem().getTitle()] = butir[j].getResponse();
    var nip = String(ambil(isi, "nip") || "").replace(/\D/g, "");
    if (!nip) continue;
    if (!perNip[nip]) urutanNip.push(nip);
    perNip[nip] = isi; // jawaban belakangan menimpa yang sebelumnya
  }

  var barisImpor = [TEMPLATE_HEADER.slice()];
  var barisCek = [["nip", "nama", "golonganRuang", "mkgTahun", "mkgBulan", "gajiPokokDilaporkan", "nomorSkTerakhir", "tanggalSkTerakhir", "bagian", "whatsapp"]];
  for (var k = 0; k < urutanNip.length; k++) {
    var isian = perNip[urutanNip[k]];
    var golongan = String(ambil(isian, "golonganRuang") || "").trim();
    barisImpor.push([
      urutanNip[k],
      String(ambil(isian, "nama") || "").trim().toUpperCase(),
      ambil(isian, "jabatan"),
      SATKER_KANWIL,
      PANGKAT[golongan] || "",
      golongan,
      tanggal(ambil(isian, "tmtGolongan")),
      ambil(isian, "mkgTahun"),
      ambil(isian, "mkgBulan"),
      "", // gaji pokok dihitung SIM-KGB dari PP 5/2024
      tanggal(ambil(isian, "tmtKgbTerakhir")),
      "", // TMT KGB berikutnya dihitung SIM-KGB dari golongan dan masa kerja golongan
      ambil(isian, "tempatLahir"),
      tanggal(ambil(isian, "tanggalLahir")),
      ambil(isian, "jenisKelamin"),
      ambil(isian, "pendidikanTerakhir"),
      ambil(isian, "eselon"),
      ambil(isian, "statusHukdis") === "Ya" ? "true" : "false",
      ambil(isian, "keteranganHukdis") || "",
    ]);
    barisCek.push([
      urutanNip[k],
      String(ambil(isian, "nama") || "").trim().toUpperCase(),
      golongan,
      ambil(isian, "mkgTahun"),
      ambil(isian, "mkgBulan"),
      judulBerisi(isian, "Gaji pokok"),
      judulBerisi(isian, "Nomor SK"),
      tanggal(judulBerisi(isian, "Tanggal SK")),
      judulBerisi(isian, "Bagian/Bidang"),
      judulBerisi(isian, "Nomor WhatsApp"),
    ]);
  }

  tulisLembar(ss, "impor-simkgb", barisImpor);
  tulisLembar(ss, "cek-gaji", barisCek);
  Logger.log(
    (barisImpor.length - 1) + " pegawai siap diimpor. Buka lembar \"impor-simkgb\", lalu " +
    "File → Download → Comma-separated values (.csv), dan unggah di Dasbor → Pegawai → Import.",
  );
}

/** Jawaban untuk pertanyaan yang dipetakan ke kolom impor tertentu. */
function ambil(isian, kolom) {
  for (var i = 0; i < PERTANYAAN.length; i++) {
    if (PERTANYAAN[i].kolom === kolom) return isian[PERTANYAAN[i].judul];
  }
  return "";
}

/** Jawaban untuk pertanyaan yang judulnya diawali teks tertentu; dipakai kolom non-impor. */
function judulBerisi(isian, awalan) {
  for (var judul in isian) {
    if (judul.indexOf(awalan) === 0) return isian[judul];
  }
  return "";
}

/** Tanggal formulir (yyyy-mm-dd) apa adanya; Google Forms sudah mengirimnya dalam bentuk itu. */
function tanggal(nilai) {
  if (!nilai) return "";
  if (Object.prototype.toString.call(nilai) === "[object Date]") return Utilities.formatDate(nilai, ZONA, "yyyy-MM-dd");
  return String(nilai).trim();
}

/** Menulis ulang satu lembar dari nol. */
function tulisLembar(ss, nama, baris) {
  var lembar = ss.getSheetByName(nama);
  if (lembar) lembar.clear(); else lembar = ss.insertSheet(nama);
  lembar.getRange(1, 1, baris.length, baris[0].length).setValues(baris);
  lembar.getRange(1, 1, 1, baris[0].length).setFontWeight("bold");
  lembar.setFrozenRows(1);
}
