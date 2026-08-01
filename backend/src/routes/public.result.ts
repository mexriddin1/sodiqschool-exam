import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { normalizePublicCode } from "@sodiq/compute";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { buildResourceCatalog } from "../services/resource-catalog.js";
import { unauthorized, notFound } from "../lib/errors.js";
import { nameKey, studentNameKey } from "../lib/name-match.js";
import { resultLoginSchema, resultLookupSchema } from "../lib/schemas.js";
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

// Kirish urinishlarini sekinlashtiradi. Familya+ism+sinf bilan kirishda hech
// qanday sir yo'q, ya'ni bu limiter — butun bazani sanab chiqishga qarshi
// yagona to'siq. Eski kod+parol endpointi ham shu limiter ostida.
//
// Faqat MUVAFFAQIYATSIZ urinishlar sanaladi (`skipSuccessfulRequests`). Sabab:
// mobil operatorlar CGNAT ishlatadi — bitta tashqi IP ortida yuzlab ota-ona
// bo'lishi mumkin, ya'ni oddiy hisoblagich haqiqiy foydalanuvchilarni bloklab
// qo'yardi. Ismni taxmin qilib sanab chiqayotgan bot esa aynan xatolar
// hisobiga tez to'siqqa uriladi.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_ATTEMPTS",
      message: "Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urinib ko'ring.",
      fields: {},
    },
  },
});

/**
 * Student uchun bir marta login — parol tekshiruvi ikki bosqichda:
 *   1) Student.loginCode + Student.accessPasswordHash (yangi tizim)
 *   2) Result.publicCode + Result.accessPasswordHash (eski, backward compat)
 * Eski kredensiallar bilan kirgan foydalanuvchi ham darrov o'z student
 * akkauntiga bog'lab beriladi — token endi student ustidan yoziladi.
 */
publicResultRouter.post(
  "/auth/login",
  authLimiter,
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

/**
 * Kod/parolsiz kirish: familya + ism + sinf.
 *
 * Ota-onalar kirish kodi va parolini yo'qotib qo'yishgani uchun qo'shildi.
 * Bu — QIDIRUV, autentifikatsiya emas: ism-familya-sinf sir emas, ya'ni
 * hisobot amalda ochiq. Ataylab shunday (qarang docs/security-notes.md);
 * yagona to'siq — `authLimiter`.
 *
 * Bir xil ism-familya-sinfli bir nechta Student bo'lishi mumkin (funnel
 * formani ikki marta to'ldirgan o'quvchi uchun yangi yozuv yaratadi), shuning
 * uchun token BARCHA mos kelgan id'larni ko'taradi va /list ularning
 * natijalarini birlashtirib beradi.
 */
publicResultRouter.post(
  "/auth/lookup",
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resultLookupSchema.parse(req.body);
    const key = nameKey([parsed.firstName, parsed.lastName]);

    // Natijasi yo'q o'quvchi umuman qidiruvga tushmaydi — bo'sh sessiya
    // ochilib "natija biriktirilmagan" deb turgandan ko'ra, "topilmadi" deyish
    // to'g'riroq (va o'quvchining mavjudligini ham oshkor qilmaydi).
    const candidates = await prisma.student.findMany({
      where: { grade: parsed.grade, results: { some: { NOT: { status: "ARCHIVED" } } } },
      select: { id: true, fullName: true, firstName: true, lastName: true },
    });
    const matched = candidates.filter((c) => studentNameKey(c) === key);

    if (matched.length === 0) {
      throw notFound(
        "O'quvchi topilmadi. Familya, ism va sinfni tekshiring — sinf imtihon topshirgan paytdagi sinf bo'lishi kerak.",
      );
    }

    const ids = matched.map((m) => m.id);
    const token = signResultToken({ sub: ids[0]!, code: key, kind: "students", ids });
    res.cookie(RESULT_COOKIE, token, cookieOptions(RESULT_COOKIE_AGE_MS));
    return ok(res, { studentId: ids[0], token });
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
      studentId: req.resultSession!.studentIds?.[0] ?? null,
      studentIds: req.resultSession!.studentIds ?? [],
      resultId: req.resultSession!.resultId ?? null,
      publicCode: req.resultSession!.publicCode,
    });
  }),
);

/**
 * Sessiyaga tegishli barcha natijalarni qaytaradi (ARCHIVED emas). Client
 * ushbu ro'yxatga qarab:
 *   0 → "Sizga hali natija biriktirilmagan"
 *   1 → avtomatik shu natija sahifasiga o'tadi
 *   ≥2 → tanlash sahifasi
 *
 * Familya+ism bilan kirganda sessiyada bir nechta o'quvchi bo'lishi mumkin —
 * ularning natijalari bitta ro'yxatga birlashtiriladi (`multipleStudents`
 * bayrog'i client'ga qatorlarni sana bilan farqlashni aytadi).
 */
publicResultRouter.get(
  "/list",
  requireResultSession,
  asyncHandler(async (req, res) => {
    const studentIds = req.resultSession!.studentIds;
    if (!studentIds?.length) {
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
        multipleStudents: false,
        results: [pickListRow(r)],
      });
    }
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, fullName: true, grade: true },
    });
    if (students.length === 0) throw notFound();
    const results = await prisma.result.findMany({
      where: { studentId: { in: studentIds }, NOT: { status: "ARCHIVED" } },
      include: { exam: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    ok(res, {
      // Bir nechta o'quvchi bo'lsa ularning ismi ham, sinfi ham bir xil
      // (qidiruv aynan shu bo'yicha topgan) — birinchisini olsak bo'ladi.
      student: { fullName: students[0]!.fullName, grade: students[0]!.grade },
      multipleStudents: students.length > 1,
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
  // Egalik tekshiruvi — begona `?resultId=` bilan boshqa o'quvchining
  // hisobotini ochib bo'lmasligi aynan shu yerda hal bo'ladi.
  if (session.studentIds?.length && !session.studentIds.includes(r.studentId)) throw notFound();
  if (!session.studentIds?.length && session.resultId && r.id !== session.resultId) throw notFound();
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
      // Yangi: sessiyadagi o'quvchi(lar) uchun birinchi natijani tanlaymiz.
      else if (session.studentIds?.length) {
        const first = await prisma.result.findFirst({
          where: { studentId: { in: session.studentIds }, NOT: { status: "ARCHIVED" } },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          select: { id: true },
        });
        if (!first) throw notFound("Sizga hali imtihon natijasi biriktirilmagan.");
        targetId = first.id;
      } else {
        throw unauthorized();
      }
    }
    const [result, resources] = await Promise.all([
      assertOwned(session, targetId),
      buildResourceCatalog(),
    ]);
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
      aiRoadmap: result.aiRoadmap,
      // Admin-managed learning-resource catalog (global). Threaded into the
      // roadmap render; empty {} → compute uses its bundled resources.json.
      resources,
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
