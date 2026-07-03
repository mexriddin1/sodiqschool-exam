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
    cohortSize: number | null;
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
// three times:
//   • overall  — every published peer
//   • male     — peers with student.sex === "MALE"
//   • female   — peers with student.sex === "FEMALE"
// so the parent report can show "12/128 yigitlar orasida" alongside the
// overall standing. Rank = 1 + count(peer.composite > this.composite);
// percentile = round(atOrBelow / denom * 100). Denominator = max(cohortSize,
// actualPeers) so a partially-published exam doesn't inflate percentiles.
export async function recomputeCohortRanks(examId: string): Promise<void> {
  const published = await prisma.result.findMany({
    where: { examId, status: "PUBLISHED" },
    select: {
      id: true,
      calculatedSnapshot: true,
      examId: true,
      exam: { select: { cohortSize: true } },
      student: { select: { sex: true } },
    },
  });
  if (published.length === 0) return;
  type Sex = "MALE" | "FEMALE" | null;
  type Row = {
    id: string;
    percent: number;
    snapshot: Record<string, unknown>;
    cohortSize: number;
    sex: Sex;
  };
  const rows: Row[] = published
    .map((r) => {
      const snap = (r.calculatedSnapshot as Record<string, unknown> | null) ?? {};
      const composite = (snap.composite as { composite?: number } | undefined)?.composite ?? 0;
      return {
        id: r.id,
        percent: composite,
        snapshot: snap,
        cohortSize: r.exam.cohortSize ?? published.length,
        sex: r.student.sex as Sex,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  const males = rows.filter((r) => r.sex === "MALE");
  const females = rows.filter((r) => r.sex === "FEMALE");

  function rankIn(peers: Row[], row: Row, cohortSize: number) {
    if (peers.length === 0) return null;
    const rank = 1 + peers.filter((p) => p.percent > row.percent).length;
    const atOrBelow = peers.filter((p) => p.percent <= row.percent).length;
    const denom = Math.max(cohortSize, peers.length);
    const percentile = Math.round((atOrBelow / denom) * 100);
    return { rank, total: cohortSize, peers: peers.length, percentile };
  }

  // For sex-split cohorts we scale the reported "total" against the same
  // ratio as the overall cohort — so if the exam has cohortSize=240 total
  // and 60% are male, the male total shown is ~144.
  function scaledSexTotal(peers: Row[], cohortSize: number): number {
    if (rows.length === 0) return peers.length;
    return Math.max(peers.length, Math.round((peers.length / rows.length) * cohortSize));
  }

  for (const row of rows) {
    const overall = rankIn(rows, row, row.cohortSize);
    const maleCohortSize = scaledSexTotal(males, row.cohortSize);
    const femaleCohortSize = scaledSexTotal(females, row.cohortSize);
    const male = row.sex === "MALE" ? rankIn(males, row, maleCohortSize) : null;
    const female = row.sex === "FEMALE" ? rankIn(females, row, femaleCohortSize) : null;

    await prisma.result.update({
      where: { id: row.id },
      data: {
        calculatedSnapshot: {
          ...row.snapshot,
          cohort: {
            rank: overall?.rank ?? null,
            total: row.cohortSize,
            percentile: overall?.percentile ?? null,
            peers: rows.length,
            // Sex-split rank blocks. `null` when the student's sex is
            // unknown or when there are no same-sex peers yet.
            male: male ? { rank: male.rank, total: male.total, percentile: male.percentile, peers: male.peers } : null,
            female: female ? { rank: female.rank, total: female.total, percentile: female.percentile, peers: female.peers } : null,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }
}
