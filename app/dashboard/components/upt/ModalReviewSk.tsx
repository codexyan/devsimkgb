"use client";

import { useEffect, useRef, useState } from "react";
import { KerangkaModal, Catatan, DaftarData, PesanGalat } from "@/app/dashboard/components/kgb";
import { BidangAlasan, Memuat } from "@/app/dashboard/components/kgb/BidangForm";
import { ambilReviewSkUpt, pdfReviewSkUpt, tanggapiReviewSkUpt, type ReviewSkUntukUpt } from "@/lib/kgbAksi";
import { formatTanggalId } from "@/lib/waktu";

/* Review tampilan SK KGB oleh Admin UPT (ADR-077). Kanwil sudah membuat SK pegawai satker ini; Admin UPT memeriksa
   tampilannya sebelum SK dicetak, ditandatangani basah, dan dikirim lewat Srikandi. PDF pratinjaunya disusun di
   peramban dari isi yang sama dengan yang kelak dicetak Kanwil, dan selalu bertanda air DRAF. */

const rupiah = (n: number | null | undefined) => (typeof n === "number" ? `Rp${n.toLocaleString("id-ID")}` : "-");
const mkg = (tahun: number, bulan: number) => `${tahun} tahun ${bulan} bulan`;
const tgl = (t: unknown) => (t ? formatTanggalId(t as string) : "-");

