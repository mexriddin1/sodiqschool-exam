// Admin uchun: bitta urinishning har savoli bo'yicha o'quvchi javobi + to'g'ri
// javob + to'g'ri/noto'g'ri. Lead detalidagi "Javoblarni ko'rish" jadvali shuni
// ishlatadi.
//
// Javob satrlari KatexInline uchun tayyor: matematik qismlar `$...$` ichida
// (MathLive `\frac{2}{2}` chiqaradi), oddiy matn shundoq. Frontend har katakni
// KatexInline'ga beradi.

import type { TestLanguage } from "@prisma/client";
import { resolveText, type TestQuestion } from "./schemas.js";
import { gradeQuestion } from "../services/test-grading.js";

export interface AnswerRow {
  /** Savol raqami (1 dan). */
  n: number;
  type: string;
  /** O'quvchi javobi — KatexInline uchun tayyor satr ("—" agar javob yo'q). */
  student: string;
  /** To'g'ri javob — KatexInline uchun tayyor satr. */
  correct: string;
  isCorrect: boolean;
}

const math = (s: string) => `$${s}$`;

function choiceLabel(q: TestQuestion, id: string | undefined, lang: TestLanguage): string {
  const c = (q.choices ?? []).find((x) => x.id === id);
  return c ? resolveText(c.label, lang) : "—";
}

/** Bitta savol uchun o'quvchi va to'g'ri javob ko'rinishini beradi. */
function displayAnswers(q: TestQuestion, raw: unknown, lang: TestLanguage): { student: string; correct: string } {
  const dash = "—";
  switch (q.type) {
    case "MULTIPLE_CHOICE": {
      const picked = typeof raw === "string" ? raw : undefined;
      return {
        student: picked ? choiceLabel(q, picked, lang) : dash,
        correct: choiceLabel(q, q.correctChoiceIds?.[0], lang),
      };
    }
    case "MULTIPLE_SELECT": {
      const picked = Array.isArray(raw) ? raw.map(String) : [];
      return {
        student: picked.length ? picked.map((id) => choiceLabel(q, id, lang)).join(", ") : dash,
        correct: (q.correctChoiceIds ?? []).map((id) => choiceLabel(q, id, lang)).join(", "),
      };
    }
    case "TRUE_FALSE": {
      const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const items = q.trueFalseItems ?? [];
      const tf = (v: boolean) => (v ? "Rost" : "Yolg'on");
      const answered = Object.keys(map).length > 0;
      return {
        student: answered
          ? items.map((it) => `${resolveText(it.text, lang)}: ${tf(Boolean(map[it.id]))}`).join("; ")
          : dash,
        correct: items.map((it) => `${resolveText(it.text, lang)}: ${tf(it.correct)}`).join("; "),
      };
    }
    case "FILL_GAP": {
      const given = Array.isArray(raw) ? raw.map((v) => String(v ?? "")) : [];
      // Har bo'shliqda qabul qilinadigan variantlar bo'lishi mumkin — ASOSIY
      // (birinchi) variantni ko'rsatamiz. Eski (bitta) shaklni ham himoyaviy
      // o'qiymiz.
      const expected = (q.gapAnswers ?? []).map((gap) => {
        const list = (Array.isArray(gap) ? gap : [gap]) as unknown[];
        return resolveText(list[0] as Parameters<typeof resolveText>[0], lang);
      });
      // Matematik ifoda bo'lishi mumkin — $...$ ga o'raymiz (KatexInline render).
      return {
        student: given.length ? given.map((g) => math(g || "")).join(", ") : dash,
        correct: expected.map((e) => math(e)).join(", "),
      };
    }
    case "MATCHING": {
      const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const pairs = q.matchingPairs ?? [];
      const rightText = (id: string) => {
        const p = pairs.find((x) => x.rightId === id);
        return p ? resolveText(p.rightText, lang) : "—";
      };
      const answered = Object.keys(map).length > 0;
      return {
        student: answered
          ? pairs.map((p) => `${resolveText(p.leftText, lang)} → ${rightText(String(map[p.leftId] ?? ""))}`).join("; ")
          : dash,
        correct: pairs.map((p) => `${resolveText(p.leftText, lang)} → ${resolveText(p.rightText, lang)}`).join("; "),
      };
    }
    case "REORDERING": {
      const order = Array.isArray(raw) ? raw.map(String) : [];
      const items = q.reorderItems ?? [];
      const byId = (id: string) => {
        const it = items.find((x) => x.id === id);
        return it ? resolveText(it.text, lang) : "—";
      };
      const expected = [...items].sort((a, b) => a.correctIndex - b.correctIndex);
      return {
        student: order.length ? order.map(byId).join(" → ") : dash,
        correct: expected.map((it) => resolveText(it.text, lang)).join(" → "),
      };
    }
    default:
      return { student: dash, correct: dash };
  }
}

/** Testning barcha savollari uchun javob satrlari. */
export function buildAnswerRows(
  questions: TestQuestion[],
  answers: Record<string, unknown>,
  lang: TestLanguage,
): AnswerRow[] {
  return questions.map((q, i) => {
    const raw = answers[q.id];
    const { student, correct } = displayAnswers(q, raw, lang);
    const graded = gradeQuestion(q, raw, lang);
    return { n: i + 1, type: q.type, student, correct, isCorrect: graded.correct };
  });
}
