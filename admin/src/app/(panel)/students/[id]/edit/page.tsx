"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

interface Student {
  id: string;
  fullName: string;
  grade: number;
  groupName?: string | null;
  studentNumber?: string | null;
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
          fullName: String(fd.get("fullName")),
          grade: Number(fd.get("grade")),
          groupName: (fd.get("groupName") as string) || null,
          studentNumber: (fd.get("studentNumber") as string) || null,
          phone: (fd.get("phone") as string) || null,
          sex: (fd.get("sex") as string) || null,
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

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <Link href={`/students/${s.id}`} className="text-sm text-navy hover:underline">← O'quvchi</Link>
      <h1 className="text-2xl font-semibold text-navy">O'quvchini tahrirlash</h1>

      <div className="card p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">F.I.O.</label>
          <input name="fullName" defaultValue={s.fullName} required className="input" />
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
          <label className="label">Jinsi</label>
          <select name="sex" defaultValue={s.sex ?? ""} className="input">
            <option value="">—</option>
            <option value="MALE">O'g'il bola</option>
            <option value="FEMALE">Qiz bola</option>
          </select>
        </div>
        <div>
          <label className="label">Guruh</label>
          <input name="groupName" defaultValue={s.groupName ?? ""} className="input" />
        </div>
        <div>
          <label className="label">O'quvchi raqami</label>
          <input name="studentNumber" defaultValue={s.studentNumber ?? ""} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Telefon</label>
          <input name="phone" defaultValue={s.phone ?? ""} className="input" />
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
