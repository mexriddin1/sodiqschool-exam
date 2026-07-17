import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";
import { deleteLeadCascade } from "../lib/person-delete.js";
import { audit } from "../services/audit.js";

// Leads = self-signup students who filled the intake form on the new
// test-taking site. Status transitions happen via the public.testtaking flow
// (FORM_ONLY → STARTED → COMPLETED → PUBLISHED); admin can bulk-delete.

export const leadsRouter = Router();
leadsRouter.use(requireAdmin);

leadsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const search = req.query.search ? String(req.query.search).trim() : "";
    const where: Prisma.LeadWhereInput = {
      ...(status && { status: status as Prisma.EnumLeadStatusFilter }),
      ...(grade && { grade }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      }),
    };
    const p = parsePagination(req, { defaultTake: 50, maxTake: 500 });
    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.take,
        include: {
          _count: { select: { attempts: true } },
          student: { select: { id: true, loginCode: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);
    const items = rows.map((l) => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      sex: l.sex,
      phone: l.phone,
      grade: l.grade,
      examLanguage: l.examLanguage,
      status: l.status,
      studentId: l.studentId,
      loginCode: l.student?.loginCode ?? null,
      attemptCount: l._count.attempts,
      createdAt: l.createdAt,
    }));
    ok(res, wrapPaginated(items, total, p));
  }),
);

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

// Tanlangan leadlarni butunlay o'chiradi: har biri + urinishlari, va agar
// imtihonni tugatgan bo'lsa o'quvchisi + natija/hisoboti ham (person-delete).
// Har lead alohida tranzaksiyada — biri yiqilsa qolganlari o'chgan bo'ladi.
leadsRouter.post(
  "/bulk-delete",
  asyncHandler(async (req, res) => {
    const { ids } = bulkDeleteSchema.parse(req.body);
    const unique = [...new Set(ids)];
    let deleted = 0;
    const failed: string[] = [];
    for (const id of unique) {
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead) continue;
      try {
        await deleteLeadCascade(id);
        await audit(req.admin!.id, "delete", "Lead", id, lead, null);
        deleted++;
      } catch (e) {
        console.error("[leads] bulk-delete failed for", id, e);
        failed.push(id);
      }
    }
    ok(res, { deleted, failed });
  }),
);

leadsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findUnique({
      where: { id: String(req.params.id) },
      include: {
        student: true,
        attempts: {
          orderBy: { startedAt: "desc" },
          include: {
            test: { select: { id: true, name: true, subject: true, grade: true } },
            result: { select: { id: true, status: true, publicCode: true } },
          },
        },
      },
    });
    if (!lead) throw notFound();
    ok(res, lead);
  }),
);
