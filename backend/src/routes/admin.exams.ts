import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { examCreateSchema, examUpdateSchema } from "../lib/schemas.js";
import { audit } from "../services/audit.js";
import { json } from "../lib/json.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";
import { recomputeCohortRanks } from "../services/snapshot.js";

export const examsRouter = Router();
examsRouter.use(requireAdmin);

examsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;
    const q = String(req.query.q ?? "").trim();
    // Grade filter now checks both the legacy `grade` (single) column and
    // the new `grades[]` array so exams with either shape match cleanly.
    const where: Prisma.ExamWhereInput = {
      ...(grade && { OR: [{ grade }, { grades: { has: grade } }] }),
      ...(status && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(status) && { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" }),
      ...(academicYear && { academicYear }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }),
    };
    const p = parsePagination(req, { defaultTake: 10, maxTake: 500 });
    const [rows, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        orderBy: { examDate: "desc" },
        include: { _count: { select: { results: true, templates: true } } },
        skip: p.skip,
        take: p.take,
      }),
      prisma.exam.count({ where }),
    ]);
    ok(res, wrapPaginated(rows, total, p));
  }),
);

// Normalise legacy `grade` (single) + new `grades` (array) input into a
// consistent Prisma payload. First element of `grades` is mirrored into the
// legacy column so code paths that still read `.grade` keep working.
function normaliseGradeFields(input: { grade?: number; grades?: number[] }) {
  const grades = input.grades && input.grades.length > 0
    ? Array.from(new Set(input.grades)).sort((a, b) => a - b)
    : input.grade != null ? [input.grade] : [];
  const grade = grades[0] ?? input.grade ?? 5; // safe fallback
  return { grade, grades };
}

examsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = examCreateSchema.parse(req.body);
    const { grade, grades } = normaliseGradeFields(data);
    const exam = await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        examDate: new Date(data.examDate),
        academicYear: data.academicYear ?? null,
        status: data.status ?? "DRAFT",
        grade,
        grades,
        subjectKeys: data.subjectKeys ?? ["MATH", "ENGLISH", "CRITICAL_THINKING"],
        admissionThresholds: json(data.admissionThresholds),
        gradingConfiguration: json(data.gradingConfiguration),
        cohortSize: data.cohortSize ?? null,
      },
    });
    await audit(req.admin!.id, "create", "Exam", exam.id, null, exam);
    ok(res, exam);
  }),
);

examsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { results: true } } },
    });
    if (!exam) throw notFound();
    ok(res, exam);
  }),
);

examsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = examUpdateSchema.parse(req.body);
    const prev = await prisma.exam.findUnique({ where: { id } });
    if (!prev) throw notFound();
    // Only re-normalise grade fields if the caller supplied at least one of
    // the two shapes, so a `title`-only patch doesn't accidentally reset
    // grades back to a default.
    const gradesPatch = (data.grade !== undefined || data.grades !== undefined)
      ? normaliseGradeFields(data)
      : null;
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.examDate !== undefined && { examDate: new Date(data.examDate) }),
        ...(data.academicYear !== undefined && { academicYear: data.academicYear }),
        ...(data.status !== undefined && { status: data.status }),
        ...(gradesPatch && { grade: gradesPatch.grade, grades: gradesPatch.grades }),
        ...(data.subjectKeys !== undefined && { subjectKeys: data.subjectKeys }),
        ...(data.admissionThresholds !== undefined && {
          admissionThresholds: json(data.admissionThresholds),
        }),
        ...(data.gradingConfiguration !== undefined && {
          gradingConfiguration: json(data.gradingConfiguration),
        }),
        ...(data.cohortSize !== undefined && { cohortSize: data.cohortSize }),
      },
    });
    await audit(req.admin!.id, "update", "Exam", exam.id, prev, exam);
    ok(res, exam);
  }),
);

// Manually re-run cohort rank + sex-split ranking across all published
// results in this exam. Handy after adding a new peer or after the ranking
// logic itself changes and existing snapshots need refreshing.
examsRouter.post(
  "/:id/recompute-cohort",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const exam = await prisma.exam.findUnique({ where: { id }, select: { id: true } });
    if (!exam) throw notFound();
    await recomputeCohortRanks(id);
    const count = await prisma.result.count({ where: { examId: id, status: "PUBLISHED" } });
    await audit(req.admin!.id, "update", "Exam", id, null, { recomputedCohort: count });
    ok(res, { recomputed: count });
  }),
);

examsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.exam.findUnique({ where: { id } });
    if (!prev) throw notFound();
    await prisma.exam.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "Exam", id, prev, null);
    ok(res, { deleted: true });
  }),
);
