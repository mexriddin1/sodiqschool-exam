// Roadmap v2 — dynamic, evidence-driven roadmap generator.
//
// The exam checks whether the student is at "point A" (full mastery, 100% on
// every indicator). The roadmap's job:
//   1. Pull EVERY weak indicator (<100%) from the diagnostic (weak-areas.ts)
//      and dedupe it across dimensions so one real gap is counted once.
//   2. Estimate how many of the 12 months are needed to drive all of those to
//      100% (dynamic — could be 1 month or 10). Bucket them into "gap" stages.
//   3. Spend the REMAINING months on a "next-level" (A→B) stage that takes the
//      student beyond their current grade. Those topics are authored by the AI
//      (Gemini) at result-creation time; the deterministic engine here only
//      lays down placeholders + a realistic weekly plan, so the plan renders
//      sensibly even before / without AI.
//
// Division of labour: this module is PURE and deterministic (shared by backend
// prompt-building AND client rendering). The AI-authored next-level topics are
// persisted separately (Result.aiRoadmap) and merged into the placeholders by
// the client (client/src/lib/programs.js).

import type { SubjectKey, SubjectReport } from "./types.js";
import { extractWeakAreas, WeakArea } from "./weak-areas.js";
import PREREQS_DATA from "./data/topic-prereqs.json" with { type: "json" };
import RESOURCES_DATA from "./data/resources.json" with { type: "json" };

// Loosely-typed access to the JSON data — we validate shape at read time.
type PrereqsFile = Record<string, unknown>;
type ResourcesFile = Record<string, unknown>;
const PREREQS = PREREQS_DATA as unknown as PrereqsFile;
const RESOURCES = RESOURCES_DATA as unknown as ResourcesFile;

const WEEKS_PER_MONTH = 4;
const TOTAL_MONTHS = 12;
const TOTAL_WEEKS = TOTAL_MONTHS * WEEKS_PER_MONTH; // 48

export interface Resource {
  type: "video" | "platform" | "book" | "channel" | "app";
  title: string;
  provider?: string;
  url?: string;
  note?: string;
}

export interface FocusItem {
  // Original weak-area entry from the diagnostic.
  weak: WeakArea;
  // "Real" topic name after alias resolution. Matches keys in the prereq /
  // resource JSON. Falls back to weak.name when nothing matches.
  canonicalTopic: string;
  // Prerequisite topics the student should ALSO check first. Empty when the
  // topic has no upstream dependencies (foundational topics).
  prerequisites: string[];
  // 1–3 sentences explaining WHY this is in the roadmap: severity, evidence,
  // and prereq motivation. Roadmap UI renders this directly.
  rationale: string;
  // Curated resources (UZ first, then EN) — capped at 4 total to keep the
  // block scannable.
  resources: Resource[];
}

export interface WeekTask {
  week: number;
  focusTopic: string;
  microTask: string;
  review: string;
  hours: number;
}

export interface Stage {
  num: number; // 1..N (dynamic)
  // "gap" = close a weakness toward 100% (reach point A);
  // "next" = A→B, next-level material once the grade is mastered.
  kind: "gap" | "next";
  months: number; // cumulative month at the END of this stage
  range: string; // "0–3 oy"
  title: string;
  mission: string;
  weeklyHours: string;
  focusItems: FocusItem[];
  weekPlan: WeekTask[];
  targetScore: { from: number; to: number };
}

export interface RoadmapV2 {
  overallGap: number;
  overallScore: number;
  targetScore: number;
  // Months spent closing gaps (reaching A) vs. months on next-level (A→B).
  weakMonths: number;
  nextMonths: number;
  // Dynamic length: 0..N gap stages + optionally 1 next-level stage.
  stages: Stage[];
  // Diagnostic surface — helps admin / debugging. UI usually hides these.
  notes: string[];
}

// AI-authored roadmap delta merged into the deterministic skeleton (persisted
// as Result.aiRoadmap). Optional input to buildRoadmapV2 — when absent, the
// engine renders deterministic placeholders instead.
export interface RoadmapAiInput {
  nextLevelTopics?: { topic: string; description: string; rationale: string; order: number }[];
  focusDescriptions?: { topic: string; description: string }[];
}

// Admin-managed resource catalog (persisted in DB, assembled by the backend and
// passed into the roadmap at render). Mirrors the bundled resources.json shape:
// subject → topic ("_default"/"_nextLevel" reserved) → { uz[], en[] }. When
// omitted, the engine falls back to the bundled JSON so compute stays pure.
export type ResourcesCatalog = Partial<
  Record<SubjectKey, Record<string, { uz?: Resource[]; en?: Resource[] }>>
