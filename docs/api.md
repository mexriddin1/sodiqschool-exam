# API ma'lumotnomasi

To'liq, mashina o'qiy oladigan ma'lumotnoma — **OpenAPI 3.1 spetsifikatsiyasi**:

| | |
| --- | --- |
| Swagger UI (jonli) | <https://api.natija.sodiqschool.uz/api/docs> |
| Swagger UI (lokal) | <http://localhost:4000/api/docs> |
| Xom spec | `/api/docs/openapi.json` |
| Repodagi nusxa | [`docs/openapi.json`](./openapi.json) |

Spec manbasi — `backend/src/openapi/`. Yangi endpoint qo'shsangiz uni ham
yozing: `npm test --workspace backend` qamrovni tekshiradi va yozilmagan
marshrutda yiqiladi. Batafsil: [`api-swagger.md`](./api-swagger.md).

Quyida — spec'ni ochishdan oldin bilish foydali bo'lgan umumiy qoidalar.

## Javob konverti

Muvaffaqiyat:

```json
{ "success": true, "data": {} }
```

Xato:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {} } }
```

`fields` — Zod xatolarida maydon yo'li → xabar (`subjects.0.questions`).

Faqat ikki endpoint bu konvertdan tashqarida, chunki fayl beradi:
`GET /api/admin/results/export.csv` va `GET /api/admin/results/{id}/pdf`.

## Uch xil sessiya

| Kim | Qanday | Muddat |
| --- | --- | --- |
| Admin | `sodiq_admin` cookie (`POST /api/admin/auth/login`) | 7 kun |
| Ota-ona | `sodiq_result` cookie **yoki** `Authorization: Bearer` | 1 kun |
| Qabul testi qurilmasi | `Authorization: Bearer` (`POST /api/test-taking/gate`) | 365 kun |

Uchalasi alohida kalit bilan imzolanadi. Admin marshrutlari FAQAT cookie'ni
o'qiydi — ularga `Authorization` sarlavhasi bilan kirib bo'lmaydi.

Ota-ona tokeni ikki yo'l bilan olinadi:

- `POST /api/result/auth/login` — kirish kodi + parol;
- `POST /api/result/auth/lookup` — familya + ism + sinf (kod/parolsiz).

Ikkalasi ham `{ studentId, token }` qaytaradi. **Diqqat:** bu hujjatning eski
versiyasida `resultId` deb yozilgan edi — 2026-07-03 dan beri sessiya natijaga
emas, o'quvchiga bog'lanadi va bitta o'quvchining bir nechta natijasi bo'lishi
mumkin (`GET /api/result/list`).

## Sahifalash

Ro'yxat endpointlari `?page=` va `?take=` ni oladi:

```json
{ "items": [], "total": 0, "page": 1, "take": 50, "pages": 1 }
```

`take` ning standarti va chegarasi endpointga qarab boshqacha (o'quvchilar 10 /
1000, natijalar 50 / 200, statistika 100 / 10 000). Chegaradan oshgan qiymat
jimgina qisqartiriladi.

Ba'zi ro'yxatlarda `counts` bloki bor. U **bazadan** sanaladi va o'zi
bo'linayotgan o'lchov filtriga bo'ysunmaydi — nishonlar hamisha to'liq
manzarani bersin.

## Limitlar

| Nima | Limit |
| --- | --- |
| `/api/admin/**` | 240 so'rov/daqiqa/IP |
| `POST /api/admin/auth/login` | 15 daqiqada 10 urinish/IP |
| `POST /api/result/auth/login`, `/auth/lookup` | 10 daqiqada 30 **muvaffaqiyatsiz** urinish/IP |
| `POST /api/test-taking/gate` | 15 daqiqada 20 urinish/IP |
| `/api/test-taking` ning qolgani | limitsiz |

Ota-ona kirishida faqat xato urinishlar sanaladi: mobil operatorlar CGNAT
ishlatadi, ya'ni bitta tashqi IP ortida yuzlab ota-ona bo'lishi mumkin.

So'rov tanasi 5 MB gacha.

## Bilib qo'yish kerak

- **Qabul testi nazorat ostidagi imtihon emas.** Fanlar tartibi faqat
  interfeysda; `/api/test-taking/attempts` ga to'g'ridan-to'g'ri so'rov
  yuborib istalgan testni boshlash mumkin. Bu — lead yig'uvchi funnel.
  Qarang [`test-taking-plan.md`](./test-taking-plan.md).
- **`/api/result/auth/lookup` — qidiruv, autentifikatsiya emas.** Familya,
  ism va sinf sir emas. Ataylab shunday; qarang
  [`security-notes.md`](./security-notes.md).
- **Ota-onaga ko'rsatiladigan raqamlar muzlatilgan** (`calculatedSnapshot`).
  Hisob mantiqi o'zgarsa eski natijalar o'z-o'zidan yangilanmaydi —
  `POST /api/admin/results/{id}/recompute-snapshot` kerak bo'ladi.
  Formulalar: [`calculation-rules.md`](./calculation-rules.md).
- **Natijalar yaratilishi bilan nashr etiladi.** Alohida "Nashr etish" qadami
  yo'q; `publish` endpointi `unpublish` dan keyin qaytarish uchun qolgan.
- **"Rivojlanish yo'li" 20 daqiqalik oyna**, doimiy toggle emas —
  `unlockedSections` orqali boshqarilmaydi.

## Savol JSON'lari

Har 6 tur uchun namunalar (3 tilli):
[`json-namunalar.md`](./json-namunalar.md).
