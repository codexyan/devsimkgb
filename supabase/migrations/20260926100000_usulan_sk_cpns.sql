-- SK pengangkatan CPNS sebagai berkas tersendiri pada usulan UPT.
--
-- Bagi pegawai yang belum pernah KGB, SK CPNS adalah acuan pertama: TMT CPNS awal masa kerja golongan,
-- dan nomor serta tanggalnya yang tercetak sebagai SK dasar pada surat KGB pertama. KGB pertama dapat
-- jatuh sebelum pegawai diangkat PNS, sehingga SK pengangkatan PNS tidak selalu sudah ada.

alter table public.usulan_pegawai add column if not exists path_sk_cpns text;
