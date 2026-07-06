"use client";

// Test shablonlari — kompakt paket ro'yxati. Har imtihon uchun bitta card,
// unda statistika (nechta shablon, jami savol soni). Card bosilganda o'sha
// imtihon detail sahifasiga o'tadi — u yerda shablonlar to'liq ko'rinadi.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Row {
  id: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  name: string;
  examId: string | null;
  questionCount: number;
  updatedAt: string;
}

interface ExamOption {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

export default function TestTemplatesPage() {
  const router = useRouter();
  const [list, setList] = useState<Row[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ items: Row[] }>(`/api/admin/test-templates?take=500`).then((d) => setList(d.items ?? [])).catch(() => undefined),
      api<{ items: ExamOption[] }>(`/api/admin/exams?take=200`).then((d) => setExams(d.items ?? [])).catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    // Group templates by examId. Include EVERY exam — even ones with zero
    // templates — so admin can click through and add the first template
    // from the exam's own page without needing to visit the exams list.
    const byExam = new Map<string, Row[]>();
    for (const r of list) {
      const key = r.examId ?? "__unbound__";
      const arr = byExam.get(key) ?? [];
      arr.push(r);
      byExam.set(key, arr);
    }
    const out: {
      examId: string | null;
      title: string;
      status?: string;
      templateCount: number;
      totalQuestions: number;
    }[] = [];
    // NOTE: "__unbound__" is used as a sentinel examId so the card is clickable.
    // Start with every exam known to the system (so empty packages show up).
    for (const ex of exams) {
      const rows = byExam.get(ex.id) ?? [];
      out.push({
        examId: ex.id,
        title: ex.title,
        status: ex.status,
        templateCount: rows.length,
        totalQuestions: rows.reduce((s, r) => s + r.questionCount, 0),
      });
    }
    // Add the "orphan" bucket only if there really are unbound templates.
    const orphans = byExam.get("__unbound__");
    if (orphans && orphans.length > 0) {
      out.push({
        examId: "__unbound__",
        title: "Bog'lanmagan (eski) shablonlar",
        templateCount: orphans.length,
        totalQuestions: orphans.reduce((s, r) => s + r.questionCount, 0),
      });
    }
    // Exams first (title asc), unbound last.
    out.sort((a, b) => {
      if (!a.examId) return 1;
      if (!b.examId) return -1;
      return a.title.localeCompare(b.title);
    });
    return out;
  }, [list, exams]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy">Test shablonlari</h1>

      <p className="text-sm text-gray-600">
        Har test shabloni majburiy bir imtihonga bog'lanadi. Quyida imtihon paketlarining
        kompakt ro'yxati — paket ustiga bosib ichini ko'ring, u yerda shu imtihon uchun
        yangi shablon yaratish ham mumkin.
      </p>

      {loading && list.length === 0 && (
        <div className="card p-4 text-sm text-gray-500">Yuklanmoqda…</div>
      )}

      {!loading && groups.length === 0 && (
        <div className="card p-4 text-sm text-gray-500">
          Hech qanday shablon yo'q. Imtihonlar sahifasiga o'ting, kerakli imtihonni oching va u yerdan yangi shablon qo'shing.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((g) => {
          const key = g.examId ?? "unbound";
          return (
            <button
              type="button"
              key={key}
              onClick={() => router.push(`/test-templates/exam/${key}`)}
              className="card p-4 text-left space-y-2 transition hover:border-navy hover:shadow cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-navy line-clamp-2">{g.title}</div>
                {g.status && (
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                    {g.status}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-4 text-xs text-gray-500">
                <span>
                  <b className="text-navy text-sm">{g.templateCount}</b> ta shablon
                </span>
                <span>
                  <b className="text-navy text-sm">{g.totalQuestions}</b> ta savol
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
