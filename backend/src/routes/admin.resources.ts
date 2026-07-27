// Roadmap learning resources (LearningResource) admin CRUD. Replaces the
// hardcoded packages/compute/src/data/resources.json — the school manages
// resources from the panel. Mirrors admin.subjects.ts conventions.

import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

const SUBJECT = z.enum(["MATH", "ENGLISH", "CRITICAL_THINKING"]);
const LANG = z.enum(["uz", "en"]);
const TYPE = z.enum(["video", "platform", "book", "channel", "app"]);

// `topic` is a canonical topic name, or the reserved keys "_default"
// (subject-wide) / "_nextLevel" (A→B stage). Free text — the roadmap only
// attaches it when it matches a canonical topic, else falls back to _default.
const createSchema = z.object({
  subject: SUBJECT,
  topic: z.string().min(1),
  lang: LANG,
  type: TYPE,
  title: z.string().min(1),
  provider: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  note: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});
const updateSchema = z.object({
  subject: SUBJECT.optional(),
  topic: z.string().min(1).optional(),
  lang: LANG.optional(),
  type: TYPE.optional(),
  title: z.string().min(1).optional(),
  provider: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  note: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export const resourcesRouter = Router();
resourcesRouter.use(requireAdmin);

resourcesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const subject = SUBJECT.safeParse(req.query.subject);
    const list = await prisma.learningResource.findMany({
      where: subject.success ? { subject: subject.data } : undefined,
      orderBy: [{ subject: "asc" }, { topic: "asc" }, { lang: "asc" }, { order: "asc" }],
    });
    ok(res, list);
  }),
);

resourcesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const created = await prisma.learningResource.create({
      data: {
        subject: data.subject,
        topic: data.topic.trim(),
        lang: data.lang,
        type: data.type,
        title: data.title.trim(),
        provider: data.provider?.trim() || null,
        url: data.url?.trim() || null,
        note: data.note?.trim() || null,
        order: data.order ?? 0,
        active: data.active ?? true,
      },
    });
    await audit(req.admin!.id, "create", "LearningResource", created.id, null, created);
    ok(res, created);
  }),
);

resourcesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = updateSchema.parse(req.body);
    const prev = await prisma.learningResource.findUnique({ where: { id } });
    if (!prev) throw notFound();
    const updated = await prisma.learningResource.update({
      where: { id },
      data: {
        ...data,
        topic: data.topic?.trim(),
        title: data.title?.trim(),
        // Empty-string clears the optional column; undefined leaves it as-is.
        provider: data.provider === undefined ? undefined : data.provider.trim() || null,
        url: data.url === undefined ? undefined : data.url.trim() || null,
        note: data.note === undefined ? undefined : data.note.trim() || null,
      },
    });
    await audit(req.admin!.id, "update", "LearningResource", id, prev, updated);
    ok(res, updated);
  }),
);

resourcesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.learningResource.findUnique({ where: { id } });
    if (!prev) throw notFound();
    await prisma.learningResource.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "LearningResource", id, prev, null);
    ok(res, { deleted: true });
  }),
);
