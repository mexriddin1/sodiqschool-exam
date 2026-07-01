# Sodiq School — Repository audit (round 2)

After reading every page, component, helper, and resource file end-to-end.
Replaces the earlier audit — that one was incomplete because it only sampled
`index.astro` and `student.json`.

## Critical findings the first audit missed

### 1. Official grading scale (from `resource/image.png`) ≠ what we ship

The "Yakuniy shkala" table on `resource/image.png` is the **official** Sodiq
School result scale. Five levels, with Uzbek + English labels + admission
decision + risk:

| Ball | Akademik daraja | Inglizcha | Akademik tavsif | Qabul qarori | Risk |
| ---- | --------------- | --------- | --------------- | ------------ | ---- |
| 84–100 | Yuqori daraja | Advanced | Murakkab masalalarni mustaqil yechadi | Strong Admit | Past |
| 67–83  | Ishonchli daraja | Secure | Dasturni ishonchli o'zlashtiradi | Admit | Past |
| 50–66  | Rivojlanayotgan daraja | Developing | Asos bor, ayrim bo'shliqlar | Conditional Admit | O'rtacha |
| 35–49  | Shakllanayotgan daraja | Emerging | Sezilarli ko'nikma bo'shliqlari | Waitlist | Yuqori |
| 0–34   | Tamal bosqich | Foundational | Asos deyarli shakllanmagan | Not Yet Ready | Juda yuqori |

What we currently have (in `packages/compute/src/compute.ts` and the four
client pages):

- `scoreBand`: ≥90 Juda yuqori / ≥80 Yaxshi / ≥70 O'rtacha / ≥60 Zaif / else Sayoz
- `verdict`: ≥80 QABUL QILINSIN / ≥70 QABUL QILINSIN with support / ≥60 SHARTLI QABUL / else TAYYORGARLIK

**None of those labels or thresholds appear in `resource/image.png`.** Both
the band and the verdict must be replaced with the official 5-level scale.
`tavsif` and `risk` are also new fields the resource provides.

### 2. `english.astro` / `critical-thinking.astro` / `summary.astro` still bypass `resolveOverrides`

My earlier round 1 only wired `index.astro`. The three other pages still
contain hardcoded values:

`english.astro`:
- L25 — `const studentSex = 'male'`
- L26 — `const cohort = { percentile: 90, rank: 24, total: 240, maleRank: 12, maleTotal: 128 }`
- L33–40 — `BLOOM_LEVELS` placeholder %s
- L46–54 — `skillRadar` placeholder values
- L96 — `const strengthLabel = "grammatika va lug'at boyligi"`
- L202 — `{a1lvl ? a1lvl.percent : 94}` — A1 fallback 94 hardcoded
- L213 — `{a2lvl ? a2lvl.percent : 75}` — A2 fallback 75 hardcoded
- L266–267 — per-question fake `solvedPct` (same formula as other pages)

`critical-thinking.astro`:
- L25 — `studentSex = 'male'`
- L26 — `cohort = { percentile: 85, rank: 36, total: 240, maleRank: 18, maleTotal: 128 }`
- L33–40 — `BLOOM_LEVELS` placeholder
- L46–55 — `skillRadar` 8 placeholder values
- L96 — `const strengthLabel = "mantiqiy va abstrakt fikrlash"`
- L201 — `{hardTier ? hardTier.pct : 100}` — fallback 100
- L264–265 — per-question fake `solvedPct`

`summary.astro`:
- L21–23 — `CFG` per-subject `{strength, growthLabel, rank}` hardcoded for all three subjects
- L25 — `COHORT_TOTAL = 240`
- L48–49 — `overallRank = 28`, `overallPct = 88`
- L51 — `gradeLabel: '5-sinfga nomzod · 3 fan · ~10 yosh'`
- L116–117 — narrative asserting "Mantiqiy va tahliliy fikrlash" cross-strength
- L196 — same cross-strength repeated in `Eng kuchli umumiy tomon` block

### 3. Per-question "solvedPct" column is fake

§3 (`Har bir savol`) table on all three subject pages shows a "Yechganlar"
column populated by:

```js
const base = q.difficulty === 'Oson' ? 86 : q.difficulty === "O'rta" ? 67 : 49;
const solvedPct = base + ((i * 7) % 13) - 6;
```

This is a deterministic-but-fake value. It has no relation to any real cohort.
Options: (a) admin-provided per question, (b) computed from real published
peers, (c) hide the column when no data.

### 4. §1 narrative paragraphs assume a strong result

