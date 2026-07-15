"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { resolveBack } from "@/lib/back-link";
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
  grades?: number[];
  subjectKeys?: string[];
  admissionThresholds: Record<string, { math: number; ct: number; en: number }>;
  cohortSize: number | null;
  _count?: { results: number; templates?: number };
}

const SUBJ_LABEL: Record<string, string> = {
  MATH: "Matematika", ENGLISH: "Ingliz tili", CRITICAL_THINKING: "Tanqidiy fikrlash",
};

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  // Bu sahifaga bir necha joydan kelinadi — "orqaga" manzili
  // qattiq yozilmaydi, `?from=` bo'lsa o'shanga qaytadi.
  const back = resolveBack(useSearchParams(), { href: "/exams", label: "Imtihonlar" });
  const [e, setE] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    api<ExamDetail>(`/api/admin/exams/${params.id}`).then(setE).catch(() => undefined);
  }, [params.id]);

  const [delOpen, setDelOpen] = useState(false);
  const [cohortMsg, setCohortMsg] = useState<string | null>(null);

  async function recomputeCohort() {
    if (!e) return;
    setPending(true);
    setCohortMsg(null);
    setError(null);
    try {
      const r = await api<{ recomputed: number }>(
        `/api/admin/exams/${e.id}/recompute-cohort`,
        { method: "POST" },
      );
      setCohortMsg(`${r.recomputed} ta nashr etilgan natija uchun cohort reyting va persentil qayta hisoblandi.`);
    } catch (err) {
      setError(err instanceof ApiException ? err.error.message : "Qayta hisoblashda xato");
    } finally {
      setPending(false);
    }
  }

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


  return (
    <div className="space-y-4 max-w-3xl">
      <Link href={back.href} className="text-sm text-navy hover:underline">← {back.label}</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">{e.title}</h1>
        <div className="flex gap-2 items-center">
          <Link href={`/exams/${e.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
            <Icon name="edit" size={16} /> Tahrirlash
          </Link>
          <button
            onClick={recomputeCohort}
            disabled={pending}
            className="btn-secondary inline-flex items-center gap-2"
            title="Barcha nashr etilgan natijalar uchun cohort reytingi va persentilni qayta hisoblash"
          >
            <Icon name="refresh" size={16} /> Reyting qayta hisoblash
          </button>
          <button onClick={tryDelete} disabled={pending} className="btn-danger inline-flex items-center gap-2">
            <Icon name="delete" size={16} /> O'chirish
          </button>
        </div>
      </div>

      <div className="card p-4 grid grid-cols-3 gap-3 text-sm">
        <Field
          label="Sinflar"
          value={
            e.grades && e.grades.length > 0
              ? e.grades.map((g) => `${g}-sinf`).join(", ")
              : `${e.grade}-sinf`
          }
        />
        <Field
          label="Fanlar"
          value={
            e.subjectKeys && e.subjectKeys.length > 0
              ? e.subjectKeys.map((k) => SUBJ_LABEL[k] ?? k).join(", ")
              : "—"
          }
        />
        <Field label="Sana" value={new Date(e.examDate).toLocaleDateString()} />
        <Field label="Holat" value={e.status} />
        <Field label="O'quv yili" value={e.academicYear ?? "—"} />
        <Field label="Kohort" value={e.cohortSize?.toString() ?? "—"} />
        <Field label="Natijalar" value={(e._count?.results ?? 0).toString()} />
      </div>

      {e.description && (
        <div className="card p-4 text-sm whitespace-pre-wrap">{e.description}</div>
      )}

      {error && <div className="text-bad text-sm">{error}</div>}
      {cohortMsg && <div className="text-good text-sm">{cohortMsg}</div>}

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
