"use client";

// Kredensiallar sahifasi (2026-07-06): imtihon va sinf bo'yicha filtrlab
// oquvchilarni login+parol ro'yxatini olish + text/PDF eksporti. CSV
// import bo'lganidan keyin parollar keyingi safar qayta chiqarilishi
// zarur bo'ladi — bu sahifa shu ehtiyoj uchun.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

interface Exam {
  id: string;
  title: string;
  grade: number;
  grades?: number[];
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

interface CredentialRow {
  studentId: string;
  fullName: string;
  grade: number;
  uid: string | null;
  loginCode: string | null;
  password: string | null;
  resultCode: string;
  hasCredentials: boolean;
}

interface CredentialsResponse {
  examId: string;
  grade: number | null;
  count: number;
  rows: CredentialRow[];
}

export default function CredentialsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [grade, setGrade] = useState<string>(""); // "" = barcha sinflar
  const [data, setData] = useState<CredentialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Exam[] }>(`/api/admin/exams?take=100`)
      .then((d) => setExams(d.items))
      .catch(() => undefined);
  }, []);

  const availableGrades = useMemo(() => {
    const ex = exams.find((e) => e.id === examId);
    if (!ex) return [] as number[];
    const gs = Array.isArray(ex.grades) && ex.grades.length > 0 ? ex.grades : [ex.grade];
    return [...new Set(gs)].sort((a, b) => a - b);
  }, [exams, examId]);

  async function onLoad() {
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ examId });
      if (grade) params.set("grade", grade);
      const r = await api<CredentialsResponse>(`/api/admin/students/credentials?${params.toString()}`);
      setData(r);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Yuklab bo'lmadi");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const examTitle = exams.find((e) => e.id === examId)?.title ?? "";
  const safeExamLabel = examTitle.replace(/[^\p{L}\p{N}]+/gu, "_") || "export";
  const gradeLabel = grade ? `${grade}sinf` : "barcha";
  const baseFileName = `credentials-${safeExamLabel}-${gradeLabel}-${timestamp}`;

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadTxt() {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`Sodiq School — Kirish imtihoni loginlar ro'yxati`);
    lines.push(`Imtihon: ${examTitle}`);
    lines.push(`Sinf: ${grade || "barchasi"} · Jami: ${data.count} o'quvchi · Sana: ${timestamp}`);
    lines.push("");
    lines.push("№\tF.I.O.\tSinf\tLogin\tParol");
    data.rows.forEach((r, i) => {
      lines.push([
        i + 1,
        r.fullName,
        `${r.grade}-sinf`,
        r.loginCode ?? "—",
        r.password ?? "—",
      ].join("\t"));
    });
    downloadBlob(lines.join("\n"), `${baseFileName}.txt`, "text/plain;charset=utf-8");
  }

  async function downloadPdf() {
    if (!data) return;
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(6, 17, 60);
    doc.text("Sodiq School — Kirish imtihoni loginlar ro'yxati", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    const sub = `${examTitle} · ${grade ? `${grade}-sinf` : "Barcha sinflar"} · ${timestamp} · Jami: ${data.count}`;
    doc.text(sub, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [["№", "F.I.O.", "Sinf", "Login (kod)", "Parol"]],
      body: data.rows.map((r, i) => [
        String(i + 1),
        r.fullName,
        `${r.grade}-sinf`,
        r.loginCode ?? "—",
        r.password ?? "—",
      ]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, textColor: [17, 24, 39], lineColor: [209, 213, 219], lineWidth: 0.1 },
      headStyles: { fillColor: [243, 244, 246], textColor: [6, 17, 60], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: {
        0: { cellWidth: 12 },
        2: { cellWidth: 20 },
        3: { font: "courier", cellWidth: 35 },
        4: { font: "courier", cellWidth: 45 },
      },
      margin: { top: 26, left: 14, right: 14 },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 26;
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(
      "Loginni natija.sodiqschool.uz orqali ota-ona o'z farzandining natijasini ko'radi. Parolni maxfiy tuting.",
      14,
      Math.min(finalY + 8, 200),
    );

    doc.save(`${baseFileName}.pdf`);
  }

  const tsvClipboard = useMemo(() => {
    if (!data) return "";
    const header = ["№", "F.I.O.", "Sinf", "Login", "Parol"].join("\t");
    const lines = data.rows.map((r, i) => [
      i + 1, r.fullName, `${r.grade}-sinf`, r.loginCode ?? "—", r.password ?? "—",
    ].join("\t"));
    return [header, ...lines].join("\n");
  }, [data]);

  const missingCount = data ? data.rows.filter((r) => !r.hasCredentials).length : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Login/Parol ro'yxati</h1>
        <Link href="/results" className="text-sm text-navy hover:underline">← Natijalar</Link>
      </div>

      <p className="text-sm text-gray-600">
        Imtihon va sinfni tanlab, ushbu imtihonda natijasi bo'lgan o'quvchilarning
        <b> login + parol</b> ro'yxatini oling. Parol studentga bir marta
        biriktiriladi va uni kelajakda ham qayta chop etish mumkin. Sinf
        tanlanmasa — imtihondagi barcha sinflar chiqadi.
      </p>

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Imtihon</label>
            <select
              className="input"
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setGrade("");
                setData(null);
              }}
            >
              <option value="">— Tanlang —</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {e.grade}-sinf · {e.status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sinf (ixtiyoriy)</label>
            <select
              className="input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={!examId}
            >
              <option value="">Barcha sinflar</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}-sinf
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={onLoad}
            disabled={!examId || busy}
          >
            <Icon name="search" size={14} />
            {busy ? "Yuklanmoqda…" : "Ro'yxatni yuklash"}
          </button>
        </div>

        {error && <div className="text-bad text-sm">{error}</div>}
      </div>

      {data && (
        <div className="card">
          <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
            <span>Jami: {data.count} o'quvchi</span>
            {missingCount > 0 && (
              <span className="text-warn text-xs">
                {missingCount} tasida login/parol yo'q — Natijalar sahifasidan
                &laquo;Kredensial berish&raquo; ni bosing.
              </span>
            )}
          </div>

          <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-700 mr-1">Yuklab olish:</span>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={downloadTxt}
            >
              <Icon name="download" size={12} /> TEXT
            </button>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={downloadPdf}
            >
              <Icon name="download" size={12} /> PDF
            </button>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={() => navigator.clipboard.writeText(tsvClipboard)}
              title="Excel / Google Sheets ga to'g'ridan-to'g'ri joylash uchun"
            >
              <Icon name="copy" size={12} /> Nusxa (TSV)
            </button>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">№</th>
                  <th className="text-left px-3 py-2">F.I.O.</th>
                  <th className="text-left px-3 py-2">Sinf</th>
                  <th className="text-left px-3 py-2">Login (kod)</th>
                  <th className="text-left px-3 py-2">Parol</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.studentId} className="border-t">
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">{r.fullName}</td>
                    <td className="px-3 py-1.5">{r.grade}-sinf</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.loginCode ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.password ?? "—"}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Bu filter uchun natija topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
