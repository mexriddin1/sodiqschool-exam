// Imports every question file under /resource into TestTemplate.
//
// Math (.xlsx) — the "Savollar" sheet already has every label our schema needs.
// English (.docx) — sections (A–F) + numbered questions; section name → strand.
// Critical Thinking (.docx) — sections by topic name; question text per block.
//
// English & CT lack pedagogical labels (difficulty/bloom/reasoning/framework)
// in the docx — admin can refine after import; we ship sensible defaults.

import "dotenv/config";
import XLSX from "xlsx";
import mammoth from "mammoth";
import { readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCE = resolve(__dirname, "../../resource");
const prisma = new PrismaClient();

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
type Difficulty = "Oson" | "O'rta" | "Qiyin";
type QResult = "To'g'ri" | "Noto'g'ri" | "Qisman";
type Bloom = "Eslab qolish" | "Tushunish" | "Qo'llash" | "Tahlil" | "Baholash" | "Yaratish";
type Reasoning = "Deduktiv" | "Induktiv" | "Analitik" | "Fazoviy" | null;

interface Question {
  id: string;
  marks: number;
  difficulty: Difficulty;
  strand: string;
  topic: string;
  subTopic: string;
  skill: string;
  bloom: Bloom;
  reasoning: Reasoning;
  gradeLevel: string;
  framework: string;
  result: QResult;
  earned: number;
  errorType: null;
  evidence: string;
}

const ALLOWED_DIFF: Difficulty[] = ["Oson", "O'rta", "Qiyin"];
const ALLOWED_BLOOM: Bloom[] = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];
const ALLOWED_REASON: Exclude<Reasoning, null>[] = ["Deduktiv", "Induktiv", "Analitik", "Fazoviy"];

function normalizeDiff(s: string): Difficulty {
  const v = s.trim();
  if (v === "Oson" || v === "O'rta" || v === "Qiyin") return v;
  return "O'rta";
}
function normalizeBloom(s: string): Bloom {
  const v = s.trim();
  if ((ALLOWED_BLOOM as readonly string[]).includes(v)) return v as Bloom;
  return "Tushunish";
}
function normalizeReason(s: string): Reasoning {
  const v = s.trim();
  if (!v || v === "Yo'q") return null;
  if ((ALLOWED_REASON as readonly string[]).includes(v)) return v as Exclude<Reasoning, null>;
  return null;
}

// ---------------- Math: parse Savollar sheet ----------------
function parseMathXlsx(filePath: string, grade: number): Question[] {
  const wb = XLSX.readFile(filePath);
  if (!wb.SheetNames.includes("Savollar")) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Savollar"]!, { defval: "" });
  const out: Question[] = [];
  for (const r of rows) {
    const id = String(r["Savol"] ?? "").trim();
    if (!/^Q\d+$/i.test(id)) continue;
    out.push({
      id,
      marks: Number(r["Ball"]) || 0,
      difficulty: normalizeDiff(String(r["Qiyinchilik"] ?? "")),
      strand: String(r["Strand (katta blok)"] ?? "").trim(),
      topic: String(r["Mavzu"] ?? "").trim(),
      subTopic: String(r["Quyi mavzu (izoh)"] ?? "").trim(),
      skill: String(r["Asosiy ko'nikma"] ?? "").trim(),
      bloom: normalizeBloom(String(r["Bloom darajasi"] ?? "")),
      reasoning: normalizeReason(String(r["Fikrlash turi"] ?? "")),
      gradeLevel: String(r["Sinf darajasi"] ?? `${grade}-sinf`).trim(),
      framework: String(r["Xalqaro framework"] ?? "").trim(),
      result: "To'g'ri",
      earned: Number(r["Ball"]) || 0,
      errorType: null,
      evidence: String(r["Dalil / nimani ko'rsatdi"] ?? "").trim(),
    });
  }
  return out;
}

