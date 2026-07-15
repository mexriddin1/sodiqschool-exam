"use client";

// Testlar — kompakt paket ro'yxati. Har imtihon uchun bitta card, unda
// statistika (nechta test, jami savol). Card bosilganda o'sha imtihonning
// testlari sahifasiga o'tadi — u yerda fan/sinf bo'yicha filtr va shu
// paketga yangi test qo'shish ham bor.
//
// Tuzilishi ataylab "Test shablonlari" bilan bir xil (test-templates/page.tsx)
// — admin ikkalasida bir xil oqimni ko'radi. Farqi: bu yerda "bog'lanmagan"
// chelagi yo'q, chunki Test.examId majburiy (schema.prisma), ya'ni imtihonsiz
// test bo'lishi mumkin emas.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Row {
  id: string;
  examId: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  questionCount: number;
}

interface ExamOption {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

export default function TestsPage() {
  const router = useRouter();
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
    // Testi yo'q imtihon ham ko'rinsin — admin paketga kirib birinchi testni
    // shu yerdan yaratadi, imtihonlar ro'yxatiga borib o'tirmasdan.
    const byExam = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = byExam.get(r.examId) ?? [];
      arr.push(r);
      byExam.set(r.examId, arr);
    }
    return exams
      .map((ex) => {
        const list = byExam.get(ex.id) ?? [];
        return {
          examId: ex.id,
          title: ex.title,
          status: ex.status,
          testCount: list.length,
          totalQuestions: list.reduce((s, r) => s + r.questionCount, 0),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [rows, exams]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy">Testlar</h1>

      <p className="text-sm text-gray-600 max-w-3xl">
        Har test majburiy bir imtihonga bog'lanadi. Quyida imtihon paketlarining kompakt
        ro'yxati — paket ustiga bosib ichini ko'ring, u yerda fan va sinf bo'yicha filtrlash
        hamda shu imtihon uchun yangi test yaratish mumkin.
      </p>

      {loading && rows.length === 0 && (
        <div className="card p-4 text-sm text-gray-500">Yuklanmoqda…</div>
      )}

      {!loading && groups.length === 0 && (
        <div className="card p-4 text-sm text-gray-500">
          Hech qanday imtihon yo'q. Avval Imtihonlar sahifasida imtihon yarating.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((g) => (
          <button
            type="button"
            key={g.examId}
            onClick={() => router.push(`/tests/exam/${g.examId}`)}
            className="card p-4 text-left space-y-2 transition hover:border-navy hover:shadow cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-navy line-clamp-2">{g.title}</div>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                {g.status}
              </span>
            </div>
            <div className="flex items-baseline gap-4 text-xs text-gray-500">
              <span>
                <b className="text-navy text-sm">{g.testCount}</b> ta test
              </span>
              <span>
                <b className="text-navy text-sm">{g.totalQuestions}</b> ta savol
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
