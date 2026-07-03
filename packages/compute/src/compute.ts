// Sodiq School diagnostic computation engine — TS port of client/src/lib/compute.js.
// Every indicator is derived from questions[] labels. Nothing is hand-set.
// Rules mirror CLAUDE.md > "Computation rules (must match exactly)".

import {
  Band,
  ConfidenceInterval,
  Difficulty,
  ErrorRosterItem,
  ForecastPoint,
  GroupStat,
  Question,
  RiskItem,
  SubjectInput,
  SubjectReport,
  TierStat,
} from "./types.js";

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { Oson: 1, "O'rta": 2, Qiyin: 3 };
export const DIFFICULTY_ORDER: Difficulty[] = ["Oson", "O'rta", "Qiyin"];

export const BAND_COLORS = {
  good: "#2F9E6B",
  green: "#2F9E6B",
  ok: "#C98A12",
  bad: "#D2503F",
  blue: "#3266C9",
  navy: "#06113C",
  orange: "#FF8A32",
} as const;

const isCorrect = (q: Question): boolean => q.result === "To'g'ri";
const isPartial = (q: Question): boolean => q.result === "Qisman";
const round = (x: number): number => Math.round(x);
const pct = (a: number, b: number): number => (b === 0 ? 0 : (a / b) * 100);

// Sodiq School "Yakuniy shkala" — verbatim from resource/image.png.
// Both scoreBand (for the ball/percent display) and masteryFromKDI (for the
// knowledge-depth gauge) use this same official scale.
const OFFICIAL_LEVELS: Band[] = [
  {
    key: "yuqori",
    label: "Yuqori daraja",
    en: "Advanced",
    color: BAND_COLORS.good,
    tavsif: "Murakkab masalalarni mustaqil yechadi",
    admission: "Qabul tavsiya etiladi",
    risk: "Past",
    riskColor: BAND_COLORS.good,
  },
  {
    key: "ishonchli",
    label: "Ishonchli daraja",
    en: "Secure",
    color: BAND_COLORS.green,
    tavsif: "Dasturni ishonchli o'zlashtiradi",
    admission: "Qabul qilinsin",
    risk: "Past",
    riskColor: BAND_COLORS.good,
  },
  {
    key: "rivojlanayotgan",
    label: "Rivojlanayotgan daraja",
    en: "Developing",
    color: BAND_COLORS.ok,
    tavsif: "Asos bor, ayrim bo'shliqlar",
    admission: "Shartli qabul",
    risk: "O'rtacha",
    riskColor: BAND_COLORS.ok,
  },
  {
    key: "shakllanayotgan",
    label: "Shakllanayotgan daraja",
    en: "Emerging",
    color: BAND_COLORS.orange,
    tavsif: "Sezilarli ko'nikma bo'shliqlari",
    admission: "Navbatda",
    risk: "Yuqori",
    riskColor: BAND_COLORS.orange,
  },
  {
    key: "tamal",
    label: "Tamal bosqich",
    en: "Foundational",
    color: BAND_COLORS.bad,
    tavsif: "Asos deyarli shakllanmagan",
    admission: "Tayyor emas",
    risk: "Juda yuqori",
    riskColor: BAND_COLORS.bad,
  },
];

export function scoreBand(p: number): Band {
  if (p >= 84) return OFFICIAL_LEVELS[0]!;
  if (p >= 67) return OFFICIAL_LEVELS[1]!;
  if (p >= 50) return OFFICIAL_LEVELS[2]!;
  if (p >= 35) return OFFICIAL_LEVELS[3]!;
  return OFFICIAL_LEVELS[4]!;
}

// KDI uses the same 5-level scale (KDI is a 0–100 measure too).
export const masteryFromKDI = scoreBand;

export { OFFICIAL_LEVELS };

export function pctColor(v: number): string {
  if (v >= 85) return BAND_COLORS.good;
  if (v >= 80) return BAND_COLORS.green;
  if (v >= 65) return BAND_COLORS.ok;
  return BAND_COLORS.bad;
}

export function scoreCI(percent: number, n: number): ConfidenceInterval {
  // Product decision (2026-07-03): show a fixed ±5 margin instead of the
  // Wald-derived formula. Cap the upper bound at 100 so a perfect score
  // renders "95–100" rather than "95–105"; likewise clamp low to 0.
  if (n <= 0) return { low: percent, high: percent, margin: 0 };
  const margin = 5;
  return {
    low: Math.max(0, percent - margin),
    high: Math.min(100, percent + margin),
    margin,
  };
}

function qualitativeLabel(correct: number, n: number): string {
  if (n === 0) return "Ma'lumot yo'q";
  const ratio = correct / n;
  if (ratio >= 0.8) return "Kuchli (kam namuna)";
  if (ratio >= 0.5) return "O'rtacha (kam namuna)";
  return "Zaif (kam namuna)";
}

