"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { resolveBack } from "@/lib/back-link";
import { CLIENT_BASE_URL } from "@/lib/urls";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

interface Detail {
  id: string;
  publicCode: string;
  accessPassword?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  createdAt: string;
  manualContent: Record<string, unknown>;
  calculatedSnapshot: Record<string, unknown> | null;
  aiNarrative: Record<string, unknown> | null;
  aiUsage: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    generatedAt?: string;
  } | null;
  student: {
    id: string;
    fullName: string;
    grade: number;
    // 2026-07-03: login/parol endi Studentga tegishli. Result.publicCode
    // qoladi (legacy id), ammo ko'rsatiladigan kredensiallar shu yerdan.
    loginCode?: string | null;
    accessPassword?: string | null;
  };
  exam: { id: string; title: string; grade: number };
  unlockedSections?: string[];
  subjects: {
    id: string;
    subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
    totalMarks: number;
    totalQuestions: number;
  }[];
}

export default function ResultDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  // Bu sahifaga natijalar ro'yxatidan ham, lead sahifasidan ham kelinadi —
  // shuning uchun "orqaga" manzili qattiq yozilmaydi.
  const back = resolveBack(useSearchParams(), { href: "/results", label: "Natijalar" });
  const [r, setR] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credsReveal, setCredsReveal] = useState<{ publicCode: string; password: string } | null>(null);
  const [pending, setPending] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportViewerUrl, setReportViewerUrl] = useState<string | null>(null);
  const [reportViewerLoading, setReportViewerLoading] = useState(false);

  // Open the parent-facing report inside admin via a short-lived impersonation
  // token. Admin never has to open natija.sodiqschool.uz in a separate tab.
  async function openReportViewer() {
    if (!r) return;
    setReportViewerLoading(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>(
        `/api/admin/results/${r.id}/impersonate-token`,
        { method: "POST" },
      );
      // The client site accepts ?impersonate=<jwt>&resultId=<id> on /select
      // and stores the token as a cookie, then redirects to the report.
      const url = `${CLIENT_BASE_URL}/select?impersonate=${encodeURIComponent(token)}&resultId=${encodeURIComponent(r.id)}`;
      setReportViewerUrl(url);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Impersonation muvaffaqiyatsiz");
    } finally {
      setReportViewerLoading(false);
    }
  }

  async function regenerateAi() {
    if (!r) return;
    setAiLoading(true);
    setError(null);
    try {
      await api(`/api/admin/results/${r.id}/generate-ai`, { method: "POST" });
      load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "AI matn yaratishda xato");
    } finally {
      setAiLoading(false);
    }
  }

  async function onDelete() {
    if (!r) return;
    setPending(true);
    try {
      await api(`/api/admin/results/${r.id}`, { method: "DELETE" });
      router.push("/results");
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
      setDelOpen(false);
      setPending(false);
    }
  }

  const load = useCallback(() => {
    if (!params.id) return;
    api<Detail>(`/api/admin/results/${params.id}`).then(setR).catch(() => undefined);
  }, [params.id]);

  useEffect(load, [load]);

  async function action(path: string) {
    setPending(true);
    setError(null);
    try {
      const data = await api<{ publicCode?: string; password?: string }>(
        `/api/admin/results/${params.id}/${path}`,
        { method: "POST" },
      );
      if (data?.password && data?.publicCode) {
        setCredsReveal({ publicCode: data.publicCode, password: data.password });
      }
      load();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Amalda xato");
    } finally {
      setPending(false);
    }
  }

  if (!r) return <div className="text-gray-500">Yuklanmoqda…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href={back.href} className="text-sm text-navy hover:underline">← {back.label}</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">
          {r.student.fullName} <span className="text-gray-400 text-base">({r.exam.title})</span>
        </h1>
        <StatusBadge status={r.status} />
      </div>

      <div className="card p-4 grid grid-cols-4 gap-3 text-sm">
        <Field
          label="Login (o'quvchi)"
          value={r.student.loginCode ?? "—"}
          mono
          copyable={!!r.student.loginCode}
        />
        <Field
          label="Parol (o'quvchi)"
          value={r.student.accessPassword || "—"}
          mono
          copyable={!!r.student.accessPassword}
        />
        <Field label="Sinf" value={`${r.student.grade}-sinf`} />
        <Field label="Nashr sanasi" value={r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "—"} />
      </div>

      <SectionAccessCard result={r} onUpdated={load} />

      <ParentMessageCard result={r} />

      <div className="card">
        <div className="px-4 py-3 border-b font-medium">Fanlar</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Fan</th>
              <th className="text-left px-4 py-2">Savollar</th>
              <th className="text-left px-4 py-2">Maks ball</th>
            </tr>
          </thead>
          <tbody>
            {r.subjects.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.subject}</td>
                <td className="px-4 py-2">{s.totalQuestions}</td>
                <td className="px-4 py-2">{s.totalMarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {r.status !== "ARCHIVED" && (
          <Link href={`/results/${r.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
            <Icon name="edit" size={16} /> Tahrirlash
          </Link>
        )}
        {r.status === "DRAFT" && (
          <button className="btn-primary inline-flex items-center gap-2" disabled={pending} onClick={() => action("publish")}>
            <Icon name="publish" size={16} /> Nashr etish
          </button>
        )}
        {r.status === "PUBLISHED" && (
          <button className="btn-secondary inline-flex items-center gap-2" disabled={pending} onClick={() => action("unpublish")}>
            <Icon name="unpublish" size={16} /> Nashrdan olish
          </button>
        )}
        {r.status !== "ARCHIVED" && (
          <button className="btn-secondary inline-flex items-center gap-2" disabled={pending} onClick={() => action("archive")}>
            <Icon name="archive" size={16} /> Arxivlash
          </button>
        )}
        <button className="btn-secondary inline-flex items-center gap-2" disabled={pending} onClick={() => action("reset-password")}>
          <Icon name="key" size={16} /> Parolni tiklash
        </button>
        <button className="btn-danger inline-flex items-center gap-2" disabled={pending} onClick={() => setDelOpen(true)}>
          <Icon name="delete" size={16} /> O'chirish
        </button>
<a
          className="btn-secondary inline-flex items-center gap-2"
          target="_blank"
          rel="noreferrer"
          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/admin/results/${r.id}/preview`}
        >
          <Icon name="fileJson" size={16} /> Preview (JSON)
        </a>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          disabled={reportViewerLoading}
          onClick={openReportViewer}
          title="Ota-onaga ko'rinadigan hisobot sahifasini shu yerda ochib ko'rish"
        >
          <Icon name="fileJson" size={16} /> {reportViewerLoading ? "Ochilmoqda…" : "Hisobotni ko'rish"}
        </button>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          disabled={pending || aiLoading}
          onClick={regenerateAi}
          title="DeepSeek AI orqali §Diagnostika, §Tahlil, §Rivojlanish va §Umumiy manzara matnlarini qayta ishlab chiqarish. ~30 soniya davom etadi."
        >
          <Icon name="refresh" size={16} /> {aiLoading ? "Yaratilmoqda…" : (r.aiNarrative ? "AI matnini yangilash" : "AI matnini yaratish")}
        </button>
      </div>

      {r.aiUsage && (
        <div className="card p-3 bg-gray-50 text-sm flex flex-wrap gap-4 items-center">
          <div className="font-medium text-navy">AI matn:</div>
          <div><span className="text-gray-500">tokenlar</span> <span className="font-mono">{(r.aiUsage.totalTokens ?? 0).toLocaleString()}</span></div>
          <div><span className="text-gray-500">xarajat</span> <span className="font-mono">${(r.aiUsage.costUsd ?? 0).toFixed(4)}</span></div>
          <div><span className="text-gray-500">model</span> <span className="font-mono text-xs">{r.aiUsage.model}</span></div>
          {r.aiUsage.generatedAt && (
            <div className="text-xs text-gray-500">
              {new Date(r.aiUsage.generatedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {credsReveal && (
        <div className="card p-4 border-good bg-good/10">
          <div className="font-medium">Yangi parol</div>
          <div className="mt-2 text-sm">
            Kod: <span className="font-mono">{credsReveal.publicCode}</span><br />
            Parol: <span className="font-mono">{credsReveal.password}</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">Bu ko'rsatuv faqat bir marta. Saqlab oling.</div>
        </div>
      )}

      {error && <div className="text-bad text-sm">{error}</div>}

      <DeleteConfirmDialog
        open={delOpen}
        title="Natijani o'chirish"
        itemLabel={r.publicCode}
        confirmWord={r.publicCode}
        description={`${r.student.fullName} — ${r.exam.title}. Natija va uning barcha fan-natijalari o'chiriladi.`}
        pending={pending}
        onCancel={() => setDelOpen(false)}
        onConfirm={onDelete}
      />

      {reportViewerUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setReportViewerUrl(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
              <div className="text-sm text-navy font-semibold">Hisobot ko'rish (impersonation)</div>
              <div className="flex items-center gap-3">
                <a
                  href={reportViewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-navy underline"
                >
                  Alohida tabda ochish ↗
                </a>
                <button
                  type="button"
                  onClick={() => setReportViewerUrl(null)}
                  className="text-xl leading-none text-gray-500 hover:text-navy"
                  aria-label="Yopish"
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              src={reportViewerUrl}
              title="Report preview"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Ready-to-paste text for the parent chat / WhatsApp. The admin edits the
// wording if needed (it's a plain textarea), then clicks "Nusxalash". The
// student name, code, password and public URL are inlined into the initial
// value so a fresh open always has fresh data.
function ParentMessageCard({ result }: { result: Detail }) {
  const clientBase = CLIENT_BASE_URL;
  const loginLine = result.student.loginCode
    ? `Login: ${result.student.loginCode}`
    : `Login: (o'quvchi kredensiallari hali biriktirilmagan)`;
  const passwordLine = result.student.accessPassword
    ? `Parol: ${result.student.accessPassword}`
    : `Parol: (o'quvchi kredensiallari hali biriktirilmagan)`;
  const defaultText = `Assalomu alaykum!

Hurmatli ota-ona, farzandingiz ${result.student.fullName}ning Sodiq School kirish imtihoni natijalari tayyor.

Natijalarni ushbu havoladan ko'rishingiz mumkin:
${clientBase}/login

${loginLine}
${passwordLine}

Sodiq School Academic Assessment Office`;

  const [text, setText] = useState(defaultText);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(defaultText);
    // reset on result change (publish, reset password, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.student.loginCode, result.student.accessPassword, result.student.fullName]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent — user can still select the textarea manually.
    }
  }

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">Ota-onalar uchun xabar (tayyor matn)</div>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md ${copied ? "bg-good text-white" : "btn-secondary"}`}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied ? "Nusxalandi" : "Nusxalash"}
        </button>
      </div>
      <textarea
        className="input font-mono text-sm"
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="text-xs text-gray-500">
        Matn tayyor — istasangiz tahrirlashingiz mumkin. "Nusxalash" tugmasi bilan
        oling va ota-onaning Telegram/WhatsApp'iga jo'nating.
      </div>
    </div>
  );
}

// Report sections the parent sees are gated per-Result. Overview metrics
// stay on; deeper narrative / roadmap / xulosalar unlock only after the
// parent visits the school. Admin toggles that here with instant PATCH.
const SECTION_KEYS = [
  { key: "narrative", label: "Batafsil tahlil", hint: "Bir qarashda, uch fan bo'yicha diagnostik hikoya" },
  { key: "roadmap", label: "Rivojlanish yo'li", hint: "3/6/12 oylik dastur va oylik reja" },
  { key: "risks_notes", label: "Xatarlar va xulosalar", hint: "Xatarlar tahlili, ota-ona va komissiya xulosasi" },
] as const;

function SectionAccessCard({ result, onUpdated }: { result: Detail; onUpdated: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = new Set(result.unlockedSections ?? []);
  const totalUnlocked = current.size;

  async function toggle(key: string) {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPending(true);
    setError(null);
    try {
      await api(`/api/admin/results/${result.id}/unlocked-sections`, {
        method: "PATCH",
        body: JSON.stringify({ unlockedSections: Array.from(next) }),
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  async function setAll(unlocked: boolean) {
    setPending(true);
    setError(null);
    try {
      await api(`/api/admin/results/${result.id}/unlocked-sections`, {
        method: "PATCH",
        body: JSON.stringify({
          unlockedSections: unlocked ? SECTION_KEYS.map((s) => s.key) : [],
        }),
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium text-navy">Ota-ona uchun bo'limlar</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Ota-ona login qilganda ko'radigan bo'limlarni belgilang. Ochilmaganlari
            "Yopiq — maktabga tashrif buyuring" ko'rinishida chiqadi. Umumiy ball va
            fanlar kartasi doim ochiq turadi.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pending || totalUnlocked === SECTION_KEYS.length}
            onClick={() => setAll(true)}
          >
            Hammasini ochish
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pending || totalUnlocked === 0}
            onClick={() => setAll(false)}
          >
            Hammasini yopish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {SECTION_KEYS.map((s) => {
          const on = current.has(s.key);
          return (
            <button
              type="button"
              key={s.key}
              disabled={pending}
              onClick={() => toggle(s.key)}
              className={`text-left p-3 rounded-lg border transition ${
                on
                  ? "bg-good/10 border-good"
                  : "bg-white border-gray-200 hover:border-navy"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{s.label}</div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    on ? "bg-good text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {on ? "Ochiq" : "Yopiq"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{s.hint}</div>
            </button>
          );
        })}
      </div>

      {error && <div className="text-bad text-sm">{error}</div>}
    </div>
  );
}

function Field({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`font-medium flex items-center gap-2 ${mono ? "font-mono" : ""}`}>
        <span>{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(value)}
            className="text-gray-400 hover:text-navy"
            title="Nusxalash"
            aria-label="Nusxalash"
          >
            <Icon name="copy" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
