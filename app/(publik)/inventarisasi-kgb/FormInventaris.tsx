"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { GOLONGAN_PANGKAT, getGajiPokok } from "@/lib/tabelGaji";
import {
  BATAS_BERKAS_INVENTARIS_BYTE,
  BERKAS_KEADAAN,
  FOLDER_KEADAAN,
  LABEL_KEADAAN,
  namaBerkasInventaris,
  namaFolderPegawai,
  periksaIsianInventaris,
  tanggalUntukBerkas,
  type AturanBerkas,
  type IsianInventaris,
  type JenisBerkasInventaris,
  type KeadaanKgb,
} from "@/lib/inventarisKgb";

/* Formulir inventarisasi data KGB pegawai Kanwil. Dikirim ke POST /api/public/inventarisasi, yang memeriksa
   ulang kode akses, isian, dan berkas PDF sebelum menyimpannya di SIM-KGB (lib/inventarisServer.ts).

   Tata letak: di layar lebar formulir di kiri dan panel ringkasan lengket di kanan (kelengkapan, letak simpan,
   tombol kirim); di ponsel satu kolom dengan ringkasan di akhir. Isian yang kurang ditandai setelah pengguna
   mencoba mengirim, bukan sejak awal. */

const KOSONG: IsianInventaris = {
  keadaan: "pernah",
  nip: "",
  nama: "",
  tempatLahir: "",
  tanggalLahir: "",
  jabatan: "",
  bidang: "",
  golonganRuang: "",
  tmtGolongan: "",
  mkgTahun: "",
  mkgBulan: "",
  tmtDasar: "",
  nomorSkDasar: "",
  tanggalSkDasar: "",
  tanggalSkPendukung: "",
  nomorWa: "",
  catatan: "",
};

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);
const ukuran = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

type Tahap = { tahap: "isi" } | { tahap: "kirim" } | { tahap: "selesai"; kirimanKe: number; nama: string };

/** Galat satu berkas terpilih; null bila sah. */
function galatBerkas(f: File | undefined, aturan: AturanBerkas): string | null {
  if (!f) return aturan.wajib ? `${aturan.label} wajib dilampirkan` : null;
  if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return `${aturan.label} harus berupa PDF`;
  if (f.size > BATAS_BERKAS_INVENTARIS_BYTE) return `${aturan.label} ${ukuran(f.size)}, lebih dari 1 MB`;
  return null;
}

