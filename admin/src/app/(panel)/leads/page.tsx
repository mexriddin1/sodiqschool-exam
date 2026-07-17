"use client";

// Leadlar — natijalar.sodiqschool.uz saytida formani to'ldirgan barcha
// o'quvchilar. Status filter bilan qidiruv qilish mumkin.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Pagination, Paginated } from "@/components/Pagination";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

type LeadStatus = "FORM_ONLY" | "STARTED" | "COMPLETED" | "PUBLISHED";
type Language = "UZ" | "RU" | "EN";

interface LeadRow {
  id: string;
  firstName: string;
  lastName: string;
  sex: "MALE" | "FEMALE";
  phone: string;
  grade: number;
  examLanguage: Language;
  status: LeadStatus;
  studentId: string | null;
  loginCode: string | null;
  attemptCount: number;
  createdAt: string;
}

const PAGE_TAKE = 20;

const STATUS_LABEL: Record<LeadStatus, string> = {
  FORM_ONLY: "Faqat forma",
  STARTED: "Testni boshladi",
  COMPLETED: "Testni tugatdi",
  PUBLISHED: "Natija chop etildi",
};

const STATUS_COLOR: Record<LeadStatus, string> = {
  FORM_ONLY: "bg-gray-100 text-gray-700",
  STARTED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
};

export default function LeadsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [grade, setGrade] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delPending, setDelPending] = useState(false);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (grade) qs.set("grade", String(grade));
    if (search.trim()) qs.set("search", search.trim());
    // Ilgari bu yerda `take=200` qattiq yozilgan va sahifalash yo'q edi —
    // ya'ni 200-dan ortiq lead jimgina ko'rinmasdi. Backend allaqachon
    // sahifalangan javob qaytaradi (wrapPaginated).
    qs.set("take", String(PAGE_TAKE));
    qs.set("page", String(page));
    return qs.toString();
  }, [status, grade, search, page]);

  // Filtr o'zgarsa 1-sahifaga qaytamiz, aks holda bo'sh sahifada qolib ketish
  // mumkin (boshqa ro'yxatlardagi bilan bir xil qoida).
  useEffect(() => { setPage(1); }, [status, grade, search]);

  const load = useCallback(() => {
    setLoading(true);
    api<Paginated<LeadRow>>(`/api/admin/leads?${query}`)
      .then((d) => {
        setRows(d.items ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 1);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => { load(); }, [load]);

  // Sahifa/filtr o'zgarsa tanlovni tozalaymiz — ko'rinmaydigan qatorni bexosdan
  // o'chirib yubormaslik uchun.
  useEffect(() => { setSelected(new Set()); }, [query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  async function bulkDelete() {
    setDelPending(true);
    try {
      await api("/api/admin/leads/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: [...selected] }),
      });
      setSelected(new Set());
      setConfirmOpen(false);
      load();
    } catch {
      // Xato bo'lsa dialog ochiq qoladi; api() ApiException'ni tashlaydi.
    } finally {
      setDelPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-navy">Leadlar</h1>
        <div className="text-sm text-gray-500">Jami: {total}</div>
      </div>
      <p className="text-sm text-gray-600 max-w-3xl">
        natijalar.sodiqschool.uz saytida ro'yxatdan o'tgan o'quvchilar. Test topshirmagan bo'lsalar
        ham, ular ma'lumot manbasi (kontakt uchun) sifatida saqlanadi.
      </p>

      <div className="flex flex-wrap gap-3 items-center card p-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus | "ALL")}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="ALL">Barcha statuslar</option>
          {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Barcha sinflar</option>
          {[5, 6, 7, 8, 9, 10, 11].map((g) => (
            <option key={g} value={g}>{g}-sinf</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Ism yoki telefon bo'yicha qidirish…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1 text-sm flex-1 min-w-[220px]"
        />
      </div>

      {selected.size > 0 && (
        <div className="card p-3 flex items-center justify-between gap-3 border-bad/40 bg-bad/5">
          <span className="text-sm text-gray-700">
            <b>{selected.size}</b> ta lead tanlandi
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setSelected(new Set())}>
              Tanlovni bekor qilish
            </button>
            <button type="button" className="btn-danger text-sm" onClick={() => setConfirmOpen(true)}>
              O'chirish ({selected.size})
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={toggleAll}
                  aria-label="Sahifadagi hammasini tanlash"
                />
              </th>
              <th className="p-3">Ism Familya</th>
              <th className="p-3">Sinf</th>
              <th className="p-3">Til</th>
              <th className="p-3">Tel</th>
              <th className="p-3">Status</th>
              <th className="p-3">Urinishlar</th>
              <th className="p-3">Sana</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">Yuklanmoqda…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">Hech qanday lead yo'q</td></tr>
            )}
            {/* Qator bosilsa detali ochiladi; checkbox katakchasi navigatsiyani
                to'xtatadi (stopPropagation). */}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/leads/${r.id}`)}
                className={`border-b hover:bg-gray-50 cursor-pointer ${selected.has(r.id) ? "bg-bad/5" : ""}`}
              >
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`${r.firstName} ${r.lastName}ni tanlash`}
                  />
                </td>
                <td className="p-3 font-medium text-navy">
                  {r.firstName} {r.lastName}
                </td>
                <td className="p-3">{r.grade}</td>
                <td className="p-3">{r.examLanguage}</td>
                <td className="p-3">{r.phone}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLOR[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="p-3">{r.attemptCount}</td>
                <td className="p-3 text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleString("uz-UZ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          take={PAGE_TAKE}
          total={total}
          pages={pages}
          loading={loading}
          onChange={setPage}
        />
      </div>

      <DeleteConfirmDialog
        open={confirmOpen}
        title="Leadlarni o'chirish"
        itemLabel={`${selected.size} ta lead`}
        confirmWord="O'CHIRISH"
        description="Tanlangan leadlar butunlay o'chadi: urinishlari, chala testlari, va imtihonni tugatgan bo'lsa o'quvchisi, natijasi hamda nashr qilingan hisoboti ham. Qaytarib bo'lmaydi."
        pending={delPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={bulkDelete}
      />
    </div>
  );
}
