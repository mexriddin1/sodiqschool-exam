"use client";

// Bir imtihon uchun test shablonlari sahifasi. /test-templates dagi paketni
// bosganda shu sahifaga o'tiladi — u yerda faqat shu imtihon shablonlari
// va shu imtihon uchun yangi shablon qo'shish tugmasi bo'ladi.
// "__unbound__" examId sentinel orqali bog'lanmagan shablonlar ham ko'rsatiladi.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

interface Row {
  id: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  name: string;
  examId: string | null;
  questionCount: number;
  updatedAt: string;
}

interface Exam {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  grades?: number[];
}

const SUBJECT_LABEL = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
} as const;

const UNBOUND = "__unbound__";

export default function ExamTemplatesPage() {
  const router = useRouter();
  const params = useParams<{ examId: string }>();
  const isUnbound = params.examId === UNBOUND;

  const [exam, setExam] = useState<Exam | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // delete
  const [delTarget, setDelTarget] = useState<Row | null>(null);
  const [delPending, setDelPending] = useState(false);

  // clone
  const [cloneTarget, setCloneTarget] = useState<Row | null>(null);
  const [cloneExams, setCloneExams] = useState<Exam[]>([]);
  const [cloneDestId, setCloneDestId] = useState("");
  const [clonePending, setClonePending] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  function refresh() {
    if (!params.examId) return;
    setLoading(true);
    const templateQuery = isUnbound
      ? `/api/admin/test-templates?examId=null&take=500`
      : `/api/admin/test-templates?examId=${params.examId}&take=200`;

    const examFetch = isUnbound
      ? Promise.resolve(null)
      : api<Exam>(`/api/admin/exams/${params.examId}`).then(setExam).catch(() => undefined);

    Promise.all([
      examFetch,
      api<{ items: Row[] }>(templateQuery)
        .then((d) => setRows(d.items ?? []))
        .catch(() => undefined),
    ]).finally(() => setLoading(false));
  }
  useEffect(refresh, [params.examId]);

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/test-templates/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  function openClone(t: Row) {
    setCloneTarget(t);
    setCloneDestId("");
    setCloneError(null);
    api<{ items: Exam[] }>(`/api/admin/exams?take=200`)
      .then((d) => setCloneExams(d.items ?? []))
      .catch(() => setCloneExams([]));
  }

  async function onClone() {
    if (!cloneTarget || !cloneDestId) return;
    setClonePending(true);
    setCloneError(null);
    try {
      await api(`/api/admin/test-templates/${cloneTarget.id}/clone`, {
        method: "POST",
        body: JSON.stringify({ examId: cloneDestId }),
      });
      setCloneTarget(null);
      refresh();
    } catch (e) {
      setCloneError(e instanceof ApiException ? e.error.message : "Ko'chirishda xato");
    } finally {
      setClonePending(false);
    }
  }

  const sorted = [...rows].sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));

  const pageTitle = isUnbound
    ? "Bog'lanmagan (eski) shablonlar"
    : exam?.title ?? "Yuklanmoqda…";

  return (
    <div className="space-y-4">
      <Link href="/test-templates" className="text-sm text-navy hover:underline">← Test shablonlari</Link>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{pageTitle}</h1>
          <div className="text-xs text-gray-500 mt-1">
            Test shablonlari · {rows.length} ta shablon ·{" "}
            {rows.reduce((s, r) => s + r.questionCount, 0)} ta savol
            {exam && (
              <span className="ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {exam.status}
              </span>
            )}
            {isUnbound && (
              <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                bog'lanmagan
              </span>
            )}
          </div>
        </div>
        {!isUnbound && exam && (
          <Link
            href={`/test-templates/new?examId=${exam.id}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Icon name="plus" size={16} /> Yangi shablon
          </Link>
        )}
      </div>

      {isUnbound && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bu shablonlar hech qanday imtihonga bog'lanmagan. <strong>Ko'chirish</strong> tugmasi orqali
          ularni kerakli imtihon paketiga nusxalash mumkin.
        </div>
      )}

      {error && <div className="text-bad text-sm">{error}</div>}

      <div className="card">
        {loading && sorted.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Yuklanmoqda…</div>
        ) : sorted.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            Bu imtihonga hali shablon qo'shilmagan. Yuqoridagi <b>Yangi shablon</b> tugmasi bilan qo'shing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Sinf</th>
                  <th className="text-left px-4 py-2">Fan</th>
                  <th className="text-left px-4 py-2 w-24">Savol</th>
                  <th className="text-left px-4 py-2">Shablon nomi</th>
                  <th className="text-left px-4 py-2">Yangilangan</th>
                  <th className="text-right px-4 py-2 w-32">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/test-templates/${t.id}`)}
                  >
                    <td className="px-4 py-2">{t.grade}-sinf</td>
                    <td className="px-4 py-2">{SUBJECT_LABEL[t.subject]}</td>
                    <td className="px-4 py-2 font-mono">{t.questionCount}</td>
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                        <IconButton
                          icon="copy"
                          label="Ko'chirish (clone)"
                          onClick={() => openClone(t)}
                        />
                        <IconButton
                          icon="delete"
                          label="O'chirish"
                          onClick={() => setDelTarget(t)}
                          variant="danger"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clone modal */}
      {cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-navy">Shablonni ko'chirish</h2>

            <p className="text-sm text-gray-600">
              <strong>{cloneTarget.name}</strong> ({SUBJECT_LABEL[cloneTarget.subject]} · {cloneTarget.grade}-sinf ·{" "}
              {cloneTarget.questionCount} ta savol) shablonini qaysi imtihonga nusxalash kerak?
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 uppercase">Maqsad imtihon</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                value={cloneDestId}
                onChange={(e) => setCloneDestId(e.target.value)}
              >
                <option value="">— tanlang —</option>
                {cloneExams
                  .filter((ex) => ex.id !== cloneTarget.examId)
                  .map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.status})
                    </option>
                  ))}
              </select>
            </div>

            {cloneError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {cloneError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCloneTarget(null)}
                disabled={clonePending}
              >
                Bekor
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={onClone}
                disabled={!cloneDestId || clonePending}
              >
                {clonePending ? "Ko'chirilmoqda…" : (
                  <><Icon name="copy" size={15} /> Ko'chirish</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Test shablonini o'chirish"
        itemLabel={delTarget?.name ?? ""}
        description="Bu shablonni ishlatadigan natijalar mavjud bo'lsa, savollar nusxasi natijalarda saqlanib qoladi."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
