import { getCloudflareContext } from "@opennextjs/cloudflare";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";

interface AuditParams {
  /** Pelaku aksi; null untuk aksi yang dijalankan skrip atau cron, ditampilkan sebagai "Sistem". */
  userId: string | null;
  aksi: string;
  detail: string;
  targetNama?: string;
  ipAddress?: string;
}

/**
 * Tulis satu catatan ke jejak audit.
 *
 * Pemanggilnya tidak menunggu: catatan tidak boleh memperlambat jawaban, dan kegagalannya tidak boleh
 * menggagalkan aksi yang sudah terjadi. Tetapi di Cloudflare Workers, promise yang tidak didaftarkan
 * dapat dihentikan begitu jawaban dikirim, dan itu memang terjadi: sepanjang dua minggu hanya sebagian
 * kecil aksi yang tercatat, sedangkan pengiriman usulan, persetujuan, dan input KGB hilang tanpa jejak.
 *
 * Karena itu penulisannya didaftarkan lewat waitUntil, sehingga isolate ditahan sampai selesai. Di luar
 * Workers, misalnya skrip operasional dan uji, konteks itu tidak ada dan penulisannya berjalan seperti
 * biasa. Promisenya dikembalikan agar pemanggil yang memang perlu memastikan dapat menunggunya.
 */
export function logAudit(params: AuditParams): Promise<void> {
  const tulis = db.auditLog
    .create({
      id: newId(),
      waktu: new Date(),
      aksi: params.aksi,
      detail: params.detail,
      targetNama: params.targetNama ?? null,
      ipAddress: params.ipAddress ?? null,
      userId: params.userId,
    })
    .then(() => undefined)
    .catch((err) => {
      console.error("[auditLog] gagal menulis:", err);
    });

  try {
    getCloudflareContext().ctx.waitUntil(tulis);
  } catch {
    // Bukan di dalam permintaan Workers; penulisannya tetap berjalan sendiri.
  }
  return tulis;
}
