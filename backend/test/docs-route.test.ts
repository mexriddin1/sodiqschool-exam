// Swagger UI sahifasi bo'm-bo'sh chiqmasligini qo'riqlaydi.
//
// 2026-08-04 da aynan shunday bo'ldi. Sabab spec'da ham, Swagger UI'da ham
// emas edi: swagger-ui-express `swagger-ui-init.js` ni shablonga
// `String.replace()` bilan yig'adi, `replace` esa almashtiruvchi matndagi `$`
// naqshlarini MAXSUS deb biladi — `$\`` moslikdan oldingi butun matnga,
// `$'` keyingisiga, `$1` esa guruhga aylanadi. Tavsiflarimizdagi markdown kod
// bo'lagi ("matematik qismlar `$...$` ichida") aynan `$\`` ni o'z ichiga
// olardi, ya'ni singdirilgan spec generatsiya qilingan JS faylni buzardi.
// Brauzer jimgina `SyntaxError` berardi va sahifa oq qolardi.
//
// Endi spec URL orqali beriladi (`swaggerUrl`), ya'ni shablonga tushmaydi.
// Bu test o'sha yechim joyidaligini tekshiradi: init fayli haqiqatan ham
// TAHLIL QILINADIGAN JavaScript bo'lishi kerak.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AddressInfo } from "node:net";

import express from "express";

import { docsRouter } from "../src/routes/docs.js";

/** Docs routerni bo'sh express ilovaga mount qilib, tasodifiy portda ko'taradi. */
async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use("/api/docs", docsRouter);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}/api/docs`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test("swagger-ui-init.js is parseable JavaScript", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/swagger-ui-init.js`);
    assert.equal(res.status, 200);
    const source = await res.text();
    // `new Function` matnni KOMPILYATSIYA qiladi (ishga tushirmaydi) — ya'ni
    // sintaksis xatosi shu yerda otiladi, xuddi brauzerdagidek.
    assert.doesNotThrow(
      () => new Function(source),
      "swagger-ui-init.js tahlil qilinmadi — sahifa brauzerda oq bo'lib qoladi",
    );
    // Spec singdirilmagan bo'lishi kerak: fayl kichik va URL'ga tayanadi.
    assert.ok(
      source.includes("openapi.json"),
      "init fayli spec'ga URL orqali murojaat qilmayapti",
    );
    assert.ok(
      source.length < 50_000,
      `init fayli ${source.length} bayt — spec yana singdirilganga o'xshaydi`,
    );
  });
});

test("docs endpoints answer", async () => {
  await withServer(async (base) => {
    const html = await fetch(`${base}/`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-type") ?? "", /text\/html/);

    const spec = await fetch(`${base}/openapi.json`);
    assert.equal(spec.status, 200);
    const doc = (await spec.json()) as { openapi: string; paths: Record<string, unknown> };
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(Object.keys(doc.paths).length > 50);
  });
});
