import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import {
  AdmissionThresholds,
  generatePassword,
  Question,
  SubjectKey,
  validateQuestions,
} from "@sodiq/compute";

import { prisma } from "../db.js";
import { config } from "../config.js";
import { asyncHandler, ok } from "../lib/response.js";
import { badRequest, notFound, conflict } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { resultCreateSchema, resultUpdateSchema } from "../lib/schemas.js";
import { calculateResult } from "../services/calculation.js";
import { generateUniquePublicCode } from "../services/code.js";
import { audit } from "../services/audit.js";
import { json, jsonOrNull } from "../lib/json.js";
import { computeSnapshot, recomputeCohortRanks } from "../services/snapshot.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";
import { invalidateStats } from "./admin.stats.js";
import { generateResultNarrative } from "../services/ai.js";

export const resultsRouter = Router();
resultsRouter.use(requireAdmin);

const SUBJECT_NAMES: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

function buildSubjectMeta(subject: SubjectKey, grade: number, candidate: string, totals: { totalQuestions: number; totalMarks: number }) {
  return {
    school: "Sodiq School",
    slogan: "Biz ilmga sodiqmiz",
    office: "Academic Assessment Office",
    candidate,
    grade,
    gradeLabel: `${grade}-sinfga nomzod`,
    subject: SUBJECT_NAMES[subject],
    totalQuestions: totals.totalQuestions,
    totalMarks: totals.totalMarks,
    brand: { navy: "#06113C", orange: "#FF8A32" },
  };
}

function validateAllSubjects(subjects: { subject: SubjectKey; questions: Question[] }[]): void {
  for (const s of subjects) {
    const errs = validateQuestions(s.questions);
    if (errs.length > 0) {
      throw badRequest(
        "QUESTION_VALIDATION",
        `Subject ${s.subject}: ${errs.length} validation error(s)`,
        Object.fromEntries(errs.slice(0, 6).map((e) => [`${s.subject}.${e.questionId}.${e.field}`, e.message])),
      );
    }
  }
  const seen = new Set<SubjectKey>();
  for (const s of subjects) {
    if (seen.has(s.subject)) throw badRequest("DUPLICATE_SUBJECT", `Duplicate subject: ${s.subject}`);
    seen.add(s.subject);
  }
}

resultsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const examId = req.query.examId ? String(req.query.examId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const q = String(req.query.q ?? "").trim();
    const sort = String(req.query.sort ?? "created-desc");
    const where: Prisma.ResultWhereInput = {
      ...(examId && { examId }),
      ...(status && { status: status as Prisma.EnumResultStatusFilter }),
      ...(Number.isFinite(grade) && { student: { grade } }),
      ...(q && {
        OR: [
          { publicCode: { contains: q.toUpperCase() } },
          { student: { fullName: { contains: q, mode: "insensitive" } } },
        ],
      }),
    };
    const orderBy: Prisma.ResultOrderByWithRelationInput =
      sort === "created-asc" ? { createdAt: "asc" }
      : sort === "code-asc" ? { publicCode: "asc" }
      : { createdAt: "desc" };
    const p = parsePagination(req);
    // Two queries in parallel: page slice + total-count so the client can render
    // pagination controls without a second round-trip.
    const [rows, total] = await Promise.all([
      prisma.result.findMany({
        where,
        orderBy,
        // narrow select — the list page never renders manualContent/snapshot
        select: {
          id: true, publicCode: true, status: true, publishedAt: true,
          createdAt: true, updatedAt: true,
          student: { select: { id: true, fullName: true, grade: true } },
          exam: { select: { id: true, title: true, grade: true } },
        },
        skip: p.skip,
        take: p.take,
      }),
      prisma.result.count({ where }),
    ]);
    ok(res, wrapPaginated(rows, total, p));
  }),
);

resultsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = resultCreateSchema.parse(req.body);
    const [student, exam] = await Promise.all([
      prisma.student.findUnique({ where: { id: data.studentId } }),
      prisma.exam.findUnique({ where: { id: data.examId } }),
    ]);
    if (!student) throw notFound("Student not found");
    if (!exam) throw notFound("Exam not found");
    if (exam.grade !== student.grade)
      throw badRequest("GRADE_MISMATCH", `Exam grade ${exam.grade} != student grade ${student.grade}`);

    validateAllSubjects(data.subjects);

    // Pre-compute totals + run calculation to surface errors before insert.
    const subjectInputs = data.subjects.map((s) => {
      const totalQuestions = s.totalQuestions ?? s.questions.length;
      const totalMarks = s.totalMarks ?? s.questions.reduce((sum, q) => sum + q.marks, 0);
      return {
        subject: s.subject as SubjectKey,
        meta: buildSubjectMeta(s.subject as SubjectKey, exam.grade, student.fullName, { totalQuestions, totalMarks }),
        questions: s.questions as Question[],
        realData: s.realData ?? undefined,
        manualNotes: s.manualNotes ?? {},
        totalQuestions,
        totalMarks,
      };
    });

    calculateResult({
      grade: exam.grade,
      thresholds: exam.admissionThresholds as AdmissionThresholds,
      subjects: subjectInputs.map(({ subject, meta, questions, realData }) => ({ subject, meta, questions, realData })),
    });

    const publicCode = await generateUniquePublicCode();
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, config.bcryptCost);

    const result = await prisma.result.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        publicCode,
        accessPasswordHash: passwordHash,
        accessPassword: plainPassword,
        // Auto-publish on create so parents can log in immediately with the
        // credentials shown to the admin. No separate "Nashr etish" step is
        // required per operator preference.
        status: "PUBLISHED",
        publishedAt: new Date(),
        manualContent: json(data.manualContent),
        subjects: {
          create: subjectInputs.map((s) => ({
            subject: s.subject,
            totalQuestions: s.totalQuestions,
            totalMarks: s.totalMarks,
            questions: s.questions as unknown as Prisma.InputJsonValue,
            realData: jsonOrNull(s.realData),
            manualNotes: jsonOrNull(s.manualNotes),
          })),
        },
      },
      include: { subjects: true, student: true, exam: true },
    });
    // Freeze the calculated snapshot right away so the client renders the
    // report from the same numbers admin previewed.
    try {
      const snapshot = computeSnapshot(result);
      await prisma.result.update({
        where: { id: result.id },
        data: { calculatedSnapshot: snapshot as unknown as Prisma.InputJsonValue },
      });
      await recomputeCohortRanks(result.examId);
      invalidateStats();
      // Kick off narrative generation in the background — publish response
      // returns immediately, admin isn't blocked by the DeepSeek run.
      generateAndSaveNarrative(result.id).catch((e) =>
        console.error("[ai] create-time generation failed for", result.id, e),
      );
    } catch (e) {
      console.error("[create] auto-publish side-effects failed:", e);
    }
    await audit(req.admin!.id, "create", "Result", result.id, null, { id: result.id, publicCode });

    ok(res, {
      result,
      // The plain password is returned exactly once. Admin UI must display it
      // and never persist it client-side.
      credentials: { publicCode, password: plainPassword },
    });
  }),
);

resultsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.result.findUnique({
      where: { id: String(req.params.id) },
      include: { subjects: true, student: true, exam: true },
    });
    if (!result) throw notFound();
    ok(res, result);
  }),
);

resultsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = resultUpdateSchema.parse(req.body);
    const prev = await prisma.result.findUnique({
      where: { id: String(req.params.id) },
      include: { subjects: true, student: true, exam: true },
    });
    if (!prev) throw notFound();
    if (prev.status === "ARCHIVED") throw conflict("Archived results cannot be edited");

    let subjectsUpdate: Prisma.ResultUpdateInput["subjects"] | undefined;
    if (data.subjects) {
      validateAllSubjects(data.subjects);
      const inputs = data.subjects.map((s) => {
        const totalQuestions = s.totalQuestions ?? s.questions.length;
        const totalMarks = s.totalMarks ?? s.questions.reduce((sum, q) => sum + q.marks, 0);
        return {
          subject: s.subject as SubjectKey,
          meta: buildSubjectMeta(s.subject as SubjectKey, prev.exam.grade, prev.student.fullName, { totalQuestions, totalMarks }),
          questions: s.questions as Question[],
          realData: s.realData ?? undefined,
          manualNotes: s.manualNotes ?? {},
          totalQuestions,
          totalMarks,
        };
      });
      calculateResult({
        grade: prev.exam.grade,
        thresholds: prev.exam.admissionThresholds as AdmissionThresholds,
        subjects: inputs.map(({ subject, meta, questions, realData }) => ({ subject, meta, questions, realData })),
      });
      subjectsUpdate = {
        deleteMany: {},
        create: inputs.map((s) => ({
          subject: s.subject,
          totalQuestions: s.totalQuestions,
          totalMarks: s.totalMarks,
          questions: s.questions as unknown as Prisma.InputJsonValue,
          realData: jsonOrNull(s.realData),
          manualNotes: jsonOrNull(s.manualNotes),
        })),
      };
    }

    const updated = await prisma.result.update({
      where: { id: prev.id },
      data: {
        ...(data.manualContent && { manualContent: json(data.manualContent) }),
        ...(subjectsUpdate && { subjects: subjectsUpdate }),
      },
      include: { subjects: true },
    });
    await audit(req.admin!.id, "update", "Result", updated.id, prev, updated);
    ok(res, updated);
  }),
);

