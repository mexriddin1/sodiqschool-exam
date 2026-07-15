import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import {
  AdmissionThresholds,
  BLOOM_LEVELS,
  DIFFICULTIES,
  Question,
  SubjectKey,
  generatePassword,
} from "@sodiq/compute";

import { prisma } from "../db.js";
import { config } from "../config.js";
import { asyncHandler, ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import {
  attemptAnswersSchema,
  attemptStartSchema,
  leadCreateSchema,
  resolveText,
  TestQuestion,
} from "../lib/schemas.js";
import type { TestLanguage } from "@prisma/client";
import { gradeTest } from "../services/test-grading.js";
import { generateUniquePublicCode } from "../services/code.js";
import { calculateResult } from "../services/calculation.js";
import { ensureStudentCredentials } from "../services/student-credentials.js";
import { readDefaultUnlockedSections, readFunnelOpen } from "./admin.settings.js";

// Public API for the natijalar.sodiqschool.uz site — no admin auth. Anyone
// can submit a lead form; test tokens act as the per-attempt secret so
// answers can only be updated/submitted by the browser that started them.

export const publicTestTakingRouter = Router();

/**
 * Fanlar QAT'IY tartibi: matematika -> ingliz tili -> tanqidiy fikrlash.
 *
 * Tartibni o'quvchi tanlamaydi. Ro'yxat shu bo'yicha saralanadi va test-app
 * faqat navbatdagisini ochiq qiladi (avvalgisi topshirilmaguncha qolganlari
 * qulflangan).
 *
 * Bu — KO'RSATISH tartibi, qo'riqchi emas: /attempts ga to'g'ridan-to'g'ri
 * so'rov yuborib istalgan testni boshlash mumkin. Funnel lead yig'ish uchun,
 * nazorat ostidagi imtihon emas — tartibni serverda majburlash bu yerda
 * himoya qilinadigan narsani himoya qilmaydi.
 */
const SUBJECT_SEQUENCE: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];

/**
 * Qabul testi yopiq bo'lsa — YANGI kirishni to'xtatadi.
 *
 * Faqat "kirish eshiklari"ga qo'yiladi: lead qoldirish, testlar ro'yxati va
 * urinish boshlash. Javob saqlash (PATCH) va yakunlash (submit) ATAYLAB ochiq
 * qoladi — aks holda admin tugmani bosgan zahoti test yozib o'tirgan bolaning
 * ishi yo'qolardi.
 */
const requireFunnelOpen = asyncHandler(async (_req, res, next) => {
  if (await readFunnelOpen()) return next();
  res.status(403).json({
    success: false,
    error: {
      code: "FUNNEL_CLOSED",
      message: "Qabul testi hozircha yopiq.",
      fields: {},
    },
  });
});

// Same-origin CSRF isn't needed here — every mutation carries the token
// generated at start(), which is unguessable and single-use per attempt.

publicTestTakingRouter.post(
  "/leads",
  requireFunnelOpen,
  asyncHandler(async (req, res) => {
    const data = leadCreateSchema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        sex: data.sex,
        phone: data.phone,
        grade: data.grade,
        examLanguage: data.examLanguage,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 512) || null,
      },
    });
    ok(res, { leadId: lead.id });
  }),
);

