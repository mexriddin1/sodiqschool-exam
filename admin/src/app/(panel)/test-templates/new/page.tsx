"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import QuestionGridEditor, { Question } from "@/components/QuestionGridEditor";
import { Icon } from "@/components/Icon";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function NewTestTemplatePage() {
  const router = useRouter();
  const search = useSearchParams();
  // ?examId=… → scope the new template to that exam. ?subject=…&grade=… →
  // pre-populate the picker when the admin lands from an exam's missing-slot
  // "Yaratish" link.
  const paramExamId = search.get("examId");
  const paramSubject = search.get("subject") as "MATH" | "ENGLISH" | "CRITICAL_THINKING" | null;
  const paramGrade = Number(search.get("grade")) || null;
  const [subject, setSubject] = useState<"MATH" | "ENGLISH" | "CRITICAL_THINKING">(paramSubject ?? "MATH");
  const [grade, setGrade] = useState(paramGrade ?? 5);
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (questions.length === 0) throw new Error("Kamida bitta savol kerak.");
      const r = await api<{ id: string }>("/api/admin/test-templates", {
        method: "POST",
        body: JSON.stringify({
          subject, grade, name: name.trim(), questions,
          examId: paramExamId ?? null,
        }),
      });
      // Return to the exam if the admin came from there; otherwise the
      // detail page for the newly created template.
      router.push(paramExamId ? `/exams/${paramExamId}` : `/test-templates/${r.id}`);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : e instanceof Error ? e.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-6xl">
      <Link
        href={paramExamId ? `/exams/${paramExamId}` : "/test-templates"}
        className="text-sm text-navy hover:underline"
      >
        ← {paramExamId ? "Imtihonga qaytish" : "Test shablonlari"}
      </Link>
      <h1 className="text-2xl font-semibold text-navy">Yangi test shabloni</h1>
      {paramExamId && (
        <div className="text-xs text-gray-500">Bu shablon shu imtihonga bog'lanadi.</div>
      )}

      <div className="card p-4 grid grid-cols-3 gap-3">
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
          <select className="input" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{g}-sinf</option>)}
          </select>
        </div>
        <div>
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
        <Link href="/test-templates" className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