resultsRouter.get(
  "/:id/preview",
  asyncHandler(async (req, res) => {
    const result = await prisma.result.findUnique({
      where: { id: String(req.params.id) },
      include: { subjects: true, student: true, exam: true },
    });
    if (!result) throw notFound();
    const calc = calculateResult({
      grade: result.exam.grade,
      thresholds: result.exam.admissionThresholds as AdmissionThresholds,
      subjects: result.subjects.map((s) => ({
        subject: s.subject as SubjectKey,
        meta: buildSubjectMeta(s.subject as SubjectKey, result.exam.grade, result.student.fullName, {
          totalQuestions: s.totalQuestions,
          totalMarks: s.totalMarks,
        }),
        questions: s.questions as unknown as Question[],
        realData: (s.realData ?? undefined) as { percentile: number | null; cohortAverage: number | null; avgTimeSec: number | null } | undefined,
      })),
    });
    ok(res, {
      student: result.student,
      exam: result.exam,
      manualContent: result.manualContent,
      subjects: result.subjects,
      computed: calc,
    });
  }),
);

// ---------- lifecycle: publish / unpublish / archive / reset-password -------

resultsRouter.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await prisma.result.findUnique({
      where: { id },
      include: { subjects: true, student: true, exam: true },
    });
    if (!result) throw notFound();
    if (result.status === "PUBLISHED") throw conflict("Already published");
    if (result.status === "ARCHIVED") throw conflict("Cannot publish archived result");
    if (result.subjects.length !== 3)
      throw badRequest("MISSING_SUBJECTS", "All three subjects must be present before publish");

    const snapshot = computeSnapshot(result);
    await prisma.result.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        calculatedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await recomputeCohortRanks(result.examId);
    invalidateStats();
    await audit(req.admin!.id, "publish", "Result", id, { status: result.status }, { status: "PUBLISHED" });
    // Fire-and-forget AI narrative generation. Publish returns immediately so
    // the admin isn't blocked by a 30-second DeepSeek run; when the promise
    // resolves the result gets aiNarrative + aiUsage rows.
    generateAndSaveNarrative(id).catch((e) =>
      console.error("[ai] publish-time generation failed for", id, e),
    );
    const fresh = await prisma.result.findUnique({ where: { id }, include: { subjects: true } });
    ok(res, fresh);
  }),
);

// Standalone endpoint so the admin can re-generate narrative on demand (after
// a manual edit, or if the auto-run on publish failed).
resultsRouter.post(
  "/:id/generate-ai",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const outcome = await generateAndSaveNarrative(id);
    ok(res, outcome);
  }),
);

// Shared narrative generator: loads the result, calls DeepSeek, writes back
// aiNarrative/aiUsage, and invalidates the stats cache so the dashboard's
// token-usage widget refreshes.
async function generateAndSaveNarrative(id: string) {
  const result = await prisma.result.findUnique({
    where: { id },
    include: { subjects: true, student: true, exam: true },
  });
  if (!result) throw notFound();
  const bySubject = new Map(result.subjects.map((s) => [s.subject, s] as const));
  const buildSubject = (subject: SubjectKey) => {
    const s = bySubject.get(subject);
    if (!s) throw badRequest("MISSING_SUBJECT", `${subject} not present on result`);
    return {
      meta: {
        school: "Sodiq School",
        slogan: "Biz ilmga sodiqmiz",
        office: "Academic Assessment Office",
        candidate: result.student.fullName,
        grade: result.exam.grade,
        gradeLabel: `${result.exam.grade}-sinfga nomzod`,
        subject: SUBJECT_NAMES[subject],
        totalQuestions: s.totalQuestions,
        totalMarks: s.totalMarks,
        brand: { navy: "#06113C", orange: "#FF8A32" },
      },
      questions: s.questions as unknown as Question[],
      realData: (s.realData ?? undefined) as
        | { percentile: number | null; cohortAverage: number | null; avgTimeSec: number | null }
        | undefined,
    };
  };
  const out = await generateResultNarrative({
    student: { fullName: result.student.fullName, grade: result.exam.grade },
    math: buildSubject("MATH"),
    english: buildSubject("ENGLISH"),
    criticalThinking: buildSubject("CRITICAL_THINKING"),
    gradingConfiguration: result.exam.gradingConfiguration,
  });
  await prisma.result.update({
    where: { id },
    data: {
      aiNarrative: out.narrative as unknown as Prisma.InputJsonValue,
      aiUsage: out.usage as unknown as Prisma.InputJsonValue,
    },
  });
  invalidateStats();
  return out;
}