publicTestTakingRouter.get(
  "/leads/:leadId/tests",
  requireFunnelOpen,
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findUnique({ where: { id: String(req.params.leadId) } });
    if (!lead) throw notFound("Lead topilmadi");
    // Show tests matching the lead's grade AND containing their language in
    // the languages[] set. If a test has an empty languages array we treat
    // it as "all languages" for backward compat with admin drafts.
    const tests = await prisma.test.findMany({
      where: {
        grade: lead.grade,
        OR: [
          { languages: { has: lead.examLanguage } },
          { languages: { isEmpty: true } },
        ],
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        subject: true,
        grade: true,
        languages: true,
        durationSec: true,
        questions: true,
      },
    });

    // Qaysi testlar allaqachon topshirilgan. Bu SUBJECT_SEQUENCE bilan birga
    // "keyingi test" ni aniqlaydi — o'quvchi tartibni tanlamaydi.
    const submitted = await prisma.testAttempt.findMany({
      where: { leadId: lead.id, submittedAt: { not: null } },
      select: { testId: true },
    });
    const done = new Set(submitted.map((a) => a.testId));

    const items = tests
      .map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        grade: t.grade,
        languages: t.languages,
        durationSec: t.durationSec,
        questionCount: Array.isArray(t.questions) ? (t.questions as unknown[]).length : 0,
        completed: done.has(t.id),
      }))
      // Alifbo tartibi EMAS: u CRITICAL_THINKING'ni birinchi qo'yardi.
      // Tartib qat'iy — matematika, ingliz tili, tanqidiy fikrlash.
      .sort((a, b) => SUBJECT_SEQUENCE.indexOf(a.subject) - SUBJECT_SEQUENCE.indexOf(b.subject));

    // `examLanguage` KERAK: test-app butun interfeysini shu tilda ko'rsatadi.
    // Usiz RU lead savollarni ruscha, tugmalarni o'zbekcha ko'rardi.
    ok(res, {
      items,
      lead: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        grade: lead.grade,
        examLanguage: lead.examLanguage,
      },
    });
  }),
);

// Strip the correct-answer fields from a test question before sending it
// to the browser. Otherwise a savvy student could inspect the response
// body and read off the answers.
//
// This is also the ONE place where language is resolved: the student's own
// language (lead.examLanguage) picks one string out of each localized field,
// so test-app never learns that other translations exist and never has to
// know the language at all. Keeping the resolution server-side also means
// the other languages never reach the browser.
function stripAnswers(q: TestQuestion, lang: TestLanguage): unknown {
  const t = (v: Parameters<typeof resolveText>[0]) => resolveText(v, lang);
  const base = {
    id: q.id,
    order: q.order,
    type: q.type,
    marks: q.marks,
    prompt: t(q.prompt),
    imageUrl: q.imageUrl ?? null,
  } as Record<string, unknown>;
  if (q.choices) {
    base.choices = q.choices.map((c) => ({ id: c.id, label: t(c.label), imageUrl: c.imageUrl ?? null }));
  }
  if (q.trueFalseItems) {
    base.trueFalseItems = q.trueFalseItems.map((it) => ({ id: it.id, text: t(it.text) }));
  }
  if (q.gapAnswers) {
    // Bo'shliqlar soni tilga bog'liq emas (schemas.ts izohiga qarang).
    base.gapCount = q.gapAnswers.length;
  }
  if (q.matchingPairs) {
    // Send left column in order; shuffle right column so student maps left→right.
    const rights = q.matchingPairs.map((p) => ({ id: p.rightId, text: t(p.rightText) }));
    // Deterministic shuffle by hashing question id — same each render, but no
    // trivial correlation with left order.
    const seed = q.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const shuffled = [...rights].sort(
      (a, b) => (a.id.charCodeAt(0) + seed) % 13 - (b.id.charCodeAt(0) + seed) % 13,
    );
    base.matchingLefts = q.matchingPairs.map((p) => ({ id: p.leftId, text: t(p.leftText) }));
    base.matchingRights = shuffled;
  }
  if (q.reorderItems) {
    // Send items in their stored order (arbitrary); student reorders them.
    base.reorderItems = q.reorderItems.map((i) => ({ id: i.id, text: t(i.text) }));
  }
  return base;
}

