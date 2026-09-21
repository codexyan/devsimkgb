"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import "./perjalanan.css";

/* Perjalanan satu usulan KGB. Langkah di kanan dibaca sambil menggulir; panggung dokumen di kiri tetap
   di layar dan berubah wujud mengikuti langkah yang sedang dibaca: surat UPT, lembar disposisi, SK,
   tanda tangan elektronik, tiga penerima, unggahan ke SIM-KGB, lalu konfirmasi keuangan.
   Panggung hanya ilustrasi (aria-hidden); seluruh isinya tertulis di daftar langkah. */

export interface ContohUsulan {
  satker: string;
  golongan: string;
  gajiLama: string;
  gajiBaru: string;
  masaKerjaBaru: string;
  tmt: string;
  tmtBerikutnya: string;
}

const LANGKAH = [
  {
    judul: "UPT mengirim surat permohonan",
    pelaksana: "Admin kepegawaian dan Kepala UPT",
    isi: "Admin kepegawaian menyiapkan surat berisi daftar pegawai yang diusulkan beserta lampirannya. Kepala UPT menandatanganinya secara elektronik dan mengirimnya lewat Srikandi kepada Kepala Kanwil.",
  },
  {
    judul: "Agenda dan disposisi",
    pelaksana: "Tata Usaha, Kepala Kanwil, Kabag Tata Usaha dan Umum",
    isi: "Tata Usaha mencatat surat pada Lembar Disposisi. Kepala Kanwil memberi disposisi “u/ ditindaklanjuti”, yang diteruskan Kabag Tata Usaha dan Umum kepada Ketua Tim SDM.",
  },
  {
    judul: "Input KGB dan buat SK",
    pelaksana: "Tim SDM Kanwil",
    isi: "Tim SDM mencocokkan data dengan lampiran, lalu memilih Input KGB di SIM-KGB. Masa kerja dan gaji pokok baru dihitung dari tabel gaji, kemudian SK dibuat.",
    status: "Sedang Diproses",
  },
  {
    judul: "Tanda tangan elektronik SK",
    pelaksana: "Kepala Kanwil, atau Plh, Plt, Direktur Jenderal",
    isi: "SK versi Srikandi ditandatangani secara elektronik oleh pejabat yang berwenang pada tanggal SK.",
  },
  {
    judul: "Pengiriman SK",
    pelaksana: "Tim SDM Kanwil",
    isi: "SK yang sudah ditandatangani dikirim kepada UPT pengusul, bagian keuangan UPT, dan KPPN mitra satker.",
  },
  {
    judul: "Unggah SK ke SIM-KGB",
    pelaksana: "Tim SDM Kanwil",
    isi: "Berkas PDF SK yang sudah ditandatangani diunggah dengan tombol Unggah SK TTE.",
    status: "Menunggu Keuangan",
  },
  {
    judul: "Konfirmasi keuangan",
    pelaksana: "Bagian keuangan",
    isi: "Bagian keuangan memeriksa SK dan mengonfirmasinya, termasuk bila ada rapelan. SIM-KGB memperbarui data pegawai dan menjadwalkan KGB berikutnya.",
    status: "Selesai",
  },
] as const;

const PENERIMA = ["UPT pengusul", "Keuangan UPT", "KPPN mitra"];

const KELAS_STATUS: Record<string, string> = {
  "Sedang Diproses": "pub-status-proses",
  "Menunggu Keuangan": "pub-status-keuangan",
  Selesai: "pub-status-selesai",
};

