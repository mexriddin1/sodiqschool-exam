"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiException, API_BASE } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import FilterBar, { FilterField, StatBadge } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";

const GRADES = [5, 6, 7, 8, 9, 10, 11];

interface ResultRow {
  id: string;
  publicCode: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  student: { fullName: string; grade: number };
  exam: { title: string };
}

interface PagedResponse {
  items: ResultRow[];
  total: number;
  page: number;
  take: number;
  pages: number;
}

const PAGE_TAKE = 10;

export default function ResultsPage() {
  const router = useRouter();
  const [list, setList] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [examId, setExamId] = useState<string>("");
  const [exams, setExams] = useState<{ id: string; title: string; grade: number }[]>([]);
  const [sort, setSort] = useState<"created-desc" | "created-asc">("created-desc");
  const [error, setError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<ResultRow | null>(null);
  const [delPending, setDelPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportPending, setExportPending] = useState(false);

  async function onExport() {
    setError(null);
    setExportPending(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (status) qs.set("status", status);
      if (examId) qs.set("examId", examId);
      if (grade) qs.set("grade", grade);
      if (sort !== "created-desc") qs.set("sort", sort);
      const res = await fetch(`${API_BASE}/api/admin/results/export.csv?${qs}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? `natijalar-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? `Eksport xato: ${e.message}` : "Eksport xato");
    } finally {
      setExportPending(false);
    }
  }

  useEffect(() => {
    // Combobox needs the full roster; endpoint is paginated so pass a big take.
    api<{ items: { id: string; title: string; grade: number }[] }>("/api/admin/exams?take=1000")
      .then((d) => setExams(d.items))
      .catch(() => undefined);
  }, []);

  function refresh() {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    if (examId) qs.set("examId", examId);
    if (grade) qs.set("grade", grade);
    if (sort !== "created-desc") qs.set("sort", sort);
    qs.set("page", String(page));
    qs.set("take", String(PAGE_TAKE));
    setLoading(true);
    api<PagedResponse>(`/api/admin/results?${qs}`)
      .then((d) => { setList(d.items); setTotal(d.total); setPages(d.pages); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }
  // Reset to page 1 when any filter/sort changes; keep page when only page changes.
  useEffect(() => { setPage(1); }, [q, status, examId, grade, sort]);
  useEffect(refresh, [q, status, examId, grade, sort, page]);

  const stats = useMemo(() => {
    const out = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
    for (const r of list) out[r.status]++;
    return out;
  }, [list]);

  const anyFilter = !!(q || status || grade || examId || sort !== "created-desc");
  function resetFilters() {
    setQ(""); setStatus(""); setGrade(""); setExamId(""); setSort("created-desc");
  }

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/results/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? `${delTarget.publicCode}: ${e.error.message}` : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Natijalar</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={total === 0 || exportPending}
            title={total === 0 ? "Filtrga mos natija yo'q" : `Filtrga mos ${total} ta natijani CSV qilib yuklab olish`}
            onClick={onExport}
          >
            <Icon name="download" size={16} /> {exportPending ? "Tayyorlanmoqda…" : "CSV eksport"}
          </button>
          <Link href="/results/import" className="btn-secondary inline-flex items-center gap-2">
            <Icon name="upload" size={16} /> CSV/JSON import
          </Link>
          <Link href="/results/new" className="btn-primary inline-flex items-center gap-2">
            <Icon name="plus" size={16} /> Yangi natija
          </Link>
        </div>
      </div>

      <FilterBar
        showReset={anyFilter}
        onReset={resetFilters}
        stats={
          <>
            <StatBadge variant="primary">{total} natija</StatBadge>
            {stats.DRAFT > 0 && <StatBadge>Qoralama: {stats.DRAFT}</StatBadge>}
            {stats.PUBLISHED > 0 && <StatBadge variant="good">Nashr etilgan: {stats.PUBLISHED}</StatBadge>}
            {stats.ARCHIVED > 0 && <StatBadge variant="warn">Arxiv: {stats.ARCHIVED}</StatBadge>}
          </>
        }
      >
        <FilterField label="Qidirish" className="flex-1 min-w-[180px]">
          <input className="input" placeholder="kod yoki o'quvchi ismi" value={q} onChange={(e) => setQ(e.target.value)} />
        </FilterField>
        <FilterField label="Holat">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Hammasi</option>
            <option value="DRAFT">Qoralama</option>
            <option value="PUBLISHED">Nashr etilgan</option>
            <option value="ARCHIVED">Arxiv</option>
          </select>
        </FilterField>
        <FilterField label="Sinf">
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Hammasi</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}-sinf</option>)}
          </select>
        </FilterField>
        <FilterField label="Imtihon" className="min-w-[200px]">
          <select className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Hammasi</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.grade}-s)</option>)}
          </select>
        </FilterField>
        <FilterField label="Tartiblash">
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="created-desc">Yangi yaratilgan ↓</option>
            <option value="created-asc">Eski ↑</option>
          </select>
        </FilterField>
      </FilterBar>

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">O'quvchi</th>
              <th className="text-left px-4 py-2">Imtihon</th>
              <th className="text-left px-4 py-2">Holat</th>
              <th className="text-right px-4 py-2 w-32">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr
                key={r.id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/results/${r.id}`)}
              >
                <td className="px-4 py-2">{r.student.fullName} ({r.student.grade}-sinf)</td>
                <td className="px-4 py-2">{r.exam.title}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2 text-right">
                  {/* Stop propagation so the row click doesn't fire and the
                      user still hits the specific action they clicked. */}
                  <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <IconButton icon="edit" label="Tahrirlash" onClick={() => router.push(`/results/${r.id}/edit`)} variant="primary" />
                    <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(r)} variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                {total === 0 ? "Natija yo'q. Yangi yarating." : "Filtrlarga mos natija topilmadi."}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} take={PAGE_TAKE} total={total} pages={pages} loading={loading} onChange={setPage} />
      </div>

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Natijani o'chirish"
        itemLabel={`${delTarget?.student.fullName ?? ""} — ${delTarget?.exam.title ?? ""}`}
        confirmWord="o'chir"
        description={`${delTarget?.student.fullName ?? ""} — ${delTarget?.exam.title ?? ""}. Natija va uning barcha fan-natijalari o'chiriladi.`}
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