publicTestTakingRouter.post(
  "/attempts",
  requireFunnelOpen,
  asyncHandler(async (req, res) => {
    const { leadId, testId } = attemptStartSchema.parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw notFound("Lead topilmadi");
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw notFound("Test topilmadi");
    if (test.grade !== lead.grade) {
      throw badRequest("GRADE_MISMATCH", "Bu test sizning sinfingizga mos emas.");
    }

    // Ensure a Student row exists for this lead. Self-signup students get a
    // synthetic UID = lead id so their credentials never collide with the
    // admin-managed roster.
    let studentId = lead.studentId;
    if (!studentId) {
      const fullName = `${lead.firstName} ${lead.lastName}`.trim();
      const student = await prisma.student.create({
        data: {
          fullName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          sex: lead.sex,
          grade: lead.grade,
          examLanguage: lead.examLanguage,
          uid: `LEAD-${lead.id.slice(0, 8).toUpperCase()}`,
        },
      });
      studentId = student.id;
      await prisma.lead.update({
        where: { id: lead.id },
        data: { studentId, status: "STARTED" },
      });
    } else if (lead.status === "FORM_ONLY") {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "STARTED" } });
    }

    const clientToken = crypto.randomBytes(24).toString("base64url");
    const attempt = await prisma.testAttempt.create({
      data: {
        leadId: lead.id,
        testId: test.id,
        clientToken,
        answers: {},
      },
    });

    const questions = Array.isArray(test.questions)
      ? (test.questions as unknown as TestQuestion[]).map((q) => stripAnswers(q, lead.examLanguage))
      : [];

    ok(res, {
      token: attempt.clientToken,
      attemptId: attempt.id,
      test: {
        id: test.id,
        name: test.name,
        subject: test.subject,
        grade: test.grade,
        durationSec: test.durationSec,
      },
      startedAt: attempt.startedAt,
      questions,
    });
  }),
);

publicTestTakingRouter.get(
  "/attempts/:token",
  asyncHandler(async (req, res) => {
    const attempt = await prisma.testAttempt.findUnique({
      where: { clientToken: String(req.params.token) },
      // `lead` KERAK: refresh/resume'da savollarni qaysi tilda berishni
      // faqat shundan bilamiz. Usiz o'quvchi testni boshlaganda RU ko'rib,
      // sahifani yangilagach UZ ko'rib qolardi.
      include: { test: true, lead: true },
    });
    if (!attempt) throw notFound("Urinish topilmadi");
    if (attempt.submittedAt) {
      // `leadId` + `test` KERAK: yakuniy sahifa shular orqali navbatdagi
      // testni topadi. Token'ga ega brauzer allaqachon shu leadning testini
      // topshirgan, ya'ni yangi ma'lumot ochilmayapti.
      ok(res, {
        token: attempt.clientToken,
        submittedAt: attempt.submittedAt,
        finished: true,
        leadId: attempt.leadId,
        examLanguage: attempt.lead.examLanguage,
        test: { id: attempt.test.id, name: attempt.test.name, subject: attempt.test.subject },
      });
      return;
    }
    const questions = Array.isArray(attempt.test.questions)
      ? (attempt.test.questions as unknown as TestQuestion[]).map((q) =>
          stripAnswers(q, attempt.lead.examLanguage),
        )
      : [];
    ok(res, {
      token: attempt.clientToken,
      attemptId: attempt.id,
      // Savollar shu tilda kelgan (stripAnswers) — interfeys ham shunda.
      examLanguage: attempt.lead.examLanguage,
      test: {
        id: attempt.test.id,
        name: attempt.test.name,
        subject: attempt.test.subject,
        grade: attempt.test.grade,
        durationSec: attempt.test.durationSec,
      },
      startedAt: attempt.startedAt,
      answers: attempt.answers,
      questions,
      finished: false,
    });
  }),
);

publicTestTakingRouter.patch(
  "/attempts/:token/answers",
  asyncHandler(async (req, res) => {
    const { answers } = attemptAnswersSchema.parse(req.body);
    const attempt = await prisma.testAttempt.findUnique({
      where: { clientToken: String(req.params.token) },
      select: { id: true, submittedAt: true },
    });
    if (!attempt) throw notFound();
    if (attempt.submittedAt) throw badRequest("ALREADY_SUBMITTED", "Urinish yakunlangan");
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { answers: answers as Prisma.InputJsonValue },
    });
    ok(res, { saved: true });
  }),
);

