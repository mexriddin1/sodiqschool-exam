// CSV bulk import for "Kirish imtihoni natijalari" spreadsheet exports.
//
// Layout expected (fixed columns for now, based on the school's real export):
//   col 0    T/r (row number — skipped if not a positive int)
//   col 1    UID nomer (student registry uid, used verbatim)
//   col 2    Ism (first name)
//   col 3    Familiya (last name)
//   col 4    Jinsi ("E"=MALE, "A"=FEMALE)
//   col 5    Sinf darajasi ("5-sinf" etc.)
//   col 6    Imtihon tili ("O'zbek" / "Rus" / "Ingliz")
//   col 7-31 MATH answers (25 questions, each 0/1)
//   col 32   MATH total (0-100, ignored — we recompute)
//   col 33-42 TF (Critical Thinking) answers (10 questions)
//   col 43   TF total
//   col 44-93 ENG answers (50 questions)
//   col 94   ENG total
//
// Ignored header rows: any row where T/r is not a positive integer. This
// covers the multiline header block at the top of the school's export.
//
// Encoding: the export mixes UTF-8 and Windows-1252 so O' shows up as "O�".
// fixEncoding() collapses the common cases before storage.

import { SubjectKey } from "@sodiq/compute";

export type ImportSex = "MALE" | "FEMALE";
export type ImportLang = "UZ" | "RU" | "EN";

export interface CsvParsedRow {
  rowNumber: number;     // 1-based line number in the source file (for error messages)
  tr: number;            // Value of the T/r column
  uid: string;
  firstName: string;
  lastName: string;
  sex: ImportSex | null;
  grade: number;
  examLanguage: ImportLang | null;
  // Per-subject answers as arrays of 0/1. Length is fixed per subject.
  answers: Record<SubjectKey, number[]>;
  // Whether the row had ANY non-zero answer. When every answer is 0 AND the
  // total columns are blank the row is treated as "student didn't show up" —
  // the caller still creates a student + DRAFT result with all-wrong outcomes.
  isAllZero: boolean;
}

export interface CsvParseResult {
  rows: CsvParsedRow[];
  errors: { rowNumber: number; reason: string; raw: string }[];
}

// Shape the JSON import path accepts. Mirrors the CSV columns 1:1 but is
// nicer for admins who generate the file programmatically. See parseJsonRows.
export interface JsonImportRow {
  tr?: number;
  uid: string;
  firstName: string;
  lastName: string;
  sex?: "MALE" | "FEMALE" | "E" | "A" | null;
  grade: number;
  examLanguage?: "UZ" | "RU" | "EN" | "O'zbek" | "Rus" | "Ingliz" | null;
  // Per-subject answer arrays. Length is validated (25 / 10 / 50). Values 1 or 0.
  math: number[];
  ct: number[];
  eng: number[];
}

export interface JsonImportPayload {
  students: JsonImportRow[];
}

const MATH_QUESTIONS = 25;
const CT_QUESTIONS = 10;
const ENG_QUESTIONS = 50;

// Total columns expected: 7 meta + 25+1 + 10+1 + 50+1 = 95.
const EXPECTED_COLS = 7 + MATH_QUESTIONS + 1 + CT_QUESTIONS + 1 + ENG_QUESTIONS + 1;

/** Repair the school's mixed Windows-1252/UTF-8 encoding for the ' and G' cases. */
export function fixEncoding(input: string): string {
  return input
    .replace(/O�/g, "O'").replace(/o�/g, "o'")
    .replace(/G�/g, "G'").replace(/g�/g, "g'")
    .replace(/�/g, "'")
    .replace(/�/g, "'");
}

/** Naive but sufficient CSV parser: no quoted fields expected in the export. */
function splitCsvLine(line: string): string[] {
  return line.split(",");
}

function toInt(v: string | undefined): number {
  if (v == null) return 0;
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseGrade(raw: string): number | null {
  const m = raw.match(/(\d+)/);
  if (!m || !m[1]) return null;
  const g = parseInt(m[1], 10);
  return g >= 5 && g <= 11 ? g : null;
}

function parseLanguage(raw: string): ImportLang | null {
  const s = fixEncoding(raw).trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("o'z") || s.startsWith("uzb") || s === "uz") return "UZ";
  if (s.startsWith("rus") || s === "ru") return "RU";
  if (s.startsWith("ing") || s.startsWith("eng") || s === "en") return "EN";
  return null;
}

