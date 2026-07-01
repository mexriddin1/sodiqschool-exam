// ============================================================================
// Sodiq School — diagnostic computation engine
// ----------------------------------------------------------------------------
// EVERY indicator is derived from questions[] labels. Nothing is hand-set.
// Rules mirror CLAUDE.md > "Computation rules (must match exactly)".
// ============================================================================

export const DIFFICULTY_WEIGHT = { Oson: 1, "O'rta": 2, Qiyin: 3 };
export const DIFFICULTY_ORDER = ["Oson", "O'rta", "Qiyin"];

// Brand-aligned semantic colours used across charts/SVG.
// Data semantics — aligned 1:1 with tokens.css. ONE green (good === green).
export const BAND_COLORS = {
  good: "#2F9E6B", // pos
  green: "#2F9E6B", // alias (was a 2nd green; collapsed)
  ok: "#C98A12", // warn
  bad: "#D2503F", // neg
  blue: "#3266C9", // info
  navy: "#06113C",
  orange: "#FF8A32", // accent
};

const isCorrect = (q) => q.result === "To'g'ri";
const isPartial = (q) => q.result === "Qisman";
const round = (x) => Math.round(x);
const pct = (a, b) => (b === 0 ? 0 : (a / b) * 100);

// ---- score band (position on the 0–100 scale) ------------------------------
// Thresholds match the reference position scale.
export function scoreBand(p) {
  if (p >= 90) return { key: "juda", label: "Juda yuqori", en: "Very High", color: BAND_COLORS.good };
  if (p >= 80) return { key: "yaxshi", label: "Yaxshi", en: "Good", color: BAND_COLORS.green };
  if (p >= 70) return { key: "ortacha", label: "O'rtacha", en: "Average", color: BAND_COLORS.ok };
  if (p >= 60) return { key: "rivoj", label: "Zaif", en: "Developing", color: BAND_COLORS.orange };
  return { key: "sayoz", label: "Sayoz", en: "Shallow", color: BAND_COLORS.bad };
}

// ---- mastery band from KDI (CLAUDE.md exact thresholds) ---------------------
export function masteryFromKDI(kdi) {
  if (kdi >= 95) return { label: "Ajoyib", en: "Exceptional", color: "#1F7A50" };
  if (kdi >= 85) return { label: "Yuqori daraja", en: "Advanced", color: BAND_COLORS.good };
  if (kdi >= 70) return { label: "Yaxshi egallagan", en: "Proficient", color: BAND_COLORS.green };
  if (kdi >= 55) return { label: "O'rtacha", en: "Basic", color: BAND_COLORS.ok };
  if (kdi >= 40) return { label: "Cheklangan", en: "Limited", color: BAND_COLORS.orange };
  return { label: "Jiddiy yordam", en: "Significant Support", color: BAND_COLORS.bad };
}

// colour for a generic 0–100 mastery percentage (heatmap / meters)
export function pctColor(v) {
  if (v >= 85) return BAND_COLORS.good;
  if (v >= 80) return BAND_COLORS.green;
  if (v >= 65) return BAND_COLORS.ok;
  return BAND_COLORS.bad;
}

// ---- group helper: correct/total per label group ---------------------------
// n<3 → qualitative label + low-confidence flag, NOT a precise number.
function groupBy(questions, key) {
  const groups = new Map();
  for (const q of questions) {
    const raw = typeof key === "function" ? key(q) : q[key];
    if (raw == null) continue;
    if (!groups.has(raw)) groups.set(raw, []);
    groups.get(raw).push(q);
  }
  const out = [];
  for (const [name, items] of groups) {
    const n = items.length;
    const correct = items.filter(isCorrect).length;
    const marks = items.reduce((s, q) => s + q.marks, 0);
    const earned = items.reduce((s, q) => s + q.earned, 0);
    const lowConfidence = n < 3; // CLAUDE.md guard
    out.push({
      name,
      n,
      correct,
      wrong: n - correct,
      marks,
      earned,
      percent: round(pct(correct, n)),
      lowConfidence,
      // qualitative label when we cannot trust a precise number
      qualitative: lowConfidence ? qualitativeLabel(correct, n) : null,
      ids: items.map((q) => q.id),
    });
  }
  return out;
}

