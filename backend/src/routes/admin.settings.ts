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
export const CONTACT_PHONE_KEY = "contact.phone";
const ALLOWED_SECTION_KEYS = ["narrative", "roadmap", "risks_notes"] as const;

/** Read the school contact phone, falling back to empty string. */
export async function readContactPhone(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: CONTACT_PHONE_KEY } });
  const raw = row?.value;
  return typeof raw === "string" ? raw : "";
}

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

// ---- CONTACT PHONE -----------------------------------------------------------
// Maktabning umumiy aloqa raqami. Yopiq bo'lim kartasida va sahifadagi
// "Bog'lanish" tugmasida ishlatiladi. Sozlamalar → foydalanuvchi ochiq matn
// kiritadi; raqam formatidan cheklov qo'yilmagan (xalqaro, mahalliy, ichki).

settingsRouter.get(
  "/contact-phone",
  asyncHandler(async (_req, res) => {
    const phone = await readContactPhone();
    ok(res, { phone });
  }),
);

settingsRouter.put(
  "/contact-phone",
  asyncHandler(async (req, res) => {
    const raw = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const prev = await prisma.setting.findUnique({ where: { key: CONTACT_PHONE_KEY } });
    const updated = await prisma.setting.upsert({
      where: { key: CONTACT_PHONE_KEY },
      create: { key: CONTACT_PHONE_KEY, value: raw as unknown as Prisma.InputJsonValue },
      update: { value: raw as unknown as Prisma.InputJsonValue },
    });
    await audit(
      req.admin!.id, "update", "Setting", CONTACT_PHONE_KEY,
      { value: prev?.value ?? null }, { value: updated.value },
    );
    ok(res, { phone: raw });
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