>;

// Guardrail payload the backend feeds Gemini so the AI's next-level topics stay
// grounded in this student's real gaps and month budget. Single source of truth
// shared by backend prompt-building and (indirectly) client rendering.
export interface RoadmapAiContext {
  subject: SubjectKey;
  grade: number;
  weakTopics: { name: string; percent: number; severity: number }[];
  weakMonths: number;
  nextMonths: number;
  overflow: boolean;
  deferred: string[];
}

// ---------------------------------------------------------------- helpers

function resolveAliases(subject: SubjectKey, name: string): string {
  const subjMap = PREREQS[subject] as Record<string, { aliases?: string[] }> | undefined;
  if (!subjMap) return name;
  // Direct hit — the topic name matches a canonical key.
  if (subjMap[name]) return name;
  // Alias lookup — cheap linear scan; the maps have ≤ 40 entries each.
  for (const [canonical, meta] of Object.entries(subjMap)) {
    if (meta.aliases?.some((a) => a.toLowerCase() === name.toLowerCase())) {
      return canonical;
    }
  }
  return name;
}

function prereqsOf(subject: SubjectKey, canonicalTopic: string): string[] {
  const subjMap = PREREQS[subject] as Record<string, { prereqs?: string[] }> | undefined;
  const entry = subjMap?.[canonicalTopic];
  return entry?.prereqs ?? [];
}

// Resources for a topic: 2 UZ + 2 EN, topic → subject "_default" fallback.
// Uses the admin-managed `catalog` when provided (even if empty for this
// subject/topic), otherwise the bundled resources.json — keeping compute pure.
function resourcesFor(
  subject: SubjectKey,
  canonicalTopic: string,
  catalog?: ResourcesCatalog,
): Resource[] {
  const source = catalog ?? (RESOURCES as ResourcesCatalog);
  const subjMap = source[subject] as
    | Record<string, { uz?: Resource[]; en?: Resource[] }>
    | undefined;
  if (!subjMap) return [];
  const topicRes = subjMap[canonicalTopic];
  const fallback = subjMap._default;
  const uz = topicRes?.uz ?? fallback?.uz ?? [];
  const en = topicRes?.en ?? fallback?.en ?? [];
  return [...uz.slice(0, 2), ...en.slice(0, 2)];
}

function rationaleFor(
  weak: WeakArea,
  weakPrereqs: string[],
  weakEvidenceCount: number,
): string {
  const parts: string[] = [];
  parts.push(
    `Diagnostikada bu yo'nalish ${weak.percent}/100 — maqsad 100% (A tochka)`,
  );
  if (weakEvidenceCount > 0) {
    parts.push(
      `imtihonda ${weakEvidenceCount} ta savol shu bilan bog'liq holda o'tkazilgan`,
    );
  }
  if (weakPrereqs.length > 0) {
    parts.push(
      `bu mavzuni o'rganishdan avval quyidagi asos ko'nikmalarni mustahkamlash zarur: ${weakPrereqs.slice(0, 3).join(", ")}`,
    );
  }
  return parts.join("; ") + ".";
}

// Build one FocusItem from a weak area + subject context.
function buildFocusItem(subject: SubjectKey, w: WeakArea, catalog?: ResourcesCatalog): FocusItem {
  const canonical = resolveAliases(subject, w.name);
  const prerequisites = prereqsOf(subject, canonical);
  return {
    weak: w,
    canonicalTopic: canonical,
    prerequisites,
    rationale: rationaleFor(w, prerequisites, w.evidenceIds.length),
    resources: resourcesFor(subject, canonical, catalog),
  };
}

// A placeholder next-level focus item. The client overlays the AI-authored
// topic name / rationale (Result.aiRoadmap); until then this renders a generic
// but sensible "next grade" card with default resources.
function buildNextPlaceholder(subject: SubjectKey, index: number, catalog?: ResourcesCatalog): FocusItem {
  const name = `Keyingi daraja · mavzu ${index + 1}`;
  return {
    weak: {
      dimension: "topic",
      name,
      percent: 0,
      n: 0,
      correct: 0,
      wrong: 0,
      severity: 100,
      qualitative: null,
      lowConfidence: false,
      evidenceIds: [],
    },
    canonicalTopic: name,
    prerequisites: [],
    rationale:
      `Bola joriy sinf dasturini to'liq o'zlashtirgach, keyingi darajaga (B) tayyorlaydigan mavzu. Aniq mavzu tavsiyasi AI tomonidan qo'shiladi.`,
    resources: resourcesFor(subject, "_nextLevel", catalog),
  };
}

