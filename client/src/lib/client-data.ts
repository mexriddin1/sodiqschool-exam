// Shapes the live API response back into the per-subject JSON shape the
// existing report pages already consume, and resolves every admin-editable
// override (cohort, narrative phrases, placeholder %s) with documented
// fallbacks so the page works for any band of student.

import type { PublicResultPayload } from "./session";

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";

const SUBJECT_NAMES: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

export interface SubjectData {
  meta: {
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
  };
  questions: unknown[];
  realData: {
    percentile: number | null;
    cohortAverage: number | null;
    avgTimeSec: number | null;
  };
}

const ALL_SUBJECTS: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];

/**
 * Hisobot chizilishi uchun uchala fan ham bo'lishi SHART — composite ball,
 * reyting va xulosa uchalasidan hisoblanadi.
 *
 * Chala natija haqiqatda uchraydi: funnel'da har fan alohida topshiriladi,
 * ya'ni faqat matematikani ishlagan bola natijasida bitta fan bo'ladi.
 * Usiz `pickSubject` "Subject ENGLISH missing" deb otardi va o'quvchi
 * 500-xato sahifasini ko'rardi.
 */
export function isReportReady(me: PublicResultPayload): boolean {
  return ALL_SUBJECTS.every((k) => me.subjects.some((s) => s.subject === k));
}

/** Yetishmayotgan fanlar — "tayyor emas" sahifasi shuni ko'rsatadi. */
export function missingSubjects(me: PublicResultPayload): string[] {
  return ALL_SUBJECTS.filter((k) => !me.subjects.some((s) => s.subject === k)).map((k) => SUBJECT_NAMES[k]);
}

export function pickSubject(me: PublicResultPayload, key: SubjectKey): SubjectData {
  const subj = me.subjects.find((s) => s.subject === key);
  if (!subj) throw new Error(`Subject ${key} missing on this result`);
  const grade = me.student.grade;
  return {
    meta: {
      school: "Sodiq School",
      slogan: "Biz ilmga sodiqmiz",
      office: "Academic Assessment Office",
      candidate: me.student.fullName,
      grade,
      gradeLabel: `${grade}-sinfga nomzod`,
      subject: SUBJECT_NAMES[key],
      totalQuestions: subj.totalQuestions,
      totalMarks: subj.totalMarks,
      brand: { navy: "#06113C", orange: "#FF8A32" },
    },
    questions: subj.questions,
    realData: subj.realData ?? { percentile: null, cohortAverage: null, avgTimeSec: null },
  };
}

// ---------- defaults for per-subject placeholder values --------------------
// These are display fallbacks for groups the per-question label set doesn't
// measure (e.g. Bloom levels the test doesn't reach). They are NOT
// per-student opinions — they ship as defaults and admin can override per
// result via Result.manualContent.

export const BLOOM_FALLBACK_MATH = [
  { key: "Eslab qolish", gloss: "yodda saqlash", ph: 90 },
  { key: "Tushunish", gloss: "ma'noni anglash", ph: 75 },
  { key: "Qo'llash", gloss: "qoidani qo'llash", ph: 79 },
  { key: "Tahlil", gloss: "qismlarga ajratish", ph: 86 },
  { key: "Baholash", gloss: "baho va xulosa", ph: 70 },
  { key: "Yaratish", gloss: "yangi yechim tuzish", ph: 62 },
] as const;

export const BLOOM_FALLBACK_ENGLISH = [
  { key: "Eslab qolish", gloss: "so'z va qoidalarni yodda saqlash", ph: 92 },
  { key: "Tushunish", gloss: "ma'noni anglash", ph: 85 },
  { key: "Qo'llash", gloss: "qoidani gapda qo'llash", ph: 85 },
  { key: "Tahlil", gloss: "matnni tahlil qilish, xulosa", ph: 50 },
  { key: "Baholash", gloss: "fakt/fikr, baho berish", ph: 60 },
  { key: "Yaratish", gloss: "yozma javob tuzish", ph: 55 },
] as const;

export const BLOOM_FALLBACK_CT = [
  { key: "Eslab qolish", gloss: "faktlarni yodda saqlash", ph: 88 },
  { key: "Tushunish", gloss: "ma'noni anglash", ph: 82 },
  { key: "Qo'llash", gloss: "qoidani yangi vaziyatda qo'llash", ph: 70 },
  { key: "Tahlil", gloss: "qismlarga ajratib tahlil qilish", ph: 80 },
  { key: "Baholash", gloss: "mulohaza bilan baho berish", ph: 80 },
  { key: "Yaratish", gloss: "yangi yechim ishlab chiqish", ph: 60 },
] as const;

export const SKILL_RADAR_FALLBACK_MATH = [
  { name: "Protsedural ravonlik", value: 82 },
  { name: "Konseptual tushunish", value: 75 },
  { name: "Muammo yechish", value: 80 },
  { name: "Mantiqiy xulosa", value: 88 },
  { name: "Fazoviy fikrlash", value: 72 },
  { name: "Modellashtirish", value: 78 },
  { name: "Hisoblash aniqligi", value: 70 },
];

