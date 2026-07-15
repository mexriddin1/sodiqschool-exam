// Composite layer: combines three SubjectReport outputs into one verdict.
// Implements the rule from resource/result.text:
//   "Har bir fan kesimidagi qabul qilinsin ko'rsatgichi kerak emas.
//    U faqat umumiyda tursin"
// → admission verdict is shown only on the composite. Per-subject gates are
//   computed and exposed for completeness, but the displayed "qabul qilinsin"
//   badge belongs to the composite.

import { BAND_COLORS, scoreBand } from "./compute.js";
import { AdmissionThresholds, Band, CompositeReport, SubjectKey, SubjectReport, SubjectWeights } from "./types.js";

const round = (x: number): number => Math.round(x);

// Equal thirds — used when the exam's gradingConfiguration doesn't declare
// weights. Kept in sync with the old avg() behaviour so legacy exams render
// the same number as before this feature landed.
export const DEFAULT_SUBJECT_WEIGHTS: SubjectWeights = {
  MATH: 1 / 3,
  ENGLISH: 1 / 3,
  CRITICAL_THINKING: 1 / 3,
};

// Weighted average of three subject-level values (percent / potential /
// adjusted). Weights are normalised so callers can pass unnormalised numbers
// (e.g. 40 / 30 / 30) and still get a correct result.
function weightedAvg(
  reports: Record<SubjectKey, SubjectReport>,
  weights: SubjectWeights,
  pick: (r: SubjectReport) => number,
): number {
  const keys: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
  const sumW = keys.reduce((s, k) => s + (weights[k] ?? 0), 0);
  if (sumW === 0) return 0;
  const sum = keys.reduce((s, k) => s + pick(reports[k]) * (weights[k] ?? 0), 0);
  return round(sum / sumW);
}

// Read weights out of exam.gradingConfiguration. Supports two shapes:
//   • per-grade:  { weightsByGrade: { "5": { math, ct, en }, "6": {...} } }
//   • flat/legacy:{ weights: { math, english, criticalThinking } }
// Per-grade wins when both are present AND a grade is supplied. Values may
// be normalised (0.4) or percent-ish (40) — the function normalises to
// [0..1] internally so the composite formula sums to 1.
export function extractWeights(
  gradingConfig: unknown,
  grade?: number,
): { weights: SubjectWeights; source: "exam" | "default" } {
  if (!gradingConfig || typeof gradingConfig !== "object") {
    return { weights: DEFAULT_SUBJECT_WEIGHTS, source: "default" };
  }
  const conf = gradingConfig as Record<string, unknown>;

  // 1) Per-grade block. Preferred when a grade was supplied.
  if (grade != null) {
    const byGrade = conf.weightsByGrade as Record<string, unknown> | undefined;
    if (byGrade && typeof byGrade === "object") {
      const row = byGrade[String(grade)] as Record<string, unknown> | undefined;
      const normalised = readSubjectWeightsRow(row);
      if (normalised) return { weights: normalised, source: "exam" };
    }
  }

  // 2) Flat block. Legacy shape kept for old exams.
  const flat = readSubjectWeightsRow(conf.weights as Record<string, unknown> | undefined);
  if (flat) return { weights: flat, source: "exam" };

  return { weights: DEFAULT_SUBJECT_WEIGHTS, source: "default" };
}

function readSubjectWeightsRow(raw: Record<string, unknown> | undefined): SubjectWeights | null {
  if (!raw || typeof raw !== "object") return null;
  const read = (...keys: string[]): number => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    }
    return 0;
  };
  const math = read("math", "MATH");
  const english = read("english", "ENGLISH", "en");
  const ct = read("criticalThinking", "CRITICAL_THINKING", "ct");
  const sum = math + english + ct;
  if (sum <= 0) return null;
  return {
    MATH: math / sum,
    ENGLISH: english / sum,
    CRITICAL_THINKING: ct / sum,
  };
}

const avg = (xs: number[]): number => (xs.length === 0 ? 0 : round(xs.reduce((a, b) => a + b, 0) / xs.length));

export interface CompositeInput {
  reports: Record<SubjectKey, SubjectReport>;
  grade: number;
  thresholds: AdmissionThresholds;
  // Per-subject weights (0..1, must sum to 1 after normalisation). When
  // omitted, composite falls back to equal thirds — legacy behaviour.
  weights?: SubjectWeights;
}

function thresholdFor(key: SubjectKey, grade: number, thresholds: AdmissionThresholds): number {
  const row = thresholds[String(grade)];
  if (!row) return 0;
  if (key === "MATH") return row.math;
  if (key === "ENGLISH") return row.en;
  return row.ct;
}

// Verdict from a candidate's potential (what they can achieve after
// eliminating technical errors) — NOT their raw score. Thresholds match the
// official 5-band scale: 83+ Juda yuqori, 66+ Yaxshi, 49+ O'rtacha, 34+ Zaif,
// else Sayoz. Callers holding subject gates must apply GATE_FAILED_VERDICT
// themselves; this function only maps a number onto the band.
export function verdictFor(potential: number): { label: string; sub: string; color: string } {
  if (potential > 83)
    return {
      label: "QABUL TAVSIYA ETILADI",
      sub: "Yuqori daraja — maktabga qabul tavsiya etiladi",
      color: BAND_COLORS.good,
    };
  if (potential > 66)
    return {
      label: "QABUL QILINSIN",
      sub: "Ishonchli daraja — qabul tavsiya etiladi",
      color: BAND_COLORS.blue,
    };
  if (potential > 49)
    return {
      label: "SHARTLI QABUL",
      sub: "Rivojlanayotgan daraja — shartli qabul",
      color: BAND_COLORS.ok,
    };
  if (potential > 34)
    return {
      label: "ZAXIRA QABUL",
      sub: "Shakllanayotgan daraja — zaxira qabul",
      color: BAND_COLORS.orange,
    };
  return {
    label: "TAYYOR EMAS",
    sub: "Tamal bosqich — avval tayyorgarlik kerak",
    color: BAND_COLORS.bad,
  };
}

// Falling below ANY subject's minimum demotes the verdict outright, however
// strong the average — per docs/calculation-rules.md ("Bir yoki bir nechta fan
// minimal chegaradan past"). Kept separate from verdictFor()'s band scale
// because it is a gate, not a band.
export const GATE_FAILED_VERDICT: { label: string; sub: string; color: string } = {
  label: "TAYYOR EMAS",
  sub: "Bir yoki bir nechta fan minimal chegaradan past",
  color: BAND_COLORS.bad,
};

export function computeComposite(input: CompositeInput): CompositeReport {
  const keys: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
  const reps = keys.map((k) => ({ key: k, report: input.reports[k] }));

  const weights = input.weights ?? DEFAULT_SUBJECT_WEIGHTS;
  const weightsSource: "exam" | "default" = input.weights ? "exam" : "default";

  const composite = weightedAvg(input.reports, weights, (r) => r.percent);
  const compPotential = weightedAvg(input.reports, weights, (r) => r.potential);
  const compAdjusted = weightedAvg(input.reports, weights, (r) => r.adjusted);
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
    // compPotential, not composite: a candidate is judged on their ceiling
    // once technical errors are stripped out. Passing `composite` here (from
    // b599564 until 2026-07-15) silently contradicted both this file's own
    // comment and docs/calculation-rules.md.
    verdict: gateAllPassed ? verdictFor(compPotential) : GATE_FAILED_VERDICT,
    perSubjectGate,
    gateAllPassed,
    weights,
    weightsSource,
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
