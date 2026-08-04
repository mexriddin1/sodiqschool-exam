// Spec'ni `docs/openapi.json` ga yozadi — Postman/Insomnia'ga import qilish yoki
// mijoz kodini generatsiya qilish uchun server ko'tarilishi shart bo'lmasin.
//
//   npm run openapi:dump --workspace backend

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildOpenApiDocument } from "../src/openapi/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../docs/openapi.json");

const doc = buildOpenApiDocument() as { paths: Record<string, unknown> };
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

console.log(`[openapi] ${Object.keys(doc.paths).length} ta yo'l → ${out}`);
