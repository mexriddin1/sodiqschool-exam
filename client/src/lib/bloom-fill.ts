// Bloom ladder — full 6 levels, each shown with a qualitative label
// (a'lo/mustahkam/yaxshi/rivojlanmoqda) instead of an exact percentage.
// Measured levels use the real report data; unmeasured levels are estimated
// from the overall performance with a softer discount so a strong student
// never sees "Yaratish 55%".

const LEVELS = [
  { key: "Eslab qolish", gloss: "yodda saqlash",     discount: 0 },
  { key: "Tushunish",    gloss: "ma'noni anglash",   discount: 2 },
  { key: "Qo'llash",     gloss: "qoidani qo'llash",  discount: 5 },
  { key: "Tahlil",       gloss: "qismlarga ajratish",discount: 8 },
  { key: "Baholash",     gloss: "baho va xulosa",    discount: 11 },
  { key: "Yaratish",     gloss: "yangi yechim tuzish",discount: 14 },
] as const;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface BloomBar {
  key: string;
  gloss: string;
  percent: number;   // kept internally for bar length / colour; not shown
  label: string;     // qualitative badge shown next to the bar
  measured: boolean;
}

/** 0–100 percent → qualitative Uzbek label. Never uses raw digits. */
export function qualitativeLabel(pct: number): string {
  if (pct >= 90) return "A'lo";
  if (pct >= 80) return "Mustahkam";
  if (pct >= 70) return "Yaxshi";
  if (pct >= 55) return "Rivojlanmoqda";
  return "Boshlang'ich";
}

export function buildBloomBars(
  report: { percent: number; byBloom?: { name: string; percent: number; lowConfidence?: boolean }[] },
): BloomBar[] {
  const measured = report.byBloom ?? [];
  // Product decision (2026-07-03): show ONLY levels that at least one
  // question in the test tagged. No question ever tagged "Tahlil"? Then
  // "Tahlil" doesn't appear on the ladder. Preserves the canonical Bloom
  // order (simple → complex) so the ladder reads bottom-up.
  return LEVELS
    .map((L) => {
      const found = measured.find((x) => x.name === L.key);
      if (!found) return null;
      return {
        key: L.key,
        gloss: L.gloss,
        percent: found.percent,
        // Parents asked for the raw percent instead of a qualitative bucket.
        // qualitativeLabel is still exported for callers that want the text.
        label: `${Math.round(found.percent)}%`,
        measured: true,
      } as BloomBar;
    })
    .filter((b): b is BloomBar => b !== null);
}
