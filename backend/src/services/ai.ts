// Gemini narrative + roadmap generator.
//
// Per result: one JSON-structured call per subject writes the parent-facing
// story (diagnostika), one per subject authors the next-level (A→B) roadmap
// topics (skipped when a subject has no spare months), and one composite
// summary — up to 7 Gemini requests total. Provider was migrated from DeepSeek
// to Google Gemini (see callGeminiJson); the call shapes and telemetry are
// otherwise unchanged.

import { computeReport, computeComposite, DEFAULT_ADMISSION_THRESHOLDS, extractWeights, buildRoadmapAiContext } from "@sodiq/compute";
import type { SubjectInput, SubjectKey, SubjectReport, RoadmapAiContext } from "@sodiq/compute";

// Gemini 2.5 Flash pricing (USD per 1M tokens). Verify against the live
// pricing page — these two numbers are the only ones to change if it moves.
const COST_PER_1M_INPUT_USD = 0.30;
const COST_PER_1M_OUTPUT_USD = 2.5;

const API_BASE = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const API_KEY  = process.env.GEMINI_API_KEY ?? "";
const MODEL    = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const SUBJECT_LABEL: Record<SubjectKey, string> = {
  MATH: "matematika",
  ENGLISH: "ingliz tili",
  CRITICAL_THINKING: "tanqidiy fikrlash",
};

export interface RunTelemetry {
  section: string;
  promptTokens: number;
  completionTokens: number;
  ms: number;
  ts: string;
}

export interface AiUsageSummary {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  generatedAt: string;
  runs: RunTelemetry[];
}

export interface SubjectSections {
  diagnostika: string;
  tahlil: string;
  growth: string;
  skills: string;
  bloom: string;
  reasoning?: string; // math-only §10 Fikrlash turlari
}

export interface AiNarrative {
  math:              SubjectSections;
  english:           SubjectSections;
  criticalThinking:  SubjectSections;
  summary:           { crossCutting: string; finalRecommendation: string };
}

// AI-authored roadmap delta persisted to Result.aiRoadmap. The deterministic
// engine (@sodiq/compute buildRoadmapV2) owns the skeleton + weak-fixing
// stages; this only supplies the next-level (A→B) topics and optional polished
// wording for the weak topics. Merged into the roadmap at render time
// (client/src/lib/programs.js).
export interface SubjectRoadmapAi {
  nextLevelTopics: { topic: string; description: string; rationale: string; order: number }[];
  focusDescriptions?: { topic: string; description: string }[];
}

export interface AiRoadmap {
  math:             SubjectRoadmapAi;
  english:          SubjectRoadmapAi;
  criticalThinking: SubjectRoadmapAi;
}

// Gemini responseSchema (OpenAPI subset — UPPERCASE type names).
const ROADMAP_SCHEMA = {
  type: "OBJECT",
  properties: {
    nextLevelTopics: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          topic: { type: "STRING" },
          description: { type: "STRING" },
          rationale: { type: "STRING" },
          order: { type: "INTEGER" },
        },
        required: ["topic", "description", "rationale", "order"],
      },
    },
    focusDescriptions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          topic: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["topic", "description"],
      },
    },
  },
  required: ["nextLevelTopics"],
};

