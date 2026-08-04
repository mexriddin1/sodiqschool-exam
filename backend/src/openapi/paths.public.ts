// Ochiq (admin sessiyasisiz) marshrutlar:
//   /health                 — tiriklik tekshiruvi
//   /api/public/config      — client va test-app SSR uchun sozlamalar
//   /api/result/**          — ota-ona hisoboti
//   /api/test-taking/**     — qabul testi funneli

import { arrayOf, errors, okResponse, ref, type JsonObject } from "./components.js";

const RESULT_SESSION = [{ resultCookie: [] }, { resultBearer: [] }];
const GATE = [{ funnelGate: [] }];

const jsonBody = (schema: JsonObject, required = true): JsonObject => ({
  required,
  content: { "application/json": { schema } },
});

const tokenParam = {
  name: "token",
  in: "path",
  required: true,
  description: "Urinish tokeni (`clientToken`) — `POST /api/test-taking/attempts` qaytargan.",
  schema: { type: "string" },
};

export const publicPaths: JsonObject = {
  // =========================================================================
  // Xizmat
  // =========================================================================
  "/health": {
    get: {
      tags: ["Xizmat"],
      summary: "Tiriklik tekshiruvi",
      description:
        "Bazaga TEGMAYDI — faqat jarayon javob berayotganini bildiradi. " +
        "Ya'ni Postgres yiqilgan bo'lsa ham `ok` qaytadi.",
      security: [],
      responses: {
        200: {
          description: "Jarayon tirik.",
          content: {
            "application/json": {
              schema: { type: "object", properties: { ok: { type: "boolean", const: true } } },
            },
          },
        },
      },
    },
  },

  "/api/public/config": {
    get: {
      tags: ["Ochiq · Sozlama"],
      summary: "Ochiq sozlamalar",
      description:
        "Client (Astro) har sahifada SSR paytida chaqiradi. `funnelOpen` va " +
        "`funnelGate` test-app'ga xato o'rniga tushunarli sahifa ko'rsatish " +
        "imkonini beradi — bular QO'RIQCHI EMAS: qiymatni o'zgartirib testni " +
        "ochib bo'lmaydi, haqiqiy to'siq server tomonda.\n\n" +
        "Parolning o'zi ham, hash'i ham qaytarilmaydi — faqat kerak-kerakmasligi.",
      security: [],
      responses: {
        200: okResponse("Sozlamalar.", {
          type: "object",
          properties: {
            contactPhone: { type: "string", description: "Bo'sh bo'lishi mumkin." },
            funnelOpen: { type: "boolean" },
            funnelGate: { type: "boolean", description: "Kirish paroli o'rnatilganmi." },
          },
        }),
      },
    },
  },

  // =========================================================================
  // Ota-ona hisoboti
  // =========================================================================
  "/api/result/auth/login": {
    post: {
      tags: ["Ochiq · Hisobot"],
      summary: "Kod va parol bilan kirish",
      description:
        "Ikki bosqichli tekshiruv: avval `Student.loginCode` (yangi tizim), " +
        "topilmasa `Result.publicCode` (eski kredensiallar). Eski kod bilan " +
        "kirgan foydalanuvchiga ham o'quvchi ustidan token beriladi — eski " +
        "havolalar buzilmasin.\n\n" +
        "**Limit: 10 daqiqada 30 muvaffaqiyatSIZ urinish/IP.** Muvaffaqiyatlisi " +
        "sanalmaydi, chunki mobil operatorlar CGNAT ishlatadi — bitta tashqi IP " +
        "ortida yuzlab ota-ona bo'lishi mumkin.\n\n" +
        "Token cookie sifatida ham, tanada ham qaytadi: boshqa origin'dagi " +
        "mijozlar (Astro SSR) uni `Authorization: Bearer` bilan uzatadi.",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["code", "password"],
        properties: {
          code: {
            type: "string",
            minLength: 4,
            maxLength: 32,
            description: "Eski 6 belgili kod ham, yangi `<F><I><UID>` shakli ham qabul qilinadi.",
          },
          password: { type: "string", minLength: 1 },
        },
      }),
      responses: {
        200: okResponse("Kirildi.", {
          type: "object",
          properties: {
            studentId: { type: "string", format: "uuid" },
            token: { type: "string", description: "JWT, 1 kun." },
          },
        }),
        ...errors("BadRequest", "Unauthorized", "TooManyRequests"),
      },
    },
  },

  "/api/result/auth/lookup": {
    post: {
      tags: ["Ochiq · Hisobot"],
      summary: "Familya, ism va sinf bilan kirish",
      description:
        "Ota-onalar kod va parolni yo'qotib qo'ygani uchun qo'shilgan.\n\n" +
        "**Bu — QIDIRUV, autentifikatsiya emas.** Ism-familya-sinf sir emas, " +
        "ya'ni hisobot amalda ochiq. Ataylab shunday (`docs/security-notes.md`); " +
        "yagona to'siq — yuqoridagi rate limiter.\n\n" +
        "Ismlar bayt-ma-bayt teng bo'lishi shart emas — solishtirish " +
        "normallashtirilgan holda ketadi. Bir xil ism-familya-sinfli bir nechta " +
        "o'quvchi bo'lishi mumkin (funnel formani ikki marta to'ldirgan bola " +
        "uchun yangi yozuv yaratadi), shuning uchun token BARCHA mos kelgan " +
        "id'larni ko'taradi va `/list` ularning natijalarini birlashtiradi.\n\n" +
        "Natijasi yo'q o'quvchi umuman topilmaydi — bo'sh sessiya ochishdan ko'ra " +
        "\"topilmadi\" deyish to'g'riroq (va o'quvchining mavjudligini oshkor qilmaydi).",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["lastName", "firstName", "grade"],
        properties: {
          lastName: { type: "string", minLength: 1, maxLength: 80 },
          firstName: { type: "string", minLength: 1, maxLength: 80 },
          grade: {
            type: "integer",
            minimum: 5,
            maximum: 11,
            description: "Imtihon TOPSHIRGAN PAYTDAGI sinf.",
          },
        },
      }),
      responses: {
        200: okResponse("Topildi.", {
          type: "object",
          properties: {
            studentId: { type: "string", format: "uuid", description: "Mos kelganlarning birinchisi." },
            token: { type: "string" },
          },
        }),
        ...errors("BadRequest", "NotFound", "TooManyRequests"),
      },
    },
  },

  "/api/result/auth/logout": {
    post: {
      tags: ["Ochiq · Hisobot"],
      summary: "Hisobotdan chiqish",
      security: [],
      responses: {
        200: okResponse("Chiqildi.", {
          type: "object",
          properties: { loggedOut: { type: "boolean", const: true } },
        }),
      },
    },
  },

  "/api/result/auth/me": {
    get: {
      tags: ["Ochiq · Hisobot"],
      summary: "Joriy sessiya",
      description:
        "`studentIds` — familya+ism bilan kirilganda bir nechta bo'lishi mumkin. " +
        "`resultId` faqat ESKI tokenlarda to'ladi (o'shalarda sessiya bitta " +
        "natijaga bog'langan edi).",
      security: RESULT_SESSION,
      responses: {
        200: okResponse("Sessiya.", {
          type: "object",
          properties: {
            studentId: { type: ["string", "null"], format: "uuid" },
            studentIds: arrayOf({ type: "string", format: "uuid" }),
            resultId: { type: ["string", "null"], format: "uuid" },
            publicCode: { type: "string" },
          },
        }),
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/result/list": {
    get: {
      tags: ["Ochiq · Hisobot"],
      summary: "Sessiyaga tegishli natijalar",
      description:
        "Arxivlanganlar chiqmaydi. Client shu ro'yxatga qarab yo'l tanlaydi:\n" +
        "- 0 → \"Sizga hali natija biriktirilmagan\"\n" +
        "- 1 → to'g'ridan-to'g'ri hisobotga o'tadi\n" +
        "- 2+ → tanlash sahifasi\n\n" +
        "`multipleStudents: true` — sessiyada bir nechta o'quvchi yozuvi bor, " +
        "ya'ni qatorlarni sana bilan farqlash kerak.",
      security: RESULT_SESSION,
      responses: {
        200: okResponse("Natijalar.", {
          type: "object",
          properties: {
            student: {
              type: "object",
              properties: { fullName: { type: "string" }, grade: { type: "integer" } },
            },
            multipleStudents: { type: "boolean" },
            results: arrayOf({
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                publicCode: { type: "string" },
                status: { type: "string" },
                publishedAt: { type: ["string", "null"], format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
                exam: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    examDate: { type: "string", format: "date-time" },
                    academicYear: { type: ["string", "null"] },
                    grade: { type: "integer" },
                  },
                },
                compositeScore: { type: ["number", "null"], description: "Snapshotdagi umumiy ball." },
              },
            }),
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/result/me": {
    get: {
      tags: ["Ochiq · Hisobot"],
      summary: "Hisobotning to'liq ma'lumoti",
      description:
        "`resultId` berilmasa sessiyadagi eng oxirgi natija olinadi. Egalik " +
        "TEKSHIRILADI — begona `resultId` bilan boshqa o'quvchining hisobotini " +
        "ochib bo'lmaydi (404 qaytadi).\n\n" +
        "Raqamlar `calculatedSnapshot` dan (muzlatilgan) o'qiladi, qayta " +
        "hisoblanmaydi. `roadmapOpen` ni SERVER hisoblaydi — bitta \"hozir\" " +
        "bo'lsin uchun.",
      security: RESULT_SESSION,
      parameters: [
        {
          name: "resultId",
          in: "query",
          description: "Qaysi natija. Berilmasa eng oxirgisi.",
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: okResponse("Hisobot ma'lumoti.", {
          type: "object",
          properties: {
            student: {
              type: "object",
              properties: {
                fullName: { type: "string" },
                grade: { type: "integer" },
                sex: { type: ["string", "null"] },
              },
            },
            exam: {
              type: "object",
              properties: {
                title: { type: "string" },
                examDate: { type: "string", format: "date-time" },
                grade: { type: "integer" },
                academicYear: { type: ["string", "null"] },
                cohortSize: { type: ["integer", "null"] },
                gradingConfiguration: { type: "object", additionalProperties: true },
              },
            },
            publishedAt: { type: ["string", "null"], format: "date-time" },
            manualContent: { type: "object", additionalProperties: true },
            subjects: arrayOf({
              type: "object",
              properties: {
                subject: { type: "string" },
                totalQuestions: { type: "integer" },
                totalMarks: { type: "integer" },
                questions: arrayOf(ref("Question")),
                realData: ref("RealData"),
                manualNotes: { type: ["object", "null"], additionalProperties: true },
              },
            }),
            calculatedSnapshot: { type: ["object", "null"], additionalProperties: true },
            aiNarrative: { type: ["object", "null"], additionalProperties: true },
            aiRoadmap: { type: ["object", "null"], additionalProperties: true },
            resources: {
              type: "object",
              additionalProperties: true,
              description:
                "Admin boshqaradigan o'quv resurslari katalogi: fan → mavzu → `{uz, en}`. " +
                "Bo'sh `{}` bo'lsa compute o'zining zaxira `resources.json` ini ishlatadi.",
            },
            unlockedSections: arrayOf({ type: "string" }),
            roadmapOpen: {
              type: "boolean",
              description: '"Rivojlanish yo\'li" hozir ochiqmi (ochilganidan 20 daqiqa ichida).',
            },
            resultId: { type: "string", format: "uuid" },
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Qabul testi (funnel)
  // =========================================================================
  "/api/test-taking/gate": {
    post: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Kirish paroli bilan qurilmani ro'yxatdan o'tkazish",
      description:
        "Maktab laptoplari uchun umumiy parol. Muvaffaqiyatda 365 kunlik token " +
        "qaytadi — qurilma bir marta kiradi va o'zi chiqmaguncha kirgan holicha " +
        "qoladi. Bekor qilishning yagona yo'li — sozlamadan parolni almashtirish " +
        "(eski tokenlar rad etiladi).\n\n" +
        "Parol o'rnatilmagan bo'lsa `{ token: null, required: false }` qaytadi va " +
        "hech narsa talab qilinmaydi.\n\n" +
        "**Limit: 15 daqiqada 20 urinish/IP.**",
      security: [],
      requestBody: jsonBody({
        type: "object",
        properties: { password: { type: "string" } },
      }),
      responses: {
        200: okResponse("Parol to'g'ri yoki umuman kerak emas.", {
          type: "object",
          properties: {
            token: { type: ["string", "null"] },
            required: { type: "boolean" },
          },
        }),
        401: {
          description: "`BAD_PASSWORD` — parol noto'g'ri.",
          content: { "application/json": { schema: ref("ErrorResponse") } },
        },
        ...errors("TooManyRequests"),
      },
    },
  },

  "/api/test-taking/leads": {
    post: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Ariza formasini yuborish",
      description:
        "Nomzodni ro'yxatga oladi va `leadId` qaytaradi. **O'quvchi (Student) bu " +
        "yerda YARATILMAYDI** — u faqat uchala fan topshirilgach tug'iladi, " +
        "shunda chala qolgan odam admin \"o'quvchilar\" ro'yxatida ko'rinmaydi.\n\n" +
        "IP va User-Agent yozib qo'yiladi.\n\n" +
        "Qabul testi yopiq bo'lsa 403 (`FUNNEL_CLOSED`); parol o'rnatilgan bo'lib " +
        "token berilmasa 401 (`GATE_REQUIRED`).",
      security: GATE,
      requestBody: jsonBody({
        type: "object",
        required: ["firstName", "lastName", "sex", "phone", "grade", "examLanguage"],
        properties: {
          firstName: { type: "string", minLength: 1 },
          lastName: { type: "string", minLength: 1 },
          sex: { type: "string", enum: ["MALE", "FEMALE"] },
          phone: { type: "string", minLength: 6, maxLength: 24 },
          grade: { type: "integer", minimum: 5, maximum: 11 },
          examLanguage: {
            type: "string",
            enum: ["UZ", "RU", "EN"],
            description: "Savollar ham, test-app interfeysi ham shu tilda bo'ladi.",
          },
          previousSchool: { type: "string", maxLength: 200 },
        },
      }),
      responses: {
        200: okResponse("Ro'yxatga olindi.", {
          type: "object",
          properties: { leadId: { type: "string", format: "uuid" } },
        }),
        ...errors("BadRequest", "Unauthorized", "Forbidden"),
      },
    },
  },

  "/api/test-taking/leads/{leadId}/tests": {
    parameters: [
      {
        name: "leadId",
        in: "path",
        required: true,
        description:
          "**Diqqat:** bu id test-app URL'ida ochiq turadi — havolaga ega odam " +
          "lead nomini ko'radi va uning nomidan test boshlay oladi.",
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Nomzodga tegishli testlar ro'yxati",
      description:
        "Lead sinfiga va tiliga mos testlar. Tartib QAT'IY: matematika → ingliz " +
        "tili → tanqidiy fikrlash (alifbo tartibi tanqidiy fikrlashni birinchi " +
        "qo'yardi).\n\n" +
        "Tartib faqat KO'RSATISHDA — qo'riqchi emas: `/attempts` ga to'g'ridan-" +
        "to'g'ri so'rov yuborib istalgan testni boshlash mumkin. Funnel lead " +
        "yig'ish uchun, nazorat ostidagi imtihon emas.\n\n" +
        "`lead.examLanguage` javobda KERAK: test-app butun interfeysni shu tilda " +
        "ko'rsatadi.",
      security: GATE,
      responses: {
        200: okResponse("Testlar.", {
          type: "object",
          properties: {
            items: arrayOf({
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                subject: { type: "string" },
                grade: { type: "integer" },
                languages: arrayOf({ type: "string" }),
                durationSec: { type: ["integer", "null"] },
                questionCount: { type: "integer" },
                completed: { type: "boolean", description: "Shu lead uni allaqachon topshirganmi." },
              },
            }),
            lead: {
              type: "object",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                grade: { type: "integer" },
                examLanguage: { type: "string" },
              },
            },
          },
        }),
        ...errors("Unauthorized", "Forbidden", "NotFound"),
      },
    },
  },

  "/api/test-taking/attempts": {
    post: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Urinishni boshlash",
      description:
        "Urinish yaratadi va savollarni **javoblarsiz** qaytaradi (`stripAnswers`). " +
        "Matn lead tilida bitta satrga yechiladi — boshqa tarjimalar brauzerga " +
        "umuman yetib bormaydi.\n\n" +
        "Qaytgan `token` — shu urinishning siri: javob saqlash va yakunlash aynan " +
        "shu bilan ketadi, ya'ni faqat testni boshlagan brauzer uni o'zgartira oladi.",
      security: GATE,
      requestBody: jsonBody({
        type: "object",
        required: ["leadId", "testId"],
        properties: {
          leadId: { type: "string", format: "uuid" },
          testId: { type: "string", format: "uuid" },
        },
      }),
      responses: {
        200: okResponse("Urinish boshlandi.", {
          type: "object",
          properties: {
            token: { type: "string" },
            attemptId: { type: "string", format: "uuid" },
            test: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                subject: { type: "string" },
                grade: { type: "integer" },
                durationSec: { type: ["integer", "null"] },
              },
            },
            startedAt: { type: "string", format: "date-time" },
            questions: arrayOf(ref("PublicTestQuestion")),
          },
        }),
        ...errors("BadRequest", "Unauthorized", "Forbidden", "NotFound"),
      },
    },
  },

  "/api/test-taking/attempts/{token}": {
    parameters: [tokenParam],
    get: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Urinishni tiklash (sahifa yangilangach)",
      description:
        "Saqlangan javoblar va savollar qaytadi; variantlar tartibi o'zgarmaydi " +
        "(aralashtirish urug'i — urinish id'si).\n\n" +
        "Urinish allaqachon yakunlangan bo'lsa qisqartirilgan javob keladi " +
        "(`finished: true`, savollarsiz) — u yakuniy sahifaga navbatdagi testni " +
        "topish uchun yetadi.\n\n" +
        "Kirish paroli bu yerda SO'RALMAYDI: token'ga ega brauzer testni " +
        "allaqachon boshlagan.",
      security: [],
      responses: {
        200: okResponse("Urinish holati.", {
          oneOf: [
            {
              type: "object",
              title: "Davom etayotgan",
              properties: {
                token: { type: "string" },
                attemptId: { type: "string", format: "uuid" },
                examLanguage: { type: "string", enum: ["UZ", "RU", "EN"] },
                test: { type: "object", additionalProperties: true },
                startedAt: { type: "string", format: "date-time" },
                answers: { type: "object", additionalProperties: true },
                questions: arrayOf(ref("PublicTestQuestion")),
                finished: { type: "boolean", const: false },
              },
            },
            {
              type: "object",
              title: "Yakunlangan",
              properties: {
                token: { type: "string" },
                submittedAt: { type: "string", format: "date-time" },
                finished: { type: "boolean", const: true },
                leadId: { type: "string", format: "uuid" },
                examLanguage: { type: "string" },
                test: { type: "object", additionalProperties: true },
              },
            },
          ],
        }),
        ...errors("NotFound"),
      },
    },
  },

  "/api/test-taking/attempts/{token}/answers": {
    parameters: [tokenParam],
    patch: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Javoblarni saqlash (avtosaqlash)",
      description:
        "Butun javoblar to'plamini ALMASHTIRADI (qo'shmaydi). Yakunlangan " +
        "urinishga yozib bo'lmaydi (`ALREADY_SUBMITTED`).\n\n" +
        "Kirish paroli ATAYLAB so'ralmaydi: admin parolni almashtirgan zahoti " +
        "test yozib o'tirgan bolaning ishi yo'qolmasin.",
      security: [],
      requestBody: jsonBody(ref("AttemptAnswers")),
      responses: {
        200: okResponse("Saqlandi.", {
          type: "object",
          properties: { saved: { type: "boolean", const: true } },
        }),
        ...errors("BadRequest", "NotFound"),
      },
    },
  },

  "/api/test-taking/attempts/{token}/submit": {
    parameters: [tokenParam],
    post: {
      tags: ["Ochiq · Qabul testi"],
      summary: "Urinishni yakunlash",
      description:
        "Tanada javoblar berilsa o'shalar olinadi (oxirgi imkoniyat), aks holda " +
        "saqlanganlari.\n\n" +
        "**Uchala fan tugamagan bo'lsa** — faqat shu urinish yakunlangan deb " +
        "belgilanadi; o'quvchi, natija va hisobot HALI yaratilmaydi " +
        "(`completed: false`).\n\n" +
        "**Uchala fan yig'ilganda** — o'quvchi yaratiladi, kirish kodi va paroli " +
        "biriktiriladi, uchala fan qayta baholanadi, natija DARHOL nashr etiladi " +
        "va \"Rivojlanish yo'li\" 20 daqiqaga ochiladi. AI tahlili bu yerda " +
        "yozilmaydi — kerak bo'lsa admin `generate-ai` bilan yozdiradi.\n\n" +
        "Og'ir yozuvlar urinish \"yakunlangan\" deb belgilanishidan OLDIN " +
        "bajariladi: o'sha blok yiqilsa urinish ochiq qoladi va o'quvchi qayta " +
        "urina oladi.\n\n" +
        "Bir fan qayta topshirilsa eng oxirgi urinish hisobga olinadi va natija " +
        "dublikat bo'lmaydi — mavjud arxivlanmagan natija qayta ishlatiladi.",
      security: [],
      requestBody: jsonBody(
        {
          allOf: [
            ref("AttemptAnswers"),
            {
              type: "object",
              properties: {
                autoSubmitted: {
                  type: "boolean",
                  description: "Vaqt tugab avtomatik yuborilganmi. Faqat kuzatuv uchun.",
                },
              },
            },
          ],
        },
        false,
      ),
      responses: {
        200: okResponse("Yakunlandi.", {
          type: "object",
          properties: {
            resultId: {
              type: ["string", "null"],
              format: "uuid",
              description: "Faqat imtihon to'liq tugagan bo'lsa.",
            },
            scoreRaw: { type: "integer", description: "Shu fan bo'yicha to'plangan ball." },
            scoreMax: { type: "integer" },
            completed: { type: "boolean", description: "Uchala fan ham topshirildimi." },
            subjectsDone: { type: "integer" },
          },
        }),
        ...errors("BadRequest", "NotFound"),
      },
    },
  },
};
