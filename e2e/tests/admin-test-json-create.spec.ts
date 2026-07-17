// "JSON bilan yaratish" — butun testni bitta JSON bilan yaratish.
//
// Panel POST qilmaydi, formani TO'LDIRADI: saqlash yo'li bitta bo'lib qoladi
// (tarjima tekshiruvi, shablon tanlash). Shuning uchun test JSON'dan keyin
// forma haqiqatan to'lganini va saqlash ishlaganini tekshiradi.
//
// Talab: backend (4000) + admin (3000) ishlab tursin, baza seed qilingan
// bo'lsin. DIQQAT: login cheklovi 10/15daq — fayl bo'yicha bitta login.

import { test, expect } from "@playwright/test";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3000";
const API = process.env.BACKEND_URL ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@sodiq.uz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!2025";
const ADMIN_COOKIE = "sodiq_admin";

// Yaratilgan testlar afterAll'da o'chiriladi: admin-tests-package.spec.ts shu
// paketda AYNAN 3 ta test bo'lishini kutadi (seed:mock), ya'ni qoldirilgan
// test qo'shni testni buzadi.
const TEST_NAME = "JSON test — 5-sinf matematika";

let adminCookie = "";
let examId = "";
let mathCount = 0;

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin login muvaffaqiyatsiz — login cheklovi tugagan bo'lishi mumkin").toBeTruthy();
  adminCookie = (await request.storageState()).cookies.find((c) => c.name === ADMIN_COOKIE)?.value ?? "";
  expect(adminCookie).not.toBe("");

  // Yorliqqa ega imtihonni tanlaymiz — JSON paneli fan/sinfni shular ichidan
  // topadi, yorliqsiz imtihonda tekshirib bo'lmaydi.
  const tpls = (await (await request.get(`${API}/api/admin/test-templates?take=500`)).json()).data.items;
  const math = tpls.find((t: { subject: string; examId: string | null }) => t.subject === "MATH" && t.examId);
  expect(math, "MATH yorlig'i bo'lgan imtihon topilmadi — seed:mock ishlating").toBeTruthy();
  examId = math.examId;
  mathCount = math.questionCount;
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: ADMIN_COOKIE, value: adminCookie, domain: "localhost", path: "/" }]);
});

test.afterAll(async ({ request }) => {
  // Cookie'ni ochiq uzatamiz — request fixture'ining o'z storage'iga
  // tayanmaymiz, va qayta login qilmaymiz (login cheklovi 10/15daq).
  const auth = { headers: { Cookie: `${ADMIN_COOKIE}=${adminCookie}` } };
  const res = await request.get(`${API}/api/admin/tests?take=200`, auth);
  const items = (await res.json()).data?.items ?? [];
  for (const t of items as { id: string; name: string }[]) {
    if (t.name === TEST_NAME) await request.delete(`${API}/api/admin/tests/${t.id}`, auth);
  }
});

/** Yorliq talab qilgan sondagi to'liq MULTIPLE_CHOICE savol. */
function questions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    order: i,
    type: "MULTIPLE_CHOICE",
    marks: 2,
    prompt: { UZ: `${i + 1} + 1 nechchi?`, RU: `Сколько будет ${i + 1} + 1?` },
    choices: [
      { id: `q${i + 1}-a`, label: { same: true, UZ: String(i + 2) } },
      { id: `q${i + 1}-b`, label: { same: true, UZ: String(i + 3) } },
      { id: `q${i + 1}-c`, label: { same: true, UZ: String(i + 4) } },
    ],
    correctChoiceIds: [`q${i + 1}-a`],
  }));
}

function payload(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    name: TEST_NAME,
    subject: "MATH",
    grade: 5,
    languages: ["UZ", "RU"],
    durationMin: 30,
    questions: questions(mathCount),
    ...over,
  });
}

test.describe("JSON bilan test yaratish", () => {
  test("to'g'ri JSON formani to'ldiradi va test saqlanadi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
    await page.getByRole("button", { name: "JSON bilan yaratish" }).click();
    await page.locator("textarea").first().fill(payload());

    // Tekshiruv joylashdan OLDIN ko'rinadi.
    await expect(page.getByText(`✓ ${mathCount} ta savol`)).toBeVisible();

    await page.getByRole("button", { name: "Qo'llash" }).click();

    // Forma to'ldi — fan/sinf JSON'dan kelgan, shablon avtomatik topilgan.
    await expect(page.getByLabel("Test nomi")).toHaveValue(TEST_NAME);
    await expect(page.getByLabel("Fan")).toHaveValue("MATH");
    await expect(page.getByLabel("Sinf")).toHaveValue("5");
    await expect(page.getByPlaceholder("masalan 30")).toHaveValue("30");
    await expect(page.getByText(`To'liq: ${mathCount} / ${mathCount}`)).toBeVisible();

    await page.getByRole("button", { name: "Testni saqlash" }).click();
    // Dev'da /tests/[id] birinchi ochilishda kompilyatsiya qilinadi — 5s kam.
    await expect(page).toHaveURL(/\/tests\/[0-9a-f-]{36}/, { timeout: 30_000 });
  });

  test("savol soni yorliqnikiga teng bo'lmasa — qo'llamaydi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
    await page.getByRole("button", { name: "JSON bilan yaratish" }).click();
    await page.locator("textarea").first().fill(payload({ questions: questions(3) }));

    await expect(page.getByText("Qo'llab bo'lmaydi:")).toBeVisible();
    await page.getByRole("button", { name: "Qo'llash" }).click();

    // Forma tegilmagan — nom bo'sh qolgan.
    await expect(page.getByLabel("Test nomi")).toHaveValue("");
  });

  test("noma'lum fan — aniq xato beradi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
    await page.getByRole("button", { name: "JSON bilan yaratish" }).click();
    await page.locator("textarea").first().fill(payload({ subject: "PHYSICS" }));

    await expect(page.getByText(/"subject" — MATH \| ENGLISH \| CRITICAL_THINKING/)).toBeVisible();
  });

  test("buzuq JSON — parse xatosi ko'rsatiladi", async ({ page }) => {
    await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
    await page.getByRole("button", { name: "JSON bilan yaratish" }).click();
    await page.locator("textarea").first().fill("{ name: yo'q }");

    await expect(page.getByText(/JSON o'qib bo'lmadi/)).toBeVisible();
  });
});
