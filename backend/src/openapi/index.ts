// OpenAPI 3.1 hujjatini yig'ish.
//
// Spec `GET /api/docs/openapi.json` da beriladi va `GET /api/docs` da Swagger UI
// bilan ko'rsatiladi (`src/routes/docs.ts`). Serverni ko'tarmasdan olish uchun:
// `npm run openapi:dump --workspace backend` → `docs/openapi.json`.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parameters, responses, schemas, securitySchemes, type JsonObject } from "./components.js";
import { adminPaths } from "./paths.admin.js";
import { publicPaths } from "./paths.public.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Versiyani `backend/package.json` dan o'qiydi.
 *
 * Yo'l `src/openapi/` va `dist/openapi/` uchun bir xil ishlaydi (ikkalasidan
 * ham ikki pog'ona yuqorida `backend/` turadi). JSON import qilmadik — ESM'da
 * u import atributlarini talab qiladi va tsc/tsx/node o'rtasida turlicha
 * yo'l tutadi.
 */
function packageVersion(): string {
  try {
    const raw = readFileSync(resolve(here, "../../package.json"), "utf8");
    return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const DESCRIPTION = `
Sodiq School qabul imtihoni tizimining backend API'si.

## Javob shakli

Muvaffaqiyatli javoblarning HAMMASI bir xil konvertda keladi:

\`\`\`json
{ "success": true, "data": { } }
\`\`\`

Xatolar ham:

\`\`\`json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {} } }
\`\`\`

Istisno: \`GET /api/admin/results/export.csv\` (CSV) va
\`GET /api/admin/results/{id}/pdf\` (PDF) — ular faylning o'zini beradi.

## Autentifikatsiya

Uch xil sessiya bir-biridan mustaqil, har biri o'z kaliti bilan imzolanadi:

| Kim | Qanday | Muddat |
| --- | --- | --- |
| Admin | \`sodiq_admin\` cookie (\`POST /api/admin/auth/login\`) | 7 kun |
| Ota-ona | \`sodiq_result\` cookie yoki \`Authorization: Bearer\` | 1 kun |
| Qabul testi qurilmasi | \`Authorization: Bearer\` (\`POST /api/test-taking/gate\`) | 365 kun |

Admin marshrutlari FAQAT cookie'ni o'qiydi — ularga \`Authorization\` sarlavhasi
bilan kirib bo'lmaydi.

## Sahifalash

Ro'yxat qaytaradigan endpointlar \`?page=\` va \`?take=\` ni oladi va shunday
javob beradi:

\`\`\`json
{ "items": [], "total": 0, "page": 1, "take": 50, "pages": 1 }
\`\`\`

\`take\` ning standarti va yuqori chegarasi har endpointda boshqacha; chegaradan
oshgan qiymat jimgina qisqartiriladi.

Ba'zi ro'yxatlarda \`counts\` bloki ham bor. U BAZADAN sanaladi (ko'rinib
turgan sahifadan emas) va o'zi bo'linayotgan o'lchov filtriga bo'ysunmaydi.

## Limitlar

- \`/api/admin/**\` — 240 so'rov/daqiqa/IP
- \`POST /api/admin/auth/login\` — 15 daqiqada 10 urinish/IP
- \`POST /api/result/auth/login\` va \`/auth/lookup\` — 10 daqiqada 30 muvaffaqiyatSIZ urinish/IP
- \`POST /api/test-taking/gate\` — 15 daqiqada 20 urinish/IP
- \`/api/test-taking\` ning qolgani — limitsiz (kerak bo'lsa nginx darajasida cheklang)

So'rov tanasi 5 MB gacha (eng katta CSV importni qoplaydi).

## Bilib qo'yish kerak

- **Qabul testi nazorat ostidagi imtihon emas.** Fanlar tartibi faqat
  interfeysda; \`/api/test-taking/attempts\` ga to'g'ridan-to'g'ri so'rov
  yuborib istalgan testni boshlash mumkin. Bu — lead yig'uvchi funnel.
- **\`/api/result/auth/lookup\` — qidiruv, autentifikatsiya emas.** Familya,
  ism va sinf sir emas, ya'ni hisobot amalda ochiq; yagona to'siq — rate limiter.
- **Ota-onaga ko'rsatiladigan raqamlar muzlatilgan** (\`calculatedSnapshot\`).
  Hisob mantiqi o'zgarsa eski natijalar o'z-o'zidan yangilanmaydi —
  \`POST /api/admin/results/{id}/recompute-snapshot\` kerak bo'ladi.
`.trim();

export function buildOpenApiDocument(): JsonObject {
  return {
    openapi: "3.1.0",
    info: {
      title: "Sodiq School — Exam API",
      version: packageVersion(),
      description: DESCRIPTION,
      contact: { name: "Sodiq School", url: "https://sodiqschool.uz" },
    },
    servers: [
      { url: "https://api.natija.sodiqschool.uz", description: "Jonli server" },
      { url: "http://localhost:4000", description: "Lokal ishlab chiqish" },
    ],
    tags: [
      { name: "Xizmat", description: "Tiriklik tekshiruvi." },
      { name: "Admin · Auth", description: "Admin paneliga kirish." },
      { name: "Admin · O'quvchilar", description: "O'quvchilar va ularning kirish kodlari." },
      { name: "Admin · Imtihonlar", description: "Imtihonlar va qabul chegaralari." },
      { name: "Admin · Natijalar", description: "Hisobotlar: yaratish, nashr etish, eksport, AI." },
      { name: "Admin · Foydalanuvchilar", description: "Admin hisoblari. Faqat `ADMIN` roli." },
      { name: "Admin · Audit", description: "Kim nimani o'zgartirgani." },
      { name: "Admin · Shablonlar", description: "Hisobot formasi uchun namuna mazmun." },
      { name: "Admin · Savol shablonlari", description: "Savollarning pedagogik tuzilmasi." },
      { name: "Admin · Testlar", description: "O'quvchi topshiradigan testlar." },
      { name: "Admin · Leadlar", description: "Qabul testi formasini to'ldirganlar." },
      { name: "Admin · Urinishlar", description: "Topshirilgan javoblarni ko'rish." },
      { name: "Admin · Statistika", description: "Boshqaruv paneli ko'rsatkichlari." },
      { name: "Admin · Fanlar", description: "Tanlanadigan fanlar ro'yxati." },
      { name: "Admin · Resurslar", description: "Rivojlanish yo'li uchun o'quv resurslari." },
      { name: "Admin · Sozlamalar", description: "Global sozlamalar va ma'lumot tozalash." },
      { name: "Ochiq · Sozlama", description: "Autentifikatsiyasiz o'qiladigan sozlamalar." },
      { name: "Ochiq · Hisobot", description: "Ota-ona ko'radigan hisobot." },
      { name: "Ochiq · Qabul testi", description: "test.sodiqschool.uz funneli." },
    ],
    paths: { ...publicPaths, ...adminPaths },
    components: { schemas, parameters, responses, securitySchemes },
  };
}
