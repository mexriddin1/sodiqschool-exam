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
  examDate: string;
  academicYear?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  cohortSize: number | null;
}

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
      await api("/api/admin/exams", {
        method: "POST",
        body: JSON.stringify({
          title: String(fd.get("title")),
          description: (fd.get("description") as string) || null,
          examDate: new Date(String(fd.get("examDate"))).toISOString(),
          academicYear: (fd.get("academicYear") as string) || null,
          status: String(fd.get("status")),
          grade: Number(fd.get("grade")),
          admissionThresholds: DEFAULT_ADMISSION_THRESHOLDS,
          gradingConfiguration: {},
          cohortSize: fd.get("cohortSize") ? Number(fd.get("cohortSize")) : null,
        }),
      });
      setShowForm(false);
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
          <div>
            <label className="label">Sinf</label>
            <select name="grade" defaultValue="5" className="input">
              {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                <option key={g} value={g}>{g}-sinf</option>
              ))}
            </select>
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
          <div className="col-span-full text-xs text-gray-500">
            Qabul chegaralari avtomatik <span className="font-mono">resource/result.text</span>
            dagi default jadvaldan olinadi.
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
                <td className="px-4 py-2">{e.grade}</td>
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
