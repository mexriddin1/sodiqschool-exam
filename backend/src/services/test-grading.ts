import type { TestQuestion } from "../lib/schemas.js";

// Per-question grading for the live test flow.
// Rule: full marks only when the whole question is correct — no partial
// credit unless the TZ later asks for it. This matches the TZ line about
// TRUE_FALSE ("uchalasigayam togri javob bersa shunda shu bitta savolga
// togri javob bergan bo'ladi") and keeps grading unambiguous for admins.

export type Answers = Record<string, unknown>;

export interface GradedQuestion {
  questionId: string;
  earned: number;
  correct: boolean;
}

function normalizeGap(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function arraysEqualSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

export function gradeQuestion(q: TestQuestion, raw: unknown): GradedQuestion {
  const zero = { questionId: q.id, earned: 0, correct: false };
  if (raw === undefined || raw === null) return zero;

  switch (q.type) {
    case "MULTIPLE_CHOICE": {
      const picked = typeof raw === "string" ? raw : "";
      const correct = q.correctChoiceIds?.length === 1 && picked === q.correctChoiceIds[0];
      return { questionId: q.id, earned: correct ? q.marks : 0, correct };
    }
    case "MULTIPLE_SELECT": {
      const picked = Array.isArray(raw) ? raw.map(String) : [];
      const expected = q.correctChoiceIds ?? [];
      const correct = arraysEqualSet(picked, expected);
      return { questionId: q.id, earned: correct ? q.marks : 0, correct };
    }
    case "TRUE_FALSE": {
      // raw: { [subItemId]: boolean }
      const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const items = q.trueFalseItems ?? [];
      if (items.length === 0) return zero;
      const allCorrect = items.every((it) => Boolean(map[it.id]) === it.correct);
      return { questionId: q.id, earned: allCorrect ? q.marks : 0, correct: allCorrect };
    }
    case "FILL_GAP": {
      // raw: string[] — one answer per gap
      const given = Array.isArray(raw) ? raw.map(normalizeGap) : [];
      const expected = (q.gapAnswers ?? []).map(normalizeGap);
      if (given.length !== expected.length) return zero;
      const correct = given.every((g, i) => g === expected[i]);
      return { questionId: q.id, earned: correct ? q.marks : 0, correct };
    }
    case "MATCHING": {
      // raw: { [leftId]: rightId }
      const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const pairs = q.matchingPairs ?? [];
      if (pairs.length === 0) return zero;
      const allCorrect = pairs.every((p) => String(map[p.leftId] ?? "") === p.rightId);
      return { questionId: q.id, earned: allCorrect ? q.marks : 0, correct: allCorrect };
    }
    case "REORDERING": {
      // raw: string[] — item ids in student-chosen order
      const order = Array.isArray(raw) ? raw.map(String) : [];
      const items = q.reorderItems ?? [];
      if (order.length !== items.length) return zero;
      const expected = [...items].sort((a, b) => a.correctIndex - b.correctIndex).map((i) => i.id);
      const correct = order.every((id, i) => id === expected[i]);
      return { questionId: q.id, earned: correct ? q.marks : 0, correct };
    }
    default:
      return zero;
  }
}

export function gradeTest(questions: TestQuestion[], answers: Answers) {
  const graded = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const scoreRaw = graded.reduce((s, g) => s + g.earned, 0);
  const scoreMax = questions.reduce((s, q) => s + q.marks, 0);
  return { graded, scoreRaw, scoreMax };
}
