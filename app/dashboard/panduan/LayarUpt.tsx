import { batasKirimSurat } from "@/lib/batasInputSdm";

/* Replika layar SIM-KGB untuk panduan Admin UPT.
 *
 * Gambar di panduan ini digambar ulang dengan HTML, bukan tangkapan layar PNG. Tiga alasannya:
 * tetap tajam di layar apa pun maupun saat dicetak; ikut mode gelap dan lebar ponsel tanpa dua berkas
 * terpisah; dan teksnya teks sungguhan, jadi dapat dicari dengan Ctrl+F serta dibacakan pembaca layar.
 * Perubahannya juga terlihat sebagai baris di git diff, tidak seperti berkas gambar.
 *
 * Isinya sengaja disederhanakan: hanya bagian layar yang sedang diterangkan, dengan nomor sorotan yang
 * dijelaskan tepat di bawahnya. Nama menu, tombol, tanda, dan kalimat sistem ditulis persis sama dengan
 * yang tampil di aplikasi, sebab panduan yang menyebut tombol dengan nama lain justru menyesatkan.
 * Nama pegawai pada contoh fiktif.
 */

/** Nomor sorotan di dalam replika; pasangannya ada di <Keterangan>. */
export function No({ n }: { n: number }) {
  return (
    <span className="lyr-no" aria-hidden="true">
      {n}
    </span>
  );
}

/** Bingkai satu layar, dengan jalur halaman di bilah atasnya. */
export function Layar({
  jalur,
  judul,
  anak,
  keterangan,
  catatan,
}: {
  /** Menu tempat layar ini berada, ditulis seperti pada sidebar. */
  jalur: string;
  judul: string;
  anak: React.ReactNode;
  /** Penjelasan tiap nomor sorotan, urut dari 1. */
  keterangan: readonly string[];
  /** Kalimat di bawah gambar untuk hal yang perlu ditegaskan. */
  catatan?: React.ReactNode;
}) {
  return (
    <figure className="lyr-gambar">
      <div className="lyr">
        <div className="lyr-bilah">
          <span className="lyr-titik" aria-hidden="true" />
          <span className="lyr-jalur">{jalur}</span>
        </div>
        <div className="lyr-tubuh">
          <p className="lyr-judul">{judul}</p>
          {anak}
        </div>
      </div>
      <figcaption>
        <ol className="lyr-keterangan">
          {keterangan.map((k, i) => (
            <li key={k}>
              <span className="lyr-no lyr-no-ket" aria-hidden="true">
                {i + 1}
              </span>
              <span>{k}</span>
            </li>
          ))}
        </ol>
        {catatan && <p className="lyr-catatan">{catatan}</p>}
      </figcaption>
    </figure>
  );
}

/* ── Potongan antarmuka yang dipakai berulang ──────────────────────────── */

function Tombol({ anak, jenis = "utama" }: { anak: React.ReactNode; jenis?: "utama" | "garis" }) {
  return <span className={`lyr-tombol${jenis === "garis" ? " lyr-tombol-garis" : ""}`}>{anak}</span>;
}

function Tanda({ anak, nada }: { anak: React.ReactNode; nada?: "hijau" | "kuning" | "merah" | "biru" }) {
  return <span className={`lyr-tanda${nada ? ` lyr-tanda-${nada}` : ""}`}>{anak}</span>;
}

function Centang({ isi = false }: { isi?: boolean }) {
  return (
    <span className={`lyr-centang${isi ? " lyr-centang-isi" : ""}`} aria-hidden="true">
      {isi ? "✓" : ""}
    </span>
  );
}

function Langkah({ aktif, daftar }: { aktif: number; daftar: readonly [string, string][] }) {
  return (
    <div className="lyr-langkah">
      {daftar.map(([judul, ket], i) => (
        <span key={judul} className="lyr-langkah-butir" data-aktif={i + 1 === aktif ? "" : undefined}>
          <span className="lyr-langkah-nomor">{i + 1 < aktif ? "✓" : i + 1}</span>
          <span>
            <strong>{judul}</strong>
            <small>{ket}</small>
          </span>
        </span>
      ))}
    </div>
  );
}

/* ── 1. Menu Admin UPT ─────────────────────────────────────────────────── */

