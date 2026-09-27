-- Cadangan data bulanan wajib (ADR-018).
--
-- Selama SIM-KGB masih disempurnakan, setiap akun wajib mengunduh cadangan data sesuai hak aksesnya paling
-- tidak sebulan sekali ke perangkat yang dipakainya. Kolom ini mencatat kapan cadangan terakhir diunduh,
-- untuk pengingat di dashboard dan daftar kepatuhan di menu Pengguna.
alter table public.users add column if not exists cadangan_terakhir_at timestamptz;

notify pgrst, 'reload schema';