// ---------------- English: section + numbered questions ----------------
async function parseEnglishDocx(filePath: string, grade: number): Promise<Question[]> {
  const res = await mammoth.extractRawText({ path: filePath });
  // Strip the TOC (lines with tabs + page numbers) and the answer-key section.
  // The TOC uses "JAVOBLAR KALITI\t10" while the actual section header is
  // just "JAVOBLAR KALITI VA SAVOL TAHLILI" with no tab.
  let body = res.value;
  // Find the second occurrence of "JAVOBLAR KALITI" (the actual section, not
  // the TOC entry) and cut there.
  const first = body.indexOf("JAVOBLAR KALITI");
  if (first !== -1) {
    const second = body.indexOf("JAVOBLAR KALITI", first + 1);
    if (second !== -1) body = body.slice(0, second);
  }

  // Drop the TOC: any line containing a tab + trailing number on its own line.
  // Drop "Exam instructions" (the numbered list of rules before SECTION A).
  // Easiest: start collecting only after the first "SECTION A" header.
  const sectionAIdx = body.search(/SECTION\s+A\s*[—\-]/i);
  if (sectionAIdx !== -1) body = body.slice(sectionAIdx);

  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const out: Question[] = [];
  let currentSectionName = "Grammar";
  let counter = 0;             // sequential id (renumber across doc — source
                               //   numbers restart per section, causing dupes)
  let inQuestion = false;
  let curBuf: string[] = [];

  function flush() {
    if (!inQuestion) return;
    const text = curBuf.join(" ").replace(/\s+/g, " ").trim();
    inQuestion = false;
    curBuf = [];
    // Filter out trivial matching sub-items ("teacher", "apple", …). Real
    // questions almost always contain more than one short word plus context.
    if (text.length < 12) return;
    counter += 1;
    out.push({
      id: `Q${counter}`,
      marks: 1,
      difficulty: "O'rta",
      strand: currentSectionName,
      topic: currentSectionName,
      subTopic: text.length > 120 ? text.slice(0, 117) + "…" : text,
      skill: currentSectionName,
      bloom: "Tushunish",
      reasoning: null,
      gradeLevel: `${grade}-sinf`,
      framework: "Sodiq School · English",
      result: "To'g'ri",
      earned: 1,
      errorType: null,
      evidence: text,
    });
  }

  for (const ln of lines) {
    if (!ln) continue;
    const sec = ln.match(/^SECTION\s+([A-F])\s*[—\-]\s*(.+)$/i);
    if (sec) {
      flush();
      currentSectionName = sec[2]!.trim();
      continue;
    }
    const qm = ln.match(/^(\d{1,3})\.\s+(.*)$/);
    if (qm) {
      flush();
      inQuestion = true;
      curBuf = [qm[2]!];
      continue;
    }
    if (inQuestion) curBuf.push(ln);
  }
  flush();
  return out;
}

