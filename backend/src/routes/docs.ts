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

docsRouter.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(document, {
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
