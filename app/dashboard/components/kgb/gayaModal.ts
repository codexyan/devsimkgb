// Gaya modal KGB dashboard. Hanya memakai token warna dari app/globals.css agar ikut mode terang dan gelap.

export const GAYA_MODAL_KGB = `
@keyframes kgbm-pudar { from { opacity: 0 } to { opacity: 1 } }
@keyframes kgbm-naik { from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes kgbm-putar { to { transform: rotate(360deg) } }
.kgbm-latar { position: fixed; inset: 0; z-index: 300; display: flex; align-items: flex-end; justify-content: center;
  background: rgba(9, 20, 40, .45); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); animation: kgbm-pudar .2s ease both; }
@media (min-width: 640px) { .kgbm-latar { align-items: center; padding: 16px; } }
.kgbm-panel { position: relative; display: flex; flex-direction: column; width: 100%; max-height: 92dvh; background: var(--card);
  color: var(--dtn); border: 1px solid var(--ln1); border-radius: 16px 16px 0 0; box-shadow: 0 24px 60px rgba(9, 20, 40, .28);
  outline: none; animation: kgbm-naik .28s cubic-bezier(.22, 1, .36, 1) both; }
.kgbm-panel:focus-visible { box-shadow: 0 24px 60px rgba(9, 20, 40, .28); }
@media (min-width: 640px) { .kgbm-panel { border-radius: 16px; } }
.kgbm-sm { max-width: 440px; } .kgbm-md { max-width: 580px; } .kgbm-lg { max-width: 1040px; }
.kgbm-kepala { display: flex; align-items: center; gap: 12px; padding: 16px 20px 12px; border-bottom: 1px solid var(--ln2); flex-shrink: 0; }
.kgbm-kepala-teks { flex: 1; min-width: 0; }
.kgbm-ikon { width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: var(--tint-navy); color: var(--dtn); }
.kgbm-ikon[data-nada="amber"] { background: var(--tint-amber-bg); color: var(--st-amber); }
.kgbm-ikon[data-nada="hijau"] { background: var(--tint-green-bg); color: var(--st-green); }
.kgbm-ikon[data-nada="merah"] { background: var(--tint-red-bg); color: var(--st-red); }
.kgbm-ikon[data-nada="netral"] { background: var(--sub); color: var(--dt3); }
.kgbm-judul { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--dtn); }
.kgbm-subjudul { font-size: 12px; line-height: 1.4; color: var(--dt4); margin-top: 2px; overflow-wrap: anywhere; }
.kgbm-tutup { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; background: var(--ln2); color: var(--dt3); }
.kgbm-tutup:disabled { opacity: .4; cursor: not-allowed; }
.kgbm-form { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.kgbm-badan { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.kgbm-kaki { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid var(--ln2); flex-shrink: 0; }
.kgbm-kaki > .kgbm-tombol { flex: 1 1 140px; }
.kgbm-tombol { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; border-radius: 12px;
  font-size: 12px; font-weight: 600; line-height: 1.2; text-align: center; text-decoration: none; transition: opacity .15s; }
.kgbm-tombol:disabled, .kgbm-tombol[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
.kgbm-tombol:not(:disabled):hover { opacity: .88; }
.kgbm-utama { background: var(--navy-solid); color: #fff; }
.kgbm-kedua { background: var(--sub); color: var(--dt3); border: .5px solid var(--ln0); }
.kgbm-bahaya { background: var(--red-solid); color: #fff; }
.kgbm-hijau { background: var(--green-solid); color: #fff; }
.kgbm-amber { background: var(--amber-solid); color: #fff; }
.kgbm-tombol-kecil { padding: 5px 10px; border-radius: 8px; font-size: 11px; }
.kgbm-label { display: block; font-size: 12px; font-weight: 500; color: var(--dt2); margin-bottom: 4px; }
/* Isian wajib ditandai bintang merah, bukan dengan mewarnai seluruh labelnya: label merah membuat
   setengah formulir tampak seperti peringatan, sedangkan yang perlu terbaca hanyalah tandanya. */
.kgbm-wajib::after { content: "*"; color: var(--st-red); margin-left: 3px; font-weight: 700; }
.kgbm-legenda { font-size: 11px; line-height: 1.45; color: var(--dt5); margin: -2px 0 2px; }
.kgbm-legenda b { color: var(--dt2); font-weight: 600; }
.kgbm-legenda i { color: var(--st-red); font-style: normal; font-weight: 700; }
.kgbm-petunjuk { font-size: 11px; line-height: 1.45; color: var(--dt5); margin-top: 4px; }
.kgbm-input { width: 100%; border-radius: 10px; padding: 8px 12px; font-size: 13px; line-height: 1.4; border: 1px solid var(--ln0);
  background: var(--sub); color: var(--dtn); outline: none; }
.kgbm-input:focus { border-color: var(--electric-blue); box-shadow: var(--focus-ring); }
.kgbm-input:disabled { opacity: .6; cursor: not-allowed; }
textarea.kgbm-input { resize: vertical; min-height: 72px; }
@media (max-width: 639px) { .kgbm-input { font-size: 16px; } }
.kgbm-bagian { border: 1px solid var(--ln1); border-radius: 12px; overflow: hidden; }
.kgbm-bagian-kepala { padding: 8px 12px; background: var(--tint-navy); border-bottom: .5px solid var(--ln1); }
.kgbm-bagian[data-nada="hijau"] .kgbm-bagian-kepala { background: var(--tint-green-bg); }
.kgbm-bagian[data-nada="amber"] .kgbm-bagian-kepala { background: var(--tint-amber-bg); }
.kgbm-bagian-judul { font-size: 12px; font-weight: 600; color: var(--dtn); }
.kgbm-bagian-ket { font-size: 11px; color: var(--dt4); margin-top: 1px; line-height: 1.4; }
.kgbm-bagian-isi { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.kgbm-berawalan { display: flex; align-items: stretch; gap: 0; }
.kgbm-berawalan > span { display: flex; align-items: center; padding: 0 8px; border: 1px solid var(--ln0); border-right: 0;
  border-radius: 10px 0 0 10px; background: var(--tint-navy); color: var(--dt3); font-size: 12px; white-space: nowrap; }
.kgbm-berawalan > .kgbm-input { border-radius: 0 10px 10px 0; }
.kgbm-bantuan { display: block; margin-top: 3px; font-size: 11px; font-weight: 400; line-height: 1.45; color: var(--dt4); }
/* Pilihan keadaan: dua tombol berdampingan, yang terpilih diberi latar */
.kgbm-pilihan { display: flex; gap: 6px; padding: 3px; border-radius: 10px; background: var(--sub); border: 1px solid var(--ln1); }
.kgbm-pilihan button { flex: 1; border: 0; border-radius: 8px; padding: 7px 10px; background: none; font: inherit;
  font-size: 12px; font-weight: 500; color: var(--dt3); cursor: pointer; }
.kgbm-pilihan button[aria-checked="true"] { background: var(--kartu); color: var(--dtn); font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 30, 60, .08); }
/* Panel hasil hitungan: angka yang tidak boleh diketik operator */
.kgbm-hitungan { border: 1px solid var(--tint-navy-ln, var(--ln1)); border-radius: 10px; padding: 10px 12px; background: var(--tint-navy); }
.kgbm-hitungan-judul { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dt4); }
.kgbm-hitungan dl { display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 6px; }
@media (min-width: 480px) { .kgbm-hitungan dl { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.kgbm-hitungan dt { font-size: 11px; color: var(--dt4); }
.kgbm-hitungan dd { font-size: 13px; font-weight: 600; color: var(--dtn); font-variant-numeric: tabular-nums; }
.kgbm-hitungan-ket { margin-top: 7px; font-size: 11.5px; line-height: 1.5; color: var(--dt3); }
.kgbm-hitungan-ingat { margin-top: 5px; font-size: 11.5px; line-height: 1.5; color: var(--st-red); }
.kgbm-kosongkan { display: block; margin: 3px 0 0 auto; border: 0; padding: 0; background: none; font: inherit;
  font-size: 11px; font-weight: 500; color: var(--dt4); cursor: pointer; }
.kgbm-kosongkan:hover { color: var(--st-red); text-decoration: underline; }
.kgbm-berkas-terpilih { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 11.5px; color: var(--dt4); }
.kgbm-berkas-terpilih > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kgbm-berkas-terpilih button { margin-left: auto; border: 0; padding: 0; background: none; font: inherit;
  font-size: 11.5px; font-weight: 600; color: var(--st-red); cursor: pointer; white-space: nowrap; }
.kgbm-berkas-terpilih button:hover { text-decoration: underline; }
.kgbm-kartu-berkas { display: flex; align-items: center; gap: 10px; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--ln1);
  border-radius: 10px; background: var(--sub); }
.kgbm-kartu-berkas[data-keadaan="baru"] { border-color: var(--tint-blue-ln); background: var(--tint-blue-bg); }
.kgbm-kartu-berkas-ikon { flex-shrink: 0; color: var(--dt4); }
.kgbm-kartu-berkas[data-keadaan="baru"] .kgbm-kartu-berkas-ikon { color: var(--st-blue); }
.kgbm-kartu-berkas-teks { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.kgbm-kartu-berkas-nama { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; color: var(--dt1); }
.kgbm-kartu-berkas-ket { font-size: 11px; font-weight: 400; color: var(--dt4); }
.kgbm-kartu-berkas-aksi { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; }
.kgbm-kartu-berkas-aksi button { padding: 3px 9px; border: 1px solid var(--ln0); border-radius: 7px; background: var(--card);
  font: inherit; font-size: 11.5px; font-weight: 600; color: var(--dtn); cursor: pointer; }
.kgbm-kartu-berkas-aksi button:hover { background: var(--tint-navy); }
.kgbm-kartu-berkas-aksi button[data-bahaya] { color: var(--st-red); }
.kgbm-kartu-berkas-aksi button[data-bahaya]:hover { background: var(--tint-red-bg); }
.kgbm-grid2 { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 480px) { .kgbm-grid2 { grid-template-columns: 1fr 1fr; } }
.kgbm-galat { font-size: 12px; line-height: 1.5; padding: 8px 12px; border-radius: 10px; background: var(--tint-red-bg);
  color: var(--st-red); border: 1px solid var(--tint-red-ln); }
.kgbm-catatan { font-size: 12px; line-height: 1.55; padding: 8px 12px; border-radius: 10px; background: var(--sub); color: var(--dt3);
  border: 1px solid var(--ln2); }
.kgbm-catatan[data-nada="amber"] { background: var(--tint-amber-bg); color: var(--st-amber2); border-color: var(--tint-amber-ln); }
.kgbm-catatan[data-nada="navy"] { background: var(--tint-navy); color: var(--dtn); border-color: var(--ln0); }
.kgbm-catatan[data-nada="hijau"] { background: var(--tint-green-bg); color: var(--st-green); border-color: var(--tint-green-ln); }
.kgbm-catatan[data-nada="merah"] { background: var(--tint-red-bg); color: var(--st-red); border-color: var(--tint-red-ln); }
.kgbm-data { border: 1px solid var(--ln1); border-radius: 12px; overflow: hidden; }
.kgbm-data-kepala { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px;
  font-size: 12px; font-weight: 600; background: var(--sub); color: var(--dt3); border-bottom: .5px solid var(--ln1); }
.kgbm-data dl { margin: 0; }
.kgbm-data-baris { display: flex; gap: 12px; padding: 6px 12px; font-size: 12px; }
.kgbm-data-baris + .kgbm-data-baris { border-top: .5px solid var(--ln2); }
.kgbm-data-baris dt { width: 132px; flex-shrink: 0; color: var(--dt4); }
.kgbm-data-baris dd { margin: 0; font-weight: 500; color: var(--dtn); overflow-wrap: anywhere; }
.kgbm-data-baris dd[data-nada="hijau"] { color: var(--st-green); }
.kgbm-lencana { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600;
  white-space: nowrap; background: var(--ln2); color: var(--dt3); }
.kgbm-lencana[data-nada="amber"] { background: var(--tint-amber-bg); color: var(--st-amber); }
.kgbm-lencana[data-nada="hijau"] { background: var(--tint-green-bg); color: var(--st-green); }
.kgbm-lencana[data-nada="merah"] { background: var(--tint-red-bg); color: var(--st-red); }
.kgbm-berkas { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; cursor: pointer;
  border: 1.5px dashed var(--ln0); background: var(--sub); color: var(--dt4); font-size: 12px; }
.kgbm-berkas[data-terisi="true"] { border-color: var(--tint-green-ln); background: var(--tint-green-bg); color: var(--st-green); }
.kgbm-berkas:focus-within { box-shadow: var(--focus-ring); }
.kgbm-berkas[data-nonaktif="true"] { opacity: .6; cursor: not-allowed; }
.kgbm-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.kgbm-bingkai { width: 100%; border: 1px solid var(--ln0); border-radius: 12px; background: var(--sub); }
.kgbm-tab { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--sub); border: .5px solid var(--ln1); }
.kgbm-tab button { flex: 1; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--dt4); }
.kgbm-tab button[aria-selected="true"] { background: var(--card); color: var(--dtn); box-shadow: 0 1px 3px rgba(9, 20, 40, .12); }
.kgbm-tab button:disabled { opacity: .55; cursor: not-allowed; }
.kgbm-putar { width: 20px; height: 20px; border-radius: 999px; border: 2px solid var(--dtn); border-top-color: transparent;
  animation: kgbm-putar .8s linear infinite; }
.kgbm-tautan { font-size: 12px; font-weight: 600; color: var(--dtn); text-decoration: underline; text-underline-offset: 2px; }
.kgbm-tautan:disabled { opacity: .5; cursor: not-allowed; }
.kgbm-lencana[data-nada="navy"] { background: var(--tint-navy); color: var(--dtn); }
.kgbm-kolom { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.kgbm-sk-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
@media (min-width: 900px) { .kgbm-sk-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.kgbm-pratinjau { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.kgbm-pratinjau-isi { display: flex; align-items: center; justify-content: center; min-height: 360px; overflow: hidden;
  border: 1px solid var(--ln0); border-radius: 12px; background: var(--sub); }
.kgbm-pratinjau-isi iframe { display: block; width: 100%; height: 360px; border: 0; background: var(--card); }
@media (min-width: 900px) { .kgbm-pratinjau-isi { min-height: 540px; } .kgbm-pratinjau-isi iframe { height: 540px; } }
.kgbm-pratinjau-kosong { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; text-align: center;
  font-size: 12px; line-height: 1.5; color: var(--dt4); }
.kgbm-baris-tombol { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.kgbm-daftar { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.kgbm-item { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--ln1); border-radius: 12px; background: var(--card); }
.kgbm-item-kepala { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.kgbm-item-judul { flex: 1 1 auto; min-width: 0; font-size: 12px; font-weight: 600; color: var(--dtn); }
.kgbm-item-data { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 11px; }
@media (min-width: 480px) { .kgbm-item-data { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.kgbm-item-data div { display: flex; gap: 6px; min-width: 0; }
.kgbm-item-data dt { color: var(--dt5); flex-shrink: 0; }
.kgbm-item-data dd { margin: 0; color: var(--dtn); font-weight: 500; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .kgbm-latar, .kgbm-panel { animation: none; } .kgbm-putar { animation-duration: 2.4s; } }
`;
