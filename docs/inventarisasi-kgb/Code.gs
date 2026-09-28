/**
 * Inventarisasi data KGB pegawai Kanwil Ditjenpas Kalsel (SIM-KGB, /inventarisasi-kgb).
 *
 * Web app Google Apps Script yang menerima kiriman formulir publik SIM-KGB dan menyimpannya di Google Drive
 * milik akun yang menerbitkan skrip ini:
 *
 *   [FOLDER_ID]
 *   ├─ Rekap Inventarisasi KGB Kanwil      (Google Sheet, satu baris per pegawai)
 *   ├─ 01 Pernah KGB / NIP - Nama / NIP_SK-KGB-Terakhir_YYYY-MM-DD.pdf, NIP_SK-KP-Terakhir_YYYY-MM-DD.pdf
 *   └─ 02 Belum Pernah KGB / NIP - Nama / NIP_SK-CPNS_YYYY-MM-DD.pdf, NIP_SK-PNS_YYYY-MM-DD.pdf
 *
 * Properti skrip (Project Settings > Script properties):
 *   FOLDER_ID   id folder Drive tujuan, mis. 149ZW_VaniapL9EpvV9pWjpVo8fQmfxnz
 *   KODE_AKSES  kode yang diumumkan di grup WA pegawai Kanwil
 *
 * Kiriman ulang dari NIP yang sama mengganti kiriman sebelumnya: berkas lama dipindah ke Sampah Drive
 * (dapat dipulihkan 30 hari), folder dipindah bila keadaan KGB-nya berubah, dan baris rekap diperbarui.
 * Panduan pemasangan: docs/inventarisasi-kgb/PANDUAN.md.
 */

var NAMA_REKAP = "Rekap Inventarisasi KGB Kanwil";
var FOLDER_KEADAAN = { pernah: "01 Pernah KGB", belum: "02 Belum Pernah KGB" };
var JENIS_KEADAAN = {
  pernah: ["SK-KGB-Terakhir", "SK-KP-Terakhir"],
  belum: ["SK-CPNS", "SK-PNS"],
};
var BATAS_BYTE = 1024 * 1024;
var BATAS_KIRIM_PER_NIP_PER_JAM = 5;
var ZONA = "Asia/Makassar";

function doGet() {
  return jawab({ ok: true, layanan: "inventarisasi-kgb" });
}

function doPost(e) {
  var kunci = LockService.getScriptLock();
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var galat = periksa(data);
    if (galat) return jawab({ ok: false, error: galat });

    if (!bolehKirim(data.nip)) {
      return jawab({ ok: false, error: "Terlalu sering mengirim untuk NIP ini. Coba lagi dalam satu jam." });
    }

    kunci.waitLock(30000);
    var hasil = simpan(data);
    return jawab({ ok: true, kirimanKe: hasil.kirimanKe, folder: hasil.folder });
  } catch (err) {
    console.error(err);
    return jawab({ ok: false, error: "Kiriman gagal disimpan. Coba lagi beberapa saat lagi." });
  } finally {
    try { kunci.releaseLock(); } catch (x) {}
  }
}

function jawab(isi) {
  return ContentService.createTextOutput(JSON.stringify(isi)).setMimeType(ContentService.MimeType.JSON);
}

/** Pesan galat untuk kiriman yang tidak sah, atau null. */
function periksa(d) {
  var prop = PropertiesService.getScriptProperties();
  var kode = String(prop.getProperty("KODE_AKSES") || "").trim().toUpperCase();
  if (!kode || !prop.getProperty("FOLDER_ID")) return "Formulir belum disiapkan pengelola.";
  if (String(d.kode || "").trim().toUpperCase() !== kode) return "Kode akses salah. Lihat pengumuman di grup WA pegawai Kanwil.";
  if (!/^\d{18}$/.test(String(d.nip || ""))) return "NIP harus 18 angka.";
  if (!FOLDER_KEADAAN[d.keadaan]) return "Keadaan KGB tidak dikenal.";
  if (String(d.namaFolder || "").indexOf(d.nip + " - ") !== 0) return "Nama folder tidak sah.";
  if (!Array.isArray(d.kolom) || !Array.isArray(d.baris) || d.baris.length !== d.kolom.length - 2) return "Isian tidak lengkap.";
  if (!Array.isArray(d.berkas) || d.berkas.length === 0) return "Berkas belum dilampirkan.";
  var jenisSah = JENIS_KEADAAN[d.keadaan];
  for (var i = 0; i < d.berkas.length; i++) {
    var b = d.berkas[i];
    if (jenisSah.indexOf(b.jenis) < 0) return "Jenis berkas tidak sesuai keadaan KGB.";
    var pola = new RegExp("^" + d.nip + "_" + b.jenis + "(_\\d{4}-\\d{2}-\\d{2})?\\.pdf$");
    if (!pola.test(String(b.nama || ""))) return "Nama berkas tidak sah.";
    if (String(b.base64 || "").indexOf("JVBERi") !== 0) return b.jenis + " bukan berkas PDF.";
    if (Math.floor(String(b.base64).length * 3 / 4) > BATAS_BYTE + 3) return b.jenis + " lebih dari 1 MB.";
  }
  if (jenisSah[0] && !d.berkas.some(function (b) { return b.jenis === jenisSah[0]; })) return "Berkas wajib belum dilampirkan.";
  if (d.keadaan === "pernah" && !d.berkas.some(function (b) { return b.jenis === jenisSah[1]; })) return "Berkas wajib belum dilampirkan.";
  return null;
}

