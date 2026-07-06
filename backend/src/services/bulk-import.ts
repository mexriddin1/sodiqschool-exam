// Bulk import driver: takes parsed CSV rows and materialises them as
// Student + Result + SubjectResult in the database.
//
// Design choices:
//   - Students are matched by `uid`. Existing row is reused (never mutated
//     on import), which lets an admin re-run an import safely.
//   - For each (exam, grade, subject) we look up a TestTemplate. If none
//     exists we auto-generate a bare-bones template ("Savol 1..N", medium
//     difficulty, no topic/skill/bloom) so import always succeeds — admin
//     can enrich the template later and re-import to get better diagnostics.
//   - Result publicCode uses the school-required format
//     `<LastInit><FirstInit><UID>` (see buildLoginCode).
//   - Password is auto-generated per row (~10 char random). Plain value is
//     returned to the caller so the admin can hand it to the parent.
//   - All-zero rows still create a full DRAFT Result with every question set
//     to "Noto'g'ri" — the parent can log in and see zeros, and the admin
//     can revise later once the student actually shows up.
//   - Snapshot + cohort ranks are recomputed once at the end, not per row.

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Question, SubjectKey } from "@sodiq/compute";

import { prisma } from "../db.js";
import { computeSnapshot, recomputeCohortRanks } from "./snapshot.js";
import { generateUniquePublicCode } from "./code.js";
import { CsvParsedRow } from "./csv-import.js";
import { readDefaultUnlockedSections } from "../routes/admin.settings.js";
import { ensureStudentCredentials } from "./student-credentials.js";

// Result.publicCode / accessPasswordHash columns are legacy (2026-07-03):
// parents log in with Student.loginCode + Student.accessPasswordHash instead.
// We still fill them because the schema requires it, but skip bcrypt to avoid
// a 300× ~250ms bcrypt hit that pushed bulk imports past nginx's 60s timeout.
// A raw 64-hex string cannot match any bcrypt.compare, so legacy login can't
// be used against these rows — which is the intended behaviour.
function unusablePasswordHash(): string {
  return "csv-import:" + randomBytes(32).toString("hex");
}

const QUESTION_COUNTS: Record<SubjectKey, number> = {
  MATH: 25,
  CRITICAL_THINKING: 10,
  ENGLISH: 50,
};

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  MATH: "Matematika",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
  ENGLISH: "Ingliz tili",
};

const SUBJECT_ID_PREFIX: Record<SubjectKey, string> = {
  MATH: "M",
  CRITICAL_THINKING: "T",
  ENGLISH: "E",
};

// Auto-template question strand distribution — coarse defaults so the
// diagnostic engine has something to work with when no admin-authored
// template exists. Rough halves: first half easier / mixed topics, harder
// tail. Admin can override per exam by creating a proper TestTemplate.
function autoQuestion(subject: SubjectKey, i: number, total: number): Question {
  const idx = i + 1;
  const easyCut = Math.floor(total * 0.4);
  const hardCut = Math.floor(total * 0.8);
  const difficulty: Question["difficulty"] =
    idx <= easyCut ? "Oson" : idx <= hardCut ? "O'rta" : "Qiyin";
  const marks = idx <= easyCut ? 3 : idx <= hardCut ? 4 : 6;
  return {
    id: `${SUBJECT_ID_PREFIX[subject]}${idx}`,
    marks,
    difficulty,
    strand: SUBJECT_LABELS[subject],
    topic: "Umumiy",
    subTopic: `Savol ${idx}`,
    skill: SUBJECT_LABELS[subject],
    bloom: "Qo'llash",
    reasoning: null,
    gradeLevel: `${5}-sinf`, // Will be overridden per row (grade) at overlay time when needed.
    framework: "auto-generated",
    // Placeholder outcome — will be overlaid per row.
    result: "Noto'g'ri",
    earned: 0,
    errorType: null,
    evidence: "",
  };
}

