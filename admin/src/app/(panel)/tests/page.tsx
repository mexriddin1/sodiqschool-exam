"use client";

// Testlar — imtihonlar bo'yicha guruhlangan haqiqiy testlar. Har bir test
// TestTemplate (yorliq) ga bog'langan bo'lib, savol sonlari mos kelishi shart.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface Row {
  id: string;
  examId: string;
  templateId: string;
  name: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  languages: string[];
  durationSec: number | null;
  questionCount: number;
  updatedAt: string;
}

interface ExamOption {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

const SUBJECT_LABEL: Record<Row["subject"], string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

export default function TestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ items: Row[] }>(`/api/admin/tests?take=500`).then((d) => setRows(d.items ?? [])).catch(() => undefined),
      api<{ items: ExamOption[] }>(`/api/admin/exams?take=200`).then((d) => setExams(d.items ?? [])).catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const byExam = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = byExam.get(r.examId) ?? [];
      arr.push(r);
      byExam.set(r.examId, arr);
    }
    return exams
      .map((ex) => ({
        exam: ex,
        tests: byExam.get(ex.id) ?? [],
      }))
      .sort((a, b) => a.exam.title.localeCompare(b.exam.title));
  }, [rows, exams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-navy">Testlar</h1>
        <Link
          href="/tests/new"
          className="rounded bg-navy text-white text-sm px-4 py-2 hover:opacity-90"
        >
          + Yangi test
        </Link>
      </div>
      <p className="text-sm text-gray-600 max-w-3xl">
        Testlar imtihonlar ostida guruhlanadi. Har bir test yorliqqa (test shabloni) bog'lanadi va
        savol soni yorliqdagi savol soniga teng bo'lishi shart.
      </p>

      {loading && <div className="card p-4 text-sm text-gray-500">Yuklanmoqda…</div>}

      {!loading && groups.length === 0 && (
        <div className="card p-4 text-sm text-gray-500">Hali imtihonlar yo'q.</div>
      )}

      <div className="space-y-4">
        {groups.map(({ exam, tests }) => (
          <div key={exam.id} className="card p-4">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="font-semibold text-navy">{exam.title}</div>
                <div className="text-xs text-gray-500 uppercase">{exam.status}</div>
              </div>
              <div className="text-xs text-gray-500">{tests.length} ta test</div>
            </div>
            {tests.length === 0 ? (
              <div className="text-sm text-gray-500">Bu imtihonda hali testlar yo'q.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 border-b">
                      <th className="p-2">Nomi</th>
                      <th className="p-2">Fan</th>
                      <th className="p-2">Sinf</th>
                      <th className="p-2">Tillar</th>
                      <th className="p-2">Vaqt</th>
                      <th className="p-2">Savollar</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium text-navy">{t.name}</td>
                        <td className="p-2">{SUBJECT_LABEL[t.subject]}</td>
                        <td className="p-2">{t.grade}-sinf</td>
                        <td className="p-2 text-xs">{t.languages.join(", ") || "—"}</td>
                        <td className="p-2 text-xs">
                          {t.durationSec ? `${Math.round(t.durationSec / 60)} daq.` : "cheklovsiz"}
                        </td>
                        <td className="p-2">{t.questionCount}</td>
                        <td className="p-2">
                          <Link href={`/tests/${t.id}`} className="text-navy underline">Ochish</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
