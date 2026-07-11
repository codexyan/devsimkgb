-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jabatan" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SDM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nama" TEXT,
    "jabatan" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "alasanTolak" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pegawai" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tempatLahir" TEXT,
    "tanggalLahir" TIMESTAMP(3),
    "jenisKelamin" TEXT,
    "pendidikanTerakhir" TEXT,
    "jabatan" TEXT NOT NULL,
    "pangkat" TEXT NOT NULL,
    "golonganRuang" TEXT NOT NULL,
    "unitKerja" TEXT NOT NULL DEFAULT 'Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan',
    "eselon" TEXT,
    "jenisJabatan" TEXT,
    "tmtGolongan" TIMESTAMP(3) NOT NULL,
    "mkgTahun" INTEGER NOT NULL DEFAULT 0,
    "mkgBulan" INTEGER NOT NULL DEFAULT 0,
    "gajiPokok" INTEGER NOT NULL,
    "tmtKgbTerakhir" TIMESTAMP(3) NOT NULL,
    "tmtKgbBerikutnya" TIMESTAMP(3) NOT NULL,
    "statusHukdis" BOOLEAN NOT NULL DEFAULT false,
    "tanggalHukdisBerakhir" TIMESTAMP(3),
    "jenisHukdis" TEXT,
    "keteranganHukdis" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pegawai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatKGB" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "nomorSK" TEXT NOT NULL,
    "tanggalSK" TIMESTAMP(3) NOT NULL,
    "tmtSK" TIMESTAMP(3) NOT NULL,
    "golonganLama" TEXT NOT NULL,
    "gajiPokokLama" INTEGER NOT NULL,
    "mkgTahunLama" INTEGER NOT NULL,
    "mkgBulanLama" INTEGER NOT NULL,
    "golonganBaru" TEXT NOT NULL,
    "gajiPokokBaru" INTEGER NOT NULL,
    "mkgTahunBaru" INTEGER NOT NULL,
    "mkgBulanBaru" INTEGER NOT NULL,
    "tmtKgbBaru" TIMESTAMP(3) NOT NULL,
    "tmtKgbBerikutnya" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'belum_diproses',
    "flagRapelan" BOOLEAN NOT NULL DEFAULT false,
    "isArsip" BOOLEAN NOT NULL DEFAULT false,
    "konfirmasiKeuanganAt" TIMESTAMP(3),
    "konfirmasiKeuanganBy" TEXT,
    "rapelanDitetapkan" BOOLEAN,
    "inputGajiWebAt" TIMESTAMP(3),
    "inputGajiWebBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiwayatKGB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuratKGB" (
    "id" TEXT NOT NULL,
    "kgbId" TEXT NOT NULL,
    "nomorSurat" TEXT NOT NULL,
    "tanggalSurat" TIMESTAMP(3) NOT NULL,
    "namaKepalaKanwil" TEXT NOT NULL,
    "nipKepalaKanwil" TEXT NOT NULL,
    "pathFile" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,

    CONSTRAINT "SuratKGB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerahTerima" (
    "id" TEXT NOT NULL,
    "kgbId" TEXT NOT NULL,
    "namaAdmin" TEXT NOT NULL,
    "keterangan" TEXT,
    "tanggalSerahTerima" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "SerahTerima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KonfigurasiKanwil" (
    "id" TEXT NOT NULL,
    "namaKepala" TEXT NOT NULL,
    "nipKepala" TEXT NOT NULL,
    "nomorPP" TEXT NOT NULL DEFAULT 'Nomor 5 Tahun 2024',
    "tahunPP" TEXT NOT NULL DEFAULT '2024',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "KonfigurasiKanwil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifikasi" (
    "id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "pesan" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "referenceId" TEXT,
    "dibaca" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prioritas" TEXT NOT NULL DEFAULT 'normal',
    "linkHref" TEXT,
    "kategori" TEXT,

    CONSTRAINT "Notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatHukdis" (
    "id" TEXT NOT NULL,
    "pegawaiId" TEXT NOT NULL,
    "jenisHukdis" TEXT NOT NULL,
    "nomorSK" TEXT NOT NULL,
    "tanggalSK" TIMESTAMP(3) NOT NULL,
    "tmtMulai" TIMESTAMP(3) NOT NULL,
    "tmtBerakhir" TIMESTAMP(3) NOT NULL,
    "berdampakKGB" BOOLEAN NOT NULL DEFAULT false,
    "durasiTunda" INTEGER,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "RiwayatHukdis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HukdisJenis" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "dasarHukum" TEXT,
    "durasiHukdis" INTEGER NOT NULL DEFAULT 0,
    "berdampakKGB" BOOLEAN NOT NULL DEFAULT false,
    "durasiTunda" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "HukdisJenis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HukdisKonfigurasi" (
    "id" TEXT NOT NULL,
    "notifHariH1" INTEGER NOT NULL DEFAULT 30,
    "notifHariH2" INTEGER NOT NULL DEFAULT 14,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "HukdisKonfigurasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aksi" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "targetNama" TEXT,
    "ipAddress" TEXT,
    "userId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RekonBulanan" (
    "id" TEXT NOT NULL,
    "bulanTmt" TEXT NOT NULL,
    "tanggalInput" TIMESTAMP(3) NOT NULL,
    "inputBy" TEXT NOT NULL,
    "jumlahData" INTEGER NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RekonBulanan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nip_key" ON "User"("nip");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_userId_status_idx" ON "ProfileChangeRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_status_idx" ON "ProfileChangeRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_nip_key" ON "Pegawai"("nip");

-- CreateIndex
CREATE INDEX "Pegawai_aktif_tmtKgbBerikutnya_idx" ON "Pegawai"("aktif", "tmtKgbBerikutnya");

-- CreateIndex
CREATE INDEX "Pegawai_statusHukdis_idx" ON "Pegawai"("statusHukdis");

-- CreateIndex
CREATE INDEX "RiwayatKGB_status_idx" ON "RiwayatKGB"("status");

-- CreateIndex
CREATE INDEX "RiwayatKGB_pegawaiId_status_idx" ON "RiwayatKGB"("pegawaiId", "status");

-- CreateIndex
CREATE INDEX "RiwayatKGB_tmtKgbBaru_idx" ON "RiwayatKGB"("tmtKgbBaru");

-- CreateIndex
CREATE UNIQUE INDEX "SuratKGB_kgbId_key" ON "SuratKGB"("kgbId");

-- CreateIndex
CREATE UNIQUE INDEX "HukdisJenis_kode_key" ON "HukdisJenis"("kode");

-- CreateIndex
CREATE INDEX "AuditLog_waktu_idx" ON "AuditLog"("waktu");

-- CreateIndex
CREATE INDEX "AuditLog_aksi_idx" ON "AuditLog"("aksi");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "RekonBulanan_bulanTmt_idx" ON "RekonBulanan"("bulanTmt");

-- CreateIndex
CREATE UNIQUE INDEX "RekonBulanan_bulanTmt_key" ON "RekonBulanan"("bulanTmt");

-- AddForeignKey
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatKGB" ADD CONSTRAINT "RiwayatKGB_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatKGB" ADD CONSTRAINT "RiwayatKGB_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuratKGB" ADD CONSTRAINT "SuratKGB_kgbId_fkey" FOREIGN KEY ("kgbId") REFERENCES "RiwayatKGB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuratKGB" ADD CONSTRAINT "SuratKGB_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerahTerima" ADD CONSTRAINT "SerahTerima_kgbId_fkey" FOREIGN KEY ("kgbId") REFERENCES "RiwayatKGB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerahTerima" ADD CONSTRAINT "SerahTerima_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatHukdis" ADD CONSTRAINT "RiwayatHukdis_pegawaiId_fkey" FOREIGN KEY ("pegawaiId") REFERENCES "Pegawai"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatHukdis" ADD CONSTRAINT "RiwayatHukdis_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RekonBulanan" ADD CONSTRAINT "RekonBulanan_inputBy_fkey" FOREIGN KEY ("inputBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

