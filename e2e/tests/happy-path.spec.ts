// Happy-path e2e: admin login → create result (paste sample JSON) →
// publish → log out → public login as student → render all 4 report pages.
//
// Prerequisites:
//   - Postgres up + migrated + seeded (so the seed admin exists).
//   - Backend running on http://localhost:4000
//   - Admin running on http://localhost:3000
//   - Client (Astro) running on http://localhost:4321
//
// Env (with defaults):
//   ADMIN_URL=http://localhost:3000
//   CLIENT_URL=http://localhost:4321
//   BACKEND_URL=http://localhost:4000
//   ADMIN_EMAIL=admin@sodiq.uz
//   ADMIN_PASSWORD=ChangeMe!2025
//
// First run: `npm install && npx playwright install chromium`

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, "../../client/src/data");

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3000";
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:4321";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@sodiq.uz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!2025";

const math = JSON.parse(readFileSync(resolve(DATA, "student.json"), "utf8"));
const english = JSON.parse(readFileSync(resolve(DATA, "english.json"), "utf8"));
const ct = JSON.parse(readFileSync(resolve(DATA, "critical-thinking.json"), "utf8"));

test("end-to-end: admin creates + publishes a result, student renders it", async ({ page, request }) => {
  // 1. Admin login via API to get the cookie quickly (UI login is also tested
  //    separately by visiting /login → form).
  await request.post(`${BACKEND_URL}/api/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  // 2. Create a fresh student + exam to keep the test idempotent.
  const studentRes = await request.post(`${BACKEND_URL}/api/admin/students`, {
    data: { fullName: `e2e Test ${Date.now()}`, grade: 5, sex: "MALE" },
  });
  expect(studentRes.ok()).toBeTruthy();
  const student = (await studentRes.json()).data;

  const examRes = await request.post(`${BACKEND_URL}/api/admin/exams`, {
    data: {
      title: `e2e Exam ${Date.now()}`,
      examDate: new Date().toISOString(),
      grade: 5,
      status: "ACTIVE",
      admissionThresholds: {
        "5": { math: 30, ct: 40, en: 30 },
      },
      gradingConfiguration: {},
    },
  });
  expect(examRes.ok()).toBeTruthy();
  const exam = (await examRes.json()).data;

  // 3. Create a result with the three sample subjects.
  const resultRes = await request.post(`${BACKEND_URL}/api/admin/results`, {
    data: {
      studentId: student.id,
      examId: exam.id,
      manualContent: { parent: "e2e", committee: "e2e", outlook: "e2e" },
      subjects: [
        { subject: "MATH", questions: math.questions, realData: math.realData },
        { subject: "ENGLISH", questions: english.questions, realData: english.realData },
        { subject: "CRITICAL_THINKING", questions: ct.questions, realData: ct.realData },
      ],
    },
  });
  expect(resultRes.ok()).toBeTruthy();
  const { result, credentials } = (await resultRes.json()).data;
  expect(credentials.publicCode).toMatch(/^[A-Z2-9]{6}$/);

  // 4. Publish.
  const pubRes = await request.post(`${BACKEND_URL}/api/admin/results/${result.id}/publish`);
  expect(pubRes.ok()).toBeTruthy();

  // 5. Student login via the Astro UI.
  await page.goto(`${CLIENT_URL}/login`);
  await page.fill("#code", credentials.publicCode);
  await page.fill("#password", credentials.password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }),
    page.click("button[type=submit]"),
  ]);

  // 6. Render all 4 report pages without errors.
  for (const path of ["/", "/english", "/critical-thinking", "/summary"]) {
    await page.goto(`${CLIENT_URL}${path}`, { waitUntil: "networkidle" });
    // Each report page has a hero cover with the candidate name.
    await expect(page.locator("body")).toContainText(student.fullName);
  }

  // 7. Session scoping: explicitly logging out should bounce a re-visit to /login.
  await request.post(`${CLIENT_URL}/api/logout`);
  await page.goto(`${CLIENT_URL}/`);
  await expect(page).toHaveURL(/\/login$/);
});
