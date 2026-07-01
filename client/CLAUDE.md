# Sodiq School — Diagnostic Report (web)

## Goal
A premium, per-student academic diagnostic report as a website + A4 PDF export.
Every number is computed from per-question LABELS (never hand-set).

## Brand
- Colors: navy `#06113C`, orange `#FF8A32`, greys `#ECECEC`/`#DBDBDB` (60/30/10).
- Fonts: Pragmatica Slab (headings), Pragmatica (body) — self-host as .woff2; fallback Arial.
- Slogan (never translate): "Biz ilmga sodiqmiz".
- Language: Uzbek Latin, ASCII apostrophes (o', g'). NEVER Cyrillic.

## Tech stack
- Astro + Tailwind CSS.
- ECharts for bar/line/donut/radar.
- Custom inline SVG for: difficulty pyramid, KDI semicircle gauge, position scale, error stacked-bar.
- Playwright for A4 PDF export (printBackground:true, prefer_css_page_size).
- Data: one JSON per student (see report-data.sample.json). Deploy on Vercel.

## Data model
Input = `questions[]` with labels. The app COMPUTES all indicators (do not trust pre-baked numbers; recompute from questions):
- difficulty: "Oson"|"O'rta"|"Qiyin"  (weights 1/2/3)
- result: "To'g'ri"|"Noto'g'ri"|"Qisman"; earned marks
- errorType: "Texnik"|"Bilim bo'shlig'i" (only if wrong)
- plus: strand, topic, subTopic, skill, bloom, reasoning, gradeLevel, framework

## Computation rules (must match exactly)
- rawScore = sum(earned); percent = raw/totalMarks*100
- tier% = correct/total per difficulty
- KDI = (Σ correct×weight)/(Σ total×weight)×100, weights Oson1/Orta2/Qiyin3
- mastery from KDI: 95+ Exceptional, 85+ Advanced, 70+ Proficient, 55+ Basic, 40+ Limited, else Significant Support
- adjusted = raw + Σ marks where errorType="Texnik"
- potential = round((adjusted + KDI + hardTier%)/3)   # transparent formula, NOT hand-set
- strand/topic/bloom/reasoning/gradeLevel %: correct/total per group
- If a group has n<3 → show qualitative label + "low confidence", NOT a precise number
- percentile / cohort average / time: leave EMPTY unless real data exists (no fabrication)

## Report sections (in order)
1 Snapshot · 2 Overall result + error analysis (+KDI indicator) · 3 Per-question table
· 4 Error-type methodology · 5 Knowledge Depth (pyramid, donut, KDI gauge, formula, expert note)
· 6 Subject heatmap · 7 Cross-skill radar · 8 Gap (red/blue/green zones)
· 9 Risk (overall indicator first) · 10-12 Development programs 3/6/12 months (full strategic pages)
· 13 Future outlook (qualitative) · 14 Parent conclusion · 15 Committee conclusion · 16 Glossary

## Reference
- `report-data.sample.json` — the data shape (real grade-5 math student).
- Existing markup/look: the v3 HTML/PDF (drop in /reference).
