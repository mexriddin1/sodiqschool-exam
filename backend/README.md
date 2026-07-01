# Sodiq School — Backend

Express + Prisma + PostgreSQL service for the exam result system.

## Setup

```bash
# from repo root
npm install

cp backend/.env.example backend/.env
# edit DATABASE_URL + JWT secrets

npm run prisma:generate --workspace backend
npm run prisma:migrate  --workspace backend    # creates the schema
npm run seed            --workspace backend    # one admin + sample data
npm run dev             --workspace backend    # http://localhost:4000
```

The seed prints the admin login + the 6-character `publicCode` and password
for each sample student. Save them — passwords are bcrypt-hashed, so the plain
value can't be retrieved later.

## What's in Phase 1 (this PR)

- Prisma schema (AdminUser, Student, Exam, Result, SubjectResult, AuditLog).
- Auth: `/api/admin/auth/{login,logout,me}` with bcrypt + JWT cookies.
- CRUD: `/api/admin/students`, `/api/admin/exams`, `/api/admin/results`.
- Calculation engine via the shared `@sodiq/compute` package (KDI, mastery,
  composite verdict, admission thresholds from `resource/result.text`).
- `/api/admin/results` validates per-question labels on save and computes the
  full report so calculation errors are caught **before** persistence.
- One-time credential reveal on result creation.

## What's not in Phase 1

- Public student-result login (`/api/result/*`) and the scoped session — Phase 2.
- Publish / unpublish / archive / reset-password lifecycle — Phase 2.
- Admin panel UI — Phase 3.
- Client integration — Phase 4.

## Endpoints (current)

```
POST   /api/admin/auth/login           { email, password }
POST   /api/admin/auth/logout
GET    /api/admin/auth/me

GET    /api/admin/students?q=&grade=
POST   /api/admin/students
GET    /api/admin/students/:id
PATCH  /api/admin/students/:id
DELETE /api/admin/students/:id

GET    /api/admin/exams?grade=
POST   /api/admin/exams
GET    /api/admin/exams/:id
PATCH  /api/admin/exams/:id
DELETE /api/admin/exams/:id

GET    /api/admin/results?examId=&status=&q=
POST   /api/admin/results           → returns { result, credentials } once
GET    /api/admin/results/:id
PATCH  /api/admin/results/:id
GET    /api/admin/results/:id/preview
```

All responses: `{ success: true, data }` or `{ success: false, error: { code, message, fields } }`.
