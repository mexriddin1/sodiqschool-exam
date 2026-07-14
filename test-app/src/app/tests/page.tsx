"use client";

// O'quvchining sinf + til kombinatsiyasi bo'yicha ochilgan testlar. Har bir
// kartaga bosilganda /take/[token] ga o'tadi (test attempt boshlanadi).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

interface TestRow {
  id: string;
  name: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  languages: string[];
  durationSec: number | null;
  questionCount: number;
}

const SUBJECT_LABEL: Record<TestRow["subject"], string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

export default function TestsListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Yuklanmoqda…</div>}>
      <TestsListInner />
    </Suspense>
  );
}

function TestsListInner() {
  const search = useSearchParams();
  const router = useRouter();
  const leadIdParam = search.get("lead");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [items, setItems] = useState<TestRow[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = leadIdParam || (typeof window !== "undefined" ? sessionStorage.getItem("sodiq_lead_id") : null);
    if (!id) {
      router.replace("/");
      return;
    }
    setLeadId(id);
    api<{ items: TestRow[]; lead: { firstName: string; lastName: string } }>(`/api/test-taking/leads/${id}/tests`)
      .then((d) => {
        setItems(d.items ?? []);
        setStudentName(`${d.lead.firstName} ${d.lead.lastName}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Xato"))
      .finally(() => setLoading(false));
  }, [leadIdParam, router]);

  async function start(testId: string) {
    if (!leadId) return;
    setStarting(testId);
    setError(null);
    try {
      const { token } = await api<{ token: string }>("/api/test-taking/attempts", {
        method: "POST",
        body: JSON.stringify({ leadId, testId }),
      });
      router.push(`/take/${token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
      setStarting(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div>
        <div className="text-sm text-gray-500">Xush kelibsiz,</div>
        <div className="text-xl font-semibold text-navy">{studentName || "…"}</div>
      </div>
      <p className="text-sm text-gray-600">
        Quyidagi testlardan birini tanlab, imtihonni boshlashingiz mumkin. Diqqat: test boshlanishi bilan ekran to'liq rejimga (fullscreen) o'tadi va uni tark eta olmaysiz.
      </p>

      {loading && <div className="card p-4 text-sm text-gray-500">Yuklanmoqda…</div>}
      {!loading && items.length === 0 && (
        <div className="card p-4 text-sm text-gray-500">
          Sizga mos test topilmadi. Iltimos, qabulxonaga murojaat qiling.
        </div>
      )}

      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-navy">{SUBJECT_LABEL[t.subject]}</div>
              <div className="text-xs text-gray-500 mt-1">
                {t.name} · {t.questionCount} savol{" "}
                {t.durationSec ? `· ${Math.round(t.durationSec / 60)} daq.` : "· vaqt chegarasiz"}
              </div>
            </div>
            <button
              onClick={() => start(t.id)}
              disabled={Boolean(starting)}
              className="rounded bg-navy text-white text-sm px-4 py-2 disabled:opacity-60"
            >
              {starting === t.id ? "Ochilmoqda…" : "Boshlash"}
            </button>
          </div>
        ))}
      </div>

      {error && <div className="card p-3 bg-red-50 border-red-200 text-sm text-red-700">{error}</div>}
    </div>
  );
}