export function LayarMenu() {
  const menu: [string, string][] = [
    ["Dashboard", "jadwal, pengingat, dan papan Alur KGB"],
    ["Pegawai Satker", "daftar pegawai satker Anda beserta status KGB-nya"],
    ["Usul KGB Kolektif", "menyiapkan dan mengajukan banyak pegawai"],
    ["Lapor Hukdis", "melaporkan SK hukuman disiplin ke Kanwil"],
    ["Riwayat", "riwayat KGB tiap pegawai, dan jejak usulan yang pernah dikirim"],
    ["Profil Saya", "mengganti kata sandi Anda sendiri"],
  ];
  return (
    <Layar
      jalur="Sidebar kiri"
      judul="Enam menu untuk Admin UPT"
      keterangan={[
        "Menu Anda hanya enam ini. Seluruhnya terbatas pada satker Anda sendiri: pegawai satker lain tidak pernah tampil.",
        "Usul KGB Kolektif adalah tempat kerja utama Anda setiap bulan.",
      ]}
      catatan="Bila menu yang Anda lihat berbeda, berarti akun Anda bukan Admin UPT. Hubungi Kanwil."
      anak={
        <div className="lyr-menu">
          {menu.map(([nama, ket], i) => (
            <span key={nama} className="lyr-menu-butir" data-sorot={nama === "Usul KGB Kolektif" ? "" : undefined}>
              <span className="lyr-menu-ikon" aria-hidden="true" />
              <span className="min-w-0">
                <strong>{nama}</strong>
                <small>{ket}</small>
              </span>
              {i === 0 && <No n={1} />}
              {nama === "Usul KGB Kolektif" && <No n={2} />}
            </span>
          ))}
        </div>
      }
    />
  );
}

/* ── 2. Pengingat masa kirim usulan ────────────────────────────────────── */

export function LayarPengingat({ namaBulan, batas }: { namaBulan: string; batas: string }) {
  return (
    <Layar
      jalur="Dashboard"
      judul="Jendela yang muncul sendiri saat masa kirim dibuka"
      keterangan={[
        `Batas mengirim surat dan sisa harinya. Masa kirim dibuka tanggal 1 sampai ${batasKirimSurat()} pada bulan kedua sebelum TMT.`,
        "Berapa pegawai yang jatuh tempo, dan berapa yang belum Anda ajukan ke Kanwil.",
        "Nama pegawai yang belum diajukan, supaya Anda tahu persis siapa yang tertinggal.",
        "Tombol ini membuka Usul KGB Kolektif dengan pegawai tersebut sudah tercentang.",
      ]}
      catatan="Jendela ini muncul sekali saja di tiap perangkat. Setelah Anda tutup, ia tidak muncul lagi pada periode yang sama; jadwalnya tetap dapat dilihat di pita jadwal dashboard."
      anak={
        <div className="lyr-modal">
          <p className="lyr-modal-judul">
            Masa kirim usulan KGB TMT {namaBulan} dibuka
            <small>Kirim surat usulan ke Kanwil lewat Srikandi</small>
          </p>
          <div className="lyr-batas">
            <span className="lyr-batas-tanggal" aria-hidden="true">
              <small>Tgl</small>
              <strong>{batasKirimSurat()}</strong>
            </span>
            <span>
              <strong>Batas kirim surat {batas}</strong>
              <small>4 hari lagi. Surat yang terlambat menggeser proses KGB pegawai.</small>
            </span>
            <No n={1} />
          </div>
          <div className="lyr-angka">
            <span>
              <strong>5</strong>
              <small>pegawai KGB TMT {namaBulan}</small>
            </span>
            <span data-nada="kuning">
              <strong>3</strong>
              <small>belum diajukan ke Kanwil</small>
            </span>
            <No n={2} />
          </div>
          <div className="lyr-daftar-nama">
            {["Pegawai Satu", "Pegawai Dua", "Pegawai Tiga"].map((n) => (
              <span key={n}>
                <strong>{n}</strong>
                <Tanda anak="II/a" />
              </span>
            ))}
            <No n={3} />
          </div>
          <div className="lyr-modal-kaki">
            <Tombol jenis="garis" anak="Nanti saja" />
            <span className="lyr-kaki-sorot">
              <Tombol anak="Siapkan usul KGB kolektif" />
              <No n={4} />
            </span>
          </div>
        </div>
      }
    />
  );
}

