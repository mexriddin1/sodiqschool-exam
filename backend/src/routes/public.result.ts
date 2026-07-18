import { Router } from "express";
import bcrypt from "bcryptjs";
import { normalizePublicCode } from "@sodiq/compute";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { unauthorized, notFound } from "../lib/errors.js";
import { resultLoginSchema } from "../lib/schemas.js";
import {
  RESULT_COOKIE,
  cookieOptions,
  requireResultSession,
  signResultToken,
} from "../middleware/auth.js";

const RESULT_COOKIE_AGE_MS = 1 * 24 * 60 * 60 * 1000;

// "Rivojlanish yo'li" (roadmap) sekiyasi publish/ochilishdan keyin shuncha
// vaqt ochiq turadi, keyin avto yopiladi.
const ROADMAP_WINDOW_MS = 20 * 60 * 1000;

export const publicResultRouter = Router();

/**
 * Student uchun bir marta login — parol tekshiruvi ikki bosqichda:
 *   1) Student.loginCode + Student.accessPasswordHash (yangi tizim)
 *   2) Result.publicCode + Result.accessPasswordHash (eski, backward compat)
 * Eski kredensiallar bilan kirgan foydalanuvchi ham darrov o'z student
 * akkauntiga bog'lab beriladi — token endi student ustidan yoziladi.
 */
publicResultRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const parsed = resultLoginSchema.parse(req.body);
    const code = normalizePublicCode(parsed.code);
    const generic = unauthorized("Kod yoki parol noto'g'ri");

    // Yangi shape: Student.loginCode bo'yicha izlash.
    const student = await prisma.student.findFirst({
      where: { loginCode: code },
      select: { id: true, loginCode: true, accessPasswordHash: true },
    });
    if (student?.accessPasswordHash) {
      const okp = await bcrypt.compare(parsed.password, student.accessPasswordHash);
      if (okp) {
        const token = signResultToken({ sub: student.id, code: student.loginCode!, kind: "student" });
        res.cookie(RESULT_COOKIE, token, cookieOptions(RESULT_COOKIE_AGE_MS));
        return ok(res, { studentId: student.id, token });
      }
    }

    // Legacy: Result.publicCode bo'yicha izlash — foydalanuvchi eski
    // credentiallar bilan kelgan bo'lsa hisobiga bog'lab beramiz.
    const legacyResult = await prisma.result.findUnique({
      where: { publicCode: code },
      select: {
        id: true, publicCode: true, status: true, accessPasswordHash: true,
        student: { select: { id: true, loginCode: true } },
      },
    });
    if (!legacyResult || legacyResult.status === "ARCHIVED") throw generic;
    const legacyOk = await bcrypt.compare(parsed.password, legacyResult.accessPasswordHash);
    if (!legacyOk) throw generic;
    // Kirish muvaffaqiyat — tokenni student ustidan chiqaramiz. Studentga
    // login/parol keyinroq ensureStudentCredentials orqali biriktiriladi;
    // ushbu login uchun esa hozircha shu kod bilan davom etamiz.
    const sub = legacyResult.student.id;
    const codeForToken = legacyResult.student.loginCode ?? legacyResult.publicCode;
    const token = signResultToken({ sub, code: codeForToken, kind: "student" });
    res.cookie(RESULT_COOKIE, token, cookieOptions(RESULT_COOKIE_AGE_MS));
    return ok(res, { studentId: sub, token });
  }),
);

publicResultRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(RESULT_COOKIE, { path: "/" });
  ok(res, { loggedOut: true });
});

publicResultRouter.get(
  "/auth/me",
  requireResultSession,
  asyncHandler(async (req, res) => {
    ok(res, {
      studentId: req.resultSession!.studentId ?? null,
      resultId: req.resultSession!.resultId ?? null,
      publicCode: req.resultSession!.publicCode,
    });
  }),
);

/**
 * Studentga tegishli barcha natijalarni qaytaradi (ARCHIVED emas). Client
 * ushbu ro'yxatga qarab:
 *   0 → "Sizga hali natija biriktirilmagan"
 *   1 → avtomatik shu natija sahifasiga o'tadi
 *   ≥2 → tanlash sahifasi
 */
