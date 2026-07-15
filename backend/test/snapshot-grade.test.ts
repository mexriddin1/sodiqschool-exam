// Regression: computeSnapshot must score each student against THEIR OWN grade.
//
// Before 2026-07-15 it passed `exam.grade` — the legacy field holding only the
// first entry of `exam.grades` — into thresholds, weights and `gradeLabel`. On
// a multi-grade exam that scored every student as if they sat the exam's first
// grade, and printed the wrong `gradeLabel` on their report.
// `recomputeCohortRanks` has keyed on `student.grade` since 2026-07-06; these
// tests pin the snapshot to the same key.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Question, SubjectKey } from "@sodiq/compute";

import { computeSnapshot, type ResultWithRelations } from "../src/services/snapshot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../client/src/data");
const load = (n: string) =>
  JSON.parse(readFileSync(resolve(DATA_DIR, n), "utf8")) as { questions: Question[] };

const FILES: Record<SubjectKey, string> = {
  MATH: "student.json",
  ENGLISH: "english.json",
  CRITICAL_THINKING: "critical-thinking.json",
};

function subjects(): ResultWithRelations["subjects"] {
  return (Object.keys(FILES) as SubjectKey[]).map((subject) => {
    const { questions } = load(FILES[subject]);
    return {
      subject,
      totalQuestions: questions.length,
      totalMarks: questions.reduce((s, q) => s + q.marks, 0),
      questions: questions as unknown as ResultWithRelations["subjects"][number]["questions"],
      realData: null,
      manualNotes: null,
    };
  });
}

// Grade 5 and grade 8 rows are deliberately far apart so an assertion can tell
// which row was used. Grade 5 is trivially passable; grade 8 is unreachable.
const THRESHOLDS = {
  "5": { math: 1, ct: 1, en: 1 },
  "8": { math: 99, ct: 99, en: 99 },
};

// Grade 5 is all-MATH, grade 8 is all-ENGLISH — so the composite itself
// reveals which grade's weights were applied.
const GRADING = {
  weightsByGrade: {
    "5": { math: 100, ct: 0, en: 0 },
    "8": { math: 0, ct: 0, en: 100 },
  },
};

function buildResult(opts: {
  studentGrade: number;
  examGrades: number[];
  examGrade: number;
  thresholds?: unknown;
  gradingConfiguration?: unknown;
}): ResultWithRelations {
  return {
    id: "result-1",
    exam: {
      grade: opts.examGrade,
      grades: opts.examGrades,
      admissionThresholds: (opts.thresholds === undefined
        ? THRESHOLDS
        : opts.thresholds) as ResultWithRelations["exam"]["admissionThresholds"],
      gradingConfiguration: (opts.gradingConfiguration === undefined
        ? GRADING
        : opts.gradingConfiguration) as ResultWithRelations["exam"]["gradingConfiguration"],
    },
    student: { fullName: "Test O'quvchi", sex: "MALE", grade: opts.studentGrade },
    subjects: subjects(),
    manualContent: {},
  };
}

// A multi-grade exam whose legacy `grade` is 5. The grade-8 student is the
// regression: the old code read exam.grade and scored them as grade 5.
const MULTI = { examGrades: [5, 8], examGrade: 5 };

test("multi-grade exam: student's own grade drives the admission thresholds", () => {
  const g5 = computeSnapshot(buildResult({ ...MULTI, studentGrade: 5 }));
  const g8 = computeSnapshot(buildResult({ ...MULTI, studentGrade: 8 }));

  assert.equal(g5.composite.perSubjectGate.MATH.threshold, 1, "grade 5 must use the '5' row");
  assert.equal(g8.composite.perSubjectGate.MATH.threshold, 99, "grade 8 must use the '8' row");
  assert.equal(g5.composite.gateAllPassed, true);
  assert.equal(g8.composite.gateAllPassed, false);
});

test("multi-grade exam: student's own grade drives the subject weights", () => {
  const g5 = computeSnapshot(buildResult({ ...MULTI, studentGrade: 5 }));
  const g8 = computeSnapshot(buildResult({ ...MULTI, studentGrade: 8 }));

  assert.equal(g5.composite.weightsSource, "exam");
  assert.equal(g5.composite.weights.MATH, 1, "grade 5 weights are all-MATH");
  assert.equal(g8.composite.weights.ENGLISH, 1, "grade 8 weights are all-ENGLISH");

  // With all-MATH vs all-ENGLISH weights, the composite is just that subject's
  // percent — so the two students cannot coincidentally agree.
  assert.equal(g5.composite.composite, g5.perSubject.MATH.percent);
  assert.equal(g8.composite.composite, g8.perSubject.ENGLISH.percent);
});

test("multi-grade exam: gradeLabel names the student's grade, not the exam's first", () => {
  const g8 = computeSnapshot(buildResult({ ...MULTI, studentGrade: 8 }));

  for (const key of Object.keys(FILES) as SubjectKey[]) {
    assert.equal(g8.perSubject[key].meta.grade, 8);
    assert.equal(g8.perSubject[key].meta.gradeLabel, "8-sinfga nomzod");
  }
});

test("legacy exam with empty grades[] falls back to exam.grade", () => {
  const snap = computeSnapshot(
    buildResult({ studentGrade: 5, examGrades: [], examGrade: 5 }),
  );
  assert.equal(snap.composite.perSubjectGate.MATH.threshold, 1);
  assert.equal(snap.perSubject.MATH.meta.gradeLabel, "5-sinfga nomzod");
});

test("student outside the exam's grades is rejected, not silently rescored", () => {
  assert.throws(
    () => computeSnapshot(buildResult({ ...MULTI, studentGrade: 9 })),
    (e: Error & { code?: string; status?: number }) => {
      assert.equal(e.code, "GRADE_NOT_IN_EXAM");
      assert.equal(e.status, 400);
      return true;
    },
  );
});

test("thresholds lacking the student's grade throw instead of passing every gate", () => {
  // thresholdFor() returns 0 for an undefined grade row, and every percent >= 0
  // — so without this guard a misconfigured exam marks candidates admitted.
  assert.throws(
    () =>
      computeSnapshot(
        buildResult({ ...MULTI, studentGrade: 8, thresholds: { "5": { math: 1, ct: 1, en: 1 } } }),
      ),
    (e: Error & { code?: string }) => {
      assert.equal(e.code, "MISSING_THRESHOLDS");
      return true;
    },
  );
});

test("nullish thresholds still fall back to the compute defaults", () => {
  // JSON null is the "not configured" case and must keep working via
  // DEFAULT_ADMISSION_THRESHOLDS (grades 5-11), not trip the guard above.
  const snap = computeSnapshot(buildResult({ ...MULTI, studentGrade: 8, thresholds: null }));
  assert.equal(snap.composite.perSubjectGate.MATH.threshold, 35, "grade 8 default math threshold");
});
