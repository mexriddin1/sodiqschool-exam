// Faza 1 regressiyasi — admin navigatsiyasi.
//
// Bildirilgan xato: lead'ning natijasini ochib "orqaga" bosilsa, lead o'rniga
// natijalar ro'yxatiga tashlardi. Sababi: results/[id] dagi "← Natijalar"
// havolasi qattiq yozilgan edi (endi `?from=` orqali hal qilinadi).
//
// Bu sahifalar ma'lumotni klient tomonda yuklaydi (`if (!r) return
// "Yuklanmoqda…"`), ya'ni orqaga havolasi SSR HTML'da umuman yo'q —
// haqiqiy brauzersiz tekshirib bo'lmaydi.
//
// Talab: backend (4000) + admin (3000) ishlab tursin, baza seed qilingan
// bo'lsin (`npm run seed` && `npm run seed:mock --workspace backend`).
//
// DIQQAT: backend'da login cheklovi bor — 10 urinish / 15 daqiqa / IP
// (admin.auth.ts). Shuning uchun butun fayl uchun BIR MARTA login qilamiz va
// cookie'ni har testga in'ektsiya qilamiz. Har testda qayta login qilinsa
// suite o'zi-o'zidan flaky bo'ladi.

import { test, expect, type APIRequestContext } from "@playwright/test";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3000";
const API = process.env.BACKEND_URL ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@sodiq.uz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!2025";
const ADMIN_COOKIE = "sodiq_admin"; // backend/src/middleware/auth.ts

let adminCookie = "";
let seeded: { leadId: string; resultId: string };

// Funnel orqali haqiqiy lead + urinish + natija. Auth talab qilmaydi —
// bular ochiq endpoint'lar. `request` ishlatamiz: brauzerdan fetch qilinsa
// CORS'ga tushadi (about:blank origin'i "null").
async function seedLeadWithResult(request: APIRequestContext) {
  const post = async (p: string, data: unknown) => {
    const res = await request.post(API + p, { data });
    expect(res.ok(), `${p} -> ${res.status()}`).toBeTruthy();
    return (await res.json()).data;
  };

  const { leadId } = await post("/api/test-taking/leads", {
    firstName: "Navigatsiya", lastName: "Sinovi", sex: "MALE",
    phone: "+998900000042", grade: 5, examLanguage: "UZ",
  });
  const listRes = await request.get(`${API}/api/test-taking/leads/${leadId}/tests`);
  const tests = (await listRes.json()).data.items as { id: string; subject: string }[];
  const testId = tests.find((t) => t.subject === "CRITICAL_THINKING")!.id;
  const attempt = await post("/api/test-taking/attempts", { leadId, testId });
  const submitted = await post(`/api/test-taking/attempts/${attempt.token}/submit`, { answers: {} });
  return { leadId: leadId as string, resultId: submitted.resultId as string };
}

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(
    res.ok(),
    "admin login muvaffaqiyatsiz — login cheklovi (10/15daq) tugagan bo'lishi mumkin; backend'ni qayta yuklang",
  ).toBeTruthy();
  const state = await request.storageState();
  adminCookie = state.cookies.find((c) => c.name === ADMIN_COOKIE)?.value ?? "";
  expect(adminCookie, `${ADMIN_COOKIE} cookie topilmadi`).not.toBe("");

  // Sinov ma'lumotini ham bir marta yaratamiz.
  seeded = await seedLeadWithResult(request);
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: ADMIN_COOKIE, value: adminCookie, domain: "localhost", path: "/" },
  ]);
});

test.describe("admin navigatsiyasi", () => {
  test("lead -> natija -> orqaga: lead'ga qaytadi, natijalar ro'yxatiga emas", async ({ page }) => {
    await page.goto(`${ADMIN}/leads/${seeded.leadId}`);
    await expect(page.getByRole("heading", { name: /Navigatsiya Sinovi/ })).toBeVisible();

    await page.getByRole("link", { name: /\(DRAFT\)/ }).first().click();
    await page.waitForURL(/\/results\//);

    // ASOSIY TEKSHIRUV.
    const back = page.getByRole("link", { name: /^←/ });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", new RegExp(`/leads/${seeded.leadId}`));

    await back.click();
    await expect(page).toHaveURL(new RegExp(`/leads/${seeded.leadId}`));
  });

  test("natijalar ro'yxatidan kelinsa, orqaga ro'yxatga qaytaradi", async ({ page }) => {
    await page.goto(`${ADMIN}/results`);
    await page.locator("table tbody tr").first().click();
    await page.waitForURL(/\/results\/[0-9a-f-]{36}/);

    const back = page.getByRole("link", { name: /^←/ });
    await expect(back).toHaveAttribute("href", "/results");
    await back.click();
    await expect(page).toHaveURL(/\/results$/);
  });

  test("?from= tashqi URL qabul qilmaydi (ochiq redirect)", async ({ page }) => {
    await page.goto(`${ADMIN}/results/${seeded.resultId}?from=https%3A%2F%2Fevil.example&fromLabel=Hack`);
    const back = page.getByRole("link", { name: /^←/ });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/results");
  });

  test("leadlar ro'yxati: 'Ochish' tugmasi yo'q, qatorning o'zi bosiladi", async ({ page }) => {
    await page.goto(`${ADMIN}/leads`);
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ochish" })).toHaveCount(0);

    await page.locator("table tbody tr").first().click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}/);
  });
});
