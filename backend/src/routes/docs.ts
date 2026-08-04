// Swagger UI + xom OpenAPI hujjati.
//
// `DOCS_ENABLED=false` bo'lsa bu router umuman mount qilinmaydi (index.ts).
// Spec'da sir yo'q — faqat endpoint ro'yxati; admin marshrutlari baribir
// cookie talab qiladi.

import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { buildOpenApiDocument } from "../openapi/index.js";

export const docsRouter = Router();

// Bir marta yig'iladi: hujjat sof ma'lumot, so'rovga bog'liq emas.
const document = buildOpenApiDocument();

docsRouter.get("/openapi.json", (_req, res) => {
  // Boshqa origin'dagi vositalar (Postman, Redoc, kod generatorlar) spec'ni
  // to'g'ridan-to'g'ri yuklab olsin. Global CORS ro'yxati faqat bizning
  // domenlarni qo'shadi, spec esa hammaga ochiq bo'lishi mumkin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(document);
});

// Spec Swagger UI ga URL orqali beriladi, ichiga SINGDIRILMAYDI.
//
// swagger-ui-express `swagger-ui-init.js` ni shablonga `String.replace()` bilan
// yig'adi, `replace` esa almashtiruvchi matndagi `$` naqshlarini MAXSUS deb
// biladi: `$\`` — moslikdan oldingi butun matn, `$'` — keyingi, `$1` — guruh.
// Tavsiflarimizda markdown kod bo'laklari bor ("matematik qismlar `$...$`
// ichida"), ya'ni singdirilgan spec `$\`` sequence'ini o'z ichiga oladi va
// generatsiya qilingan JS fayl BUZILADI — sahifa bo'm-bo'sh chiqadi
// (2026-08-04). URL orqali berilganda shablonga faqat qisqa manzil tushadi,
// ya'ni tavsiflarga hech qanday cheklov qolmaydi.
//
// Yonaki foyda: sahifa 130 KB spec'ni ikki marta yubormaydi.
docsRouter.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerUrl: "openapi.json",
    customSiteTitle: "Sodiq School — Exam API",
    swaggerOptions: {
      // Endpointlar ko'p (~90) — hammasi yopiq holda ochilsin, aks holda
      // sahifa uzun ro'yxat bo'lib ochiladi.
      docExpansion: "none",
      filter: true,
      persistAuthorization: true,
      tagsSorter: "alpha",
    },
  }),
);