/* ── 3. Papan Alur KGB di dashboard ────────────────────────────────────── */

export function LayarPapan() {
  const kolom: [string, string, string, string][] = [
    ["Perlu dikerjakan", "kuning", "3", "Menunggu tindakan UPT"],
    ["Di Kanwil", "biru", "5", "Ditinjau atau diproses Kanwil"],
    ["Periksa SK", "ungu", "1", "SK KGB dari Kanwil, periksa sebelum dicetak"],
    ["SK terbit", "hijau", "2", "Unduh, lalu rekam di Gaji Web"],
    ["Selesai", "hijau", "8", "Sudah direkam di Gaji Web"],
  ];
  return (
    <Layar
      jalur="Dashboard"
      judul="Alur KGB: tiap pegawai berada di kolom tahapnya"
      keterangan={[
        "Perlu dikerjakan: draf yang belum Anda ajukan, dan usulan yang dikembalikan Kanwil beserta catatannya.",
        "Di Kanwil: sudah Anda ajukan. Datanya terkunci di sini, sebab peninjau harus melihat persis apa yang dikirim.",
        "Periksa SK: SK KGB yang dibuat Kanwil dan berbeda dari usulan Anda; SK yang sama dengan usulan langsung dicetak Kanwil.",
        "SK terbit: SK sudah ditandatangani. Unduh SK-nya, rekam di Gaji Web satker, lalu tandai di sini.",
        "Selesai: KGB yang SK-nya sudah Anda rekam di Gaji Web. Hanya itu; usulan yang disetujui tidak masuk ke sini.",
      ]}
      catatan="Satu pegawai selalu satu kartu. Bila orang yang sama punya beberapa dokumen berjalan, kartunya berada di kolom yang paling perlu Anda kerjakan. Kotak cari di kepala papan mencari nama atau NIP di semua kolom sekaligus; kolom yang diciutkan terbuka sendiri bila ada yang cocok. Garis tahap pada kartu (Usulan, Disetujui, SK dibuat, Diperiksa, TTE, Direkam) menunjukkan sampai mana KGB-nya."
      anak={
        <div className="lyr-papan">
          {kolom.map(([judul, nada, jumlah, ket], i) => (
            <div key={judul} className="lyr-papan-kolom">
              <p className="lyr-papan-kepala">
                <span className={`lyr-titik-nada lyr-titik-${nada}`} aria-hidden="true" />
                <strong>{judul}</strong>
                <span className="lyr-papan-jumlah">{jumlah}</span>
                <No n={i + 1} />
              </p>
              <p className="lyr-papan-ket">{ket}</p>
              <div className="lyr-kartu-mini">
                <strong>Pegawai Satu</strong>
                <small>TMT 1 Juni 2026 · II/a</small>
              </div>
              <div className="lyr-kartu-mini">
                <strong>Pegawai Dua</strong>
                <small>TMT 1 Juni 2026 · III/b</small>
              </div>
            </div>
          ))}
        </div>
      }
    />
  );
}

/* ── 4. Data Pegawai: tiga cara memasukkan data ────────────────────────── */

