# Sodiq School — Exam Result System

Per-student academic diagnostic report (Math · English · Critical Thinking)
with a backend, an admin panel, and a public student-facing report.

The data flow:

```
Admin enters per-question labels in JSON
            ↓
Backend validates labels + runs the shared diagnostic engine
            ↓
Admin publishes → backend freezes the calculated snapshot,
                  generates a 6-char publicCode + password (shown once),
                  recomputes cohort rank across published peers
            ↓
Student logs in with publicCode + password
            ↓
Astro server-rendered report renders Math / English /
  Critical Thinking / Summary pages from /api/result/me
```

## Apps

| App      | Stack                                | Port   |
| -------- | ------------------------------------ | ------ |
| backend  | Express · Prisma · PostgreSQL         | 4000   |
| admin    | Next.js 14 (App Router) · Tailwind    | 3000   |
| client   | Astro (hybrid SSR via @astrojs/node)  | 4321   |

## Setup

```bash
# from repo root
npm install

cp backend/.env.example backend/.env
# edit DATABASE_URL + JWT secrets
```

### Database

If you don't have a Postgres server handy, the backend ships an embedded
Postgres for dev/smoke purposes — no system install required:

```bash
npm run pg --workspace backend          # downloads (~250 MB once) + boots
                                        # port 54399; data in backend/.pg-data
                                        # Ctrl-C to stop
```

The script prints the `DATABASE_URL` to paste into `backend/.env`. Otherwise
point `DATABASE_URL` at any Postgres 14+ you already run.

Then in a separate terminal:

```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate  --workspace backend
npm run seed            --workspace backend
```

Seed prints the admin email + password and a 6-character `publicCode` +
password for each sample student. Save them — passwords are bcrypt-hashed.

### Run dev

Three terminals:

```bash
# backend
npm run dev --workspace backend         # http://localhost:4000

# admin
cp admin/.env.example admin/.env
npm run dev --workspace admin           # http://localhost:3000

# client
cp client/.env.example client/.env
npm --workspace client run dev          # http://localhost:4321
```

### Production build

```bash
npm run build         --workspace @sodiq/compute
npm run build         --workspace backend
npm run build         --workspace admin
npm --workspace client run build
```

## End-to-end smoke flow

1. Open `http://localhost:3000`, log in as the seed admin.
2. Go to **Imtihonlar**, confirm the seed exam exists.
3. Go to **Natijalar → Yangi natija**:
   - Pick a student + exam.
   - Paste `client/src/data/student.json` into MATH (full file or just
     `{ "questions": [...] }`).
   - Paste `english.json` into ENGLISH, `critical-thinking.json` into CT.
   - Fill the three narrative fields.
   - Click **Yaratish** — credentials appear once. Copy them.
4. Open the result detail page → **Nashr etish**.
5. Open `http://localhost:4321/login`, enter the publicCode + password.
6. You should land on the math report; navigate to `/english`,
   `/critical-thinking`, `/summary`. PDF export still works via the existing
   `client/scripts/export-pdf.mjs` against the running server.

## Tests

```bash
npm test --workspace @sodiq/compute    # 10 tests on the compute engine
npm test --workspace backend           # 3 tests on the publish gate + code generator

# End-to-end (requires all 3 servers up + a seeded DB)
npm install --workspace e2e
npx --workspace e2e playwright install chromium
npm test --workspace e2e               # 1 happy-path scenario
```

## Docs

- `docs/result-field-map.md` — every UI field, classified AUTO / DERIVED / MANUAL / STATIC / CONFIG / PLACEHOLDER.
- `docs/calculation-rules.md` — every formula (KDI, mastery, adjusted, potential, gap zones, growth, admission gate).
- `docs/api.md` — endpoint reference.
- `docs/security-notes.md` — threat model + controls + residual risks.
- `docs/implementation-plan.md` — phased plan (already executed Phase 1–5).
- `docs/implementation-notes.md` — decisions, assumptions, known gaps for the next iteration.
- `docs/test-taking-plan.md` — test-taking funnel: design decisions + phased remediation plan.
- `docs/json-namunalar.md` — test savollarini JSON bilan kiritish: har 6 tur uchun namuna (3 tilli).