function qualitativeLabel(correct, n) {
  if (n === 0) return "Ma'lumot yo'q";
  const ratio = correct / n;
  if (ratio >= 0.8) return "Kuchli (kam namuna)";
  if (ratio >= 0.5) return "O'rtacha (kam namuna)";
  return "Zaif (kam namuna)";
}

// ---- confidence interval for the headline score ----------------------------
// Transparent, NOT hand-set: half-width = round( sqrt(p*(100-p)/n) / 2 ).
// One test is an estimate; this is the standard-error band, documented to user.
export function scoreCI(percent, n) {
  const margin = round(Math.sqrt((percent * (100 - percent)) / n) / 2);
  return { low: Math.max(0, percent - margin), high: Math.min(100, percent + margin), margin };
}

// ============================================================================
// MAIN
// ============================================================================
export function computeReport(data) {
  const questions = data.questions || [];
  const meta = data.meta || {};
  const totalMarks = meta.totalMarks ?? questions.reduce((s, q) => s + q.marks, 0);
  const totalQuestions = meta.totalQuestions ?? questions.length;

  // --- headline score -------------------------------------------------------
  const rawScore = questions.reduce((s, q) => s + q.earned, 0);
  const correctCount = questions.filter(isCorrect).length;
  const partialCount = questions.filter(isPartial).length;
  const percent = round(pct(rawScore, totalMarks));
  const ci = scoreCI(percent, totalQuestions);
  const band = scoreBand(percent);

  // --- difficulty tiers -----------------------------------------------------
  const tiers = {};
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
  const hardTierPct = tiers["Qiyin"]?.pct ?? 0;

  // --- KDI: weighted correct / weighted total -------------------------------
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

  // --- adjusted (remove technical-error losses) -----------------------------
  const technicalLost = questions
    .filter((q) => q.errorType === "Texnik")
    .reduce((s, q) => s + (q.marks - q.earned), 0);
  const gapLost = questions
    .filter((q) => q.errorType === "Bilim bo'shlig'i")
    .reduce((s, q) => s + (q.marks - q.earned), 0);
  const adjusted = rawScore + technicalLost;

  // --- potential (transparent formula, NOT hand-set) ------------------------
  const potential = round((adjusted + kdi + hardTierPct) / 3);

  // --- grouped percentages --------------------------------------------------
  const byStrand = groupBy(questions, "strand").sort((a, b) => b.n - a.n);
  const byTopic = groupBy(questions, "topic").sort((a, b) => b.percent - a.percent);
  const byBloom = groupBy(questions, "bloom");
  const byReasoning = groupBy(questions, "reasoning");
  const byGradeLevel = groupBy(questions, "gradeLevel");
  const bySkill = groupBy(questions, "skill");

  // bloom ordered low→high cognitive demand for the depth meters
  const bloomOrder = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];
  byBloom.sort((a, b) => bloomOrder.indexOf(a.name) - bloomOrder.indexOf(b.name));

  // --- enriched topics: avg difficulty weight + analysis share -------------
  // (used for §6 heatmap, §8 grade-level zones, §10–12 program targets)
  const topics = byTopic.map((t) => {
    const items = questions.filter((q) => q.topic === t.name);
    const avgWeight = items.reduce((s, q) => s + DIFFICULTY_WEIGHT[q.difficulty], 0) / items.length;
    const analysisFrac = items.filter((q) => q.bloom === "Tahlil").length / items.length;
    return { ...t, avgWeight, analysisFrac };
  });
  // weakest / strongest meaningful topics (n>=2 so a number is trustworthy)
  const ranked = [...topics].filter((t) => t.n >= 2).sort((a, b) => a.percent - b.percent);
  const weakestTopic = ranked[0] || null;
  const secondWeakestTopic = ranked[1] || null;
  const strongTopics = ranked.filter((t) => t.percent >= 85).map((t) => t.name);

  // --- strand detail: strongest & weakest topic inside each strand ---------
  const strandDetails = byStrand.map((s) => {
    const inner = topics.filter((t) => questions.some((q) => q.topic === t.name && q.strand === s.name));
    const sorted = [...inner].sort((a, b) => b.percent - a.percent);
    return {
      ...s,
      color: pctColor(s.percent),
      band: s.percent >= 80 ? "Yaxshi" : s.percent >= 65 ? "O'rtacha" : "Zaif",
      strongInner: sorted[0] || null,
      weakInner: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    };
  });

  // --- §8 grade-level zones (below / at / above) ----------------------------
  // Position is judged on BOTH score and cognitive demand, not score alone:
  // a 100% on easy items is "at grade"; strength on hard/analysis items is "above".
  const gapZones = { below: [], at: [], above: [] };
  for (const t of topics) {
    if (t.percent < 55) gapZones.below.push(t);
    else if (t.percent >= 70 && (t.avgWeight >= 2.3 || t.analysisFrac >= 0.6)) gapZones.above.push(t);
    else gapZones.at.push(t);
  }
  gapZones.below.sort((a, b) => a.percent - b.percent);
  gapZones.above.sort((a, b) => b.percent - a.percent);

  // --- §9 risk --------------------------------------------------------------
  const belowCount = gapZones.below.filter((t) => !t.lowConfidence || t.percent === 0).length;
  const overallRisk =
    kdi >= 70 && belowCount <= 3
      ? { level: "PAST", en: "Low", color: BAND_COLORS.good }
      : kdi >= 55
        ? { level: "O'RTA", en: "Moderate", color: BAND_COLORS.ok }
        : { level: "YUQORI", en: "High", color: BAND_COLORS.bad };
  // one risk row per below-grade gap; impact scaled by how central the topic is
  const riskItems = gapZones.below.slice(0, 3).map((t, i) => {
    const central = t.n >= 3 || t.avgWeight >= 2;
    return {
      risk: `${t.name} ${meta.grade || ""}-sinfda yopilmasligi`.trim(),
      probability: central ? "O'rta" : "Past-o'rta",
      impact: central ? "Yuqori" : "O'rta",
      level: central ? { label: "Muammoli", color: BAND_COLORS.orange } : { label: "Normal", color: BAND_COLORS.ok },
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

  // --- §13 growth forecast (criterion-based, transparent) -------------------
  // The ceiling without technical errors is `adjusted`; growth approaches it.
  const headroom = Math.max(0, adjusted - percent);
  const growthForecast = [
    { label: "Hozir", v: percent, color: band.color },
    { label: "3 oy", v: percent + round(headroom * 0.45), color: BAND_COLORS.green },
    { label: "6 oy", v: percent + round(headroom * 0.7), color: BAND_COLORS.green },
    { label: "12 oy", v: percent + round(headroom * 0.95), color: BAND_COLORS.green },
  ];

  // --- error roster (for §3 highlight + §4 methodology) ---------------------
  const wrong = questions.filter((q) => !isCorrect(q));
  const errorRoster = wrong.map((q) => {
    // "solved something harder with the same skill?" → technical, else gap.
    const harderSolved = questions.filter(
      (o) =>
        o.skill === q.skill &&
        isCorrect(o) &&
        DIFFICULTY_WEIGHT[o.difficulty] >= DIFFICULTY_WEIGHT[q.difficulty]
    );
    return {
      id: q.id,
      topic: q.subTopic || q.topic,
      skill: q.skill,
      marks: q.marks,
      errorType: q.errorType,
      isTechnical: q.errorType === "Texnik",
      harderSolvedIds: harderSolved.map((o) => o.id),
      evidence: q.evidence,
    };
  });

  // --- real-data passthrough (NEVER fabricate) ------------------------------
  const real = data.realData || {};
  const percentile = real.percentile ?? null;
  const cohortAverage = real.cohortAverage ?? null;
  const avgTimeSec = real.avgTimeSec ?? null;

  return {
    meta,
    totalMarks,
    totalQuestions,
    questions,
    // headline
    rawScore,
    percent,
    correctCount,
    partialCount,
    ci,
    band,
    // difficulty
    tiers,
    hardTierPct,
    // depth
    kdi,
    kdiExact,
    kdiParts: { wCorrect, wTotal },
    mastery,
    // adjusted / potential
    technicalLost,
    gapLost,
    lostTotal: technicalLost + gapLost,
    adjusted,
    potential,
    // groupings
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
    // §8 / §9 / §13
    gapZones,
    overallRisk,
    riskItems,
    growthForecast,
    // errors
    errorRoster,
    technicalErrors: errorRoster.filter((e) => e.isTechnical),
    gapErrors: errorRoster.filter((e) => !e.isTechnical),
    // real data (null unless provided)
    percentile,
    cohortAverage,
    avgTimeSec,
  };
}
