"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

interface ResultRow {
  id: string;
  publicCode: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  student: { fullName: string; grade: number };
  exam: { title: string };
}

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
const SUBJECT_LABEL: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

interface StudentRow {
  resultId: string;
  publicCode: string;
  studentName: string;
  grade: number;
  examTitle: string;
  math: number | null;
  english: number | null;
  ct: number | null;
  composite: number | null;
  band: string | null;
  verdict: string | null;
  verdictSub: string | null;
  passed: boolean | null;
  publishedAt: string | null;
}
interface Stats {
  totals: { all: number; draft: number; published: number; archived: number };
  composite: { avg: number | null; median: number | null; min: number | null; max: number | null; n: number };
  subjects: Record<SubjectKey, { avg: number | null; n: number }>;
  bands: { label: string; count: number }[];
  verdicts: { label: string; count: number }[];
  grades: { grade: number; count: number }[];
  exams: { id: string; title: string; grade: number; n: number; avg: number | null }[];
  students: { items: StudentRow[]; total: number; page: number; take: number; pages: number };
  ai?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    runs: number;
    results: number;
  };
}

const STUDENTS_TAKE = 50;

type SortKey = "studentName" | "grade" | "math" | "english" | "ct" | "composite" | "verdict" | "publishedAt";

const BAND_COLORS: Record<string, string> = {
  "0–34": "#D2503F",
  "35–49": "#E37A2C",
  "50–66": "#C98A12",
  "67–83": "#3266C9",
  "84–100": "#2F9E6B",
};

const VERDICT_COLORS: Record<string, string> = {
  "QABUL TAVSIYA ETILADI": "#2F9E6B",
  "QABUL QILINSIN": "#3266C9",
  "SHARTLI QABUL": "#C98A12",
  "NAVBATDA": "#E37A2C",
  "TAYYOR EMAS": "#D2503F",
  // Legacy English labels — keep so old published snapshots still render in
  // colour until they get regenerated.
  "STRONG ADMIT": "#2F9E6B",
  "ADMIT": "#3266C9",
  "CONDITIONAL ADMIT": "#C98A12",
  "WAITLIST": "#E37A2C",
  "NOT YET READY": "#D2503F",
};

