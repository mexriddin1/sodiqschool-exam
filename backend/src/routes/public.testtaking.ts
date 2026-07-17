import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
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
  TestQuestion,
} from "../lib/schemas.js";
import type { TestLanguage } from "@prisma/client";
import { gradeTest } from "../services/test-grading.js";
import { stripAnswers } from "../lib/question-view.js";
import { generateUniquePublicCode } from "../services/code.js";
import { calculateResult } from "../services/calculation.js";
import { ensureStudentCredentials } from "../services/student-credentials.js";
import { readDefaultUnlockedSections, readFunnelOpen, readFunnelPassword } from "./admin.settings.js";

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
 * Kirish tokeni uchun alohida sirli kalit.
 *
 * `resultJwtSecret` dan HMAC bilan ajratiladi — yangi env o'zgaruvchisi
 * qo'shilmasin (u serverda yo'q bo'lsa deploy jimgina buzilardi), lekin
 * qabul testining tokeni o'quvchi hisobot tokeni bilan bir kalitda
 * imzolanmasin.
 */
const GATE_SECRET = crypto
  .createHmac("sha256", config.resultJwtSecret)
  .update("funnel-gate-v1")
  .digest("hex");

// Qurilma bir marta kiradi va o'zi chiqmaguncha kirgan holicha qoladi.
// Bekor qilish yagona yo'li — sozlamadan parolni almashtirish (u `pv` ni
// yangilaydi va quyidagi tekshiruv eski tokenlarni rad etadi).
const GATE_TTL = "365d";

interface GatePayload { pv: string }

export function signGateToken(pv: string): string {
  return jwt.sign({ pv } satisfies GatePayload, GATE_SECRET, { expiresIn: GATE_TTL });
}

function gateTokenVersion(req: { headers: Record<string, unknown> }): string | null {
  const raw = String(req.headers["authorization"] ?? "");
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) return null;
  try {
    return (jwt.verify(token, GATE_SECRET) as GatePayload).pv ?? null;
  } catch {
    return null;
  }
}

/**
 * Qabul testiga kirishni tekshiradi: yopiq bo'lsa yoki parol kiritilmagan
 * bo'lsa — YANGI kirishni to'xtatadi.
 *
 * Faqat "kirish eshiklari"ga qo'yiladi: lead qoldirish, testlar ro'yxati va
 * urinish boshlash. Javob saqlash (PATCH) va yakunlash (submit) ATAYLAB ochiq
 * qoladi — aks holda admin tugmani bosgan (yoki parolni almashtirgan) zahoti
 * test yozib o'tirgan bolaning ishi yo'qolardi.
 */
const requireFunnelAccess = asyncHandler(async (req, res, next) => {
  if (!(await readFunnelOpen())) {
    return void res.status(403).json({
      success: false,
      error: { code: "FUNNEL_CLOSED", message: "Qabul testi hozircha yopiq.", fields: {} },
    });
  }
  const pw = await readFunnelPassword();
  // Parol o'rnatilmagan — faqat ochiq/yopiq tugmasi ishlaydi.
  if (!pw) return next();

  if (gateTokenVersion(req) === pw.version) return next();
  res.status(401).json({
    success: false,
    error: { code: "GATE_REQUIRED", message: "Kirish paroli talab qilinadi.", fields: {} },
  });
});

// Parolni topishga urinishni sekinlashtiradi. /api/test-taking da umuman
// limiter yo'q edi; parol endi yagona to'siq bo'lgani uchun shu yerda kerak.
const gateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_ATTEMPTS", message: "Keyinroq urinib ko'ring.", fields: {} } },
});

publicTestTakingRouter.post(
  "/gate",
  gateLimiter,
  asyncHandler(async (req, res) => {
    const pw = await readFunnelPassword();
    if (!pw) return void ok(res, { token: null, required: false });
    const given = typeof req.body?.password === "string" ? req.body.password : "";
    if (!given || !(await bcrypt.compare(given, pw.hash))) {
      return void res.status(401).json({
        success: false,
        error: { code: "BAD_PASSWORD", message: "Parol noto'g'ri.", fields: {} },
      });
    }
    ok(res, { token: signGateToken(pw.version), required: true });
  }),
);

