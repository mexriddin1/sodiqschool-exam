import { test, expect } from "@playwright/test";
const ADMIN = "http://localhost:3000", API = "http://localhost:4000";
test("JSON panel ishlaydimi?", async ({ page, context, request }) => {
  const r = await request.post(`${API}/api/admin/auth/login`, { data: { email: "admin@sodiq.uz", password: "ChangeMe!2025" } });
  expect(r.ok()).toBeTruthy();
  const ck = (await request.storageState()).cookies.find((c) => c.name === "sodiq_admin")!.value;
  await context.addCookies([{ name: "sodiq_admin", value: ck, domain: "localhost", path: "/" }]);
  // take=1 EMAS: ro'yxat examDate desc, va happy-path.spec `e2e Exam <vaqt>`
  // qoldiradi — u birinchi chiqadi, lekin shabloni yo'q (Fan ro'yxati bo'sh).
  const exams = (await (await request.get(`${API}/api/admin/exams?take=200`)).json()).data.items;
  const examId = exams.find((e: { title: string }) => e.title.includes("(seed)")).id;

  await page.goto(`${ADMIN}/tests/new?examId=${examId}`);
  console.log("Fan/Sinf tanlashdan OLDIN 'JSON bilan to'ldirish' bormi:",
    await page.getByText("JSON bilan to'ldirish").count());

  await page.getByLabel("Fan").selectOption("CRITICAL_THINKING");
  await page.getByLabel("Sinf").selectOption("5");
  console.log("Fan/Sinf tanlangach:", await page.getByText("JSON bilan to'ldirish").count());

  await page.getByText("JSON bilan to'ldirish").click();
  const qs = Array.from({ length: 10 }, (_, i) => ({
    id: `q${i+1}`, order: i, type: "MULTIPLE_CHOICE", marks: 1,
    prompt: { UZ: `Sinov savol ${i+1}` },
    choices: ["a","b"].map((l) => ({ id: `q${i+1}-${l}`, label: { UZ: l.toUpperCase() } })),
    correctChoiceIds: [`q${i+1}-a`],
  }));
  await page.locator("textarea").first().fill(JSON.stringify({ questions: qs }));
  await page.getByRole("button", { name: "Qo'llash" }).click();
  await page.waitForTimeout(500);
  console.log("Qo'llagandan keyin 1-savol matni ro'yxatda:",
    await page.getByText("Sinov savol 1").count());
  console.log("To'liq hisoblagichi:", await page.getByText(/To'liq:/).first().textContent());
});
