import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { testCreateSchema, testUpdateSchema } from "../lib/schemas.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";

// Live admin-authored tests (natijalar.sodiqschool.uz flow). Each Test is
// bound to a TestTemplate ("yorliq") and must have the SAME number of
// questions as the template — the template dictates the pedagogical structure
// and the test fills in real content.

export const testsRouter = Router();
testsRouter.use(requireAdmin);

testsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const examId = req.query.examId ? String(req.query.examId) : undefined;
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const where: Prisma.TestWhereInput = {
      ...(examId && { examId }),
      ...(subject && { subject: subject as Prisma.EnumSubjectKeyFilter }),
      ...(grade && { grade }),
    };
    const p = parsePagination(req, { defaultTake: 50, maxTake: 500 });
    const [rows, total] = await Promise.all([
      prisma.test.findMany({
        where,
        orderBy: [{ grade: "asc" }, { subject: "asc" }, { name: "asc" }],
        skip: p.skip,
        take: p.take,
      }),
      prisma.test.count({ where }),
    ]);
    const items = rows.map((t) => ({
      id: t.id,
      examId: t.examId,
      templateId: t.templateId,
      name: t.name,
      subject: t.subject,
      grade: t.grade,
      languages: t.languages,
      durationSec: t.durationSec,
      questionCount: Array.isArray(t.questions) ? (t.questions as unknown[]).length : 0,
      updatedAt: t.updatedAt,
    }));
    ok(res, wrapPaginated(items, total, p));
  }),
);

testsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const t = await prisma.test.findUnique({ where: { id: String(req.params.id) } });
    if (!t) throw notFound();
    ok(res, t);
  }),
);

async function assertQuestionCountMatchesTemplate(templateId: string, count: number) {
  const tpl = await prisma.testTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, questions: true, name: true },
  });
  if (!tpl) throw notFound("Yorliq (shablon) topilmadi");
  const tplCount = Array.isArray(tpl.questions) ? (tpl.questions as unknown[]).length : 0;
  if (tplCount !== count) {
    throw badRequest(
      "QUESTION_COUNT_MISMATCH",
      `Yorliqda ${tplCount} ta savol bor, siz ${count} ta savol kiritdingiz. Ular teng bo'lishi shart.`,
    );
  }
}

testsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = testCreateSchema.parse(req.body);

    // Exam + template checks — grade must be allowed by exam.
    const exam = await prisma.exam.findUnique({
      where: { id: data.examId },
      select: { id: true, grade: true, grades: true },
    });
    if (!exam) throw notFound("Imtihon topilmadi");
    const allowed = Array.isArray(exam.grades) && exam.grades.length > 0 ? exam.grades : [exam.grade];
    if (!allowed.includes(data.grade)) {
      throw badRequest(
        "GRADE_NOT_ALLOWED",
        `Bu imtihon ${data.grade}-sinf uchun mos emas. Ruxsat: ${allowed.join(", ")}`,
      );
    }
    await assertQuestionCountMatchesTemplate(data.templateId, data.questions.length);

    const t = await prisma.test.create({
      data: {
        examId: data.examId,
        templateId: data.templateId,
        name: data.name,
        subject: data.subject,
        grade: data.grade,
        languages: data.languages,
        durationSec: data.durationSec ?? null,
        questions: data.questions as unknown as Prisma.InputJsonValue,
      },
    });
    await audit(req.admin!.id, "create", "Test", t.id, null, {
      name: t.name, subject: t.subject, grade: t.grade, examId: t.examId, templateId: t.templateId,
    });
    ok(res, t);
  }),
);

testsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = testUpdateSchema.parse(req.body);
    const prev = await prisma.test.findUnique({ where: { id } });
    if (!prev) throw notFound();

    if (data.questions) {
      await assertQuestionCountMatchesTemplate(
        data.templateId ?? prev.templateId,
        data.questions.length,
      );
    }

    const t = await prisma.test.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.languages !== undefined && { languages: data.languages }),
        ...(data.durationSec !== undefined && { durationSec: data.durationSec }),
        ...(data.templateId !== undefined && { templateId: data.templateId }),
        ...(data.examId !== undefined && { examId: data.examId }),
        ...(data.questions !== undefined && {
          questions: data.questions as unknown as Prisma.InputJsonValue,
        }),
      },
    });
    await audit(req.admin!.id, "update", "Test", id, { name: prev.name }, { name: t.name });
    ok(res, t);
  }),
);

testsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.test.findUnique({ where: { id } });
    if (!prev) throw notFound();
    // Reject deletion when attempts exist so we don't silently orphan Results.
    const attemptCount = await prisma.testAttempt.count({ where: { testId: id } });
    if (attemptCount > 0) {
      throw badRequest(
        "TEST_HAS_ATTEMPTS",
        `Bu testda ${attemptCount} ta urinish (attempt) bor. Avval ularni tozalang.`,
      );
    }
    await prisma.test.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "Test", id, { name: prev.name }, null);
    ok(res, { deleted: true });
  }),
);
