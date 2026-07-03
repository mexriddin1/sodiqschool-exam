// Roadmap builder for Matematika. v2: driven by weak-area extraction +
// prerequisite graph + curated resource catalog + realistic weekly plan.
// The heavy lifting lives in @sodiq/compute/roadmap-v2 — this file just
// adapts its output to the StageDetail.astro shape.
//
// NOTE: ASCII apostrophes only (o', g') per brand guide → strings use backticks.
import { BAND_COLORS } from '@sodiq/compute/compute';
import { buildRoadmapV2 } from '@sodiq/compute/roadmap-v2';

const RESOURCE_TYPE_LABELS = {
  video: 'Video',
  channel: 'Kanal',
  platform: 'Platforma',
  book: 'Kitob',
  app: 'Ilova',
};

function priorityForStage(idx) {
  if (idx === 0) return { label: 'Yuqori', color: BAND_COLORS.bad };
  if (idx === 1) return { label: `O'rta-yuqori`, color: BAND_COLORS.orange };
  return { label: `O'rta`, color: BAND_COLORS.ok };
}

function confidenceForStage(idx) {
  if (idx === 0) return { label: 'Yuqori', color: BAND_COLORS.good };
  return { label: `O'rta`, color: BAND_COLORS.ok };
}

// A "focus item" from roadmap-v2 → concise action bullet on the stage card.
function focusToAction(f) {
  const dose = f.weak.severity >= 50
    ? `${f.weak.percent}/100 · haftada 5 soat`
    : f.weak.severity >= 30
    ? `${f.weak.percent}/100 · haftada 3–4 soat`
    : `${f.weak.percent}/100 · haftada 2 soat`;
  return { do: `${f.canonicalTopic} bo'yicha bo'shliqni yopish`, dose };
}

// Roles are stable per stage — parent supervises, teacher targets, student
// commits. We personalise them by injecting the first focus topic where
// possible so they don't feel generic.
function rolesForStage(stage) {
  const firstTopic = stage.focusItems[0]?.canonicalTopic ?? 'asosiy mavzu';
  return {
    parent: [
      `Kunlik 20–30 daqiqa mashqni kalendarga kiriting va bajarilishini kuzating`,
      `Haftada bir marta "xato-daftar" ustida farzandingiz bilan gaplashing`,
      `Rag'batlantirish uchun bosqich yakunida kichik nishonlash marosimini uyushtiring`,
    ],
    teacher: [
      `${firstTopic} bo'yicha darsda maqsadli 10 daqiqa ajratish`,
      `Har 2 haftada mini-diagnostika o'tkazib, o'zlashtirishni o'lchash`,
      `Prerequisite mavzular yaxshi mustahkamlanganligini tekshirish`,
    ],
    student: [
      `Kuniga 20–30 daqiqa muntazam mashq qilaman (kalendarga yozib qo'yaman)`,
      `Har hafta xato-daftariga xatolarimni yozib, keyingi haftada qaytariladigan qilib qo'yaman`,
      `Mini-testda ≥85% olmaguncha mavzuni "yopiq" deb hisoblamayman`,
    ],
  };
}