// Compact statistics — every prompt uses this shape so the model has the same
// numeric grounding across sections and won't invent figures.
function subjectDigest(subject: SubjectKey, report: SubjectReport) {
  const strongTopic = [...(report.topics ?? [])].filter((t) => t.n >= 2).sort((a, b) => b.percent - a.percent)[0];
  const weakTopic   = [...(report.topics ?? [])].filter((t) => t.n >= 2).sort((a, b) => a.percent - b.percent)[0];
  return {
    fan: SUBJECT_LABEL[subject],
    percent: report.percent,
    band: report.band?.label ?? null,
    adjusted: report.adjusted,
    potential: report.potential,
    correctCount: report.correctCount,
    totalQuestions: report.questions.length,
    tiers: {
      Oson:  { n: report.tiers.Oson.n,      correct: report.tiers.Oson.correct,      pct: report.tiers.Oson.pct },
      Orta:  { n: report.tiers["O'rta"].n,  correct: report.tiers["O'rta"].correct,  pct: report.tiers["O'rta"].pct },
      Qiyin: { n: report.tiers.Qiyin.n,     correct: report.tiers.Qiyin.correct,     pct: report.tiers.Qiyin.pct },
    },
    technicalLost: report.technicalLost,
    gapLost: report.lostTotal - report.technicalLost,
    strongTopic: strongTopic ? { name: strongTopic.name, percent: strongTopic.percent } : null,
    weakTopic:   weakTopic   ? { name: weakTopic.name,   percent: weakTopic.percent }   : null,
    strands:  (report.byStrand ?? []).map((s)  => ({ name: s.name, percent: s.percent })),
    bloom:    (report.byBloom ?? []).map((b)   => ({ name: b.name, percent: b.percent, n: b.n })),
    skills:   (report.bySkill ?? []).map((s)   => ({ name: s.name, percent: s.percent, n: s.n })),
    reasoning:(report.byReasoning ?? []).map((r) => ({ name: r.name, percent: r.percent, n: r.n })),
    errorRoster: (report.errorRoster ?? []).slice(0, 8).map((e) => ({
      id: e.id, topic: e.topic, isTechnical: e.isTechnical, evidence: e.evidence,
    })),
  };
}

// Gemini structured JSON call. Mirrors the old DeepSeek helper's contract
// (returns a parsed object + telemetry) so the rest of the module is unchanged.
// Pass `responseSchema` (OpenAPI subset, UPPERCASE types) to force a strict
// shape; omit it for free-form JSON (e.g. the single-key `diagnostika` story).
async function callGeminiJson<T>(
  section: string,
  system: string,
  user: string,
  responseSchema?: unknown,
): Promise<{ obj: T; telemetry: RunTelemetry }> {
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.4,
        // Enough room for a 6-8 paragraph story / roadmap without truncation.
        maxOutputTokens: 3200,
        responseMimeType: "application/json",
        ...(responseSchema ? { responseSchema } : {}),
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${section} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  const json = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  // Safety blocks / empty candidates yield no text — degrade to {} exactly like
  // the previous parse-failure path so fire-and-forget generation never crashes.
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let obj: T;
  try { obj = JSON.parse(raw) as T; } catch { obj = {} as T; }
  return {
    obj,
    telemetry: {
      section,
      promptTokens: json.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      ms: Date.now() - t0,
      ts: new Date().toISOString(),
    },
  };
}

// Strict style contract — the same voice everywhere.
const STYLE_RULES =
  "Uslub qoidalari (majburiy):\n" +
  "- Ozbek Latin yozuvi (ASCII, o' g' bilan). Cyrillic yo'q.\n" +
  "- Farzandning ismini yoki familiyasini AYTMANG. Har doim \"farzandingiz\" yoki \"bola\" deb yozing.\n" +
  "- Tabiiy, jonli ota-ona tili. Xushmuomala, ammo maqtash bilan chegaralanmang; ochiq va halol.\n" +
  "- Muhim raqamlar va atamalarni **markdown bold** bilan belgilang: **72%**, **texnik xato**, **trigonometriya**.\n" +
  "- Sarlavhalar, ro'yxatlar, emoji yoki bullet YO'Q — faqat oqib boruvchi matn (paragraflar bo'sh qatorlar bilan).\n" +
  "- Statistikadan tashqari fakt to'qib chiqarmang. Har son berilgan JSON'dan bo'lsin.";