export function LayarDataPegawai() {
  return (
    <Layar
      jalur="Pegawai Satker"
      judul="Pegawai dan KGB"
      keterangan={[
        "Usul KGB Kolektif: menyiapkan banyak pegawai untuk satu surat, termasuk melaporkan SK kenaikan pangkat, penyesuaian ijazah, atau PMK banyak pegawai sekaligus. Ini jalur yang Anda pakai setiap periode.",
        "Unggah daftar: satu berkas Excel (.xlsx) atau CSV berisi banyak pegawai sekaligus. Dipakai saat mengisi data pertama kali atau meremajakan banyak data.",
        "Tambah pegawai: untuk satu orang yang belum tercatat, misalnya CPNS yang baru dilantik.",
        "Perbarui data: identitas, jabatan, keadaan KGB, dan SK sesudah SK KGB terakhir (kenaikan pangkat, PI, atau PMK) satu pegawai, dalam satu formulir.",
        "Titik tiga: Laporkan mutasi, dan Seharusnya tidak tercatat? untuk baris yang keliru sejak awal.",
      ]}
      anak={
        <>
          <div className="lyr-alat">
            <span className="lyr-segmen">
              <span data-aktif="">Semua</span>
              <span>Diusulkan</span>
              <span>Diproses Kanwil</span>
              <span>Selesai</span>
            </span>
            <span className="lyr-alat-kanan">
              <span className="lyr-sorot-bungkus">
                <Tombol jenis="garis" anak="Usul KGB Kolektif" />
                <No n={1} />
              </span>
              <span className="lyr-sorot-bungkus">
                <Tombol jenis="garis" anak="Unggah daftar" />
                <No n={2} />
              </span>
              <span className="lyr-sorot-bungkus">
                <Tombol anak="Tambah pegawai" />
                <No n={3} />
              </span>
            </span>
          </div>
          <div className="lyr-baris-pegawai">
            <span className="min-w-0">
              <strong>Pegawai Satu</strong>
              <small>199001012025061001 · Penjaga Tahanan · II/a</small>
            </span>
            <span className="lyr-sorot-bungkus">
              <Tombol jenis="garis" anak="Perbarui data" />
              <No n={4} />
            </span>
            <span className="lyr-sorot-bungkus">
              <Tombol jenis="garis" anak="⋮" />
              <No n={5} />
            </span>
          </div>
        </>
      }
    />
  );
}

/* ── 5. Unggah daftar, langkah 2: pratinjau dan konfirmasi ─────────────── */

export function LayarUnggah() {
  return (
    <Layar
      jalur="Pegawai Satker › Unggah daftar"
      judul="Langkah 2: Periksa & konfirmasi"
      keterangan={[
        "Ringkasan empat kelompok: pegawai baru, perbaikan data, yang sama persis sehingga dilewati, dan yang ditolak.",
        "Angka yang tampil adalah hasil bacaan sistem, bukan tulisan mentah di berkas. Periksa terutama tanggalnya, sebab Excel kerap menukar hari dengan bulan.",
        "Pegawai yang NIP-nya sudah tercatat tidak ditolak, melainkan menjadi usulan perbaikan. Buka barisnya untuk melihat data lama berdampingan dengan data berkas.",
        "Baris yang ditolak menyebutkan sebabnya, termasuk bila NIP-nya ternyata tercatat di satker lain.",
        "Centang baris yang hendak disimpan. Tidak ada satu pun yang tersimpan sebelum tombol ini ditekan.",
      ]}
      catatan="Yang tersimpan di sini masih berupa draf: belum terkirim ke Kanwil. Lengkapi berkas dan nomor SK-nya di Usul KGB Kolektif, lalu ajukan bersama satu surat."
      anak={
        <>
          <Langkah
            aktif={2}
            daftar={[
              ["Pilih berkas", "daftar-pegawai.xlsx"],
              ["Periksa & konfirmasi", "3 dari 6 baris dicentang"],
              ["Selesai", "belum disimpan"],
            ]}
          />
          <div className="lyr-ringkas">
            {(
              [
                ["2", "Pegawai baru", "hijau"],
                ["1", "Perbaikan data", "kuning"],
                ["1", "Sama, dilewati", ""],
                ["2", "Ditolak", "merah"],
              ] as [string, string, string][]
            ).map(([n, label, nada]) => (
              <span key={label} className="lyr-ringkas-butir" data-nada={nada || undefined}>
                <strong>{n}</strong>
                <small>{label}</small>
              </span>
            ))}
            <No n={1} />
          </div>
          <p className="lyr-info">
            Angka di bawah <b>adalah hasil bacaan sistem</b>, bukan tulisan mentah di berkas. <No n={2} />
          </p>
          <div className="lyr-baris-unggah">
            <Centang isi />
            <span className="min-w-0">
              <strong>Pegawai Satu</strong>
              <small>199001012025061001</small>
            </span>
            <span className="min-w-0">
              <Tanda anak="Perbaikan data" nada="kuning" />
              <small>3 isian berubah: Jabatan, Golongan ruang, Masa kerja golongan</small>
            </span>
            <No n={3} />
          </div>
          <div className="lyr-beda">
            <span className="lyr-beda-kepala">
              <small>Isian</small>
              <small>Tercatat sekarang</small>
              <small>Menurut berkas</small>
            </span>
            {(
              [
                ["Golongan ruang", "II/c", "III/a"],
                ["Masa kerja golongan", "21 tahun", "16 tahun"],
              ] as [string, string, string][]
            ).map(([k, lama, baru]) => (
              <span key={k} className="lyr-beda-baris">
                <span>{k}</span>
                <span>{lama}</span>
                <span data-baru="">{baru}</span>
              </span>
            ))}
          </div>
          <div className="lyr-baris-unggah" data-mati="">
            <Centang />
            <span className="min-w-0">
              <strong>Pegawai Lain</strong>
              <small>199107192014011018</small>
            </span>
            <span className="min-w-0">
              <Tanda anak="Ditolak" nada="merah" />
              <small className="lyr-merah">
                NIP ini tercatat di Lembaga Pemasyarakatan Kelas IIA Banjarmasin. Mintakan pemindahannya lewat Kanwil.
              </small>
            </span>
            <No n={4} />
          </div>
          <div className="lyr-kaki">
            <small>3 baris dicentang, 3 di antaranya masih perlu dilengkapi.</small>
            <span className="lyr-kaki-sorot">
              <Tombol anak="Simpan 3 baris" />
              <No n={5} />
            </span>
          </div>
        </>
      }
    />
  );
}