// Merge a template question (loose pedagogical metadata) with a runtime
// grading outcome into the strict `Question` shape SubjectResult expects.
// Missing template fields fall back to safe defaults so validation passes.
function toStrictQuestion(
  tpl: Record<string, unknown> | undefined,
  test: TestQuestion,
  earned: number,
  correct: boolean,
): Question {
  const pick = <T>(v: unknown, fallback: T): T => (v == null || v === "" ? fallback : (v as T));
  const difficulty = pick(tpl?.difficulty, DIFFICULTIES[1]);
  const bloom = pick(tpl?.bloom, BLOOM_LEVELS[1]);
  return {
    id: test.id,
    marks: test.marks,
    difficulty: difficulty as Question["difficulty"],
    strand: pick(tpl?.strand, "Umumiy") as string,
    topic: pick(tpl?.topic, "Umumiy") as string,
    subTopic: pick(tpl?.subTopic, "Umumiy") as string,
    skill: pick(tpl?.skill, "Umumiy") as string,
    bloom: bloom as Question["bloom"],
    reasoning: (pick(tpl?.reasoning, null) as Question["reasoning"]) ?? null,
    gradeLevel: pick(tpl?.gradeLevel, "sinf") as string,
    framework: pick(tpl?.framework, "Umumiy") as string,
    result: correct ? "To'g'ri" : earned > 0 ? "Qisman" : "Noto'g'ri",
    earned,
    errorType: correct ? null : "Bilim bo'shlig'i",
    evidence: "",
  };
}