function parseSex(raw: string): ImportSex | null {
  const s = raw.trim().toUpperCase();
  if (s === "E" || s === "M" || s === "MALE") return "MALE";
  if (s === "A" || s === "F" || s === "FEMALE") return "FEMALE";
  return null;
}

function parseAnswers(cols: string[], start: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = toInt(cols[start + i]);
    // Any non-zero → treat as correct. School export uses 1 for correct only.
    out.push(v === 1 ? 1 : 0);
  }
  return out;
}

export function parseCsv(csvText: string): CsvParseResult {
  const rows: CsvParsedRow[] = [];
  const errors: CsvParseResult["errors"] = [];
  const lines = csvText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    if (!rawLine.trim()) continue;
    const cols = splitCsvLine(rawLine);
    // Skip the multi-line header block by looking at T/r. Header rows have
    // empty or non-numeric first column.
    const trText = (cols[0] ?? "").trim();
    if (!/^\d+$/.test(trText)) continue;

    const tr = parseInt(trText, 10);
    if (tr < 1) continue;

    const uid = (cols[1] ?? "").trim();
    const firstName = fixEncoding((cols[2] ?? "").trim());
    const lastName = fixEncoding((cols[3] ?? "").trim());
    const sex = parseSex(cols[4] ?? "");
    const grade = parseGrade(cols[5] ?? "");
    const examLanguage = parseLanguage(cols[6] ?? "");

    if (!uid || !firstName || !lastName) {
      errors.push({
        rowNumber: i + 1,
        reason: "UID / ism / familiya bo'sh — qator o'tkazib yuborildi",
        raw: rawLine,
      });
      continue;
    }
    if (grade == null) {
      errors.push({
        rowNumber: i + 1,
        reason: `Sinf darajasi tan olinmadi: "${(cols[5] ?? "").trim()}"`,
        raw: rawLine,
      });
      continue;
    }
    if (cols.length < EXPECTED_COLS - 5) {
      // Some rows may be short by a few empty trailing columns — allow small
      // slack, but reject rows that are missing whole subject blocks.
      errors.push({
        rowNumber: i + 1,
        reason: `Kutilgandan kam ustun (${cols.length} / ${EXPECTED_COLS})`,
        raw: rawLine,
      });
      continue;
    }

    const answers: Record<SubjectKey, number[]> = {
      MATH: parseAnswers(cols, 7, MATH_QUESTIONS),
      CRITICAL_THINKING: parseAnswers(cols, 7 + MATH_QUESTIONS + 1, CT_QUESTIONS),
      ENGLISH: parseAnswers(
        cols,
        7 + MATH_QUESTIONS + 1 + CT_QUESTIONS + 1,
        ENG_QUESTIONS,
      ),
    };
    const isAllZero =
      answers.MATH.every((a) => a === 0) &&
      answers.CRITICAL_THINKING.every((a) => a === 0) &&
      answers.ENGLISH.every((a) => a === 0);

    // Student didn't show up — all answers zero. Skip entirely: no student
    // record, no result, no impact on statistics.
    if (isAllZero) continue;

    rows.push({
      rowNumber: i + 1,
      tr,
      uid,
      firstName,
      lastName,
      sex,
      grade,
      examLanguage,
      answers,
      isAllZero: false,
    });
  }

  return { rows, errors };
}

export interface ExpectedCounts {
  MATH: number;
  CRITICAL_THINKING: number;
  ENGLISH: number;
}

/**
 * Parse a JSON import payload into the same `CsvParsedRow` shape the CSV
 * pipeline uses. Callers can hand either CSV text or JSON to the import
 * endpoint — both flow through the same materialisation step.
 *
 * Per-row validation errors are collected in `errors` rather than throwing so
 * a single bad row doesn't abort the batch.
 *
 * `expectedCounts` — when provided, each subject's answer array MUST be that
 * exact length. This is how we enforce "matched to the exam's TestTemplate":
 * a row whose math has 26 answers when the template has 25 is rejected. If
 * omitted, falls back to the legacy fixed 25/10/50 shape of the school's CSV.
 */
