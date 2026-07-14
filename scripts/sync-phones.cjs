// One-shot: read the exam CSV, extract (UID, phone) pairs, and emit both
// (a) a summary to stdout, and (b) a phones.sql file with UPDATE statements.
//
// Usage:  node scripts/sync-phones.cjs "<csv path>" <output.sql>
//
// CSV shape: header row at row 3 (index 2). Columns of interest:
//   idx 3  -> UID          (e.g. "2607076")
//   idx 10 -> Telefon raqam (many shapes: "+998 90 943 73 37", "998908247773",
//              "901770689", ...)

const fs = require("fs");

const [, , csvPath, outSql] = process.argv;
if (!csvPath || !outSql) {
  console.error("Usage: node sync-phones.cjs <csv> <out.sql>");
  process.exit(2);
}

// Small CSV splitter — the file is comma-separated and none of the columns
// we read contain commas or quotes, so a naive split is safe here.
function splitCsvLine(line) {
  return line.split(",");
}

// Reduce a raw phone string to `+998XXXXXXXXX`. Returns null if it can't be
// unambiguously mapped (empty, wrong length, unknown country prefix).
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Common Uzbek shapes seen in the CSV:
  //   12 digits starting with 998  -> already country-coded, prefix +
  //    9 digits                    -> operator + subscriber, add +998
  //   13 digits (e.g. leading 0)   -> reject: ambiguous
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}

const raw = fs.readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/);

let dataStart = -1;
for (let i = 0; i < lines.length; i++) {
  const cols = splitCsvLine(lines[i]);
  if ((cols[0] ?? "").trim() === "#") { dataStart = i + 1; break; }
}
if (dataStart < 0) {
  console.error("Header row starting with '#' not found");
  process.exit(3);
}

const updates = new Map(); // uid -> phone
let noUid = 0;
let noPhone = 0;
let invalidPhone = 0;
let duplicateUid = 0;
const invalidSamples = [];

for (let i = dataStart; i < lines.length; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  const cols = splitCsvLine(line);
  const uid = (cols[3] ?? "").trim();
  const phoneRaw = (cols[10] ?? "").trim();
  if (!uid) { noUid++; continue; }
  if (!phoneRaw) { noPhone++; continue; }
  const phone = normalisePhone(phoneRaw);
  if (!phone) {
    invalidPhone++;
    if (invalidSamples.length < 5) invalidSamples.push({ uid, raw: phoneRaw });
    continue;
  }
  if (updates.has(uid)) {
    duplicateUid++;
    // Keep the first phone we saw for that UID.
    continue;
  }
  updates.set(uid, phone);
}

// Emit SQL. Use a single transaction so partial failure rolls back.
const sqlHeader = `-- generated ${new Date().toISOString()} — sync phones from CSV\nBEGIN;\n`;
const sqlBody = [...updates.entries()]
  .map(([uid, phone]) => `UPDATE "Student" SET phone='${phone}' WHERE uid='${uid.replace(/'/g, "''")}';`)
  .join("\n");
const sqlFooter = `\nCOMMIT;\n`;
fs.writeFileSync(outSql, sqlHeader + sqlBody + sqlFooter, "utf8");

console.log("=== summary ===");
console.log(`rows parsed:        ${lines.length - dataStart}`);
console.log(`updates to apply:   ${updates.size}`);
console.log(`skipped (no UID):   ${noUid}`);
console.log(`skipped (no phone): ${noPhone}`);
console.log(`skipped (bad phone): ${invalidPhone}`);
console.log(`duplicate UIDs:     ${duplicateUid} (kept first)`);
if (invalidSamples.length) {
  console.log("bad-phone samples:");
  for (const s of invalidSamples) console.log(`  ${s.uid} -> "${s.raw}"`);
}
console.log(`\nSQL written to: ${outSql}`);
