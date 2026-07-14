"use client";

// natijalar.sodiqschool.uz — bosh sahifa. O'quvchi ma'lumotlari (form) va
// keyingi qadam (mos testlar ro'yxati) shu yerdan boshlanadi.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const LANGUAGES = [
  { key: "UZ", label: "O'zbek" },
  { key: "RU", label: "Rus" },
  { key: "EN", label: "Ingliz" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<"MALE" | "FEMALE" | "">("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [examLanguage, setExamLanguage] = useState<"UZ" | "RU" | "EN" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName || !lastName || !sex || !phone || !grade || !examLanguage) {
      setError("Barcha maydonlarni to'ldiring.");
      return;
    }
    setSubmitting(true);
    try {
      const { leadId } = await api<{ leadId: string }>("/api/test-taking/leads", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          sex,
          phone: phone.trim(),
          grade: Number(grade),
          examLanguage,
        }),
      });
      sessionStorage.setItem("sodiq_lead_id", leadId);
      router.push(`/tests?lead=${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <header className="text-center pt-8">
        <div className="text-2xl font-semibold text-navy">Sodiq School</div>
        <div className="text-sm text-gray-500">Onlayn qabul testi</div>
      </header>

      <form onSubmit={submit} className="card p-6 space-y-4">
        <h1 className="text-lg font-semibold text-navy">O'quvchi ma'lumotlari</h1>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Ismi</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Familyasi</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Jinsi</label>
          <div className="flex gap-3 mt-1">
            {(["MALE", "FEMALE"] as const).map((s) => (
              <label key={s} className={`flex-1 text-center py-2 rounded border cursor-pointer text-sm ${sex === s ? "bg-navy text-white border-navy" : "bg-white text-gray-700"}`}>
                <input type="radio" className="hidden" checked={sex === s} onChange={() => setSex(s)} />
                {s === "MALE" ? "O'g'il bola" : "Qiz bola"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Telefon raqami</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="+998 __ ___ __ __"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Kelayotgan o'quv yilida qabul qilinyotgan sinf</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            >
              <option value="">— tanlang —</option>
              {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                <option key={g} value={g}>{g}-sinf</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Imtihon tili</label>
            <select
              value={examLanguage}
              onChange={(e) => setExamLanguage(e.target.value as "UZ" | "RU" | "EN" | "")}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            >
              <option value="">— tanlang —</option>
              {LANGUAGES.map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-navy text-white py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? "Yuborilmoqda…" : "Davom etish →"}
        </button>
      </form>
    </div>
  );
}
