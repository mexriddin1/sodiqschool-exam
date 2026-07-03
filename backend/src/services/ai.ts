// DeepSeek narrative generator.
//
// One JSON-structured call per subject returns diagnostika/tahlil/growth
// /skills/bloom (+reasoning for math). Summary is one more call. Total: 4
// requests per result — half the round-trips of the earlier per-section
// version, and the model can now write each subject holistically instead of
// repeating student name and boilerplate across separate calls.

import { computeReport, computeComposite, DEFAULT_ADMISSION_THRESHOLDS, extractWeights } from "@sodiq/compute";
import type { SubjectInput, SubjectKey, SubjectReport } from "@sodiq/compute";

const COST_PER_1M_INPUT_USD = 0.27;
const COST_PER_1M_OUTPUT_USD = 1.1;

const API_BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const API_KEY  = process.env.DEEPSEEK_API_KEY ?? "";
const MODEL    = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

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

async function callDeepSeekJson<T extends Record<string, string>>(
  section: string,
  system: string,
  user: string,
): Promise<{ obj: T; telemetry: RunTelemetry }> {
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      // Enough room for ~5-6 sections × 4-5 sentences each without truncation.
      // Previous 1600 sometimes clipped the JSON so trailing keys came back
      // empty and the client rendered empty `.ai-narrative` cards.
      // 6-8 paragrafli hikoya ~1500 completion token'da chiqadi; 3200 —
      // JSON kesilishining oldini oladi va kelajakda uzunroq bo'lsa ham
      // yetadi.
      max_tokens: 3200,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${section} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  const json = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };
  const raw = json.choices[0]?.message?.content ?? "{}";
  let obj: T;
  try { obj = JSON.parse(raw) as T; } catch { obj = {} as T; }
  return {
    obj,
    telemetry: {
      section,
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
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
  const { obj, telemetry } = await callDeepSeekJson<Record<string, string>>(
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
  const { obj, telemetry } = await callDeepSeekJson<Record<string, string>>(
    "summary.all", summarySystemPrompt(), userPrompt,
  );
  return {
    crossCutting:         (obj.crossCutting || "").trim(),
    finalRecommendation:  (obj.finalRecommendation || "").trim(),
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
  usage: AiUsageSummary;
}

/** 4 DeepSeek calls total: one per subject + one composite summary. */
export async function generateResultNarrative(input: GenerateInput): Promise<GenerateOutput> {
  const opts: PromptOptions = { studentName: input.student.fullName, grade: input.student.grade };

  const [math, english, ct] = await Promise.all([
    generateSubjectAll("MATH", input.math, opts),
    generateSubjectAll("ENGLISH", input.english, opts),
    generateSubjectAll("CRITICAL_THINKING", input.criticalThinking, opts),
  ]);

  const mathReport = computeReport(input.math);
  const englishReport = computeReport(input.english);
  const ctReport = computeReport(input.criticalThinking);
  const digests = {
    MATH: subjectDigest("MATH", mathReport),
    ENGLISH: subjectDigest("ENGLISH", englishReport),
    CRITICAL_THINKING: subjectDigest("CRITICAL_THINKING", ctReport),
  };
  const { weights: aiWeights, source: aiWeightsSource } = extractWeights(input.gradingConfiguration);
  const composite = computeComposite({
    reports: { MATH: mathReport, ENGLISH: englishReport, CRITICAL_THINKING: ctReport },
    grade: input.student.grade,
    thresholds: DEFAULT_ADMISSION_THRESHOLDS,
    weights: aiWeightsSource === "exam" ? aiWeights : undefined,
  });
  const summary = await generateSummary(digests, composite, opts);

  const runs = [math.telemetry, english.telemetry, ct.telemetry, summary.telemetry];
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
