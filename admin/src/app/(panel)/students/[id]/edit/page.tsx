"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

// Edit form kept in sync with the create form on /students.
interface Student {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  uid?: string | null;
  examLanguage?: string | null;
  grade: number;
  sex?: "MALE" | "FEMALE" | null;
  phone?: string | null;
}

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [s, setS] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<Student>(`/api/admin/students/${params.id}`).then(setS).catch(() => undefined);
  }, [params.id]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!s) return;
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api(`/api/admin/students/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: String(fd.get("firstName") ?? "").trim(),
          lastName: String(fd.get("lastName") ?? "").trim(),
          uid: (fd.get("uid") as string) || null,
          examLanguage: (fd.get("examLanguage") as string) || null,
          grade: Number(fd.get("grade")),
          sex: (fd.get("sex") as string) || null,
          phone: (String(fd.get("phone") ?? "").trim()) || null,
        }),
      });
      router.push(`/students/${s.id}`);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  if (!s) return <div className="text-gray-500">Yuklanmoqda…</div>;

  // Fall back to splitting fullName when the row was created before the
  // firstName/lastName columns landed, so old students still show up nicely
  // in the form on first open.
  const fallbackParts = (s.fullName ?? "").trim().split(/\s+/);
  const initFirst = s.firstName ?? fallbackParts[0] ?? "";
  const initLast = s.lastName ?? fallbackParts.slice(1).join(" ") ?? "";

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <Link href={`/students/${s.id}`} className="text-sm text-navy hover:underline">← O'quvchi</Link>
      <h1 className="text-2xl font-semibold text-navy">O'quvchini tahrirlash</h1>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Ism</label>
          <input name="firstName" required defaultValue={initFirst} className="input" placeholder="Ism" />
        </div>
        <div>
          <label className="label">Familya</label>
          <input name="lastName" required defaultValue={initLast} className="input" placeholder="Familya" />
        </div>
        <div>
          <label className="label">UID</label>
          <input name="uid" defaultValue={s.uid ?? ""} className="input" placeholder="SS-2026-0001" />
        </div>
        <div>
          <label className="label">Jinsi</label>
          <select name="sex" defaultValue={s.sex ?? ""} className="input">
            <option value="">—</option>
            <option value="MALE">O'g'il bola</option>
            <option value="FEMALE">Qiz bola</option>
          </select>
        </div>
        <div>
          <label className="label">Sinf</label>
          <select name="grade" defaultValue={s.grade} className="input">
            {[5, 6, 7, 8, 9, 10, 11].map((g) => (
              <option key={g} value={g}>{g}-sinf</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Imtihon tili</label>
          <select name="examLanguage" defaultValue={s.examLanguage ?? ""} className="input">
            <option value="">—</option>
            <option value="UZ">O'zbekcha</option>
            <option value="RU">Ruscha</option>
            <option value="EN">Inglizcha</option>
          </select>
        </div>
        <div>
          <label className="label">Telefon</label>
          <input name="phone" defaultValue={s.phone ?? ""} className="input" placeholder="+998 90 123 45 67" inputMode="tel" />
        </div>
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          <Icon name="save" size={16} /> {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <Link href={`/students/${s.id}`} className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
