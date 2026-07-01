"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

interface Exam {
  id: string;
  title: string;
  description?: string | null;
  examDate: string;
  academicYear?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  admissionThresholds: Record<string, { math: number; ct: number; en: number }>;
  cohortSize: number | null;
}

const GRADES = [5, 6, 7, 8, 9, 10, 11];

export default function EditExamPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [e, setE] = useState<Exam | null>(null);
  const [thresholds, setThresholds] = useState<Exam["admissionThresholds"]>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<Exam>(`/api/admin/exams/${params.id}`).then((d) => {
      setE(d);
      setThresholds(d.admissionThresholds ?? {});
    });
  }, [params.id]);

  function setThresh(grade: number, key: "math" | "ct" | "en", value: number) {
    setThresholds((prev) => {
      const cur = prev[String(grade)] ?? { math: 0, ct: 0, en: 0 };
      return { ...prev, [String(grade)]: { ...cur, [key]: value } };
    });
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!e) return;
    setPending(true);
    setError(null);
    const fd = new FormData(ev.currentTarget);
    try {
      await api(`/api/admin/exams/${e.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(fd.get("title")),
          description: (fd.get("description") as string) || null,
          examDate: new Date(String(fd.get("examDate"))).toISOString(),
          academicYear: (fd.get("academicYear") as string) || null,
          status: String(fd.get("status")),
          grade: Number(fd.get("grade")),
          admissionThresholds: thresholds,
          cohortSize: fd.get("cohortSize") ? Number(fd.get("cohortSize")) : null,
        }),
      });
      router.push(`/exams/${e.id}`);
    } catch (err) {
      setError(err instanceof ApiException ? err.error.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  if (!e) return <div className="text-gray-500">Yuklanmoqda…</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
      <Link href={`/exams/${e.id}`} className="text-sm text-navy hover:underline">← Imtihon</Link>
      <h1 className="text-2xl font-semibold text-navy">Imtihonni tahrirlash</h1>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="label">Nomi</label>
          <input name="title" defaultValue={e.title} required className="input" />
        </div>
        <div>
          <label className="label">Sinf</label>
          <select name="grade" defaultValue={e.grade} className="input">
            {GRADES.map((g) => (<option key={g} value={g}>{g}-sinf</option>))}
          </select>
        </div>
        <div>
          <label className="label">Holat</label>
          <select name="status" defaultValue={e.status} className="input">
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
        <div>
          <label className="label">Sana</label>
          <input name="examDate" type="date" required className="input"
            defaultValue={new Date(e.examDate).toISOString().slice(0, 10)} />
        </div>
        <div>
          <label className="label">O'quv yili</label>
          <input name="academicYear" defaultValue={e.academicYear ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Kohort hajmi</label>
          <input name="cohortSize" type="number" min={1} defaultValue={e.cohortSize ?? ""} className="input" />
        </div>
        <div className="col-span-full">
          <label className="label">Tavsif</label>
          <textarea name="description" defaultValue={e.description ?? ""} className="input" rows={2} />
        </div>
      </div>

      <div className="card p-4">
        <div className="font-medium mb-3 text-sm">Qabul chegaralari (% — har bir sinf uchun)</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left py-1">Sinf</th>
              <th className="text-left py-1">Matematika</th>
              <th className="text-left py-1">Ingliz</th>
              <th className="text-left py-1">Tanqidiy</th>
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g) => {
              const row = thresholds[String(g)] ?? { math: 0, ct: 0, en: 0 };
              return (
                <tr key={g} className="border-t">
                  <td className="py-1 font-medium">{g}-sinf</td>
                  {(["math", "en", "ct"] as const).map((k) => (
                    <td key={k} className="py-1 pr-2">
                      <input
                        type="number" min={0} max={100}
                        value={row[k]}
                        onChange={(ev) => setThresh(g, k, Number(ev.target.value))}
                        className="input w-24 py-1 text-xs"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          <Icon name="save" size={16} /> {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <Link href={`/exams/${e.id}`} className="btn-secondary inline-flex items-center gap-2">
          <Icon name="x" size={16} /> Bekor qilish
        </Link>
      </div>
    </form>
  );
}
