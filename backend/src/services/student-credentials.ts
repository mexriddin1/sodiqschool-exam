// Student login/parol boshqarish. Har student uchun bir marta yaratiladi;
// keyingi natijalar mavjud kredensialdan foydalanadi.

import bcrypt from "bcryptjs";
import { generatePassword } from "@sodiq/compute";

import { prisma } from "../db.js";
import { config } from "../config.js";

/**
 * Login format: `<Familya[0]><Ism[0]><UID>`. Familya yoki ism bosh harfi
 * yo'q bo'lsa fullName'ning ikki so'zidan olib qo'yiladi; UID bo'lmasa
 * student.id ni suffix qilamiz — noyoblik shu bilan kafolatlanadi.
 */
export function buildStudentLoginCode(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  uid?: string | null;
  fallbackId: string;
}): string {
  const clean = (s: string | null | undefined) => (s ?? "").trim();
  let first = clean(input.firstName);
  let last = clean(input.lastName);
  if (!first || !last) {
    const parts = clean(input.fullName).split(/\s+/).filter(Boolean);
    if (!first && parts[0]) first = parts[0];
    if (!last && parts.length >= 2) last = parts.slice(1).join(" ");
  }
  const li = last.charAt(0).toUpperCase() || "X";
  const fi = first.charAt(0).toUpperCase() || "X";
  const suffix = clean(input.uid) || input.fallbackId.replace(/-/g, "").slice(-8).toUpperCase();
  return `${li}${fi}${suffix}`;
}

/**
 * Faqat ushbu student uchun mavjud bo'lmagan noyob loginCode topadi.
 * Odatiy holda buildStudentLoginCode natijasi qaytariladi; kollisiyada
 * "-2", "-3", ... prefiks qo'shiladi.
 */
export async function ensureUniqueLoginCode(base: string, excludeStudentId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  // Cheklov — 20 urunish yetadi, chunki UID kollision juda kam.
  for (let i = 0; i < 20; i++) {
    const existing = await prisma.student.findFirst({
      where: {
        loginCode: candidate,
        ...(excludeStudentId ? { NOT: { id: excludeStudentId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
    n++;
  }
  // Juda ehtimoli kam holat — random suffix bilan yakunlash.
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Studentga tegishli login va parolni ta'minlaydi. Agar ular allaqachon
 * yozilgan bo'lsa — hech nima qilmaydi; aks holda avtomatik yaratadi.
 * Yangi parol yaratilgan bo'lsa plain-text qiymatini ham qaytaradi
 * (admin panelda ko'rsatish uchun).
 */
export async function ensureStudentCredentials(studentId: string): Promise<{
  loginCode: string;
  plainPassword: string | null; // mavjud parolni ham qaytaradi (DB'da saqlanadi)
  generated: boolean;             // true → ushbu chaqiruvda ilk marta yaratildi
}> {
  const st = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, firstName: true, lastName: true, fullName: true, uid: true,
      loginCode: true, accessPassword: true, accessPasswordHash: true,
    },
  });
  if (!st) throw new Error(`Student not found: ${studentId}`);
  if (st.loginCode && st.accessPasswordHash) {
    // Mavjud kredensiallar. accessPassword plaintext DB'da saqlanmoqda —
    // uni qayta qaytaramiz (admin har safar ko'ra oladi), yangi parol yaratilmaydi.
    return {
      loginCode: st.loginCode,
      plainPassword: st.accessPassword ?? null,
      generated: false,
    };
  }

  const baseCode = buildStudentLoginCode({
    firstName: st.firstName,
    lastName: st.lastName,
    fullName: st.fullName,
    uid: st.uid,
    fallbackId: st.id,
  });
  const loginCode = st.loginCode ?? (await ensureUniqueLoginCode(baseCode, st.id));
  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, config.bcryptCost);
  await prisma.student.update({
    where: { id: st.id },
    data: {
      loginCode,
      accessPassword: plainPassword,
      accessPasswordHash: passwordHash,
    },
  });
  return { loginCode, plainPassword, generated: true };
}
