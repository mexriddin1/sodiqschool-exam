"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

interface StudentDetail {
  id: string;
  fullName: string;
  grade: number;
  groupName?: string | null;
  studentNumber?: string | null;
  phone?: string | null;
  sex?: "MALE" | "FEMALE" | null;
  results: {
    id: string;
    publicCode: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    createdAt: string;
    exam: { title: string };
  }[];
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [s, setS] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<StudentDetail>(`/api/admin/students/${params.id}`).then(setS).catch(() => undefined);
  }, [params.id]);

  const [delOpen, setDelOpen] = useState(false);

  function tryDelete() {
    if (!s) return;
    if (s.results.length > 0) {
      setError(`Bu o'quvchining ${s.results.length} ta natijasi bor. Avval natijalarni o'chiring yoki arxivlang.`);
      return;
    }
    setError(null);
    setDelOpen(true);
  }
  async function onDelete() {
    if (!s) return;
    setPending(true);
    try {
      await api(`/api/admin/students/${s.id}`, { method: "DELETE" });
      router.push("/students");
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
      setDelOpen(false);
    } finally {
      setPending(false);
    }
  }

  if (!s) return <div className="text-gray-500">Yuklanmoqda…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/students" className="text-sm text-navy hover:underline">← O'quvchilar</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">{s.fullName}</h1>
        <div className="flex gap-2 items-center">
          <Link href={`/students/${s.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
            <Icon name="edit" size={16} /> Tahrirlash
          </Link>
          <button onClick={tryDelete} disabled={pending} className="btn-danger inline-flex items-center gap-2">
            <Icon name="delete" size={16} /> O'chirish
          </button>
        </div>
      </div>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Field label="Sinf" value={`${s.grade}-sinf`} />
        <Field label="Guruh" value={s.groupName ?? "—"} />
        <Field label="Jinsi" value={s.sex === "MALE" ? "O'g'il" : s.sex === "FEMALE" ? "Qiz" : "—"} />
        <Field label="Raqam" value={s.studentNumber ?? "—"} />
        <Field label="Telefon" value={s.phone ?? "—"} />
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="card">
        <div className="px-4 py-3 border-b font-medium">Natijalar ({s.results.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Kod</th>
              <th className="text-left px-4 py-2">Imtihon</th>
              <th className="text-left px-4 py-2">Holat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.results.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-mono">{r.publicCode}</td>
                <td className="px-4 py-2">{r.exam.title}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2 text-right">
                  <IconButton icon="view" label="Ochish" href={`/results/${r.id}`} variant="primary" />
                </td>
              </tr>
            ))}
            {s.results.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Natija yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmDialog
        open={delOpen}
        title="O'quvchini o'chirish"
        itemLabel={s.fullName}
        pending={pending}
        onCancel={() => setDelOpen(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
