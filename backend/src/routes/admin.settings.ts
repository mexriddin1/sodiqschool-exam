// Global settings — currently just the default set of unlocked report
// sections for freshly-created Results. Backed by the Setting key/value
// table so admins can change it without a code deploy.

import { Router } from "express";
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

export const settingsRouter = Router();
settingsRouter.use(requireAdmin);

export const DEFAULT_UNLOCKED_SECTIONS_KEY = "result.defaultUnlockedSections";
const ALLOWED_SECTION_KEYS = ["narrative", "roadmap", "risks_notes"] as const;

/** Read the default-unlocked-sections list, falling back to [] (all closed). */
export async function readDefaultUnlockedSections(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: DEFAULT_UNLOCKED_SECTIONS_KEY } });
  const raw = row?.value;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && (ALLOWED_SECTION_KEYS as readonly string[]).includes(v));
}

settingsRouter.get(
  "/default-unlocked-sections",
  asyncHandler(async (_req, res) => {
    const sections = await readDefaultUnlockedSections();
    ok(res, { sections });
  }),
);

settingsRouter.put(
  "/default-unlocked-sections",
  asyncHandler(async (req, res) => {
    const raw = Array.isArray(req.body?.sections) ? req.body.sections : [];
    const cleaned = Array.from(
      new Set(
        raw
          .filter((v: unknown): v is string => typeof v === "string")
          .filter((v: string) => (ALLOWED_SECTION_KEYS as readonly string[]).includes(v)),
      ),
    ) as string[];
    const prev = await prisma.setting.findUnique({ where: { key: DEFAULT_UNLOCKED_SECTIONS_KEY } });
    const updated = await prisma.setting.upsert({
      where: { key: DEFAULT_UNLOCKED_SECTIONS_KEY },
      create: { key: DEFAULT_UNLOCKED_SECTIONS_KEY, value: cleaned as unknown as Prisma.InputJsonValue },
      update: { value: cleaned as unknown as Prisma.InputJsonValue },
    });
    await audit(
      req.admin!.id, "update", "Setting", DEFAULT_UNLOCKED_SECTIONS_KEY,
      { value: prev?.value ?? null }, { value: updated.value },
    );
    ok(res, { sections: cleaned });
  }),
);

// ---- CLEAR ALL DATA -----------------------------------------------------------
// Deletes Students, Results (→ SubjectResults cascade), and AuditLogs.
// Keeps: AdminUser, Subject, Exam, TestTemplate, Setting.
// Requires body: { confirm: "TOZALASH" } to prevent accidental calls.
settingsRouter.delete(
  "/clear-data",
  asyncHandler(async (req, res) => {
    if (req.body?.confirm !== "TOZALASH") {
      return res.status(400).json({ success: false, error: { message: 'confirm maydoni "TOZALASH" bo\'lishi kerak' } });
    }

    const [auditDel, resultDel, studentDel] = await prisma.$transaction([
      prisma.auditLog.deleteMany({}),
      // Result.onDelete=Cascade on SubjectResult — deleting Result removes SubjectResults automatically.
      prisma.result.deleteMany({}),
      prisma.student.deleteMany({}),
    ]);

    // Write a fresh audit entry so the log isn't empty after the wipe.
    await audit(
      req.admin!.id, "clear-data", "System", "all",
      null,
      { deletedAuditLogs: auditDel.count, deletedResults: resultDel.count, deletedStudents: studentDel.count },
    );

    ok(res, {
      deletedAuditLogs: auditDel.count,
      deletedResults: resultDel.count,
      deletedStudents: studentDel.count,
    });
  }),
);