publicResultRouter.get(
  "/list",
  requireResultSession,
  asyncHandler(async (req, res) => {
    const studentId = req.resultSession!.studentId;
    if (!studentId) {
      // Legacy token (faqat resultId bilan) → o'sha bittani qaytaramiz.
      const rid = req.resultSession!.resultId;
      if (!rid) throw unauthorized();
      const r = await prisma.result.findUnique({
        where: { id: rid },
        include: { exam: true, student: { select: { fullName: true, grade: true } } },
      });
      if (!r || r.status === "ARCHIVED") throw notFound();
      return ok(res, {
        student: { fullName: r.student.fullName, grade: r.student.grade },
        results: [pickListRow(r)],
      });
    }
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, grade: true },
    });
    if (!student) throw notFound();
    const results = await prisma.result.findMany({
      where: { studentId, NOT: { status: "ARCHIVED" } },
      include: { exam: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    ok(res, {
      student: { fullName: student.fullName, grade: student.grade },
      results: results.map(pickListRow),
    });
  }),
);

function pickListRow(r: { id: string; publicCode: string; status: string; publishedAt: Date | null; createdAt: Date; calculatedSnapshot: unknown; exam: { title: string; examDate: Date; academicYear: string | null; grade: number } }) {
  const snap = (r.calculatedSnapshot ?? {}) as Record<string, unknown>;
  const composite = (snap.composite as { composite?: number } | undefined)?.composite ?? null;
  return {
    id: r.id,
    publicCode: r.publicCode,
    status: r.status,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    exam: {
      title: r.exam.title,
      examDate: r.exam.examDate,
      academicYear: r.exam.academicYear,
      grade: r.exam.grade,
    },
    compositeScore: composite,
  };
}

async function assertOwned(session: NonNullable<import("express").Request["resultSession"]>, resultId: string) {
  const r = await prisma.result.findUnique({
    where: { id: resultId },
    include: { student: true, exam: true, subjects: true },
  });
  if (!r) throw notFound();
  if (r.status === "ARCHIVED") throw unauthorized("Result is no longer available");
  if (session.studentId && r.studentId !== session.studentId) throw notFound();
  if (!session.studentId && session.resultId && r.id !== session.resultId) throw notFound();
  return r;
}

/**
 * Hozirgi "aktiv" natijani qaytaradi. Query paramda `resultId` berilsa —
 * shu, aks holda studentga tegishli birinchi (yoki yagona) natija.
 * Har ikki holda ham foydalanuvchi haqiqiy egasi ekanligi tekshiriladi.
 */
publicResultRouter.get(
  "/me",
  requireResultSession,
  asyncHandler(async (req, res) => {
    const session = req.resultSession!;
    let targetId = typeof req.query.resultId === "string" ? req.query.resultId : "";
    if (!targetId) {
      // Legacy: token faqat resultId ni ko'rsatadi.
      if (session.resultId) targetId = session.resultId;
      // Yangi: student uchun birinchi natijani tanlaymiz.
      else if (session.studentId) {
        const first = await prisma.result.findFirst({
          where: { studentId: session.studentId, NOT: { status: "ARCHIVED" } },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          select: { id: true },
        });
        if (!first) throw notFound("Sizga hali imtihon natijasi biriktirilmagan.");
        targetId = first.id;
      } else {
        throw unauthorized();
      }
    }
    const result = await assertOwned(session, targetId);
    ok(res, {
      student: {
        fullName: result.student.fullName,
        grade: result.student.grade,
        sex: result.student.sex,
      },
      exam: {
        title: result.exam.title,
        examDate: result.exam.examDate,
        grade: result.exam.grade,
        academicYear: result.exam.academicYear,
        cohortSize: result.exam.cohortSize,
        gradingConfiguration: result.exam.gradingConfiguration,
      },
      publishedAt: result.publishedAt,
      manualContent: result.manualContent,
      subjects: result.subjects.map((s) => ({
        subject: s.subject,
        totalQuestions: s.totalQuestions,
        totalMarks: s.totalMarks,
        questions: s.questions,
        realData: s.realData,
        manualNotes: s.manualNotes,
      })),
      calculatedSnapshot: result.calculatedSnapshot,
      aiNarrative: result.aiNarrative,
      unlockedSections: result.unlockedSections ?? [],
      // "Rivojlanish yo'li" DOIMIY toggle emas — publish yoki admin "ochish"
      // paytidan 20 daqiqagina ochiq. O'sish ko'rsatkichi bundan mustaqil
      // (client'da doim ochiq). Vaqtni SERVER hisoblaydi (bitta "hozir").
      roadmapOpen:
        result.roadmapOpenedAt != null &&
        Date.now() - new Date(result.roadmapOpenedAt).getTime() < ROADMAP_WINDOW_MS,
      resultId: result.id,
    });
  }),
);