function subjectSystemPrompt() {
  return (
    "Siz Sodiq School diagnostika bo'limining tajribali analitigisiz. Ota-onaga uzun bir sahifalik hikoya yozasiz — u sahifaning §1 'Bir qarashda' bo'limida ko'rinadi va butun hisobotning to'liq xulosasi hisoblanadi.\n\n" +
    STYLE_RULES +
    "\n\n" +
    "JSON obyekt qaytaring — **faqat bitta kalit**: `diagnostika`. Uning ichida BIR NECHTA paragraf bo'lishi kerak, har biri bo'sh qator bilan ajratilgan.\n\n" +
    "Struktura (majburiy tartib, har biri alohida paragraf):\n" +
    "1) **Umumiy xulosa** — bola imtihonda qanday chiqdi, nima ustuvor, umumiy manzara. Ochiq va aniq, 3-4 gap.\n" +
    "2) **Umumiy natija va xatolar (§2)** — foiz, band, texnik vs bilim bo'shlig'i nisbati, tuzatilgan baho.\n" +
    "3) **Bilim chuqurligi (§5, Oson/O'rta/Qiyin)** — qaysi darajada qulay, qaysi darajada qiyinchilik.\n" +
    "4) **Mavzular (§7)** — eng kuchli va eng zaif 1-2 mavzu, qaysi qismlarni mustahkamlash kerak.\n" +
    "5) **Ko'nikmalar profili (§Radar)** — radar'dagi kuchli va zaif ko'nikmalar, tavsiya.\n" +
    "6) **Fikrlash darajalari (§Bloom)** — qaysi darajada mustahkam, qaysi darajaga o'sish kerak.\n" +
    "7) (Faqat matematika uchun) **Fikrlash turlari** — deduktiv/induktiv/analitik/fazoviy fikrlash.\n" +
    "8) **Rivojlanish yo'li va kelajak** — 3-6-12 oylik reja bajarilsa qanday ball kutiladi. Ijobiy yakun.\n\n" +
    "Har paragraf 3-4 qisqa gapdan iborat. Bir paragrafdan boshqasiga tabiiy o'tish qiling. Matn shunday bo'lsinki, ota-ona uni yoqtirib o'qisin va bola haqida yangi narsa bilib olsin."
  );
}

function summarySystemPrompt() {
  return (
    "Siz Sodiq School komissiyasining tajribali analitigisiz. Uch fanning umumiy manzarasini ota-onaga bir sahifada tushuntirasiz.\n\n" +
    STYLE_RULES +
    "\n\nSiz JSON obyekt qaytarasiz, quyidagi kalitlar bilan:\n" +
    "- crossCutting: §04 Umumiy manzara. Uch fanni birga ko'rganda chiqadigan **1-2 asosiy xulosa**. Fanlar orasidagi bog'liqlik.\n" +
    "- finalRecommendation: §05 Yakuniy tavsiya. Qaror asosi va **aniq 3 ta amaliy qadam** matn ichida.\n\n" +
    "Har kalit — string. 3-5 gap, bold muhim joylarda."
  );
}

interface PromptOptions {
  studentName: string;
  grade: number;
}

async function generateSubjectAll(
  subject: SubjectKey,
  input: SubjectInput,
  opts: PromptOptions,
): Promise<{ sections: SubjectSections; telemetry: RunTelemetry }> {
  const report = computeReport(input);
  const digest = subjectDigest(subject, report);
  const userPrompt =
    `Fan: ${digest.fan}. ${opts.grade}-sinf nomzodi (ism ATAMASIZ).\n\n` +
    `Statistika (JSON):\n${JSON.stringify(digest)}\n\n` +
    `Vazifa: bitta JSON obyekt qaytar. Kalit: \`diagnostika\`. Uning qiymati — 6-8 paragrafdan iborat uzun oqim ` +
    `matn (paragraflar bo'sh qatorlar bilan ajratilgan). Struktura tizim yo'riqnomasida ko'rsatilgan. Bola ismini eslatmang.`;
  const { obj, telemetry } = await callGeminiJson<Record<string, string>>(
    `${subject}.all`, subjectSystemPrompt(), userPrompt,
  );
  const story = (obj.diagnostika || "").trim();
  return {
    // The story now lives entirely in `diagnostika` — client only renders it
    // there (§1 "Bir qarashda"). Other per-graph slots stay empty so the
    // hasAiText() guards in the client keep those cards hidden.
    sections: {
      diagnostika: story,
      tahlil:      "",
      growth:      "",
      skills:      "",
      bloom:       "",
      reasoning:   subject === "MATH" ? "" : undefined,
    },
    telemetry,
  };
}

