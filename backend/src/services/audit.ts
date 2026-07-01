import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

function jsonOrNull(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v === null || v === undefined) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

export async function audit(
  adminUserId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  prev: unknown,
  next: unknown,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminUserId,
      action,
      entityType,
      entityId,
      prev: jsonOrNull(prev),
      next: jsonOrNull(next),
    },
  });
}