export const SKILL_RADAR_FALLBACK_ENGLISH = [
  { name: "Grammatik aniqlik", value: 88 },
  { name: "Lug'at boyligi", value: 90 },
  { name: "O'qib tushunish", value: 82 },
  { name: "Xulosa chiqarish", value: 45 },
  { name: "Tanqidiy fikrlash", value: 55 },
  { name: "Funksional til", value: 80 },
  { name: "Yozuv", value: 50 },
];

export const SKILL_RADAR_FALLBACK_CT = [
  { name: "Qonuniyatni aniqlash", value: 85 },
  { name: "Mantiqiy xulosa", value: 88 },
  { name: "Fazoviy fikrlash", value: 42 },
  { name: "Ma'lumot talqini", value: 75 },
  { name: "Tanqidiy baholash", value: 82 },
  { name: "Strategik fikrlash", value: 80 },
  { name: "Abstrakt mulohaza", value: 78 },
  { name: "Tizimli sanash", value: 60 },
];

export const REASONING_FALLBACK_MATH = [
  { name: "Deduktiv", gloss: "qoidadan natijaga", value: 85 },
  { name: "Induktiv", gloss: "misollardan qoidaga", value: 72 },
  { name: "Analitik", gloss: "qismlarga ajratib tahlil", value: 88 },
  { name: "Fazoviy", gloss: "shakl va fazoning tasavvuri", value: 76 },
];

// ---------- override resolution ---------------------------------------------

type BloomFallbackKey = "Eslab qolish" | "Tushunish" | "Qo'llash" | "Tahlil" | "Baholash" | "Yaratish";

export interface CohortOverride {
  rank: number | null;
  total: number | null;
  percentile: number | null;
  maleRank: number | null;
  maleTotal: number | null;
}

export interface GlossaryEntry { t: string; d: string }
export interface SubjectGlossary {
  skillHelp: GlossaryEntry[] | null;
  bloomHelp: GlossaryEntry[] | null;
  reasonHelp: GlossaryEntry[] | null;
}

export interface SubjectNarrative {
  coverTitle: string | null;
  coverSubtitle: string | null;
  story: string[] | null;
}

export interface SubjectOverrides {
  strength: string | null;
  growthLabel: string | null;
  skillRadar: { name: string; value: number }[] | null;
  reasoningTypes: { name: string; gloss?: string; value: number }[] | null;
  bloomFallback: Record<string, number> | null;
  gradeLevelFallback: Record<string, number> | null;
  cohort: CohortOverride;
  glossary: SubjectGlossary;
  narrative: SubjectNarrative;
}

export type VerdictLabel = "STRONG ADMIT" | "ADMIT" | "CONDITIONAL ADMIT" | "WAITLIST" | "NOT YET READY";

export interface VerdictOverride {
  label: VerdictLabel;
  sub: string | null;
}

export interface SummaryOverrides {
  overallRank: number | null;
  overallTotal: number | null;
  overallPct: number | null;
  // Sex-split cohort standing (auto-computed from snapshot when peers are
  // published). Null when the student's sex is unknown or when no same-sex
  // peer has published yet.
  sexRank: number | null;
  sexTotal: number | null;
  sexPercentile: number | null;
  crossStrength: string | null;
  gradeLabel: string | null; // overrides per-summary "5-sinfga nomzod · 3 fan · ~10 yosh"
  verdictOverride: VerdictOverride | null;
}

const VERDICT_COLORS: Record<VerdictLabel, string> = {
  "STRONG ADMIT": "#2F9E6B",
  "ADMIT": "#2F9E6B",
  "CONDITIONAL ADMIT": "#C98A12",
  "WAITLIST": "#FF8A32",
  "NOT YET READY": "#D2503F",
};

const VERDICT_SUBS: Record<VerdictLabel, string> = {
  "STRONG ADMIT": "Yuqori daraja — maktabga qabul tavsiya etiladi",
  "ADMIT": "Ishonchli daraja — qabul tavsiya etiladi",
  "CONDITIONAL ADMIT": "Rivojlanayotgan daraja — shartli qabul",
  "WAITLIST": "Shakllanayotgan daraja — navbatda",
  "NOT YET READY": "Tamal bosqich — avval tayyorgarlik kerak",
};

// Resolve the final verdict for a page: admin override wins over the auto
// computed one. `auto` is the { label, sub, color } from the compute engine.
export function resolveVerdict(
  auto: { label: string; sub: string; color: string },
  override: VerdictOverride | null | undefined,
): { label: string; sub: string; color: string; isOverride: boolean } {
  if (override) {
    return {
      label: override.label,
      sub: override.sub ?? VERDICT_SUBS[override.label],
      color: VERDICT_COLORS[override.label],
      isOverride: true,
    };
  }
  return { ...auto, isOverride: false };
}

export interface Overrides {
  studentSex: "male" | "female" | null;
  math: SubjectOverrides;
  english: SubjectOverrides;
  criticalThinking: SubjectOverrides;
  summary: SummaryOverrides;
}

