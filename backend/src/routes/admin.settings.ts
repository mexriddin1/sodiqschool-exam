// Global settings — currently just the default set of unlocked report
// sections for freshly-created Results. Backed by the Setting key/value
// table so admins can change it without a code deploy.

import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { config } from "../config.js";
import { asyncHandler, ok } from "../lib/response.js";
import { badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

export const settingsRouter = Router();
settingsRouter.use(requireAdmin);

export const DEFAULT_UNLOCKED_SECTIONS_KEY = "result.defaultUnlockedSections";
export const CONTACT_PHONE_KEY = "contact.phone";
export const FUNNEL_OPEN_KEY = "funnel.open";
export const FUNNEL_PASSWORD_KEY = "funnel.password";
const ALLOWED_SECTION_KEYS = ["narrative", "roadmap", "risks_notes"] as const;

/** Read the school contact phone, falling back to empty string. */
export async function readContactPhone(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: CONTACT_PHONE_KEY } });
  const raw = row?.value;
  return typeof raw === "string" ? raw : "";
}

/**
 * Qabul testi ochiqmi (test.sodiqschool.uz).
 *
 * Standart — YOPIQ. Sayt ochiq internetda turadi va hech qanday kirish
 * cheklovi yo'q: ochiq bo'lsa, havolani bilgan istalgan odam istalgan
 * qurilmadan qabul testini topshira oladi. Shuning uchun sozlama yo'q
 * bo'lsa (masalan yangi o'rnatishda) yopiq deb hisoblaymiz — admin uni
 * imtihon kuni ataylab ochadi.
 */
export async function readFunnelOpen(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: FUNNEL_OPEN_KEY } });
  return row?.value === true;
}

/**
 * Qabul testi paroli — maktab laptoplari uchun umumiy kirish paroli.
 *
 * `version` — parol har o'zgarganda yangilanadi va kirish tokeni ichiga
 * yoziladi. Ya'ni parolni almashtirish = barcha qurilmalarni chiqarib
 * yuborish. Bu yagona bekor qilish (revoke) usuli, chunki tokenlar bazada
 * saqlanmaydi.
 *
 * Parol o'rnatilmagan bo'lsa — `null`, va kirish paroli so'ralmaydi
 * (faqat ochiq/yopiq tugmasi ishlaydi).
 */
export interface FunnelPassword {
  hash: string;
  /**
   * Parol OCHIQ matnda ham saqlanadi — xodim uni admin panelda ko'rib,
   * laptoplarga ko'chiradi. Aks holda parolni faqat qo'ygan odam bilardi va
   * unutilsa almashtirishdan boshqa yo'l qolmasdi (bu esa kirgan qurilmalarni
   * chiqarib yuboradi).
   *
   * Ayni naqsh loyihada allaqachon bor: `Result.accessPassword` ham ochiq
   * saqlanadi, chunki qabulxona uni ota-onaga o'qib beradi.
   *
   * Narxi: admin panelga yoki bazaga kirgan har kim parolni ko'radi. Bu —
   * maktab laptoplari uchun umumiy parol, shaxsiy hisob emas.
   */
  plain: string;
  version: string;
  updatedAt: string;
}

export async function readFunnelPassword(): Promise<FunnelPassword | null> {
  const row = await prisma.setting.findUnique({ where: { key: FUNNEL_PASSWORD_KEY } });
  const v = row?.value as Partial<FunnelPassword> | undefined;
  if (!v || typeof v.hash !== "string" || typeof v.version !== "string") return null;
  return {
    hash: v.hash,
    plain: typeof v.plain === "string" ? v.plain : "",
    version: v.version,
    updatedAt: String(v.updatedAt ?? ""),
  };
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

// ---- QABUL TESTI: OCHIQ / YOPIQ ----------------------------------------------
// test.sodiqschool.uz ochiq internetda va kirish cheklovi yo'q. Ochiq bo'lsa,
// havolani bilgan har kim istalgan qurilmadan qabul testini topshira oladi.
// Shu tugma — yagona to'siq: imtihon kuni ochiladi, tugagach yopiladi.

settingsRouter.get(
  "/funnel-open",
  asyncHandler(async (_req, res) => {
    ok(res, { open: await readFunnelOpen() });
  }),
);

settingsRouter.put(
  "/funnel-open",
  asyncHandler(async (req, res) => {
    const open = req.body?.open === true;
    const prev = await prisma.setting.findUnique({ where: { key: FUNNEL_OPEN_KEY } });
    const updated = await prisma.setting.upsert({
      where: { key: FUNNEL_OPEN_KEY },
      create: { key: FUNNEL_OPEN_KEY, value: open as unknown as Prisma.InputJsonValue },
      update: { value: open as unknown as Prisma.InputJsonValue },
    });
    // Audit MUHIM: "kim ochib qo'ygan / kim yopgan" degan savol imtihon
    // kunida albatta chiqadi.
    await audit(
      req.admin!.id, "update", "Setting", FUNNEL_OPEN_KEY,
      { value: prev?.value ?? null }, { value: updated.value },
    );
    ok(res, { open });
  }),
);

// ---- QABUL TESTI PAROLI -------------------------------------------------------
// Maktab laptoplariga bir marta kiritiladi va qurilma chiqmaguncha esda qoladi.
// Parolning o'zi HECH QACHON qaytarilmaydi — faqat o'rnatilgan/yo'qligi.

settingsRouter.get(
  "/funnel-password",
  asyncHandler(async (_req, res) => {
    const p = await readFunnelPassword();
    // Parol ochiq qaytariladi — bu marshrut requireAdmin ostida (fayl
    // boshidagi settingsRouter.use), ya'ni faqat tizimga kirgan admin ko'radi.
    ok(res, { set: p !== null, password: p?.plain ?? "", updatedAt: p?.updatedAt ?? null });
  }),
);

const MIN_FUNNEL_PASSWORD = 6;

settingsRouter.put(
  "/funnel-password",
  asyncHandler(async (req, res) => {
    const raw = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (raw.length < MIN_FUNNEL_PASSWORD) {
      throw badRequest(
        "PASSWORD_TOO_SHORT",
        `Parol kamida ${MIN_FUNNEL_PASSWORD} belgidan iborat bo'lsin.`,
      );
    }
    const value: FunnelPassword = {
      hash: await bcrypt.hash(raw, config.bcryptCost),
      plain: raw,
      // Yangi versiya — eski qurilmalardagi tokenlar shu bilan bekor bo'ladi.
      version: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    const prev = await prisma.setting.findUnique({ where: { key: FUNNEL_PASSWORD_KEY } });
    await prisma.setting.upsert({
      where: { key: FUNNEL_PASSWORD_KEY },
      create: { key: FUNNEL_PASSWORD_KEY, value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    // Audit'ga parol ham, hash ham YOZILMAYDI — faqat o'zgargani.
    await audit(
      req.admin!.id, "update", "Setting", FUNNEL_PASSWORD_KEY,
      { set: prev !== null }, { set: true },
    );
    ok(res, { set: true, password: raw, updatedAt: value.updatedAt });
  }),
);

settingsRouter.delete(
  "/funnel-password",
  asyncHandler(async (req, res) => {
    await prisma.setting.deleteMany({ where: { key: FUNNEL_PASSWORD_KEY } });
    await audit(req.admin!.id, "update", "Setting", FUNNEL_PASSWORD_KEY, { set: true }, { set: false });
    ok(res, { set: false, password: "", updatedAt: null });
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
