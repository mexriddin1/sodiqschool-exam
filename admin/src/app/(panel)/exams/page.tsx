"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import FilterBar, { FilterField, StatBadge } from "@/components/FilterBar";
import { Pagination, Paginated } from "@/components/Pagination";

const GRADES = [5, 6, 7, 8, 9, 10, 11];

// Mirrors @sodiq/compute DEFAULT_ADMISSION_THRESHOLDS (which is a Node-only
// module path due to crypto). Source: resource/result.text.
const DEFAULT_ADMISSION_THRESHOLDS = {
  "5":  { math: 30, ct: 40, en: 30 },
  "6":  { math: 30, ct: 40, en: 30 },
  "7":  { math: 35, ct: 30, en: 35 },
  "8":  { math: 35, ct: 30, en: 35 },
  "9":  { math: 35, ct: 25, en: 40 },
  "10": { math: 35, ct: 25, en: 40 },
  "11": { math: 35, ct: 25, en: 40 },
};

interface Exam {
  id: string;
  title: string;
  grade: number;
  // New multi-grade columns. Older rows may not have them yet, so both are
  // optional here and the display falls back to `grade` (single) if empty.
  grades?: number[];
  subjectKeys?: string[];
  examDate: string;
  academicYear?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  cohortSize: number | null;
  _count?: { results: number; templates: number };
}

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
interface Subject { id: string; key: SubjectKey; name: string; active: boolean }
const GRADE_OPTIONS = [5, 6, 7, 8, 9, 10, 11];

const PAGE_TAKE = 10;

