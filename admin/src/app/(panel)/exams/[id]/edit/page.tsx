"use client";

// Imtihon tahrirlash — create formasi bilan bir xil tuzilishda. Multi-grade
// va multi-subject picker, per-grade fanlar og'irligi jadvali, kohort/tavsif
// va h.k. Legacy "Qabul chegaralari" va yagona sinf selecti olib tashlandi.

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
interface SubjectRow { id: string; key: SubjectKey; name: string; active: boolean }

interface Exam {
  id: string;
  title: string;
  description?: string | null;
  examDate: string;
  academicYear?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  grades?: number[];
  subjectKeys?: SubjectKey[];
  gradingConfiguration?: unknown;
  cohortSize: number | null;
}

const GRADE_OPTIONS = [5, 6, 7, 8, 9, 10, 11];

// Default per-grade composite weights — mirrors what the create form uses.
const DEFAULT_WEIGHTS_MATRIX: Record<number, { math: number; ct: number; en: number }> = {
  5:  { math: 30, ct: 40, en: 30 },
  6:  { math: 30, ct: 40, en: 30 },
  7:  { math: 35, ct: 30, en: 35 },
  8:  { math: 35, ct: 30, en: 35 },
  9:  { math: 35, ct: 25, en: 40 },
  10: { math: 35, ct: 25, en: 40 },
  11: { math: 35, ct: 25, en: 40 },
};

// Read whatever shape the exam has stored into the {math,ct,en} form the UI
// edits. Accepts weightsByGrade (new), flat weights (legacy), or nothing.
function loadWeightsMatrix(
  gradingConfig: unknown,
): Record<number, { math: number; ct: number; en: number }> {
  const conf = (gradingConfig ?? {}) as Record<string, unknown>;
  const out: Record<number, { math: number; ct: number; en: number }> = { ...DEFAULT_WEIGHTS_MATRIX };
  const byGrade = conf.weightsByGrade as
    | Record<string, { math?: number; english?: number; criticalThinking?: number; ct?: number; en?: number }>
    | undefined;
  if (byGrade && typeof byGrade === "object") {
    for (const g of GRADE_OPTIONS) {
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
    const flat = conf.weights as
      | { math?: number; english?: number; criticalThinking?: number; ct?: number; en?: number }
      | undefined;
    if (flat) {
      const uniform = {
        math: Number(flat.math ?? 0),
        ct: Number(flat.criticalThinking ?? flat.ct ?? 0),
        en: Number(flat.english ?? flat.en ?? 0),
      };
      for (const g of GRADE_OPTIONS) out[g] = { ...uniform };
    }
  }
  return out;
}

export default function EditExamPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [e, setE] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [formGrades, setFormGrades] = useState<number[]>([]);
  const [formSubjects, setFormSubjects] = useState<SubjectKey[]>([]);
  const [weightsByGrade, setWeightsByGrade] = useState<Record<number, { math: number; ct: number; en: number }>>(DEFAULT_WEIGHTS_MATRIX);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<Exam>(`/api/admin/exams/${params.id}`).then((d) => {
      setE(d);
      // Populate multi-selectors from the fetched exam. Legacy exams that
      // predate multi-grade have grades=[] — we fall back to the single
      // grade column so the picker isn't empty.
      const gs = d.grades && d.grades.length > 0 ? d.grades : [d.grade];
      setFormGrades([...gs].sort((a, b) => a - b));
      const sk = d.subjectKeys && d.subjectKeys.length > 0
        ? d.subjectKeys
        : (["MATH", "ENGLISH", "CRITICAL_THINKING"] as SubjectKey[]);
      setFormSubjects(sk);
      setWeightsByGrade(loadWeightsMatrix(d.gradingConfiguration));
    });
    api<SubjectRow[]>(`/api/admin/subjects`)
      .then((rs) => setSubjects(rs.filter((s) => s.active)))
      .catch(() => undefined);
  }, [params.id]);

  function setW(grade: number, key: "math" | "ct" | "en", value: number) {
    setWeightsByGrade((prev) => {
      const cur = prev[grade] ?? { math: 0, ct: 0, en: 0 };
      return { ...prev, [grade]: { ...cur, [key]: value } };
    });
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!e) return;

    if (formGrades.length === 0) {
      setError("Kamida bitta sinf tanlang.");
      return;
    }
    if (formSubjects.length === 0) {
      setError("Kamida bitta fan tanlang.");
      return;
    }

    // Sum validation per selected row — must be exactly 100%.
    for (const g of formGrades) {
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
      const wbg: Record<string, { math: number; english: number; criticalThinking: number }> = {};
      for (const g of formGrades) {
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
          grades: formGrades,
          grade: formGrades[0], // legacy column mirrors first grade
          subjectKeys: formSubjects,
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

        <div className="col-span-full space-y-4">
          <MultiPickRow
            label="Sinflar"
            items={GRADE_OPTIONS.map((g) => ({ key: g, label: `${g}-sinf` }))}
            selected={formGrades}
            onChange={(next) => setFormGrades([...next].sort((a, b) => a - b))}
            emptyHint="hech biri tanlanmagan"
          />
          <MultiPickRow
            label="Fanlar"
            items={subjects.map((s) => ({ key: s.key, label: s.name }))}
            selected={formSubjects}
            onChange={(next) => setFormSubjects(next as SubjectKey[])}
            emptyHint={subjects.length === 0
              ? "Fanlar bo'limida hech qanday fan yo'q — /subjects sahifasiga o'ting"
              : "hech biri tanlanmagan"}
          />
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
              {formGrades.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-400">Avval sinflarni tanlang</td></tr>
              ) : (
                formGrades.map((g) => {
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
                })
              )}
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

// Same rounded-pill picker used on the create form. Kept in-file so this
// page has no cross-file component dep.
function MultiPickRow<K extends string | number>(props: {
  label: string;
  items: { key: K; label: string }[];
  selected: K[];
  onChange: (next: K[]) => void;
  emptyHint?: string;
}) {
  const { label, items, selected, onChange, emptyHint } = props;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="label mb-0">{label}</label>
        {items.length === 0 && emptyHint && (
          <span className="text-xs text-gray-500">{emptyHint}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const on = selected.includes(item.key);
          return (
            <button
              key={String(item.key)}
              type="button"
              onClick={() =>
                onChange(on ? selected.filter((k) => k !== item.key) : [...selected, item.key])
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition
                border
                ${on
                  ? "bg-navy text-white border-navy shadow-sm"
                  : "bg-white text-gray-700 border-gray-300 hover:border-navy hover:text-navy"}`}
            >
              {on && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
