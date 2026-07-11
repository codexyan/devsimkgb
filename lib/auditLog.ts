import { prisma } from "@/lib/prisma";

interface AuditParams {
  userId: string;
  aksi: string;
  detail: string;
  targetNama?: string;
  ipAddress?: string;
}

/**
 * Tulis audit log, fire-and-forget, tidak menghentikan response jika gagal.
 */
export function logAudit(params: AuditParams) {
  prisma.auditLog
    .create({
      data: {
        aksi: params.aksi,
        detail: params.detail,
        targetNama: params.targetNama ?? null,
        ipAddress: params.ipAddress ?? null,
        userId: params.userId,
      },
    })
    .catch((err) => console.error("[auditLog] gagal menulis:", err));
}