async function ensureTemplate(
  examId: string,
  subject: SubjectKey,
  grade: number,
): Promise<Question[]> {
  // Strict lookup: template must belong to this exam (2026-07-03). The
  // legacy library fallback (examId=null) was removed. If a grade-specific
  // template is missing, fall back to ANY exam-scoped template for that
  // subject before giving up.
  let tpl = await prisma.testTemplate.findFirst({
    where: { examId, subject, grade },
    select: { questions: true },
  });
  if (!tpl) {
    tpl = await prisma.testTemplate.findFirst({
      where: { examId, subject },
      select: { questions: true },
    });
  }
  if (tpl) {
    const arr = tpl.questions as unknown as Question[];
    if (Array.isArray(arr) && arr.length > 0) return arr;
  }
  // Nothing found for this exam. Auto-generate a stub so import still works,
  // but persist it with the correct examId (never null) — admin can enrich
  // it later from Test shablonlari.
  const count = QUESTION_COUNTS[subject];
  const auto: Question[] = [];
  for (let i = 0; i < count; i++) auto.push(autoQuestion(subject, i, count));
  await prisma.testTemplate.create({
    data: {
      subject,
      grade,
      name: `Auto ${SUBJECT_LABELS[subject]} (${grade}-sinf) — CSV import`,
      questions: auto as unknown as Prisma.InputJsonValue,
      examId,
    },
  });
  return auto;
}

/** Overlay row answers on top of a question template. Length is snapped to
 *  the shorter of the two so mismatches don't crash the whole import. */
function overlayAnswers(template: Question[], answers: number[]): Question[] {
  const n = Math.min(template.length, answers.length);
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const t = template[i]!;
    const a = answers[i] ?? 0;
    const correct = a === 1;
    out.push({
      ...t,
      result: correct ? "To'g'ri" : "Noto'g'ri",
      earned: correct ? t.marks : 0,
      errorType: correct ? null : "Bilim bo'shlig'i",
      evidence: correct ? "" : "",
    });
  }
  // If template is longer than answers, mark the remainder as unanswered
  // (Noto'g'ri, 0 marks). Prevents "partial" totals from confusing computeReport.
  for (let i = n; i < template.length; i++) {
    const t = template[i]!;
    out.push({
      ...t,
      result: "Noto'g'ri",
      earned: 0,
      errorType: "Bilim bo'shlig'i",
      evidence: "",
    });
  }
  return out;
}

export interface BulkImportRowReport {
  rowNumber: number;
  tr: number;
  fullName: string;
  publicCode: string;            // studentga tegishli loginCode
  password: string | null;       // faqat yangi yaratilgan hollarda
  credentialsGenerated: boolean; // shu importda ilk marta yaratilganmi
  studentId: string;
  resultId: string;
  studentCreated: boolean;
  isAllZero: boolean;
}

export interface BulkImportReport {
  examId: string;
  created: BulkImportRowReport[];
  skipped: { rowNumber: number; tr: number; reason: string }[];
}

/**
 * Discover how many questions the exam's TestTemplate holds for each subject.
 * If a grade is given we look for that grade's template; otherwise we take
 * the first template we can find per subject. Returns null-per-subject when
 * no template exists so callers can decide whether to fall back to hardcoded
 * defaults (25/10/50) or reject the import.
 */
