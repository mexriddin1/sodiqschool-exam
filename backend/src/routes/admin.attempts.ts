import { Router } from "express";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { TestQuestion } from "../lib/schemas.js";
import { buildAnswerRows } from "../lib/attempt-answers.js";

// O'quvchi bitta testda nechinchi savolga qanday javob berganini ko'rish uchun
// (admin). Lead detalidagi "Javoblarni ko'rish" shuni chaqiradi. Bu — test-app
// ga javoblarni yashirib yuboradigan stripAnswers'ning TESKARISI: bu yerda,
// aksincha, to'g'ri javoblar admin uchun ochib beriladi.

export const attemptsRouter = Router();
attemptsRouter.use(requireAdmin);

attemptsRouter.get(
  "/:id/answers",
  asyncHandler(async (req, res) => {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: String(req.params.id) },
      include: {
        test: { select: { name: true, subject: true, questions: true } },
        lead: { select: { examLanguage: true } },
      },
    });
    if (!attempt) throw notFound("Urinish topilmadi");

    const questions = (attempt.test.questions as unknown as TestQuestion[]) ?? [];
    const answers = (attempt.answers as Record<string, unknown>) ?? {};
    const rows = buildAnswerRows(questions, answers, attempt.lead.examLanguage);

    ok(res, {
      test: { name: attempt.test.name, subject: attempt.test.subject },
      submittedAt: attempt.submittedAt,
      scoreRaw: attempt.scoreRaw,
      scoreMax: attempt.scoreMax,
      rows,
    });
  }),
);
