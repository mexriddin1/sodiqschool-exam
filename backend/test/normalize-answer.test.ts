// FILL_GAP baholashi: RAQAMLI ekvivalentlik YO'Q (forma nazorat qilinadi),
// lekin LaTeX normalizatsiya bor (texnik farqlar e'tiborsiz), va har bo'shliqqa
// bir nechta qabul qilinadigan javob bo'lishi mumkin.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { normalizeAnswer } from "../src/lib/normalize-answer.js";
import { gradeQuestion } from "../src/services/test-grading.js";
import { testQuestionSchema, type TestQuestion } from "../src/lib/schemas.js";

const eq = (a: string, b: string) => normalizeAnswer(a) === normalizeAnswer(b);

test("normalizeAnswer: qavs variantlari bir xil", () => {
  assert.ok(eq("\\frac12", "\\frac{1}{2}"));
  assert.ok(eq("\\frac1{2}", "\\frac{1}{2}"));
  assert.ok(eq("\\frac{1}{2}", "\\frac{1}{2}"));
});

test("normalizeAnswer: bo'shliqlar ahamiyatsiz", () => {
  assert.ok(eq("x\\le5", "x \\le 5"));
  assert.ok(eq("3a+4b", "3a + 4b"));
});

test("normalizeAnswer: sinonim buyruqlar", () => {
  assert.ok(eq("\\leq", "\\le"));
  assert.ok(eq("\\geq", "\\ge"));
  assert.ok(eq("\\neq", "\\ne"));
  assert.ok(eq("\\dfrac{1}{2}", "\\frac{1}{2}"));
  assert.ok(eq("\\tfrac{1}{2}", "\\frac{1}{2}"));
});

test("normalizeAnswer: $ chegaralar va katta-kichik harf", () => {
  assert.ok(eq("$5.8$", "5.8"));
  assert.ok(eq("Olma", "olma"));
  assert.ok(eq("  olma  ", "olma"));
});

test("normalizeAnswer: HAR XIL qiymat teng EMAS (raqamli ekvivalentlik yo'q)", () => {
  assert.ok(!eq("0.5", "\\frac{1}{2}"));
  assert.ok(!eq("29/5", "5.8"));
  assert.ok(!eq("1/2", "2/4"));
});

test("FILL_GAP: normalizatsiya bilan mos, lekin qiymat bo'yicha emas", () => {
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 1,
    prompt: { same: true, UZ: "Javobni kasr ko'rinishida yozing: ___" },
    gapAnswers: [{ same: true, UZ: "\\frac{1}{2}" }],
  });
  // Texnik variant — TO'G'RI.
  assert.equal(gradeQuestion(q, ["\\frac12"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["\\frac{1}{2}"], "UZ").correct, true);
  // O'nlik ko'rinish — endi NOTO'G'RI (forma nazorat qilinadi).
  assert.equal(gradeQuestion(q, ["0.5"], "UZ").correct, false);
});

test("FILL_GAP: bir bo'shliqqa bir nechta qabul qilinadigan javob", () => {
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 1,
    prompt: { same: true, UZ: "Yig'indini yozing: ___" },
    gapAnswers: [[{ same: true, UZ: "3a+4b" }, { same: true, UZ: "4b+3a" }]],
  });
  // Ikki variant ham qabul qilinadi.
  assert.equal(gradeQuestion(q, ["3a+4b"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["4b+3a"], "UZ").correct, true);
  // Bo'shliq (normalizatsiya) — hali ham to'g'ri.
  assert.equal(gradeQuestion(q, ["4b + 3a"], "UZ").correct, true);
  // Boshqa ifoda — noto'g'ri.
  assert.equal(gradeQuestion(q, ["3a+4c"], "UZ").correct, false);
});

test("FILL_GAP: eski (bitta javobli) shakl zod'dan keyin ham ishlaydi", () => {
  // Eski data — I18nText[] (massivsiz). Zod uni [[...]] ga o'raydi, backfill kerak emas.
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 1,
    prompt: "Javob: ___",
    gapAnswers: ["olma"],
  });
  assert.equal(q.gapAnswers?.length, 1); // bitta bo'shliq
  assert.equal(gradeQuestion(q, ["olma"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["OLMA"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["nok"], "UZ").correct, false);
});

test("FILL_GAP: zod'siz o'qilgan eski shakl (himoyaviy)", () => {
  // O'qish yo'llari zod'siz cast qiladi — grading eski (I18nText) va yangi
  // (I18nText[]) elementlarni ham to'g'ri o'qishi kerak.
  const legacy = {
    id: "q1", order: 0, type: "FILL_GAP", marks: 1,
    prompt: { same: true, UZ: "___" },
    gapAnswers: [{ same: true, UZ: "5.8" }], // massivsiz element
  } as unknown as TestQuestion;
  assert.equal(gradeQuestion(legacy, ["5.8"], "UZ").correct, true);
  assert.equal(gradeQuestion(legacy, ["29/5"], "UZ").correct, false);
});
