// Domain types for the Sodiq School diagnostic engine.
// Mirrors the data shape in client/src/data/*.json.

export const DIFFICULTIES = ["Oson", "O'rta", "Qiyin"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const RESULTS = ["To'g'ri", "Noto'g'ri", "Qisman"] as const;
export type QuestionResult = (typeof RESULTS)[number];

export const ERROR_TYPES = ["Texnik", "Bilim bo'shlig'i"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

export const BLOOM_LEVELS = [
  "Eslab qolish",
  "Tushunish",
  "Qo'llash",
  "Tahlil",
  "Baholash",
  "Yaratish",
] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const REASONING_TYPES = ["Deduktiv", "Induktiv", "Analitik", "Fazoviy"] as const;
export type ReasoningType = (typeof REASONING_TYPES)[number];

export const SUBJECT_KEYS = ["MATH", "ENGLISH", "CRITICAL_THINKING"] as const;
export type SubjectKey = (typeof SUBJECT_KEYS)[number];

export interface Question {
  id: string;
  marks: number;
  difficulty: Difficulty;
  strand: string;
  topic: string;
  subTopic: string;
  skill: string;
  bloom: BloomLevel;
  reasoning: ReasoningType | null;
  gradeLevel: string;
  framework: string;
  result: QuestionResult;
  earned: number;
  errorType: ErrorType | null;
  evidence: string;
  // Optional admin-provided real-cohort solve rate for this question.
  // When absent or null, the report renders "—" instead of fabricated values.
  peerSolveRate?: number | null;
}

export interface SubjectMeta {
  school: string;
  slogan: string;
  office: string;
  candidate: string;
  grade: number;
  gradeLabel: string;
  subject: string;
  totalQuestions: number;
  totalMarks: number;
  brand: { navy: string; orange: string };
}

export interface RealData {
  percentile: number | null;
  cohortAverage: number | null;
  avgTimeSec: number | null;
}

export interface SubjectInput {
  meta: SubjectMeta;
  questions: Question[];
  realData?: RealData;
}

export interface GroupStat {
  name: string;
  n: number;
  correct: number;
  wrong: number;
  marks: number;
  earned: number;
  percent: number;
  lowConfidence: boolean;
  qualitative: string | null;
  ids: string[];
}

export interface TierStat {
  n: number;
  correct: number;
  wrong: number;
  pct: number;
  weight: number;
}

export interface Band {
  key?: string;
  label: string;
  en: string;
  color: string;
  level?: string;
  // Official Sodiq School "Yakuniy shkala" extras (from resource/image.png).
  tavsif?: string;        // e.g. "Murakkab masalalarni mustaqil yechadi"
  admission?: string;     // e.g. "Strong Admit"
  risk?: string;          // e.g. "Past" | "O'rtacha" | "Yuqori" | "Juda yuqori"
  riskColor?: string;
}

export interface ConfidenceInterval {
  low: number;
  high: number;
  margin: number;
}

export interface RiskItem {
  risk: string;
  probability: string;
  impact: string;
  level: { label: string; color: string };
  mitigation: string;
}

export interface ForecastPoint {
  label: string;
  v: number;
  color: string;
}

export interface ErrorRosterItem {
  id: string;
  topic: string;
  skill: string;
  marks: number;
  errorType: ErrorType | null;
  isTechnical: boolean;
  harderSolvedIds: string[];
  evidence: string;
}

export interface SubjectReport {
  meta: SubjectMeta;
  totalMarks: number;
  totalQuestions: number;
  questions: Question[];

  rawScore: number;
  percent: number;
  correctCount: number;
  partialCount: number;
  ci: ConfidenceInterval;
  band: Band;

  tiers: Record<Difficulty, TierStat>;
  hardTierPct: number;

  kdi: number;
  kdiExact: number;
  kdiParts: { wCorrect: number; wTotal: number };
  mastery: Band;

  technicalLost: number;
  gapLost: number;
  lostTotal: number;
  adjusted: number;
  potential: number;

  byStrand: GroupStat[];
  byTopic: GroupStat[];
  byBloom: GroupStat[];
  byReasoning: GroupStat[];
  byGradeLevel: GroupStat[];
  bySkill: GroupStat[];
  topics: (GroupStat & { avgWeight: number; analysisFrac: number })[];
  strandDetails: (GroupStat & {
    color: string;
    band: string;
    strongInner: GroupStat | null;
    weakInner: GroupStat | null;
  })[];
  weakestTopic: GroupStat | null;
  secondWeakestTopic: GroupStat | null;
  strongTopics: string[];

  gapZones: {
    below: (GroupStat & { avgWeight: number; analysisFrac: number })[];
    at: (GroupStat & { avgWeight: number; analysisFrac: number })[];
    above: (GroupStat & { avgWeight: number; analysisFrac: number })[];
  };
  overallRisk: { level: string; en: string; color: string };
  riskItems: RiskItem[];
  growthForecast: ForecastPoint[];

  errorRoster: ErrorRosterItem[];
  technicalErrors: ErrorRosterItem[];
  gapErrors: ErrorRosterItem[];

  percentile: number | null;
  cohortAverage: number | null;
  avgTimeSec: number | null;
}

export type AdmissionThresholds = {
  // map of grade (5..11) → { math, ct, en } subject minimum percent
  [grade: string]: { math: number; ct: number; en: number };
};

export interface CompositeReport {
  composite: number;
  compPotential: number;
  compAdjusted: number;
  compBand: Band;
  avgTechPct: number;
  topSubject: { key: SubjectKey; percent: number };
  lowSubject: { key: SubjectKey; percent: number };
  verdict: { label: string; sub: string; color: string };
  perSubjectGate: Record<SubjectKey, { percent: number; threshold: number; passed: boolean }>;
  gateAllPassed: boolean;
}