resultsRouter.post(
  "/:id/unpublish",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) throw notFound();
    if (result.status !== "PUBLISHED") throw conflict("Only PUBLISHED results can be unpublished");
    await prisma.result.update({
      where: { id },
      data: { status: "DRAFT", publishedAt: null },
    });
    await recomputeCohortRanks(result.examId);
    invalidateStats();
    await audit(req.admin!.id, "unpublish", "Result", id, { status: "PUBLISHED" }, { status: "DRAFT" });
    ok(res, { id, status: "DRAFT" });
  }),
);

resultsRouter.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) throw notFound();
    if (result.status === "ARCHIVED") throw conflict("Already archived");
    await prisma.result.update({
      where: { id },
      data: { status: "ARCHIVED", publishedAt: null },
    });
    if (result.status === "PUBLISHED") await recomputeCohortRanks(result.examId);
    invalidateStats();
    await audit(req.admin!.id, "archive", "Result", id, { status: result.status }, { status: "ARCHIVED" });
    ok(res, { id, status: "ARCHIVED" });
  }),
);

resultsRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const r = await prisma.result.findUnique({
      where: { id },
      select: { id: true, publicCode: true, student: { select: { fullName: true } } },
    });
    if (!r) throw notFound();
    // Import lazily so Playwright + pdf-lib aren't loaded until first use.
    const { renderResultPdf } = await import("../services/pdf.js");
    const buf = await renderResultPdf(r.id, r.publicCode);
    const safeName = r.student.fullName.replace(/[^a-zA-Z0-9\- ]/g, "").slice(0, 60);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Sodiq_${safeName}_${r.publicCode}.pdf"`);
    res.send(buf);
  }),
);

// Whitelist of section keys the admin can toggle. Any string sent by the
// admin that isn't in this list is dropped — prevents the frontend from
// accidentally shipping a typo key that clients then rely on.
const ALLOWED_SECTION_KEYS = ["narrative", "roadmap", "risks_notes"] as const;

resultsRouter.patch(
  "/:id/unlocked-sections",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const raw = Array.isArray(req.body?.unlockedSections) ? req.body.unlockedSections : [];
    const cleaned = Array.from(
      new Set(
        raw
          .filter((v: unknown) => typeof v === "string")
          .filter((v: string) => (ALLOWED_SECTION_KEYS as readonly string[]).includes(v)),
      ),
    ) as string[];
    const prev = await prisma.result.findUnique({
      where: { id },
      select: { id: true, unlockedSections: true },
    });
    if (!prev) throw notFound();
    const updated = await prisma.result.update({
      where: { id },
      data: { unlockedSections: cleaned },
      select: { id: true, unlockedSections: true },
    });
    await audit(req.admin!.id, "update", "Result", id,
      { unlockedSections: prev.unlockedSections },
      { unlockedSections: updated.unlockedSections },
    );
    ok(res, updated);
  }),
);

resultsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.result.findUnique({
      where: { id },
      select: { id: true, status: true, publicCode: true, examId: true },
    });
    if (!prev) throw notFound();
    // SubjectResult rows cascade on delete (schema).
    await prisma.result.delete({ where: { id } });
    if (prev.status === "PUBLISHED") await recomputeCohortRanks(prev.examId);
    invalidateStats();
    await audit(req.admin!.id, "delete", "Result", id, prev, null);
    ok(res, { deleted: true });
  }),
);

resultsRouter.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) throw notFound();
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, config.bcryptCost);
    await prisma.result.update({
      where: { id },
      data: { accessPasswordHash: passwordHash, accessPassword: plainPassword },
    });
    await audit(req.admin!.id, "reset-password", "Result", id, null, null);
    ok(res, { id, publicCode: result.publicCode, password: plainPassword });
  }),
);
