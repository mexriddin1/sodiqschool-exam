"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { Pagination, Paginated } from "@/components/Pagination";

interface Row {
  id: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  name: string;
  questionCount: number;
  updatedAt: string;
}

const SUBJECT_LABEL = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
} as const;

const GRADES = [5, 6, 7, 8, 9, 10, 11];
type SubjectFilter = "" | "MATH" | "ENGLISH" | "CRITICAL_THINKING";

const PAGE_TAKE = 10;

export default function TestTemplatesPage() {
  const router = useRouter();
  const [list, setList] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Row | null>(null);
  const [delPending, setDelPending] = useState(false);

  const [subject, setSubject] = useState<SubjectFilter>("");
  const [grade, setGrade] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"grade-asc" | "grade-desc" | "name-asc" | "updated-desc" | "count-desc">("grade-asc");

  function refresh() {
    const qs = new URLSearchParams();
    if (subject) qs.set("subject", subject);
    if (grade) qs.set("grade", grade);
    qs.set("page", String(page));
    qs.set("take", String(PAGE_TAKE));
    setLoading(true);
    api<Paginated<Row>>(`/api/admin/test-templates?${qs}`)
      .then((d) => { setList(d.items); setTotal(d.total); setPages(d.pages); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }
  useEffect(() => { setPage(1); }, [subject, grade, q, sort]);
  useEffect(refresh, [subject, grade, page]);

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/test-templates/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  function resetFilters() {
    setSubject(""); setGrade(""); setQ(""); setSort("grade-asc");
  }

  // Text search + sort still happen on the current page slice — most schools
  // fit in one page anyway. For deeper filtering, subject/grade go to the
  // server via `refresh()`.
  const filtered = useMemo(() => {
    let rows = list;
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((t) =>
        t.name.toLowerCase().includes(needle) ||
        SUBJECT_LABEL[t.subject].toLowerCase().includes(needle) ||
        `${t.grade}-sinf`.includes(needle),
      );
    }
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "grade-asc": return a.grade - b.grade || a.subject.localeCompare(b.subject);
        case "grade-desc": return b.grade - a.grade || a.subject.localeCompare(b.subject);
        case "name-asc": return a.name.localeCompare(b.name);
        case "updated-desc": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "count-desc": return b.questionCount - a.questionCount;
      }
    });
    return rows;
  }, [list, q, sort]);

  // Stats based on the full filtered set (so the chips reflect filters).
  const stats = useMemo(() => {
    const subj = { MATH: 0, ENGLISH: 0, CRITICAL_THINKING: 0 };
    let total = 0;
    for (const r of filtered) {
      subj[r.subject] = (subj[r.subject] ?? 0) + 1;
      total += r.questionCount;
    }
    return { subj, total, count: filtered.length };
  }, [filtered]);

  const anyFilter = subject || grade || q || sort !== "grade-asc";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Test shablonlari</h1>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => router.push("/test-templates/new")}>
          <Icon name="plus" size={16} /> Yangi test
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Har bir (fan, sinf) uchun bitta test shabloni. Admin natija yaratganda
        savol strukturasi shablondan import qilinadi.
      </p>

      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="label">Fan</label>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value as SubjectFilter)}>
              <option value="">Hammasi</option>
              <option value="MATH">Matematika</option>
              <option value="ENGLISH">Ingliz tili</option>
              <option value="CRITICAL_THINKING">Tanqidiy fikrlash</option>
            </select>
          </div>
          <div>
            <label className="label">Sinf</label>
            <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Hammasi</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}-sinf</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="label">Qidiruv (nom / fan / sinf)</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="masalan: 5-sinf yoki Ingliz" />
          </div>
          <div>
            <label className="label">Tartiblash</label>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="grade-asc">Sinf ↑</option>
              <option value="grade-desc">Sinf ↓</option>
              <option value="name-asc">Nom A-Z</option>
              <option value="updated-desc">Yangilangan ↓</option>
              <option value="count-desc">Savol soni ↓</option>
            </select>
          </div>
          {anyFilter && (
            <button type="button" onClick={resetFilters} className="text-xs text-bad hover:underline">
              Filtrlarni tozalash
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-navy text-white">{total} shablon</span>
          <span className="badge bg-gray-100 text-gray-700">{stats.total} savol</span>
          {stats.subj.MATH > 0 && <span className="badge bg-good/10 text-good">Matematika: {stats.subj.MATH}</span>}
          {stats.subj.ENGLISH > 0 && <span className="badge bg-warn/10 text-warn">Ingliz: {stats.subj.ENGLISH}</span>}
          {stats.subj.CRITICAL_THINKING > 0 && <span className="badge bg-orange/10 text-orange">Tanqidiy: {stats.subj.CRITICAL_THINKING}</span>}
        </div>
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Nomi</th>
              <th className="text-left px-4 py-2">Fan</th>
              <th className="text-left px-4 py-2">Sinf</th>
              <th className="text-left px-4 py-2">Savollar</th>
              <th className="text-left px-4 py-2">Yangilangan</th>
              <th className="text-right px-4 py-2 w-32">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/test-templates/${t.id}`)}
              >
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2">{SUBJECT_LABEL[t.subject]}</td>
                <td className="px-4 py-2">{t.grade}-sinf</td>
                <td className="px-4 py-2">{t.questionCount}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{new Date(t.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                    <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(t)} variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                {total === 0 ? "Shablon yo'q. Yangi yarating." : "Filtrlarga mos shablon topilmadi."}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} take={PAGE_TAKE} total={total} pages={pages} loading={loading} onChange={setPage} />
      </div>

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Test shablonini o'chirish"
        itemLabel={delTarget?.name ?? ""}
        description="Bu shablonni ishlatadigan natijalar mavjud bo'lsa, savollar nusxasi natijalarda saqlanib qoladi."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
