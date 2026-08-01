# Security notes

## ⚠️ 2026-08-01: hisobot amalda OCHIQ

Ota-onalar kirish kodi va parolini yo'qotib qo'yishgani uchun client saytga
**familya + ism + sinf** bilan kirish qo'shildi
(`POST /api/result/auth/lookup`). Bu — qidiruv, autentifikatsiya emas: ism,
familya va sinf sir emas, ya'ni **sinfdoshining ismini bilgan har kim uning
to'liq diagnostika hisobotini ocha oladi.**

Bu ataylab qabul qilingan qaror (foydalanuvchi tasdig'i bilan) — quyidagi
"Threat model" endi faqat eski kod+parol yo'liga taalluqli. Amaldagi
cheklovlar:

- `authLimiter` — 10 daqiqada 30 ta **muvaffaqiyatsiz** urinish / IP. Faqat
  xatolar sanaladi, chunki mobil CGNAT ortida yuzlab haqiqiy ota-ona bo'lishi
  mumkin. Ismni taxmin qilib sanab chiqish shu bilan cheklanadi.
- Natijasi yo'q o'quvchi qidiruvga umuman tushmaydi — mavjudligi oshkor
  bo'lmaydi.
- Sessiya faqat mos kelgan `studentId` lar bilan chegaralangan; begona
  `?resultId=` bilan boshqa o'quvchining hisobotini ochib bo'lmaydi
  (`assertOwned`, `public.result.ts`).

Agar keyinchalik yopish kerak bo'lsa, eng arzon ikkinchi omil — **telefon
oxirgi 4 raqami**: funnel orqali kelgan o'quvchilarda telefon E.164 formatda
saqlanadi. CSV import qilingan eski o'quvchilarda telefon yo'q — ular uchun
boshqa yechim kerak bo'ladi.

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
- Public login (`/auth/login`) va ism qidiruvi (`/auth/lookup`) bitta
  `authLimiter` ostida: 10 daqiqada 30 ta muvaffaqiyatsiz urinish / IP.
  Limiter kalitida kod/ism YO'Q — aks holda hujumchi kodni almashtirib
  hisoblagichni nolga tushirib turardi.

### Authorization

- Public sessions are scoped to the student(s) resolved at login — the JWT
  carries `kind: "student"` (bitta `studentId`) yoki `kind: "students"`
  (`ids[]`, familya+ism qidiruvi bir nechta yozuvni topganda). Eski tokenlarda
  `sub` = `resultId`. `/api/result/me` klientdan `?resultId=` qabul qiladi,
  lekin `assertOwned` uni sessiyadagi ro'yxat bilan solishtiradi — begona
  natija 404 qaytaradi.
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
6. **Rate limit on result login.** 30 xato/10-min per IP; muvaffaqiyatli
   so'rovlar sanalmaydi (CGNAT). Deployment kontekstiga qarab moslang.
7. **Ism bo'yicha kirish — eng katta qoldiq risk.** Yuqoridagi ogohlantirishga
   qarang: hisobot ism+familya+sinf bilan ochiladi.
