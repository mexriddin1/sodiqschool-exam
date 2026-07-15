// Computes the calculated snapshot for a result. Used by publish (to freeze)
// and by admin preview (live). Also recomputes cohort rank/percentile across
// published peers in the same exam.

import { Prisma } from "@prisma/client";
import {
  AdmissionThresholds,
  Question,
  SubjectKey,
} from "@sodiq/compute";

import { prisma } from "../db.js";
import { badRequest } from "../lib/errors.js";
import { calculateResult } from "./calculation.js";

const SUBJECT_NAMES: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

function buildMeta(subject: SubjectKey, grade: number, candidate: string, totals: { totalQuestions: number; totalMarks: number }) {
  return {
    school: "Sodiq School",
    slogan: "Biz ilmga sodiqmiz",
    office: "Academic Assessment Office",
    candidate,
    grade,
    gradeLabel: `${grade}-sinfga nomzod`,
    subject: SUBJECT_NAMES[subject],
    totalQuestions: totals.totalQuestions,
    totalMarks: totals.totalMarks,
    brand: { navy: "#06113C", orange: "#FF8A32" },
  };
}

export interface ResultWithRelations {
  id: string;
  exam: {
    // Legacy single grade — only the first entry of `grades`. Kept solely as
    // the fallback for rows created before multi-grade landed (`grades: []`).
    grade: number;
    grades: number[];
    admissionThresholds: Prisma.JsonValue;
    gradingConfiguration: Prisma.JsonValue;
  };
  student: { fullName: string; sex: "MALE" | "FEMALE" | null; grade: number };
  subjects: {
    subject: SubjectKey;
    totalQuestions: number;
    totalMarks: number;
    questions: Prisma.JsonValue;
    realData: Prisma.JsonValue | null;
    manualNotes: Prisma.JsonValue | null;
  }[];
  manualContent: Prisma.JsonValue;
}

// Which grade drives thresholds, weights and `gradeLabel`.
//
// The student's own — NOT `exam.grade`. An exam can span several grades, and
// `exam.grade` holds only the first, so on a multi-grade exam it scored every
// student against the first grade's thresholds and printed the wrong
// `gradeLabel` on their report. `recomputeCohortRanks` below has keyed on
// `student.grade` since 2026-07-06; this keeps the snapshot consistent with it.
//
// Throws rather than falling back: `thresholdFor` returns 0 for a grade the
// exam doesn't define, and a 0 threshold passes every admission gate — so a
// misconfigured exam would silently mark candidates admitted.
function resolveGrade(result: ResultWithRelations): number {
  const grade = result.student.grade;
  const examGrades = result.exam.grades.length > 0 ? result.exam.grades : [result.exam.grade];
  if (!examGrades.includes(grade)) {
    throw badRequest(
      "GRADE_NOT_IN_EXAM",
      `O'quvchi ${grade}-sinf, lekin imtihon ${examGrades.join(", ")}-sinf uchun mo'ljallangan.`,
    );
  }
  return grade;
}

export function computeSnapshot(result: ResultWithRelations) {
  const grade = resolveGrade(result);
  // Nullish thresholds fall back to DEFAULT_ADMISSION_THRESHOLDS (grades 5-11)
  // inside calculateResult. An object that merely *lacks* this grade does not,
  // so reject it here instead of letting every gate pass on a 0 threshold.
  const thresholds = (result.exam.admissionThresholds ?? undefined) as unknown as
    | AdmissionThresholds
    | undefined;
  if (thresholds && !thresholds[String(grade)]) {
    throw badRequest(
      "MISSING_THRESHOLDS",
      `Imtihonda ${grade}-sinf uchun qabul chegaralari belgilanmagan.`,
    );
  }
  return calculateResult({
    grade,
    thresholds,
    gradingConfiguration: result.exam.gradingConfiguration,
    subjects: result.subjects.map((s) => ({
      subject: s.subject,
      meta: buildMeta(s.subject, grade, result.student.fullName, {
        totalQuestions: s.totalQuestions,
        totalMarks: s.totalMarks,
      }),
      questions: s.questions as unknown as Question[],
      realData: (s.realData ?? undefined) as
        | { percentile: number | null; cohortAverage: number | null; avgTimeSec: number | null }
        | undefined,
    })),
  });
}