export default function FormInventaris() {
  const id = useId();
  const [kode, setKode] = useState("");
  const [isian, setIsian] = useState<IsianInventaris>(KOSONG);
  const [berkas, setBerkas] = useState<Partial<Record<JenisBerkasInventaris, File>>>({});
  const [setuju, setSetuju] = useState(false);
  const [galat, setGalat] = useState<string[]>([]);
  const [dicoba, setDicoba] = useState(false);
  const [tahap, setTahap] = useState<Tahap>({ tahap: "isi" });
  const [pratinjau, setPratinjau] = useState<{ judul: string; url: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const ubah = <K extends keyof IsianInventaris>(k: K, v: IsianInventaris[K]) => setIsian((s) => ({ ...s, [k]: v }));
  const pernah = isian.keadaan === "pernah";
  const daftarBerkas = BERKAS_KEADAAN[isian.keadaan];
  const nipSah = /^\d{18}$/.test(isian.nip);

  // URL pratinjau untuk tiap berkas terpilih; dicabut saat berkasnya berganti agar memori dilepas.
  const urlBerkas = useMemo(() => {
    const peta: Partial<Record<JenisBerkasInventaris, string>> = {};
    for (const [jenis, f] of Object.entries(berkas)) if (f) peta[jenis as JenisBerkasInventaris] = URL.createObjectURL(f);
    return peta;
  }, [berkas]);
  useEffect(() => () => Object.values(urlBerkas).forEach((u) => u && URL.revokeObjectURL(u)), [urlBerkas]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (pratinjau && !d.open) d.showModal();
    if (!pratinjau && d.open) d.close();
  }, [pratinjau]);

  const gaji = useMemo(() => {
    if (!isian.golonganRuang) return 0;
    return getGajiPokok(isian.golonganRuang, pernah ? Number(isian.mkgTahun || "0") : 0, pernah ? Number(isian.mkgBulan || "0") : 0);
  }, [isian.golonganRuang, isian.mkgTahun, isian.mkgBulan, pernah]);

  /* Kelengkapan per bagian, untuk panel ringkasan. */
  const lengkap = {
    kode: kode.trim().length >= 4,
    identitas:
      nipSah && isian.nama.trim().length >= 3 && isian.tempatLahir.trim().length >= 3 && TANGGAL.test(isian.tanggalLahir) && isian.jabatan.trim().length >= 2,
    pangkat:
      !!isian.golonganRuang &&
      TANGGAL.test(isian.tmtGolongan) &&
      TANGGAL.test(isian.tmtDasar) &&
      !!isian.nomorSkDasar.trim() &&
      TANGGAL.test(isian.tanggalSkDasar) &&
      (!pernah || (/^\d{1,2}$/.test(isian.mkgTahun) && TANGGAL.test(isian.tanggalSkPendukung))),
    berkas: daftarBerkas.every((b) => !galatBerkas(berkas[b.jenis], b)),
    setuju,
  };
  const daftarLengkap: [keyof typeof lengkap, string][] = [
    ["kode", "Kode akses"],
    ["identitas", "Identitas"],
    ["pangkat", pernah ? "Pangkat dan KGB terakhir" : "Pangkat dan pengangkatan"],
    ["berkas", "Berkas SK"],
    ["setuju", "Pernyataan"],
  ];
  const jumlahLengkap = daftarLengkap.filter(([k]) => lengkap[k]).length;

  function pilihBerkas(jenis: JenisBerkasInventaris, f: File | null | undefined) {
    setBerkas((b) => {
      const baru = { ...b };
      if (f) baru[jenis] = f;
      else delete baru[jenis];
      return baru;
    });
  }

  function gantiKeadaan(k: KeadaanKgb) {
    setIsian((s) => ({ ...s, keadaan: k }));
    setBerkas({});
  }

  /** Pratinjau PDF: jendela dalam halaman di layar lebar; tab baru di ponsel, yang umumnya tidak menampilkan PDF dalam halaman. */
  function lihat(judul: string, url: string) {
    if (window.matchMedia("(max-width: 760px), (pointer: coarse)").matches) window.open(url, "_blank", "noopener");
    else setPratinjau({ judul, url });
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setDicoba(true);
    const kurang = periksaIsianInventaris(isian);
    if (!lengkap.kode) kurang.unshift("kode akses dari grup WA");
    for (const b of daftarBerkas) {
      const g = galatBerkas(berkas[b.jenis], b);
      if (g) kurang.push(g);
    }
    if (!setuju) kurang.push("centang pernyataan kebenaran data");
    setGalat(kurang);
    if (kurang.length > 0) {
      document.getElementById(`${id}-galat`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    setTahap({ tahap: "kirim" });
    try {
      const form = new FormData();
      form.set("kode", kode.trim());
      for (const [k, v] of Object.entries(isian)) form.set(k, String(v));
      for (const b of daftarBerkas) {
        const f = berkas[b.jenis];
        if (f) form.set(b.jenis, f);
      }
      const res = await fetch("/api/public/inventarisasi", { method: "POST", body: form });
      const hasil = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; kurang?: string[]; kirimanKe?: number }
        | null;
      if (!hasil?.ok) {
        setGalat(hasil?.kurang?.length ? hasil.kurang : [hasil?.error ?? "Kiriman gagal. Periksa koneksi, lalu coba lagi."]);
        setTahap({ tahap: "isi" });
        document.getElementById(`${id}-galat`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      setTahap({ tahap: "selesai", kirimanKe: hasil.kirimanKe ?? 1, nama: isian.nama.trim() });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setGalat(["Kiriman gagal. Periksa koneksi, lalu coba lagi."]);
      setTahap({ tahap: "isi" });
    }
  }

  if (tahap.tahap === "selesai") {
    return (
      <div className="iv-selesai" role="status">
        <span className="iv-selesai-ikon" aria-hidden="true">✓</span>
        <h2>Terima kasih, data {tahap.nama} sudah terkirim</h2>
        <p>
          {tahap.kirimanKe > 1
            ? `Ini kiriman ke-${tahap.kirimanKe}; kiriman sebelumnya sudah digantikan.`
            : "Tim SDM Kanwil akan memperbarui data KGB Anda di SIM-KGB."}{" "}
          Bila ada yang keliru, isi ulang formulir ini; kiriman terakhir yang dipakai.
        </p>
        <div className="iv-selesai-aksi">
          <a href="/kgb" className="iv-tombol">Cek status KGB</a>
          <button
            type="button"
            className="iv-tombol"
            data-jenis="garis"
            onClick={() => {
              setIsian(KOSONG);
              setBerkas({});
              setSetuju(false);
              setDicoba(false);
              setGalat([]);
              setTahap({ tahap: "isi" });
            }}
          >
            Isi untuk pegawai lain
          </button>
        </div>
      </div>
    );
  }

  const mengirim = tahap.tahap === "kirim";

  /** Satu isian. `salah` menandai isian bila pengguna sudah mencoba mengirim. */
  const bidang = (opsi: {
    label: string;
    wajib?: boolean;
    lebar?: boolean;
    bantuan?: ReactNode;
    salah?: boolean;
    children: ReactNode;
  }) => (
    <label className="iv-bidang" data-lebar={opsi.lebar ? "" : undefined} data-salah={dicoba && opsi.salah ? "" : undefined}>
      <span className="iv-label" data-wajib={opsi.wajib === false ? undefined : ""}>{opsi.label}</span>
      {opsi.children}
      {opsi.bantuan && <span className="iv-bantu">{opsi.bantuan}</span>}
    </label>
  );
  const teks = (k: keyof IsianInventaris, placeholder?: string, mode?: "numeric" | "tel") => (
    <input
      className="iv-isian"
      inputMode={mode}
      placeholder={placeholder}
      value={String(isian[k])}
      onChange={(e) => ubah(k, (mode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value) as never)}
    />
  );
  const tanggal = (k: keyof IsianInventaris) => (
    <input type="date" className="iv-isian" value={String(isian[k])} onChange={(e) => ubah(k, e.target.value as never)} />
  );
  const kosongTeks = (k: keyof IsianInventaris, min = 1) => String(isian[k]).trim().length < min;
  const salahTanggal = (k: keyof IsianInventaris) => !TANGGAL.test(String(isian[k]));

  return (
    <div className="iv-tata">
      <form className="iv-form" id={`${id}-form`} onSubmit={kirim} noValidate aria-busy={mengirim}>
        <fieldset className="iv-kelompok" disabled={mengirim}>
          <legend><span className="iv-nomor">1</span>Kode akses</legend>
          {bidang({
            label: "Kode dari pengumuman grup WA pegawai Kanwil",
            salah: !lengkap.kode,
            children: (
              <input className="iv-isian iv-kode" autoComplete="off" spellCheck={false} value={kode} onChange={(e) => setKode(e.target.value.toUpperCase().replace(/\s/g, ""))} />
            ),
          })}
        </fieldset>

        <fieldset className="iv-kelompok" disabled={mengirim}>
          <legend><span className="iv-nomor">2</span>Keadaan KGB Anda</legend>
          <div className="iv-pilihan" role="radiogroup" aria-label="Keadaan KGB">
            {(["pernah", "belum"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={isian.keadaan === k} className="iv-opsi" onClick={() => gantiKeadaan(k)}>
                <span className="iv-opsi-titik" aria-hidden="true" />
                <span className="iv-opsi-teks">
                  <strong>{LABEL_KEADAAN[k]}</strong>
                  <span>
                    {k === "pernah"
                      ? "Sudah menerima SK kenaikan gaji berkala setidaknya sekali."
                      : "CPNS atau PNS baru yang belum pernah menerima SK KGB."}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="iv-kelompok" disabled={mengirim}>
          <legend><span className="iv-nomor">3</span>Identitas</legend>
          <div className="iv-kisi">
            {bidang({ label: "NIP", salah: !nipSah, bantuan: dicoba && !nipSah ? "NIP terdiri atas 18 angka." : undefined, children: teks("nip", "18 angka", "numeric") })}
            {bidang({ label: "Tanggal lahir", salah: salahTanggal("tanggalLahir"), children: tanggal("tanggalLahir") })}
            {bidang({ label: "Nama lengkap dengan gelar", lebar: true, salah: kosongTeks("nama", 3), children: teks("nama", "Sesuai SK terakhir") })}
            {bidang({
              label: "Tempat lahir",
              salah: kosongTeks("tempatLahir", 3),
              bantuan: "Dipakai untuk cek status KGB di situs ini.",
              children: teks("tempatLahir", "mis. Banjarmasin"),
            })}
            {bidang({
              label: "Nomor WhatsApp",
              wajib: false,
              bantuan: "Untuk dihubungi bila ada data yang perlu dicocokkan.",
              children: teks("nomorWa", "08…", "tel"),
            })}
            {bidang({ label: "Jabatan", lebar: true, salah: kosongTeks("jabatan", 2), children: teks("jabatan", "mis. Analis SDM Aparatur Ahli Pertama") })}
            {bidang({ label: "Bidang/Bagian", wajib: false, lebar: true, children: teks("bidang", "mis. Bagian Tata Usaha dan Umum") })}
          </div>
        </fieldset>

        <fieldset className="iv-kelompok" disabled={mengirim}>
          <legend><span className="iv-nomor">4</span>{pernah ? "Pangkat dan KGB terakhir" : "Pangkat dan pengangkatan"}</legend>
          <div className="iv-kisi">
            {bidang({
              label: "Golongan ruang",
              salah: !isian.golonganRuang,
              children: (
                <select className="iv-isian" value={isian.golonganRuang} onChange={(e) => ubah("golonganRuang", e.target.value)}>
                  <option value="">Pilih golongan</option>
                  {Object.entries(GOLONGAN_PANGKAT).map(([g, p]) => (
                    <option key={g} value={g}>{g} · {p}</option>
                  ))}
                </select>
              ),
            })}
            {bidang({ label: "TMT golongan", salah: salahTanggal("tmtGolongan"), bantuan: "Dari SK pangkat yang berlaku sekarang.", children: tanggal("tmtGolongan") })}
            {pernah ? (
              <>
                {bidang({ label: "TMT KGB terakhir", salah: salahTanggal("tmtDasar"), children: tanggal("tmtDasar") })}
                {bidang({
                  label: "Masa kerja golongan pada SK KGB terakhir",
                  salah: !/^\d{1,2}$/.test(isian.mkgTahun),
                  children: (
                    <span className="iv-mkg">
                      <span className="iv-satuan">
                        <input className="iv-isian" inputMode="numeric" aria-label="Tahun" placeholder="0" value={isian.mkgTahun} onChange={(e) => ubah("mkgTahun", e.target.value.replace(/\D/g, "").slice(0, 2))} />
                        <span>tahun</span>
                      </span>
                      <span className="iv-satuan">
                        <input className="iv-isian" inputMode="numeric" aria-label="Bulan" placeholder="0" value={isian.mkgBulan} onChange={(e) => ubah("mkgBulan", e.target.value.replace(/\D/g, "").slice(0, 2))} />
                        <span>bulan</span>
                      </span>
                    </span>
                  ),
                })}
                {bidang({ label: "Nomor SK KGB terakhir", lebar: true, salah: kosongTeks("nomorSkDasar"), children: teks("nomorSkDasar", "Sesuai SK") })}
                {bidang({ label: "Tanggal SK KGB terakhir", salah: salahTanggal("tanggalSkDasar"), children: tanggal("tanggalSkDasar") })}
                {bidang({
                  label: "Tanggal SK kenaikan pangkat terakhir",
                  salah: salahTanggal("tanggalSkPendukung"),
                  bantuan: "Belum pernah naik pangkat? Isi tanggal SK CPNS.",
                  children: tanggal("tanggalSkPendukung"),
                })}
              </>
            ) : (
              <>
                {bidang({ label: "TMT CPNS", salah: salahTanggal("tmtDasar"), children: tanggal("tmtDasar") })}
                {bidang({ label: "Tanggal SK CPNS", salah: salahTanggal("tanggalSkDasar"), children: tanggal("tanggalSkDasar") })}
                {bidang({ label: "Nomor SK CPNS", lebar: true, salah: kosongTeks("nomorSkDasar"), children: teks("nomorSkDasar", "Sesuai SK") })}
                {bidang({ label: "Tanggal SK PNS", wajib: false, bantuan: "Kosongkan bila SK PNS belum terbit.", children: tanggal("tanggalSkPendukung") })}
              </>
            )}
          </div>
          {gaji > 0 && (
            <p className="iv-gaji">
              Gaji pokok menurut PP 5/2024 untuk isian ini: <strong>{rupiah(gaji)}</strong>. Bila berbeda dengan SK Anda,
              periksa kembali golongan dan masa kerja golongan.
            </p>
          )}
        </fieldset>

        <fieldset className="iv-kelompok" disabled={mengirim}>
          <legend><span className="iv-nomor">5</span>Berkas SK</legend>
          <p className="iv-bantu iv-lepas">PDF hasil pindai, paling besar 1 MB per berkas. Tarik berkas ke kotaknya atau pilih dari perangkat.</p>
          <div className="iv-berkas">
            {daftarBerkas.map((b) => (
              <KartuBerkas
                key={b.jenis}
                aturan={b}
                berkas={berkas[b.jenis]}
                url={urlBerkas[b.jenis]}
                namaSimpan={nipSah ? namaBerkasInventaris(isian.nip, b.jenis, tanggalUntukBerkas(isian, b.jenis)) : null}
                salah={dicoba ? galatBerkas(berkas[b.jenis], b) : null}
                onPilih={(f) => pilihBerkas(b.jenis, f)}
                onLihat={(url) => lihat(b.label, url)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="iv-kelompok" disabled={mengirim}>
          <legend><span className="iv-nomor">6</span>Catatan dan pernyataan</legend>
          {bidang({
            label: "Catatan untuk Tim SDM",
            wajib: false,
            children: (
              <textarea className="iv-isian" rows={3} value={isian.catatan} onChange={(e) => ubah("catatan", e.target.value)} placeholder="mis. SK kenaikan pangkat terbaru masih dalam proses" />
            ),
          })}
          <label className="iv-setuju" data-salah={dicoba && !setuju ? "" : undefined}>
            <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
            <span>Data dan berkas yang saya kirim benar dan sesuai dengan SK asli.</span>
          </label>
        </fieldset>
      </form>

      <aside className="iv-ringkas" aria-label="Ringkasan kiriman">
        <p className="iv-ringkas-judul">Kelengkapan</p>
        <div className="iv-kemajuan" aria-hidden="true">
          <span style={{ transform: `scaleX(${jumlahLengkap / daftarLengkap.length})` }} />
        </div>
        <ul className="iv-cek-daftar">
          {daftarLengkap.map(([k, label]) => (
            <li key={k} data-ok={lengkap[k] ? "" : undefined}>
              <span className="iv-cek-tanda" aria-hidden="true">{lengkap[k] ? "✓" : ""}</span>
              {label}
              <span className="pub-visually-hidden">{lengkap[k] ? " lengkap" : " belum lengkap"}</span>
            </li>
          ))}
        </ul>

        <div className="iv-simpan">
          <p className="iv-ringkas-judul">Disimpan sebagai</p>
          {nipSah && isian.nama.trim() ? (
            <>
              <p className="iv-jalur">
                {FOLDER_KEADAAN[isian.keadaan]} / <strong>{namaFolderPegawai(isian.nip, isian.nama)}</strong>
              </p>
              <ul className="iv-jalur-berkas">
                {daftarBerkas.map((b) => (
                  <li key={b.jenis} data-ada={berkas[b.jenis] ? "" : undefined}>
                    {namaBerkasInventaris(isian.nip, b.jenis, tanggalUntukBerkas(isian, b.jenis))}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="iv-bantu">Muncul setelah NIP dan nama diisi.</p>
          )}
        </div>

        {galat.length > 0 && (
          <div className="iv-galat" id={`${id}-galat`} role="alert">
            <strong>Periksa kembali:</strong>
            <ul>{galat.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        )}

        <button type="submit" form={`${id}-form`} className="iv-tombol iv-tombol-kirim" disabled={mengirim}>
          {mengirim ? "Mengirim…" : "Kirim data"}
        </button>
        <p className="iv-bantu">Data dan berkas disimpan di SIM-KGB dan hanya dipakai Tim SDM Kanwil untuk memperbarui data KGB Anda.</p>
      </aside>

      <dialog ref={dialogRef} className="iv-dialog" onClose={() => setPratinjau(null)} aria-label={pratinjau ? `Pratinjau ${pratinjau.judul}` : "Pratinjau berkas"}>
        {pratinjau && (
          <>
            <div className="iv-dialog-kepala">
              <strong>{pratinjau.judul}</strong>
              <button type="button" className="iv-dialog-tutup" onClick={() => setPratinjau(null)} aria-label="Tutup pratinjau">×</button>
            </div>
            <iframe src={pratinjau.url} title={`Pratinjau ${pratinjau.judul}`} className="iv-dialog-bingkai" />
          </>
        )}
      </dialog>
    </div>
  );
}

/** Kartu satu berkas: kotak tarik-lepas, lalu nama, ukuran, dan tombol Lihat, Ganti, Hapus setelah dipilih. */
function KartuBerkas({
  aturan,
  berkas,
  url,
  namaSimpan,
  salah,
  onPilih,
  onLihat,
}: {
  aturan: AturanBerkas;
  berkas: File | undefined;
  url: string | undefined;
  namaSimpan: string | null;
  salah: string | null;
  onPilih: (f: File | null) => void;
  onLihat: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [seret, setSeret] = useState(false);
  const idInput = useId();

  function lepas(e: DragEvent) {
    e.preventDefault();
    setSeret(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPilih(f);
  }

  return (
    <div className="iv-kartu-berkas" data-isi={berkas ? "" : undefined} data-salah={salah ? "" : undefined}>
      <div className="iv-kartu-kepala">
        <label htmlFor={idInput} className="iv-label" data-wajib={aturan.wajib ? "" : undefined}>{aturan.label}</label>
        <span className="iv-bantu">{aturan.keterangan}</span>
      </div>
      <input
        ref={inputRef}
        id={idInput}
        type="file"
        accept="application/pdf"
        className="pub-visually-hidden"
        onChange={(e) => {
          onPilih(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {berkas ? (
        <div className="iv-terpilih">
          <span className="iv-pdf" aria-hidden="true">PDF</span>
          <span className="iv-terpilih-teks">
            <span className="iv-terpilih-nama" title={berkas.name}>{berkas.name}</span>
            <span className="iv-bantu">{ukuran(berkas.size)}{namaSimpan ? ` · disimpan sebagai ${namaSimpan}` : ""}</span>
          </span>
          <span className="iv-terpilih-aksi">
            {url && (
              <button type="button" className="iv-mini" onClick={() => onLihat(url)}>Lihat</button>
            )}
            <button type="button" className="iv-mini" onClick={() => inputRef.current?.click()}>Ganti</button>
            <button type="button" className="iv-mini" data-nada="merah" onClick={() => onPilih(null)} aria-label={`Hapus ${aturan.label}`}>Hapus</button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="iv-lepas-kotak"
          data-seret={seret ? "" : undefined}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setSeret(true);
          }}
          onDragLeave={() => setSeret(false)}
          onDrop={lepas}
        >
          <span className="iv-lepas-ikon" aria-hidden="true">↑</span>
          <span>
            <strong>Pilih berkas PDF</strong> atau tarik ke sini
          </span>
        </button>
      )}
      {salah && <span className="iv-galat-kecil">{salah}</span>}
    </div>
  );
}
