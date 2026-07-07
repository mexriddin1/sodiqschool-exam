import { Router } from "express";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { requireAdmin } from "../middleware/auth.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";

export const statsRouter = Router();
statsRouter.use(requireAdmin);

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";

// Official Sodiq School "Yakuniy shkala" — matches scoreBand() in @sodiq/compute
// so the histogram lines up with the band labels shown on the report.
const BANDS: { label: string; min: number; max: number }[] = [
  { label: "0–34",   min: 0,  max: 35 },
  { label: "35–49",  min: 35, max: 50 },
  { label: "50–66",  min: 50, max: 67 },
  { label: "67–83",  min: 67, max: 84 },
  { label: "84–100", min: 84, max: 101 },
];

function bandOf(percent: number): string {
  for (const b of BANDS) if (percent >= b.min && percent < b.max) return b.label;
  return BANDS[BANDS.length - 1]!.label;
}

interface Snapshot {
  perSubject?: Partial<Record<SubjectKey, { percent?: number; band?: { label?: string } | null } | null>>;
  composite?: {
    composite?: number;
    compBand?: { label?: string } | null;
    verdict?: { label?: string; sub?: string };
    gateAllPassed?: boolean;
  } | null;
}

/**
 * Aggregate stats + per-student rows across ALL published results. Draft and
 * archived counts come from status; every scored metric is read out of the
 * frozen calculatedSnapshot, so the dashboard shows exactly what parents see.
 */
// In-memory cache for the aggregate computation. Every published result adds
// ~5–10 KB of JSON snapshot, so a school-sized dataset (~1k results) is
// ~5–10 MB per query. Recomputing on every dashboard hit would be wasteful;
// invalidation is triggered on Result mutations via `invalidateStats()`.
interface AggregateCache {
  builtAt: number;
  aggregates: Record<string, unknown>;
  students: StudentRow[];
}
let cache: AggregateCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateStats(): void { cache = null; }

statsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) {
      ok(res, { ...cache.aggregates, students: paginateStudents(cache.students, req) });
      return;
    }
    const [draftCount, publishedCount, archivedCount, published, examTotals] = await Promise.all([
      prisma.result.count({ where: { status: "DRAFT" } }),
      prisma.result.count({ where: { status: "PUBLISHED" } }),
      prisma.result.count({ where: { status: "ARCHIVED" } }),
      prisma.result.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          publicCode: true,
          calculatedSnapshot: true,
          aiUsage: true,
          publishedAt: true,
          examId: true,
          student: { select: { id: true, fullName: true, grade: true, phone: true } },
          exam: { select: { title: true, grade: true } },
        },
      }),
      prisma.result.count(),
    ]);

    const statusMap = { DRAFT: draftCount, PUBLISHED: publishedCount, ARCHIVED: archivedCount };

    // Per-subject running sum + count, so an empty subject doesn't skew avg
    // toward zero. Composite comes straight off the snapshot.
    const subjSum: Record<SubjectKey, number> = { MATH: 0, ENGLISH: 0, CRITICAL_THINKING: 0 };
    const subjN:   Record<SubjectKey, number> = { MATH: 0, ENGLISH: 0, CRITICAL_THINKING: 0 };
    const compositeValues: number[] = [];
    const bandCounts: Record<string, number> = {};
    for (const b of BANDS) bandCounts[b.label] = 0;
    const verdictCounts: Record<string, number> = {};
    const gradeCounts: Record<string, number> = {};
    const examStats = new Map<string, { title: string; grade: number; n: number; sum: number }>();

    interface StudentRow {
      resultId: string;
      publicCode: string;
      studentName: string;
      grade: number;
      phone: string | null;
      examTitle: string;
      math: number | null;
      english: number | null;
      ct: number | null;
      composite: number | null;
      band: string | null;
      verdict: string | null;
      verdictSub: string | null;
      passed: boolean | null;   // grade-threshold gate on all three subjects
      publishedAt: string | null;
    }
    const students: StudentRow[] = [];

    const aiUsageAgg = { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, runs: 0, results: 0 };
    for (const r of published) {
      const snap = (r.calculatedSnapshot as Snapshot | null) ?? {};
      const per = snap.perSubject ?? {};
      const usage = r.aiUsage as { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number; runs?: unknown[] } | null;
      if (usage && typeof usage.totalTokens === "number") {
        aiUsageAgg.promptTokens     += usage.promptTokens ?? 0;
        aiUsageAgg.completionTokens += usage.completionTokens ?? 0;
        aiUsageAgg.totalTokens      += usage.totalTokens ?? 0;
        aiUsageAgg.costUsd          += usage.costUsd ?? 0;
        aiUsageAgg.runs             += Array.isArray(usage.runs) ? usage.runs.length : 0;
        aiUsageAgg.results          += 1;
      }
      for (const k of Object.keys(subjSum) as SubjectKey[]) {
        const p = per[k]?.percent;
        if (typeof p === "number") { subjSum[k] += p; subjN[k] += 1; }
      }
      const c = snap.composite?.composite;
      if (typeof c === "number") {
        compositeValues.push(c);
        const bk = bandOf(c);
        bandCounts[bk] = (bandCounts[bk] ?? 0) + 1;
      }
      const v = snap.composite?.verdict?.label;
      if (v) verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;

      const g = r.student?.grade;
      if (typeof g === "number") gradeCounts[String(g)] = (gradeCounts[String(g)] ?? 0) + 1;

      const cur = examStats.get(r.examId);
      const inc = typeof c === "number" ? c : 0;
      const has = typeof c === "number";
      if (cur) {
        cur.n += 1;
        if (has) cur.sum += inc;
      } else {
        examStats.set(r.examId, {
          title: r.exam?.title ?? "—",
          grade: r.exam?.grade ?? 0,
          n: 1,
          sum: has ? inc : 0,
        });
      }

      students.push({
        resultId: r.id,
        publicCode: r.publicCode,
        studentName: r.student?.fullName ?? "—",
        grade: r.student?.grade ?? 0,
        phone: r.student?.phone ?? null,
        examTitle: r.exam?.title ?? "—",
        math: typeof per.MATH?.percent === "number" ? per.MATH!.percent! : null,
        english: typeof per.ENGLISH?.percent === "number" ? per.ENGLISH!.percent! : null,
        ct: typeof per.CRITICAL_THINKING?.percent === "number" ? per.CRITICAL_THINKING!.percent! : null,
        composite: typeof c === "number" ? c : null,
        band: typeof c === "number" ? bandOf(c) : null,
        verdict: snap.composite?.verdict?.label ?? null,
        verdictSub: snap.composite?.verdict?.sub ?? null,
        passed: typeof snap.composite?.gateAllPassed === "boolean" ? snap.composite!.gateAllPassed! : null,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      });
    }

    const round = (x: number) => Math.round(x);
    const avg = (s: number, n: number) => (n === 0 ? null : round(s / n));

    // Median composite — a small guard for a rugged report even when a single
    // outlier drags the mean. Ties broken toward the lower value.
    const sorted = [...compositeValues].sort((a, b) => a - b);
    const median = sorted.length === 0 ? null
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]!
        : round((sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2);

    const aggregates = {
      totals: {
        all: examTotals,
        draft: statusMap.DRAFT,
        published: statusMap.PUBLISHED,
        archived: statusMap.ARCHIVED,
      },
      composite: {
        avg: avg(compositeValues.reduce((a, b) => a + b, 0), compositeValues.length),
        median,
        min: sorted[0] ?? null,
        max: sorted[sorted.length - 1] ?? null,
        n: compositeValues.length,
      },
      subjects: {
        MATH:              { avg: avg(subjSum.MATH, subjN.MATH),                             n: subjN.MATH },
        ENGLISH:           { avg: avg(subjSum.ENGLISH, subjN.ENGLISH),                       n: subjN.ENGLISH },
        CRITICAL_THINKING: { avg: avg(subjSum.CRITICAL_THINKING, subjN.CRITICAL_THINKING),   n: subjN.CRITICAL_THINKING },
      },
      bands: BANDS.map((b) => ({ label: b.label, count: bandCounts[b.label] })),
      verdicts: Object.entries(verdictCounts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      grades: Object.entries(gradeCounts)
        .map(([grade, count]) => ({ grade: Number(grade), count }))
        .sort((a, b) => a.grade - b.grade),
      exams: Array.from(examStats.entries())
        .map(([id, x]) => ({ id, title: x.title, grade: x.grade, n: x.n, avg: x.n === 0 ? null : round(x.sum / x.n) }))
        .sort((a, b) => b.n - a.n),
      ai: {
        ...aiUsageAgg,
        costUsd: Number(aiUsageAgg.costUsd.toFixed(4)),
      },
    };
    cache = { builtAt: Date.now(), aggregates, students };
    // Paginated student rows so the dashboard can render one page at a time.
    // Callers pass ?page=N&take=M; defaults keep the response ~200 KB.
    ok(res, { ...aggregates, students: paginateStudents(students, req) });
  }),
);

