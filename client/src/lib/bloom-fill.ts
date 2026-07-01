// Fills in a full Bloom ladder for the report card. Bloom levels that the
// test actually measures use real percentages; the rest are estimated from
// the overall performance so a strong student never sees "Yaratish 55%".
//
// Estimator: higher Bloom levels are progressively harder, so subtract a
// small discount from the overall percentage per level. Clamped to [30, 95].

const LEVELS = [
  { key: "Eslab qolish", gloss: "yodda saqlash",     discount: 0  },
  { key: "Tushunish",    gloss: "ma'noni anglash",   discount: 4  },
  { key: "Qo'llash",     gloss: "qoidani qo'llash",  discount: 8  },
  { key: "Tahlil",       gloss: "qismlarga ajratish",discount: 12 },
  { key: "Baholash",     gloss: "baho va xulosa",    discount: 16 },
  { key: "Yaratish",     gloss: "yangi yechim tuzish",discount: 22 },
] as const;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface BloomBar { key: string; gloss: string; percent: number; measured: boolean }

export function buildBloomBars(
  report: { percent: number; byBloom?: { name: string; percent: number; lowConfidence?: boolean }[] },
): BloomBar[] {
  return LEVELS.map((L) => {
    const found = report.byBloom?.find((x) => x.name === L.key && !x.lowConfidence);
    if (found) return { key: L.key, gloss: L.gloss, percent: found.percent, measured: true };
    const estimated = clamp(Math.round(report.percent - L.discount), 30, 95);
    return { key: L.key, gloss: L.gloss, percent: estimated, measured: false };
  });
}
