import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_ADMISSION_THRESHOLDS,
  generatePublicCode,
  isValidPublicCode,
  Question,
  SubjectKey,
  verdictFor,
} from "@sodiq/compute";

import { calculateResult } from "../src/services/calculation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../client/src/data");
const load = (n: string) => JSON.parse(readFileSync(resolve(DATA_DIR, n), "utf8")) as {
  meta: { totalQuestions: number; totalMarks: number };
  questions: Question[];
  realData?: { percentile: number | null; cohortAverage: number | null; avgTimeSec: number | null };
};

function meta(subject: string, grade: number) {
  return {
    school: "Sodiq School",
    slogan: "Biz ilmga sodiqmiz",
    office: "Academic Assessment Office",
    candidate: "Test",
    grade,
    gradeLabel: `${grade}-sinfga nomzod`,
    subject,
    totalQuestions: 0,
    totalMarks: 0,
    brand: { navy: "#06113C", orange: "#FF8A32" },
  };
}

test("calculateResult builds composite verdict for sample data", () => {
  const math = load("student.json");
  const en = load("english.json");
  const ct = load("critical-thinking.json");
  const out = calculateResult({
    grade: 5,
    thresholds: DEFAULT_ADMISSION_THRESHOLDS,
    subjects: [
      { subject: "MATH", meta: { ...meta("Matematika", 5), totalQuestions: math.meta.totalQuestions, totalMarks: math.meta.totalMarks }, questions: math.questions, realData: math.realData },
      { subject: "ENGLISH", meta: { ...meta("Ingliz tili", 5), totalQuestions: en.meta.totalQuestions, totalMarks: en.meta.totalMarks }, questions: en.questions, realData: en.realData },
      { subject: "CRITICAL_THINKING", meta: { ...meta("Tanqidiy fikrlash", 5), totalQuestions: ct.meta.totalQuestions, totalMarks: ct.meta.totalMarks }, questions: ct.questions, realData: ct.realData },
    ],
  });
  assert.ok(out.composite.composite > 0);
  assert.ok(out.perSubject["MATH"].percent > 0);
  // 5-band scale; "TAYYORGARLIK" was renamed to "TAYYOR EMAS" long ago.
  assert.ok(
    ["QABUL TAVSIYA ETILADI", "QABUL QILINSIN", "SHARTLI QABUL", "ZAXIRA QABUL", "TAYYOR EMAS"]
      .includes(out.composite.verdict.label),
  );
});

test("calculateResult publish-gate fails with stricter thresholds", () => {
  const math = load("student.json");
  const en = load("english.json");
  const ct = load("critical-thinking.json");
  const out = calculateResult({
    grade: 5,
    thresholds: { "5": { math: 99, ct: 99, en: 99 } },
    subjects: [
      { subject: "MATH", meta: { ...meta("Matematika", 5), totalQuestions: math.meta.totalQuestions, totalMarks: math.meta.totalMarks }, questions: math.questions },
      { subject: "ENGLISH", meta: { ...meta("Ingliz tili", 5), totalQuestions: en.meta.totalQuestions, totalMarks: en.meta.totalMarks }, questions: en.questions },
      { subject: "CRITICAL_THINKING", meta: { ...meta("Tanqidiy fikrlash", 5), totalQuestions: ct.meta.totalQuestions, totalMarks: ct.meta.totalMarks }, questions: ct.questions },
    ],
  });
  // Chegara ma'lumot uchun hisoblanadi...
  assert.equal(out.composite.gateAllPassed, false);
  // ...lekin 2026-08-03 dan qarorni pasaytirmaydi: maktab qarori — status
  // butun saytda faqat umumiy ball bo'yicha berilsin.
  assert.equal(out.composite.verdict.label, verdictFor(out.composite.composite).label);
});

test("qaror BALLdan hisoblanadi (compPotential dan emas)", () => {
  const math = load("student.json");
  const en = load("english.json");
  const ct = load("critical-thinking.json");
  const out = calculateResult({
    grade: 5,
    thresholds: DEFAULT_ADMISSION_THRESHOLDS, // realistic — gates pass
    subjects: [
      { subject: "MATH", meta: { ...meta("Matematika", 5), totalQuestions: math.meta.totalQuestions, totalMarks: math.meta.totalMarks }, questions: math.questions },
      { subject: "ENGLISH", meta: { ...meta("Ingliz tili", 5), totalQuestions: en.meta.totalQuestions, totalMarks: en.meta.totalMarks }, questions: en.questions },
      { subject: "CRITICAL_THINKING", meta: { ...meta("Tanqidiy fikrlash", 5), totalQuestions: ct.meta.totalQuestions, totalMarks: ct.meta.totalMarks }, questions: ct.questions },
    ],
  });
  const { composite, compPotential, compBand, gateAllPassed, verdict } = out.composite;

  assert.equal(gateAllPassed, true, "sample data should clear the default gates");
  // Namuna ma'lumot band chegarasini kesib o'tadi (composite 80 -> "QABUL
  // QILINSIN", compPotential 84 -> "QABUL TAVSIYA ETILADI"), ya'ni bu test
  // ikkalasini ajrata oladi. Aynan shu farq imtihon kunida "ko'k ball, yashil
  // qaror" bo'lib ko'rinib qolgan edi.
  assert.notEqual(verdictFor(composite).label, verdictFor(compPotential).label);
  assert.equal(verdict.label, verdictFor(composite).label);
  // Qaror rangi ekrandagi ball rangi bilan bir xil bo'lishi SHART.
  assert.equal(verdict.color, compBand.color);
});

test("public code: unique sample of 1000 has very low collision rate", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const c = generatePublicCode();
    assert.ok(isValidPublicCode(c), `invalid code: ${c}`);
    codes.add(c);
  }
  // With ~730M space and 1000 codes, collisions are essentially impossible.
  assert.equal(codes.size, 1000);
});
