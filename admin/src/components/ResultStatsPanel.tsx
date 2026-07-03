"use client";

import { useMemo } from "react";
import { computeReport, scoreBand } from "@sodiq/compute/compute";
import { computeComposite, DEFAULT_ADMISSION_THRESHOLDS, extractWeights } from "@sodiq/compute/composite";
import type { Question } from "./QuestionGridEditor";
import type { VerdictLabel, VerdictOverride } from "./ManualContentEditor";

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";

const VERDICT_COLORS: Record<VerdictLabel, string> = {
  "QABUL TAVSIYA ETILADI": "#2F9E6B",
  "QABUL QILINSIN": "#2F9E6B",
  "SHARTLI QABUL": "#C98A12",
  "NAVBATDA": "#FF8A32",
  "TAYYOR EMAS": "#D2503F",
  "STRONG ADMIT": "#2F9E6B",
  "ADMIT": "#2F9E6B",
  "CONDITIONAL ADMIT": "#C98A12",
  "WAITLIST": "#FF8A32",
  "NOT YET READY": "#D2503F",
};

const VERDICT_SUBS: Record<VerdictLabel, string> = {
  "QABUL TAVSIYA ETILADI": "Yuqori daraja — maktabga qabul tavsiya etiladi",
  "QABUL QILINSIN": "Ishonchli daraja — qabul tavsiya etiladi",
  "SHARTLI QABUL": "Rivojlanayotgan daraja — shartli qabul",
  "NAVBATDA": "Shakllanayotgan daraja — navbatda",
  "TAYYOR EMAS": "Tamal bosqich — avval tayyorgarlik kerak",
  "STRONG ADMIT": "Yuqori daraja — maktabga qabul tavsiya etiladi",
  "ADMIT": "Ishonchli daraja — qabul tavsiya etiladi",
  "CONDITIONAL ADMIT": "Rivojlanayotgan daraja — shartli qabul",
  "WAITLIST": "Shakllanayotgan daraja — navbatda",
  "NOT YET READY": "Tamal bosqich — avval tayyorgarlik kerak",
};

const SUBJECT_LABEL: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

interface Props {
  subjects: Record<SubjectKey, Question[]>;
  grade: number | null;
  admissionThresholds?: Record<string, { math: number; ct: number; en: number }> | null;
  // exam.gradingConfiguration — composite weights read from here.
  gradingConfiguration?: unknown;
  // If provided, admin can override the auto-computed verdict inline.
  verdictOverride?: VerdictOverride | null;
  onVerdictOverrideChange?: (next: VerdictOverride | null) => void;
}

function makeMeta(subject: SubjectKey, grade: number, questions: Question[]) {
  const totalQuestions = questions.length;
  const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 0), 0);
  return {
    school: "Sodiq School",
    slogan: "Biz ilmga sodiqmiz",
    office: "Academic Assessment Office",
    candidate: "",
    grade,
    gradeLabel: `${grade}-sinfga nomzod`,
    subject: SUBJECT_LABEL[subject],
    totalQuestions,
    totalMarks,
    brand: { navy: "#06113C", orange: "#FF8A32" },
  };
}