async function generateSummary(
  digests: Record<SubjectKey, ReturnType<typeof subjectDigest>>,
  composite: ReturnType<typeof computeComposite>,
  opts: PromptOptions,
): Promise<{ crossCutting: string; finalRecommendation: string; telemetry: RunTelemetry }> {
  const userPrompt =
    `${opts.grade}-sinf nomzodining 3 fan yakuniy tahlili (ism ATAMASIZ).\n\n` +
    `Statistika (JSON):\n${JSON.stringify({ subjects: digests, composite })}\n\n` +
    `Vazifa: JSON qaytar, kalitlar: crossCutting, finalRecommendation. ` +
    `Har biri 3-5 qisqa gap, muhim joylar **bold**. Ismini eslatmang.`;
  const { obj, telemetry } = await callGeminiJson<Record<string, string>>(
    "summary.all", summarySystemPrompt(), userPrompt,
  );
  return {
    crossCutting:         (obj.crossCutting || "").trim(),
    finalRecommendation:  (obj.finalRecommendation || "").trim(),
    telemetry,
  };
}

// ---- Next-level (A→B) roadmap generation ------------------------------------

function roadmapSystemPrompt() {
  return (
    "Siz Sodiq School o'quv rejalashtiruvchisisiz. Bir fan bo'yicha o'quvchining KEYINGI DARAJA (A dan B ga) mavzularini tuzasiz.\n\n" +
    STYLE_RULES +
    "\n\nSizga o'quvchining ZAIF mavzulari (bularni O'ZGARTIRMANG — ular alohida hal qilinadi) va keyingi darajaga ajratilgan oylar soni beriladi.\n\n" +
    "Qoidalar (majburiy):\n" +
    "- O'quvchi JORIY sinf dasturini to'liq (100%) o'zlashtirgan deb faraz qiling va faqat KEYINGI daraja (keyingi sinf yoki chuqurroq) mavzularini taklif qiling.\n" +
    "- Berilgan zaif mavzularni takrorlamang, yangi 'zaiflik' qo'shmang — bular kelajak mavzulari.\n" +
    "- Mavzular fan va sinfga qat'iy MOS bo'lsin. Aloqasiz yoki ma'nosiz mavzu YO'Q.\n" +
    "- `order` bilan mantiqiy ketma-ketlikda tartiblang (oson→murakkab).\n" +
    "- Har mavzu ~3-4 haftalik ish; mavzular soni ajratilgan oylarni to'ldirsin.\n\n" +
    "JSON qaytaring: { nextLevelTopics: [{topic, description, rationale, order}], focusDescriptions?: [{topic, description}] }.\n" +
    "focusDescriptions (ixtiyoriy) — faqat berilgan zaif mavzularni ota-onaga tushunarli qilib qayta ifodalash; yangi mavzu QO'SHMANG."
  );
}

function roadmapUserPrompt(ctx: RoadmapAiContext, approxTopics: number) {
  return (
    `Fan: ${SUBJECT_LABEL[ctx.subject]}. ${ctx.grade}-sinf o'quvchisi (ism ATAMASIZ).\n\n` +
    `Zaif mavzular (O'ZGARTIRMANG):\n${JSON.stringify(ctx.weakTopics)}\n\n` +
    `Keyingi darajaga ajratilgan vaqt: ${ctx.nextMonths} oy (~${approxTopics} ta mavzu).\n\n` +
    `Vazifa: ${ctx.grade}-sinfdan keyingi darajaga olib chiquvchi ~${approxTopics} ta mavzuni JSON'da bering. ` +
    `Struktura tizim yo'riqnomasida ko'rsatilgan.`
  );
}

