"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
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
  student: { id: string; fullName: string; grade: number };
  exam: { id: string; title: string; grade: number };
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
  const [r, setR] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credsReveal, setCredsReveal] = useState<{ publicCode: string; password: string } | null>(null);
  const [pending, setPending] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

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

  async function downloadPdf() {
    if (!r) return;
    setPdfLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${base}/api/admin/results/${r.id}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `PDF yaratishda xato (${res.status})`);
      }
      const blob = await res.blob();
      // Read filename from Content-Disposition, else fall back.
      const disp = res.headers.get("Content-Disposition") ?? "";
      const m = disp.match(/filename="?([^"]+)"?/);
      const filename = m ? m[1] : `Sodiq_${r.publicCode}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename!;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF yaratishda xato");
    } finally {
      setPdfLoading(false);
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
      <Link href="/results" className="text-sm text-navy hover:underline">← Natijalar</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">
          {r.student.fullName} <span className="text-gray-400 text-base">({r.exam.title})</span>
        </h1>
        <StatusBadge status={r.status} />
      </div>

      <div className="card p-4 grid grid-cols-4 gap-3 text-sm">
        <Field label="Kirish kodi" value={r.publicCode} mono copyable />
        <Field
          label="Parol"
          value={r.accessPassword || "—"}
          mono
          copyable={!!r.accessPassword}
        />
        <Field label="Sinf" value={`${r.student.grade}-sinf`} />
        <Field label="Nashr sanasi" value={r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "—"} />
      </div>

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
        {r.status === "PUBLISHED" && (
          <button
            className="btn-secondary inline-flex items-center gap-2"
            disabled={pending || pdfLoading}
            onClick={downloadPdf}
            title="4 sahifali hisobotni PDF fayl sifatida yuklab olish. OG'IR AMAL: serverda taxminan 10–20 sekund vaqt oladi."
          >
            <Icon name="download" size={16} /> {pdfLoading ? "Tayyorlanmoqda…" : "PDF ko'chirib olish"}
          </button>
        )}
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

      {r.status === "PUBLISHED" && (
        <div className="card p-3 bg-warn/10 border-l-2 border-warn text-sm flex items-start gap-2">
          <span className="text-warn shrink-0 mt-0.5"><Icon name="warning" size={16} /></span>
          <div>
            <b>PDF yaratish — og'ir amal.</b> Har bir PDF serverda Playwright orqali
            to'liq brauzer ochib, 4 sahifani render qilib, PDF'ga birlashtiradi
            (taxminan 10–20 sekund). Ota-onalarga havola orqali natijani jonli
            saytda ko'rsatishni afzal ko'ring; PDF'ni faqat rasmiy hujjat kerak
            bo'lganda (masalan, komissiya sabab imzolashi kerak bo'lganda) olib beringing.
          </div>
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
    </div>
  );
}

// Ready-to-paste text for the parent chat / WhatsApp. The admin edits the
// wording if needed (it's a plain textarea), then clicks "Nusxalash". The
// student name, code, password and public URL are inlined into the initial
// value so a fresh open always has fresh data.
function ParentMessageCard({ result }: { result: Detail }) {
  const clientBase = process.env.NEXT_PUBLIC_CLIENT_URL ?? "https://natija.sodiqschool.uz";
  const passwordLine = result.accessPassword
    ? `Parol: ${result.accessPassword}`
    : `Parol: (natija nashr etilganda paydo bo'ladi)`;
  const defaultText = `Assalomu alaykum!

Hurmatli ota-ona, farzandingiz ${result.student.fullName}ning Sodiq School kirish imtihoni natijalari tayyor.

Natijalarni ushbu havoladan ko'rishingiz mumkin:
${clientBase}/login

Kirish kodi: ${result.publicCode}
${passwordLine}

Sodiq School Academic Assessment Office`;

  const [text, setText] = useState(defaultText);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(defaultText);
    // reset on result change (publish, reset password, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.publicCode, result.accessPassword, result.student.fullName]);

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
