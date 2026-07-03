// Wraps @sodiq/compute so the rest of the backend never imports compute logic
// directly. This is the authoritative calculator used at save / publish time.

import {
  AdmissionThresholds,
  computeComposite,
  CompositeReport,
  computeReport,
  DEFAULT_ADMISSION_THRESHOLDS,
  extractWeights,
  Question,
  SubjectInput,
  SubjectKey,
  SubjectMeta,
  SubjectReport,
  validateQuestions,
} from "@sodiq/compute";

export interface SubjectCalcInput {
  subject: SubjectKey;
  meta: SubjectMeta;
  questions: Question[];
  realData?: { percentile: number | null; cohortAverage: number | null; avgTimeSec: number | null };
}

export interface ResultCalcInput {
  grade: number;
  thresholds?: AdmissionThresholds;
  subjects: SubjectCalcInput[];
  // exam.gradingConfiguration — { weights: { math, english, criticalThinking } }.
  // Composite weights derive from this; undefined → equal thirds fallback.
  gradingConfiguration?: unknown;
}

export interface ResultCalcOutput {
  perSubject: Record<SubjectKey, SubjectReport>;
  composite: CompositeReport;
}

export function calculateResult(input: ResultCalcInput): ResultCalcOutput {
  const perSubject = {} as Record<SubjectKey, SubjectReport>;
  for (const sub of input.subjects) {
    const subjectInput: SubjectInput = {
      meta: sub.meta,
      questions: sub.questions,
      realData: sub.realData ?? { percentile: null, cohortAverage: null, avgTimeSec: null },
    };
    perSubject[sub.subject] = computeReport(subjectInput);
  }
  const { weights, source } = extractWeights(input.gradingConfiguration, input.grade);
  const composite = computeComposite({
    reports: perSubject,
    grade: input.grade,
    thresholds: input.thresholds ?? DEFAULT_ADMISSION_THRESHOLDS,
    weights: source === "exam" ? weights : undefined,
  });
  return { perSubject, composite };
}

export { validateQuestions };
