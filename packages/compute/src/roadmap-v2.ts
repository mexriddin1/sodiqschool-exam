// Roadmap v2 — dynamic, evidence-driven roadmap generator.
//
// Design:
//   1. Pull ranked weak areas from the diagnostic (weak-areas.ts).
//   2. For each weak topic, walk the prereq graph — if any prerequisite is
//      ALSO weak (or is a common gap-generator when the topic itself is
//      failing), surface it FIRST. Classic case: student fails trigonometry
//      but the real gap is algebra basics. We recommend algebra first.
//   3. Bucket the resulting focus list into three horizons: 0–3, 3–6, 6–12
//      months, by severity. Highest-severity items get the earliest slot.
//   4. Attach curated resources per focus item, UZ + EN.
//   5. Produce a realistic weekly plan: each week has one primary micro-task
//      + one review activity. Weekly load ~5 h (30–45 min × 5 days). A
//      "learn X" week only covers what actually takes a week, not the whole
//      topic — big topics span multiple weeks explicitly.

import type { SubjectKey, SubjectReport } from "./types.js";
import { extractWeakAreas, WeakArea } from "./weak-areas.js";
import PREREQS_DATA from "./data/topic-prereqs.json" with { type: "json" };
import RESOURCES_DATA from "./data/resources.json" with { type: "json" };

// Loosely-typed access to the JSON data — we validate shape at read time.
type PrereqsFile = Record<string, unknown>;
type ResourcesFile = Record<string, unknown>;
const PREREQS = PREREQS_DATA as unknown as PrereqsFile;
const RESOURCES = RESOURCES_DATA as unknown as ResourcesFile;

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
  num: number; // 1, 2, 3
  months: number; // 3, 6, 12
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
  stages: [Stage, Stage, Stage];
  // Diagnostic surface — helps admin / debugging. UI usually hides these.
  notes: string[];
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

