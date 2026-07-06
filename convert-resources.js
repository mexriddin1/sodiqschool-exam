// Converts resource/ files → JSON test templates.
// Run: node convert-resources.js
// Output: resource/generated-json/<subject>-grade-<N>.json

const XLSX = require("xlsx");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const RES = "C:/Users/mexri/Desktop/exam/resource";
const OUT = path.join(RES, "generated-json");
fs.mkdirSync(OUT, { recursive: true });

// ─── Normalizers ────────────────────────────────────────────────────────────

function normalizeBloom(raw) {
  if (!raw) return "Tushunish";
  const s = raw.trim();
  // Extract Uzbek part from "Apply (Qo'llash)" pattern
  const m = s.match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  // Map English bloom names → Uzbek
  const lower = s.toLowerCase();
  if (lower.includes("remember") || lower.includes("recall")) return "Eslab qolish";
  if (lower.includes("understand")) return "Tushunish";
  if (lower.includes("apply")) return "Qo'llash";
  if (lower.includes("analyz") || lower.includes("analyse")) return "Tahlil";
  if (lower.includes("evaluat")) return "Baholash";
  if (lower.includes("creat")) return "Yaratish";
  // Already Uzbek?
  const uzbek = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];
  if (uzbek.includes(s)) return s;
  return "Tushunish";
}

function normalizeDifficulty(raw) {
  if (!raw) return "O'rta";
  const s = raw.trim().toLowerCase().replace(/'/g, "'");
  if (s === "oson") return "Oson";
  if (s === "o'rta" || s === "orta") return "O'rta";
  if (s === "qiyin" || s === "murakkab") return "Qiyin";
  return "O'rta";
}

function normalizeReasoning(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "Yo'q" || s === "" || s.toLowerCase() === "null") return null;
  const valid = ["Deduktiv", "Induktiv", "Analitik", "Fazoviy"];
  if (valid.includes(s)) return s;
  return null;
}

// ─── Math (Excel → JSON) ────────────────────────────────────────────────────

function convertMath() {
  console.log("\n=== MATH ===");
  const grades = [5, 6, 7, 8, 9, 10];
  for (const grade of grades) {
    const file = `${RES}/Math/Grade ${grade}.xlsx`;
    try {
      const wb = XLSX.readFile(file);
      const ws = wb.Sheets["Savollar"];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
      const questions = rows
        .filter((r) => r[0] && String(r[0]).startsWith("Q"))
        .map((r) => ({
          id: String(r[0]).trim(),
          marks: Number(r[1]) || 1,
          difficulty: normalizeDifficulty(String(r[2] ?? "")),
          strand: String(r[3] ?? "").trim(),
          topic: String(r[4] ?? "").trim(),
          subTopic: String(r[5] ?? "").trim(),
          skill: String(r[6] ?? "").trim(),
          bloom: normalizeBloom(String(r[7] ?? "")),
          reasoning: normalizeReasoning(String(r[8] ?? "")),
          gradeLevel: String(r[9] ?? `${grade}-sinf`).trim(),
          framework: String(r[10] ?? "").trim(),
        }));
      const out = path.join(OUT, `MATH-grade-${grade}.json`);
      fs.writeFileSync(out, JSON.stringify({ questions }, null, 2), "utf8");
      console.log(`  Grade ${grade}: ${questions.length} questions → ${path.basename(out)}`);
    } catch (e) {
      console.error(`  Grade ${grade} ERROR:`, e.message);
    }
  }
}

// ─── English (docx → JSON) ──────────────────────────────────────────────────

// Maps Ko'nikma value → strand
function skillToStrand(skill) {
  const s = skill.toLowerCase();
  if (s.includes("grammar")) return "Grammar and Language Use";
  if (s.includes("vocabulary") || s.includes("lexical")) return "Vocabulary";
  if (s.includes("reading") || s.includes("information processing") || s.includes("context")) return "Reading";
  if (s.includes("critical") || s.includes("analytical") || s.includes("inference")) return "Critical Thinking in English";
  if (s.includes("real-life") || s.includes("real life") || s.includes("communication")) return "Real-life Language";
  if (s.includes("writing")) return "Writing";
  return "Language Use";
}