export default function DashboardPage() {
  const [students, setStudents] = useState(0);
  const [exams, setExams] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // basic dashboard fetches (once)
  useEffect(() => {
    Promise.all([
      // Use the paginated wrapper's `total` — cheaper than downloading the
      // whole roster just to read `.length`.
      api<{ total: number }>("/api/admin/students?take=1").then((d) => setStudents(d.total)),
      api<{ total: number }>("/api/admin/exams?take=1").then((d) => setExams(d.total)),
      // Paginated wrapper — dashboard only needs the first page for the
      // "so'nggi harakatlar" table, so default take=50 is more than enough.
      api<{ items: ResultRow[] }>("/api/admin/results").then((d) => setResults(d.items)),
    ]).catch(() => undefined);
  }, []);

  const maxBand = stats ? Math.max(1, ...stats.bands.map((b) => b.count)) : 1;
  const maxVerdict = stats ? Math.max(1, ...stats.verdicts.map((v) => v.count)) : 1;
  const maxGrade = stats ? Math.max(1, ...stats.grades.map((g) => g.count)) : 1;

  const [query, setQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [examFilter, setExamFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortAsc, setSortAsc] = useState(false);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsLoading, setStudentsLoading] = useState(false);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(false); }
  }

  // Fetch stats + paginated students from server. Filter/sort options are sent
  // as query params, so the client never downloads the full 1k-row payload.
  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set("page", String(studentsPage));
    qs.set("take", String(STUDENTS_TAKE));
    if (query) qs.set("q", query);
    if (verdictFilter) qs.set("verdict", verdictFilter);
    if (gradeFilter) qs.set("grade", gradeFilter);
    if (examFilter) qs.set("examTitle", examFilter);
    qs.set("sortKey", sortKey);
    qs.set("sortAsc", String(sortAsc));
    setStudentsLoading(true);
    api<Stats>(`/api/admin/stats?${qs}`)
      .then((d) => { setStats(d); setStatsError(null); })
      .catch((e: Error) => setStatsError(e.message || "Statistika yuklanmadi"))
      .finally(() => setStudentsLoading(false));
  }, [studentsPage, query, verdictFilter, gradeFilter, examFilter, sortKey, sortAsc]);

  // Reset to first page when any filter/sort changes.
  useEffect(() => { setStudentsPage(1); }, [query, verdictFilter, gradeFilter, examFilter, sortKey, sortAsc]);

  const studentRows = stats?.students.items ?? [];
  const studentsTotal = stats?.students.total ?? 0;
  const studentsPages = stats?.students.pages ?? 1;

  const uniqueVerdicts = useMemo(
    () => (stats?.verdicts ?? []).map((v) => v.label),
    [stats],
  );
  const uniqueGrades = useMemo(
    () => (stats?.grades ?? []).map((g) => g.grade),
    [stats],
  );
  const uniqueExams = useMemo(
    () => (stats?.exams ?? []).map((e) => e.title),
    [stats],
  );

  function exportCsv() {
    if (!stats) return;
    const rows = [
      ["Kod", "Ism", "Sinf", "Imtihon", "Matematika", "Ingliz", "Tanqidiy", "Umumiy", "Band", "Qaror", "Qaror tavsifi", "O'tdi", "Nashr"],
      ...studentRows.map((s) => [
        s.publicCode,
        s.studentName,
        String(s.grade),
        s.examTitle,
        s.math ?? "",
        s.english ?? "",
        s.ct ?? "",
        s.composite ?? "",
        s.band ?? "",
        s.verdict ?? "",
        s.verdictSub ?? "",
        s.passed == null ? "" : s.passed ? "Ha" : "Yo'q",
        s.publishedAt ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => {
      const v = String(c ?? "");
      return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sodiq-natijalar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy">Bosh sahifa</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="O'quvchilar" value={students} />
        <Stat label="Imtihonlar" value={exams} />
        <Stat label="Qoralama" value={stats?.totals.draft ?? results.filter((r) => r.status === "DRAFT").length} />
        <Stat label="Nashr etilgan" value={stats?.totals.published ?? results.filter((r) => r.status === "PUBLISHED").length} />
        <Stat label="Arxiv" value={stats?.totals.archived ?? results.filter((r) => r.status === "ARCHIVED").length} />
      </div>

      {!stats && statsError && (
        <div className="card p-3 bg-warn/10 text-sm text-warn">
          <b>Batafsil statistika yuklanmadi.</b> Backend serverni qayta ishga tushiring:
          <code className="mx-1 px-1 bg-white rounded">/api/admin/stats</code> endpoint javob bermayapti ({statsError}).
        </div>
      )}

      {stats && stats.totals.published > 0 && (
        <>
          <h2 className="text-lg font-semibold text-navy pt-2">Umumiy statistika</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="O'rtacha ball" value={stats.composite.avg ?? 0} suffix="/100" />
            <Stat label="Median" value={stats.composite.median ?? 0} suffix="/100" />
            <Stat label="Eng past" value={stats.composite.min ?? 0} suffix="/100" />
            <Stat label="Eng yuqori" value={stats.composite.max ?? 0} suffix="/100" />
          </div>

          {stats.ai && stats.ai.results > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <div className="text-sm font-medium text-navy">DeepSeek AI xarajati</div>
                  <div className="text-xs text-gray-500">
                    {stats.ai.results} ta natija · {stats.ai.runs} ta chaqiruv
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-navy">
                    ${stats.ai.costUsd.toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-500">jami xarajat</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Prompt tokenlar</div>
                  <div className="font-mono">{stats.ai.promptTokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Completion tokenlar</div>
                  <div className="font-mono">{stats.ai.completionTokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Jami tokenlar</div>
                  <div className="font-mono">{stats.ai.totalTokens.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">O'rtacha (bir natija)</div>
                  <div className="font-mono">
                    {stats.ai.results > 0 ? Math.round(stats.ai.totalTokens / stats.ai.results).toLocaleString() : 0} token
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {(Object.keys(SUBJECT_LABEL) as SubjectKey[]).map((k) => (
              <div key={k} className="card p-4">
                <div className="text-xs uppercase text-gray-500">{SUBJECT_LABEL[k]}</div>
                <div className="text-3xl font-semibold text-navy">
                  {stats.subjects[k].avg ?? "—"}
                  <span className="text-lg text-gray-400">/100</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.subjects[k].n} ta natija bo'yicha o'rtacha
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-sm font-medium text-navy mb-3">Ball taqsimoti (Yakuniy shkala)</div>
              <div className="space-y-2">
                {stats.bands.map((b) => (
                  <BarRow
                    key={b.label}
                    label={b.label}
                    value={b.count}
                    max={maxBand}
                    color={BAND_COLORS[b.label] ?? "#06113C"}
                  />
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-medium text-navy mb-3">Qabul qarorlari</div>
              {stats.verdicts.length === 0 ? (
                <div className="text-sm text-gray-500">Hozircha ma'lumot yo'q.</div>
              ) : (
                <div className="space-y-2">
                  {stats.verdicts.map((v) => (
                    <BarRow
                      key={v.label}
                      label={v.label}
                      value={v.count}
                      max={maxVerdict}
                      color={VERDICT_COLORS[v.label] ?? "#06113C"}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="text-sm font-medium text-navy mb-3">Sinf bo'yicha natijalar</div>
              {stats.grades.length === 0 ? (
                <div className="text-sm text-gray-500">Ma'lumot yo'q.</div>
              ) : (
                <div className="space-y-2">
                  {stats.grades.map((g) => (
                    <BarRow
                      key={g.grade}
                      label={`${g.grade}-sinf`}
                      value={g.count}
                      max={maxGrade}
                      color="#06113C"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <div className="text-sm font-medium text-navy mb-3">Imtihonlar</div>
              {stats.exams.length === 0 ? (
                <div className="text-sm text-gray-500">Ma'lumot yo'q.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="text-left py-1">Imtihon</th>
                      <th className="text-right py-1 w-16">Soni</th>
                      <th className="text-right py-1 w-20">O'rt.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.exams.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="py-1 pr-2">
                          <div>{e.title}</div>
                          <div className="text-xs text-gray-500">{e.grade}-sinf</div>
                        </td>
                        <td className="py-1 text-right font-mono">{e.n}</td>
                        <td className="py-1 text-right font-mono">
                          {e.avg == null ? "—" : `${e.avg}/100`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {stats && studentsTotal > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-medium">Barcha natijalar</h2>
              <span className="text-xs text-gray-500">
                {studentsTotal} ta{studentsLoading ? " · yuklanmoqda…" : ""}
              </span>
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={exportCsv}>
              Ushbu sahifani CSV
            </button>
          </div>
          <div className="px-4 py-3 border-b grid md:grid-cols-4 gap-2 bg-gray-50">
            <input
              className="input"
              placeholder="Ism yoki kod bo'yicha qidiring…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="input" value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
              <option value="">Barcha qarorlar</option>
              {uniqueVerdicts.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <select className="input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
              <option value="">Barcha sinflar</option>
              {uniqueGrades.map((g) => (<option key={g} value={g}>{g}-sinf</option>))}
            </select>
            <select className="input" value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
              <option value="">Barcha imtihonlar</option>
              {uniqueExams.map((e) => (<option key={e} value={e}>{e}</option>))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Kod</th>
                  <SortTh k="studentName" cur={sortKey} asc={sortAsc} onClick={toggleSort}>O'quvchi</SortTh>
                  <SortTh k="grade" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="right">Sinf</SortTh>
                  <th className="text-left px-3 py-2">Imtihon</th>
                  <SortTh k="math" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="right">Mat.</SortTh>
                  <SortTh k="english" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="right">Ing.</SortTh>
                  <SortTh k="ct" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="right">Tanq.</SortTh>
                  <SortTh k="composite" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="right">Umumiy</SortTh>
                  <SortTh k="verdict" cur={sortKey} asc={sortAsc} onClick={toggleSort}>Qaror</SortTh>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((s) => (
                  <tr key={s.resultId} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/results/${s.resultId}`} className="text-navy hover:underline">
                        {s.publicCode}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{s.studentName}</td>
                    <td className="px-3 py-2 text-right">{s.grade}</td>
                    <td className="px-3 py-2 text-gray-600">{s.examTitle}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <ScoreCell v={s.math} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <ScoreCell v={s.english} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <ScoreCell v={s.ct} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      <ScoreCell v={s.composite} strong />
                    </td>
                    <td className="px-3 py-2">
                      {s.verdict ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ background: VERDICT_COLORS[s.verdict] ?? "#6B7385" }}
                          title={s.verdictSub ?? undefined}
                        >
                          {s.verdict}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {studentRows.length === 0 && !studentsLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      Filtrga mos natija topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {studentsPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {(studentsPage - 1) * STUDENTS_TAKE + 1}
                –{Math.min(studentsPage * STUDENTS_TAKE, studentsTotal)} / {studentsTotal} ta
              </span>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1 disabled:opacity-40"
                  onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
                  disabled={studentsPage <= 1 || studentsLoading}
                >Oldingi</button>
                <span className="text-gray-600">Sahifa {studentsPage} / {studentsPages}</span>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1 disabled:opacity-40"
                  onClick={() => setStudentsPage((p) => Math.min(studentsPages, p + 1))}
                  disabled={studentsPage >= studentsPages || studentsLoading}
                >Keyingi</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium">Qoralamalar va so'nggi harakatlar</h2>
          <Link href="/results" className="text-sm text-navy hover:underline">Hammasi</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Kod</th>
              <th className="text-left px-4 py-2">O'quvchi</th>
              <th className="text-left px-4 py-2">Imtihon</th>
              <th className="text-left px-4 py-2">Holat</th>
            </tr>
          </thead>
          <tbody>
            {results.slice(0, 8).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-mono">{r.publicCode}</td>
                <td className="px-4 py-2">{r.student.fullName} ({r.student.grade}-sinf)</td>
                <td className="px-4 py-2">{r.exam.title}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Hozircha natija yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-3xl font-semibold text-navy">
        {value}
        {suffix && <span className="text-lg text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function SortTh({
  k, cur, asc, onClick, align, children,
}: {
  k: SortKey;
  cur: SortKey;
  asc: boolean;
  onClick: (k: SortKey) => void;
  align?: "right" | "left";
  children: ReactNode;
}) {
  const active = cur === k;
  return (
    <th
      className={`px-3 py-2 select-none cursor-pointer hover:text-navy ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onClick(k)}
    >
      <span className={active ? "text-navy" : ""}>{children}</span>
      {active && <span className="ml-1 text-navy">{asc ? "▲" : "▼"}</span>}
    </th>
  );
}

function ScoreCell({ v, strong }: { v: number | null; strong?: boolean }) {
  if (v == null) return <span className="text-gray-300">—</span>;
  const color = v >= 84 ? "#2F9E6B" : v >= 67 ? "#3266C9" : v >= 50 ? "#C98A12" : v >= 35 ? "#E37A2C" : "#D2503F";
  return (
    <span style={{ color: strong ? color : undefined, fontWeight: strong ? 700 : undefined }}>
      {v}
      <span className="text-gray-400 font-normal">/100</span>
    </span>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-mono text-gray-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