publicTestTakingRouter.post(
  "/attempts/:token/submit",
  asyncHandler(async (req, res) => {
    const attempt = await prisma.testAttempt.findUnique({
      where: { clientToken: String(req.params.token) },
      include: {
        test: { include: { template: true, exam: true } },
        lead: { include: { student: true } },
      },
    });
    if (!attempt) throw notFound();
    if (attempt.submittedAt) throw badRequest("ALREADY_SUBMITTED", "Urinish yakunlangan");
    if (!attempt.lead.studentId || !attempt.lead.student) {
      throw badRequest("NO_STUDENT", "Student holati topilmadi. Testni qaytadan boshlang.");
    }

    // Prefer answers from body (last-resort save), fall back to what's stored.
    const bodyParsed = attemptAnswersSchema.safeParse(req.body ?? {});
    const answers = bodyParsed.success && bodyParsed.data.answers && Object.keys(bodyParsed.data.answers).length
      ? bodyParsed.data.answers
      : (attempt.answers as Record<string, unknown>);
    const autoSubmitted = Boolean((req.body as { autoSubmitted?: boolean })?.autoSubmitted);

    const testQuestions = attempt.test.questions as unknown as TestQuestion[];
    const templateQuestions = (attempt.test.template.questions as unknown as Record<string, unknown>[]) ?? [];

    // Til: o'quvchi testni qaysi tilda ko'rgan bo'lsa, FILL_GAP javoblari
    // ham o'sha tilda kutiladi.
    const { graded, scoreRaw, scoreMax } = gradeTest(testQuestions, answers, attempt.lead.examLanguage);

    // Build the strict SubjectResult question array by merging (index-aligned)
    // template pedagogy with runtime grading.
    const strictQuestions: Question[] = testQuestions.map((tq, i) => {
      const g = graded[i] ?? { earned: 0, correct: false, questionId: tq.id };
      return toStrictQuestion(templateQuestions[i], tq, g.earned, g.correct);
    });

    const exam = attempt.test.exam;
    const student = attempt.lead.student;

    // Ensure per-student credentials so admin can immediately hand them out
    // once the result is published.
    const creds = await ensureStudentCredentials(student.id);

    const totalMarks = testQuestions.reduce((s, q) => s + q.marks, 0);
    const totalQuestions = testQuestions.length;

    // BITTA natija — bitta (o'quvchi, imtihon) uchun. Har fan alohida test
    // sifatida topshiriladi va o'z SubjectResult'ini SHU natijaga qo'shadi.
    //
    // Ilgari har submit YANGI natija yaratardi va unda faqat bitta fan
    // bo'lardi. Oqibati: (1) publish darvozasi `subjects.length !== 3` ni rad
    // etadi — natija hech qachon nashr etilmasdi; (2) o'quvchi hisobotni
    // ochsa, client `pickSubject` da "Subject ENGLISH missing" deb qulardi,
    // chunki hisobot uchala fanni talab qiladi.
    //
    // Faqat DRAFT natija qayta ishlatiladi: nashr etilganini o'zgartirish
    // ota-onaga ko'rsatilgan hisobotni ostidan almashtirish bo'lardi.
    let result = await prisma.result.findFirst({
      where: { studentId: student.id, examId: exam.id, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
    });

    if (!result) {
      const publicCode = await generateUniquePublicCode();
      const throwawayPlain = generatePassword();
      const passwordHash = await bcrypt.hash(throwawayPlain, config.bcryptCost);
      const defaultUnlocked = await readDefaultUnlockedSections();
      result = await prisma.result.create({
        data: {
          studentId: student.id,
          examId: exam.id,
          publicCode,
          accessPasswordHash: passwordHash,
          accessPassword: throwawayPlain,
          unlockedSections: defaultUnlocked,
          // Draft — admin publishes manually from the Results tab.
          status: "DRAFT",
          manualContent: {},
        },
      });
    }

    // Shu fanni qo'shamiz yoki yangilaymiz (@@unique([resultId, subject])).
    await prisma.subjectResult.upsert({
      where: { resultId_subject: { resultId: result.id, subject: attempt.test.subject } },
      create: {
        resultId: result.id,
        subject: attempt.test.subject,
        totalQuestions,
        totalMarks,
        questions: strictQuestions as unknown as Prisma.InputJsonValue,
      },
      update: {
        totalQuestions,
        totalMarks,
        questions: strictQuestions as unknown as Prisma.InputJsonValue,
      },
    });

    // Snapshot uchun natijaning HOZIRGI holati kerak.
    const subjectRows = await prisma.subjectResult.findMany({
      where: { resultId: result.id },
      orderBy: { subject: "asc" },
    });

    // Attempt is now settled — record the score and link the result.
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        autoSubmitted,
        answers: answers as Prisma.InputJsonValue,
        scoreRaw,
        scoreMax,
        resultId: result.id,
      },
    });
    await prisma.lead.update({
      where: { id: attempt.leadId },
      data: { status: "COMPLETED" },
    });

    // Snapshot faqat UCHALA fan yig'ilgandan keyin. computeComposite uchala
    // SubjectKey bo'yicha aylanadi va yo'g'ini `undefined` deb o'qib
    // TypeError beradi — u esa quyidagi catch'da jimgina yutilib, natija
    // `calculatedSnapshot: null` bo'lib qolardi. Ya'ni har bitta-fanli
    // submitda bu blok bekorga qulardi.
    const complete = subjectRows.length === 3;
    if (complete) try {
      const snapshot = calculateResult({
        grade: exam.grade,
        thresholds: exam.admissionThresholds as unknown as AdmissionThresholds,
        gradingConfiguration: exam.gradingConfiguration,
        subjects: subjectRows
          .filter((s) => s.totalQuestions > 0)
          .map((s) => ({
            subject: s.subject,
            meta: {
              school: "Sodiq School",
              slogan: "Biz ilmga sodiqmiz",
              office: "Academic Assessment Office",
              candidate: student.fullName,
              grade: exam.grade,
              gradeLabel: `${exam.grade}-sinfga nomzod`,
              subject:
                s.subject === "MATH" ? "Matematika"
                : s.subject === "ENGLISH" ? "Ingliz tili"
                : "Tanqidiy fikrlash",
              totalQuestions: s.totalQuestions,
              totalMarks: s.totalMarks,
              brand: { navy: "#06113C", orange: "#FF8A32" },
            },
            questions: s.questions as unknown as Question[],
          })),
      });
      await prisma.result.update({
        where: { id: result.id },
        data: { calculatedSnapshot: snapshot as unknown as Prisma.InputJsonValue },
      });
    } catch (e) {
      console.warn("[test-taking] snapshot preview failed for result", result.id, e);
    }

    ok(res, {
      resultId: result.id,
      scoreRaw,
      scoreMax,
      // `completed` = butun natija yig'ildimi (uchala fan), bitta test
      // topshirildimi degani EMAS.
      completed: complete,
      subjectsDone: subjectRows.length,
    });
  }),
);
