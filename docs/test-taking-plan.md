# Test-taking subsystem — remediation plan

Plan for the funnel shipped in `7a6c639 "add new test app"` (test-app,
`public.testtaking.ts`, leads, tests, grading). Written after a design
review on 2026-07-15; supersedes nothing, extends `implementation-notes.md`.

## The premise everything rests on

**The test-taking flow is a lead-gen funnel, not an admission gate.** A lead
fills a form at home, takes a test unproctored, and the score is a hook for a
sales conversation. Nobody is admitted or rejected on it.

This is not derivable from the code — the code looks like a proctored exam
(fullscreen lockdown, answer stripping, `autoSubmitted`). It is the decision
that makes the rest of this plan make sense. Two consequences:

- Cheating is not the threat. The threat is **corrupting our own data** and
  **promising leads things we cannot deliver**.
- Half-built anti-cheat is worse than none — it claims a protection we do not
  have.

## Current state: the funnel is a dead end

Today a completed funnel test delivers nothing. The chain:

1. `POST /submit` builds one `SubjectResult` (the tested subject) and filters
   out the other two.
2. `calculateResult` → `computeComposite` loops all three `SubjectKey`s and
   calls `pick(reports[k])`. `reports.ENGLISH` is `undefined` → **TypeError**.
   Verified by repro: `Cannot read properties of undefined (reading 'percent')`.
3. That call sits in a `try/catch` that logs `snapshot preview failed`, so
   the `Result` is written with `calculatedSnapshot: null`. Silently.
4. `POST /:id/publish` rejects `result.subjects.length !== 3`
   (`MISSING_SUBJECTS`). The result can **never** be published.
5. `done/[token]/page.tsx` tells the student *"Natijangizni ma'muriyat
   tekshirib bo'lganidan so'ng, sizga login va parol beriladi"* — a promise the
   publish gate makes impossible to keep.

Each completed test also leaves an orphan `Result`, a burned `publicCode`, and
a synthetic `LEAD-XXXX` `Student` in the real roster.

## Decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Attempts **merge into one `Result` per (lead, exam)** — upsert `ResultSubject`, don't create a new `Result` per submit | Three subjects assemble into one publishable report. Leaves compute, the publish gate, and the client report untouched. |
| 2 | New **`funnel.examId` setting**; public test list filtered to that exam **and `status: ACTIVE`** | Makes the merge key well-defined. Also closes a leak: the endpoint filtered on grade+language only, so `DRAFT`/`ARCHIVED` exam content was publicly listable. |
| 3 | `funnel.examId` points at a **dedicated funnel exam**; **no `source` flag on `Result`** | `recomputeCohortRanks(examId)` is already exam-scoped, so isolation is free. Leads rank against leads — a better sales line, and honest. |
| 4 | `computeSnapshot` uses **`student.grade`** for thresholds/weights/`gradeLabel`, **plus a guard** that it is in `exam.grades` | Fixes a live split-brain (see below). The guard matters because `thresholdFor` returns `0` for a missing grade row — i.e. every gate silently passes. |
| 5 | Test questions carry an explicit **`templateQuestionId`**; builder slots are generated **from** the template and labeled with topic/strand; validation checks **set equality** | Pedagogy is currently bound by array index with no UI showing the pairing. |
| 6 | **One attempt per (lead, test)**, DB-enforced. Unsubmitted → return existing attempt (resume). Submitted → `ALREADY_SUBMITTED` | Kills score-shopping, makes the merge deterministic, makes mutating a published result structurally impossible. Doubles as a lost-token resume path. |
| 7 | **Normalize phone to E.164**; upsert `Lead` on (phone, firstName, lastName, grade); `localStorage` not `sessionStorage` | One human currently becomes many leads. Name is in the key because siblings share a parent's phone. |
| 8 | **`Student.source: ADMIN \| FUNNEL`**, `FUNNEL` excluded from roster + combobox by default; **widen the uid** | Funnel leads flood the roster. |
| 9 | **`Result.publicCode` / `accessPasswordHash` become nullable**; funnel stops minting legacy credentials; **`Student.loginCode` is the only login**, surfaced on the lead detail page | Per the 2026-07-03 one-login-per-student decision. |
| 10 | Token-keyed limits on `PATCH`/`submit`, per-IP on `/leads`; **autosave dirty check** | `/api/test-taking` has no limiter at all. Token-keying is CGNAT-safe. |
| 11 | Fullscreen stays as UX; **the "exits are recorded" claim is deleted**; **soft server-side expiry** added | The claim is false. The expiry is about report validity, not cheating. |
| 12 | `/tests` shows per-subject progress; the report is **promised only when the 3rd subject lands** | Only make the promise when it can be kept. |

### Why #4 matters beyond the funnel

`backend/src/services/snapshot.ts` uses two different grades:

| Line | Uses | Drives |
| ---- | ---- | ------ |
| 57, 62 | `result.exam.grade` | thresholds, weights, `gradeLabel` |
| 113, 137 | `r.student.grade` | cohort peer selection |

The cohort path was fixed for multi-grade on 2026-07-06; the snapshot path
never was. `Exam.grade` is the legacy field set to the first entry of
`grades`, so on a multi-grade exam **every student is scored as if they were
in the exam's first grade** — wrong thresholds, wrong weights, and a report
that literally prints `"5-sinfga nomzod"` on a grade-8 student's page.

Dormant only because exams have been single-grade so far. **The dedicated
funnel exam spans grades 5–11 by design, so this goes live on day one.**
This bug affects real students on any real multi-grade exam.

## Phases

Each phase is independently shippable. Phase 1 is worth shipping on its own
regardless of the funnel.

### Phase 0 — unblock

