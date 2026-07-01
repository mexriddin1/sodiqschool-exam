# Sodiq School — Calculation Rules

This is the canonical formula reference. Implementation lives in
`packages/compute/src/compute.ts` (per-subject) and `composite.ts` (cross-subject
+ admission verdict). The backend uses the same package at save/publish time so
admin and client cannot diverge.

> **Rounding:** all displayed scores use `Math.round(x)` (i.e. ties to away
> from zero on negatives — `Math.round(-0.5) = 0`). Use the `round` helper in
> `compute.ts`; never round inline elsewhere.

---

## Constants

```ts
DIFFICULTY_WEIGHT = { Oson: 1, "O'rta": 2, Qiyin: 3 }
DIFFICULTY_ORDER  = ["Oson", "O'rta", "Qiyin"]
```

---

## Per-subject metrics

Input: `questions[]` (see `Question` type) + optional `realData`.

### Headline score

```
rawScore       = Σ q.earned
percent        = round(rawScore / totalMarks · 100)
correctCount   = count(q.result === "To'g'ri")
partialCount   = count(q.result === "Qisman")
```

### Confidence interval (transparent, NOT hand-set)

```
margin = round( √(p·(100−p) / n) / 2 )
ci     = { low: max(0, p − margin), high: min(100, p + margin), margin }
```

`n = totalQuestions`. Documented to the parent in §5 of the report.

### Score band

| Range  | key       | label        | en       |
| ------ | --------- | ------------ | -------- |
| ≥ 90   | `juda`    | Juda yuqori  | Very High |
| ≥ 80   | `yaxshi`  | Yaxshi       | Good     |
| ≥ 70   | `ortacha` | O'rtacha     | Average  |
| ≥ 60   | `rivoj`   | Zaif         | Developing |
| else   | `sayoz`   | Sayoz        | Shallow  |

### Difficulty tiers

For each `d ∈ ["Oson", "O'rta", "Qiyin"]`:

```
items   = questions.filter(q.difficulty === d)
correct = count(items.result === "To'g'ri")
pct     = round(correct / items.length · 100)
```

### KDI — Knowledge Depth Index

```
wCorrect = Σ tier.correct · weight
wTotal   = Σ tier.n       · weight
kdiExact = wCorrect / wTotal · 100
kdi      = round(kdiExact)
```

### Mastery (from KDI)

| KDI   | label             | en                  |
| ----- | ----------------- | ------------------- |
| ≥ 95  | Ajoyib            | Exceptional         |
| ≥ 85  | Yuqori daraja     | Advanced            |
| ≥ 70  | Yaxshi egallagan  | Proficient          |
| ≥ 55  | O'rtacha          | Basic               |
| ≥ 40  | Cheklangan        | Limited             |
| else  | Jiddiy yordam     | Significant Support |

### Adjusted & potential

```
technicalLost = Σ (q.marks − q.earned) where q.errorType === "Texnik"
gapLost       = Σ (q.marks − q.earned) where q.errorType === "Bilim bo'shlig'i"
adjusted      = rawScore + technicalLost
potential     = round( (adjusted + kdi + hardTierPct) / 3 )
```

Rationale: `potential` is a transparent, criterion-based ceiling estimate
combining (a) the ceiling without technical errors, (b) weighted depth, and
(c) performance on the hard tier. Never hand-set.

### Group statistics (strand / topic / bloom / reasoning / gradeLevel / skill)

For each group key:

```
n        = items.length
correct  = count(items.result === "To'g'ri")
percent  = round(correct / n · 100)
lowConfidence = (n < 3)
qualitative   = if lowConfidence:
                  n=0 → "Ma'lumot yo'q"
                  ratio ≥ 0.8 → "Kuchli (kam namuna)"
                  ratio ≥ 0.5 → "O'rtacha (kam namuna)"
                  else        → "Zaif (kam namuna)"
                else: null
```

**Display rule (CLAUDE.md):** when `lowConfidence`, render the qualitative
label, not a precise number.

### Topic enrichment

```
avgWeight    = avg(items.difficulty.weight)
analysisFrac = count(items.bloom === "Tahlil") / items.length
```

### Gap zones (§8)

For each enriched topic:

```
below (need work):    percent < 55
above (above grade):  percent ≥ 70 AND (avgWeight ≥ 2.3 OR analysisFrac ≥ 0.6)
at (at grade):        else
```

### Overall risk (§9)

```
belowCount = count(gapZones.below where !lowConfidence OR percent === 0)
risk:
  kdi ≥ 70 AND belowCount ≤ 3 → PAST    (Low)
  kdi ≥ 55                    → O'RTA   (Moderate)
  else                        → YUQORI  (High)
```

### Growth forecast (§13)

```
headroom = max(0, adjusted − percent)
forecast = [
  { Hozir: percent },
  { 3 oy:  percent + round(headroom · 0.45) },
  { 6 oy:  percent + round(headroom · 0.7)  },
  { 12 oy: percent + round(headroom · 0.95) },
]
```

Criterion-based, transparent. The ceiling without technical errors is
`adjusted`; growth approaches it with diminishing returns.

### Error roster (§4)

For each wrong question:

```
harderSolvedIds = questions where:
  o.skill === q.skill
  AND o.result === "To'g'ri"
  AND DIFFICULTY_WEIGHT[o.difficulty] ≥ DIFFICULTY_WEIGHT[q.difficulty]
```

A non-empty `harderSolvedIds` supports the "Texnik" diagnosis (the student
solved a harder same-skill item, so the error is attention, not gap).

---

## Composite (cross-subject)

Inputs: three `SubjectReport`s (MATH, ENGLISH, CRITICAL_THINKING), `grade`,
`admissionThresholds`.

```
composite      = avg(report.percent for each subject)
compPotential  = avg(report.potential)
compAdjusted   = avg(report.adjusted)
compBand       = scoreBand(composite)
avgTechPct     = avg(report.technicalLost / report.lostTotal · 100)
                 (0 when lostTotal === 0)
```

`topSubject` / `lowSubject` are the max/min by `percent`.

---

## Admission gate

From `resource/result.text`. Per-grade, per-subject minimum percent:

| Grade | Math | CT  | English |
| ----- | ---- | --- | ------- |
| 5     | 30   | 40  | 30      |
| 6     | 30   | 40  | 30      |
| 7     | 35   | 30  | 35      |
| 8     | 35   | 30  | 35      |
| 9     | 35   | 25  | 40      |
| 10    | 35   | 25  | 40      |
| 11    | 35   | 25  | 40      |

```
gateAllPassed = ∀ subject: report.percent ≥ threshold[grade][subject]
```

### Verdict

Per `result.text`: **the verdict is only shown on the composite, not per
subject.**

```
if NOT gateAllPassed:
  → TAYYORGARLIK ("Bir yoki bir nechta fan minimal chegaradan past")

else:
  compPotential ≥ 80 → QABUL QILINSIN ("Uch fan bo'yicha maktabga qabul tavsiya etiladi")
  compPotential ≥ 70 → QABUL QILINSIN ("Qo'llab-quvvatlash bilan tavsiya etiladi")
  compPotential ≥ 60 → SHARTLI QABUL  ("Shartli ravishda tavsiya etiladi")
  else               → TAYYORGARLIK   ("Avval tayyorgarlik tavsiya etiladi")
```

`perSubjectGate` is exposed for diagnostics but not displayed as a verdict
badge per subject.

---

## Validation rules (server-side, on save)

Implemented in `validateQuestions()`. Result is rejected if:

- `marks < 0` or `earned < 0`
- `earned > marks`
- `result === "To'g'ri"` and `errorType !== null`
- `result !== "To'g'ri"` and `earned === marks` (cannot earn full marks on a
  non-correct outcome)
- Duplicate `id`s

These are caught at `POST /api/admin/results` and `PATCH /api/admin/results/:id`,
before persistence.

---

## Never compute on the client

The Astro client renders from `calculatedSnapshot` (frozen at publish time)
plus `manualContent`. It does NOT call `computeReport` on the
public path — that would let the client diverge from the published numbers,
and would re-introduce trust in client-supplied scores. Admin preview uses the
same package server-side and serialises the result for rendering.

(Today the client still imports `lib/compute.js` for static demo pages; Phase 4
swaps that for the API-supplied snapshot.)