// Estimate how many weeks a topic realistically needs at ~5 h/week. severity is
// now the distance to 100% (100 - percent): a topic at 30% (severity 70) needs
// a deep multi-week rebuild; one at 90% (severity 10) is a light touch-up.
export function weeksForTopic(severity: number): number {
  if (severity >= 60) return 4; // percent ≤ 40 — deep rebuild
  if (severity >= 40) return 3; // percent 41..60
  if (severity >= 20) return 2; // percent 61..80
  return 1; // percent 81..99 — polish
}

// Concrete UZ micro-tasks per topic. Kept short so the roadmap UI stays
// scannable; the resource cards carry the full context.
function microTaskFor(topic: string, weekOfTopic: number, totalWeeks: number): { task: string; review: string } {
  const stage = totalWeeks > 1 ? ` (${weekOfTopic}/${totalWeeks})` : "";
  if (weekOfTopic === 1) {
    return {
      task: `${topic}${stage}: asosiy tushunchani o'rganish — 1 video + 15 ta boshlang'ich mashq`,
      review: `Xato-daftar: qaysi qadamda adashding? Qoidasi bilan yozib chiq.`,
    };
  }
  if (weekOfTopic === totalWeeks) {
    return {
      task: `${topic}${stage}: mustahkamlash — 20 ta aralash mashq + mini-test`,
      review: `Mini-test natijasi ≥85% bo'lsa mavzu yopiq; past bo'lsa xato-daftardan yana ${weekOfTopic - 1} ta misolni qayta ishla.`,
    };
  }
  return {
    task: `${topic}${stage}: chuqurlashtirish — real masalalar + 2 ta ko'p bosqichli topshiriq`,
    review: `"Nima so'raldi?"→ "reja"→ "yechim"→ "tekshirish" 4-bosqich odati.`,
  };
}

// Severity-driven weekly plan for gap stages: each topic gets weeksForTopic()
// contiguous weeks, highest-severity first.
function planWeeksForStage(
  focusItems: FocusItem[],
  totalWeeks: number,
): WeekTask[] {
  if (focusItems.length === 0) return [];
  const plan: WeekTask[] = [];
  let week = 1;
  for (const item of focusItems) {
    const weeks = weeksForTopic(item.weak.severity);
    for (let i = 1; i <= weeks && week <= totalWeeks; i++) {
      const { task, review } = microTaskFor(item.canonicalTopic, i, weeks);
      plan.push({
        week,
        focusTopic: item.canonicalTopic,
        microTask: task,
        review,
        hours: 5,
      });
      week++;
    }
    if (week > totalWeeks) break;
  }
  // If we ran out of focus items before filling the horizon, top up with
  // "review + mini-diagnostika" weeks so the plan doesn't feel padded.
  while (week <= totalWeeks) {
    plan.push({
      week,
      focusTopic: "Umumiy takror",
      microTask: `Oldingi mavzular aralash mashq (${Math.min(3, focusItems.length)} ta fokusdan)`,
      review: `Haftalik mini-test; xato-daftarga qaytish.`,
      hours: 4,
    });
    week++;
  }
  return plan;
}

// Even weekly plan for the next-level stage: distribute totalWeeks across the
// B-topics as evenly as possible (we have no severity to weight them by).
function planEvenWeeks(topics: string[], totalWeeks: number): WeekTask[] {
  if (topics.length === 0 || totalWeeks <= 0) return [];
  const per = Math.max(1, Math.floor(totalWeeks / topics.length));
  const plan: WeekTask[] = [];
  let week = 1;
  topics.forEach((t, ti) => {
    // The last topic soaks up any remainder so the plan fills the whole span.
    const wk = ti === topics.length - 1 ? totalWeeks - (week - 1) : per;
    for (let i = 1; i <= wk && week <= totalWeeks; i++) {
      const { task, review } = microTaskFor(t, i, Math.max(1, wk));
      plan.push({ week, focusTopic: t, microTask: task, review, hours: 4 });
      week++;
    }
  });
  return plan;
}