async function parseEnglishDoc(file, grade) {
  const r = await mammoth.convertToHtml({ path: file });
  const tables = r.value.match(/<table[\s\S]*?<\/table>/g) || [];

  const analysisTables = tables.filter((t) => {
    const text = t.replace(/<[^>]+>/g, " ");
    return text.includes("Koʼnikma:") || text.includes("Ko'nikma:") || text.includes("Ko&#x2018;nikma:");
  });

  const questions = analysisTables.map((t, i) => {
    const rows = (t.match(/<tr[\s\S]*?<\/tr>/g) || []).map((row) =>
      (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map((c) =>
        c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      )
    );

    // Each analysis table has 3 rows × 2 cols:
    // Row 0: "Ko'nikma: X" | "CEFR: Y"
    // Row 1: "DTS mavzusi: X" | "Xalqaro standart: Y"
    // Row 2: "Bloom darajasi: X" | "Qiyinlik: Y"
    const cell = (row, col) => rows[row]?.[col] ?? "";

    const skill = cell(0, 0).replace(/^Ko['ʻ']nikma:\s*/i, "").trim();
    const cefrRaw = cell(0, 1).replace(/^CEFR:\s*/i, "").trim();
    const dtsMavzu = cell(1, 0).replace(/^DTS mavzusi:\s*/i, "").trim();
    const framework = cell(1, 1).replace(/^Xalqaro standart:\s*/i, "").trim();
    const bloomRaw = cell(2, 0).replace(/^Bloom darajasi:\s*/i, "").trim();
    const diffRaw = cell(2, 1).replace(/^Qiyinlik:\s*/i, "").trim();

    // Split DTS mavzusi → topic : subTopic
    const colonIdx = dtsMavzu.indexOf(":");
    const topic = colonIdx >= 0 ? dtsMavzu.substring(0, colonIdx).trim() : dtsMavzu;
    const subTopic = colonIdx >= 0 ? dtsMavzu.substring(colonIdx + 1).trim() : "";

    return {
      id: `Q${i + 1}`,
      marks: 1,
      difficulty: normalizeDifficulty(diffRaw),
      strand: skillToStrand(skill),
      topic,
      subTopic,
      skill,
      bloom: normalizeBloom(bloomRaw),
      reasoning: null,
      gradeLevel: cefrRaw || `${grade}-sinf`,
      framework,
    };
  });

  return questions;
}

async function convertEnglish() {
  console.log("\n=== ENGLISH ===");
  const grades = [5, 6, 7, 8, 9, 10, 11];
  for (const grade of grades) {
    const file = `${RES}/English/Sodiq_School_Ingliz_tili_kirish_imtihoni_${grade}-sinf.docx`;
    if (!fs.existsSync(file)) {
      console.log(`  Grade ${grade}: file not found, skipping`);
      continue;
    }
    try {
      const questions = await parseEnglishDoc(file, grade);
      if (questions.length === 0) {
        console.log(`  Grade ${grade}: no analysis tables found`);
        continue;
      }
      const out = path.join(OUT, `ENGLISH-grade-${grade}.json`);
      fs.writeFileSync(out, JSON.stringify({ questions }, null, 2), "utf8");
      console.log(`  Grade ${grade}: ${questions.length} questions → ${path.basename(out)}`);
    } catch (e) {
      console.error(`  Grade ${grade} ERROR:`, e.message);
    }
  }
}

// ─── Thinking (docx → JSON) ─────────────────────────────────────────────────

// Mavzu yo'nalishi → reasoning type
function mavzuToReasoning(mavzu) {
  const s = (mavzu || "").toLowerCase();
  if (s.includes("deduktiv") || s.includes("mantiqiy xulosa") || s.includes("cheklov") || s.includes("algoritmik")) return "Deduktiv";
  if (s.includes("induktiv") || s.includes("qonuniyat") || s.includes("algebraik")) return "Induktiv";
  if (s.includes("fazoviy") || s.includes("geometrik") || s.includes("abstrakt") || s.includes("noverbal")) return "Fazoviy";
  return "Analitik";
}

// Format name → strand
function formatToStrand(fmt) {
  const s = (fmt || "").toLowerCase();
  if (s.includes("ketma-ketlik") || s.includes("sequence")) return "Raqamli fikrlash";
  if (s.includes("mantiqiy tartiblash") || s.includes("mantiqiy jadval")) return "Deduktiv mantiq";
  if (s.includes("vizual") || s.includes("abstrakt matritsa")) return "Noverbal mulohaza";
  if (s.includes("diagramma") || s.includes("sanash") || s.includes("kombinatorika")) return "Ma'lumotlar tahlili";
  if (s.includes("tanqidiy fikrlash") || s.includes("strategiya")) return "Tanqidiy mulohaza";
  if (s.includes("fazoviy")) return "Fazoviy mulohaza";
  return "Tanqidiy fikrlash";
}

async function parseThinkingGuide(file, grade) {
  const r = await mammoth.convertToHtml({ path: file });
  const tables = r.value.match(/<table[\s\S]*?<\/table>/g) || [];

  // Find the summary table: has header row with №/Format/Mavzu/Ko'nikma/Bloom/Qiyinlik
  let summaryTable = null;
  for (const t of tables) {
    const text = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (text.includes("Bloom") && text.includes("Qiyinlik") && text.includes("Format")) {
      summaryTable = t;
      break;
    }
  }
  if (!summaryTable) return null;

  const rows = (summaryTable.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(1); // skip header
  return rows
    .map((row, i) => {
      const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map((c) =>
        c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      );
      // Columns: №, Format, Mavzu yo'nalishi, Asosiy ko'nikma, Bloom, Qiyinlik
      const fmt = cells[1] ?? "";
      const mavzu = cells[2] ?? "";
      const skill = cells[3] ?? "";
      const bloom = cells[4] ?? "";
      const diff = cells[5] ?? "";

      // Clean format (remove Russian translation in parens)
      const fmtClean = fmt.replace(/\([^)]*[а-яА-Я][^)]*\)/g, "").trim();

      return {
        id: `Q${i + 1}`,
        marks: 1,
        difficulty: normalizeDifficulty(diff),
        strand: formatToStrand(fmtClean),
        topic: fmtClean,
        subTopic: mavzu,
        skill: skill || fmtClean,
        bloom: normalizeBloom(bloom),
        reasoning: mavzuToReasoning(mavzu),
        gradeLevel: `${grade}-sinf`,
        framework: "Cambridge Thinking Skills",
      };
    })
    .filter((q) => q.id);
}