function groupBy(questions: Question[], key: keyof Question | ((q: Question) => string | null)): GroupStat[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const raw = typeof key === "function" ? key(q) : (q[key] as string | null | undefined);
    // Skip null/undefined AND empty strings so a question with no value for
    // an optional label (e.g. bloom: "") is excluded from that graph's
    // aggregation instead of falling into an "" bucket.
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
    if (!groups.has(raw)) groups.set(raw, []);
    groups.get(raw)!.push(q);
  }
  const out: GroupStat[] = [];
  for (const [name, items] of groups) {
    const n = items.length;
    const correct = items.filter(isCorrect).length;
    const marks = items.reduce((s, q) => s + q.marks, 0);
    const earned = items.reduce((s, q) => s + q.earned, 0);
    const lowConfidence = n < 3;
    out.push({
      name,
      n,
      correct,
      wrong: n - correct,
      marks,
      earned,
      percent: round(pct(correct, n)),
      lowConfidence,
      qualitative: lowConfidence ? qualitativeLabel(correct, n) : null,
      ids: items.map((q) => q.id),
    });
  }
  return out;
}

export function computeReport(data: SubjectInput): SubjectReport {
  const questions = data.questions || [];
  const meta = data.meta;
  const totalMarks = meta?.totalMarks ?? questions.reduce((s, q) => s + q.marks, 0);
  const totalQuestions = meta?.totalQuestions ?? questions.length;

  const rawScore = questions.reduce((s, q) => s + q.earned, 0);
  const correctCount = questions.filter(isCorrect).length;
  const partialCount = questions.filter(isPartial).length;
  const percent = round(pct(rawScore, totalMarks));
  const ci = scoreCI(percent, totalQuestions);
  const band = scoreBand(percent);

  const tiers = {} as Record<Difficulty, TierStat>;
  for (const d of DIFFICULTY_ORDER) {
    const items = questions.filter((q) => q.difficulty === d);
    const correct = items.filter(isCorrect).length;
    tiers[d] = {
      n: items.length,
      correct,
      wrong: items.length - correct,
      pct: round(pct(correct, items.length)),
      weight: DIFFICULTY_WEIGHT[d],
    };
  }
  // When the exam has no "Qiyin" tier at all we cannot fairly credit the
  // student for solving hard items — treat that tier as absent so a perfect
  // exam doesn't get penalised by a 0/0 slot in the potential formula.
  const hardTier = tiers["Qiyin"];
  const hasHardTier = !!hardTier && hardTier.n > 0;
  const hardTierPct = hasHardTier ? hardTier.pct : 0;

  let wCorrect = 0;
  let wTotal = 0;
  for (const d of DIFFICULTY_ORDER) {
    const w = DIFFICULTY_WEIGHT[d];
    wCorrect += tiers[d].correct * w;
    wTotal += tiers[d].n * w;
  }
  const kdiExact = pct(wCorrect, wTotal);
  const kdi = round(kdiExact);
  const mastery = masteryFromKDI(kdi);

  // Detect technical errors (careless mistakes):
  //   1) admin's explicit `errorType === "Texnik"` — always wins
  //   2) manual `techErrorIds` — if any of those harder IDs was solved
  //   3) auto: same skill + ≥ same difficulty solved elsewhere
  // Fallback ordering matches errorRoster below.
  function isTechnicalError(q: Question): boolean {
    if (q.errorType === "Texnik") return true;
    if (q.errorType === "Bilim bo'shlig'i") return false; // admin override
    const manual = Array.isArray(q.techErrorIds) ? q.techErrorIds : [];
    if (manual.length > 0) return questions.some((o) => manual.includes(o.id) && isCorrect(o));
    return questions.some(
      (o) => o.skill === q.skill && isCorrect(o)
        && DIFFICULTY_WEIGHT[o.difficulty] >= DIFFICULTY_WEIGHT[q.difficulty],
    );
  }
  const technicalLost = questions
    .filter((q) => !isCorrect(q) && isTechnicalError(q))
    .reduce((s, q) => s + (q.marks - q.earned), 0);
  const gapLost = questions
    .filter((q) => !isCorrect(q) && !isTechnicalError(q))
    .reduce((s, q) => s + (q.marks - q.earned), 0);
  // Partial answers: marks the student would recover if their "Qisman"
  // response were completed to full. Deduplicated against technical-error
  // recovery so a Qisman + Texnik question isn't counted twice.
  const partialLost = questions
    .filter((q) => q.result === "Qisman" && !isTechnicalError(q))
    .reduce((s, q) => s + (q.marks - q.earned), 0);
  // `adjusted` and `potential` are shown as 0–100 numbers and are averaged
  // across subjects. Keep them as PERCENTAGES so subjects with different
  // totalMarks combine correctly.
  //
  // "Tuzatilgan baho" = raw + recoverable (technical carelessness + partial
  // answers completed). Displayed as "level achievable without careless
  // errors or unfinished answers".
  const adjustedRaw = rawScore + technicalLost + partialLost;
  const adjusted = round(pct(adjustedRaw, totalMarks));
  // Salohiyat = avg of three 0–100 signals:
  //   • percent           — raw score % (nima bajarilgan)
  //   • adjusted          — corrected score (texnik xato tuzatilgan holat)
  //   • hardTierPct       — qiyin savollardagi to'g'ri javob %
  // Idea: reward the student who solves hard items even if careless mistakes
  // pulled the raw score down.
  // Two-part avg when there are no hard-tier items (a perfect score on an
  // easy-only exam is a perfect potential). Otherwise the original three-part
  // rule: raw + corrected + hard-question accuracy.
  const potential = hasHardTier
    ? round((percent + adjusted + hardTierPct) / 3)
    : round((percent + adjusted) / 2);

  const byStrand = groupBy(questions, "strand").sort((a, b) => b.n - a.n);
  const byTopic = groupBy(questions, "topic").sort((a, b) => b.percent - a.percent);
  const byBloom = groupBy(questions, "bloom");
  const byReasoning = groupBy(questions, "reasoning");
  const byGradeLevel = groupBy(questions, "gradeLevel");
  const bySkill = groupBy(questions, "skill");

  const bloomOrder = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];
  byBloom.sort((a, b) => bloomOrder.indexOf(a.name) - bloomOrder.indexOf(b.name));

  const topics = byTopic.map((t) => {
    const items = questions.filter((q) => q.topic === t.name);
    const avgWeight = items.reduce((s, q) => s + DIFFICULTY_WEIGHT[q.difficulty], 0) / items.length;
    const analysisFrac = items.filter((q) => q.bloom === "Tahlil").length / items.length;
    return { ...t, avgWeight, analysisFrac };
  });
  const ranked = [...topics].filter((t) => t.n >= 2).sort((a, b) => a.percent - b.percent);
  const weakestTopic = ranked[0] ?? null;
  const secondWeakestTopic = ranked[1] ?? null;
  const strongTopics = ranked.filter((t) => t.percent >= 85).map((t) => t.name);

  const strandDetails = byStrand.map((s) => {
    const inner = topics.filter((t) =>
      questions.some((q) => q.topic === t.name && q.strand === s.name),
    );
    const sorted = [...inner].sort((a, b) => b.percent - a.percent);
    return {
      ...s,
      color: pctColor(s.percent),
      band: s.percent >= 80 ? "Yaxshi" : s.percent >= 65 ? "O'rtacha" : "Zaif",
      strongInner: sorted[0] ?? null,
      weakInner: sorted.length > 1 ? (sorted[sorted.length - 1] ?? null) : null,
    };
  });

  const gapZones = {
    below: [] as typeof topics,
    at: [] as typeof topics,
    above: [] as typeof topics,
  };
  for (const t of topics) {
    if (t.percent < 55) gapZones.below.push(t);
    else if (t.percent >= 70 && (t.avgWeight >= 2.3 || t.analysisFrac >= 0.6)) gapZones.above.push(t);
    else gapZones.at.push(t);
  }
  gapZones.below.sort((a, b) => a.percent - b.percent);
  gapZones.above.sort((a, b) => b.percent - a.percent);

  const belowCount = gapZones.below.filter((t) => !t.lowConfidence || t.percent === 0).length;
  const overallRisk =
    kdi >= 70 && belowCount <= 3
      ? { level: "PAST", en: "Low", color: BAND_COLORS.good }
      : kdi >= 55
      ? { level: "O'RTA", en: "Moderate", color: BAND_COLORS.ok }
      : { level: "YUQORI", en: "High", color: BAND_COLORS.bad };

  const riskItems: RiskItem[] = gapZones.below.slice(0, 3).map((t) => {
    const central = t.n >= 3 || t.avgWeight >= 2;
    return {
      risk: `${t.name} ${meta?.grade ?? ""}-sinfda yopilmasligi`.trim(),
      probability: central ? "O'rta" : "Past-o'rta",
      impact: central ? "Yuqori" : "O'rta",
      level: central
        ? { label: "Muammoli", color: BAND_COLORS.orange }
        : { label: "Normal", color: BAND_COLORS.ok },
      mitigation: `${t.name} bo'yicha maqsadli ko'prik modul bilan oldi olinadi.`,
    };
  });
  if (technicalLost > 0) {
    riskItems.push({
      risk: "Ikki-talabli / e'tibor xatolari",
      probability: "Past",
      impact: "O'rta",
      level: { label: "Xotirjamlik", color: BAND_COLORS.green },
      mitigation: "Javobni tekshirish odati bilan hal bo'ladi.",
    });
  }

  // Growth forecast always ends at 100 (the theoretical ceiling reachable in
  // 12 months with the recommended roadmap). Intermediate stops ramp up with
  // diminishing returns from `percent` toward that ceiling.
  const headroom = Math.max(0, 100 - percent);
  const growthForecast: ForecastPoint[] = [
    { label: "Hozir", v: percent, color: band.color },
    { label: "3 oy", v: percent + round(headroom * 0.45), color: BAND_COLORS.green },
    { label: "6 oy", v: percent + round(headroom * 0.7), color: BAND_COLORS.green },
    { label: "12 oy", v: 100, color: BAND_COLORS.green },
  ];

  const wrong = questions.filter((q) => !isCorrect(q));
  // Technical-error detector:
  //   1) If the question carries a manual `techErrorIds` list, we look at
  //      those specific harder questions. Any of them solved → technical.
  //   2) Otherwise fall back to the automatic heuristic (same skill and
  //      difficulty weight ≥ current).
  //   3) Admin's explicit `errorType === "Texnik"` still wins.
  const errorRoster: ErrorRosterItem[] = wrong.map((q) => {
    const manualIds = Array.isArray(q.techErrorIds) ? q.techErrorIds : [];
    const manualSolved = manualIds.length > 0
      ? questions.filter((o) => manualIds.includes(o.id) && isCorrect(o))
      : [];
    const autoHarderSolved = manualIds.length > 0 ? [] : questions.filter(
      (o) =>
        o.skill === q.skill &&
        isCorrect(o) &&
        DIFFICULTY_WEIGHT[o.difficulty] >= DIFFICULTY_WEIGHT[q.difficulty],
    );
    const detectedTechnical = manualSolved.length > 0 || autoHarderSolved.length > 0;
    const explicit = q.errorType === "Texnik";
    return {
      id: q.id,
      topic: q.subTopic || q.topic,
      skill: q.skill,
      marks: q.marks,
      errorType: q.errorType,
      isTechnical: explicit || (q.errorType == null && detectedTechnical),
      harderSolvedIds: (manualSolved.length > 0 ? manualSolved : autoHarderSolved).map((o) => o.id),
      evidence: q.evidence,
    };
  });

  const real = data.realData ?? { percentile: null, cohortAverage: null, avgTimeSec: null };

  return {
    meta,
    totalMarks,
    totalQuestions,
    questions,
    rawScore,
    percent,
    correctCount,
    partialCount,
    ci,
    band,
    tiers,
    hardTierPct,
    kdi,
    kdiExact,
    kdiParts: { wCorrect, wTotal },
    mastery,
    technicalLost,
    gapLost,
    lostTotal: technicalLost + gapLost,
    adjusted,
    potential,
    byStrand,
    byTopic,
    byBloom,
    byReasoning,
    byGradeLevel,
    bySkill,
    topics,
    strandDetails,
    weakestTopic,
    secondWeakestTopic,
    strongTopics,
    gapZones,
    overallRisk,
    riskItems,
    growthForecast,
    errorRoster,
    technicalErrors: errorRoster.filter((e) => e.isTechnical),
    gapErrors: errorRoster.filter((e) => !e.isTechnical),
    percentile: real.percentile,
    cohortAverage: real.cohortAverage,
    avgTimeSec: real.avgTimeSec,
  };
}

