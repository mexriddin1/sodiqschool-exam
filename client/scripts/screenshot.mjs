import { chromium } from 'playwright';
const url = process.env.URL || 'http://localhost:4321/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.screenshot({ path: 'preview-full.png', fullPage: true });
await b.close();
console.log('saved preview-full.png');
