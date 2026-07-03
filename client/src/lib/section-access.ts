// Report section access — decides whether a given block (narrative / roadmap /
// risks_notes) is visible to the current parent. Overview metrics are always
// on; the deeper analysis is unlocked by the admin per Result.

export type SectionKey = "narrative" | "roadmap" | "risks_notes";

export const SECTION_LABELS: Record<SectionKey, string> = {
  narrative: "Batafsil tahlil",
  roadmap: "Rivojlanish yo'li (3/6/12 oy)",
  risks_notes: "Xatarlar va xulosalar",
};

export function isUnlocked(unlocked: string[] | undefined | null, key: SectionKey): boolean {
  if (!unlocked || unlocked.length === 0) return false;
  return unlocked.includes(key);
}
