# Sodiq School — Implementation Plan

Plan tailored to the **actual** codebase (per-question diagnostic engine,
Astro client, three subjects, computed-from-labels rule). Replaces the
generic prompt's Next.js + simple-raw-score assumption.

## Constraints inherited from the existing project

- **Client stack stays Astro + Tailwind** (CLAUDE.md is explicit; rich SVG +
  ECharts + compute.js + Playwright PDF export). Do not migrate to Next.js.
- **All indicators are computed from per-question labels** (`compute.js`).
  Backend must mirror this — never trust frontend numbers for publish.
- **Brand rules**: Uzbek Latin, ASCII apostrophes, navy/orange palette,
  `"Biz ilmga sodiqmiz"` slogan never translated.
- **Three subjects per candidate**: Matematika, Ingliz tili, Tanqidiy fikrlash.
  A single `Result` packages all three; the public client renders three subject
  pages + a summary page from one login.
- **Public access = 6-char code + password**, never UUID. bcrypt-hashed.
- **Admission verdict lives only on composite**, not per subject (per
  `resource/result.text`).

## Stack decisions (deviations from the generic prompt — justified)

| Area    | Generic prompt    | Decision                            | Why                                  |
| ------- | ----------------- | ----------------------------------- | ------------------------------------ |
| Client  | Next.js           | **Astro stays**                     | Existing rich UI + PDF export.       |
| Admin   | Next.js + Tailwind | Next.js (App Router) + Tailwind     | Matches prompt; clean fit.            |
| Backend | Express + Prisma + Postgres | **Same**                  | Standard.                             |
| Calc    | Backend-only      | **Port `compute.js` to TS in a shared package** | Single source of truth, used by backend for publish-validation AND by client for render. Avoids two-implementation drift. |
| Auth    | JWT cookies       | Same                                | Standard.                             |
| Codes   | 6 char A–Z0–9 minus O/0/I/1 | Same                       | Per prompt.                          |

## Data model (Prisma)

```prisma
model AdminUser { id, fullName, email @unique, passwordHash, role(ADMIN|EDITOR), isActive, createdAt, updatedAt }

model Student   { id, fullName, studentNumber?, phone?, sex?, birthDate?, grade Int, groupName?, metadata Json?, createdAt, updatedAt
                  results Result[] }

model Exam      { id, title, description?, examDate, academicYear?, status(DRAFT|ACTIVE|ARCHIVED), grade Int,
                  admissionThresholds Json, // { math: 30, ct: 40, en: 30 } per grade-row from result.text
                  gradingConfiguration Json, // band labels & cutoffs
                  cohortSize Int?,
                  createdAt, updatedAt }

model Result    { id, studentId, examId,
                  publicCode @unique (6 chars),
                  accessPasswordHash,
                  status(DRAFT|PUBLISHED|ARCHIVED),
                  manualContent Json, // { strengthNarratives, growthLabels, parent, committee, outlook, bloomFallback, skillRadar, reasoningTypes, cohort overrides }
                  calculatedSnapshot Json, // last computeReport() output per subject + composite, frozen at publish time
                  publishedAt?, createdAt, updatedAt
                  subjects SubjectResult[] }

model SubjectResult { id, resultId, subject(MATH|ENGLISH|CRITICAL_THINKING),
                      totalQuestions Int, totalMarks Int,
                      questions Json, // array of per-question objects (id, marks, difficulty, strand, topic, subTopic, skill, bloom, reasoning, gradeLevel, framework, result, earned, errorType, evidence)
                      realData Json, // {percentile, cohortAverage, avgTimeSec}
                      manualNotes Json, // {strength, growthLabel}
                      createdAt, updatedAt }

model AuditLog { id, adminUserId?, action, entityType, entityId, prev Json?, next Json?, createdAt }
```

Indexes: `Result.publicCode` unique; `(Student.grade, Exam.id)`;
`AuditLog.entityType+entityId`.

## Repo layout

```
exam/
├── admin/            (new — Next.js)
├── backend/          (new — Express + Prisma)
├── client/           (existing Astro — minimal changes)
├── packages/
│   └── compute/      (new — shared TS port of compute.js, used by backend & admin preview)
├── docs/
└── resource/
```

## API surface (REST, /api prefix)

### Admin (cookie-auth, role-protected)

```
POST   /api/admin/auth/login | logout
GET    /api/admin/auth/me

CRUD   /api/admin/students
CRUD   /api/admin/exams
CRUD   /api/admin/results
       /api/admin/results/:id/publish | unpublish | archive | reset-password
GET    /api/admin/results/:id/preview     (returns same shape the public client gets)
GET    /api/admin/results/:id/credentials (one-time after create/reset)
GET    /api/admin/audit-logs
```

### Public (scoped cookie-auth)

```
POST   /api/result/auth/login            { code, password } → sets scoped JWT
POST   /api/result/auth/logout
GET    /api/result/me                    → { student, exam, subjects[], composite, verdict, manualContent }
```

Public client never accepts a Result UUID in the URL.

## Calculation engine (shared `packages/compute`)

- TS port of `client/src/lib/compute.js` (1:1 semantics, including
  `n<3 → low confidence`, exact rounding helper, `pctColor`, `masteryFromKDI`).
