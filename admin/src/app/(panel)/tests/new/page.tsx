"use client";

// Yangi test yaratish. Avval imtihon + yorliq (TestTemplate) tanlash;
// keyin yorliqdagi savollar soniga qarab boshlang'ich blanka savollar
// yaratiladi. Har savolni QuestionEditor bilan to'ldirish mumkin.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  QuestionEditor,
  TestQuestion,
  makeEmptyQuestion,
} from "@/components/QuestionBuilder";

interface ExamOption {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  grades: number[];
}

interface TemplateOption {
  id: string;
  name: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  examId: string | null;
  questionCount: number;
}

const LANGUAGES = [
  { key: "UZ", label: "O'zbek" },
  { key: "RU", label: "Rus" },
  { key: "EN", label: "Ingliz" },
] as const;
type Lang = (typeof LANGUAGES)[number]["key"];

export default function NewTestPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [examId, setExamId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [durationMinRaw, setDurationMinRaw] = useState("");
  const [languages, setLanguages] = useState<Lang[]>(["UZ"]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: ExamOption[] }>(`/api/admin/exams?take=200`).then((d) => setExams(d.items ?? []));
    api<{ items: TemplateOption[] }>(`/api/admin/test-templates?take=500`).then((d) => setTemplates(d.items ?? []));
  }, []);

  const eligibleTemplates = useMemo(
    () => templates.filter((t) => (examId ? t.examId === examId : false)),
    [templates, examId],
  );

  const selectedTpl = templates.find((t) => t.id === templateId);

  // When template changes, regenerate blank questions matching its count.
  useEffect(() => {
    if (!selectedTpl) return;
    if (questions.length === selectedTpl.questionCount) return;
    const next: TestQuestion[] = [];
    for (let i = 0; i < selectedTpl.questionCount; i++) {
      next.push(makeEmptyQuestion(i));
    }
    setQuestions(next);
  }, [templateId, selectedTpl?.questionCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleLang(l: Lang) {
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function save() {
    setError(null);
    if (!examId || !templateId || !name.trim()) {
      setError("Imtihon, yorliq va nom majburiy.");
      return;
    }
    if (languages.length === 0) {
      setError("Kamida bitta tilni tanlang.");
      return;
    }
    const durationSec = durationMinRaw.trim()
      ? Math.max(60, Math.round(Number(durationMinRaw) * 60))
      : null;
    if (durationMinRaw.trim() && !Number.isFinite(Number(durationMinRaw))) {
      setError("Vaqt son bo'lishi kerak.");
      return;
    }
    setSaving(true);
    try {
      const t = await api<{ id: string }>("/api/admin/tests", {
        method: "POST",
        body: JSON.stringify({
          examId,
          templateId,
          name: name.trim(),
          subject: selectedTpl?.subject,
          grade: selectedTpl?.grade,
          languages,
          durationSec,
          questions,
        }),
      });
      router.push(`/tests/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/tests" className="text-sm text-navy underline">← Testlar ro'yxati</Link>
      <h1 className="text-2xl font-semibold text-navy">Yangi test</h1>

      <div className="card p-4 space-y-3">
        <div>
          <label className="text-xs text-gray-500">Imtihon</label>
          <select
            value={examId}
            onChange={(e) => { setExamId(e.target.value); setTemplateId(""); }}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">— tanlang —</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">Yorliq (Test shabloni)</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={!examId}
          >
            <option value="">— tanlang —</option>
            {eligibleTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.subject} · {t.grade}-sinf · {t.questionCount} savol
              </option>
            ))}
          </select>
          {selectedTpl && (
            <div className="text-xs text-gray-500 mt-1">
              Bu testda aynan <b>{selectedTpl.questionCount} ta savol</b> bo'lishi shart.
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500">Test nomi</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Masalan: 5-sinf matematika (QABUL 2026)"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-start">
          <div>
            <label className="text-xs text-gray-500 block">Tillar (multi-select)</label>
            <div className="flex gap-2 mt-1">
              {LANGUAGES.map((l) => (
                <label key={l.key} className={`px-3 py-1 rounded border text-sm cursor-pointer ${languages.includes(l.key) ? "bg-navy text-white border-navy" : "bg-white text-gray-700"}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={languages.includes(l.key)}
                    onChange={() => toggleLang(l.key)}
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block">Vaqt (daqiqa, ixtiyoriy)</label>
            <input
              type="number"
              value={durationMinRaw}
              onChange={(e) => setDurationMinRaw(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-32"
              placeholder="masalan 30"
              min={1}
            />
          </div>
        </div>
      </div>

      {selectedTpl && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-navy">Savollar</h2>
            <div className="text-xs text-gray-500">{questions.length} / {selectedTpl.questionCount}</div>
          </div>
          {questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              q={q}
              onChange={(next) => {
                const arr = [...questions];
                arr[i] = { ...next, order: i };
                setQuestions(arr);
              }}
              onRemove={() => {
                // Removal isn't allowed — question count must match template.
                // Instead we clear the question fields.
                const arr = [...questions];
                arr[i] = makeEmptyQuestion(i, q.type);
                setQuestions(arr);
              }}
            />
          ))}
        </div>
      )}

      {error && <div className="card p-3 bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="flex justify-end gap-3">
        <Link href="/tests" className="px-4 py-2 text-sm text-gray-600 hover:underline">Bekor qilish</Link>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-navy text-white px-4 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : "Testni saqlash"}
        </button>
      </div>
    </div>
  );
}
