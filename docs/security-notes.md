# Security notes

## Threat model

- **Adversary:** an attacker who has guessed or scraped a `publicCode`, or who
  has visited the report site as a random visitor. Not assumed to have stolen
  cookies, JWT secrets, or DB access.
- **Asset:** a student's individual diagnostic result (PII + grades).
- **Goal:** prevent unauthorised access to results other than your own,
  prevent enumeration of valid `publicCode`s, prevent admin takeover.

## Controls

### Authentication

- Admin: bcrypt-hashed passwords (cost 12 by default), JWT in `sodiq_admin`
  httpOnly cookie, role check on every admin route.
- Public result: 6-char `publicCode` + bcrypt-hashed `accessPassword`. Code
  excludes the ambiguous chars `O 0 I 1` (30^6 ≈ 730M space; collision-free
  via DB retry).
- Login returns a **generic** error for both invalid-code and
  invalid-password (no enumeration).
- Public login is rate-limited to 6 attempts / 15 min / IP. Limiter does NOT
  include the code in its key — that would let an attacker rotate codes to
  reset the counter.

### Authorization

- Public sessions are scoped to a single `resultId` (embedded in the JWT
  `sub`). `/api/result/me` only reads the result identified by the session;
  there is no path that accepts an arbitrary result ID from the client.
- Public client (Astro) never receives raw UUIDs. The Astro server holds the
  session token in its own `sodiq_client_token` cookie and forwards it as
  `Authorization: Bearer` to the backend.
- Admin role gate: routes that require `ADMIN` use `requireRole("ADMIN")`;
  EDITOR cannot manage admin accounts (Phase 6 work — admin user CRUD).

### Status gating

- `/api/result/me` rejects unless `status === PUBLISHED`. DRAFT and ARCHIVED
  are inaccessible to the public client.
- Publishing freezes `calculatedSnapshot`. Editing a published result requires
  re-publish (Phase 6: explicit "re-publish" flag).

### Data exposure

- `accessPasswordHash` is never returned in any API response.
- The plain access password is shown exactly once: at create-time and on
  reset-password. It cannot be recovered later — admin must reset.
- Audit log records create / update / publish / unpublish / archive / reset
  events with `adminUserId`, action, and prev/next snapshots. Audit data is
  admin-only.

### Transport / headers

- Helmet enabled (default policy).
- CORS allows `CORS_ORIGINS` from env only — no `*` in production.
- Cookies: `httpOnly`, `sameSite=lax`, `secure` in production via
  `COOKIE_SECURE=true`.
- Request body size capped at 1 MB.

### Input validation

- Zod schemas at every route boundary (`src/lib/schemas.ts`).
- `validateQuestions` enforces per-question invariants (`earned ≤ marks`,
  `errorType === null` for correct answers, no duplicate IDs).
- All score writes pass through `calculateResult` so the calculation engine
  rejects internally inconsistent data **before** persisting.

## Residual risks / future work

1. **No CSRF tokens.** Currently relying on `sameSite=lax` cookies + JSON-only
   POST bodies. If admin starts accepting form posts, add CSRF tokens.
2. **No admin account lockout.** Add a counter on `adminUser.passwordHash`
   misses (e.g. 10/hour) before exposing admin login publicly.
3. **No session revocation list.** Logout clears the cookie but doesn't
   invalidate the JWT. Consider rotating `ADMIN_JWT_SECRET` on suspected
   compromise.
4. **Audit log isn't append-only.** Stored in the same Postgres DB; an
   attacker with DB write can rewrite history. Forward critical events to an
   external sink (e.g. a separate WORM bucket) for high-stakes deployments.
5. **Astro session token storage.** Token is held in the Astro server's cookie
   (`sodiq_client_token`). If the Astro server is multi-instance behind a load
   balancer, the cookie still works because the JWT is self-contained — no
   sticky sessions needed.
6. **Rate limit on result code login.** 6/15-min per IP is forgiving for
   shared NATs (schools, families). Tune for the deployment context.
