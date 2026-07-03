"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

interface Exam {
  id: string;
  title: string;
  description?: string | null;
  examDate: string;
  academicYear?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  grades?: number[];
  admissionThresholds: Record<string, { math: number; ct: number; en: number }>;
  gradingConfiguration?: unknown;
  cohortSize: number | null;
}

const GRADES = [5, 6, 7, 8, 9, 10, 11];

// Default per-grade composite weights — mirrors what the create form uses.
// Kept here in sync so the edit form falls back to sensible values when an
// older exam saved gradingConfiguration as an empty object.
const DEFAULT_WEIGHTS_MATRIX: Record<number, { math: number; ct: number; en: number }> = {
  5: { math: 30, ct: 40, en: 30 },
  6: { math: 30, ct: 40, en: 30 },
  7: { math: 35, ct: 30, en: 35 },
  8: { math: 35, ct: 30, en: 35 },
  9: { math: 35, ct: 25, en: 40 },
  10: { math: 35, ct: 25, en: 40 },
  11: { math: 35, ct: 25, en: 40 },
};

// Convert whatever shape the exam has stored into the {math,ct,en} form the
// UI edits. Accepts weightsByGrade (new), flat weights (legacy), or nothing.
function loadWeightsMatrix(gradingConfig: unknown): Record<number, { math: number; ct: number; en: number }> {
  const conf = (gradingConfig ?? {}) as Record<string, unknown>;
  const out: Record<number, { math: number; ct: number; en: number }> = { ...DEFAULT_WEIGHTS_MATRIX };
  const byGrade = conf.weightsByGrade as Record<string, { math?: number; english?: number; criticalThinking?: number; ct?: number; en?: number }> | undefined;
  if (byGrade && typeof byGrade === "object") {
    for (const g of GRADES) {
      const row = byGrade[String(g)];
      if (row) {
        out[g] = {
          math: Number(row.math ?? 0),
          ct: Number(row.criticalThinking ?? row.ct ?? 0),
          en: Number(row.english ?? row.en ?? 0),
        };
      }
    }
  } else {
    const flat = conf.weights as { math?: number; english?: number; criticalThinking?: number; ct?: number; en?: number } | undefined;
    if (flat) {
      const uniform = {
        math: Number(flat.math ?? 0),
        ct: Number(flat.criticalThinking ?? flat.ct ?? 0),
        en: Number(flat.english ?? flat.en ?? 0),
      };
      for (const g of GRADES) out[g] = { ...uniform };
    }
  }
  return out;
}

