import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { requireAdmin } from "../middleware/auth.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";

export const auditRouter = Router();
auditRouter.use(requireAdmin);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const entityId = req.query.entityId ? String(req.query.entityId) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const q = String(req.query.q ?? "").trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(action && { action }),
      ...(q && {
        OR: [
          { entityId: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
          { action: { contains: q, mode: "insensitive" } },
          { adminUser: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          } },
        ],
      }),
    };
    const p = parsePagination(req, { defaultTake: 20, maxTake: 200 });
    // Amal kesimi bazadan — sahifadagi qatorlardan emas (2026-08-03 xatosi).
    const { action: _ignoredAction, ...whereNoAction } = where;
    const [rows, total, byAction] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
        include: { adminUser: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({ by: ["action"], where: whereNoAction, _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = {};
    for (const row of byAction) counts[row.action] = row._count._all;
    ok(res, { ...wrapPaginated(rows, total, p), counts });
  }),
);
