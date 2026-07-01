"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import FilterBar, { FilterField, StatBadge } from "@/components/FilterBar";
import { Icon } from "@/components/Icon";
import { Pagination, Paginated } from "@/components/Pagination";

interface Student {
  id: string;
  fullName: string;
  grade: number;
  groupName?: string | null;
  studentNumber?: string | null;
  sex?: "MALE" | "FEMALE" | null;
}

const GRADES = [5, 6, 7, 8, 9, 10, 11];

const PAGE_TAKE = 10;

export default function StudentsPage() {
  const router = useRouter();
  const [list, setList] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [sex, setSex] = useState<"" | "MALE" | "FEMALE">("");
  const [sort, setSort] = useState<"created-desc" | "name-asc" | "grade-asc" | "grade-desc">("created-desc");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Student | null>(null);
  const [delPending, setDelPending] = useState(false);
  const [loading, setLoading] = useState(false);

  function refresh() {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (grade) qs.set("grade", grade);
    if (sex) qs.set("sex", sex);
    qs.set("sort", sort);
    qs.set("page", String(page));
    qs.set("take", String(PAGE_TAKE));
    setLoading(true);
    api<Paginated<Student>>(`/api/admin/students?${qs}`)
      .then((d) => { setList(d.items); setTotal(d.total); setPages(d.pages); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }
  // Reset to page 1 whenever filters/sort change.
  useEffect(() => { setPage(1); }, [q, grade, sex, sort]);
  useEffect(refresh, [q, grade, sex, sort, page]);

  const stats = useMemo(() => {
    const byGrade: Record<number, number> = {};
    let male = 0, female = 0;
    for (const s of list) {
      byGrade[s.grade] = (byGrade[s.grade] ?? 0) + 1;
      if (s.sex === "MALE") male++;
      if (s.sex === "FEMALE") female++;
    }
    return { byGrade, male, female };
  }, [list]);

  const anyFilter = q || grade || sex || sort !== "created-desc";
  function resetFilters() {
    setQ(""); setGrade(""); setSex(""); setSort("created-desc");
  }

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/students/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? `${delTarget.fullName}: ${e.error.message}` : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/admin/students", {
        method: "POST",
        body: JSON.stringify({
          fullName: String(fd.get("fullName") ?? "").trim(),
          grade: Number(fd.get("grade")),
          groupName: (fd.get("groupName") as string) || null,
          studentNumber: (fd.get("studentNumber") as string) || null,
          sex: (fd.get("sex") as string) || null,
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
        <h1 className="text-2xl font-semibold text-navy">O'quvchilar</h1>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          <Icon name={showForm ? "x" : "plus"} size={16} />
          {showForm ? "Bekor qilish" : "Yangi qo'shish"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="label">F.I.O.</label>
            <input name="fullName" required className="input" />
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
            <label className="label">Jinsi</label>
            <select name="sex" defaultValue="" className="input">
              <option value="">—</option>
              <option value="MALE">O'g'il bola</option>
              <option value="FEMALE">Qiz bola</option>
            </select>
          </div>
          <div>
            <label className="label">Guruh</label>
            <input name="groupName" className="input" />
          </div>
          <div>
            <label className="label">O'quvchi raqami</label>
            <input name="studentNumber" className="input" />
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
        showReset={!!anyFilter}
        onReset={resetFilters}
        stats={
          <>
            <StatBadge variant="primary">{total} o'quvchi</StatBadge>
            {Object.entries(stats.byGrade).sort((a, b) => Number(a[0]) - Number(b[0])).map(([g, n]) => (
              <StatBadge key={g}>{g}-sinf: {n}</StatBadge>
            ))}
            {stats.male > 0 && <StatBadge variant="good">O'g'il: {stats.male}</StatBadge>}
            {stats.female > 0 && <StatBadge variant="orange">Qiz: {stats.female}</StatBadge>}
          </>
        }
      >
        <FilterField label="Qidirish" className="flex-1 min-w-[200px]">
          <input className="input" placeholder="ism, raqam, guruh, telefon" value={q} onChange={(e) => setQ(e.target.value)} />
        </FilterField>
        <FilterField label="Sinf">
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Hammasi</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}-sinf</option>)}
          </select>
        </FilterField>
        <FilterField label="Jinsi">
          <select className="input" value={sex} onChange={(e) => setSex(e.target.value as "" | "MALE" | "FEMALE")}>
            <option value="">Hammasi</option>
            <option value="MALE">O'g'il bola</option>
            <option value="FEMALE">Qiz bola</option>
          </select>
        </FilterField>
        <FilterField label="Tartiblash">
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="created-desc">Yangi qo'shilgan ↓</option>
            <option value="name-asc">Ism A-Z</option>
            <option value="grade-asc">Sinf ↑</option>
            <option value="grade-desc">Sinf ↓</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">F.I.O.</th>
              <th className="text-left px-4 py-2">Sinf</th>
              <th className="text-left px-4 py-2">Guruh</th>
              <th className="text-left px-4 py-2">Raqam</th>
              <th className="text-right px-4 py-2 w-32">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr
                key={s.id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/students/${s.id}`)}
              >
                <td className="px-4 py-2 font-medium">{s.fullName}</td>
                <td className="px-4 py-2">{s.grade}</td>
                <td className="px-4 py-2">{s.groupName ?? "—"}</td>
                <td className="px-4 py-2">{s.studentNumber ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <IconButton icon="edit" label="Tahrirlash" onClick={() => router.push(`/students/${s.id}/edit`)} variant="primary" />
                    <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(s)} variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                {total === 0 ? "O'quvchi yo'q. Yangi qo'shing." : "Filtrlarga mos o'quvchi topilmadi."}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} take={PAGE_TAKE} total={total} pages={pages} loading={loading} onChange={setPage} />
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <DeleteConfirmDialog
        open={!!delTarget}
        title="O'quvchini o'chirish"
        itemLabel={delTarget?.fullName ?? ""}
        description="O'quvchining barcha bog'liq natijalari ham o'chirilishi mumkin (agar natijalar bog'langan bo'lsa, server o'chirishni rad etadi)."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
