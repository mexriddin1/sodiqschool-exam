"use client";

// Leadlar — natijalar.sodiqschool.uz saytida formani to'ldirgan barcha
// o'quvchilar. Status filter bilan qidiruv qilish mumkin.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

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

interface Page {
  items: LeadRow[];
  total: number;
  page: number;
  take: number;
  pages: number;
}

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
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [grade, setGrade] = useState<number | "">("");
  const [search, setSearch] = useState("");

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (grade) qs.set("grade", String(grade));
    if (search.trim()) qs.set("search", search.trim());
    qs.set("take", "200");
    return qs.toString();
  }, [status, grade, search]);

  useEffect(() => {
    setLoading(true);
    api<Page>(`/api/admin/leads?${query}`)
      .then((d) => {
        setRows(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [query]);

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

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b">
              <th className="p-3">Ism Familya</th>
              <th className="p-3">Sinf</th>
              <th className="p-3">Til</th>
              <th className="p-3">Tel</th>
              <th className="p-3">Status</th>
              <th className="p-3">Urinishlar</th>
              <th className="p-3">Sana</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">Yuklanmoqda…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">Hech qanday lead yo'q</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
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
                <td className="p-3">
                  <Link href={`/leads/${r.id}`} className="text-navy underline text-sm">Ochish</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