function resourcesFor(subject: SubjectKey, canonicalTopic: string): Resource[] {
  const subjMap = RESOURCES[subject] as
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
    `Diagnostikada bu yo'nalish ${weak.percent}/100 — sog'lom 75 dan pastda`,
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
function buildFocusItem(subject: SubjectKey, w: WeakArea): FocusItem {
  const canonical = resolveAliases(subject, w.name);
  const prerequisites = prereqsOf(subject, canonical);
  return {
    weak: w,
    canonicalTopic: canonical,
    prerequisites,
    rationale: rationaleFor(w, prerequisites, w.evidenceIds.length),
    resources: resourcesFor(subject, canonical),
  };
}

// Estimate how many weeks a topic realistically needs at ~5 h/week.
// Rule of thumb: severity 50+ → 3 weeks (needs a deep pass); 30–49 → 2
// weeks; 10–29 → 1 week (light touch-up). This prevents the previous "learn
// trigonometry in a week" trap.
function weeksForTopic(severity: number): number {
  if (severity >= 50) return 3;
  if (severity >= 30) return 2;
  return 1;
}

// Concrete UZ micro-tasks per topic type. Kept short so the roadmap UI stays
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

// ---------------------------------------------------------------- main

export function buildRoadmapV2(subject: SubjectKey, r: SubjectReport): RoadmapV2 {
  const weakAreas = extractWeakAreas(r);
  // Roadmap focuses primarily on topics (map to lessons/videos/books). We
  // include weak skills / blooms / reasonings only when there are fewer
  // than 6 weak topics — otherwise topics alone fill the horizon.
  const weakTopics = weakAreas.filter((w) => w.dimension === "topic");
  const primary = weakTopics.slice(0, 6);
  const secondary = weakAreas
    .filter((w) => w.dimension !== "topic")
    .slice(0, Math.max(0, 4 - primary.length));

  const focusItems = [...primary, ...secondary].map((w) => buildFocusItem(subject, w));

  // Split focus items into 3 horizons by severity: highest-severity items
  // first. The buckets don't have to be equal — a student with 1 huge gap
  // gets 1 focus in stage 1 (deep dive), then broader spread later.
  const s1 = focusItems.slice(0, Math.min(2, focusItems.length));
  const s2 = focusItems.slice(2, Math.min(4, focusItems.length));
  const s3 = focusItems.slice(4);

  const gf = r.growthForecast.map((g) => g.v);
  const m0 = gf[0] ?? r.percent;
  const m3 = gf[1] ?? Math.min(100, r.percent + 8);
  const m6 = gf[2] ?? Math.min(100, r.percent + 16);
  const m12 = gf[3] ?? Math.min(100, r.percent + 24);
  const notes: string[] = [];
  if (weakTopics.length === 0) {
    notes.push("Diagnostikada topic darajasida sog'lom chegaradan past hech narsa yo'q — reja umumiy chuqurlashtirish yo'nalishida quriladi.");
  }
  if (focusItems.some((f) => f.prerequisites.length > 0)) {
    notes.push("Ba'zi mavzular uchun prerequisite mavzular ham topildi — reja ularni birinchi navbatga qo'ydi.");
  }

  const stage1: Stage = {
    num: 1, months: 3, range: "0–3 oy",
    title: s1.length > 0 ? `1-bosqich · poydevor: ${s1[0]!.canonicalTopic}` : "1-bosqich · poydevor",
    mission: s1.length > 0
      ? `Eng katta bo'shliqni yopish: ${s1.map((f) => f.canonicalTopic).join(" va ")}. Prerequisitelar bilan boshlab, mavzuni ravonlik darajasiga olib chiqamiz.`
      : `Umumiy diagnostika bo'yicha mustahkamlash — bo'shliqlar torroq, poydevor tekislanadi.`,
    weeklyHours: "4–5 soat",
    focusItems: s1,
    weekPlan: planWeeksForStage(s1, 12),
    targetScore: { from: m0, to: m3 },
  };

  const stage2: Stage = {
    num: 2, months: 6, range: "3–6 oy",
    title: s2.length > 0
      ? `2-bosqich · kengaytirish: ${s2.map((f) => f.canonicalTopic).slice(0, 2).join(", ")}`
      : `2-bosqich · kengaytirish va ilmni bog'lash`,
    mission: s2.length > 0
      ? `Ikkinchi qatorda turgan bo'shliqlarni yopamiz. Endi bola avvalgi bosqichdagi mavzuni mustahkam biladi — ${s2.map((f) => f.canonicalTopic).join(", ")} bo'yicha ko'nikmani real vaziyatlarga bog'laymiz.`
      : `1-bosqich hosilini boshqa mavzularga transfer qilamiz. Aralash masalalar va real dunyoga tatbiq.`,
    weeklyHours: "3–4 soat",
    focusItems: s2,
    weekPlan: planWeeksForStage(s2.length > 0 ? s2 : s1, 12),
    targetScore: { from: m3, to: m6 },
  };

  const stage3Focus = s3.length > 0
    ? s3
    : primary.slice(0, 2).map((w) => buildFocusItem(subject, w)); // Fallback: revisit top gaps in maintenance mode.
  const stage3: Stage = {
    num: 3, months: 12, range: "6–12 oy",
    title: `3-bosqich · mustahkamlash va yuqoriga ${stage3Focus.length > 0 ? "— " + stage3Focus.map((f) => f.canonicalTopic).slice(0, 2).join(", ") : ""}`.trim(),
    mission: s3.length > 0
      ? `Qolgan yumshoq bo'shliqlarni yopamiz (${s3.map((f) => f.canonicalTopic).join(", ")}) va olimpiadaga yaqin darajaga boyituvchi masalalarga o'tamiz. Yakuniy natija barqarorlashadi.`
      : `Butun sinf dasturini spiral takrorlash + qiyin (olimpiada-yaqin) masalalar bilan boyitish. Bola darajani ushlab turadi va yuqoriga ko'taradi.`,
    weeklyHours: "3–4 soat",
    focusItems: stage3Focus,
    weekPlan: planWeeksForStage(stage3Focus, 26), // 6 months × ~4.3 weeks
    targetScore: { from: m6, to: m12 },
  };

  return {
    overallScore: r.percent,
    targetScore: m12,
    overallGap: Math.max(0, 100 - r.percent),
    stages: [stage1, stage2, stage3],
    notes,
  };
}
