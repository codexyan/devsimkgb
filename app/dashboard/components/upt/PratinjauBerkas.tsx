"use client";

import { useMemo, useState } from "react";
import { Catatan } from "@/app/dashboard/components/kgb";
import { BATAS_BARIS_IMPOR, KOLOM_TEMPLAT_UPT, diLuarPilihan, isianDiLuarPilihan, type BerkasUpt } from "@/lib/imporUsulanUpt";

/* Pratinjau berkas: isi berkas apa adanya, sebelum dikirim untuk diperiksa.
 *
 * Langkah Periksa & konfirmasi menampilkan hasil bacaan server per pegawai, tetapi tidak memperlihatkan kolom
 * berkas yang tidak terbaca sama sekali. Judul yang tidak dikenali ("Tgl Lahir" yang salah eja, kolom nomor
 * urut, judul laporan di baris pertama) membuat isiannya hilang diam-diam, dan baru ketahuan sebagai "perlu
 * dilengkapi" di Usul KGB Kolektif. Di sini operator melihat lebih dulu kolom mana yang dibaca, mana yang
 * diabaikan, dan isi barisnya, lalu memutuskan sendiri untuk lanjut atau membetulkan berkasnya.
 *
 * Isinya tidak dinilai di sini; NIP, tanggal, dan isian pilihan tetap diperiksa server di langkah berikutnya.
 */

const LABEL = new Map(KOLOM_TEMPLAT_UPT.map((k) => [k.kolom, k.label]));
const WAJIB = new Set(KOLOM_TEMPLAT_UPT.filter((k) => k.peran === "wajib").map((k) => k.kolom));
const BARIS_AWAL = 10;

