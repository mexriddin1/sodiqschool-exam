"use client";

// Bulk import from the school's "Kirish imtihoni natijalari" CSV export.
// Flow: choose exam → drop CSV file or paste text → Preview (dry-run) →
// Confirm import → Show credentials table (login + password per row).

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

interface PreviewRow {
  tr: number;
  uid: string;
  fullName: string;
  sex: "MALE" | "FEMALE" | null;
  grade: number;
  examLanguage: "UZ" | "RU" | "EN" | null;
  isAllZero: boolean;
  mathCorrect: number;
  ctCorrect: number;
  engCorrect: number;
  existingStudent: boolean;
  // publicCode of a previously-imported result for the same (student,exam)
  // — informational only, import creates a NEW result on top of it.
  existingResultCode: string | null;
}

interface ImportedRow {
  tr: number;
  fullName: string;
  publicCode: string;
  // Student uchun parol faqat ilk marta yaratilganida qaytadi. Mavjud
  // student uchun password: null bo'ladi va credentialsGenerated: false.
  password: string | null;
  credentialsGenerated: boolean;
  studentCreated: boolean;
  isAllZero: boolean;
}

interface PreviewResponse {
  dryRun: true;
  expectedCounts?: { MATH: number; CRITICAL_THINKING: number; ENGLISH: number };
  noTemplateSubjects?: string[];
  totalRows: number;
  parseErrors: { rowNumber: number; reason: string; raw: string }[];
  preview: PreviewRow[];
}

interface CommitResponse {
  dryRun: false;
  examId: string;
  totalRows: number;
  parseErrors: { rowNumber: number; reason: string; raw: string }[];
  created: ImportedRow[];
  skipped: { rowNumber: number; tr: number; reason: string }[];
}

