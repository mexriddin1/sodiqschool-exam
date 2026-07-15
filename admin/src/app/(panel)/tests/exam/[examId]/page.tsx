"use client";

// Bitta imtihon paketi ichidagi testlar + fan/sinf filtri.
//
// Filtr serverda bajariladi — backend `?examId&subject&grade` ni allaqachon
// qo'llab-quvvatlaydi (admin.tests.ts), ya'ni bu yerda faqat UI yetishmasdi.
//
// Tuzilishi test-templates/exam/[examId] bilan bir xil, faqat u yerdagi
// "bog'lanmagan" (examId=null) sentinel'i yo'q — Test.examId majburiy.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Subject = "MATH" | "ENGLISH" | "CRITICAL_THINKING";

interface Row {
  id: string;
  examId: string;
  name: string;
  subject: Subject;
  grade: number;
  languages: string[];
  durationSec: number | null;
  questionCount: number;
  updatedAt: string;
}

interface Exam {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grades: number[];
  grade: number;
}

const SUBJECT_LABEL: Record<Subject, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

export default function TestsByExamPage() {
  const router = useRouter();
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const [exam, setExam] = useState<Exam | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState<Subject | "">("");
  const [grade, setGrade] = useState<number | "">("");

  const query = useMemo(() => {
    const qs = new URLSearchParams({ examId, take: "500" });
    if (subject) qs.set("subject", subject);
    if (grade !== "") qs.set("grade", String(grade));
    return qs.toString();
  }, [examId, subject, grade]);

  const load = useCallback(() => {
    setLoading(true);
    api<{ items: Row[] }>(`/api/admin/tests?${query}`)
      .then((d) => setRows(d.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api<Exam>(`/api/admin/exams/${examId}`).then(setExam).catch(() => undefined);
  }, [examId]);

  // Sinf variantlari imtihonning o'zidan — `grades` bo'sh bo'lsa (multi-grade
  // dan oldingi eski qatorlar) legacy `grade` ga tushamiz.
  const gradeOptions = useMemo(() => {
    if (!exam) return [];
    return exam.grades.length > 0 ? [...exam.grades].sort((a, b) => a - b) : [exam.grade];
  }, [exam]);

  const filtersActive = subject !== "" || grade !== "";

  return (
    <div className="space-y-4">
      <Link href="/tests" className="text-sm text-navy hover:underline">← Testlar</Link>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{exam?.title ?? "Imtihon"}</h1>
          {exam && (
            <div className="text-xs text-gray-500 mt-1">
              {exam.status} · {gradeOptions.join(", ")}-sinf
            </div>
          )}
        </div>
        <Link
          href={`/tests/new?examId=${examId}`}
          className="rounded bg-navy text-white text-sm px-4 py-2 hover:opacity-90"
        >
          + Yangi test
        </Link>
      </div>

      <div className="card p-3 flex gap-3 items-end flex-wrap">
        <div>
          <label htmlFor="filter-subject" className="text-xs text-gray-500 block">Fan</label>
          <select
            id="filter-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as Subject | "")}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="">Barchasi</option>
            {(Object.keys(SUBJECT_LABEL) as Subject[]).map((s) => (
              <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-grade" className="text-xs text-gray-500 block">Sinf</label>
          <select
            id="filter-grade"
            value={grade === "" ? "" : String(grade)}
            onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="">Barchasi</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}-sinf</option>
            ))}
          </select>
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => { setSubject(""); setGrade(""); }}
            className="text-sm text-navy underline pb-1"
          >
            Filtrni tozalash
          </button>
        )}
        <div className="ml-auto text-xs text-gray-500 pb-1">
          {loading ? "Yuklanmoqda…" : `${rows.length} ta test`}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b">
              <th className="p-2">Nomi</th>
              <th className="p-2">Fan</th>
              <th className="p-2">Sinf</th>
              <th className="p-2">Tillar</th>
              <th className="p-2">Vaqt</th>
              <th className="p-2">Savollar</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  {filtersActive
                    ? "Bu filtrga mos test yo'q."
                    : "Bu imtihonda hali testlar yo'q — yuqoridagi \"Yangi test\" tugmasi bilan qo'shing."}
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/tests/${t.id}?from=/tests/exam/${examId}&fromLabel=${encodeURIComponent(exam?.title ?? "Testlar")}`)}
                className="border-b hover:bg-gray-50 cursor-pointer"
              >
                <td className="p-2 font-medium text-navy">{t.name}</td>
                <td className="p-2">{SUBJECT_LABEL[t.subject]}</td>
                <td className="p-2">{t.grade}-sinf</td>
                <td className="p-2 text-xs">{t.languages.join(", ") || "—"}</td>
                <td className="p-2 text-xs">
                  {t.durationSec ? `${Math.round(t.durationSec / 60)} daq.` : "cheklovsiz"}
                </td>
                <td className="p-2">{t.questionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