// Live per-subject + composite computation. Renders "—" when subjects are
// empty or unscored questions block a real number.
export default function ResultStatsPanel({ subjects, grade, admissionThresholds, gradingConfiguration, verdictOverride, onVerdictOverrideChange }: Props) {
  const stats = useMemo(() => {
    if (grade == null) return null;
    const keys: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
    // Skip if any subject has zero questions.
    for (const k of keys) if (subjects[k].length === 0) return null;

    // Count unscored so the panel can warn about them.
    let unscored = 0;
    for (const k of keys) for (const q of subjects[k]) if (!q.result) unscored++;

    // Sanitize: cast unscored questions to "Noto'g'ri" for computation
    // purposes so we get a coherent live view. The panel labels these as
    // "unscored" separately.
    const perSubject = {} as Record<SubjectKey, ReturnType<typeof computeReport>>;
    for (const k of keys) {
      const safe = subjects[k].map((q): Question => (
        q.result ? q : { ...q, result: "Noto'g'ri", earned: 0 }
      ));
      perSubject[k] = computeReport({
        meta: makeMeta(k, grade, safe),
        questions: safe as Parameters<typeof computeReport>[0]["questions"],
        realData: { percentile: null, cohortAverage: null, avgTimeSec: null },
      });
    }
    const { weights: livWeights, source: livWeightsSource } = extractWeights(gradingConfiguration, grade ?? undefined);
    const composite = computeComposite({
      reports: perSubject,
      grade,
      thresholds: (admissionThresholds ?? DEFAULT_ADMISSION_THRESHOLDS) as Parameters<typeof computeComposite>[0]["thresholds"],
      weights: livWeightsSource === "exam" ? livWeights : undefined,
    });
    return { perSubject, composite, unscored };
  }, [subjects, grade, admissionThresholds, gradingConfiguration]);

  if (grade == null) {
    return <div className="text-sm text-gray-500 p-4">O'quvchi tanlangach statistika ko'rinadi.</div>;
  }
  if (!stats) {
    return <div className="text-sm text-gray-500 p-4">Uchala fan uchun kamida bitta savol import qiling.</div>;
  }

  const { perSubject, composite, unscored } = stats;

  // Effective verdict: admin override wins over auto.
  const effective = verdictOverride
    ? {
        label: verdictOverride.label,
        sub: verdictOverride.sub || VERDICT_SUBS[verdictOverride.label],
        color: VERDICT_COLORS[verdictOverride.label],
        isOverride: true,
      }
    : {
        label: composite.verdict.label,
        sub: composite.verdict.sub,
        color: composite.verdict.color,
        isOverride: false,
      };
  const verdictColor = effective.color;

  return (
    <div className="space-y-3">
      {unscored > 0 && (
        <div className="bg-warn/10 text-warn text-sm p-2 rounded flex items-start gap-2">
          <span>⚠️</span>
          <div>
            <b>{unscored} ta savol hali baholanmagan.</b>{" "}
            Quyidagi statistika baholanmagan savollarni "Noto'g'ri" deb hisoblab ko'rsatadi.
            Yakuniy hisob-kitob har bir savolni belgilagach to'g'ri bo'ladi.
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(perSubject) as SubjectKey[]).map((k) => {
          const r = perSubject[k];
          return (
            <div key={k} className="card p-3">
              <div className="text-xs uppercase text-gray-500">{SUBJECT_LABEL[k]}</div>
              <div className="flex items-baseline gap-1 mt-1">
                <div className="text-2xl font-semibold" style={{ color: r.band.color }}>{r.percent}</div>
                <div className="text-gray-400 text-sm">/100</div>
              </div>
              <div className="text-xs mt-1">
                <span className="badge" style={{ background: r.band.color + "1A", color: r.band.color }}>
                  {r.band.label}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                To'g'ri: {r.correctCount}/{r.totalQuestions} · Salohiyat: <b>{r.potential}</b>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 border-l-4" style={{ borderLeftColor: verdictColor }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase text-gray-500">Uch fan o'rtachasi</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-semibold" style={{ color: composite.compBand.color }}>
                {composite.composite}
              </span>
              <span className="text-gray-400">/100</span>
              <span className="badge ml-2" style={{ background: composite.compBand.color + "1A", color: composite.compBand.color }}>
                {composite.compBand.label}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Salohiyat o'rtachasi: <b>{composite.compPotential}</b> · Tuzatilgan: <b>{composite.compAdjusted}</b>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase text-gray-500 flex items-center justify-end gap-2">
              Qabul qarori
              {effective.isOverride && (
                <span className="badge bg-navy text-white text-[10px]">Qo'lda</span>
              )}
            </div>
            <div className="mt-1 px-4 py-2 rounded text-white font-semibold text-lg" style={{ background: verdictColor }}>
              {effective.label}
            </div>
            <div className="text-xs text-gray-500 mt-1 max-w-[280px]">{effective.sub}</div>
            {onVerdictOverrideChange && (
              <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                <label className="text-gray-500">Qo'lda o'zgartirish:</label>
                <select
                  className="input py-1 text-xs w-auto"
                  value={verdictOverride?.label ?? ""}
                  onChange={(e) => {
                    const label = e.target.value as VerdictLabel | "";
                    if (!label) onVerdictOverrideChange(null);
                    else onVerdictOverrideChange({ label, sub: verdictOverride?.sub ?? "" });
                  }}
                >
                  <option value="">— Avtomatik —</option>
                  <option value="QABUL TAVSIYA ETILADI">Qabul tavsiya etiladi</option>
                  <option value="QABUL QILINSIN">Qabul qilinsin</option>
                  <option value="SHARTLI QABUL">Shartli qabul</option>
                  <option value="NAVBATDA">Navbatda</option>
                  <option value="TAYYOR EMAS">Tayyor emas</option>
                </select>
              </div>
            )}
            {effective.isOverride && (
              <div className="text-xs text-gray-500 mt-1">
                Avtomatik: <span className="font-medium">{composite.verdict.label}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-xs">
          {(Object.keys(composite.perSubjectGate) as SubjectKey[]).map((k) => {
            const g = composite.perSubjectGate[k];
            return (
              <div key={k} className="flex items-center justify-between">
                <span className="text-gray-500">{SUBJECT_LABEL[k]}</span>
                <span className={g.passed ? "text-good" : "text-bad"}>
                  {g.percent}% {g.passed ? "≥" : "<"} {g.threshold}% {g.passed ? "✓" : "✗"}
                </span>
              </div>
            );
          })}
        </div>

        {!composite.gateAllPassed && (
          <div className="mt-2 text-xs text-bad">
            Bir yoki bir nechta fan minimal chegaradan past — qabul qarori "TAYYOR EMAS".
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export the scoreBand for callers who want per-value band lookups.
export { scoreBand };