/* ── 6. Usul KGB Kolektif, langkah 1: pilih pegawai ──────────────────────── */

export function LayarKolektif1({ namaBulan }: { namaBulan: string }) {
  return (
    <Layar
      jalur="Usul KGB Kolektif"
      judul="Langkah 1: Pilih pegawai"
      keterangan={[
        `Saringan Jatuh tempo TMT ${namaBulan} sudah terpilih: inilah pegawai yang harus diusulkan periode ini.`,
        "Pegawai dikelompokkan per bulan TMT. Tombol Pilih semua mencentang satu kelompok sekaligus.",
        "Tanda pada kartu: ada draf berarti sudah pernah Anda siapkan; dikembalikan berarti Kanwil meminta perbaikan; ditinjau Kanwil berarti sedang diproses dan tidak dapat dipilih.",
        "Jumlah yang dipilih, lalu lanjut ke langkah berikutnya.",
      ]}
      anak={
        <>
          <Langkah
            aktif={1}
            daftar={[
              ["Pilih pegawai", "5 dipilih"],
              ["Lengkapi data & berkas", "belum disusun"],
              ["Ajukan dengan surat", "simpan draf dulu"],
            ]}
          />
          <div className="lyr-alat">
            <span className="lyr-segmen">
              <span data-aktif="">
                Jatuh tempo TMT {namaBulan} <b>5</b>
              </span>
              <span>
                Ada draf <b>2</b>
              </span>
              <span>
                Semua <b>34</b>
              </span>
            </span>
            <No n={1} />
          </div>
          <div className="lyr-kelompok">
            <p className="lyr-kelompok-kepala">
              <strong>TMT {namaBulan}</strong>
              <Tanda anak="periode ini" nada="kuning" />
              <small>5 pegawai</small>
              <span className="lyr-tautan">Pilih semua</span>
              <No n={2} />
            </p>
            <div className="lyr-kartu-pilih">
              {(
                [
                  ["Pegawai Satu", "II/a", "ada draf", "kuning"],
                  ["Pegawai Dua", "III/b", "dikembalikan", "merah"],
                  ["Pegawai Tiga", "II/c", "ditinjau Kanwil", "biru"],
                ] as [string, string, string, "kuning" | "merah" | "biru"][]
              ).map(([nama, gol, tanda, nada], i) => (
                <span key={nama} className="lyr-kartu-p" data-pilih={i < 2 ? "" : undefined} data-mati={i === 2 ? "" : undefined}>
                  <Centang isi={i < 2} />
                  <span className="min-w-0">
                    <strong>{nama}</strong>
                    <small>19900101202506100{i + 1}</small>
                    <span className="lyr-kartu-tanda">
                      <Tanda anak={gol} />
                      <Tanda anak={tanda} nada={nada} />
                    </span>
                  </span>
                  {i === 2 && <No n={3} />}
                </span>
              ))}
            </div>
          </div>
          <div className="lyr-kaki">
            <small>
              <b>5</b> pegawai dipilih.
            </small>
            <span className="lyr-kaki-sorot">
              <Tombol anak="Lanjut: lengkapi 5 →" />
              <No n={4} />
            </span>
          </div>
        </>
      }
    />
  );
}

