// Savollar muharriri — ixcham smoke tekshiruvi.
//
// Chuqur UI testi ataylab yozilmagan: shakl hali o'zgarib turibdi va
// har o'zgarishda testni qayta yozish vaqtni yeydi. Mantiqning o'zi
// backend unit testlarida (backend/test/i18n-questions.test.ts) qoplangan —
// resolveText, eski tekis-string savollar, FILL_GAP tilga qarab baholanishi.
//
// Bu yerda faqat ikkita narsa: tanlangan tillar yonma-yon chiqadimi, va
// to'ldirilmagan til saqlanib ketmaydimi.
//
// DIQQAT: backend login cheklovi 10/15daq — fayl bo'yicha bitta login.

import { test, expect } from "@playwright/test";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3000";
const API = process.env.BACKEND_URL ?? "http://localhost:4000";
const ADMIN_COOKIE = "sodiq_admin";

let adminCookie = "";
let examId = "";

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/admin/auth/login`, {
    data: {
      email: process.env.ADMIN_EMAIL ?? "admin@sodiq.uz",
      password: process.env.ADMIN_PASSWORD ?? "ChangeMe!2025",
    },
  });
  expect(res.ok(), "admin login — cheklov tugagan bo'lsa backend'ni qayta yuklang").toBeTruthy();
  adminCookie = (await request.storageState()).cookies.find((c) => c.name === ADMIN_COOKIE)?.value ?? "";
  // items[0] EMAS: ro'yxat examDate desc bo'yicha keladi va happy-path.spec
  // har yugurishda `e2e Exam <vaqt>` qoldiradi — u birinchi chiqadi, lekin
  // shabloni yo'q, ya'ni "Fan" ro'yxati bo'sh bo'ladi. Shablonlar seed
  // imtihoniga bog'langan.
  const exams = (await (await request.get(`${API}/api/admin/exams?take=200`)).json()).data.items;
  const seed = exams.find((e: { title: string }) => e.title.includes("(seed)"));
  expect(seed, "seed imtihoni topilmadi — `npm run seed --workspace backend` ishlating").toBeTruthy();
  examId = seed.id;
});

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: ADMIN_COOKIE, value: adminCookie, domain: "localhost", path: "/" }]);
  await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
  await page.getByLabel("Fan").selectOption("CRITICAL_THINKING");
  await page.getByLabel("Sinf").selectOption("5");
});

test("til tabi faqat TANLANGAN tillar uchun chiqadi", async ({ page }) => {
  // Savollar yig'ilgan ro'yxatda — birinchisini ochamiz.
  await page.getByRole("button", { name: /1\./ }).first().click();

  // Faqat UZ tanlangan -> tab umuman kerak emas.
  await expect(page.getByRole("button", { name: "RU", exact: true })).toHaveCount(0);

  // Rus tilini qo'shsak — UZ va RU tablari paydo bo'ladi.
  await page.getByText("Rus", { exact: true }).click();
  await expect(page.getByRole("button", { name: "UZ", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "RU", exact: true }).first()).toBeVisible();
  // Ingliz tanlanmagan.
  await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveCount(0);
});

test("oltala savol turi ham ochiladi va o'chirish tugmasi bor", async ({ page }) => {
  await page.getByRole("button", { name: /1\./ }).first().click();
  const card = page.locator(".card").filter({ hasText: "Savol #1" }).first();

  const types = [
    "MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE",
    "FILL_GAP", "MATCHING", "REORDERING",
  ];
  for (const t of types) {
    await card.locator("select").first().selectOption(t);
    // Har turda kamida bitta qator va uning o'chirish tugmasi bo'lsin.
    await expect(
      card.getByRole("button", { name: /o'chirish/i }).first(),
      `${t} turida qator ko'rinmadi`,
    ).toBeVisible();
  }

  // REORDERING'da tartibni surish tugmalari paydo bo'lgan (ilgari yo'q edi).
  await expect(card.getByTitle("Pastga").first()).toBeVisible();
});

test("tanlangan til to'ldirilmasa saqlashga qo'ymaydi", async ({ page }) => {
  await page.getByLabel("Test nomi").fill("Ikki tilli sinov");
  await page.getByText("Rus", { exact: true }).click(); // RU qo'shildi, to'ldirilmaydi

  await page.getByRole("button", { name: /1\./ }).first().click();
  await page.locator("textarea").first().fill("Faqat o'zbekcha");

  await page.getByRole("button", { name: /Testni saqlash/ }).click();

  // Backend bo'sh matnga xato bermaydi — RU o'quvchi bo'sh savol ko'rardi.
  await expect(page.getByText(/Tanlangan tillar to'liq to'ldirilmagan/)).toBeVisible();
  await expect(page).toHaveURL(/\/tests\/new/);
});
