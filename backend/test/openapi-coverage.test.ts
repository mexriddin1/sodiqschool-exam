// OpenAPI spec'i kod bilan bir qadamda yurishini tekshiradi.
//
// Spec qo'lda yoziladi, ya'ni yangi endpoint qo'shilib hujjatga yozilmasligi
// mumkin — va buni hech narsa sezmasdi. Shu test aynan shuni ushlaydi: har bir
// router faylidan `router.<method>("<path>")` chaqiruvlarini o'qib, `index.ts`
// dagi mount prefikslari bilan birlashtiradi va natijani spec bilan solishtiradi.
//
// Bu FAQAT yo'l darajasidagi qamrov: so'rov yoki javob shakli o'zgarsa test
// sezmaydi. Shunga qaramay eng ko'p uchraydigan drift — "endpoint qo'shildi,
// hujjat unutildi" — shu yerda to'xtaydi.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildOpenApiDocument } from "../src/openapi/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src");

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** `index.ts` dagi `app.use("<prefiks>", <router>)` juftliklari. */
function readMounts(): Map<string, string> {
  const source = readFileSync(resolve(SRC, "index.ts"), "utf8");
  const out = new Map<string, string>();
  const re = /app\.use\(\s*"([^"]+)"\s*,\s*(?:[^)]*?,\s*)?(\w+Router)\s*\)/g;
  for (const m of source.matchAll(re)) out.set(m[2]!, m[1]!);
  return out;
}

/** Bitta router faylidagi marshrutlar: `["get /", "post /:id/publish", ...]`. */
function readRoutes(file: string): { method: string; path: string }[] {
  const source = readFileSync(file, "utf8");
  const out: { method: string; path: string }[] = [];
  const re = new RegExp(`\\w+\\.(${METHODS.join("|")})\\(\\s*"([^"]*)"`, "g");
  for (const m of source.matchAll(re)) out.push({ method: m[1]!, path: m[2]! });
  return out;
}

/** Express yo'lini OpenAPI shakliga o'giradi: `/:id/pdf` → `/{id}/pdf`. */
function toOpenApiPath(prefix: string, routePath: string): string {
  const tail = routePath === "/" ? "" : routePath;
  return `${prefix}${tail}`.replace(/:(\w+)/g, "{$1}");
}

test("spec covers every mounted route", () => {
  const mounts = readMounts();
  assert.ok(mounts.size > 10, `index.ts dan mount'lar o'qilmadi (${mounts.size} ta topildi)`);

  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };
  const missing: string[] = [];

  for (const file of readdirSync(resolve(SRC, "routes"))) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(resolve(SRC, "routes", file), "utf8");
    // Fayldagi eksport qilingan router nomini topamiz — mount prefiksi shunga bog'liq.
    const nameMatch = source.match(/export const (\w+Router)\s*=/);
    if (!nameMatch) continue;
    const prefix = mounts.get(nameMatch[1]!);
    // Mount qilinmagan router (masalan docs, u shartli mount qilinadi) — o'tkazamiz.
    if (prefix === undefined) continue;

    for (const r of readRoutes(resolve(SRC, "routes", file))) {
      const p = toOpenApiPath(prefix, r.path);
      const entry = doc.paths[p];
      if (!entry || !(r.method in entry)) missing.push(`${r.method.toUpperCase()} ${p}  (${file})`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `OpenAPI spec'da yo'q marshrutlar — src/openapi/paths.*.ts ga qo'shing:\n  ${missing.join("\n  ")}`,
  );
});

test("spec has no paths that no longer exist in code", () => {
  const mounts = readMounts();
  const known = new Set<string>(["/health", "/api/docs", "/api/docs/openapi.json"]);

  for (const file of readdirSync(resolve(SRC, "routes"))) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(resolve(SRC, "routes", file), "utf8");
    const nameMatch = source.match(/export const (\w+Router)\s*=/);
    if (!nameMatch) continue;
    const prefix = mounts.get(nameMatch[1]!);
    if (prefix === undefined) continue;
    for (const r of readRoutes(resolve(SRC, "routes", file))) known.add(toOpenApiPath(prefix, r.path));
  }

  const doc = buildOpenApiDocument() as { paths: Record<string, unknown> };
  const stale = Object.keys(doc.paths).filter((p) => !known.has(p));

  assert.deepEqual(stale, [], `Kodda yo'q, lekin spec'da turgan yo'llar:\n  ${stale.join("\n  ")}`);
});

test("every $ref points at a schema that exists", () => {
  const doc = buildOpenApiDocument() as {
    components: { schemas: Record<string, unknown>; parameters: Record<string, unknown>; responses: Record<string, unknown> };
  };
  const dangling: string[] = [];

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "$ref" && typeof v === "string") {
        const m = v.match(/^#\/components\/(schemas|parameters|responses)\/(.+)$/);
        if (!m) {
          dangling.push(v);
        } else {
          const bucket = doc.components[m[1] as "schemas" | "parameters" | "responses"];
          if (!(m[2]! in bucket)) dangling.push(v);
        }
      } else {
        walk(v);
      }
    }
  };
  walk(doc);

  assert.deepEqual(dangling, [], `Mavjud bo'lmagan $ref:\n  ${[...new Set(dangling)].join("\n  ")}`);
});
