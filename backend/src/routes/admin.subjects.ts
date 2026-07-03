// Fanlar (Subject) admin section — CRUD for the pickable subjects list.
// Backed by SubjectKey enum so existing Result rows keep validating; the
// UI can rename display labels or hide subjects without a schema migration.

import { Router } from "express";
import { z } from "zod";
import type { SubjectKey } from "@prisma/client";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

const LEGACY_KEYS: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
const DEFAULT_NAMES: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

// Free-form key — uppercase snake_case by convention (PHYSICS, HISTORY, ...)
// so URLs and code paths remain ASCII-safe. Enforced via regex.
const KEY_REGEX = /^[A-Z][A-Z0-9_]{1,31}$/;
const createSchema = z.object({
  key: z.string().regex(KEY_REGEX, "Kalit: faqat lotin harflar (A-Z), raqamlar va _ ; katta harf bilan boshlansin"),
  name: z.string().min(1),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export const subjectsRouter = Router();
subjectsRouter.use(requireAdmin);

// Seed default rows the first time the list is asked for, so the admin UI
// isn't empty on a fresh install. Idempotent — only creates missing keys.
async function ensureDefaults() {
  const count = await prisma.subject.count();
  if (count > 0) return;
  await prisma.subject.createMany({
    data: LEGACY_KEYS.map((key, i) => ({ key, name: DEFAULT_NAMES[key], order: i })),
    skipDuplicates: true,
  });
}

subjectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await ensureDefaults();
    const list = await prisma.subject.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    ok(res, list);
  }),
);

subjectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const exists = await prisma.subject.findUnique({ where: { key: data.key } });
    if (exists) throw conflict("Subject with this key already exists");
    const created = await prisma.subject.create({
      data: { key: data.key, name: data.name, order: data.order ?? 0, active: data.active ?? true },
    });
    await audit(req.admin!.id, "create", "Subject", created.id, null, created);
    ok(res, created);
  }),
);

subjectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = updateSchema.parse(req.body);
    const prev = await prisma.subject.findUnique({ where: { id } });
    if (!prev) throw notFound();
    const updated = await prisma.subject.update({ where: { id }, data });
    await audit(req.admin!.id, "update", "Subject", id, prev, updated);
    ok(res, updated);
  }),
);

subjectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.subject.findUnique({ where: { id } });
    if (!prev) throw notFound();
    // Belt-and-braces: for legacy enum keys, refuse deletion if any
    // SubjectResult references them so historical reports don't break. New
    // free-form keys are never referenced by SubjectResult yet, so they
    // can be deleted freely.
    if ((LEGACY_KEYS as string[]).includes(prev.key)) {
      const usage = await prisma.subjectResult.count({ where: { subject: prev.key as SubjectKey } });
      if (usage > 0) {
        throw badRequest("SUBJECT_IN_USE", `${usage} ta natija bu fandan foydalanmoqda — o'chirilmaydi. Uni "faol emas" (active=false) qilib qo'ying.`);
      }
    }
    await prisma.subject.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "Subject", id, prev, null);
    ok(res, { deleted: true });
  }),
);
