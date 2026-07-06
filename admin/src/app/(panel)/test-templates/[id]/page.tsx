"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import QuestionGridEditor, { Question } from "@/components/QuestionGridEditor";
import { Icon } from "@/components/Icon";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface TestTemplate {
  id: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  name: string;
  questions: Question[];
  examId?: string | null;
}

interface ExamOption { id: string; title: string; grade: number; status: string }

const SUBJECT_LABEL = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
} as const;

export default function EditTestTemplatePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [tpl, setTpl] = useState<TestTemplate | null>(null);
  const [name, setName] = useState("");
  const [examId, setExamId] = useState<string>("");
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    api<TestTemplate>(`/api/admin/test-templates/${params.id}`).then((d) => {
      setTpl(d);
      setName(d.name);
      setExamId(d.examId ?? "");
      setQuestions(d.questions ?? []);
    });
  }, [params.id]);

  useEffect(load, [load]);

  useEffect(() => {
    api<{ items: ExamOption[] }>(`/api/admin/exams?take=200`)
      .then((d) => setExams(d.items))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tpl) return;
    setError(null);
    setPending(true);
    try {
      if (!examId) throw new Error("Imtihon tanlang. Test shabloni majburiy bir imtihonga bog'lanadi.");
      if (questions.length === 0) throw new Error("Kamida bitta savol kerak.");
      await api(`/api/admin/test-templates/${tpl.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), examId, questions }),
      });
      router.push("/test-templates");
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : e instanceof Error ? e.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  if (!tpl) return <div className="text-gray-500">Yuklanmoqda…</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-6xl">
      <Link href="/test-templates" className="text-sm text-navy hover:underline">← Test shablonlari</Link>
      <h1 className="text-2xl font-semibold text-navy">
        {SUBJECT_LABEL[tpl.subject]} · {tpl.grade}-sinf
      </h1>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Imtihon <span className="text-bad">*</span></label>
          <select
            className="input"
            required
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
          >
            <option value="">— Tanlang —</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} · {ex.grade}-sinf · {ex.status}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            Bu test shabloni qaysi imtihonga tegishli ekanini belgilaydi.
            Natija import qilishda shu bog'liqlik tekshiriladi.
          </div>
        </div>
        <div>
          <label className="label">Shablon nomi</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="text-sm text-gray-600">
          Savollar tarkibini tahrirlang. Bu shablon ishlatadigan mavjud
          natijalarda eski savollar nusxasi saqlanadi.
        </div>
        <QuestionGridEditor value={questions} onChange={setQuestions} subject={tpl.subject} apiBase={API_BASE} mode="template" />
      </div>

      {error && <pre className="text-bad text-sm whitespace-pre-wrap">{error}</pre>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          <Icon name="save" size={16} /> {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <Link href="/test-templates" className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
