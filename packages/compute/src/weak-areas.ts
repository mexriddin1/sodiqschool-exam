// Weak-area extractor. Takes a SubjectReport and pulls out every diagnostic
// dimension where the student underperformed — topic, skill, bloom, reasoning,
// grade-level, strand — ranked by severity. The roadmap builder uses this
// output as its input: "what does the student actually need to work on?"
//
// Design goals:
//   • One unified structure across all dimensions so the roadmap doesn't
//     need to special-case each type of weakness.
//   • Only include groups with n ≥ 2 questions — a single wrong answer
//     doesn't prove a systematic gap.
//   • Evidence-first: every entry carries the question IDs behind it so
//     the parent (and the roadmap) can point at concrete misses.

import type { GroupStat, SubjectReport } from "./types.js";

export type WeakDimension =
  | "topic"
  | "subTopic"
  | "strand"
  | "skill"
  | "bloom"
  | "reasoning"
  | "gradeLevel";

export interface WeakArea {
  dimension: WeakDimension;
  name: string;
  percent: number;
  n: number;
  correct: number;
  wrong: number;
  // 0..100 — how far below the "healthy" 75% target this area is.
  severity: number;
  qualitative: string | null;
  lowConfidence: boolean;
  // Concrete question IDs from the exam that failed in this area. Roadmap
  // uses these to say "you missed Q3, Q7 and Q11 on this topic".
  evidenceIds: string[];
}

// Groups performing at or above this level are treated as "solid" and skipped.
// 75% keeps the list focused on real gaps; 60 would flood the roadmap with
// marginal areas that don't actually need dedicated time.
const HEALTHY_THRESHOLD = 75;

function toWeak(
  dimension: WeakDimension,
  group: GroupStat,
): WeakArea | null {
  if (group.n < 2) return null;
  if (group.percent >= HEALTHY_THRESHOLD) return null;
  const gap = Math.max(0, HEALTHY_THRESHOLD - group.percent);
  return {
    dimension,
    name: group.name,
    percent: group.percent,
    n: group.n,
    correct: group.correct,
    wrong: group.wrong,
    severity: Math.round(gap),
    qualitative: group.qualitative,
    lowConfidence: group.lowConfidence,
    evidenceIds: group.ids.slice(0, 5),
  };
}

// Turn a SubjectReport into a ranked list of weak areas across every
// diagnostic dimension. Duplicates (same group name across dimensions) are
// kept — a "topic" and a "strand" with the same label carry different
// pedagogical meaning even if they sound alike.
export function extractWeakAreas(r: SubjectReport): WeakArea[] {
  const buckets: [WeakDimension, GroupStat[]][] = [
    ["topic", r.byTopic],
    ["strand", r.byStrand],
    ["skill", r.bySkill],
    ["bloom", r.byBloom],
    ["reasoning", r.byReasoning],
    ["gradeLevel", r.byGradeLevel],
  ];
  const out: WeakArea[] = [];
  for (const [dim, groups] of buckets) {
    for (const g of groups) {
      const w = toWeak(dim, g);
      if (w) out.push(w);
    }
  }
  // Sort by severity desc so the roadmap picks the highest-impact gaps first.
  out.sort((a, b) => b.severity - a.severity);
  return out;
}

// Convenience: the top-N weak topics (skipping strand/skill/etc.) — the
// roadmap's "primary focus" list is built from these. Topics are the most
// actionable dimension: they map cleanly to lessons, textbook chapters and
// video playlists.
export function topWeakTopics(r: SubjectReport, n = 5): WeakArea[] {
  return extractWeakAreas(r)
    .filter((w) => w.dimension === "topic")
    .slice(0, n);
}
