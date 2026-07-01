import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { isValidPublicCode, normalizePublicCode } from "@sodiq/compute";

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

// Rate-limit public result login: 6 attempts / 15 min / IP. We intentionally
// don't include the publicCode in the key — that would let an attacker reset
// the limiter by rotating codes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_ATTEMPTS", message: "Try again later" } },
});

export const publicResultRouter = Router();

publicResultRouter.post(
  "/auth/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resultLoginSchema.parse(req.body);
    const code = normalizePublicCode(parsed.code);
    // Same generic error for invalid code shape, missing result, wrong password,
    // and draft/archived status — prevents enumeration.
    const generic = unauthorized("Kod yoki parol noto'g'ri");
    if (!isValidPublicCode(code)) throw generic;
    const result = await prisma.result.findUnique({
      where: { publicCode: code },
      select: { id: true, publicCode: true, status: true, accessPasswordHash: true },
    });
    if (!result || result.status !== "PUBLISHED") throw generic;
    const matches = await bcrypt.compare(parsed.password, result.accessPasswordHash);
    if (!matches) throw generic;

    const token = signResultToken({ sub: result.id, code: result.publicCode });
    res.cookie(RESULT_COOKIE, token, cookieOptions(RESULT_COOKIE_AGE_MS));
    // Token is returned in body too so a same-origin proxy (e.g. Astro SSR)
    // can re-host it in its own cookie and forward as Authorization: Bearer.
    ok(res, { resultId: result.id, token });
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
    ok(res, { resultId: req.resultSession!.resultId, publicCode: req.resultSession!.publicCode });
  }),
);

publicResultRouter.get(
  "/me",
  requireResultSession,
  asyncHandler(async (req, res) => {
    const id = req.resultSession!.resultId;
    const result = await prisma.result.findUnique({
      where: { id },
      include: { student: true, exam: true, subjects: true },
    });
    // Defence-in-depth: session is scoped to this result id. Even if the
    // record was deleted between login and now, never reveal another.
    if (!result) throw notFound();
    if (result.status !== "PUBLISHED")
      throw unauthorized("Result is no longer available");

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
    });
  }),
);
