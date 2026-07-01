import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  computeReport,
  computeComposite,
  DEFAULT_ADMISSION_THRESHOLDS,
  generatePublicCode,
  isValidPublicCode,
  scoreBand,
  masteryFromKDI,
  scoreCI,
  validateQuestions,
  SubjectInput,
  SubjectKey,
  SubjectReport,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../client/src/data");
const load = (name: string): SubjectInput => JSON.parse(readFileSync(resolve(DATA_DIR, name), "utf8"));

// Official "Yakuniy shkala" — from resource/image.png.
test("scoreBand uses official 5-level scale", () => {
  assert.equal(scoreBand(95).key, "yuqori");
  assert.equal(scoreBand(95).admission, "Strong Admit");
  assert.equal(scoreBand(75).key, "ishonchli");
  assert.equal(scoreBand(75).admission, "Admit");
  assert.equal(scoreBand(60).key, "rivojlanayotgan");
  assert.equal(scoreBand(60).admission, "Conditional Admit");
  assert.equal(scoreBand(40).key, "shakllanayotgan");
  assert.equal(scoreBand(40).admission, "Waitlist");
  assert.equal(scoreBand(20).key, "tamal");
  assert.equal(scoreBand(20).admission, "Not Yet Ready");
});

test("masteryFromKDI is the same scale as scoreBand", () => {
  assert.equal(masteryFromKDI(95).label, "Yuqori daraja");
  assert.equal(masteryFromKDI(70).label, "Ishonchli daraja");
  assert.equal(masteryFromKDI(50).label, "Rivojlanayotgan daraja");
  assert.equal(masteryFromKDI(40).label, "Shakllanayotgan daraja");
  assert.equal(masteryFromKDI(20).label, "Tamal bosqich");
});

test("scoreCI: zero n returns no margin", () => {
  const ci = scoreCI(50, 0);
  assert.equal(ci.margin, 0);
});

test("Math sample report computes from labels", () => {
  const r = computeReport(load("student.json"));
  assert.equal(r.totalQuestions, 25);
  assert.equal(r.totalMarks, 100);
  assert.ok(r.percent > 0 && r.percent <= 100);
  assert.ok(r.kdi >= 0 && r.kdi <= 100);
  assert.ok(r.adjusted >= r.percent, "adjusted >= percent (technical errors recoverable)");
  assert.equal(r.kdiParts.wCorrect + (r.tiers["Oson"].wrong + r.tiers["O'rta"].wrong * 2 + r.tiers["Qiyin"].wrong * 3), r.kdiParts.wTotal);
});

test("English and Critical Thinking samples compute too", () => {
  const en = computeReport(load("english.json"));
  const ct = computeReport(load("critical-thinking.json"));
  assert.ok(en.percent >= 0);
  assert.ok(ct.percent >= 0);
});

test("validateQuestions catches earned > marks", () => {
  const errs = validateQuestions([
    {
      id: "Q1",
      marks: 3,
      earned: 4,
      difficulty: "Oson",
      strand: "x",
      topic: "y",
      subTopic: "z",
      skill: "s",
      bloom: "Tushunish",
      reasoning: null,
      gradeLevel: "5-sinf",
      framework: "f",
      result: "To'g'ri",
      errorType: null,
      evidence: "",
    },
  ]);
  assert.ok(errs.some((e) => e.field === "earned"));
});

test("validateQuestions catches correct + errorType set", () => {
  const errs = validateQuestions([
    {
      id: "Q1",
      marks: 3,
      earned: 3,
      difficulty: "Oson",
      strand: "x",
      topic: "y",
      subTopic: "z",
      skill: "s",
      bloom: "Tushunish",
      reasoning: null,
      gradeLevel: "5-sinf",
      framework: "f",
      result: "To'g'ri",
      errorType: "Texnik",
      evidence: "",
    },
  ]);
  assert.ok(errs.some((e) => e.field === "errorType"));
});

test("computeComposite verdict + admission gate", () => {
  const reports: Record<SubjectKey, SubjectReport> = {
    MATH: computeReport(load("student.json")),
    ENGLISH: computeReport(load("english.json")),
    CRITICAL_THINKING: computeReport(load("critical-thinking.json")),
  };
  const comp = computeComposite({
    reports,
    grade: 5,
    thresholds: DEFAULT_ADMISSION_THRESHOLDS,
  });
  assert.ok(comp.composite >= 0 && comp.composite <= 100);
  // Sample data is for a strong 5th-grader; all three subjects should clear the
  // low (25-40%) grade-5 thresholds.
  assert.equal(comp.gateAllPassed, true, "all three subjects clear grade-5 thresholds");
  assert.ok(["STRONG ADMIT", "ADMIT", "CONDITIONAL ADMIT", "WAITLIST", "NOT YET READY"].includes(comp.verdict.label));
});

test("computeComposite admission gate fails when one subject below threshold", () => {
  const reports: Record<SubjectKey, SubjectReport> = {
    MATH: computeReport(load("student.json")),
    ENGLISH: computeReport(load("english.json")),
    CRITICAL_THINKING: computeReport(load("critical-thinking.json")),
  };
  const comp = computeComposite({
    reports,
    grade: 5,
    thresholds: { "5": { math: 99, ct: 99, en: 99 } },
  });
  assert.equal(comp.gateAllPassed, false);
  assert.equal(comp.verdict.label, "NOT YET READY");
});

test("generatePublicCode is 6 chars and excludes O/0/I/1", () => {
  for (let i = 0; i < 50; i++) {
    const code = generatePublicCode();
    assert.equal(code.length, 6);
    assert.equal(isValidPublicCode(code), true);
    assert.ok(!/[O0I1]/.test(code));
  }
});