/* ── 7. Usul KGB Kolektif, langkah 2: lengkapi data dan berkas ───────────── */

export function LayarKolektif2() {
  return (
    <Layar
      jalur="Usul KGB Kolektif"
      judul="Langkah 2: Lengkapi data & berkas"
      keterangan={[
        "Daftar pegawai yang Anda pilih. Lingkaran di sebelah nama menunjukkan seberapa lengkap isiannya; kerjakan satu per satu sampai penuh. Bila lebih dari delapan pegawai, ada kotak cari dan saringan Kurang/Lengkap.",
        "Pilih dulu keadaannya. Belum pernah KGB hanya meminta TMT CPNS dan masa kerjanya 0 tahun 0 bulan.",
        "Salin golongan dan masa kerja golongan dari SK, jangan dihitung sendiri. Isian yang Anda ubah ditandai kuning.",
        "Gaji pokok dan TMT KGB berikutnya dihitung sistem dari tabel PP 5/2024. Keduanya tidak diketik, sebab salah ketik di sini langsung menggeser uang.",
        "Jawab untuk tiap pegawai: sesudah SK KGB terakhir, adakah SK kenaikan pangkat, penyesuaian ijazah, atau PMK yang belum tercatat? Bila ada, isi SK-nya. Baris di bawahnya menunjukkan SK yang akan menjadi Atas dasar SK KGB berikutnya.",
        "Unggah pindaian SK, masing-masing PDF paling besar 500 KB. Pindai sebagai dokumen, bukan foto kamera.",
      ]}
      catatan="Semua isian di sini tersimpan sebagai draf usulan milik satker Anda: belum terlihat Kanwil dan belum mengubah data pegawai di SIM-KGB, boleh ditinggal dan dilanjutkan kapan saja. Data Pegawai berubah setelah usulannya disetujui Kanwil."
      anak={
        <>
          <Langkah
            aktif={2}
            daftar={[
              ["Pilih pegawai", "5 dipilih"],
              ["Lengkapi data & berkas", "3/5 lengkap"],
              ["Ajukan dengan surat", "simpan draf dulu"],
            ]}
          />
          <div className="lyr-dua">
            <div className="lyr-sisi">
              {(
                [
                  ["Pegawai Satu", "Lengkap", 4, 4],
                  ["Pegawai Dua", "Kurang 2", 2, 4],
                  ["Pegawai Tiga", "Tersimpan", 4, 4],
                ] as [string, string, number, number][]
              ).map(([nama, keadaan, isi, dari], i) => (
                <span key={nama} className="lyr-sisi-butir" data-aktif={i === 1 ? "" : undefined}>
                  <span className="lyr-lingkar" aria-hidden="true" data-penuh={isi === dari ? "" : undefined}>
                    {isi}/{dari}
                  </span>
                  <span className="min-w-0">
                    <strong>{nama}</strong>
                    <small>{keadaan}</small>
                  </span>
                </span>
              ))}
              <No n={1} />
            </div>
            <div className="lyr-detail">
              <p className="lyr-sub">
                Keadaan KGB <No n={2} />
              </p>
              <span className="lyr-pilihan">
                <span data-aktif="">Sudah pernah KGB</span>
                <span>Belum pernah KGB</span>
              </span>

              <p className="lyr-sub">
                Dasar gaji <small>isian yang berubah ditandai kuning</small> <No n={3} />
              </p>
              <div className="lyr-isian">
                <span className="lyr-medan">
                  <small>Golongan ruang</small>
                  <span className="lyr-kotak" data-beda="">
                    III/a
                  </span>
                </span>
                <span className="lyr-medan">
                  <small>Masa kerja golongan</small>
                  <span className="lyr-kotak">16 tahun 0 bulan</span>
                </span>
                <span className="lyr-medan">
                  <small>TMT KGB terakhir</small>
                  <span className="lyr-kotak">01/06/2026</span>
                </span>
                <span className="lyr-medan">
                  <small>Nomor SK KGB terakhir</small>
                  <span className="lyr-kotak">Sesuai SK</span>
                </span>
                <span className="lyr-medan">
                  <small>Oleh (pejabat penetap)</small>
                  <span className="lyr-kotak">Sesuai SK</span>
                </span>
              </div>
              <div className="lyr-hitung">
                <span>
                  <small>Gaji pokok</small>
                  <strong>Rp3.570.100</strong>
                </span>
                <span>
                  <small>KGB berikutnya</small>
                  <strong>1 Juni 2028</strong>
                </span>
                <No n={4} />
              </div>

              <p className="lyr-sub">
                SK sesudah SK KGB terakhir <No n={5} />
              </p>
              <span className="lyr-pilihan">
                <span>Tidak ada</span>
                <span data-aktif="">Ada</span>
              </span>
              <div className="lyr-sebab">
                {(
                  [
                    ["Kenaikan pangkat", "termasuk penyesuaian ijazah"],
                    ["Peninjauan masa kerja", "SK PMK"],
                  ] as [string, string][]
                ).map(([j, k], i) => (
                  <span key={j} className="lyr-sebab-butir" data-aktif={i === 0 ? "" : undefined}>
                    <span className="lyr-titik-radio" aria-hidden="true" />
                    <span>
                      <strong>{j}</strong>
                      <small>{k}</small>
                    </span>
                  </span>
                ))}
              </div>

              <p className="lyr-sub">
                Berkas pendukung <No n={6} />
              </p>
              <div className="lyr-berkas">
                <span className="lyr-berkas-kotak" data-isi="">
                  <span className="lyr-berkas-ikon">PDF</span>
                  <span className="min-w-0">
                    <strong>SK KGB terakhir</strong>
                    <small>sk-kgb-2026.pdf · 480 KB</small>
                  </span>
                  <span className="lyr-tautan">Ganti</span>
                </span>
                <span className="lyr-berkas-kotak">
                  <span className="lyr-berkas-ikon">+</span>
                  <span className="min-w-0">
                    <strong>SK kenaikan pangkat</strong>
                    <small>Tarik PDF ke sini atau klik untuk memilih</small>
                  </span>
                  <span className="lyr-tautan">Pilih</span>
                </span>
              </div>
            </div>
          </div>
          <div className="lyr-kaki">
            <small>
              <b>3</b> dari 5 lengkap · <b>2</b> belum disimpan.
            </small>
            <span className="lyr-kaki-sorot">
              <Tombol jenis="garis" anak="Simpan 2 draf usulan" />
              <Tombol anak="Simpan & lanjut ajukan →" />
            </span>
          </div>
        </>
      }
    />
  );
}