function readSubjectOverride(mc: Record<string, unknown>, key: string): Partial<SubjectOverrides> {
  const node = (mc?.[key] ?? {}) as Record<string, unknown>;
  const glossary = (node.glossary ?? {}) as Record<string, GlossaryEntry[] | undefined>;
  const narrative = (node.narrative ?? {}) as Record<string, unknown>;
  return {
    strength: (node.strength as string) ?? null,
    growthLabel: (node.growthLabel as string) ?? null,
    skillRadar: (node.skillRadar as { name: string; value: number }[]) ?? null,
    reasoningTypes: (node.reasoningTypes as { name: string; gloss?: string; value: number }[]) ?? null,
    bloomFallback: (node.bloomFallback as Record<string, number>) ?? null,
    gradeLevelFallback: (node.gradeLevelFallback as Record<string, number>) ?? null,
    cohort: (node.cohort as CohortOverride) ?? {
      rank: null,
      total: null,
      percentile: null,
      maleRank: null,
      maleTotal: null,
    },
    glossary: {
      skillHelp: glossary.skillHelp ?? null,
      bloomHelp: glossary.bloomHelp ?? null,
      reasonHelp: glossary.reasonHelp ?? null,
    },
    narrative: {
      coverTitle: (narrative.coverTitle as string) ?? null,
      coverSubtitle: (narrative.coverSubtitle as string) ?? null,
      story: (narrative.story as string[]) ?? null,
    },
  };
}

export function resolveOverrides(me: PublicResultPayload): Overrides {
  const mc = (me.manualContent ?? {}) as Record<string, unknown>;
  const blank: SubjectOverrides = {
    strength: null,
    growthLabel: null,
    skillRadar: null,
    reasoningTypes: null,
    bloomFallback: null,
    gradeLevelFallback: null,
    cohort: { rank: null, total: null, percentile: null, maleRank: null, maleTotal: null },
    glossary: { skillHelp: null, bloomHelp: null, reasonHelp: null },
    narrative: { coverTitle: null, coverSubtitle: null, story: null },
  };
  const merge = (key: string): SubjectOverrides => ({
    ...blank,
    ...readSubjectOverride(mc, key),
  });
  const summaryNode = (mc.summary ?? {}) as Record<string, unknown>;

  // Snapshot-derived cohort standing — computed by backend recomputeCohortRanks
  // when peer results are published. Falls back cleanly to null when the exam
  // has no peers yet.
  const snap = (me.calculatedSnapshot ?? {}) as Record<string, unknown>;
  const cohortSnap = (snap.cohort ?? {}) as {
    rank?: number | null;
    total?: number | null;
    percentile?: number | null;
    male?: { rank: number; total: number; percentile: number } | null;
    female?: { rank: number; total: number; percentile: number } | null;
  };
  const sexBlock =
    me.student.sex === "MALE" ? cohortSnap.male
    : me.student.sex === "FEMALE" ? cohortSnap.female
    : null;

  // Prefer snapshot (auto-computed) over the manualContent overrides. Admin
  // can still pin values via manualContent for edge cases (e.g. a hand-
  // reported paper cohort that never gets published to the app).
  const overallRank = (summaryNode.overallRank as number | undefined) ?? cohortSnap.rank ?? null;
  const overallTotal = (summaryNode.overallTotal as number | undefined) ?? cohortSnap.total ?? null;
  const overallPct = (summaryNode.overallPct as number | undefined) ?? cohortSnap.percentile ?? null;

  return {
    studentSex: me.student.sex === "MALE" ? "male" : me.student.sex === "FEMALE" ? "female" : null,
    math: merge("math"),
    english: merge("english"),
    criticalThinking: merge("criticalThinking"),
    summary: {
      overallRank,
      overallTotal,
      overallPct,
      // Sex-split standing, e.g. "12/128 yigitlar orasida". Comes from snapshot.
      sexRank: sexBlock ? sexBlock.rank : null,
      sexTotal: sexBlock ? sexBlock.total : null,
      sexPercentile: sexBlock ? sexBlock.percentile : null,
      crossStrength: (summaryNode.crossStrength as string) ?? null,
      gradeLabel: (summaryNode.gradeLabel as string) ?? null,
      verdictOverride: (summaryNode.verdictOverride as VerdictOverride) ?? null,
    },
  };
}

// Helper: take a fallback array + admin override map, return the final array.
export function applyBloomFallback(
  bloomFallback: Record<string, number> | null,
  defaultArr: readonly { key: string; gloss: string; ph: number }[],
): { key: string; gloss: string; ph: number }[] {
  return defaultArr.map((b) => ({
    key: b.key,
    gloss: b.gloss,
    ph: bloomFallback?.[b.key] ?? b.ph,
  }));
}

// Helper: get a grade-level fallback %.
export function gradeLevelFallback(
  gradeLevelFallback: Record<string, number> | null,
  level: string,
  defaultPct: number,
): number {
  return gradeLevelFallback?.[level] ?? defaultPct;
}