export default function CsvImportPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commit, setCommit] = useState<CommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Exam[] }>(`/api/admin/exams?take=100`)
      .then((d) => setExams(d.items))
      .catch(() => undefined);
  }, []);

  const disabled = busy || !examId || !csv.trim();

  // JSON vs CSV detection. If the pasted text parses as an object with a
  // `students` array we send it as JSON — otherwise treat it as CSV.
  function buildBody(dryRun: boolean): string {
    const trimmed = csv.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        const students = Array.isArray(parsed) ? parsed : parsed?.students;
        if (Array.isArray(students)) {
          return JSON.stringify({ examId, students, dryRun });
        }
      } catch {
        // Fall through — send as CSV, backend will surface a parse error.
      }
    }
    return JSON.stringify({ examId, csv, dryRun });
  }

  async function onPreview() {
    setBusy(true);
    setError(null);
    setPreview(null);
    setCommit(null);
    try {
      const r = await api<PreviewResponse>("/api/admin/results/import-csv", {
        method: "POST",
        body: buildBody(true),
      });
      setPreview(r);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Xato: parse qilinmadi");
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!confirm("Ishonchingiz komilmi? Barcha qatorlar uchun student va natija yaratiladi.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<CommitResponse>("/api/admin/results/import-csv", {
        method: "POST",
        body: buildBody(false),
      });
      setCommit(r);
      // Hide the preview once the import succeeds — the credentials table
      // below replaces it and the row-by-row breakdown becomes redundant.
      setPreview(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Import xato");
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // The school's export is Windows-1252 mixed with UTF-8. We read as
    // UTF-8; the backend fixes the O'-style artefacts.
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f, "utf-8");
  }

  const credentialTsv = useMemo(() => {
    if (!commit) return "";
    const header = ["T/r", "F.I.O.", "Login (kod)", "Parol"].join("\t");
    const lines = commit.created.map((r) => [r.tr, r.fullName, r.publicCode, r.password ?? ""].join("\t"));
    return [header, ...lines].join("\n");
  }, [commit]);

  // Trigger a browser download for a Blob. `filename` includes the extension.
  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on the next tick so the click has time to consume the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const examLabel = exams.find((e) => e.id === examId)?.title.replace(/[^\p{L}\p{N}]+/gu, "_") ?? "import";
  const baseFileName = `credentials-${examLabel}-${timestamp}`;

  function downloadCsv() {
    if (!commit) return;
    const escape = (v: string | number) => {
      const s = String(v);
      // RFC-4180 style — quote if the value contains a comma, quote, or newline.
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["T/r", "F.I.O.", "Login (kod)", "Parol", "Student holati", "Kelgan"].map(escape).join(",");
    const lines = commit.created.map((r) =>
      [
        r.tr,
        r.fullName,
        r.publicCode,
        r.password ?? "",
        r.studentCreated ? "Yangi student" : "Mavjud student",
        r.isAllZero ? "Kelmagan" : "Ha",
      ].map(escape).join(","),
    );
    // BOM so Excel opens UTF-8 correctly.
    downloadBlob("﻿" + [header, ...lines].join("\n"), `${baseFileName}.csv`, "text/csv;charset=utf-8");
  }

  function downloadJson() {
    if (!commit) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      examId: commit.examId ?? examId,
      totalRows: commit.totalRows,
      created: commit.created.map((r) => ({
        tr: r.tr,
        fullName: r.fullName,
        publicCode: r.publicCode,
        password: r.password,
        studentCreated: r.studentCreated,
        attended: !r.isAllZero,
      })),
      skipped: commit.skipped,
      parseErrors: commit.parseErrors,
    };
    downloadBlob(JSON.stringify(payload, null, 2), `${baseFileName}.json`, "application/json");
  }

  // Direct PDF download using jsPDF + AutoTable — no print dialog. Landscape
  // fits the 5-column credentials table comfortably; long lists paginate
  // automatically. Dynamic import keeps the ~200KB library out of the
  // initial bundle for users who don't hit the import screen.
  async function downloadPdf() {
    if (!commit) return;
    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const examTitle = exams.find((e) => e.id === examId)?.title ?? "Import";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(6, 17, 60);
    doc.text("Sodiq School — Kirish imtihoni loginlar ro'yxati", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`${examTitle} · ${timestamp} · Jami: ${commit.created.length} o'quvchi`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [["T/r", "F.I.O.", "Login (kod)", "Parol", "Kelgan"]],
      body: commit.created.map((r) => [
        String(r.tr),
        r.fullName,
        r.publicCode,
        r.password ?? "",
        r.isAllZero ? "Kelmagan" : "Ha",
      ]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, textColor: [17, 24, 39], lineColor: [209, 213, 219], lineWidth: 0.1 },
      headStyles: { fillColor: [243, 244, 246], textColor: [6, 17, 60], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: {
        0: { cellWidth: 15 },
        2: { font: "courier", cellWidth: 30 },
        3: { font: "courier", cellWidth: 40 },
        4: { cellWidth: 25 },
      },
      margin: { top: 26, left: 14, right: 14 },
    });

    // Footer on the last page.
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

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Natijalarni CSV/JSON dan import qilish</h1>
        <Link href="/results" className="text-sm text-navy hover:underline">← Natijalar</Link>
      </div>

      <p className="text-sm text-gray-600">
        Maktabning "Kirish imtihoni natijalari" faylini yuklab, imtihonni tanlang. Har o'quvchi uchun
        <b> student + DRAFT natija</b> yaratiladi. Login formati: <code className="bg-gray-100 px-1 rounded">Familya[0] + Ism[0] + UID</code>
        (masalan Rustamjonzoda Abdulloh 2605086 → <code className="bg-gray-100 px-1 rounded">RA2605086</code>).
        Parol tasodifiy 10 belgi. Bola imtihonga kelmagan bo'lsa (barcha savol 0), student baribir yaratiladi
        va natija barcha savollar "Noto'g'ri" holatida saqlanadi.
      </p>

      <div className="card p-4 space-y-3">
        <div>
          <label className="label">Imtihon</label>
          <select
            className="input"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
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
          <label className="label">CSV yoki JSON matn</label>
          <div className="flex items-center gap-3 mb-2">
            <input type="file" accept=".csv,.tsv,.json,.txt" onChange={onFile} className="text-sm" />
            <span className="text-xs text-gray-500">yoki matnni pastga joylang</span>
          </div>
          <textarea
            className="input font-mono text-xs"
            rows={10}
            placeholder='T/r,UID nomer,O`quvchining ismi,O`quvchining familiyasi,Jinsi,Sinf darajasi,Imtihon tili,MATEMATIKA...'
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={onPreview}
            disabled={disabled}
          >
            <Icon name="fileJson" size={14} />
            {busy && !commit ? "Yuklanmoqda…" : "Ko'rib chiqish (dry-run)"}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={onCommit}
            disabled={disabled || !preview}
            title={!preview ? "Avval Ko'rib chiqish ni bosing" : "DBga saqlash"}
          >
            <Icon name="upload" size={14} />
            {busy && commit == null && preview ? "Import qilinmoqda…" : "Import qilish"}
          </button>
        </div>

        {error && <div className="text-bad text-sm">{error}</div>}
      </div>

      {preview && (
        <div className="card">
          <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
            <span>Ko'rib chiqish · jami {preview.totalRows} qator</span>
            {preview.parseErrors.length > 0 && (
              <span className="text-warn text-sm">Xato qatorlar: {preview.parseErrors.length}</span>
            )}
          </div>
          {preview.expectedCounts && (
            <div className="px-4 py-2 border-b bg-navy/5 text-xs">
              <b className="text-navy">Imtihon test shabloni:</b>{" "}
              math = <b>{preview.expectedCounts.MATH}</b> ta savol,{" "}
              ct = <b>{preview.expectedCounts.CRITICAL_THINKING}</b> ta,{" "}
              eng = <b>{preview.expectedCounts.ENGLISH}</b> ta.
              JSON'dagi arraylar shu uzunlikda bo'lishi shart.
            </div>
          )}
          {preview.noTemplateSubjects && preview.noTemplateSubjects.length > 0 && (
            <div className="px-4 py-2 border-b bg-warn/10 text-xs text-warn font-medium">
              ⚠ Quyidagi fanlar uchun bu imtihonda haqiqiy test shabloni topilmadi —
              avtomatik shablon ishlatiladi (standart savol tuzilishi, mavzu/ko'nikma yo'q):{" "}
              {preview.noTemplateSubjects.join(", ")}.{" "}
              Import'dan oldin <b>Test shablonlari</b> bo'limidan ushbu imtihon uchun shablon qo'shing.
            </div>
          )}
          {preview.parseErrors.length > 0 && (
            <details className="text-xs px-4 py-2 border-b bg-warn/5">
              <summary className="cursor-pointer text-warn font-medium">
                {preview.parseErrors.length} ta qator parse qilinmadi
              </summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                {preview.parseErrors.map((e, i) => (
                  <li key={i} className="border-t pt-1">
                    <b>#{e.rowNumber}</b>: {e.reason}
                    <pre className="mt-1 bg-gray-50 p-1 rounded text-[10px] whitespace-pre-wrap">{e.raw.slice(0, 200)}</pre>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">T/r</th>
                  <th className="text-left px-3 py-2">F.I.O.</th>
                  <th className="text-left px-3 py-2">UID</th>
                  <th className="text-left px-3 py-2">Jinsi</th>
                  <th className="text-left px-3 py-2">Sinf</th>
                  <th className="text-right px-3 py-2">MATH</th>
                  <th className="text-right px-3 py-2">TF</th>
                  <th className="text-right px-3 py-2">ENG</th>
                  <th className="text-left px-3 py-2">Holat</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((r) => (
                  <tr key={r.tr} className={`border-t ${r.isAllZero ? "text-gray-500" : ""}`}>
                    <td className="px-3 py-1.5">{r.tr}</td>
                    <td className="px-3 py-1.5">{r.fullName}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.uid}</td>
                    <td className="px-3 py-1.5">{r.sex === "MALE" ? "O'g'il" : r.sex === "FEMALE" ? "Qiz" : "—"}</td>
                    <td className="px-3 py-1.5">{r.grade}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{r.mathCorrect}/{preview.expectedCounts?.MATH ?? 25}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{r.ctCorrect}/{preview.expectedCounts?.CRITICAL_THINKING ?? 10}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{r.engCorrect}/{preview.expectedCounts?.ENGLISH ?? 50}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {r.existingResultCode ? (
                        <span className="text-warn">Ushbu imtihonda ilgari import qilingan ({r.existingResultCode}) — yangi natija baribir yaratiladi</span>
                      ) : r.existingStudent ? (
                        <span className="text-good">Student mavjud — yangi natija</span>
                      ) : r.isAllZero ? (
                        <span>Yangi (kelmagan)</span>
                      ) : (
                        <span className="text-good">Yangi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50">
            Barcha {preview.preview.length} qator uchun yangi natija yaratiladi
            (student mavjud bo'lsa qayta yaratilmaydi, ammo natija baribir yangi).
            Har natijaga tasodifiy 6 belgilik login kod va parol beriladi — pastdagi jadval'dan nusxa oling.
          </div>
          {preview.totalRows > preview.preview.length && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t">
              Ko'rsatilyapti: {preview.preview.length} / {preview.totalRows}
            </div>
          )}
        </div>
      )}

      {commit && (
        <div className="card">
          <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
            <span>Import natijasi</span>
            <div className="text-sm">
              <span className="text-good font-medium">{commit.created.length}</span> yaratildi
              {commit.skipped.length > 0 && (
                <>
                  <span className="text-gray-400"> · </span>
                  <span className="text-warn font-medium">{commit.skipped.length}</span> o'tkazildi
                </>
              )}
            </div>
          </div>

          {commit.skipped.length > 0 && (
            <details className="text-xs px-4 py-2 border-b bg-warn/5">
              <summary className="cursor-pointer text-warn font-medium">
                O'tkazilgan qatorlar batafsil
              </summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                {commit.skipped.map((s, i) => (
                  <li key={i} className="border-t pt-1">
                    <b>T/r {s.tr}</b>: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-700 mr-1">Yuklab olish:</span>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={downloadCsv}
            >
              <Icon name="download" size={12} /> CSV
            </button>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={downloadJson}
            >
              <Icon name="download" size={12} /> JSON
            </button>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={downloadPdf}
              title="Yangi oyna ochilib brauzer print/PDF dialogi ishga tushadi"
            >
              <Icon name="download" size={12} /> PDF
            </button>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              onClick={() => navigator.clipboard.writeText(credentialTsv)}
              title="Excel / Google Sheets ga to'g'ridan-to'g'ri joylash uchun"
            >
              <Icon name="copy" size={12} /> Nusxa (TSV)
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">T/r</th>
                  <th className="text-left px-3 py-2">F.I.O.</th>
                  <th className="text-left px-3 py-2">Login (kod)</th>
                  <th className="text-left px-3 py-2">Parol</th>
                  <th className="text-left px-3 py-2">Holat</th>
                </tr>
              </thead>
              <tbody>
                {commit.created.map((r) => (
                  <tr key={r.tr} className="border-t">
                    <td className="px-3 py-1.5">{r.tr}</td>
                    <td className="px-3 py-1.5">{r.fullName}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.publicCode}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.password}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {r.studentCreated ? (
                        <span className="text-good">Yangi student</span>
                      ) : (
                        <span className="text-gray-500">Mavjud student</span>
                      )}
                      {r.isAllZero && <span className="text-gray-400"> · imtihonga kelmagan</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
