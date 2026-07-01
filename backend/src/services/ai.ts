// DeepSeek narrative generator.
//
// One JSON-structured call per subject returns diagnostika/tahlil/growth
// /skills/bloom (+reasoning for math). Summary is one more call. Total: 4
// requests per result — half the round-trips of the earlier per-section
// version, and the model can now write each subject holistically instead of
// repeating student name and boilerplate across separate calls.

import { computeReport, computeComposite, DEFAULT_ADMISSION_THRESHOLDS } from "@sodiq/compute";
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
      max_tokens: 2600,
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
  "- HAR bo'lim: 1-2 qisqa xatboshi, jami 3-5 gap. Uzun matn taqiqlanadi.\n" +
  "- Farzandning ismini AYTMANG. \"Farzandingiz\", \"bola\" yoki umumiy tarzda yozing.\n" +
  "- Muhim raqamlar va tushunchalarni **markdown bold** bilan belgilang: masalan **72%**, **texnik xato**, **trigonometriya**.\n" +
  "- Faktik, aniq, harakatga chorlaydigan gaplar. Xushmuomala, lekin haddan tashqari maqtash yo'q.\n" +
  "- Sarlavha yo'q, ro'yxat yo'q — faqat oqib boradigan matn.\n" +
  "- Statistikadan tashqari fakt to'qib chiqarmang. Berilgan raqamlargacha rioya qiling.";

function subjectSystemPrompt() {
  return (
    "Siz Sodiq School Academic Assessment Office'ning tajribali diagnostika analitigisiz. " +
    "Ota-ona uchun aniq, qisqa va faktik xulosalar yozasiz.\n\n" +
    STYLE_RULES +
    "\n\nSizga JSON statistika beriladi. Siz JSON obyekt qaytarasiz, quyidagi kalitlar bilan:\n" +
    "- diagnostika: §I Diagnostika uchun. Umumiy ball va band, kuchli va zaif tomon.\n" +
    "- tahlil: §II Tahlil uchun. Xato tabiati (**texnik** vs **bilim bo'shlig'i**), 1-2 aniq mavzu.\n" +
    "- growth: §III Rivojlanish yo'li uchun. 3, 6, 12 oy uchun aniq amaliy qadam va kutilayotgan o'sish.\n" +
    "- skills: §Ko'nikmalar profili uchun. Radar'dagi eng kuchli va eng zaif ko'nikma, ular ustida qanday ishlash.\n" +
    "- bloom: §Fikrlash darajalari uchun. Qaysi Bloom darajasida kuchli/zaif, o'sish uchun tavsiya.\n" +
    "Faqat matematika uchun qo'shiling: reasoning: §Fikrlash turlari uchun. Deduktiv/induktiv/analitik/fazoviy fikrlashning kuchli va zaif tomonlari.\n\n" +
    "Har kalit — string tipida, matn HAR doim 3-5 qisqa gap, muhim raqamlar **bold**."
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
  const askReasoning = subject === "MATH" ? "\n- reasoning" : "";
  const userPrompt =
    `Fan: ${digest.fan}. ${opts.grade}-sinf nomzodi (ism ATAMASIZ).\n\n` +
    `Statistika (JSON):\n${JSON.stringify(digest)}\n\n` +
    `Vazifa: quyidagi kalitlar bilan JSON qaytar:\n` +
    `- diagnostika\n- tahlil\n- growth\n- skills\n- bloom${askReasoning}\n\n` +
    `Har kalit 3-5 qisqa gap, muhim raqamlar **bold**. Ismini eslatmang.`;
  const { obj, telemetry } = await callDeepSeekJson<Record<string, string>>(
    `${subject}.all`, subjectSystemPrompt(), userPrompt,
  );
  return {
    sections: {
      diagnostika: (obj.diagnostika || "").trim(),
      tahlil:      (obj.tahlil      || "").trim(),
      growth:      (obj.growth      || "").trim(),
      skills:      (obj.skills      || "").trim(),
      bloom:       (obj.bloom       || "").trim(),
      reasoning:   subject === "MATH" ? (obj.reasoning || "").trim() : undefined,
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
  const composite = computeComposite({
    reports: { MATH: mathReport, ENGLISH: englishReport, CRITICAL_THINKING: ctReport },
    grade: input.student.grade,
    thresholds: DEFAULT_ADMISSION_THRESHOLDS,
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
