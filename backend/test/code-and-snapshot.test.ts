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
  assert.equal(out.composite.gateAllPassed, false);
  // Failing a subject minimum demotes the verdict regardless of score. This
  // assertion is the original contract from docs/calculation-rules.md; only
  // the label changed ("TAYYORGARLIK" -> "TAYYOR EMAS"). It was red from that
  // rename onward, which hid b599564 dropping the demotion entirely — nobody
  // noticed because `tsx` was never installed, so this suite never ran.
  assert.equal(out.composite.verdict.label, "TAYYOR EMAS");
  assert.equal(out.composite.verdict.sub, "Bir yoki bir nechta fan minimal chegaradan past");
});

test("verdict reads off compPotential, not composite", () => {
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
  const { composite, compPotential, gateAllPassed, verdict } = out.composite;

  assert.equal(gateAllPassed, true, "sample data should clear the default gates");
  // The sample data straddles a band boundary (composite 80 -> "QABUL
  // QILINSIN", compPotential 84 -> "QABUL TAVSIYA ETILADI"), so the two
  // inputs give different verdicts and this test can tell them apart.
  assert.notEqual(verdictFor(composite).label, verdictFor(compPotential).label);
  assert.equal(verdict.label, verdictFor(compPotential).label);
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