export default function PratinjauBerkas({
  berkas,
  namaBerkas,
  lembar,
  sibuk,
  onLanjut,
  onGanti,
}: {
  berkas: BerkasUpt;
  namaBerkas: string;
  /** Nama lembar yang dibaca, untuk berkas Excel. */
  lembar: string | null;
  sibuk: boolean;
  onLanjut: () => void;
  onGanti: () => void;
}) {
  const [semua, setSemua] = useState(false);
  const dibaca = berkas.kolom.filter((k) => k.kunci);
  const diabaikan = berkas.kolom.filter((k) => !k.kunci);
  const n = berkas.baris.length;
  const tampil = semua ? berkas.baris : berkas.baris.slice(0, BARIS_AWAL);
  const terlaluBanyak = n > BATAS_BARIS_IMPOR;
  const bisaLanjut = !sibuk && n > 0 && berkas.wajibHilang.length === 0 && !terlaluBanyak;
  const luarPilihan = useMemo(() => isianDiLuarPilihan(berkas.baris), [berkas.baris]);

  return (
    <div className="ung-pratinjau">
      <div className="ung-pratinjau-kepala">
        <h2>Pratinjau berkas</h2>
        <p>
          <strong>{namaBerkas}</strong>
          {lembar && <> · lembar {lembar}</>} · <strong>{n}</strong> baris data · {dibaca.length} kolom dibaca
          {diabaikan.length > 0 && <>, {diabaikan.length} diabaikan</>}
        </p>
      </div>

      <ul className="ung-peta-kolom" aria-label="Kolom pada berkas">
        {berkas.kolom.map((k, i) => (
          <li key={`${i}-${k.judul}`} data-nada={k.kunci ? "dibaca" : "abaikan"}>
            {k.judul || "(tanpa judul)"}
            {k.kunci && k.kunci !== k.judul && <span> → {LABEL.get(k.kunci)}</span>}
            {k.sebab === "tidak dikenal" && <span> · diabaikan</span>}
            {k.sebab === "ganda" && <span> · ganda, diabaikan</span>}
          </li>
        ))}
      </ul>

      {berkas.wajibHilang.length > 0 && (
        <Catatan nada="merah">
          Kolom wajib tidak ditemukan: <strong>{berkas.wajibHilang.map((k) => LABEL.get(k) ?? k).join(", ")}</strong>. Periksa
          judul kolom pada baris pertama berkas (misalnya <code>nip</code> dan <code>nama</code>), atau pakai templat
          Excel. Berkas ini belum dapat diperiksa.
        </Catatan>
      )}
      {terlaluBanyak && (
        <Catatan nada="merah">
          Sekali unggah paling banyak {BATAS_BARIS_IMPOR} baris; berkas ini {n} baris. Bagi menjadi beberapa berkas.
        </Catatan>
      )}
      {n === 0 && berkas.wajibHilang.length === 0 && <Catatan nada="merah">Berkas tidak berisi satu baris data pun.</Catatan>}
      {luarPilihan.length > 0 && (
        <Catatan nada="amber">
          <strong>Isian di luar daftar pilihan templat</strong> (bertanda kuning di tabel):{" "}
          {luarPilihan.map((p, i) => (
            <span key={p.kolom}>
              {i > 0 && "; "}
              {LABEL.get(p.kolom)} {p.jumlah} baris, misalnya <code>{p.contoh.join(", ")}</code>
            </span>
          ))}
          . Isian ini tidak ditolak dan akan tersimpan apa adanya. Sebaiknya dibetulkan dulu di berkas sesuai pilihan
          pada Panduan kolom, misalnya <code>Laki-laki</code> bukan <code>L</code>, <code>S1</code> bukan{" "}
          <code>S-1</code>.
        </Catatan>
      )}
      {berkas.dilewatiDiAtas > 0 && (
        <p className="kgbm-bantuan">
          Judul kolom ditemukan di bawah {berkas.dilewatiDiAtas} baris lain (misalnya judul laporan); baris itu dilewati.
        </p>
      )}
      {diabaikan.some((k) => k.sebab === "tidak dikenal" && k.judul) && (
        <p className="kgbm-bantuan">
          Kolom yang diabaikan tidak ikut dikirim. Bila isinya diperlukan, ganti judulnya dengan nama kolom templat,
          lalu pilih berkasnya lagi.
        </p>
      )}
      {berkas.tidakAda.length > 0 && berkas.wajibHilang.length === 0 && (
        <p className="kgbm-bantuan">
          Kolom templat yang tidak ada di berkas, dianggap kosong: {berkas.tidakAda.map((k) => LABEL.get(k) ?? k).join(", ")}.
        </p>
      )}

      {n > 0 && dibaca.length > 0 && (
        <>
          <div className="ung-tabel-berkas-bungkus" tabIndex={0} role="region" aria-label="Isi berkas">
            <table className="ung-tabel-berkas">
              <thead>
                <tr>
                  <th scope="col">Baris</th>
                  {dibaca.map((k) => (
                    <th scope="col" key={k.kunci}>
                      {LABEL.get(k.kunci!)}
                      <small>{k.kunci}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tampil.map((r, i) => (
                  <tr key={i}>
                    <th scope="row">{i + 1}</th>
                    {dibaca.map((k) => {
                      const v = r[k.kunci!]?.trim() ?? "";
                      const luar = diLuarPilihan(k.kunci!, v);
                      return (
                        <td
                          key={k.kunci}
                          data-kosong={v ? undefined : WAJIB.has(k.kunci!) ? "wajib" : ""}
                          data-luar-pilihan={luar ? "" : undefined}
                          title={luar ? "Di luar daftar pilihan templat" : undefined}
                        >
                          {v || "–"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {n > BARIS_AWAL && (
            <button type="button" className="pgw-tautan ung-tampil-semua" onClick={() => setSemua((s) => !s)}>
              {semua ? `Tampilkan ${BARIS_AWAL} baris pertama saja` : `Tampilkan semua ${n} baris`}
            </button>
          )}
          <p className="kgbm-bantuan">
            Isian di atas apa adanya di berkas; tanggal dari Excel ditampilkan yyyy-mm-dd. NIP, tanggal, dan isian pilihan
            diperiksa di langkah berikutnya, dan belum ada yang tersimpan.
          </p>
        </>
      )}

      <div className="kol-kaki">
        <span>{bisaLanjut ? `${n} baris siap diperiksa.` : "Betulkan berkasnya, lalu pilih lagi."}</span>
        <span className="kol-kaki-tombol">
          <button type="button" className="dsb-tombol kol-kaki-kembali" data-jenis="garis" disabled={sibuk} onClick={onGanti}>
            ← Ganti berkas
          </button>
          <button type="button" className="dsb-tombol" disabled={!bisaLanjut} onClick={onLanjut}>
            {sibuk ? "Memeriksa…" : `Lanjut periksa ${n} baris →`}
          </button>
        </span>
      </div>
    </div>
  );
}