async function generateSubjectRoadmap(
  subject: SubjectKey,
  input: SubjectInput,
  _opts: PromptOptions,
): Promise<{ roadmap: SubjectRoadmapAi; telemetry: RunTelemetry | null }> {
  const report = computeReport(input);
  const ctx = buildRoadmapAiContext(subject, report);
  // No spare months → no next-level work; skip the call to save tokens.
  if (ctx.nextMonths <= 0) {
    return { roadmap: { nextLevelTopics: [] }, telemetry: null };
  }
  const approxTopics = Math.max(1, Math.round(ctx.nextMonths / 1.5));
  const { obj, telemetry } = await callGeminiJson<SubjectRoadmapAi>(
    `${subject}.roadmap`, roadmapSystemPrompt(), roadmapUserPrompt(ctx, approxTopics), ROADMAP_SCHEMA,
  );
  return {
    roadmap: {
      nextLevelTopics: Array.isArray(obj.nextLevelTopics) ? obj.nextLevelTopics : [],
      focusDescriptions: Array.isArray(obj.focusDescriptions) ? obj.focusDescriptions : undefined,
    },
    telemetry,
  };
}

export interface GenerateInput {
  student: { fullName: string; grade: number };
  math: SubjectInput;
  english: SubjectInput;
  criticalThinking: SubjectInput;
  // Optional exam config so composite weights match what's saved to the DB
  // snapshot. Legacy callers omit it → equal-thirds fallback.
  gradingConfiguration?: unknown;
}

export interface GenerateOutput {
  narrative: AiNarrative;
  roadmap: AiRoadmap;
  usage: AiUsageSummary;
}

/**
 * Up to 7 Gemini calls total: 3 per-subject narratives + 3 per-subject
 * next-level roadmaps (skipped when a subject has no spare months) + 1
 * composite summary.
 */
export async function generateResultNarrative(input: GenerateInput): Promise<GenerateOutput> {
  const opts: PromptOptions = { studentName: input.student.fullName, grade: input.student.grade };

  const [math, english, ct, mathRoad, engRoad, ctRoad] = await Promise.all([
    generateSubjectAll("MATH", input.math, opts),
    generateSubjectAll("ENGLISH", input.english, opts),
    generateSubjectAll("CRITICAL_THINKING", input.criticalThinking, opts),
    generateSubjectRoadmap("MATH", input.math, opts),
    generateSubjectRoadmap("ENGLISH", input.english, opts),
    generateSubjectRoadmap("CRITICAL_THINKING", input.criticalThinking, opts),
  ]);

  const mathReport = computeReport(input.math);
  const englishReport = computeReport(input.english);
  const ctReport = computeReport(input.criticalThinking);
  const digests = {
    MATH: subjectDigest("MATH", mathReport),
    ENGLISH: subjectDigest("ENGLISH", englishReport),
    CRITICAL_THINKING: subjectDigest("CRITICAL_THINKING", ctReport),
  };
  const { weights: aiWeights, source: aiWeightsSource } = extractWeights(input.gradingConfiguration, input.student.grade);
  const composite = computeComposite({
    reports: { MATH: mathReport, ENGLISH: englishReport, CRITICAL_THINKING: ctReport },
    grade: input.student.grade,
    thresholds: DEFAULT_ADMISSION_THRESHOLDS,
    weights: aiWeightsSource === "exam" ? aiWeights : undefined,
  });
  const summary = await generateSummary(digests, composite, opts);

  const runs = [
    math.telemetry, english.telemetry, ct.telemetry, summary.telemetry,
    mathRoad.telemetry, engRoad.telemetry, ctRoad.telemetry,
  ].filter((r): r is RunTelemetry => r !== null);
  const promptTokens = runs.reduce((s, r) => s + r.promptTokens, 0);
  const completionTokens = runs.reduce((s, r) => s + r.completionTokens, 0);
  const costUsd = Number(
    ((promptTokens * COST_PER_1M_INPUT_USD + completionTokens * COST_PER_1M_OUTPUT_USD) / 1_000_000).toFixed(6),
  );

  return {
    narrative: {
      math:             math.sections,
      english:          english.sections,
      criticalThinking: ct.sections,
      summary:          { crossCutting: summary.crossCutting, finalRecommendation: summary.finalRecommendation },
    },
    roadmap: {
      math:             mathRoad.roadmap,
      english:          engRoad.roadmap,
      criticalThinking: ctRoad.roadmap,
    },
    usage: {
      model: MODEL,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd,
      generatedAt: new Date().toISOString(),
      runs,
    },
  };
}