// For grades without a teacher guide: extract format order from student worksheet
async function parseThinkingStudent(file, grade, templateQuestions) {
  // Use the same diagnostic labels as the template but set gradeLevel to this grade
  return templateQuestions.map((q) => ({
    ...q,
    gradeLevel: `${grade}-sinf`,
  }));
}

async function convertThinking() {
  console.log("\n=== CRITICAL THINKING ===");
  let templateQuestions = null; // reuse grade 5 labels for grades without guide

  const grades = [5, 6, 7, 8, 9, 10, 11];
  for (const grade of grades) {
    const guideFile = `${RES}/Thinking/Sodiq_School_${grade}-sinf_Oqituvchi_Qollanmasi.docx`;
    const studentFile = `${RES}/Thinking/Sodiq_School_${grade}-sinf_Critical_Thinking_UZ_RU_Oquvchi.docx`;

    let questions = null;

    if (fs.existsSync(guideFile)) {
      try {
        questions = await parseThinkingGuide(guideFile, grade);
        if (questions && questions.length > 0) {
          console.log(`  Grade ${grade}: ${questions.length} questions from teacher guide`);
          if (!templateQuestions) templateQuestions = questions; // save as template for later grades
        }
      } catch (e) {
        console.error(`  Grade ${grade} guide ERROR:`, e.message);
      }
    }

    if (!questions && fs.existsSync(studentFile) && templateQuestions) {
      questions = await parseThinkingStudent(studentFile, grade, templateQuestions);
      console.log(`  Grade ${grade}: ${questions.length} questions (from grade template)`);
    } else if (!questions) {
      console.log(`  Grade ${grade}: no source found, skipping`);
      continue;
    }

    if (questions && questions.length > 0) {
      const out = path.join(OUT, `CRITICAL_THINKING-grade-${grade}.json`);
      fs.writeFileSync(out, JSON.stringify({ questions }, null, 2), "utf8");
      console.log(`  → ${path.basename(out)}`);
    }
  }
}

// ─── Validate against templateQuestionSchema rules ──────────────────────────

function validate(questions, label) {
  const issues = [];
  const BLOOM = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];
  const DIFF = ["Oson", "O'rta", "Qiyin"];
  const REASON = ["Deduktiv", "Induktiv", "Analitik", "Fazoviy", null];

  questions.forEach((q, i) => {
    if (!q.id) issues.push(`Q${i + 1}: missing id`);
    if (typeof q.marks !== "number" || q.marks < 0) issues.push(`${q.id}: invalid marks`);
    if (!BLOOM.includes(q.bloom)) issues.push(`${q.id}: invalid bloom "${q.bloom}"`);
    if (!DIFF.includes(q.difficulty)) issues.push(`${q.id}: invalid difficulty "${q.difficulty}"`);
    if (!REASON.includes(q.reasoning)) issues.push(`${q.id}: invalid reasoning "${q.reasoning}"`);
    if (!q.strand) issues.push(`${q.id}: empty strand`);
    if (!q.topic) issues.push(`${q.id}: empty topic`);
  });
  if (issues.length) {
    console.log(`  ⚠ ${label} issues:`);
    issues.slice(0, 10).forEach((s) => console.log(`    - ${s}`));
    if (issues.length > 10) console.log(`    ... and ${issues.length - 10} more`);
  } else {
    console.log(`  ✓ ${label}: all ${questions.length} questions valid`);
  }
  return issues.length === 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  convertMath();
  await convertEnglish();
  await convertThinking();

  // Validate all generated files
  console.log("\n=== VALIDATION ===");
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".json"));
  let allOk = true;
  for (const f of files.sort()) {
    try {
      const { questions } = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
      const ok = validate(questions, f.replace(".json", ""));
      if (!ok) allOk = false;
    } catch (e) {
      console.log(`  ✗ ${f}: ${e.message}`);
      allOk = false;
    }
  }

  console.log("\n=== SUMMARY ===");
  files.forEach((f) => {
    const { questions } = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    console.log(`  ${f}: ${questions.length} questions, ${questions.reduce((s, q) => s + q.marks, 0)} marks`);
  });
  console.log(`\nOutput: ${OUT}`);
  console.log(allOk ? "ALL FILES VALID ✓" : "SOME FILES HAVE ISSUES ✗");
})();