export default function EditExamPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [e, setE] = useState<Exam | null>(null);
  const [weightsByGrade, setWeightsByGrade] = useState<Record<number, { math: number; ct: number; en: number }>>(DEFAULT_WEIGHTS_MATRIX);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<Exam>(`/api/admin/exams/${params.id}`).then((d) => {
      setE(d);
      setWeightsByGrade(loadWeightsMatrix(d.gradingConfiguration));
    });
  }, [params.id]);

  function setW(grade: number, key: "math" | "ct" | "en", value: number) {
    setWeightsByGrade((prev) => {
      const cur = prev[grade] ?? { math: 0, ct: 0, en: 0 };
      return { ...prev, [grade]: { ...cur, [key]: value } };
    });
  }

  // Only show rows for grades this exam actually covers. Falls back to all
  // grades when the exam predates the multi-grade schema.
  const activeGrades = e && e.grades && e.grades.length > 0 ? e.grades : GRADES;

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!e) return;

    // Sum validation per active row — must be exactly 100%.
    for (const g of activeGrades) {
      const row = weightsByGrade[g];
      if (!row) continue;
      const sum = row.math + row.ct + row.en;
      if (sum !== 100) {
        setError(`${g}-sinf uchun og'irliklar yig'indisi ${sum}% (100 bo'lishi kerak).`);
        return;
      }
    }

    setPending(true);
    setError(null);
    const fd = new FormData(ev.currentTarget);
    try {
      // Normalise to the canonical english/criticalThinking keys the compute
      // engine expects. Only serialise rows for active grades.
      const wbg: Record<string, { math: number; english: number; criticalThinking: number }> = {};
      for (const g of activeGrades) {
        const row = weightsByGrade[g] ?? DEFAULT_WEIGHTS_MATRIX[g];
        if (!row) continue;
        wbg[String(g)] = { math: row.math, english: row.en, criticalThinking: row.ct };
      }
      await api(`/api/admin/exams/${e.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(fd.get("title")),
          description: (fd.get("description") as string) || null,
          examDate: new Date(String(fd.get("examDate"))).toISOString(),
          academicYear: (fd.get("academicYear") as string) || null,
          status: String(fd.get("status")),
          grade: Number(fd.get("grade")),
          gradingConfiguration: { weightsByGrade: wbg },
          cohortSize: fd.get("cohortSize") ? Number(fd.get("cohortSize")) : null,
        }),
      });
      router.push(`/exams/${e.id}`);
    } catch (err) {
      setError(err instanceof ApiException ? err.error.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  if (!e) return <div className="text-gray-500">Yuklanmoqda…</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
      <Link href={`/exams/${e.id}`} className="text-sm text-navy hover:underline">← Imtihon</Link>
      <h1 className="text-2xl font-semibold text-navy">Imtihonni tahrirlash</h1>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="label">Nomi</label>
          <input name="title" defaultValue={e.title} required className="input" />
        </div>
        <div>
          <label className="label">Sinf</label>
          <select name="grade" defaultValue={e.grade} className="input">
            {GRADES.map((g) => (<option key={g} value={g}>{g}-sinf</option>))}
          </select>
        </div>
        <div>
          <label className="label">Holat</label>
          <select name="status" defaultValue={e.status} className="input">
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div>
          <label className="label">Sana</label>
          <input name="examDate" type="date" required className="input"
            defaultValue={new Date(e.examDate).toISOString().slice(0, 10)} />
        </div>
        <div>
          <label className="label">O'quv yili</label>
          <input name="academicYear" defaultValue={e.academicYear ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Kohort hajmi</label>
          <input name="cohortSize" type="number" min={1} defaultValue={e.cohortSize ?? ""} className="input" />
        </div>
        <div className="col-span-full">
          <label className="label">Tavsif</label>
          <textarea name="description" defaultValue={e.description ?? ""} className="input" rows={2} />
        </div>
      </div>

      <div className="card p-4">
        <div className="font-medium text-sm">Fanlar og'irligi (har sinf uchun alohida)</div>
        <div className="text-xs text-gray-500 mb-3">
          Har sinf uchun 3 fanning ulushini foizda kiriting (yig'indi 100%). Umumiy ball ushbu
          og'irliklar bo'yicha hisoblanadi.
        </div>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Sinf</th>
                <th className="text-right px-3 py-2">Matematika %</th>
                <th className="text-right px-3 py-2">Tanqidiy fikrlash %</th>
                <th className="text-right px-3 py-2">Ingliz tili %</th>
                <th className="text-right px-3 py-2">Yig'indi</th>
              </tr>
            </thead>
            <tbody>
              {activeGrades.map((g) => {
                const row = weightsByGrade[g] ?? DEFAULT_WEIGHTS_MATRIX[g] ?? { math: 40, ct: 30, en: 30 };
                const sum = row.math + row.ct + row.en;
                const ok = sum === 100;
                return (
                  <tr key={g} className="border-t">
                    <td className="px-3 py-2 font-medium">{g}-sinf</td>
                    <td className="px-3 py-1 text-right">
                      <input
                        type="number" min={0} max={100}
                        className="input py-1 text-sm text-right w-20"
                        value={row.math}
                        onChange={(ev) => setW(g, "math", Number(ev.target.value) || 0)}
                      />
                    </td>
                    <td className="px-3 py-1 text-right">
                      <input
                        type="number" min={0} max={100}
                        className="input py-1 text-sm text-right w-20"
                        value={row.ct}
                        onChange={(ev) => setW(g, "ct", Number(ev.target.value) || 0)}
                      />
                    </td>
                    <td className="px-3 py-1 text-right">
                      <input
                        type="number" min={0} max={100}
                        className="input py-1 text-sm text-right w-20"
                        value={row.en}
                        onChange={(ev) => setW(g, "en", Number(ev.target.value) || 0)}
                      />
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${ok ? "text-good" : "text-bad"}`}>
                      {sum}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          <Icon name="save" size={16} /> {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <Link href={`/exams/${e.id}`} className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
