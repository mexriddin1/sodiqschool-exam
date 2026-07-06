import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound, conflict, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { subjectKeySchema, templateQuestionSchema } from "../lib/schemas.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";

const createSchema = z.object({
  subject: subjectKeySchema,
  grade: z.number().int().min(5).max(11),
  name: z.string().min(1),
  questions: z.array(templateQuestionSchema).min(1),
  // Every template must be attached to an exam (2026-07-03). The old
  // "library" (examId=null) shape is still tolerated by existing rows but
  // no new template can be created without an examId.
  examId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  questions: z.array(templateQuestionSchema).min(1).optional(),
  examId: z.string().uuid().nullable().optional(),
});

export const testTemplatesRouter = Router();
testTemplatesRouter.use(requireAdmin);

testTemplatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    // examId filter values:
    //   "<uuid>" → templates owned by that exam
    //   "null" / "none" → shared library templates (examId IS NULL)
    //   omitted → all
    const examIdRaw = req.query.examId ? String(req.query.examId) : undefined;
    const examIdFilter: Prisma.TestTemplateWhereInput = examIdRaw === "null" || examIdRaw === "none"
      ? { examId: null }
      : examIdRaw ? { examId: examIdRaw } : {};
    const where: Prisma.TestTemplateWhereInput = {
      ...(subject && { subject: subject as Prisma.EnumSubjectKeyFilter }),
      ...(grade && { grade }),
      ...examIdFilter,
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
      examId: t.examId,
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
    const examId = req.query.examId ? String(req.query.examId) : undefined;
    // Exam-scoped lookup is now REQUIRED (2026-07-03). Every template is
    // tied to a specific exam — the legacy library fallback is gone so an
    // import can't accidentally pick up a template from an unrelated exam.
    if (!examId) throw badRequest("EXAM_ID_REQUIRED", "examId query parameter kerak");
    const t = await prisma.testTemplate.findFirst({
      where: { examId, subject: subject as Prisma.EnumSubjectKeyFilter as never, grade },
    });
    if (!t) throw notFound(`Bu imtihonda ${subject} · ${grade}-sinf uchun shablon topilmadi`);
    ok(res, t);
  }),
);

testTemplatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    // Every template is tied to a specific exam (2026-07-03). Uniqueness:
    // one template per (exam, subject, grade). We also enforce that the
    // template's grade lives in the exam's `grades[]` (or matches the legacy
    // `grade` column) so admins can't attach a 5-sinf template to an exam
    // configured only for 8/9/10.
    const exam = await prisma.exam.findUnique({
      where: { id: data.examId },
      select: { id: true, grade: true, grades: true },
    });
    if (!exam) throw notFound("Imtihon topilmadi");
    const allowedGrades = Array.isArray(exam.grades) && exam.grades.length > 0 ? exam.grades : [exam.grade];
    if (!allowedGrades.includes(data.grade)) {
      throw badRequest(
        "GRADE_NOT_ALLOWED",
        `Tanlangan imtihon ${data.grade}-sinf uchun ruxsat bermaydi. Ruxsat etilgan sinflar: ${allowedGrades.join(", ")}`,
      );
    }
    const existing = await prisma.testTemplate.findFirst({
      where: { examId: data.examId, subject: data.subject, grade: data.grade },
    });
    if (existing)
      throw conflict(`Bu imtihonda ${data.subject} · ${data.grade}-sinf uchun shablon allaqachon bor`);
    const t = await prisma.testTemplate.create({
      data: {
        subject: data.subject,
        grade: data.grade,
        name: data.name,
        examId: data.examId,
        questions: data.questions as unknown as Prisma.InputJsonValue,
      },
    });
    await audit(req.admin!.id, "create", "TestTemplate", t.id, null, { name: t.name, subject: t.subject, grade: t.grade, examId: t.examId });
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
        ...(data.examId !== undefined && { examId: data.examId }),
      },
    });
    await audit(req.admin!.id, "update", "TestTemplate", id, { name: prev.name }, { name: t.name });
    ok(res, t);
  }),
);

testTemplatesRouter.post(
  "/:id/clone",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { examId } = z.object({ examId: z.string().uuid() }).parse(req.body);

    const src = await prisma.testTemplate.findUnique({ where: { id } });
    if (!src) throw notFound();

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, grade: true, grades: true },
    });
    if (!exam) throw notFound("Imtihon topilmadi");

    const allowedGrades =
      Array.isArray(exam.grades) && exam.grades.length > 0 ? exam.grades : [exam.grade];
    if (!allowedGrades.includes(src.grade)) {
      throw badRequest(
        "GRADE_NOT_ALLOWED",
        `Tanlangan imtihon ${src.grade}-sinf uchun ruxsat bermaydi. Ruxsat etilgan sinflar: ${allowedGrades.join(", ")}`,
      );
    }

    const existing = await prisma.testTemplate.findFirst({
      where: { examId, subject: src.subject, grade: src.grade },
    });
    if (existing)
      throw conflict(`Bu imtihonda ${src.subject} · ${src.grade}-sinf uchun shablon allaqachon bor`);

    const t = await prisma.testTemplate.create({
      data: {
        subject: src.subject,
        grade: src.grade,
        name: src.name + " (nusxa)",
        examId,
        questions: src.questions as unknown as Prisma.InputJsonValue,
      },
    });
    await audit(req.admin!.id, "create", "TestTemplate", t.id, null, {
      name: t.name, subject: t.subject, grade: t.grade, examId: t.examId, clonedFrom: src.id,
    });
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