export default function ModalReviewSk({
  kgbId,
  nama,
  onTutup,
  onSelesai,
}: {
  kgbId: string;
  nama: string;
  onTutup: () => void;
  /** Dipanggil setelah tanggapan tersimpan; induk menutup jendela dan memuat ulang dasbor. */
  onSelesai: (pesan: string) => void;
}) {
  const [data, setData] = useState<ReviewSkUntukUpt | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [mode, setMode] = useState<"periksa" | "perbaikan">("periksa");
  const [catatan, setCatatan] = useState("");
  const [sudahDiperiksa, setSudahDiperiksa] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let batal = false;
    async function muat() {
      const hasil = await ambilReviewSkUpt(kgbId);
      if (batal) return;
      if (!hasil.ok) {
        setGalat(hasil.error);
        return;
      }
      setData(hasil.data);
      const pdf = await pdfReviewSkUpt(hasil.data.surat);
      if (batal) return;
      if (!pdf.ok) {
        setGalat(pdf.error);
        return;
      }
      const alamat = URL.createObjectURL(pdf.data);
      urlRef.current = alamat;
      setUrl(alamat);
    }
    void muat();
    return () => {
      batal = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [kgbId]);

  async function kirim(keputusan: "setuju" | "perbaikan") {
    if (sibuk) return;
    if (keputusan === "perbaikan" && !catatan.trim()) {
      setGalat("Tulis apa yang perlu diperbaiki pada SK.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    const hasil = await tanggapiReviewSkUpt(kgbId, keputusan, catatan.trim());
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.error);
      return;
    }
    onSelesai(
      keputusan === "setuju"
        ? `SK KGB ${nama} dinyatakan sudah benar. Kanwil mencetaknya untuk ditandatangani dan dikirim lewat Srikandi.`
        : `Permintaan perbaikan SK KGB ${nama} dikirim ke Kanwil. Permintaan review baru muncul lagi setelah SK diperbaiki.`,
    );
  }

  const s = data?.surat;
  const review = data?.reviewSk;

  return (
    <KerangkaModal
      judul="Periksa SK KGB"
      subjudul={data ? `${data.pegawai.nama} · NIP ${data.pegawai.nip}` : nama}
      nada="navy"
      ukuran="lg"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void kirim(mode === "perbaikan" ? "perbaikan" : "setuju")}
      kaki={
        mode === "perbaikan" ? (
          <>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setMode("periksa")} disabled={sibuk}>
              Kembali
            </button>
            <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk || !catatan.trim()}>
              {sibuk ? "Mengirim..." : "Kirim permintaan perbaikan"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
              Tutup
            </button>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setMode("perbaikan")} disabled={sibuk || !s}>
              Minta perbaikan
            </button>
            <button type="submit" className="kgbm-tombol kgbm-hijau" disabled={sibuk || !s || !sudahDiperiksa}>
              {sibuk ? "Mengirim..." : "SK sudah benar"}
            </button>
          </>
        )
      }
    >
      <div className="kgbm-sk-grid">
        <div className="kgbm-kolom">
          <Catatan nada="navy">
            Kanwil sudah membuat SK KGB pegawai ini. Periksa nama, NIP, pangkat dan golongan, gaji pokok, masa kerja, serta TMT
            sebelum SK dicetak, ditandatangani basah, dan dikirim lewat Srikandi. Pratinjau di samping bertanda air DRAF.
          </Catatan>
          {data?.sesuaiUsulan && (
            <Catatan nada="hijau">
              Isi SK ini sama dengan usulan Anda yang disetujui Kanwil: golongan, masa kerja, gaji pokok, TMT, dan Atas dasar.
              Periksa tampilannya (nama, NIP, jabatan, satker, penandatangan), lalu tekan SK sudah benar.
            </Catatan>
          )}
          {data?.bedaUsulan && (
            <Catatan nada="amber">
              {data.bedaUsulan.alasan}
              {data.bedaUsulan.beda.length > 0 && (
                <ul className="kgbm-beda-usulan">
                  {data.bedaUsulan.beda.map((b) => (
                    <li key={b.label}>
                      <strong>{b.label}</strong>: usulan Anda {b.usulan}, SK {b.sk}
                    </li>
                  ))}
                </ul>
              )}
            </Catatan>
          )}
          {review && review.versi > 1 && (
            <Catatan nada="amber">SK ini sudah diperbaiki Kanwil sesudah permintaan perbaikan sebelumnya. Periksa lagi seluruhnya.</Catatan>
          )}
          {!s && !galat && <Memuat teks="Memuat SK..." />}
          {s && (
            <DaftarData
              judul="Isi SK"
              baris={[
                { label: "Nomor SK", nilai: `${s.nomorSurat}, ${tgl(s.tanggalSurat)}` },
                { label: "Pangkat dan golongan", nilai: `${s.pegawai.pangkat} (${s.pegawai.golonganRuang})` },
                { label: "Satker", nilai: s.satker.nama },
                { label: "Gaji pokok lama", nilai: rupiah(s.kgb.gajiPokokLama) },
                { label: "Gaji pokok baru", nilai: rupiah(s.kgb.gajiPokokBaru), nada: "hijau" },
                { label: "Masa kerja golongan baru", nilai: mkg(s.kgb.mkgTahunBaru, s.kgb.mkgBulanBaru) },
                { label: "TMT KGB", nilai: tgl(s.kgb.tmtKgbBaru) },
                { label: "KGB berikutnya", nilai: tgl(s.kgb.tmtKgbBerikutnya) },
                { label: "Atas dasar SK", nilai: `${s.kgb.nomorSK}, ${tgl(s.kgb.tanggalSK)} (${s.kgb.penetapSkDasar})` },
                { label: "Penandatangan", nilai: `${s.penandatangan.jabatan}, ${s.penandatangan.nama}` },
              ]}
            />
          )}
          {s && mode === "periksa" && (
            <label className="kgbm-cek">
              <input type="checkbox" checked={sudahDiperiksa} onChange={(e) => setSudahDiperiksa(e.target.checked)} disabled={sibuk} />
              <span>Saya sudah memeriksa isi SK ini dan datanya sesuai.</span>
            </label>
          )}
          {mode === "perbaikan" && (
            <>
              <BidangAlasan
                label="Apa yang perlu diperbaiki"
                wajib
                nilai={catatan}
                onUbah={setCatatan}
                placeholder="Contoh: golongan tertulis III/b, seharusnya III/c sesuai SK kenaikan pangkat terakhir"
                nonaktif={sibuk}
                fokusAwal
              />
              <Catatan>
                Kanwil memperbaiki SK sesuai catatan ini, lalu permintaan review baru muncul lagi di Perlu dikerjakan. Bila yang
                keliru adalah data pegawai (golongan, masa kerja, TMT), sebutkan juga dasarnya agar Kanwil dapat mencocokkannya.
              </Catatan>
            </>
          )}
          <PesanGalat pesan={galat} />
        </div>
        <div className="kgbm-pratinjau">
          <div className="kgbm-pratinjau-isi">
            {url ? <iframe src={url} title={`Pratinjau SK KGB ${nama}`} /> : !galat ? <Memuat teks="Menyusun pratinjau SK..." /> : null}
          </div>
          {url && (
            <div className="kgbm-baris-tombol">
              <a href={url} target="_blank" rel="noopener noreferrer" className="kgbm-tautan">
                Buka pratinjau di tab baru
              </a>
            </div>
          )}
        </div>
      </div>
    </KerangkaModal>
  );
}