// Server-side sort + filter for the student rows so the client doesn't have to
// download 1000 rows just to filter/sort. Mirrors the columns the dashboard
// table renders (see `SortKey` in admin/src/app/(panel)/dashboard/page.tsx).
type StudentRow = {
  resultId: string; publicCode: string; studentName: string; grade: number;
  phone: string | null; examTitle: string; math: number | null; english: number | null;
  ct: number | null; composite: number | null; band: string | null; verdict: string | null;
  verdictSub: string | null; passed: boolean | null; publishedAt: string | null;
};
function paginateStudents(rows: StudentRow[], req: import("express").Request) {
  const filtered = applyStudentFilters(rows, req);
  // maxTake raised to 10k so the dashboard "Barcha CSV" export can grab
  // every filtered row in a single request; regular list views still hit
  // the small defaultTake.
  const p = parsePagination(req, { defaultTake: 100, maxTake: 10_000 });
  return wrapPaginated(filtered.slice(p.skip, p.skip + p.take), filtered.length, p);
}
function applyStudentFilters(rows: StudentRow[], req: import("express").Request): StudentRow[] {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const verdict = req.query.verdict ? String(req.query.verdict) : undefined;
  const grade = req.query.grade ? Number(req.query.grade) : undefined;
  const examTitle = req.query.examTitle ? String(req.query.examTitle) : undefined;
  const sortKey = String(req.query.sortKey ?? "composite");
  const sortAsc = String(req.query.sortAsc ?? "false") === "true";
  let out = rows;
  if (q) out = out.filter((s) => `${s.studentName} ${s.publicCode}`.toLowerCase().includes(q));
  if (verdict) out = out.filter((s) => s.verdict === verdict);
  if (Number.isFinite(grade)) out = out.filter((s) => s.grade === grade);
  if (examTitle) out = out.filter((s) => s.examTitle === examTitle);
  const nz = (v: number | null | undefined) => (v == null ? -1 : v);
  const cmp = (a: StudentRow, b: StudentRow) => {
    let d = 0;
    switch (sortKey) {
      case "studentName": d = a.studentName.localeCompare(b.studentName, "uz"); break;
      case "grade":       d = a.grade - b.grade; break;
      case "math":        d = nz(a.math) - nz(b.math); break;
      case "english":     d = nz(a.english) - nz(b.english); break;
      case "ct":          d = nz(a.ct) - nz(b.ct); break;
      case "composite":   d = nz(a.composite) - nz(b.composite); break;
      case "verdict":     d = (a.verdict ?? "").localeCompare(b.verdict ?? ""); break;
      case "publishedAt": d = (a.publishedAt ?? "").localeCompare(b.publishedAt ?? ""); break;
    }
    return sortAsc ? d : -d;
  };
  return [...out].sort(cmp);
}
