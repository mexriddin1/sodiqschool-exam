// ============================================================================
// A4 PDF export — Playwright (printBackground, prefer_css_page_size).
//
// Hybrid SSR flow: requires a running Astro server (`npm run dev` or
// `npm run build && node ./dist/server/entry.mjs`) and a published result
// the script can log in as.
//
// Usage:
//   ASTRO_URL=http://localhost:4321 \
//   PUBLIC_CODE=A7K29P \
//   PUBLIC_PASSWORD=ChangeMe123 \
//   npm run export:pdf
//
// First run needs the browser:  npx playwright install chromium
// ============================================================================
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ASTRO_URL = process.env.ASTRO_URL ?? "http://localhost:4321";
const PUBLIC_CODE = process.env.PUBLIC_CODE;
const PUBLIC_PASSWORD = process.env.PUBLIC_PASSWORD;

if (!PUBLIC_CODE || !PUBLIC_PASSWORD) {
  console.error(
    "Set PUBLIC_CODE and PUBLIC_PASSWORD (created when the admin published the result).",
  );
  process.exit(1);
}

const PAGES = [
  { path: "/", out: "Sodiq_Math.pdf" },
  { path: "/english", out: "Sodiq_English.pdf" },
  { path: "/critical-thinking", out: "Sodiq_CriticalThinking.pdf" },
  { path: "/summary", out: "Sodiq_Summary.pdf" },
];

const PRINT_CSS = `
@page { size: A4; margin: 12mm 10mm; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
section, .kpi, .snapnum, .gap, .kcard, .qa, .callout, .howto, .cta, .snap, .meter, .strand, .toc li { break-inside: avoid; page-break-inside: avoid; }
h1, h2, h4, .sec-head { break-after: avoid; }
body { background: #fff; }
.masthead { border-radius: 0; }
`;

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not respond at ${url}`);
}

async function loginAndRender() {
  await waitForServer(ASTRO_URL);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${ASTRO_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#code", PUBLIC_CODE);
  await page.fill("#password", PUBLIC_PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }),
    page.click("button[type=submit]"),
  ]);

  for (const p of PAGES) {
    console.log(`· rendering ${p.path}`);
    await page.goto(`${ASTRO_URL}${p.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900); // ECharts canvas
    await page.addStyleTag({ content: PRINT_CSS });
    await page.emulateMedia({ media: "print" });
    const out = join(root, p.out);
    await page.pdf({
      path: out,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    console.log("  →", out);
  }

  await browser.close();
}

loginAndRender().catch((e) => {
  console.error(e);
  process.exit(1);
});