- Composite layer: takes three `computeReport` outputs + admission thresholds
  → `{composite, compPotential, compBand, verdict, perSubjectVerdict (info-only,
  not displayed per `result.text`)}`.
- Backend uses it on every save (validation) and on publish (freezes
  `Result.calculatedSnapshot`).
- Admin preview imports the same package.
- Astro client switches from local `compute.js` to importing `@sodiq/compute`.

## Admin panel (Next.js)

Pages: Login · Dashboard · Students · Exams (subjects fixed; thresholds editable
per grade) · Results (list, create, edit, preview, publish, credentials,
reset-password, archive) · Settings · Audit log.

Result form is a 4-tab wizard:

1. Student + Exam selection
2. Per-subject question grid (paste from xlsx/docx → grid edit; validates
   `earned ≤ marks` and label whitelists)
3. Manual narrative (per-subject strength/growth phrases; §13/§14/§15
   overrides; real-data cohort fields)
4. Preview + publish

Live computed preview pane next to the form (uses shared `compute` package).
Authoritative numbers come from backend on save.

## Client integration (Astro changes — minimal)

- Replace `import student from '../data/student.json'` with a `fetch()` on
  the public `/api/result/me` endpoint (Astro hybrid mode, server-rendered
  per request).
- Add `/login` page (form posts `code` + `password`).
- Add logout, error states (invalid code, draft, archived, session expired).
- Replace placeholders documented in `result-field-map.md §6` with real data
  pulled from `manualContent` / `calculatedSnapshot` / `realData`.
- Keep PDF export script; point it at an authenticated admin-preview URL.

## Security

- bcrypt cost ≥ 12 for both admin and result passwords.
- Two JWT secrets (`ADMIN_JWT_SECRET`, `RESULT_JWT_SECRET`); scoped audiences.
- Cookies: `httpOnly`, `sameSite=lax`, `secure` in production.
- Rate limit `/api/result/auth/login` (e.g. 5 / 15 min / IP+code).
- Generic error for invalid code OR invalid password (no enumeration).
- Public session is scoped to `resultId`; ignored if request asks for any other.
- Helmet, request size limits, validated CORS, no stack traces in prod.

## Phasing

Each phase is a self-contained PR with passing typecheck + lint + build.

### Phase 1 — Foundation (this is what I propose to deliver first)

- `docs/result-field-map.md` ✅ (done)
- `docs/implementation-plan.md` ✅ (this file)
- `docs/calculation-rules.md` (formula reference, transcribed from CLAUDE.md + compute.js)
- `packages/compute/` — TS port of `compute.js` with unit tests proving
  parity against `client/scripts/verify-compute.mjs`.
- `backend/` — Express scaffold, Prisma schema as above, migrations, seed
  script (one admin, one Grade-5 exam with thresholds, three students with
  the sample data already in `client/src/data/*.json`), `/api/admin/auth/*`
  endpoints with bcrypt + JWT, and `/api/admin/results` CRUD wired to the
  calculation engine for save-time validation.

### Phase 2 — Result lifecycle

- Code generation service (6 chars, retry on collision).
- Publish endpoint: validates completeness, freezes `calculatedSnapshot`,
  generates code+password, stores hash, returns plain password ONCE.
- Unpublish, archive, reset-password.
- Audit log writes on every state change.
- Public `/api/result/auth/*` + `/api/result/me`.
- Integration tests: invalid login, draft not accessible, session scoping,
  rank recompute on publish.

### Phase 3 — Admin panel

- Next.js scaffold.
- Login, dashboard.
- Students + Exams CRUD.
- Result create/edit wizard, per-subject question grid, manual narrative
  editor, live preview, publish flow (credentials card shown once).
- Settings (admin users, default grading config).
- Audit-log table.

### Phase 4 — Client integration

- `@sodiq/compute` swap in Astro pages (replace `lib/compute.js`).
- Astro hybrid mode + new `/login` route.
- `pages/index.astro`, `english.astro`, `critical-thinking.astro`,
  `summary.astro` read from `/api/result/me` instead of `data/*.json`.
- Replace documented placeholders with real data + null-safe rendering.
- PDF export script updated to use authenticated admin preview URL.

### Phase 5 — Hardening

- e2e Playwright happy path: admin creates result → publishes → public
  login → renders matching PDF.
- Security review (rate limit, scoped session, audit coverage).
- README + `/docs/api.md` + `/docs/implementation-notes.md` polished.
- Production build verification across all three apps.

## What I will NOT do in any phase without explicit approval

- Migrate the Astro client to Next.js.
- Change the brand strings, fonts, palette, or layout rules from CLAUDE.md.
- Hardcode admission verdict per subject (resource says composite-only).
- Fabricate cohort numbers when real data is missing.
- Store plain passwords or expose UUIDs to the public client.

## Estimated effort

Rough, given the depth of `compute.js` and the existing styling:

- Phase 1: ~1 working session (foundation + compute port + tests).
- Phase 2: ~1 session.
- Phase 3: ~2 sessions (admin UI is the biggest piece).
- Phase 4: ~1 session.
- Phase 5: ~0.5 session.

Total: ~5–6 focused sessions, not a single turn.
