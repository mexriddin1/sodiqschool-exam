// Composite layer: combines three SubjectReport outputs into one verdict.
// Implements the rule from resource/result.text:
//   "Har bir fan kesimidagi qabul qilinsin ko'rsatgichi kerak emas.
//    U faqat umumiyda tursin"
// → admission verdict is shown only on the composite. Per-subject gates are
//   computed and exposed for completeness, but the displayed "qabul qilinsin"
//   badge belongs to the composite.

import { BAND_COLORS, scoreBand } from "./compute.js";
import { AdmissionThresholds, Band, CompositeReport, SubjectKey, SubjectReport } from "./types.js";

const round = (x: number): number => Math.round(x);
const avg = (xs: number[]): number => (xs.length === 0 ? 0 : round(xs.reduce((a, b) => a + b, 0) / xs.length));

export interface CompositeInput {
  reports: Record<SubjectKey, SubjectReport>;
  grade: number;
  thresholds: AdmissionThresholds;
}

function thresholdFor(key: SubjectKey, grade: number, thresholds: AdmissionThresholds): number {
  const row = thresholds[String(grade)];
  if (!row) return 0;
  if (key === "MATH") return row.math;
  if (key === "ENGLISH") return row.en;
  return row.ct;
}

// Sodiq School official "Qabul qarori" — from resource/image.png.
// Mapped from the composite/potential band on the Yakuniy shkala. Per-grade
// per-subject minimum thresholds (resource/result.text) gate this: failing
// any subject's minimum demotes the verdict to "Not Yet Ready".
function verdictFor(compPotential: number, gateAllPassed: boolean): { label: string; sub: string; color: string } {
  if (!gateAllPassed) {
    return {
      label: "TAYYOR EMAS",
      sub: "Bir yoki bir nechta fan minimal chegaradan past",
      color: BAND_COLORS.bad,
    };
  }
  if (compPotential >= 84)
    return {
      label: "QABUL TAVSIYA ETILADI",
      sub: "Yuqori daraja — maktabga qabul tavsiya etiladi",
      color: BAND_COLORS.good,
    };
  if (compPotential >= 67)
    return {
      label: "QABUL QILINSIN",
      sub: "Ishonchli daraja — qabul tavsiya etiladi",
      color: BAND_COLORS.green,
    };
  if (compPotential >= 50)
    return {
      label: "SHARTLI QABUL",
      sub: "Rivojlanayotgan daraja — shartli qabul",
      color: BAND_COLORS.ok,
    };
  if (compPotential >= 35)
    return {
      label: "NAVBATDA",
      sub: "Shakllanayotgan daraja — navbatda",
      color: BAND_COLORS.orange,
    };
  return {
    label: "TAYYOR EMAS",
    sub: "Tamal bosqich — avval tayyorgarlik kerak",
    color: BAND_COLORS.bad,
  };
}

export function computeComposite(input: CompositeInput): CompositeReport {
  const keys: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
  const reps = keys.map((k) => ({ key: k, report: input.reports[k] }));

  const composite = avg(reps.map((r) => r.report.percent));
  const compPotential = avg(reps.map((r) => r.report.potential));
  const compAdjusted = avg(reps.map((r) => r.report.adjusted));
  const compBand: Band = scoreBand(composite);

  const techPcts = reps.map((r) =>
    r.report.lostTotal === 0 ? 0 : round((r.report.technicalLost / r.report.lostTotal) * 100),
  );
  const avgTechPct = avg(techPcts);

  const sorted = [...reps].sort((a, b) => b.report.percent - a.report.percent);
  const topSubject = { key: sorted[0]!.key, percent: sorted[0]!.report.percent };
  const lowSubject = { key: sorted[sorted.length - 1]!.key, percent: sorted[sorted.length - 1]!.report.percent };

  const perSubjectGate = {} as CompositeReport["perSubjectGate"];
  let gateAllPassed = true;
  for (const { key, report } of reps) {
    const threshold = thresholdFor(key, input.grade, input.thresholds);
    const passed = report.percent >= threshold;
    perSubjectGate[key] = { percent: report.percent, threshold, passed };
    if (!passed) gateAllPassed = false;
  }

  return {
    composite,
    compPotential,
    compAdjusted,
    compBand,
    avgTechPct,
    topSubject,
    lowSubject,
    verdict: verdictFor(compPotential, gateAllPassed),
    perSubjectGate,
    gateAllPassed,
  };
}

// Default admission thresholds from resource/result.text.
export const DEFAULT_ADMISSION_THRESHOLDS: AdmissionThresholds = {
  "5": { math: 30, ct: 40, en: 30 },
  "6": { math: 30, ct: 40, en: 30 },
  "7": { math: 35, ct: 30, en: 35 },
  "8": { math: 35, ct: 30, en: 35 },
  "9": { math: 35, ct: 25, en: 40 },
  "10": { math: 35, ct: 25, en: 40 },
  "11": { math: 35, ct: 25, en: 40 },
};
