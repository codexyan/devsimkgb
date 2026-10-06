-- Penanda "sudah melihat" pengumuman Apa yang baru untuk Admin UPT, per akun (lib/pengumumanUpt.ts, ADR-075).
--
-- Sebelumnya penandanya hanya di peramban, sehingga pengumuman yang sama muncul lagi di komputer lain. Kini satu baris
-- per akun dan per pengumuman, sehingga pengumuman tampil di login pertama akun itu saja, di perangkat mana pun.
-- Aplikasi tetap berjalan sebelum tabel ini dibuat: ia kembali memakai penanda peramban sampai migrasi dijalankan.
create table if not exists public.pengumuman_dilihat (
  -- user_id dan pengumuman_id digabung, sehingga satu akun tidak pernah punya dua baris untuk satu pengumuman.
  id             text primary key,
  -- Tanpa foreign key: penanda hanya catatan tampilan, dan tidak boleh menghalangi penghapusan akun.
  user_id        text not null,
  pengumuman_id  text not null,
  dilihat_at     timestamptz default now(),
  urutan_sisip   bigint generated always as identity
);
create unique index if not exists pengumuman_dilihat_unik on public.pengumuman_dilihat (user_id, pengumuman_id);

-- Akses tetap lewat service role aplikasi, sama dengan tabel lain.
alter table public.pengumuman_dilihat enable row level security;

notify pgrst, 'reload schema';
