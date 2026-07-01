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

export const examsRouter = Router();
examsRouter.use(requireAdmin);

examsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;
    const q = String(req.query.q ?? "").trim();
    const where: Prisma.ExamWhereInput = {
      ...(grade && { grade }),
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
      prisma.exam.findMany({ where, orderBy: { examDate: "desc" }, skip: p.skip, take: p.take }),
      prisma.exam.count({ where }),
    ]);
    ok(res, wrapPaginated(rows, total, p));
  }),
);

examsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = examCreateSchema.parse(req.body);
    const exam = await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        examDate: new Date(data.examDate),
        academicYear: data.academicYear ?? null,
        status: data.status ?? "DRAFT",
        grade: data.grade,
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
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.examDate !== undefined && { examDate: new Date(data.examDate) }),
        ...(data.academicYear !== undefined && { academicYear: data.academicYear }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.grade !== undefined && { grade: data.grade }),
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
