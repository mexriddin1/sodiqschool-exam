// Matematik javob ekvivalentligi — foydalanuvchi so'ragan barcha shakllar
// bir xil qiymatga tushishi kerak, xato javob esa tushmasligi.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { parseRational, numericallyEqual } from "../src/lib/math-answer.js";
import { gradeQuestion } from "../src/services/test-grading.js";
import { TestQuestion } from "../src/lib/schemas.js";

test("5.8 ning barcha shakllari o'zaro teng", () => {
  // Foydalanuvchi ro'yxati: 5.8, 5 8/10, 5 4/5, 58/10, 29/5.
  const forms = ["5.8", "5 8/10", "5 4/5", "58/10", "29/5", "\\frac{29}{5}", "5\\frac{8}{10}", "5\\frac45"];
  for (const a of forms) {
    for (const b of forms) {
      assert.equal(numericallyEqual(a, b), true, `${a} == ${b} bo'lishi kerak`);
    }
  }
});

test("teng bo'lmagan qiymatlar teng emas", () => {
  assert.equal(numericallyEqual("5.8", "6"), false);
  assert.equal(numericallyEqual("29/5", "29/4"), false);
  assert.equal(numericallyEqual("1/2", "1/3"), false);
  assert.equal(numericallyEqual("5 4/5", "5 3/5"), false);
});

test("MathLive LaTeX shakllari", () => {
  assert.equal(numericallyEqual("\\frac{1}{2}", "0.5"), true);
  assert.equal(numericallyEqual("\\frac12", "0.5"), true);
  assert.equal(numericallyEqual("-\\frac{1}{2}", "-0.5"), true);
  assert.equal(numericallyEqual("\\dfrac{3}{4}", "0.75"), true);
  assert.equal(numericallyEqual("$\\frac{29}{5}$", "5.8"), true);
});

test("ishora va butun sonlar", () => {
  assert.equal(numericallyEqual("-5", "-5"), true);
  assert.equal(numericallyEqual("+5", "5"), true);
  assert.equal(numericallyEqual("-1/2", "-0.5"), true);
  assert.equal(numericallyEqual("-2 1/2", "-2.5"), true);
  assert.equal(numericallyEqual(".5", "1/2"), true);
});

test("kasrni qisqartirish sof matematik", () => {
  assert.equal(numericallyEqual("2/4", "1/2"), true);
  assert.equal(numericallyEqual("100/10", "10"), true);
  assert.equal(numericallyEqual("0.50", "0.5"), true);
});

test("raqam bo'lmagan javob null qaytaradi (satr fallback'iga tushadi)", () => {
  assert.equal(numericallyEqual("besh", "5"), null);
  assert.equal(numericallyEqual("Toshkent", "Toshkent"), null);
  assert.equal(numericallyEqual("x+1", "1"), null);
  assert.equal(parseRational("salom"), null);
  assert.equal(parseRational(""), null);
  assert.equal(parseRational("1/0"), null); // nolga bo'lish
});

test("FILL_GAP baholash: raqamli ekvivalentlik amalda", () => {
  const q = {
    id: "q1",
    order: 0,
    type: "FILL_GAP",
    marks: 2,
    prompt: { same: true, UZ: "Javob: ___" },
    gapAnswers: [{ same: true, UZ: "5.8" }],
  } as unknown as TestQuestion;

  // O'quvchi turli shaklda yozadi — hammasi to'g'ri.
  for (const ans of ["5.8", "29/5", "58/10", "5 4/5", "\\frac{29}{5}"]) {
    const g = gradeQuestion(q, [ans], "UZ");
    assert.equal(g.correct, true, `"${ans}" to'g'ri bo'lishi kerak`);
    assert.equal(g.earned, 2);
  }
  // Noto'g'ri qiymat.
  const wrong = gradeQuestion(q, ["6"], "UZ");
  assert.equal(wrong.correct, false);
  assert.equal(wrong.earned, 0);
});

test("FILL_GAP baholash: matnli javob eski satr solishtiruvida qoladi", () => {
  const q = {
    id: "q2",
    order: 0,
    type: "FILL_GAP",
    marks: 1,
    prompt: { same: true, UZ: "Poytaxt: ___" },
    gapAnswers: [{ same: true, UZ: "Toshkent" }],
  } as unknown as TestQuestion;

  assert.equal(gradeQuestion(q, ["toshkent"], "UZ").correct, true); // katta-kichik harf
  assert.equal(gradeQuestion(q, [" Toshkent "], "UZ").correct, true); // bo'shliq
  assert.equal(gradeQuestion(q, ["Samarqand"], "UZ").correct, false);
});

test("FILL_GAP: ko'p bo'shliq, aralash raqam va matn", () => {
  const q = {
    id: "q3",
    order: 0,
    type: "FILL_GAP",
    marks: 3,
    prompt: { same: true, UZ: "___ va ___" },
    gapAnswers: [{ same: true, UZ: "1/2" }, { same: true, UZ: "Toshkent" }],
  } as unknown as TestQuestion;

  assert.equal(gradeQuestion(q, ["0.5", "Toshkent"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["2/4", "toshkent"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["0.6", "Toshkent"], "UZ").correct, false);
});
