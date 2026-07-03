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
  grades?: number[];
  subjectKeys?: string[];
  admissionThresholds: Record<string, { math: number; ct: number; en: number }>;
  cohortSize: number | null;
  _count?: { results: number; templates?: number };
}

interface TemplateRow {
  id: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  name: string;
  questionCount: number;
}
const SUBJ_LABEL: Record<string, string> = {
  MATH: "Matematika", ENGLISH: "Ingliz tili", CRITICAL_THINKING: "Tanqidiy fikrlash",
};

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [e, setE] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  useEffect(() => {
    if (!params.id) return;
    api<ExamDetail>(`/api/admin/exams/${params.id}`).then(setE).catch(() => undefined);
    // Load templates scoped to this exam. `take=200` covers up to 7 grades ×
    // 3 subjects = 21 slots comfortably.
    api<{ items: TemplateRow[] }>(`/api/admin/test-templates?examId=${params.id}&take=200`)
      .then((d) => setTemplates(d.items))
      .catch(() => undefined);
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

      {/* Test templates scoped to THIS exam. Shows one row per (subject × grade)
          combo the exam declares; missing combos surface a "Yaratish" link so
          the admin can fill them in on this same page.  */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-sm">Test shablonlari</div>
          <Link
            href={`/test-templates/new?examId=${e.id}`}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <Icon name="plus" size={14} /> Yangi shablon
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Sinf</th>
                <th className="text-left px-3 py-2">Fan</th>
                <th className="text-left px-3 py-2 w-24">Savol</th>
                <th className="text-left px-3 py-2">Shablon nomi</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {(e.grades && e.grades.length > 0 ? e.grades : [e.grade]).flatMap((g) =>
                (e.subjectKeys && e.subjectKeys.length > 0 ? e.subjectKeys : ["MATH", "ENGLISH", "CRITICAL_THINKING"]).map((sk) => {
                  const t = templates.find((x) => x.grade === g && x.subject === sk);
                  return (
                    <tr key={`${g}-${sk}`} className="border-t">
                      <td className="px-3 py-2">{g}-sinf</td>
                      <td className="px-3 py-2">{SUBJ_LABEL[sk] ?? sk}</td>
                      <td className="px-3 py-2 font-mono">{t?.questionCount ?? "—"}</td>
                      <td className="px-3 py-2">{t ? t.name : <span className="text-gray-400 italic">yo'q</span>}</td>
                      <td className="px-3 py-2 text-right">
                        {t ? (
                          <Link href={`/test-templates/${t.id}`} className="text-xs text-navy hover:underline">Ochish →</Link>
                        ) : (
                          <Link
                            href={`/test-templates/new?examId=${e.id}&subject=${sk}&grade=${g}`}
                            className="text-xs text-navy hover:underline"
                          >
                            Yaratish →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
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