export default function ExamsPage() {
  const router = useRouter();
  const [list, setList] = useState<Exam[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Exam | null>(null);
  const [delPending, setDelPending] = useState(false);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [status, setStatus] = useState<"" | "DRAFT" | "ACTIVE" | "ARCHIVED">("");
  const [academicYear, setAcademicYear] = useState<string>("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "grade-asc" | "title-asc">("date-desc");
  // Multi-grade + multi-subject picker state for the create form.
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [formGrades, setFormGrades] = useState<number[]>([5]);
  const [formSubjects, setFormSubjects] = useState<SubjectKey[]>(["MATH", "ENGLISH", "CRITICAL_THINKING"]);
  // Composite weights per grade (percent, integers 0-100 summing to 100 per
  // row). Default matrix mirrors Sodiq School's official Qabul 2026 setup —
  // matematika dominance grows from grade 7 onward, CT weight rises for
  // primary grades. Admin can override any cell before saving.
  const DEFAULT_WEIGHTS_MATRIX: Record<number, { math: number; ct: number; en: number }> = {
    5: { math: 30, ct: 40, en: 30 },
    6: { math: 30, ct: 40, en: 30 },
    7: { math: 35, ct: 30, en: 35 },
    8: { math: 35, ct: 30, en: 35 },
    9: { math: 35, ct: 25, en: 40 },
    10: { math: 35, ct: 25, en: 40 },
    11: { math: 35, ct: 25, en: 40 },
  };
  const [formWeightsByGrade, setFormWeightsByGrade] = useState<Record<number, { math: number; ct: number; en: number }>>(
    DEFAULT_WEIGHTS_MATRIX,
  );

  useEffect(() => {
    api<Subject[]>("/api/admin/subjects").then((d) => setSubjects(d.filter((s) => s.active))).catch(() => undefined);
  }, []);

  function refresh() {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (grade) qs.set("grade", grade);
    if (status) qs.set("status", status);
    if (academicYear) qs.set("academicYear", academicYear);
    qs.set("page", String(page));
    qs.set("take", String(PAGE_TAKE));
    setLoading(true);
    api<Paginated<Exam>>(`/api/admin/exams?${qs}`)
      .then((d) => { setList(d.items); setTotal(d.total); setPages(d.pages); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }
  useEffect(() => { setPage(1); }, [q, grade, status, academicYear, sort]);
  useEffect(refresh, [q, grade, status, academicYear, page]);

  // Client-only sort over the current page. Backend already returns
  // ordered-by-examDate desc; other sorts refine the page slice locally.
  const filtered = useMemo(() => {
    return [...list].sort((a, b) => {
      switch (sort) {
        case "date-asc": return new Date(a.examDate).getTime() - new Date(b.examDate).getTime();
        case "date-desc": return new Date(b.examDate).getTime() - new Date(a.examDate).getTime();
        case "grade-asc": return a.grade - b.grade;
        case "title-asc": return a.title.localeCompare(b.title);
      }
    });
  }, [list, sort]);

  const stats = useMemo(() => {
    const byStatus = { DRAFT: 0, ACTIVE: 0, ARCHIVED: 0 };
    for (const e of filtered) byStatus[e.status]++;
    return byStatus;
  }, [filtered]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of list) if (e.academicYear) set.add(e.academicYear);
    return Array.from(set).sort();
  }, [list]);

  const anyFilter = !!(q || grade || status || academicYear || sort !== "date-desc");
  function resetFilters() {
    setQ(""); setGrade(""); setStatus(""); setAcademicYear(""); setSort("date-desc");
  }

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/exams/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? `${delTarget.title}: ${e.error.message}` : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (formGrades.length === 0) throw new Error("Kamida bitta sinf tanlang.");
      if (formSubjects.length === 0) throw new Error("Kamida bitta fan tanlang.");
      // Per-grade weights — only include rows for grades this exam covers,
      // and normalise to the canonical `criticalThinking`/`english` keys the
      // compute engine expects (form uses ct/en shorthand for input labels).
      const weightsByGrade: Record<string, { math: number; english: number; criticalThinking: number }> = {};
      for (const g of formGrades) {
        const row = formWeightsByGrade[g] ?? DEFAULT_WEIGHTS_MATRIX[g] ?? { math: 40, ct: 30, en: 30 };
        weightsByGrade[String(g)] = { math: row.math, english: row.en, criticalThinking: row.ct };
      }
      // Sum-per-row validation. Skip when a grade row sums to exactly 100
      // (or is close to it after admin edits). Warn loudly otherwise.
      for (const g of formGrades) {
        const row = formWeightsByGrade[g] ?? DEFAULT_WEIGHTS_MATRIX[g];
        if (!row) continue;
        const sum = row.math + row.ct + row.en;
        if (sum !== 100) throw new Error(`${g}-sinf uchun og'irliklar yig'indisi ${sum}% (100 bo'lishi kerak).`);
      }

      await api("/api/admin/exams", {
        method: "POST",
        body: JSON.stringify({
          title: String(fd.get("title")),
          description: (fd.get("description") as string) || null,
          examDate: new Date(String(fd.get("examDate"))).toISOString(),
          academicYear: (fd.get("academicYear") as string) || null,
          status: String(fd.get("status")),
          grades: formGrades,
          grade: formGrades[0], // legacy column mirrors first grade
          subjectKeys: formSubjects,
          admissionThresholds: DEFAULT_ADMISSION_THRESHOLDS,
          gradingConfiguration: { weightsByGrade },
          cohortSize: fd.get("cohortSize") ? Number(fd.get("cohortSize")) : null,
        }),
      });
      setShowForm(false);
      setFormGrades([5]);
      setFormSubjects(["MATH", "ENGLISH", "CRITICAL_THINKING"]);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Imtihonlar</h1>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          <Icon name={showForm ? "x" : "plus"} size={16} />
          {showForm ? "Bekor qilish" : "Yangi imtihon"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="label">Nomi</label>
            <input name="title" required className="input" />
          </div>
          <div className="col-span-4 space-y-4">
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
              onChange={(next) => setFormSubjects(next as typeof formSubjects)}
              emptyHint={subjects.length === 0
                ? "Fanlar bo'limida hech qanday fan yo'q — /subjects sahifasiga o'ting"
                : "hech biri tanlanmagan"}
            />
          </div>
          <div>
            <label className="label">Holat</label>
            <select name="status" defaultValue="ACTIVE" className="input">
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          <div>
            <label className="label">Sana</label>
            <input name="examDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label">O'quv yili</label>
            <input name="academicYear" placeholder="2025-2026" className="input" />
          </div>
          <div>
            <label className="label">Kohort hajmi</label>
            <input name="cohortSize" type="number" min={1} className="input" />
          </div>
          <div className="col-span-full">
            <label className="label">Tavsif</label>
            <textarea name="description" className="input" rows={2} />
          </div>
          {/* Per-grade composite weights. Only rows for grades this exam
              covers show up so the form stays short. Each row must sum to 100%
              — the form blocks save otherwise. */}
          <div className="col-span-full">
            <label className="label">Fanlar og'irligi (har sinf uchun alohida)</label>
            <div className="text-xs text-gray-500 mb-2">
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
                      const row = formWeightsByGrade[g] ?? DEFAULT_WEIGHTS_MATRIX[g] ?? { math: 40, ct: 30, en: 30 };
                      const sum = row.math + row.ct + row.en;
                      const ok = sum === 100;
                      const upd = (patch: Partial<typeof row>) => {
                        setFormWeightsByGrade((prev) => ({ ...prev, [g]: { ...row, ...patch } }));
                      };
                      return (
                        <tr key={g} className="border-t">
                          <td className="px-3 py-2 font-medium">{g}-sinf</td>
                          <td className="px-3 py-1 text-right">
                            <input
                              type="number" min={0} max={100}
                              className="input py-1 text-sm text-right w-20"
                              value={row.math}
                              onChange={(e) => upd({ math: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-3 py-1 text-right">
                            <input
                              type="number" min={0} max={100}
                              className="input py-1 text-sm text-right w-20"
                              value={row.ct}
                              onChange={(e) => upd({ ct: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-3 py-1 text-right">
                            <input
                              type="number" min={0} max={100}
                              className="input py-1 text-sm text-right w-20"
                              value={row.en}
                              onChange={(e) => upd({ en: Number(e.target.value) || 0 })}
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
          {error && <div className="col-span-full text-bad text-sm">{error}</div>}
          <div className="col-span-full">
            <button className="btn-primary inline-flex items-center gap-2" type="submit">
              <Icon name="save" size={16} /> Saqlash
            </button>
          </div>
        </form>
      )}

      <FilterBar
        showReset={anyFilter}
        onReset={resetFilters}
        stats={
          <>
            <StatBadge variant="primary">{total} imtihon</StatBadge>
            {stats.DRAFT > 0 && <StatBadge>DRAFT: {stats.DRAFT}</StatBadge>}
            {stats.ACTIVE > 0 && <StatBadge variant="good">ACTIVE: {stats.ACTIVE}</StatBadge>}
            {stats.ARCHIVED > 0 && <StatBadge variant="warn">ARCHIVED: {stats.ARCHIVED}</StatBadge>}
          </>
        }
      >
        <FilterField label="Qidirish" className="flex-1 min-w-[180px]">
          <input className="input" placeholder="nom, tavsif" value={q} onChange={(e) => setQ(e.target.value)} />
        </FilterField>
        <FilterField label="Sinf">
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Hammasi</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}-sinf</option>)}
          </select>
        </FilterField>
        <FilterField label="Holat">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as "" | "DRAFT" | "ACTIVE" | "ARCHIVED")}>
            <option value="">Hammasi</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </FilterField>
        {years.length > 0 && (
          <FilterField label="O'quv yili">
            <select className="input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              <option value="">Hammasi</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </FilterField>
        )}
        <FilterField label="Tartiblash">
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="date-desc">Sana ↓</option>
            <option value="date-asc">Sana ↑</option>
            <option value="grade-asc">Sinf ↑</option>
            <option value="title-asc">Nom A-Z</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Nomi</th>
              <th className="text-left px-4 py-2">Sinf</th>
              <th className="text-left px-4 py-2">Sana</th>
              <th className="text-left px-4 py-2">Holat</th>
              <th className="text-left px-4 py-2">Kohort</th>
              <th className="text-right px-4 py-2 w-32">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/exams/${e.id}`)}
              >
                <td className="px-4 py-2 font-medium">{e.title}</td>
                <td className="px-4 py-2">{e.grades && e.grades.length > 0 ? e.grades.join(", ") : e.grade}</td>
                <td className="px-4 py-2">{new Date(e.examDate).toLocaleDateString()}</td>
                <td className="px-4 py-2">{e.status}</td>
                <td className="px-4 py-2">{e.cohortSize ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                    <IconButton icon="edit" label="Tahrirlash" onClick={() => router.push(`/exams/${e.id}/edit`)} variant="primary" />
                    <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(e)} variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                {total === 0 ? "Imtihon yo'q. Yangi qo'shing." : "Filtrlarga mos imtihon topilmadi."}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} take={PAGE_TAKE} total={total} pages={pages} loading={loading} onChange={setPage} />
      </div>

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Imtihonni o'chirish"
        itemLabel={delTarget?.title ?? ""}
        description="Bog'liq natijalar mavjud bo'lsa, server o'chirishni rad etadi."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}

/**
 * Compact multi-select row used by the exam create form. Renders labelled
 * pill chips (rounded-full). The items array is generic over the key type
 * so the same component handles both grade numbers and subject strings.
 */
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