export async function resolveExamTemplateCounts(
  examId: string,
  grade?: number,
): Promise<Record<SubjectKey, number | null>> {
  const subjectKeys: SubjectKey[] = ["MATH", "CRITICAL_THINKING", "ENGLISH"];
  const out: Record<SubjectKey, number | null> = { MATH: null, CRITICAL_THINKING: null, ENGLISH: null };
  for (const sk of subjectKeys) {
    // Strict exam-scoped lookup only (2026-07-03). If a template for the
    // student's grade exists we use it; otherwise fall back to any grade
    // within this exam. The old legacy-library (examId=null) fallback is
    // gone — every template must live under its exam.
    const where = grade != null
      ? [{ examId, subject: sk, grade }, { examId, subject: sk }]
      : [{ examId, subject: sk }];
    for (const w of where) {
      const tpl = await prisma.testTemplate.findFirst({ where: w, select: { questions: true } });
      if (tpl && Array.isArray(tpl.questions)) {
        const arr = tpl.questions as unknown as Question[];
        if (arr.length > 0) {
          out[sk] = arr.length;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Materialise a parsed batch into the DB. Runs one row at a time so a bad
 * row (duplicate publicCode, missing template etc.) doesn't abort the rest.
 * Batch-level side-effects (snapshot recompute, cohort ranks) run once at
 * the end.
 */
export async function bulkImportResults(params: {
  examId: string;
  rows: CsvParsedRow[];
  adminId: string;
}): Promise<BulkImportReport> {
  const { examId, rows } = params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new Error(`Exam not found: ${examId}`);

  // Which report sections should be unlocked by default on newly-created
  // results. Admin manages this from /settings; empty array = all closed.
  const defaultUnlocked = await readDefaultUnlockedSections();

  const created: BulkImportRowReport[] = [];
  const skipped: BulkImportReport["skipped"] = [];

  // Cache templates so we don't hit the DB per row for the same (grade,subj).
  const templateCache = new Map<string, Question[]>();

  for (const row of rows) {
    try {
      // 1. Student — match by uid, create if new.
      let student = await prisma.student.findUnique({ where: { uid: row.uid } });
      let studentCreated = false;
      if (!student) {
        const fullName = `${row.firstName} ${row.lastName}`.trim();
        student = await prisma.student.create({
          data: {
            fullName,
            firstName: row.firstName,
            lastName: row.lastName,
            uid: row.uid,
            sex: row.sex ?? null,
            grade: row.grade,
            examLanguage: row.examLanguage ?? null,
          },
        });
        studentCreated = true;
      }
      // Note: we intentionally do NOT skip when a Result already exists for
      // this (student, exam). Re-importing the same CSV creates a fresh
      // Result with a new random publicCode/password so the older run's
      // credentials keep working — parents don't get logged out of an older
      // report card by a re-import.

      // 2. Templates for the three subjects.
      const subjectKeys: SubjectKey[] = ["MATH", "CRITICAL_THINKING", "ENGLISH"];
      const subjectQuestions: Record<SubjectKey, Question[]> = {} as Record<SubjectKey, Question[]>;
      for (const sk of subjectKeys) {
        const key = `${sk}:${row.grade}`;
        let tpl = templateCache.get(key);
        if (!tpl) {
          tpl = await ensureTemplate(examId, sk, row.grade);
          templateCache.set(key, tpl);
        }
        subjectQuestions[sk] = overlayAnswers(tpl, row.answers[sk]);
      }

      // 3. Ensure the student has login credentials (2026-07-03). One
      //    account per student — re-imports of the same UID reuse the same
      //    loginCode/password. Result.publicCode/accessPassword rows are
      //    still filled (schema NOT NULL) but never surfaced to the parent.
      // Lower bcrypt cost for bulk-imported students (cost 10 ≈ 65ms vs
      // default 12 ≈ 250ms) so a 300-row import stays under nginx's 60s
      // proxy_read_timeout. Existing students bypass hashing entirely
      // (early return in ensureStudentCredentials).
      const studentCreds = await ensureStudentCredentials(student.id, { bcryptCost: 10 });
      const publicCode = await generateUniquePublicCode();

      // 4. Create the result + three SubjectResult rows in one transaction.
      // Auto-publish so parents can log in with the code/password we hand
      // back immediately. Admin can unpublish per-row from the results list.
      const result = await prisma.result.create({
        data: {
          studentId: student.id,
          examId,
          publicCode,
          accessPassword: "",
          accessPasswordHash: unusablePasswordHash(),
          status: "PUBLISHED",
          publishedAt: new Date(),
          manualContent: {},
          unlockedSections: defaultUnlocked,
          subjects: {
            create: subjectKeys.map((sk) => {
              const qs = subjectQuestions[sk];
              const totalMarks = qs.reduce((s, q) => s + q.marks, 0);
              return {
                subject: sk,
                totalQuestions: qs.length,
                totalMarks,
                questions: qs as unknown as Prisma.InputJsonValue,
              };
            }),
          },
        },
        include: { subjects: true, student: true, exam: true },
      });

      // Freeze the snapshot so admin sees the numbers immediately.
      try {
        const snapshot = computeSnapshot(result);
        await prisma.result.update({
          where: { id: result.id },
          data: { calculatedSnapshot: snapshot as unknown as Prisma.InputJsonValue },
        });
      } catch (e) {
        // Non-fatal — snapshot can be recomputed on demand later.
        console.error("[csv-import] snapshot failed", result.id, e);
      }

      // Report row: STUDENT credentials (login + parol). Parol qiymati
      // faqat shu importda studentga birinchi marta yaratilganida qaytadi;
      // avvaldan kredensial bo'lgan holatda password: null bo'ladi.
      created.push({
        rowNumber: row.rowNumber,
        tr: row.tr,
        fullName: `${row.firstName} ${row.lastName}`.trim(),
        publicCode: studentCreds.loginCode,
        password: studentCreds.plainPassword,
        credentialsGenerated: studentCreds.generated,
        studentId: student.id,
        resultId: result.id,
        studentCreated,
        isAllZero: row.isAllZero,
      });
    } catch (e) {
      skipped.push({
        rowNumber: row.rowNumber,
        tr: row.tr,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Cohort ranks only make sense for published results, but recomputing here
  // is cheap and keeps DRAFT snapshots ready for the moment they publish.
  try {
    await recomputeCohortRanks(examId);
  } catch (e) {
    console.error("[csv-import] cohort recompute failed", e);
  }

  return { examId, created, skipped };
}