// Split gap focus items into stages, each spanning ~weeksPerStage weeks
// (≈ a 3–4 month horizon), preserving the severity-desc order.
function chunkByWeeks(focus: FocusItem[], weeksPerStage: number): FocusItem[][] {
  const chunks: FocusItem[][] = [];
  let cur: FocusItem[] = [];
  let w = 0;
  for (const f of focus) {
    const fw = weeksForTopic(f.weak.severity);
    if (cur.length > 0 && w + fw > weeksPerStage) {
      chunks.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(f);
    w += fw;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// ---------------------------------------------------------------- allocation

// Collapse weak areas that resolve to the same canonical topic across
// dimensions (topic/strand/skill/bloom/reasoning/gradeLevel), keeping the
// max severity and merging evidence. Without this the month budget would
// double-count one real weakness.
export function dedupeWeakAreas(subject: SubjectKey, areas: WeakArea[]): WeakArea[] {
  const byCanon = new Map<string, WeakArea>();
  for (const w of areas) {
    const canon = resolveAliases(subject, w.name);
    const existing = byCanon.get(canon);
    if (!existing) {
      byCanon.set(canon, { ...w, name: canon });
    } else {
      const mergedEvidence = [...new Set([...existing.evidenceIds, ...w.evidenceIds])].slice(0, 5);
      if (w.severity > existing.severity) {
        byCanon.set(canon, { ...w, name: canon, evidenceIds: mergedEvidence });
      } else {
        existing.evidenceIds = mergedEvidence;
      }
    }
  }
  return [...byCanon.values()].sort((a, b) => b.severity - a.severity);
}

export interface RoadmapAllocation {
  weak: WeakArea[]; // deduped, severity desc, fits within 12 months
  deferred: WeakArea[]; // couldn't fit in 12 months (overflow)
  weakMonths: number;
  nextMonths: number;
  overflow: boolean;
}

// How many of the 12 months go to closing gaps vs. next-level work.
export function allocateMonths(subject: SubjectKey, r: SubjectReport): RoadmapAllocation {
  const all = dedupeWeakAreas(subject, extractWeakAreas(r));
  let weeks = 0;
  const fit: WeakArea[] = [];
  const deferred: WeakArea[] = [];
  for (const w of all) {
    const wk = weeksForTopic(w.severity);
    if (weeks + wk <= TOTAL_WEEKS) {
      fit.push(w);
      weeks += wk;
    } else {
      deferred.push(w);
    }
  }
  const weakMonths = Math.min(TOTAL_MONTHS, Math.ceil(weeks / WEEKS_PER_MONTH));
  const nextMonths = Math.max(0, TOTAL_MONTHS - weakMonths);
  return { weak: fit, deferred, weakMonths, nextMonths, overflow: deferred.length > 0 };
}

// Guardrail context for the Gemini next-level prompt.
export function buildRoadmapAiContext(subject: SubjectKey, r: SubjectReport): RoadmapAiContext {
  const alloc = allocateMonths(subject, r);
  return {
    subject,
    grade: r.meta.grade,
    weakTopics: alloc.weak.map((w) => ({ name: w.name, percent: w.percent, severity: w.severity })),
    weakMonths: alloc.weakMonths,
    nextMonths: alloc.nextMonths,
    overflow: alloc.overflow,
    deferred: alloc.deferred.map((w) => w.name),
  };
}

// ---------------------------------------------------------------- main

export function buildRoadmapV2(
  subject: SubjectKey,
  r: SubjectReport,
  ai?: RoadmapAiInput,
  catalog?: ResourcesCatalog,
): RoadmapV2 {
  const alloc = allocateMonths(subject, r);
  const gf = r.growthForecast.map((g) => g.v);
  const m0 = gf[0] ?? r.percent;
  const m12 = gf[3] ?? Math.min(100, r.percent + 24);
  const scoreAtMonth = (mo: number) => Math.round(m0 + (m12 - m0) * Math.min(1, mo / TOTAL_MONTHS));

  const gapFocus = alloc.weak.map((w) => buildFocusItem(subject, w, catalog));
  // Overlay AI-polished wording onto matching weak topics (never adds topics).
  const focusDesc = new Map(
    (ai?.focusDescriptions ?? []).map((d) => [d.topic.toLowerCase().trim(), d.description]),
  );
  for (const f of gapFocus) {
    const d = focusDesc.get(f.canonicalTopic.toLowerCase().trim());
    if (d) f.rationale = d;
  }
  const stages: Stage[] = [];
  let cursorMonth = 0;
  let stageNum = 0;

  // ---- Gap stages: drive every weak indicator to 100% (reach point A) ----
  const gapChunks = chunkByWeeks(gapFocus, 16);
  for (const chunk of gapChunks) {
    const stageWeeks = chunk.reduce((s, f) => s + weeksForTopic(f.weak.severity), 0);
    const stageMonths = Math.max(1, Math.round(stageWeeks / WEEKS_PER_MONTH));
    const startMo = cursorMonth;
    const endMo = Math.min(TOTAL_MONTHS, startMo + stageMonths);
    stageNum++;
    const titleTopics = chunk.map((f) => f.canonicalTopic).slice(0, 2).join(", ");
    stages.push({
      num: stageNum,
      kind: "gap",
      months: endMo,
      range: `${startMo}–${endMo} oy`,
      title: `${stageNum}-bosqich · bo'shliqni yopish: ${titleTopics}`,
      mission: `${chunk.map((f) => f.canonicalTopic).join(", ")} bo'yicha bo'shliqni to'liq yopib, har bir ko'rsatkichni 100% ga (A tochka) olib chiqamiz.`,
      weeklyHours: "4–5 soat",
      focusItems: chunk,
      weekPlan: planWeeksForStage(chunk, stageWeeks),
      targetScore: { from: scoreAtMonth(startMo), to: scoreAtMonth(endMo) },
    });
    cursorMonth = endMo;
  }

  // ---- Next-level stage (A → B) with the remaining months ----
  const nextMonthsActual = TOTAL_MONTHS - cursorMonth;
  if (nextMonthsActual > 0) {
    const startMo = cursorMonth;
    const endMo = TOTAL_MONTHS;
    const spanWeeks = nextMonthsActual * WEEKS_PER_MONTH;
    // Prefer AI-authored B-topics; otherwise deterministic placeholders.
    const aiTopics = (ai?.nextLevelTopics ?? []).slice().sort((a, b) => a.order - b.order);
    let nextFocus: FocusItem[];
    if (aiTopics.length > 0) {
      const baseRes = resourcesFor(subject, "_nextLevel", catalog);
      nextFocus = aiTopics.map((t) => ({
        weak: {
          dimension: "topic" as const,
          name: t.topic,
          percent: 0,
          n: 0,
          correct: 0,
          wrong: 0,
          severity: 100,
          qualitative: null,
          lowConfidence: false,
          evidenceIds: [],
        },
        canonicalTopic: t.topic,
        prerequisites: [],
        rationale: t.rationale || t.description || "",
        resources: baseRes,
      }));
    } else {
      const k = Math.min(6, Math.max(1, nextMonthsActual));
      nextFocus = Array.from({ length: k }, (_, i) => buildNextPlaceholder(subject, i, catalog));
    }
    stageNum++;
    stages.push({
      num: stageNum,
      kind: "next",
      months: endMo,
      range: `${startMo}–${endMo} oy`,
      title: `${stageNum}-bosqich · keyingi daraja (A→B)`,
      mission: `Bola joriy darajani (A) mustahkam egallagach, qolgan ${nextMonthsActual} oyni keyingi bosqich mavzulariga sarflaydi — A dan B ga o'sadi.`,
      weeklyHours: "3–4 soat",
      focusItems: nextFocus,
      weekPlan: planEvenWeeks(nextFocus.map((f) => f.canonicalTopic), spanWeeks),
      targetScore: { from: scoreAtMonth(startMo), to: scoreAtMonth(endMo) },
    });
  }

  const notes: string[] = [];
  if (gapFocus.length === 0) {
    notes.push(
      "Diagnostikada 100% dan past ko'rsatkich topilmadi — butun 12 oylik reja keyingi darajaga (A→B) yo'naltirildi.",
    );
  } else {
    notes.push(
      `Zaif ko'rsatkichlarni 100% ga yetkazish uchun ~${cursorMonth} oy, qolgan ${nextMonthsActual} oy keyingi darajaga (A→B) rejalashtirildi.`,
    );
  }
  if (alloc.overflow) {
    notes.push(
      `12 oyga sig'magan ko'rsatkichlar keyingi rejaga qoldirildi: ${alloc.deferred.map((w) => w.name).join(", ")}.`,
    );
  }
  if (gapFocus.some((f) => f.prerequisites.length > 0)) {
    notes.push("Ba'zi mavzular uchun prerequisite mavzular ham topildi — reja ularni birinchi navbatga qo'ydi.");
  }

  return {
    overallScore: r.percent,
    targetScore: m12,
    overallGap: Math.max(0, 100 - r.percent),
    weakMonths: cursorMonth,
    nextMonths: nextMonthsActual,
    stages,
    notes,
  };
}