/* ── 8. Usul KGB Kolektif, langkah 3: ajukan dengan satu surat ───────────── */

export function LayarKolektif3() {
  return (
    <Layar
      jalur="Usul KGB Kolektif"
      judul="Langkah 3: Ajukan dengan surat"
      keterangan={[
        "Centang pegawai yang ikut pada surat ini. Yang belum lengkap tidak dapat dicentang, dan kekurangannya disebutkan.",
        "Nomor dan tanggal surat usulan yang sudah Anda kirim lewat Srikandi. Satu surat berlaku untuk semua pegawai di daftar ini.",
        "Unggah satu salinan PDF surat itu; berlaku untuk seluruh pegawai pada surat yang sama.",
        "Tekan tombol ini sesudah suratnya benar-benar terkirim lewat Srikandi.",
      ]}
      catatan="Sesudah diajukan, usulannya pindah ke kolom Di Kanwil dan tidak lagi dapat disunting. Yang telanjur salah dapat dibatalkan dengan Batalkan usulan selama Kanwil belum meninjaunya."
      anak={
        <>
          <Langkah
            aktif={3}
            daftar={[
              ["Pilih pegawai", "5 dipilih"],
              ["Lengkapi data & berkas", "5/5 lengkap"],
              ["Ajukan dengan surat", "4 siap diajukan"],
            ]}
          />
          <div className="lyr-dua">
            <div className="lyr-sisi lyr-sisi-lebar">
              <p className="lyr-kelompok-kepala">
                <strong>Pegawai pada surat ini</strong>
                <small>4 dipilih dari 5</small>
              </p>
              {(
                [
                  ["Pegawai Satu", "Siap diajukan", true],
                  ["Pegawai Dua", "Belum lengkap: SK CPNS", false],
                ] as [string, string, boolean][]
              ).map(([nama, ket, siap]) => (
                <span key={nama} className="lyr-kartu-p" data-pilih={siap ? "" : undefined} data-mati={siap ? undefined : ""}>
                  <Centang isi={siap} />
                  <span className="min-w-0">
                    <strong>{nama}</strong>
                    <small className={siap ? "lyr-hijau" : "lyr-merah"}>{ket}</small>
                  </span>
                </span>
              ))}
              <No n={1} />
            </div>
            <div className="lyr-detail">
              <p className="lyr-sub">Surat usulan Srikandi</p>
              <div className="lyr-isian">
                <span className="lyr-medan">
                  <small>Nomor surat</small>
                  <span className="lyr-kotak">W.19.PAS.7-KP.04.03-1</span>
                </span>
                <span className="lyr-medan">
                  <small>Tanggal surat</small>
                  <span className="lyr-kotak">08/09/2026</span>
                </span>
                <No n={2} />
              </div>
              <span className="lyr-berkas-kotak">
                <span className="lyr-berkas-ikon">+</span>
                <span className="min-w-0">
                  <strong>Berkas surat (PDF, paling besar 500 KB)</strong>
                  <small>Surat yang sudah dikirim lewat Srikandi; berlaku untuk semua pegawai.</small>
                </span>
                <span className="lyr-tautan">Pilih</span>
                <No n={3} />
              </span>
              <p className="lyr-info">
                <b>4</b> pegawai akan diusulkan ke Kanwil dengan surat <b>W.19.PAS.7-KP.04.03-1</b>. Selama ditinjau,
                datanya terkunci.
              </p>
            </div>
          </div>
          <div className="lyr-kaki">
            <Tombol jenis="garis" anak="← Lengkapi" />
            <span className="lyr-kaki-sorot">
              <Tombol anak="Ajukan 4 pegawai ke Kanwil" />
              <No n={4} />
            </span>
          </div>
        </>
      }
    />
  );
}

