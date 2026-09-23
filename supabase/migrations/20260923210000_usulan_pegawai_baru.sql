-- Usulan UPT berkembang dari sekadar mengoreksi data menjadi juga mengusulkan pegawai baru,
-- lengkap dengan berkas dasarnya.
--
-- jenis          : "perubahan" untuk pegawai yang sudah ada, "baru" untuk pegawai yang belum tercatat
--                  (mis. CPNS yang baru dilantik). Pada usulan baru, pegawai_id kosong sampai disetujui.
-- nip            : hanya diisi pada usulan pegawai baru; pegawai yang sudah ada dikenali dari pegawai_id.
-- unit_kerja     : nama satker pegawai baru, diisi server dari satker akun pengusul.
-- path_*         : berkas dasar yang diminta tim keuangan agar masa kerja golongan dapat dicocokkan.

alter table public.usulan_pegawai alter column pegawai_id drop not null;

alter table public.usulan_pegawai add column if not exists jenis text not null default 'perubahan';
alter table public.usulan_pegawai add column if not exists nip text;
alter table public.usulan_pegawai add column if not exists unit_kerja text;
alter table public.usulan_pegawai add column if not exists path_sk_terakhir text;
alter table public.usulan_pegawai add column if not exists path_syarat_cpns text;
alter table public.usulan_pegawai add column if not exists path_sk_pangkat text;

create index if not exists usulan_pegawai_jenis_idx on public.usulan_pegawai (jenis, status);
