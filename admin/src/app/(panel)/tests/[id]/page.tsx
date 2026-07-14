"use client";

// Test detail — savollarni ko'rish / tahrirlash / o'chirish.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { QuestionEditor, TestQuestion, makeEmptyQuestion } from "@/components/QuestionBuilder";

interface Test {
  id: string;
  examId: string;
  templateId: string;
  name: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  languages: ("UZ" | "RU" | "EN")[];
  durationSec: number | null;
  questions: TestQuestion[];
}

const LANG_LABEL: Record<string, string> = { UZ: "O'zbek", RU: "Rus", EN: "Ingliz" };

export default function TestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<Test>(`/api/admin/tests/${params.id}`)
      .then(setTest)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [params.id]);

  async function save() {
    if (!test) return;
    setError(null);
    setSaving(true);
    try {
      await api(`/api/admin/tests/${test.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: test.name,
          languages: test.languages,
          durationSec: test.durationSec,
          questions: test.questions,
        }),
      });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!test) return;
    if (!confirm("Ushbu testni butunlay o'chirasizmi?")) return;
    try {
      await api(`/api/admin/tests/${test.id}`, { method: "DELETE" });
      router.push("/tests");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Yuklanmoqda…</div>;
  if (!test) return <div className="p-6 text-red-500">Test topilmadi</div>;

  const toggleLang = (l: "UZ" | "RU" | "EN") => {
    const has = test.languages.includes(l);
    setTest({ ...test, languages: has ? test.languages.filter((x) => x !== l) : [...test.languages, l] });
    setDirty(true);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/tests" className="text-sm text-navy underline">← Testlar ro'yxati</Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={test.name}
            onChange={(e) => { setTest({ ...test, name: e.target.value }); setDirty(true); }}
            className="w-full text-2xl font-semibold text-navy border-b border-transparent hover:border-gray-300 focus:border-navy outline-none"
          />
          <div className="text-xs text-gray-500 mt-1">
            {test.subject} · {test.grade}-sinf · savol: {test.questions?.length ?? 0}
          </div>
        </div>
        <button onClick={del} className="text-sm text-red-600 hover:underline">O'chirish</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div>
          <div className="text-xs text-gray-500">Tillar</div>
          <div className="flex gap-2 mt-1">
            {(["UZ", "RU", "EN"] as const).map((l) => (
              <label key={l} className={`px-3 py-1 rounded border text-sm cursor-pointer ${test.languages.includes(l) ? "bg-navy text-white border-navy" : "bg-white text-gray-700"}`}>
                <input type="checkbox" className="hidden" checked={test.languages.includes(l)} onChange={() => toggleLang(l)} />
                {LANG_LABEL[l]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Vaqt (daqiqa)</div>
          <input
            type="number"
            value={test.durationSec ? Math.round(test.durationSec / 60) : ""}
            onChange={(e) => {
              const val = e.target.value;
              setTest({ ...test, durationSec: val ? Math.round(Number(val) * 60) : null });
              setDirty(true);
            }}
            className="border rounded px-3 py-1 text-sm w-32"
            placeholder="cheklovsiz"
            min={1}
          />
        </div>
      </div>

      <div className="space-y-3">
        {(test.questions ?? []).map((q, i) => (
          <QuestionEditor
            key={q.id}
            q={q}
            onChange={(next) => {
              const arr = [...test.questions];
              arr[i] = { ...next, order: i };
              setTest({ ...test, questions: arr });
              setDirty(true);
            }}
            onRemove={() => {
              const arr = [...test.questions];
              arr[i] = makeEmptyQuestion(i, q.type);
              setTest({ ...test, questions: arr });
              setDirty(true);
            }}
          />
        ))}
      </div>

      {error && <div className="card p-3 bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="sticky bottom-2 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded bg-navy text-white px-4 py-2 text-sm shadow-lg disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : dirty ? "O'zgarishlarni saqlash" : "Saqlangan"}
        </button>
      </div>
    </div>
  );
}