/* ── 9. SK terbit: unduh lalu rekam di Gaji Web ────────────────────────── */

export function LayarSkTerbit() {
  return (
    <Layar
      jalur="Dashboard › Alur KGB › SK terbit"
      judul="SK sudah ditandatangani dan siap direkam"
      keterangan={[
        "Tanda Siap direkam di Gaji Web berarti berkas SK-nya sudah diunggah Tim SDM. Bila masih Menunggu berkas SK, tunggu Kanwil mengunggahnya.",
        "Unduh SK, lalu rekam KGB-nya di Gaji Web satker Anda seperti biasa.",
        "Baru setelah benar-benar direkam, tekan tombol ini.",
        "Pilih apakah KGB ini dibayar sebagai rapelan. Bila batas input Kanwil terlewat, sistem sudah menandainya berpotensi rapelan.",
      ]}
      catatan="Menyimpan di jendela ini sekaligus menjadi konfirmasi keuangan: gaji pokok, masa kerja golongan, dan jadwal KGB berikutnya pegawai diperbarui, dan tidak dapat dibatalkan dari sini."
      anak={
        <>
          <div className="lyr-kartu-sk">
            <strong>Pegawai Satu</strong>
            <small>TMT 1 Juni 2026 · II/a · Rp2.184.000</small>
            <span className="lyr-kartu-tanda">
              <Tanda anak="Siap direkam di Gaji Web" nada="hijau" />
              <No n={1} />
            </span>
            <span className="lyr-kartu-aksi">
              <span className="lyr-sorot-bungkus">
                <Tombol anak="Unduh SK" />
                <No n={2} />
              </span>
              <span className="lyr-sorot-bungkus">
                <Tombol jenis="garis" anak="Sudah direkam di Gaji Web" />
                <No n={3} />
              </span>
            </span>
          </div>
          <div className="lyr-modal">
            <p className="lyr-modal-judul">
              Sudah direkam di Gaji Web
              <small>Pegawai Satu · TMT 1 Juni 2026</small>
            </p>
            <span className="lyr-pilihan">
              <span data-aktif="">Tidak rapelan</span>
              <span>Dibayar sebagai rapelan</span>
              <No n={4} />
            </span>
            <div className="lyr-modal-kaki">
              <Tombol jenis="garis" anak="Batal" />
              <Tombol anak="Simpan" />
            </div>
          </div>
        </>
      }
    />
  );
}
