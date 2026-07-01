"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

interface ExamDetail {
  id: string;
  title: string;
  description?: string | null;
  examDate: string;
  academicYear?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  admissionThresholds: Record<string, { math: number; ct: number; en: number }>;
  cohortSize: number | null;
  _count?: { results: number };
}

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [e, setE] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<ExamDetail>(`/api/admin/exams/${params.id}`).then(setE).catch(() => undefined);
  }, [params.id]);

  const [delOpen, setDelOpen] = useState(false);

  function tryDelete() {
    if (!e) return;
    const used = e._count?.results ?? 0;
    if (used > 0) {
      setError(`Bu imtihonga ${used} ta natija bog'langan. Avval natijalarni o'chiring yoki arxivlang.`);
      return;
    }
    setError(null);
    setDelOpen(true);
  }
  async function onDelete() {
    if (!e) return;
    setPending(true);
    try {
      await api(`/api/admin/exams/${e.id}`, { method: "DELETE" });
      router.push("/exams");
    } catch (err) {
      setError(err instanceof ApiException ? err.error.message : "O'chirishda xato");
      setDelOpen(false);
    } finally {
      setPending(false);
    }
  }

  if (!e) return <div className="text-gray-500">Yuklanmoqda…</div>;

  const thr = e.admissionThresholds?.[String(e.grade)];

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/exams" className="text-sm text-navy hover:underline">← Imtihonlar</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">{e.title}</h1>
        <div className="flex gap-2 items-center">
          <Link href={`/exams/${e.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
            <Icon name="edit" size={16} /> Tahrirlash
          </Link>
          <button onClick={tryDelete} disabled={pending} className="btn-danger inline-flex items-center gap-2">
            <Icon name="delete" size={16} /> O'chirish
          </button>
        </div>
      </div>

      <div className="card p-4 grid grid-cols-3 gap-3 text-sm">
        <Field label="Sinf" value={`${e.grade}-sinf`} />
        <Field label="Sana" value={new Date(e.examDate).toLocaleDateString()} />
        <Field label="Holat" value={e.status} />
        <Field label="O'quv yili" value={e.academicYear ?? "—"} />
        <Field label="Kohort" value={e.cohortSize?.toString() ?? "—"} />
        <Field label="Natijalar" value={(e._count?.results ?? 0).toString()} />
      </div>

      {e.description && (
        <div className="card p-4 text-sm whitespace-pre-wrap">{e.description}</div>
      )}

      <div className="card p-4">
        <div className="font-medium mb-2 text-sm">{e.grade}-sinf qabul chegaralari</div>
        {thr ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Field label="Matematika" value={`${thr.math}%`} />
            <Field label="Ingliz tili" value={`${thr.en}%`} />
            <Field label="Tanqidiy fikrlash" value={`${thr.ct}%`} />
          </div>
        ) : (
          <div className="text-sm text-bad">Bu sinf uchun chegara o'rnatilmagan</div>
        )}
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}

      <DeleteConfirmDialog
        open={delOpen}
        title="Imtihonni o'chirish"
        itemLabel={e.title}
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