/** Batas kiriman per NIP agar formulir tidak dipakai membanjiri Drive. */
function bolehKirim(nip) {
  var cache = CacheService.getScriptCache();
  var kunci = "kirim:" + nip;
  var jumlah = Number(cache.get(kunci) || "0");
  if (jumlah >= BATAS_KIRIM_PER_NIP_PER_JAM) return false;
  cache.put(kunci, String(jumlah + 1), 3600);
  return true;
}

function simpan(d) {
  var akar = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("FOLDER_ID"));
  var tujuan = ambilAtauBuatFolder(akar, FOLDER_KEADAAN[d.keadaan]);
  var lain = ambilAtauBuatFolder(akar, FOLDER_KEADAAN[d.keadaan === "pernah" ? "belum" : "pernah"]);

  // Folder pegawai dicari di kedua keadaan: kiriman ulang dengan keadaan berbeda memindahkan foldernya.
  var folder = cariFolderNip(tujuan, d.nip) || cariFolderNip(lain, d.nip);
  if (folder) {
    if (!adaDi(folder, tujuan)) folder.moveTo(tujuan);
    folder.setName(d.namaFolder);
    // Kiriman terbaru yang berlaku: berkas lama ke Sampah (dapat dipulihkan 30 hari).
    var lama = folder.getFiles();
    while (lama.hasNext()) lama.next().setTrashed(true);
  } else {
    folder = tujuan.createFolder(d.namaFolder);
  }

  var tautan = [];
  for (var i = 0; i < d.berkas.length; i++) {
    var b = d.berkas[i];
    var blob = Utilities.newBlob(Utilities.base64Decode(b.base64), "application/pdf", b.nama);
    var berkas = folder.createFile(blob);
    tautan.push(b.nama + ": " + berkas.getUrl());
  }

  var kirimanKe = tulisRekap(akar, d, folder.getUrl(), tautan.join("\n"));
  return { kirimanKe: kirimanKe, folder: folder.getUrl() };
}

function ambilAtauBuatFolder(induk, nama) {
  var cari = induk.getFoldersByName(nama);
  return cari.hasNext() ? cari.next() : induk.createFolder(nama);
}

function cariFolderNip(induk, nip) {
  var semua = induk.getFolders();
  while (semua.hasNext()) {
    var f = semua.next();
    if (f.getName().indexOf(nip + " - ") === 0 || f.getName() === nip) return f;
  }
  return null;
}

function adaDi(folder, induk) {
  var parents = folder.getParents();
  while (parents.hasNext()) if (parents.next().getId() === induk.getId()) return true;
  return false;
}

function lembarRekap(akar, kolom) {
  var cari = akar.getFilesByName(NAMA_REKAP);
  var ss;
  if (cari.hasNext()) {
    ss = SpreadsheetApp.open(cari.next());
  } else {
    ss = SpreadsheetApp.create(NAMA_REKAP);
    DriveApp.getFileById(ss.getId()).moveTo(akar);
  }
  var sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    var judul = kolom.concat(["Folder", "Berkas"]);
    sh.appendRow(judul);
    sh.getRange(1, 1, 1, judul.length).setFontWeight("bold").setBackground("#e8eef9");
    sh.setFrozenRows(1);
    // NIP dan nomor WA disimpan sebagai teks agar 18 angkanya tidak berubah menjadi notasi ilmiah.
    sh.getRange("D:D").setNumberFormat("@");
    sh.getRange(1, kolom.indexOf("Nomor WhatsApp") + 1, sh.getMaxRows(), 1).setNumberFormat("@");
  }
  return sh;
}

/** Tulis atau perbarui baris pegawai; mengembalikan urutan kiriman untuk NIP itu. */
function tulisRekap(akar, d, urlFolder, daftarBerkas) {
  var sh = lembarRekap(akar, d.kolom);
  var waktu = Utilities.formatDate(new Date(), ZONA, "yyyy-MM-dd HH:mm:ss");
  var baris = null;
  var kirimanKe = 1;
  var akhir = sh.getLastRow();
  if (akhir > 1) {
    var nips = sh.getRange(2, 4, akhir - 1, 1).getDisplayValues();
    for (var i = 0; i < nips.length; i++) {
      if (String(nips[i][0]) === d.nip) {
        baris = i + 2;
        kirimanKe = Number(sh.getRange(baris, 2).getValue() || 1) + 1;
        break;
      }
    }
  }
  var nilai = [waktu, kirimanKe].concat(d.baris.map(String)).concat([urlFolder, daftarBerkas]);
  // Semua sel sebagai teks: NIP tetap 18 angka dan tanggal tetap berformat yyyy-mm-dd seperti di SIM-KGB.
  var target = baris || sh.getLastRow() + 1;
  sh.getRange(target, 1, 1, nilai.length).setNumberFormat("@").setValues([nilai]);
  return kirimanKe;
}
