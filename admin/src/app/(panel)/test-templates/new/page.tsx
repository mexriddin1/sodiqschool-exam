"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import QuestionGridEditor, { Question } from "@/components/QuestionGridEditor";
import { Icon } from "@/components/Icon";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Full exam shape we need for the grade filter. `grades[]` is authoritative;
// `grade` is the legacy single-value column and only used as a fallback.
interface ExamOption {
  id: string;
  title: string;
  grade: number;
  grades?: number[];
  status: string;
}

/** Grades this exam allows a template to target. */
function allowedGradesFor(ex: ExamOption): number[] {
  if (Array.isArray(ex.grades) && ex.grades.length > 0) return ex.grades;
  return [ex.grade];
}

export default function NewTestTemplatePage() {
  const router = useRouter();
  const search = useSearchParams();
  // ?examId=… → scope the new template to that exam. ?subject=…&grade=… →
  // pre-populate the pickers when the admin lands from an exam's page.
  const paramExamId = search.get("examId");
  const paramSubject = search.get("subject") as "MATH" | "ENGLISH" | "CRITICAL_THINKING" | null;
  const paramGrade = Number(search.get("grade")) || null;
  const [subject, setSubject] = useState<"MATH" | "ENGLISH" | "CRITICAL_THINKING">(paramSubject ?? "MATH");
  const [grade, setGrade] = useState<number | null>(paramGrade);
  const [name, setName] = useState("");
  const [examId, setExamId] = useState<string>(paramExamId ?? "");
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setExamsLoading(true);
    api<{ items: ExamOption[] }>(`/api/admin/exams?take=200`)
      .then((d) => setExams(d.items ?? []))
      .catch(() => undefined)
      .finally(() => setExamsLoading(false));
  }, []);

  // Grades the currently-selected exam permits. When examId is empty we show
  // no grade options at all — force the admin to pick an exam first so the
  // template can't drift into an unrelated grade.
  const selectedExam = useMemo(() => exams.find((e) => e.id === examId) ?? null, [exams, examId]);
  const allowedGrades = useMemo(() => (selectedExam ? allowedGradesFor(selectedExam) : []), [selectedExam]);

  // Whenever the exam changes, if the previously-picked grade is no longer
  // in the exam's allowed list, clear it. Auto-pick the first grade when
  // there's only one option so the admin doesn't have to click again.
  useEffect(() => {
    if (!selectedExam) return;
    if (grade != null && !allowedGrades.includes(grade)) {
      setGrade(allowedGrades.length === 1 ? allowedGrades[0]! : null);
      return;
    }
    if (grade == null && allowedGrades.length === 1) {
      setGrade(allowedGrades[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, allowedGrades.join(",")]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (!examId) throw new Error("Imtihon tanlang. Test shabloni majburiy bir imtihonga bog'lanadi.");
      if (grade == null) throw new Error("Sinf tanlang.");
      if (selectedExam && !allowedGrades.includes(grade)) {
        throw new Error(`${grade}-sinf tanlangan imtihon uchun ruxsat etilmagan.`);
      }
      if (questions.length === 0) throw new Error("Kamida bitta savol kerak.");
      const r = await api<{ id: string }>("/api/admin/test-templates", {
        method: "POST",
        body: JSON.stringify({ subject, grade, name: name.trim(), questions, examId }),
      });
      router.push(paramExamId ? `/test-templates/exam/${paramExamId}` : `/test-templates/${r.id}`);
    } catch (e) {
      if (e instanceof ApiException) {
        const fields = e.error.fields;
        const detail = fields && Object.keys(fields).length > 0
          ? "\n" + Object.entries(fields).map(([k, v]) => `  ${k}: ${v}`).join("\n")
          : "";
        setError(e.error.message + detail);
      } else {
        setError(e instanceof Error ? e.message : "Saqlashda xato");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-6xl">
      <Link
        href={paramExamId ? `/test-templates/exam/${paramExamId}` : "/test-templates"}
        className="text-sm text-navy hover:underline"
      >
        ← {paramExamId ? "Imtihon shablonlariga qaytish" : "Test shablonlari"}
      </Link>
      <h1 className="text-2xl font-semibold text-navy">Yangi test shabloni</h1>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="label">Imtihon <span className="text-bad">*</span></label>
          <select
            className="input"
            required
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={!!paramExamId || examsLoading}
          >
            <option value="">{examsLoading ? "Yuklanmoqda…" : "— Tanlang —"}</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} · {allowedGradesFor(ex).map((g) => `${g}`).join("/")}-sinf · {ex.status}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            Har test shabloni majburiy bir imtihonga bog'lanadi.
          </div>
        </div>
        <div>
          <label className="label">Fan</label>
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value as typeof subject)}>
            <option value="MATH">Matematika</option>
            <option value="ENGLISH">Ingliz tili</option>
            <option value="CRITICAL_THINKING">Tanqidiy fikrlash</option>
          </select>
        </div>
        <div>
          <label className="label">Sinf</label>
          <select
            className="input"
            value={grade ?? ""}
            onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}
            disabled={!examId || allowedGrades.length === 0}
          >
            <option value="">
              {!examId ? "Avval imtihon" : allowedGrades.length === 0 ? "—" : "— Tanlang —"}
            </option>
            {allowedGrades.map((g) => (
              <option key={g} value={g}>{g}-sinf</option>
            ))}
          </select>
          {examId && allowedGrades.length === 0 && (
            <div className="text-xs text-warn mt-1">Bu imtihonda sinflar ro'yxati bo'sh.</div>
          )}
        </div>
        <div className="col-span-full">
          <label className="label">Shablon nomi</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="masalan: 5-sinf Ingliz tili testi" />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="text-sm text-gray-600">
          Bu yerda faqat <b>savol strukturasi</b> kiritiladi: ID, ball, qiyinlik, bo'lim, mavzu, ko'nikma, Bloom, fikrlash, sinf, framework.
          Per-o'quvchi natija (to'g'ri/noto'g'ri, olgan ball, izoh) natija sahifasida to'ldiriladi.
        </div>
        <QuestionGridEditor value={questions} onChange={setQuestions} subject={subject} apiBase={API_BASE} mode="template" />
      </div>

      {error && <pre className="text-bad text-sm whitespace-pre-wrap">{error}</pre>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          <Icon name="save" size={16} /> {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <Link href={paramExamId ? `/test-templates/exam/${paramExamId}` : "/test-templates"} className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
