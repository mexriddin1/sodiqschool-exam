# OpenAPI / Swagger: qayerda turadi va qanday yangilanadi

Backend'ning API hujjati — **qo'lda yozilgan OpenAPI 3.1 spetsifikatsiyasi**,
kod bilan bir repoda.

## Manzillar

| | |
| --- | --- |
| Swagger UI | `https://api.natija.sodiqschool.uz/api/docs` |
| Xom spec | `https://api.natija.sodiqschool.uz/api/docs/openapi.json` |
| Lokal | `http://localhost:4000/api/docs` |
| Repodagi nusxa | `docs/openapi.json` |

Spec hammaga ochiq — ichida sir yo'q, faqat endpoint ro'yxati; admin
marshrutlari baribir cookie talab qiladi. O'chirish kerak bo'lsa
`backend/.env` ga:

```dotenv
DOCS_ENABLED=false
```

va backend'ni qayta ishga tushiring. Shunda `/api/docs` umuman mount
qilinmaydi (404).

## Fayllar

```
backend/src/openapi/
├── index.ts          buildOpenApiDocument() — info, servers, tags, security
├── components.ts     sxemalar, parametrlar, javoblar + yordamchilar
├── paths.admin.ts    /api/admin/**
└── paths.public.ts   /health, /api/public, /api/result, /api/test-taking
backend/src/routes/docs.ts        Swagger UI + openapi.json
backend/scripts/dump-openapi.ts   docs/openapi.json ni yozadi
backend/test/openapi-coverage.test.ts   drift qo'riqchisi
```

## Nega qo'lda, generatordan emas

Zod sxemalaridan avtomatik generatsiya qilish mumkin edi, lekin eng muhim
maydonlar — `Test.questions`, `Result.manualContent`, `calculatedSnapshot`,
`aiNarrative`, `aiRoadmap` — baza tomonda `Json` ustunlar, kodda esa
`z.record(z.any())`. Generator ular haqida `object` dan boshqa hech narsa
ayta olmasdi, ya'ni aynan tushuntirish kerak bo'lgan joylar bo'sh qolardi.

Qo'lda yozilganining narxi — eskirib qolish xavfi. Uni test qoplaydi
(pastga qarang).

## Yangi endpoint qo'shganda

1. Marshrutni odatdagidek `backend/src/routes/*.ts` ga yozing.
2. `paths.admin.ts` yoki `paths.public.ts` ga tavsifini qo'shing.
   Express yo'li OpenAPI shakliga o'giriladi: `/:id/pdf` → `/{id}/pdf`.
3. Yangi so'rov/javob shakli bo'lsa — `components.ts` ga sxema qo'shing va
   `$ref` bilan ishlating.
4. Tekshiring:

```bash
npm test --workspace backend        # qamrov + $ref testlari
npm run openapi:dump --workspace backend
```

`docs/openapi.json` ni ham commit qiling — Postman/Insomnia'ga import qilish
uchun server ko'tarilishi shart bo'lmasin.

## Test nima qiladi

`backend/test/openapi-coverage.test.ts` uch narsani tekshiradi:

1. **Qamrov** — `src/routes/*.ts` dagi har bir `router.<method>("...")`
   chaqiruvi `index.ts` dagi mount prefiksi bilan birlashtirilib spec'da
   qidiriladi. Yozilmagan endpoint — test yiqiladi.
2. **Eskirgan yo'llar** — spec'da bor, kodda yo'q marshrutlar.
3. **Buzuq `$ref`** — mavjud bo'lmagan sxemaga havolalar.

Bu faqat **yo'l darajasidagi** qamrov: so'rov yoki javob shakli o'zgarsa test
sezmaydi. Eng ko'p uchraydigan drift ("endpoint qo'shildi, hujjat unutildi")
esa shu yerda to'xtaydi.

## Spec nega URL orqali beriladi

`swaggerUi.setup()` ga spec obyektini BERMANG — u `swaggerUrl: "openapi.json"`
bilan chaqiriladi va sahifa spec'ni alohida so'rov bilan oladi.

Sabab: swagger-ui-express `swagger-ui-init.js` ni shablonga
`String.replace()` bilan yig'adi, `replace` esa almashtiruvchi matndagi `$`
naqshlarini maxsus deb biladi — ``$` `` moslikdan oldingi butun matnga, `$'`
keyingisiga, `$1` guruhga aylanadi. Tavsiflarda markdown kod bo'laklari bor
(masalan "matematik qismlar `` `$...$` `` ichida"), ya'ni singdirilgan spec
generatsiya qilingan JS faylni buzadi: brauzer `SyntaxError` beradi va sahifa
**oq** qoladi. Aynan shu 2026-08-04 da bo'lib o'tdi.

`backend/test/docs-route.test.ts` init faylini `new Function()` bilan
kompilyatsiya qilib ko'radi — spec yana singdirilsa test yiqiladi.

## Swagger UI va helmet

`backend/src/index.ts` da docs router **`app.use(helmet())` dan oldin**,
o'zining `helmet({ contentSecurityPolicy: false })` konfigi bilan mount
qilinadi. Tartibni o'zgartirmang: helmet CSP header'ini bir marta yozib
bo'lgach, keyingi helmet uni o'chira olmaydi va Swagger UI bo'm-bo'sh
sahifa bo'lib qoladi.

Bu yengillik faqat `/api/docs` ga tegadi — qolgan hamma narsa to'liq helmet
ostida qoladi.

## Deploy

Baza migratsiyasi kerak emas, nginx va CORS ham o'zgarmaydi (`/api/docs`
mavjud `api.natija.sodiqschool.uz` host ostida). Server tomonda:

```bash
cd /opt/sodiq
git pull origin main
npm install                                 # swagger-ui-express qo'shildi
npm run build --workspace @sodiq/compute
npm run build --workspace backend
pm2 restart sodiq-backend
```

Tekshirish:

```bash
curl -sI https://api.natija.sodiqschool.uz/api/docs           # 301 → /api/docs/
curl -sI https://api.natija.sodiqschool.uz/api/docs/          # 200, text/html
curl -s  https://api.natija.sodiqschool.uz/api/docs/openapi.json | head -c 80
```

Umumiy deploy tartibi: [`deploy-test-app.md`](./deploy-test-app.md).