export default function PerjalananUsulan({ contoh }: { contoh: ContohUsulan }) {
  const [aktif, setAktif] = useState(1);
  const daftarRef = useRef<HTMLOListElement>(null);

  // Langkah aktif adalah langkah yang melintasi pita tengah layar (sedikit lebih bawah di layar sempit,
  // karena bagian atasnya dipakai panggung dokumen).
  useEffect(() => {
    const daftar = daftarRef.current;
    if (!daftar) return;
    const butir = Array.from(daftar.querySelectorAll<HTMLElement>("[data-langkah]"));
    let pengamat: IntersectionObserver | null = null;
    const pasang = () => {
      pengamat?.disconnect();
      const sempit = window.matchMedia("(max-width: 960px)").matches;
      pengamat = new IntersectionObserver(
        (entri) => {
          const terlihat = entri.filter((e) => e.isIntersecting);
          if (terlihat.length === 0) return;
          const terakhir = terlihat[terlihat.length - 1].target as HTMLElement;
          setAktif(Number(terakhir.dataset.langkah));
        },
        { rootMargin: sempit ? "-62% 0px -30% 0px" : "-46% 0px -46% 0px" },
      );
      butir.forEach((b) => pengamat?.observe(b));
    };
    pasang();
    const mq = window.matchMedia("(max-width: 960px)");
    mq.addEventListener("change", pasang);
    return () => {
      mq.removeEventListener("change", pasang);
      pengamat?.disconnect();
    };
  }, []);

  return (
    <div className="pj" data-langkah={aktif}>
      <div className="pj-panggung" aria-hidden="true">
        <div className="pj-meja">
          {/* Surat permohonan UPT */}
          <div className="pj-kertas pj-surat">
            <div className="pj-kop">
              <Image src="/icons.svg" alt="" width={28} height={22} loading="eager" />
              <span>
                <b>Rumah Tahanan Negara</b>
                <i>{contoh.satker.replace(/^Rutan /, "")}</i>
              </span>
            </div>
            <p className="pj-hal">
              <span>Hal</span>Permohonan penerbitan SK kenaikan gaji berkala
            </p>
            <p className="pj-yth">Yth. Kepala Kantor Wilayah Ditjenpas Kalimantan Selatan</p>
            <p className="pj-pembuka">Bersama ini kami usulkan kenaikan gaji berkala bagi pegawai berikut.</p>
            <div className="pj-baris-tabel">
              <span className="pj-baris pj-baris-kepala">
                <b>Nama</b>
                <b>Golongan</b>
                <b>TMT</b>
              </span>
              {[0, 1, 2].map((i) => (
                <span key={i} className="pj-baris">
                  <i />
                  <i />
                  <i />
                </span>
              ))}
            </div>
            <div className="pj-ttd-upt">
              <span className="pj-segel" />
              Ditandatangani secara elektronik
            </div>
          </div>

          {/* Lembar disposisi */}
          <div className="pj-kertas pj-disposisi">
            <p className="pj-judul-kecil">Lembar disposisi</p>
            <dl>
              <div>
                <dt>Dari</dt>
                <dd>{contoh.satker}</dd>
              </div>
              <div>
                <dt>Kepada</dt>
                <dd>Kabag TU dan Umum</dd>
              </div>
              <div>
                <dt>Diteruskan</dt>
                <dd>Ketua Tim SDM</dd>
              </div>
            </dl>
            <span className="pj-cap">u/ ditindaklanjuti</span>
          </div>

          {/* Surat keputusan */}
          <div className="pj-kertas pj-sk">
            <div className="pj-kop pj-kop-tengah">
              <Image src="/icons.svg" alt="" width={30} height={24} loading="eager" />
              <b>Kantor Wilayah Ditjenpas Kalimantan Selatan</b>
            </div>
            <p className="pj-sk-judul">Keputusan kenaikan gaji berkala</p>
            <dl className="pj-sk-rinci">
              <div style={{ "--r": 0 } as React.CSSProperties}>
                <dt>Golongan</dt>
                <dd>{contoh.golongan}</dd>
              </div>
              <div style={{ "--r": 1 } as React.CSSProperties}>
                <dt>Gaji pokok lama</dt>
                <dd>{contoh.gajiLama}</dd>
              </div>
              <div className="pj-sk-baru" style={{ "--r": 2 } as React.CSSProperties}>
                <dt>Gaji pokok baru</dt>
                <dd>{contoh.gajiBaru}</dd>
              </div>
              <div style={{ "--r": 3 } as React.CSSProperties}>
                <dt>Masa kerja</dt>
                <dd>{contoh.masaKerjaBaru}</dd>
              </div>
              <div style={{ "--r": 4 } as React.CSSProperties}>
                <dt>Mulai berlaku</dt>
                <dd>{contoh.tmt}</dd>
              </div>
            </dl>
            <div className="pj-sk-ttd">
              <span className="pj-sk-ttd-ruang">
                <Image src="/label-srikandi.png" alt="" width={120} height={33} loading="lazy" />
              </span>
              <span>Kepala Kantor Wilayah</span>
            </div>
          </div>

          {/* Tiga penerima SK: batang turun dari SK, bercabang ke tiga kolom yang sama lebar */}
          <div className="pj-kirim">
            <span className="pj-kirim-batang" />
            <span className="pj-kirim-palang" />
            <ul className="pj-penerima">
              {PENERIMA.map((p, i) => (
                <li key={p} style={{ "--r": i } as React.CSSProperties}>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Unggahan ke SIM-KGB */}
          <div className="pj-aplikasi">
            <div className="pj-aplikasi-bilah">
              <Image src="/icons.svg" alt="" width={22} height={17} loading="eager" />
              <b>SIM-KGB</b>
              <span>Unggah SK TTE</span>
            </div>
            <div className="pj-berkas">
              <span className="pj-berkas-ikon">PDF</span>
              <span className="pj-berkas-teks">
                <b>SK KGB {contoh.satker}</b>
                <span className="pj-unggah">
                  <span />
                </span>
              </span>
            </div>
          </div>

          {/* Selesai dan jadwal berikutnya */}
          <div className="pj-berikutnya">
            <span className="pj-centang">
              <svg viewBox="0 0 24 24">
                <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
              </svg>
            </span>
            <span>
              <b>KGB berikutnya</b>
              <i>{contoh.tmtBerikutnya}</i>
            </span>
          </div>

          <div className="pj-lencana">
            <span className="pub-status pub-status-proses pj-lencana-proses">Sedang Diproses</span>
            <span className="pub-status pub-status-keuangan pj-lencana-keuangan">Menunggu Keuangan</span>
            <span className="pub-status pub-status-selesai pj-lencana-selesai">Selesai</span>
          </div>
        </div>

        <div className="pj-maju">
          <span className="pj-maju-teks">
            Langkah {aktif} dari {LANGKAH.length}
          </span>
          <span className="pj-maju-jalur">
            <span style={{ transform: `scaleX(${aktif / LANGKAH.length})` }} />
          </span>
        </div>
        <p className="pj-contoh">Contoh: usulan {contoh.satker}, data pegawai disamarkan</p>
      </div>

      <ol className="pj-langkah" ref={daftarRef}>
        {LANGKAH.map((l, i) => (
          <li key={l.judul} data-langkah={i + 1} aria-current={aktif === i + 1 ? "step" : undefined}>
            <span className="pj-nomor" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="pj-judul">
              <span className="pub-visually-hidden">Langkah {i + 1}: </span>
              {l.judul}
            </h3>
            <p className="pj-pelaksana">{l.pelaksana}</p>
            <p className="pj-isi">{l.isi}</p>
            {"status" in l && (
              <p className="pj-status">
                Status berubah menjadi <span className={`pub-status ${KELAS_STATUS[l.status]}`}>{l.status}</span>
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
