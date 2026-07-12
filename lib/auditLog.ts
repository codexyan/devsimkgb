import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";

interface AuditParams {
  userId: string;
  aksi: string;
  detail: string;
  targetNama?: string;
  ipAddress?: string;
}

/**
 * Tulis audit log ke Google Sheets (tab AuditLog), fire-and-forget:
 * tidak menghentikan response jika gagal.
 */
export function logAudit(params: AuditParams) {
  sheets.auditLog
    .create({
      id: newId(),
      waktu: new Date(),
      aksi: params.aksi,
      detail: params.detail,
      targetNama: params.targetNama ?? null,
      ipAddress: params.ipAddress ?? null,
      userId: params.userId,
    })
    .catch((err) => console.error("[auditLog] gagal menulis:", err));
}