// Validation helpers ----------------------------------------------------------
// Used by the backend before persisting a SubjectResult.

export interface QuestionValidationError {
  questionId: string;
  field: string;
  message: string;
}

export function validateQuestions(questions: Question[]): QuestionValidationError[] {
  const errors: QuestionValidationError[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    if (!q.id) errors.push({ questionId: q.id ?? "<missing>", field: "id", message: "id is required" });
    if (seen.has(q.id)) errors.push({ questionId: q.id, field: "id", message: "duplicate id" });
    seen.add(q.id);
    if (q.marks < 0) errors.push({ questionId: q.id, field: "marks", message: "marks must be >= 0" });
    if (q.earned < 0) errors.push({ questionId: q.id, field: "earned", message: "earned must be >= 0" });
    if (q.earned > q.marks)
      errors.push({ questionId: q.id, field: "earned", message: "earned cannot exceed marks" });
    if (q.result === "To'g'ri" && q.errorType != null)
      errors.push({
        questionId: q.id,
        field: "errorType",
        message: "errorType must be null for correct answers",
      });
    if (q.result !== "To'g'ri" && q.earned === q.marks)
      errors.push({
        questionId: q.id,
        field: "earned",
        message: "non-correct results cannot earn full marks",
      });
  }
  return errors;
}
