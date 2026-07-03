"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { EMPTY_MANUAL, ManualContent, fromApi, toApi } from "@/components/ManualContentEditor";
import QuestionGridEditor, { Question } from "@/components/QuestionGridEditor";
import ResultStatsPanel from "@/components/ResultStatsPanel";
import { Icon } from "@/components/Icon";

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
const SUBJECT_LABEL: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ResultDetail {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  manualContent: unknown;
  student?: { grade?: number } | null;
  exam?: {
    admissionThresholds?: Record<string, { math: number; ct: number; en: number }>;
    gradingConfiguration?: unknown;
  } | null;
  subjects: {
    subject: SubjectKey;
    totalQuestions: number;
    totalMarks: number;
    questions: Question[];
    realData: Record<string, unknown> | null;
    manualNotes: Record<string, unknown> | null;
  }[];
}

export default function ResultEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [r, setR] = useState<ResultDetail | null>(null);
  const [subjects, setSubjects] = useState<Record<SubjectKey, Question[]>>({
    MATH: [], ENGLISH: [], CRITICAL_THINKING: [],
  });
  const [manual, setManual] = useState<ManualContent>(EMPTY_MANUAL);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    api<ResultDetail>(`/api/admin/results/${params.id}`).then((d) => {
      setR(d);
      const map: Record<SubjectKey, Question[]> = { MATH: [], ENGLISH: [], CRITICAL_THINKING: [] };
      for (const s of d.subjects) map[s.subject] = s.questions ?? [];
      setSubjects(map);
      setManual(fromApi(d.manualContent));
    });
  }, [params.id]);

  useEffect(load, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const subjectArr = (Object.keys(subjects) as SubjectKey[]).map((k) => {
        if (subjects[k].length === 0) throw new Error(`${SUBJECT_LABEL[k]}: kamida bitta savol kerak.`);
        const unscored = subjects[k].filter((q) => !q.result);
        if (unscored.length > 0) {
          const ids = unscored.slice(0, 5).map((q) => q.id).join(", ");
          throw new Error(`${SUBJECT_LABEL[k]}: ${unscored.length} ta savol baholanmagan (${ids}${unscored.length > 5 ? ", …" : ""}).`);
        }
        return { subject: k, questions: subjects[k] };
      });
      await api(`/api/admin/results/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          manualContent: toApi(manual),
          subjects: subjectArr,
        }),
      });
      router.push(`/results/${params.id}`);
    } catch (e) {
      const msg = e instanceof ApiException
        ? `${e.error.message}${e.error.fields ? "\n" + Object.entries(e.error.fields).map(([k, v]) => `• ${k}: ${v}`).join("\n") : ""}`
        : e instanceof Error ? e.message : "Saqlashda xato";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  if (!r) return <div className="text-gray-500">Yuklanmoqda…</div>;
  if (r.status === "ARCHIVED")
    return <div className="text-bad">Arxivlangan natijani tahrirlab bo'lmaydi.</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-6xl">
      <Link href={`/results/${params.id}`} className="text-sm text-navy hover:underline">← Natija</Link>
      <h1 className="text-2xl font-semibold text-navy">Natijani tahrirlash</h1>

      {r.status === "PUBLISHED" && (
        <div className="card p-3 bg-warn/10 text-warn text-sm">
          Diqqat: bu natija nashr etilgan. O'zgartirishlardan keyin qaytadan nashr eting.
        </div>
      )}

      {(Object.keys(SUBJECT_LABEL) as SubjectKey[]).map((k) => (
        <div key={k} className="card p-4 space-y-3">
          <div className="font-medium">{SUBJECT_LABEL[k]}</div>
          <QuestionGridEditor
            value={subjects[k]}
            onChange={(qs) => setSubjects({ ...subjects, [k]: qs })}
            subject={k}
            grade={r.student?.grade ?? null}
            apiBase={API_BASE}
            mode="result"
          />
        </div>
      ))}

      <div className="card p-4 space-y-3 bg-navy/5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Jonli statistika va qabul qarori</h2>
          <span className="text-xs text-gray-500">Har bir savolni belgilaganingizda avtomatik yangilanadi</span>
        </div>
        <ResultStatsPanel
          subjects={subjects}
          grade={r.student?.grade ?? null}
          admissionThresholds={r.exam?.admissionThresholds ?? null}
          gradingConfiguration={r.exam?.gradingConfiguration}
          verdictOverride={manual.summary.verdictOverride}
          onVerdictOverrideChange={(next) =>
            setManual({ ...manual, summary: { ...manual.summary, verdictOverride: next } })
          }
        />
      </div>

      {error && <pre className="text-sm text-bad whitespace-pre-wrap">{error}</pre>}

      <div className="flex gap-2">
        <button className="btn-primary inline-flex items-center gap-2" disabled={pending} type="submit">
          <Icon name="save" size={16} /> {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <Link href={`/results/${params.id}`} className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