export function parseJsonRows(payload: unknown, expectedCounts?: ExpectedCounts): CsvParseResult {
  const rows: CsvParsedRow[] = [];
  const errors: CsvParseResult["errors"] = [];
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { students?: unknown }).students)
  ) {
    return { rows, errors: [{ rowNumber: 0, reason: "JSON `students` array not found", raw: "" }] };
  }
  const arr = (payload as { students: unknown[] }).students;
  arr.forEach((raw, i) => {
    const rowNumber = i + 1;
    if (!raw || typeof raw !== "object") {
      errors.push({ rowNumber, reason: "Object emas", raw: JSON.stringify(raw).slice(0, 200) });
      return;
    }
    const r = raw as Record<string, unknown>;
    const uid = String(r.uid ?? "").trim();
    const firstName = fixEncoding(String(r.firstName ?? "").trim());
    const lastName = fixEncoding(String(r.lastName ?? "").trim());
    if (!uid || !firstName || !lastName) {
      errors.push({ rowNumber, reason: "uid / firstName / lastName bo'sh", raw: JSON.stringify(raw).slice(0, 200) });
      return;
    }
    const gradeRaw = typeof r.grade === "number" ? r.grade : parseGrade(String(r.grade ?? ""));
    if (gradeRaw == null || gradeRaw < 5 || gradeRaw > 11) {
      errors.push({ rowNumber, reason: `grade noto'g'ri: ${String(r.grade)}`, raw: JSON.stringify(raw).slice(0, 200) });
      return;
    }
    const sex = parseSex(String(r.sex ?? "")) ?? null;
    const examLanguage = parseLanguage(String(r.examLanguage ?? ""));
    const readAnswers = (v: unknown, count: number, label: string): number[] | null => {
      if (!Array.isArray(v)) {
        errors.push({ rowNumber, reason: `${label} array kutildi`, raw: JSON.stringify(raw).slice(0, 200) });
        return null;
      }
      if (v.length !== count) {
        // Strict: reject the row so admin can fix the JSON before proceeding.
        // Was: tolerate/pad — that hid mismatches with the exam's TestTemplate.
        errors.push({
          rowNumber,
          reason: `${label} uzunligi ${v.length} — ${count} ta savol kutilgan (imtihon test shabloniga qarang)`,
          raw: JSON.stringify(raw).slice(0, 200),
        });
        return null;
      }
      const out: number[] = [];
      for (let j = 0; j < count; j++) {
        const av = v[j];
        out.push(av === 1 || av === "1" || av === true ? 1 : 0);
      }
      return out;
    };
    const counts = expectedCounts ?? { MATH: MATH_QUESTIONS, CRITICAL_THINKING: CT_QUESTIONS, ENGLISH: ENG_QUESTIONS };
    const math = readAnswers(r.math, counts.MATH, "math");
    const ct = readAnswers(r.ct, counts.CRITICAL_THINKING, "ct");
    const eng = readAnswers(r.eng, counts.ENGLISH, "eng");
    if (!math || !ct || !eng) return;
    const isAllZero =
      math.every((a) => a === 0) && ct.every((a) => a === 0) && eng.every((a) => a === 0);

    // Student didn't show up — skip entirely.
    if (isAllZero) return;

    rows.push({
      rowNumber,
      tr: typeof r.tr === "number" ? r.tr : rowNumber,
      uid,
      firstName,
      lastName,
      sex,
      grade: gradeRaw,
      examLanguage,
      answers: { MATH: math, CRITICAL_THINKING: ct, ENGLISH: eng },
      isAllZero: false,
    });
  });
  return { rows, errors };
}

/**
 * Build the parent-facing login code from a row. Format:
 *   Familya[0].upper + Ism[0].upper + UID
 * Example: "Rustamjonzoda Abdulloh 2605086" → "RA2605086".
 *
 * Falls back to a plain UID when either name is empty (shouldn't happen —
 * parseCsv rejects those rows — but this keeps the helper total).
 */
export function buildLoginCode(row: { firstName: string; lastName: string; uid: string }): string {
  const l = row.lastName.trim()[0]?.toUpperCase() ?? "";
  const f = row.firstName.trim()[0]?.toUpperCase() ?? "";
  return `${l}${f}${row.uid.trim()}`;
}