- `npm install` — `tsx` is missing, so `npm test --workspace @sodiq/compute`
  cannot run at all. Fix before relying on any test signal.
- Enable `noUnusedLocals` in tsconfig. It would have caught the discarded
  `creds` (see Phase 3).

### Phase 1 — snapshot grade fix (affects real students; no funnel dependency)

1. `computeSnapshot`: pass `result.student.grade` to `calculateResult` and
   `buildMeta` instead of `result.exam.grade`.
2. Guard: throw if `student.grade` is absent from `exam.grades`, rather than
   letting `thresholdFor` return `0` and pass every gate.
3. Regression test: multi-grade exam, two students in different grades, assert
   each gets their own thresholds, weights, and `gradeLabel`.

### Phase 2 — migrations + backfill

Order matters; backfill before adding constraints.

| Change | Backfill risk |
| ------ | ------------- |
| `Student.source` enum, default `ADMIN` | Set `FUNNEL` where `uid LIKE 'LEAD-%'` |
| Widen synthetic uid (full lead UUID) | Existing `LEAD-XXXX` rows stay; new ones widen. `uid` is `@unique` and 8 hex chars ≈ 32 bits → ~1% collision by 10k leads, unhandled `P2002` |
| `Result.publicCode` / `accessPasswordHash` → nullable | None (widening) |
| `TestAttempt @@unique([leadId, testId])` | **Existing duplicate attempts will block the constraint** — dedupe first (keep the submitted one, else earliest) |
| `Lead` — normalized phone + `@@unique([phone, firstName, lastName, grade])` | **Normalize existing phones first**; expect collisions from genuine duplicates — merge them, keeping the lead with attempts |
| `TestQuestion.templateQuestionId` | No DB migration (`Test.questions` is `Json`). Backfill by current index alignment — **document that this assumes existing tests are correctly aligned, which is exactly what we cannot verify** |

### Phase 3 — backend funnel rework (`public.testtaking.ts`)

1. `funnel.examId` setting + reader (mirror `readDefaultUnlockedSections`).
2. `GET /leads/:leadId/tests`: filter to `funnel.examId` and `status: ACTIVE`.
3. Phone normalizer (E.164, `+998…`) in `lib/`; `POST /leads` upserts.
4. `POST /attempts`: return existing unsubmitted attempt; reject submitted.
5. `POST /submit`: find-or-create the `Result` for (lead, funnel exam), upsert
   the `ResultSubject`. **Do not** create a new `Result` per submit.
6. Drop the legacy credential minting. Use the `ensureStudentCredentials`
   return value (currently assigned to `creds` and never read) and return the
   `loginCode` so admin can surface it.
7. Skip the snapshot preview unless all three subjects are present — today it
   throws into a swallowed `try/catch` on every single-subject submit.
8. Soft expiry: reject `PATCH`/`submit` past `startedAt + durationSec + grace`.
9. Rate limiters: token-keyed on `PATCH`/`submit`, per-IP on `/leads` and
   `/attempts`.

### Phase 4 — admin

1. Roster list + student combobox: exclude `source = FUNNEL` by default, with
   an opt-in toggle.
2. Lead detail page: show the student's `loginCode` + password — the thing
   reception is supposed to hand over.
3. `QuestionBuilder`: render one slot per template question, labeled with its
   topic/strand; no add/remove; store `templateQuestionId`. Replace
   `assertQuestionCountMatchesTemplate` with set-equality validation.

### Phase 5 — test-app

1. `sessionStorage` → `localStorage` for `sodiq_lead_id`.
2. Autosave: add a dirty check and **fix the `answers`-in-deps bug**. Today the
   effect rebuilds its interval on every answer change, so a student typing
   continuously saves *nothing* until they pause 5s, while an idle student
   writes the full payload 12×/min.
3. Delete the false claim: *"Chiqishga urunish tizim tomonidan qayd
   qilinadi."* Nothing is recorded — no handler, no column.
4. `/tests`: per-subject progress. `done`: "X of 3 complete"; promise the
   report only on the third.

### Phase 6 — tests

- Unit: phone normalization, attempt uniqueness/resume, subject merge, soft
  expiry, `templateQuestionId` set-equality validation.
- Regression: single-subject submit does not throw and does not write a
  half-built snapshot.
- E2E: lead → 3 subjects → assembled draft → publish → login → report.

## Non-issues (investigated, dismissed)

- **Cohort pollution from funnel results.** Blocked by the 3-subject publish
  gate; a funnel result can never reach `recomputeCohortRanks`. This was the
  original reason for a `source` flag on `Result` — dropped once measured.
- **The MATCHING "deterministic shuffle".** Looks broken (sorts on
  `id.charCodeAt(0) % 13`) but measures fine with real
  `Math.random().toString(36)` ids: 1.09 rights left in the correct slot out
  of 5, vs ~1.00 for Fisher-Yates. Not an answer leak. The determinism is
  intentional and required for refresh-safety. **Leave it alone.**

## Residual risks (accepted)

- A determined lead can fake a phone number and re-sit. Acceptable at
  lead-gen stakes; the alternative is SMS OTP.
- `leadId` is a bearer token in the URL (`/tests?lead=<uuid>`) — it leaks via
  history and `Referer`. Anyone with the link sees the lead's name and can
  start attempts as them.
- Plaintext `accessPassword` storage stays — deliberate, reception reads it
  to parents.
- Fullscreen is not enforced and tab-switching is not observed. By design.

## Out of scope — file separately

- **`/api/result` (student login) has no rate limiter**, while `admin.auth`
  does. `loginCode` is structured (`<LastInit><FirstInit><UID>`) and partly
  guessable. This affects real students and parents, not the funnel.
