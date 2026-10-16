import { ActorRole, AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface WriteAuditParams {
  actorId: string;
  actorRole: ActorRole;
  patientId: string;
  action: AuditAction;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes an immutable append-only HIPAA AuditLog entry.
 * Note: UPDATE and DELETE are blocked at the PostgreSQL trigger level (`trg_audit_log_immutable`).
 */
export async function logAudit(params: WriteAuditParams) {
  return await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorRole: params.actorRole,
      patientId: params.patientId,
      action: params.action,
      ipAddress: params.ipAddress ?? "127.0.0.1",
      metadata: params.metadata ?? {},
    },
  });
}
