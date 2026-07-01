# Implementation notes

Decisions made during build, assumptions made when the spec was ambiguous,
and known gaps.

## Decisions vs. the original generic prompt

| Topic                  | Prompt said            | We did                                   | Why                                                                 |
| ---------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Client framework       | Next.js                | Astro (kept)                             | Existing site is Astro with rich SVG, ECharts, Playwright PDF export |
| Per-question storage   | Normalized SQL         | JSON column on `SubjectResult.questions` | Labels are the source of truth; schema is wide and rarely queried   |
| Calculation engine     | Backend-only           | Shared `@sodiq/compute` (TS port)        | Single source of truth between backend (publish) and client (render) |
| Admission verdict      | Implicit               | Composite-only badge                     | `resource/result.text` correction: "U faqat umumiyda tursin"        |
| Code charset           | A–Z 0–9                | A–Z 0–9 minus O 0 I 1                    | Per prompt                                                          |
| Question-grid editor   | WYSIWYG                | JSON textarea paste                      | Real grid is days of work; pragmatic Phase 1                        |
| Astro auth             | Direct cookie share    | Astro proxies via own cookie + Bearer    | Avoids cross-origin sameSite=none + secure constraints in dev       |

## Field classifications (cross-reference: `result-field-map.md`)

- Per-question labels (`difficulty`, `strand`, `topic`, `bloom`, etc.) — MANUAL
  on entry, derived everywhere downstream.
- All aggregate numbers (KDI, mastery, percent, rank, percentile, verdict) —
  DERIVED via the shared compute engine.
- Cover meta (`candidate`, `grade`, `school`, `slogan`) — MANUAL or STATIC; the
  brand strings are not editable.
- Per-subject narrative phrases (`strength`, `growthLabel`) — MANUAL on
  `SubjectResult.manualNotes`.
- §13/§14/§15 narrative (`outlook`, `parent`, `committee`) — MANUAL on
  `Result.manualContent`.
- Cohort placeholders (rank/total/percentile) — computed by
  `recomputeCohortRanks` from published peers; admin override available via
  `manualContent.cohort.{rank, total, percentile}` if needed.
- BLOOM_LEVELS / skillRadar / reasoningTypes hardcoded placeholders — kept as
  display fallback when a group is `lowConfidence`; admin can override under
  `manualContent.bloomFallback / skillRadar / reasoningTypes`.

## Assumptions

1. **Three subjects per result, always.** The Result schema requires exactly
   three SubjectResults (MATH/ENGLISH/CRITICAL_THINKING). This matches every
   sample data file and the summary page.
2. **One exam per grade.** Per-grade thresholds are stored on
   `Exam.admissionThresholds` as a JSON map keyed by grade string; an exam
   could in principle handle multiple grades but the seed creates a per-grade
   exam.
3. **Cohort size on exam.** `Exam.cohortSize` is the denominator for
   percentile. If unset, we use the count of published peers — the page
   already documents this is "no cohort yet" in those situations.
4. **Past-published results' rank changes on every publish/unpublish.**
   `recomputeCohortRanks` updates every published peer's `calculatedSnapshot.cohort`
   when the set changes. This is acceptable today (small cohorts); for larger
   cohorts revisit (denormalise rank into its own column).

## Known gaps to address in follow-up turns

- **Admin: no rich question editor.** Paste-JSON is functional but slow. A
  proper grid (xlsx paste, validation per cell, label dropdowns) is a Phase 6
  feature.
- **Admin: no user management UI.** AdminUser CRUD endpoint not yet exposed;
  add `/api/admin/users` with `ADMIN` role gate.
- **Admin: no audit log viewer.** Data is captured (`AuditLog` table); a
  read-only paginated list page is needed.
- **Client: still imports `lib/compute.js`.** Functionally identical to
  `@sodiq/compute`. The swap is mechanical (rename imports, change file
  extensions in 4 pages) but kept out of Phase 4 to limit risk. Do this when
  also adding TS to the client.
- **Client: `BLOOM_LEVELS[].ph` and `skillRadar[]` placeholders still hardcoded.**
  They should read from `me.manualContent.bloomFallback` and
  `me.manualContent.skillRadar` with the hardcoded values as last-resort fallback.
- **e2e Playwright test.** Add a single happy-path test: seed → log in as
  admin → create result → publish → log in as student → render
  index/english/critical-thinking/summary without errors.
- **No CSRF.** Documented in `security-notes.md`.
- **No password reset for admins.** AdminUser passwords can only be reset by
  another admin or seed.

## File structure as built

```
exam/
├── package.json              (npm workspaces root)
├── docs/
│   ├── result-field-map.md   field map
│   ├── implementation-plan.md plan
│   ├── calculation-rules.md  formulas
│   ├── api.md                endpoint reference
│   ├── security-notes.md     threat model + controls
│   └── implementation-notes.md (this file)
├── packages/
│   └── compute/              shared TS port of compute.js
│       ├── src/
│       │   ├── types.ts
│       │   ├── compute.ts
│       │   ├── composite.ts
│       │   ├── code.ts       (node-only: uses crypto.randomInt)
│       │   └── index.ts
│       └── test/compute.test.ts (10 tests)
├── backend/                  Express + Prisma + Postgres
│   ├── prisma/schema.prisma + seed.ts
│   ├── src/
│   │   ├── config.ts db.ts index.ts
│   │   ├── middleware/{auth,error}.ts
│   │   ├── lib/{errors,response,schemas,json}.ts
│   │   ├── routes/
│   │   │   ├── admin.{auth,students,exams,results}.ts
│   │   │   └── public.result.ts
│   │   └── services/{audit,calculation,code,snapshot}.ts
│   └── test/code-and-snapshot.test.ts (3 tests)
├── admin/                    Next.js 14 App Router + Tailwind
│   └── src/
│       ├── app/login/page.tsx
│       ├── app/(panel)/{dashboard,students,exams,results}/...
│       ├── components/StatusBadge.tsx
│       └── lib/api.ts
└── client/                   existing Astro report — minimal changes
    ├── astro.config.mjs (now: output: server, @astrojs/node)
    └── src/
        ├── pages/
        │   ├── login.astro          (new)
        │   ├── api/{login,logout}.ts (new — proxies to backend)
        │   ├── index.astro          (modified — fetches from API)
        │   ├── english.astro        (modified)
        │   ├── critical-thinking.astro (modified)
        │   └── summary.astro        (modified)
        └── lib/
            ├── session.ts           (new — cookie + fetchMyResult)
            ├── client-data.ts       (new — pickSubject helper)
            └── compute.js, programs.js, svg.js   (unchanged)
```
