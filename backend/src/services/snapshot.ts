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
  exam: { grade: number; admissionThresholds: Prisma.JsonValue; cohortSize: number | null };
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

// Cohort rank across published peers in the same exam. Simple, transparent:
// rank = 1 + count(peer.compositePercent > this.compositePercent).
// Percentile = round((count(peer.compositePercent ≤ this.compositePercent) / cohortSize) * 100).
export async function recomputeCohortRanks(examId: string): Promise<void> {
  const published = await prisma.result.findMany({
    where: { examId, status: "PUBLISHED" },
    select: { id: true, calculatedSnapshot: true, examId: true, exam: { select: { cohortSize: true } } },
  });
  if (published.length === 0) return;
  type Row = { id: string; percent: number; snapshot: Record<string, unknown>; cohortSize: number };
  const rows: Row[] = published
    .map((r) => {
      const snap = (r.calculatedSnapshot as Record<string, unknown> | null) ?? {};
      const composite = (snap.composite as { composite?: number } | undefined)?.composite ?? 0;
      return {
        id: r.id,
        percent: composite,
        snapshot: snap,
        cohortSize: r.exam.cohortSize ?? published.length,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rank = 1 + rows.filter((p) => p.percent > row.percent).length;
    const atOrBelow = rows.filter((p) => p.percent <= row.percent).length;
    const denom = Math.max(row.cohortSize, rows.length);
    const percentile = Math.round((atOrBelow / denom) * 100);

    await prisma.result.update({
      where: { id: row.id },
      data: {
        calculatedSnapshot: {
          ...row.snapshot,
          cohort: { rank, total: row.cohortSize, percentile, peers: rows.length },
        } as Prisma.InputJsonValue,
      },
    });
  }
}
