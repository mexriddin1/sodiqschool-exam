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
    grade: number;
    admissionThresholds: Prisma.JsonValue;
    gradingConfiguration: Prisma.JsonValue;
  };
  student: { fullName: string; sex: "MALE" | "FEMALE" | null };
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

export function computeSnapshot(result: ResultWithRelations) {
  return calculateResult({
    grade: result.exam.grade,
    thresholds: result.exam.admissionThresholds as unknown as AdmissionThresholds,
    gradingConfiguration: result.exam.gradingConfiguration,
    subjects: result.subjects.map((s) => ({
      subject: s.subject,
      meta: buildMeta(s.subject, result.exam.grade, result.student.fullName, {
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
      student: { select: { sex: true } },
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
      };
    })
    .sort((a, b) => b.percent - a.percent);

  const males = rows.filter((r) => r.sex === "MALE");
  const females = rows.filter((r) => r.sex === "FEMALE");

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
  const rankOverall = rankIn(rows, byComposite);
  const rankMale = rankIn(males, byComposite);
  const rankFemale = rankIn(females, byComposite);

  const SUBJECT_KEYS: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];

  for (const row of rows) {
    const overall = rankOverall?.(row) ?? null;
    const male = row.sex === "MALE" ? (rankMale?.(row) ?? null) : null;
    const female = row.sex === "FEMALE" ? (rankFemale?.(row) ?? null) : null;

    const subjectCohort: Record<string, unknown> = {};
    for (const key of SUBJECT_KEYS) {
      const bySubject = (r: Row) => r.subjectPercents[key] ?? 0;
      const subjRows = [...rows].sort((a, b) => bySubject(b) - bySubject(a));
      const subjMales = males.slice().sort((a, b) => bySubject(b) - bySubject(a));
      const subjFemales = females.slice().sort((a, b) => bySubject(b) - bySubject(a));
      const subjOverall = rankIn(subjRows, bySubject)?.(row) ?? null;
      const subjMale = row.sex === "MALE" ? (rankIn(subjMales, bySubject)?.(row) ?? null) : null;
      const subjFemale = row.sex === "FEMALE" ? (rankIn(subjFemales, bySubject)?.(row) ?? null) : null;
      subjectCohort[key] = {
        rank: subjOverall?.rank ?? null,
        total: rows.length,
        percentile: subjOverall?.percentile ?? null,
        peers: rows.length,
        male: subjMale ? { rank: subjMale.rank, total: males.length, percentile: subjMale.percentile, peers: males.length } : null,
        female: subjFemale ? { rank: subjFemale.rank, total: females.length, percentile: subjFemale.percentile, peers: females.length } : null,
      };
    }

    await prisma.result.update({
      where: { id: row.id },
      data: {
        calculatedSnapshot: {
          ...row.snapshot,
          cohort: {
            rank: overall?.rank ?? null,
            total: rows.length,
            percentile: overall?.percentile ?? null,
            peers: rows.length,
            male: male ? { rank: male.rank, total: males.length, percentile: male.percentile, peers: males.length } : null,
            female: female ? { rank: female.rank, total: females.length, percentile: female.percentile, peers: females.length } : null,
          },
          subjectCohort,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