// Cohort rank across published peers in the same exam. Ranks are computed
// three times (overall, male, female) for both the composite score and each
// individual subject score. Composite → snapshot.cohort; per-subject →
// snapshot.subjectCohort.MATH / .ENGLISH / .CRITICAL_THINKING.
export async function recomputeCohortRanks(examId: string): Promise<void> {
  const published = await prisma.result.findMany({
    where: { examId, status: "PUBLISHED" },
    select: {
      id: true,
      calculatedSnapshot: true,
      examId: true,
      student: { select: { sex: true, grade: true } },
    },
  });
  if (published.length === 0) return;
  type Sex = "MALE" | "FEMALE" | null;
  type Row = {
    id: string;
    percent: number;
    subjectPercents: Record<string, number>;
    snapshot: Record<string, unknown>;
    sex: Sex;
    grade: number;
  };
  const rows: Row[] = published
    .map((r) => {
      const snap = (r.calculatedSnapshot as Record<string, unknown> | null) ?? {};
      const composite = (snap.composite as { composite?: number } | undefined)?.composite ?? 0;
      const perSubject = (snap.perSubject as Record<string, { percent?: number }> | undefined) ?? {};
      return {
        id: r.id,
        percent: composite,
        subjectPercents: {
          MATH: perSubject.MATH?.percent ?? 0,
          ENGLISH: perSubject.ENGLISH?.percent ?? 0,
          CRITICAL_THINKING: perSubject.CRITICAL_THINKING?.percent ?? 0,
        },
        snapshot: snap,
        sex: r.student.sex as Sex,
        grade: r.student.grade,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  function rankIn(peers: Row[], getVal: (r: Row) => number) {
    if (peers.length === 0) return null;
    return (row: Row) => {
      const val = getVal(row);
      const rank = 1 + peers.filter((p) => getVal(p) > val).length;
      const atOrBelow = peers.filter((p) => getVal(p) <= val).length;
      const percentile = Math.round((atOrBelow / peers.length) * 100);
      return { rank, total: peers.length, percentile };
    };
  }

  const byComposite = (r: Row) => r.percent;
  const SUBJECT_KEYS: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];

  // Cohort persentil sinf bo'yicha filtrlanadi (2026-07-06): imtihonda bir
  // nechta sinf ishtirok etsa, boshqa sinf ishtirokchilari peer sifatida
  // hisoblanmaydi — aks holda 5-sinf va 8-sinf birga taqqoslanardi.
  // Bir-grade eksamlar avvalgidek ishlaydi, chunki filter ta'sirsiz.
  for (const row of rows) {
    const gradePeers = rows.filter((r) => r.grade === row.grade);
    const gradeMales = gradePeers.filter((r) => r.sex === "MALE");
    const gradeFemales = gradePeers.filter((r) => r.sex === "FEMALE");

    const overall = rankIn(gradePeers, byComposite)?.(row) ?? null;
    const male = row.sex === "MALE" ? (rankIn(gradeMales, byComposite)?.(row) ?? null) : null;
    const female = row.sex === "FEMALE" ? (rankIn(gradeFemales, byComposite)?.(row) ?? null) : null;

    const subjectCohort: Record<string, unknown> = {};
    for (const key of SUBJECT_KEYS) {
      const bySubject = (r: Row) => r.subjectPercents[key] ?? 0;
      const subjOverall = rankIn(gradePeers, bySubject)?.(row) ?? null;
      const subjMale = row.sex === "MALE" ? (rankIn(gradeMales, bySubject)?.(row) ?? null) : null;
      const subjFemale = row.sex === "FEMALE" ? (rankIn(gradeFemales, bySubject)?.(row) ?? null) : null;
      subjectCohort[key] = {
        rank: subjOverall?.rank ?? null,
        total: gradePeers.length,
        percentile: subjOverall?.percentile ?? null,
        peers: gradePeers.length,
        grade: row.grade,
        male: subjMale ? { rank: subjMale.rank, total: gradeMales.length, percentile: subjMale.percentile, peers: gradeMales.length } : null,
        female: subjFemale ? { rank: subjFemale.rank, total: gradeFemales.length, percentile: subjFemale.percentile, peers: gradeFemales.length } : null,
      };
    }

    await prisma.result.update({
      where: { id: row.id },
      data: {
        calculatedSnapshot: {
          ...row.snapshot,
          cohort: {
            rank: overall?.rank ?? null,
            total: gradePeers.length,
            percentile: overall?.percentile ?? null,
            peers: gradePeers.length,
            grade: row.grade,
            male: male ? { rank: male.rank, total: gradeMales.length, percentile: male.percentile, peers: gradeMales.length } : null,
            female: female ? { rank: female.rank, total: gradeFemales.length, percentile: female.percentile, peers: gradeFemales.length } : null,
          },
          subjectCohort,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
