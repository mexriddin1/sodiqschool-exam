import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound, conflict } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { subjectKeySchema, questionSchema } from "../lib/schemas.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";

const createSchema = z.object({
  subject: subjectKeySchema,
  grade: z.number().int().min(5).max(11),
  name: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  questions: z.array(questionSchema).min(1).optional(),
});

export const testTemplatesRouter = Router();
testTemplatesRouter.use(requireAdmin);

testTemplatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const where: Prisma.TestTemplateWhereInput = {
      ...(subject && { subject: subject as Prisma.EnumSubjectKeyFilter }),
      ...(grade && { grade }),
    };
    const p = parsePagination(req, { defaultTake: 10, maxTake: 200 });
    const [rows, total] = await Promise.all([
      prisma.testTemplate.findMany({
        where,
        orderBy: [{ grade: "asc" }, { subject: "asc" }],
        skip: p.skip,
        take: p.take,
      }),
      prisma.testTemplate.count({ where }),
    ]);
    const items = rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      grade: t.grade,
      name: t.name,
      questionCount: Array.isArray(t.questions) ? (t.questions as unknown[]).length : 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    ok(res, wrapPaginated(items, total, p));
  }),
);

testTemplatesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const t = await prisma.testTemplate.findUnique({ where: { id: String(req.params.id) } });
    if (!t) throw notFound();
    ok(res, t);
  }),
);

testTemplatesRouter.get(
  "/by/:subject/:grade",
  asyncHandler(async (req, res) => {
    const subject = String(req.params.subject);
    const grade = Number(req.params.grade);
    const t = await prisma.testTemplate.findUnique({
      where: { subject_grade: { subject: subject as Prisma.EnumSubjectKeyFilter as never, grade } },
    });
    if (!t) throw notFound("Template not found for this subject + grade");
    ok(res, t);
  }),
);

testTemplatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const existing = await prisma.testTemplate.findUnique({
      where: { subject_grade: { subject: data.subject, grade: data.grade } },
    });
    if (existing)
      throw conflict(`Template for ${data.subject} grade ${data.grade} already exists`);
    const t = await prisma.testTemplate.create({
      data: { ...data, questions: data.questions as unknown as Prisma.InputJsonValue },
    });
    await audit(req.admin!.id, "create", "TestTemplate", t.id, null, { name: t.name, subject: t.subject, grade: t.grade });
    ok(res, t);
  }),
);

testTemplatesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = updateSchema.parse(req.body);
    const prev = await prisma.testTemplate.findUnique({ where: { id } });
    if (!prev) throw notFound();
    const t = await prisma.testTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.questions !== undefined && { questions: data.questions as unknown as Prisma.InputJsonValue }),
      },
    });
    await audit(req.admin!.id, "update", "TestTemplate", id, { name: prev.name }, { name: t.name });
    ok(res, t);
  }),
);

testTemplatesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.testTemplate.findUnique({ where: { id } });
    if (!prev) throw notFound();
    await prisma.testTemplate.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "TestTemplate", id, { name: prev.name, subject: prev.subject, grade: prev.grade }, null);
    ok(res, { deleted: true });
  }),
);