function stageToProgram(stage, idx, m0) {
  const prio = priorityForStage(idx);
  const scale = stage.targetScore;
  const totalHours = stage.weekPlan.reduce((s, w) => s + w.hours, 0);
  const focusTitles = stage.focusItems.map((f) => f.canonicalTopic);
  const baselineLabel = focusTitles[0] ?? 'Umumiy diagnostika';
  const baselineVal = stage.focusItems[0]?.weak.percent ?? m0;

  // Legacy resources shape (exercises/books/platforms/videos) + new richer
  // block. StageDetail reads either.
  const flat = stage.focusItems.flatMap((f) => f.resources);
  const byType = {
    exercises: flat.filter((r) => r.type === 'app' || r.type === 'platform')
      .map((r) => `${r.title}${r.provider ? ` (${r.provider})` : ''}`),
    books: flat.filter((r) => r.type === 'book').map((r) => `${r.title}${r.provider ? ` — ${r.provider}` : ''}`),
    platforms: flat.filter((r) => r.type === 'platform').map((r) => `${r.title}${r.provider ? ` — ${r.provider}` : ''}`),
    videos: flat.filter((r) => r.type === 'video' || r.type === 'channel').map((r) => `${r.title}${r.provider ? ` (${r.provider})` : ''}`),
  };

  const actions = stage.focusItems.length > 0
    ? stage.focusItems.slice(0, 4).map(focusToAction)
    : [
        { do: `Mavjud mavzularni spiral takror`, dose: `haftada 2–3 soat` },
        { do: `Aralash mashqlar bilan mustahkamlash`, dose: `haftada 1 mini-test` },
      ];

  // Weekly plan → StageDetail's period/focus/task shape. Group weeks by
  // topic block so the timeline reads naturally.
  const weekPlan = stage.weekPlan.map((w) => ({
    period: `${w.week}-hafta`,
    focus: w.focusTopic,
    task: w.microTask,
  }));

  const kpis = stage.focusItems.length > 0
    ? stage.focusItems.map((f) => `${f.canonicalTopic}: ${f.weak.percent} → ≥${Math.min(100, f.weak.percent + 15)}`)
    : [`Umumiy ball: ${scale.from} → ${scale.to}`];

  const criteria = [
    `Bosqich yakunida mini-testda ≥85% aniqlik`,
    `Har haftada rejalashtirilgan 4–5 soat mashq bajarilgan`,
    `Xato-daftar to'ldirilgan va oxirgi haftada qaytadan ko'rilgan`,
  ];

  const closing = stage.focusItems.length > 0
    ? `${stage.focusItems.map((f) => f.canonicalTopic).join(', ')} bo'yicha ko'nikma mustahkamlanadi; umumiy ball ~${scale.to} ga siljiydi.`
    : `Bola darajani ushlab turadi va umumiy ballni ~${scale.to} ga ko'taradi.`;

  return {
    num: 10 + idx + 1,
    months: stage.months,
    range: stage.range,
    phase: `${stage.num}-bosqich · ${stage.range}`,
    title: stage.title,
    mission: stage.mission,
    actions,
    road: {
      label: focusTitles[0] ?? `Umumiy ball`,
      gain: { from: baselineVal, to: Math.min(100, baselineVal + 20) },
      note: stage.weeklyHours,
    },
    priority: prio,
    baseline: { label: baselineLabel, val: baselineVal, color: BAND_COLORS.bad },
    target: { label: `Maqsad`, val: `≥${scale.to}`, color: BAND_COLORS.green },
    overall: { from: scale.from, to: scale.to },
    weeklyHours: stage.weeklyHours,
    monthlyHours: `~${Math.round(totalHours / stage.months)} soat`,
    totalHours: `~${totalHours} soat`,
    growthBars: [
      ...stage.focusItems.slice(0, 2).map((f) => ({
        label: f.canonicalTopic,
        from: f.weak.percent,
        to: Math.min(100, f.weak.percent + 15),
        color: BAND_COLORS.bad,
      })),
      { label: `Umumiy ball`, from: scale.from, to: scale.to, color: BAND_COLORS.ok },
    ],
    goal: stage.mission,
    outcome: closing,
    topics: focusTitles,
    // Prerequisite topics collated across the stage's focus items.
    prerequisites: [...new Set(stage.focusItems.flatMap((f) => f.prerequisites))],
    skills: stage.focusItems.length > 0
      ? [
          `${focusTitles[0]} bo'yicha protsedural ravonlik`,
          `Xato-daftar odati`,
          `Javobni tekshirish ko'nikmasi`,
          `Muntazam mustaqil mashq`,
        ]
      : [`Spiral takror ko'nikmasi`, `Mustaqil mashq odati`],
    weekPlan,
    checkpoints: [
      { label: `${Math.max(1, Math.floor(stage.months / 2))}-oy`, lines: ['Oraliq', 'diagnostika'] },
      { label: `${stage.months}-oy`, lines: ['Bosqich', 'yakuni'] },
    ],
    resources: byType,
    // Rich, categorised resources for the v2 block. Each entry has type/title/
    // provider/url/note so StageDetail can render clickable UZ + EN chips.
    resourceCatalog: stage.focusItems.map((f) => ({
      topic: f.canonicalTopic,
      items: f.resources.map((r) => ({
        ...r,
        typeLabel: RESOURCE_TYPE_LABELS[r.type] ?? r.type,
      })),
    })),
    // Rationale strings per focus item — WHY this is in the plan.
    rationale: stage.focusItems.map((f) => ({
      topic: f.canonicalTopic,
      text: f.rationale,
      prerequisites: f.prerequisites,
    })),
    roles: rolesForStage(stage),
    criteria,
    kpis,
    smart: `${stage.months} oy ichida ${focusTitles.slice(0, 2).join(' va ')} bo'yicha ${baselineVal} dan kamida ${Math.min(100, baselineVal + 15)} ga ko'tarish; haftada ${stage.weeklyHours} muntazam mashq va oxirida mini-diagnostika orqali.`,
    risks: [
      { risk: `Mashq muntazam bo'lmasligi`, mitigation: `Kalendar + eslatma + qisqa sessiya (20–30 daq)` },
      { risk: `Prerequisitelar zaif bo'lib qolishi`, mitigation: `Har mavzu boshida 2–3 kunlik "aql tushirish" bilan asosini takrorlash` },
    ],
    closing,
    confidence: confidenceForStage(idx),
  };
}

// Generic builder — used directly by MATH callers (buildPrograms) and via
// programs-en.js / programs-ct.js wrappers for the other subjects. The
// subject key determines which prereq graph and resource catalog the
// roadmap-v2 engine looks in.
export function buildProgramsFor(subject, r) {
  const roadmap = buildRoadmapV2(subject, r);
  // Drop stages with no actual work — a strong student shouldn't see three
  // empty roadmap cards. If every stage is empty (perfect score) the UI
  // hides the roadmap section entirely.
  return roadmap.stages
    .map((stage, idx) => ({ stage, idx }))
    .filter(({ stage }) => stage.focusItems.length > 0 && stage.weekPlan.length > 0)
    .map(({ stage, idx }) => stageToProgram(stage, idx, roadmap.overallScore));
}

export function buildSkillGrowthFor(subject, r) {
  const roadmap = buildRoadmapV2(subject, r);
  const focus = roadmap.stages[0]?.focusItems.slice(0, 2) ?? [];
  const gf = r.growthForecast.map((g) => g.v);
  return [
    { name: 'Umumiy ball', color: '#06113C', points: gf.length === 4 ? gf : [r.percent, r.percent + 5, r.percent + 12, r.percent + 20] },
    ...focus.map((f, i) => ({
      name: f.canonicalTopic,
      color: i === 0 ? '#FF8A32' : '#3266C9',
      points: [
        f.weak.percent,
        Math.min(100, f.weak.percent + 8),
        Math.min(100, f.weak.percent + 18),
        Math.min(100, f.weak.percent + 25),
      ],
    })),
  ];
}

// Backwards-compatible MATH-specific exports (index.astro calls these).
export function buildPrograms(r) { return buildProgramsFor('MATH', r); }
export function buildSkillGrowth(r) { return buildSkillGrowthFor('MATH', r); }
