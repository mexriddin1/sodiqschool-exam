// Report section access — decides whether a given block (narrative / roadmap /
// risks_notes) is visible to the current parent. Overview metrics are always
// on; the deeper analysis is unlocked by the admin per Result.

// "roadmap" ATAYLAB yo'q — u endi doimiy unlockedSections kaliti emas, balki
// 20 daqiqalik vaqt oynasi (me.roadmapOpen, backend hisoblaydi). "O'sish
// ko'rsatkichi" esa doim ochiq. Bu yerda faqat narrative va risks_notes.
export type SectionKey = "narrative" | "risks_notes";

export const SECTION_LABELS: Record<SectionKey, string> = {
  narrative: "Batafsil tahlil",
  risks_notes: "Xatarlar va xulosalar",
};

export function isUnlocked(unlocked: string[] | undefined | null, key: SectionKey): boolean {
  if (!unlocked || unlocked.length === 0) return false;
  return unlocked.includes(key);
}