// ---------------- Critical Thinking: section headings + question text ----------------
async function parseCtDocx(filePath: string, grade: number): Promise<Question[]> {
  const res = await mammoth.extractRawText({ path: filePath });
  const body = res.value;
  const lines = body.split(/\r?\n/).map((l) => l.trim());

  // CT structure: section headings appear as "Topic name · Тема" (Uz · Ru) on a
  // single line, followed by "UZ ... Variantlar · Варианты:" question block.
  // We treat each "UZ ... " block (between "UZ" markers) as a question.

  const out: Question[] = [];
  let currentSection = "Umumiy";
  let counter = 0;
  let inQuestion = false;
  let curBuf: string[] = [];

  function flush() {
    if (!inQuestion) return;
    const text = curBuf.join(" ").replace(/\s+/g, " ").trim();
    if (text.length < 4) {
      inQuestion = false;
      curBuf = [];
      return;
    }
    counter += 1;
    out.push({
      id: `Q${counter}`,
      marks: 1,
      difficulty: "O'rta",
      strand: currentSection,
      topic: currentSection,
      subTopic: text.length > 120 ? text.slice(0, 117) + "…" : text,
      skill: currentSection,
      bloom: "Tahlil",
      reasoning: null,
      gradeLevel: `${grade}-sinf`,
      framework: "Sodiq School · Critical Thinking",
      result: "To'g'ri",
      earned: 1,
      errorType: null,
      evidence: text,
    });
    inQuestion = false;
    curBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    if (!ln) continue;
    // Section heading: "Word · WordRu" on a single line, NOT containing
    // "UZ"/"RU" markers (those are inside questions).
    if (/^[A-Za-zА-Яа-яʼ'-\s]+·[А-Яа-я\s]+$/.test(ln) && !ln.includes("UZ ") && !ln.includes("Variantlar")) {
      flush();
      // take the Uzbek (first) side
      currentSection = ln.split("·")[0]!.trim();
      continue;
    }
    // Start-of-question marker.
    if (/^UZ\b/.test(ln)) {
      flush();
      inQuestion = true;
      curBuf = [ln.replace(/^UZ\s*/, "")];
      continue;
    }
    // End-of-question marker — variantlar paragraph ends the question block.
    if (inQuestion && /^RU\b/.test(ln)) {
      // RU translation begins; keep collecting then flush at section change or next UZ.
      continue;
    }
    if (inQuestion) curBuf.push(ln);
  }
  flush();
  return out;
}

// ---------------- File walkers ----------------
function gradeFromFilename(name: string): number | null {
  const m = name.match(/(\d+)-sinf|Grade\s*(\d+)/i);
  if (!m) return null;
  return Number(m[1] ?? m[2]);
}

async function importAll() {
  let total = 0;

  // Math
  const mathFiles = readdirSync(resolve(RESOURCE, "Math")).filter((f) => f.endsWith(".xlsx"));
  for (const f of mathFiles) {
    const grade = gradeFromFilename(f);
    if (!grade) continue;
    const qs = parseMathXlsx(resolve(RESOURCE, "Math", f), grade);
    if (qs.length === 0) {
      console.log(`SKIP Math/${f}: no questions parsed`);
      continue;
    }
    await upsertTemplate("MATH", grade, `${grade}-sinf Matematika kirish imtihoni`, qs);
    console.log(`✔ MATH grade ${grade}: ${qs.length} savol (${f})`);
    total += qs.length;
  }

  // English
  const enFiles = readdirSync(resolve(RESOURCE, "English")).filter((f) => f.endsWith(".docx"));
  for (const f of enFiles) {
    const grade = gradeFromFilename(f);
    if (!grade) continue;
    const qs = await parseEnglishDocx(resolve(RESOURCE, "English", f), grade);
    if (qs.length === 0) {
      console.log(`SKIP English/${f}: no questions parsed`);
      continue;
    }
    await upsertTemplate("ENGLISH", grade, `${grade}-sinf Ingliz tili kirish imtihoni`, qs);
    console.log(`✔ ENGLISH grade ${grade}: ${qs.length} savol (${f})`);
    total += qs.length;
  }

  // Critical Thinking — only the O'quvchi file, skip teacher guides.
  const ctFiles = readdirSync(resolve(RESOURCE, "Thinking")).filter((f) =>
    f.endsWith(".docx") && f.includes("Oquvchi"),
  );
  for (const f of ctFiles) {
    const grade = gradeFromFilename(f);
    if (!grade) continue;
    const qs = await parseCtDocx(resolve(RESOURCE, "Thinking", f), grade);
    if (qs.length === 0) {
      console.log(`SKIP Thinking/${f}: no questions parsed`);
      continue;
    }
    await upsertTemplate("CRITICAL_THINKING", grade, `${grade}-sinf Tanqidiy fikrlash kirish imtihoni`, qs);
    console.log(`✔ CT grade ${grade}: ${qs.length} savol (${f})`);
    total += qs.length;
  }

  console.log(`\nJami: ${total} savol importt qilindi.`);
}

async function upsertTemplate(subject: SubjectKey, grade: number, name: string, questions: Question[]) {
  await prisma.testTemplate.upsert({
    where: { subject_grade: { subject, grade } },
    update: { name, questions: questions as unknown as Prisma.InputJsonValue },
    create: { subject, grade, name, questions: questions as unknown as Prisma.InputJsonValue },
  });
}

importAll()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
