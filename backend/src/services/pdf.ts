// Renders the 4 report pages as a single merged PDF. Uses Playwright headless
// Chromium against the running Astro server. Auth is done via a short-lived
// forged `sodiq_result` cookie — the same JWT the public login endpoint mints,
// scoped to the result id.
//
// Environment:
//   CLIENT_APP_URL   — base URL of the running Astro server (default http://localhost:4321)

import { chromium, Browser, Page } from "playwright";
import { PDFDocument } from "pdf-lib";
import { signResultToken, RESULT_COOKIE } from "../middleware/auth.js";

const CLIENT_URL = process.env.CLIENT_APP_URL ?? "http://localhost:4321";

const PAGES = ["/", "/english", "/critical-thinking", "/summary"] as const;

const PRINT_CSS = `
@page { size: A4; margin: 12mm 10mm; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
section, .kpi, .snapnum, .gap, .kcard, .qa, .callout, .howto, .cta, .snap, .meter, .strand, .toc li { break-inside: avoid; page-break-inside: avoid; }
h1, h2, h4, .sec-head { break-after: avoid; }
body { background: #fff; }
.masthead { border-radius: 0; }
`;

async function renderPage(browser: Browser, url: string, cookieHeader: string): Promise<Buffer> {
  const ctx = await browser.newContext();
  // Set the Astro-side session cookie so pages accept the fetch to backend.
  // The Astro server holds `sodiq_client_token` on its own origin; the backend
  // pdf renderer sits on a different origin, so the simpler path is to bounce
  // through /api/login with an artificial credential... but we don't have the
  // password. Instead we drop the token as a cookie for the Astro origin,
  // matching what /api/login normally sets.
  const url0 = new URL(CLIENT_URL);
  await ctx.addCookies([
    {
      name: "sodiq_client_token",
      value: cookieHeader,
      domain: url0.hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  const page: Page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(900); // let ECharts / SVG settle
  await page.addStyleTag({ content: PRINT_CSS });
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
  });
  await ctx.close();
  return pdf;
}

// Merge N PDF Buffers into one, in order.
async function mergePdfs(bufs: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of bufs) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  const out = await merged.save();
  return Buffer.from(out);
}

export async function renderResultPdf(resultId: string, publicCode: string): Promise<Buffer> {
  const token = signResultToken({ sub: resultId, code: publicCode });
  const browser = await chromium.launch({ headless: true });
  try {
    const pdfs: Buffer[] = [];
    for (const path of PAGES) {
      const buf = await renderPage(browser, `${CLIENT_URL}${path}`, token);
      pdfs.push(buf);
    }
    return await mergePdfs(pdfs);
  } finally {
    await browser.close();
  }
}