// Same-origin CSRF isn't needed here — every mutation carries the token
// generated at start(), which is unguessable and single-use per attempt.

publicTestTakingRouter.post(
  "/leads",
  requireFunnelAccess,
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
        previousSchool: data.previousSchool || null,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 512) || null,
      },
    });
    ok(res, { leadId: lead.id });
  }),
);

publicTestTakingRouter.get(
  "/leads/:leadId/tests",
  requireFunnelAccess,
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

publicTestTakingRouter.post(
  "/attempts",
  requireFunnelAccess,
  asyncHandler(async (req, res) => {
    const { leadId, testId } = attemptStartSchema.parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw notFound("Lead topilmadi");
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw notFound("Test topilmadi");
    if (test.grade !== lead.grade) {
      throw badRequest("GRADE_MISMATCH", "Bu test sizning sinfingizga mos emas.");
    }

    // O'quvchi (Student) SHU YERDA yaratilmaydi — u faqat uchala fan
    // topshirilgach, submit'da tug'iladi (pastga qarang). Sabab: chala qolgan
    // odam admin "o'quvchilar" ro'yxatida paydo bo'lmasligi kerak; toki
    // imtihonni tugatmaguncha u faqat Lead. Urinish Lead'ga bog'lanadi
    // (studentId shart emas), shuning uchun start uchun student kerak emas.
    if (lead.status === "FORM_ONLY") {
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
      ? (test.questions as unknown as TestQuestion[]).map((q) =>
          stripAnswers(q, lead.examLanguage, attempt.id),
        )
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
          // Urug' — o'sha urinish, ya'ni davom ettirilganda tartib o'zgarmaydi.
          stripAnswers(q, attempt.lead.examLanguage, attempt.id),
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
    const { answers, fullscreenExits } = attemptAnswersSchema.parse(req.body);
    const attempt = await prisma.testAttempt.findUnique({
      where: { clientToken: String(req.params.token) },
      select: { id: true, submittedAt: true, fullscreenExits: true },
    });
    if (!attempt) throw notFound();
    if (attempt.submittedAt) throw badRequest("ALREADY_SUBMITTED", "Urinish yakunlangan");
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: answers as Prisma.InputJsonValue,
        // Faqat o'sadi. Bola sahifani yangilasa mijozdagi hisoblagich 0 dan
        // boshlanadi — max() bo'lmasa yangilash chiqishlarni "o'chirib"
        // yuborardi, ya'ni yashirishning eng oson yo'li bo'lardi.
        ...(fullscreenExits != null
          ? { fullscreenExits: Math.max(attempt.fullscreenExits, fullscreenExits) }
          : {}),
      },
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
    // Shablon id'si — hisobotdagi "id" ustuni mavzu/ko'nikma bilan bir
    // qatorda turadi va natija tahrirlash JSON'i ham shablon id'siga tayanadi
    // (docs/json-namunalar.md). Shablonga bog'lanmagan eski testlarda —
    // testning o'z id'si.
    id: test.templateQuestionId ?? test.id,
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

/**
 * Bitta topshirilgan urinishni baholab, SubjectResult uchun kerakli hammasini
 * qaytaradi. Ilgari bu mantiq submit handleri ichida bir marta yozilardi; endi
 * imtihon tugaganda UCHALA fanni bir joyda baholaymiz, shuning uchun ajratildi.
 */
function gradeAttemptSubject(
  test: { questions: unknown; subject: SubjectKey; template: { questions: unknown } },
  answers: Record<string, unknown>,
  lang: TestLanguage,
) {
  const testQuestions = test.questions as unknown as TestQuestion[];
  const templateQuestions = (test.template.questions as unknown as Record<string, unknown>[]) ?? [];
  const { graded, scoreRaw, scoreMax } = gradeTest(testQuestions, answers, lang);
  const tplById = new Map<string, Record<string, unknown>>();
  for (const tq of templateQuestions) {
    if (typeof tq?.id === "string") tplById.set(tq.id, tq);
  }
  const strictQuestions: Question[] = testQuestions.map((tq, i) => {
    const g = graded[i] ?? { earned: 0, correct: false, questionId: tq.id };
    const tpl = tq.templateQuestionId ? tplById.get(tq.templateQuestionId) : templateQuestions[i];
    return toStrictQuestion(tpl, tq, g.earned, g.correct);
  });
  return {
    subject: test.subject,
    totalQuestions: testQuestions.length,
    totalMarks: testQuestions.reduce((s, q) => s + q.marks, 0),
    strictQuestions,
    scoreRaw,
    scoreMax,
  };
}

// Imtihon uchala fani. O'quvchi shu hammasini topshirgach "tugadi" hisoblanadi.
const EXAM_SUBJECTS: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];

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
    // NO_STUDENT tekshiruvi OLIB TASHLANDI: o'quvchi endi start'da emas, faqat
    // shu yerda — uchala fan yig'ilganda — yaratiladi.

    // Prefer answers from body (last-resort save), fall back to what's stored.
    const bodyParsed = attemptAnswersSchema.safeParse(req.body ?? {});
    const answers = bodyParsed.success && bodyParsed.data.answers && Object.keys(bodyParsed.data.answers).length
      ? bodyParsed.data.answers
      : (attempt.answers as Record<string, unknown>);
    const autoSubmitted = Boolean((req.body as { autoSubmitted?: boolean })?.autoSubmitted);
    const fullscreenExits = bodyParsed.success ? bodyParsed.data.fullscreenExits : undefined;

    const lang = attempt.lead.examLanguage;
    const exam = attempt.test.exam;

    // Shu urinishni baholaymiz — javob (`completed`) va attemptga yoziladigan
    // ball uchun.
    const current = gradeAttemptSubject(attempt.test, answers, lang);

    // Imtihon tugadimi? Shu lead + imtihon bo'yicha ALLAQACHON topshirilgan
    // urinishlarning fanlari + shu urinishning fani. Uchala fan yig'ilsa —
    // tugadi. (Bir fan qayta topshirilsa, eng oxirgi urinish olinadi.)
    const priorAttempts = await prisma.testAttempt.findMany({
      where: {
        leadId: attempt.leadId,
        submittedAt: { not: null },
        test: { examId: exam.id },
      },
      include: { test: { include: { template: true } } },
      orderBy: { submittedAt: "asc" },
    });
    const bySubject = new Map<SubjectKey, (typeof priorAttempts)[number]>();
    for (const a of priorAttempts) bySubject.set(a.test.subject, a);
    const subjects = new Set<SubjectKey>([...bySubject.keys(), attempt.test.subject]);
    const complete = EXAM_SUBJECTS.every((s) => subjects.has(s));

    // TUGAMAGAN bo'lsa: shu urinishni yakunlangan deb belgilaymiz, xolos.
    // O'quvchi, natija va hisobot HALI yaratilmaydi — chala qolgani faqat lead.
    if (!complete) {
      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          submittedAt: new Date(),
          autoSubmitted,
          answers: answers as Prisma.InputJsonValue,
          scoreRaw: current.scoreRaw,
          scoreMax: current.scoreMax,
          fullscreenExits: Math.max(attempt.fullscreenExits, fullscreenExits ?? 0),
        },
      });
      // Status STARTED bo'lib qoladi — COMPLETED faqat uchala fan tugagach.
      if (attempt.lead.status === "FORM_ONLY") {
        await prisma.lead.update({ where: { id: attempt.leadId }, data: { status: "STARTED" } });
      }
      ok(res, {
        resultId: null,
        scoreRaw: current.scoreRaw,
        scoreMax: current.scoreMax,
        completed: false,
        subjectsDone: subjects.size,
      });
      return;
    }

    // TUGADI — endi o'quvchi + natija tug'iladi. Barcha og'ir yozuvlar shu
    // yerda, va shu urinish "submitted" deb ATANMASDAN OLDIN bajariladi:
    // agar bu blok yiqilsa, urinish ochiq qoladi va o'quvchi qayta urina oladi.

    // O'quvchini yaratamiz yoki qayta ishlatamiz. Eski oqimda (deploy'dan
    // oldin boshlagan) lead.studentId allaqachon bor bo'lishi mumkin.
    let student = attempt.lead.student;
    if (!student) {
      student = await prisma.student.create({
        data: {
          fullName: `${attempt.lead.firstName} ${attempt.lead.lastName}`.trim(),
          firstName: attempt.lead.firstName,
          lastName: attempt.lead.lastName,
          phone: attempt.lead.phone,
          sex: attempt.lead.sex,
          grade: attempt.lead.grade,
          examLanguage: attempt.lead.examLanguage,
          previousSchool: attempt.lead.previousSchool,
          uid: `LEAD-${attempt.leadId.slice(0, 8).toUpperCase()}`,
        },
      });
      await prisma.lead.update({ where: { id: attempt.leadId }, data: { studentId: student.id } });
    }

    // Kirish parollari — nashrdan keyin admin darhol topshira olsin.
    await ensureStudentCredentials(student.id);

    // BITTA DRAFT natija — bitta (o'quvchi, imtihon) uchun. Nashr etilganini
    // qayta ishlatmaymiz: ota-onaga ko'rsatilgan hisobotni almashtirmaslik uchun.
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
          status: "DRAFT",
          manualContent: {},
        },
      });
    }

    // Uchala fanni baholaymiz: shu urinish (yuqorida) + oldingilar (saqlangan
    // javoblardan qayta). Har fan bitta SubjectResult beradi.
    const perSubject = new Map<SubjectKey, ReturnType<typeof gradeAttemptSubject>>();
    for (const a of priorAttempts) {
      perSubject.set(a.test.subject, gradeAttemptSubject(a.test, a.answers as Record<string, unknown>, lang));
    }
    // Shu urinish oldingilarni bosib o'tadi (eng yangi javob).
    perSubject.set(attempt.test.subject, current);

    for (const g of perSubject.values()) {
      await prisma.subjectResult.upsert({
        where: { resultId_subject: { resultId: result.id, subject: g.subject } },
        create: {
          resultId: result.id,
          subject: g.subject,
          totalQuestions: g.totalQuestions,
          totalMarks: g.totalMarks,
          questions: g.strictQuestions as unknown as Prisma.InputJsonValue,
        },
        update: {
          totalQuestions: g.totalQuestions,
          totalMarks: g.totalMarks,
          questions: g.strictQuestions as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Oldingi urinishlarni natijaga bog'laymiz (deferral'da ular resultId'siz
    // topshirilgan edi).
    await prisma.testAttempt.updateMany({
      where: { id: { in: priorAttempts.map((a) => a.id) } },
      data: { resultId: result.id },
    });

    // Shu urinishni ENG OXIRIDA yakunlangan deb belgilaymiz — yuqoridagilar
    // yiqilsa qayta urinish uchun ochiq qolsin.
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        autoSubmitted,
        answers: answers as Prisma.InputJsonValue,
        scoreRaw: current.scoreRaw,
        scoreMax: current.scoreMax,
        resultId: result.id,
        fullscreenExits: Math.max(attempt.fullscreenExits, fullscreenExits ?? 0),
      },
    });
    await prisma.lead.update({ where: { id: attempt.leadId }, data: { status: "COMPLETED" } });

    // Snapshot — natijaning hozirgi holatidan.
    const subjectRows = await prisma.subjectResult.findMany({
      where: { resultId: result.id },
      orderBy: { subject: "asc" },
    });
    try {
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
      scoreRaw: current.scoreRaw,
      scoreMax: current.scoreMax,
      completed: true,
      subjectsDone: subjectRows.length,
    });
  }),
);
