// Faza 2 regressiyasi — testlar paket UX.
//
// Talab: "Testlar mantiqi Test shablonlari kabi bo'lsin — avval paket, ichida
// testlar, fan/sinf bo'yicha filtr" + "Yorliq (Test shabloni) kerak emas".
//
// Yorliq UI'dan yo'qoldi, lekin ma'lumotda saqlanadi (testning fan/sinfi va
// hisobotdagi mavzu tahlili o'shanga tayanadi) — fan+sinf bo'yicha avtomatik
// topiladi.
//
// Talab: backend (4000) + admin (3000) ishlab tursin, baza seed qilingan
// bo'lsin. DIQQAT: login cheklovi 10/15daq — fayl bo'yicha bitta login.

import { test, expect } from "@playwright/test";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3000";
const API = process.env.BACKEND_URL ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@sodiq.uz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!2025";
const ADMIN_COOKIE = "sodiq_admin";

let adminCookie = "";
let examId = "";
let examTitle = "";

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin login muvaffaqiyatsiz — login cheklovi tugagan bo'lishi mumkin").toBeTruthy();
  adminCookie = (await request.storageState()).cookies.find((c) => c.name === ADMIN_COOKIE)?.value ?? "";
  expect(adminCookie).not.toBe("");

  // exams[0] EMAS: ro'yxat examDate desc bo'yicha keladi va happy-path.spec
  // har yugurishda `e2e Exam <vaqt>` yaratib qoldiradi — u sanasi kechroq
  // bo'lgani uchun birinchi chiqadi va testlari yo'q. Testlar seed:mock
  // yaratgan imtihonga bog'langan, shuning uchun aynan o'shani tanlaymiz.
  const exams = (await (await request.get(`${API}/api/admin/exams?take=200`)).json()).data.items;
  const seed = exams.find((e: { title: string }) => e.title.includes("(seed)"));
  expect(seed, "seed imtihoni topilmadi — `npm run seed --workspace backend` ishlating").toBeTruthy();
  examId = seed.id;
  examTitle = seed.title;
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: ADMIN_COOKIE, value: adminCookie, domain: "localhost", path: "/" }]);
});

test.describe("testlar paket UX", () => {
  test("/tests paketlar to'ri — imtihon kartasi bosilsa paket ichiga kiradi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests`);
    const card = page.getByRole("button", { name: new RegExp(examTitle.slice(0, 20)) });
    await expect(card).toBeVisible();
    await expect(card).toContainText("ta test");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/tests/exam/${examId}`));
  });

  test("paket ichida fan filtri ishlaydi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/exam/${examId}`);
    // seed:mock 3 ta test yaratadi — har fandan bittadan.
    await expect(page.locator("table tbody tr")).toHaveCount(3);

    await page.getByLabel("Fan").selectOption("MATH");
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    await expect(page.locator("table tbody tr").first()).toContainText("Matematika");

    await page.getByRole("button", { name: "Filtrni tozalash" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(3);
  });

  test("paket ichida sinf filtri ishlaydi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/exam/${examId}`);
    await page.getByLabel("Sinf").selectOption("5");
    await expect(page.locator("table tbody tr")).toHaveCount(3);
    await expect(page.locator("table tbody tr").first()).toContainText("5-sinf");
  });

  test("'Yangi test': Yorliq maydoni yo'q, Fan va Sinf bor", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new?examId=${examId}`);

    // Asosiy talab: "Yorliq" atamasi admin ko'zida yo'q.
    await expect(page.getByText(/Yorliq/i)).toHaveCount(0);
    await expect(page.getByLabel("Fan")).toBeVisible();
    await expect(page.getByLabel("Sinf")).toBeVisible();

    // Paketdan kelindi -> imtihon qulflangan.
    await expect(page.getByLabel("Imtihon")).toBeDisabled();
  });

  test("bloklangan inputlar sababi ko'rinadi va ketma-ket ochiladi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new`); // ?examId= siz — imtihon tanlanmagan

    await expect(page.getByText("Avval imtihonni tanlang", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Fan")).toBeDisabled();
    await expect(page.getByLabel("Sinf")).toBeDisabled();

    await page.getByLabel("Imtihon").selectOption(examId);
    await expect(page.getByLabel("Fan")).toBeEnabled();
    await expect(page.getByLabel("Sinf")).toBeDisabled();
    await expect(page.getByText("Fanni tanlang", { exact: false })).toBeVisible();

    await page.getByLabel("Fan").selectOption("CRITICAL_THINKING");
    await expect(page.getByLabel("Sinf")).toBeEnabled();
  });

  test("fan+sinf tanlansa yorliq avtomatik topiladi va savol soni belgilanadi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
    await page.getByLabel("Fan").selectOption("CRITICAL_THINKING");
    await page.getByLabel("Sinf").selectOption("5");

    // Tanqidiy fikrlash shabloni 10 savoldan iborat (seed).
    await expect(page.getByText(/aynan\s*10 ta savol/)).toBeVisible();
  });
});