Phrases like "yaxshi topshirdi" / "ishonchli, o'rta darajadan yuqori turadi" /
"kuchli akademik poydevor belgisi" / "Tavsiya — qabul qilinsin" are baked
into the JSX. They will read wrong for low-band students. The narrative needs
either branched templates per band, or admin-editable override per result.

### 5. Per-grade-level fallbacks in English narrative

English §1 uses hardcoded fallbacks `{a1lvl ? a1lvl.percent : 94}` and
`{a2lvl ? a2lvl.percent : 75}`. If the test doesn't carry an A1 or A2 group
in `byGradeLevel`, the narrative shows 94% / 75% with no basis.

## Classification

After reading every file, every dynamic value falls into one of these:

| Category | Notes |
| -------- | ----- |
| STATIC | Brand strings (school, slogan, office). TOC labels. Section headings. §4 methodology note. §5 helper text. ECharts captions. Glossary / "i-button" definitions (skillHelp / bloomHelp / reasonHelp arrays). Programs.js / programs-en.js / programs-ct.js entire content (these are curated per-subject templates with numbers spliced in). |
| ENTITY DATA | `meta.candidate` (Student.fullName), `meta.grade` / `meta.gradeLabel` (Student.grade + age), `meta.subject` (per-subject constant), `meta.totalQuestions` / `meta.totalMarks` (SubjectResult totals). `studentSex` (Student.sex). |
| CALCULATED | Everything from `computeReport()`: `percent`, `ci`, `band` (after fix), `tiers`, `kdi`, `mastery` (after fix), `adjusted`, `potential`, `byStrand`, `byTopic`, `byBloom`, `byReasoning`, `byGradeLevel`, `bySkill`, `topics`, `strandDetails`, `weakestTopic`, `strongTopics`, `gapZones`, `overallRisk`, `riskItems`, `growthForecast`, `errorRoster`. Composite: `composite`, `compPotential`, `compAdjusted`, `compBand`, `avgTechPct`, `topSubject`, `lowSubject`, `verdict`. |
| MANUAL (per result) | Per-question `evidence`. Per-subject `manualNotes.strength` + `manualNotes.growthLabel`. `manualContent.parent` / `committee` / `outlook`. `manualContent.cohort.{rank, total, percentile, maleRank, maleTotal}`. `manualContent.summary.{overallRank, overallPct, crossStrength}`. **NEW:** per-subject `manualContent.bloomFallback` (Bloom-key → %). **NEW:** per-subject `manualContent.skillRadar` (axes array). **NEW:** per-subject `manualContent.reasoningTypes` (math only). **NEW:** per-subject `manualContent.gradeLevelFallback` (English: A1, A2 fallback %). |
| CONFIGURABLE (per exam) | `admissionThresholds` (per-grade per-subject minimum %). `gradingConfiguration` — the 5-level scale from `resource/image.png` (currently empty). |
| SYSTEM | `Result.publicCode`, `accessPasswordHash`, `status`, `publishedAt`, IDs, timestamps, audit log. |
| PLACEHOLDER (to remove or back with real data) | `solvedPct` per question (§3). Currently faked deterministically. |

## Plan of work (this turn)

1. Replace `scoreBand` + `masteryFromKDI` + `verdict` logic in
   `@sodiq/compute` to match `resource/image.png`. Add `tavsif` and `risk`
   fields to the band object.
2. Update `Exam.gradingConfiguration` to carry the 5-level scale (with
   defaults from the resource); admin can edit per exam.
3. Update `client/src/lib/client-data.ts` so the four pages can resolve EVERY
   override consistently. Extend `resolveOverrides` for per-subject narrative
   + per-grade-level fallbacks + summary CFG.
4. Wire `english.astro`, `critical-thinking.astro`, `summary.astro` to
   `resolveOverrides` (currently they don't import it).
5. Drop the fake `solvedPct` column to "—" when no real data exists; allow
   per-question `peerSolveRate` field on questions if admin provides it.
6. Update admin form (new and edit) to surface cohort, per-subject narrative,
   per-grade-level fallback %s, per-subject skillRadar + reasoningTypes
   overrides, summary block (overallRank/Pct/crossStrength).
7. Update the live verdict + band + tavsif so admin preview and student view
   reflect the official scale.
8. Verify builds + smoke flow.

What stays unchanged:
- Client layout / typography / sections / colours / SVG / chart code.
- Per-question label set (difficulty/strand/topic/etc.).
- `programs.js` / `programs-en.js` / `programs-ct.js` curated template content
  (this is school-author content, not per-student).
- `compute.ts` formulas for KDI, adjusted, potential, growthForecast, gap
  zones, etc. Only the band/verdict thresholds + labels change.
