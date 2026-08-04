// `/api/admin/**` — admin paneli marshrutlari.
//
// Hammasi `sodiq_admin` cookie'sini talab qiladi (`requireAdmin`), va
// `/api/admin` prefiksi butunlay 240 so'rov/daqiqa/IP limiteri ostida.
// Foydalanuvchilar bo'limi bundan tashqari `ADMIN` rolini ham talab qiladi.

import {
  arrayOf, countsOf, errors, okResponse, paginated, ref, type JsonObject,
} from "./components.js";

const ADMIN = [{ adminCookie: [] }];

/** Sahifalash parametrlari + qo'shimchalar. */
const page = (...extra: JsonObject[]): JsonObject[] => [
  { $ref: "#/components/parameters/Page" },
  { $ref: "#/components/parameters/Take" },
  ...extra,
];

const idParam = { $ref: "#/components/parameters/PathId" };

const jsonBody = (schema: JsonObject, required = true): JsonObject => ({
  required,
  content: { "application/json": { schema } },
});

export const adminPaths: JsonObject = {
  // =========================================================================
  // Auth
  // =========================================================================
  "/api/admin/auth/login": {
    post: {
      tags: ["Admin · Auth"],
      summary: "Admin sifatida kirish",
      description:
        "Muvaffaqiyatda `sodiq_admin` httpOnly cookie qo'yiladi (JWT, 7 kun).\n\n" +
        "**Limit: 15 daqiqada 10 urinish/IP** — muvaffaqiyatlisi ham sanaladi. " +
        "Lokal ishlab chiqishda bu tez tugaydi; hisoblagich xotirada, backend " +
        "qayta ishga tushirilsa nollanadi.\n\n" +
        "Email topilmasa ham, parol noto'g'ri bo'lsa ham AYNAN bir xil xato " +
        "qaytadi — qaysi email ro'yxatdan o'tganini bilib bo'lmasin.",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1 },
        },
      }),
      responses: {
        200: okResponse("Kirildi; cookie o'rnatildi.", ref("AdminUser")),
        ...errors("BadRequest", "Unauthorized", "TooManyRequests"),
      },
    },
  },

  "/api/admin/auth/logout": {
    post: {
      tags: ["Admin · Auth"],
      summary: "Chiqish",
      description: "Cookie'ni o'chiradi. Token serverda bekor qilinmaydi (bazada saqlanmaydi).",
      security: [],
      responses: {
        200: okResponse("Chiqildi.", {
          type: "object",
          properties: { loggedOut: { type: "boolean", const: true } },
        }),
      },
    },
  },

  "/api/admin/auth/me": {
    get: {
      tags: ["Admin · Auth"],
      summary: "Joriy admin",
      security: ADMIN,
      responses: {
        200: okResponse("Sessiyadagi admin.", {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["ADMIN", "EDITOR"] },
            fullName: { type: "string" },
            email: { type: "string" },
          },
        }),
        ...errors("Unauthorized"),
      },
    },
  },

  // =========================================================================
  // O'quvchilar
  // =========================================================================
  "/api/admin/students": {
    get: {
      tags: ["Admin · O'quvchilar"],
      summary: "O'quvchilar ro'yxati",
      description:
        "Standart 10 qator, `take` bo'yicha eng ko'pi 1000 — kombobokslar butun " +
        "ro'yxatni bitta so'rovda olishi uchun.",
      security: ADMIN,
      parameters: page(
        { $ref: "#/components/parameters/Search" },
        { $ref: "#/components/parameters/Grade" },
        { name: "sex", in: "query", schema: { type: "string", enum: ["MALE", "FEMALE"] } },
        {
          name: "sort",
          in: "query",
          schema: {
            type: "string",
            enum: ["created-desc", "name-asc", "grade-asc", "grade-desc"],
            default: "created-desc",
          },
        },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat.",
          paginated(ref("Student"), {
            counts: countsOf({
              byGrade: { type: "object", additionalProperties: { type: "integer" } },
              male: { type: "integer" },
              female: { type: "integer" },
              unknownSex: {
                type: "integer",
                description: "Jinsi kiritilmaganlar — o'g'il+qiz jamiga teng chiqmasa, farq shu.",
              },
            }),
          }),
        ),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · O'quvchilar"],
      summary: "O'quvchi qo'shish",
      description:
        "`fullName` YOKI `firstName` + `lastName` berilishi shart — server ikkinchi " +
        "shaklni birinchisidan hosil qiladi (birinchi bo'shliq bo'yicha, ya'ni " +
        "ko'p so'zli familya butun qoladi).\n\n" +
        "Yaratilgach o'quvchiga bir marta login kodi va parol biriktiriladi.",
      security: ADMIN,
      requestBody: jsonBody(ref("StudentCreate")),
      responses: {
        200: okResponse("Yaratildi (login kodi va paroli bilan).", ref("Student")),
        ...errors("BadRequest", "Unauthorized", "Conflict"),
      },
    },
  },

  "/api/admin/students/import": {
    post: {
      tags: ["Admin · O'quvchilar"],
      summary: "O'quvchilarni ommaviy import qilish (JSON)",
      description:
        "Bitta qator yiqilsa butun paket to'xtamaydi — u `skipped` ga sababi bilan " +
        "tushadi. `uid` bo'yicha takrorlanganlar o'tkazib yuboriladi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["students"],
        properties: {
          students: { type: "array", minItems: 1, maxItems: 2000, items: ref("StudentCreate") },
        },
      }),
      responses: {
        200: okResponse("Import hisoboti.", {
          type: "object",
          properties: {
            created: { type: "integer" },
            total: { type: "integer" },
            skipped: arrayOf({
              type: "object",
              properties: { input: { type: "object", additionalProperties: true }, reason: { type: "string" } },
            }),
          },
        }),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },

  "/api/admin/students/credentials": {
    get: {
      tags: ["Admin · O'quvchilar"],
      summary: "Kirish kodlari ro'yxati (imtihon bo'yicha)",
      description:
        "Faqat shu imtihonda ARXIVLANMAGAN natijasi bor o'quvchilar. Har o'quvchi " +
        "bir marta chiqadi — login/parol o'quvchiga tegishli, bir necha natija " +
        "bitta kredensialdan foydalanadi.",
      security: ADMIN,
      parameters: [
        { name: "examId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
        { $ref: "#/components/parameters/Grade" },
      ],
      responses: {
        200: okResponse("Kredensiallar.", {
          type: "object",
          properties: {
            examId: { type: "string", format: "uuid" },
            grade: { type: ["integer", "null"] },
            count: { type: "integer" },
            rows: arrayOf({
              type: "object",
              properties: {
                studentId: { type: "string", format: "uuid" },
                fullName: { type: "string" },
                grade: { type: "integer" },
                uid: { type: ["string", "null"] },
                loginCode: { type: ["string", "null"] },
                password: { type: ["string", "null"] },
                resultCode: { type: "string" },
                hasCredentials: { type: "boolean" },
              },
            }),
          },
        }),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },

  "/api/admin/students/{id}": {
    parameters: [idParam],
    get: {
      tags: ["Admin · O'quvchilar"],
      summary: "O'quvchi detali",
      description: "Natijalari (imtihoni bilan) ichma-ich keladi.",
      security: ADMIN,
      responses: {
        200: okResponse("O'quvchi.", {
          allOf: [ref("Student"), { type: "object", properties: { results: arrayOf(ref("Result")) } }],
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
    patch: {
      tags: ["Admin · O'quvchilar"],
      summary: "O'quvchini tahrirlash",
      description:
        "Qisman yangilash. Ism maydonlaridan biri o'zgarsa, ikkinchisi qayta " +
        "hosil qilinadi — `fullName` bilan `firstName`/`lastName` bir-biridan ajralib qolmasin.",
      security: ADMIN,
      requestBody: jsonBody(ref("StudentUpdate")),
      responses: {
        200: okResponse("Yangilandi.", ref("Student")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · O'quvchilar"],
      summary: "O'quvchini o'chirish",
      description:
        "**Kaskad**: o'quvchi + barcha natija/hisobot/urinish/lead. Natijasi bor " +
        "o'quvchini o'chirib bo'lmaydi degan cheklov YO'Q — hammasi birga ketadi.",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Imtihonlar
  // =========================================================================
  "/api/admin/exams": {
    get: {
      tags: ["Admin · Imtihonlar"],
      summary: "Imtihonlar ro'yxati",
      description: "`grade` filtri eski `grade` ustunini ham, yangi `grades[]` massivini ham tekshiradi.",
      security: ADMIN,
      parameters: page(
        { $ref: "#/components/parameters/Grade" },
        { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] } },
        { name: "academicYear", in: "query", schema: { type: "string" } },
        { $ref: "#/components/parameters/Search" },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat.",
          paginated(ref("Exam"), {
            counts: countsOf({
              DRAFT: { type: "integer" },
              ACTIVE: { type: "integer" },
              ARCHIVED: { type: "integer" },
            }),
          }),
        ),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · Imtihonlar"],
      summary: "Imtihon yaratish",
      description:
        "`admissionThresholds` MAJBURIY. `grade` yoki `grades` dan kamida bittasi " +
        "berilsin — server ularni moslashtiradi (`grades[0]` eski ustunga yoziladi).",
      security: ADMIN,
      requestBody: jsonBody(ref("ExamCreate")),
      responses: {
        200: okResponse("Yaratildi.", ref("Exam")),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },

  "/api/admin/exams/{id}": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Imtihonlar"],
      summary: "Imtihon detali",
      security: ADMIN,
      responses: {
        200: okResponse("Imtihon (natijalar soni bilan).", ref("Exam")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
    patch: {
      tags: ["Admin · Imtihonlar"],
      summary: "Imtihonni tahrirlash",
      description:
        "`grade`/`grades` ikkalasi ham berilmasa sinflar TEGILMAYDI — faqat " +
        "sarlavhani o'zgartirgan patch sinflarni standartga qaytarib yubormasin.",
      security: ADMIN,
      requestBody: jsonBody(ref("ExamUpdate")),
      responses: {
        200: okResponse("Yangilandi.", ref("Exam")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · Imtihonlar"],
      summary: "Imtihonni o'chirish",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  "/api/admin/exams/{id}/recompute-cohort": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Imtihonlar"],
      summary: "Kohort reytingini qayta hisoblash",
      description:
        "Shu imtihonning barcha NASHR ETILGAN natijalari bo'yicha o'rin va " +
        "jins kesimidagi reytingni qaytadan yozadi. Yangi tengdosh qo'shilganda " +
        "yoki reyting mantiqi o'zgarganda kerak bo'ladi.",
      security: ADMIN,
      responses: {
        200: okResponse("Qayta hisoblandi.", {
          type: "object",
          properties: { recomputed: { type: "integer", description: "Ta'sirlangan nashr etilgan natijalar soni." } },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Natijalar
  // =========================================================================
  "/api/admin/results": {
    get: {
      tags: ["Admin · Natijalar"],
      summary: "Natijalar ro'yxati",
      security: ADMIN,
      parameters: page(
        { $ref: "#/components/parameters/ExamIdQuery" },
        { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] } },
        { $ref: "#/components/parameters/Grade" },
        { name: "q", in: "query", description: "Kod yoki o'quvchi ismi.", schema: { type: "string" } },
        {
          name: "today",
          in: "query",
          description: "`1` — faqat bugun (server vaqti bo'yicha yarim tundan) qo'shilganlar.",
          schema: { type: "string", enum: ["1", "true"] },
        },
        {
          name: "sort",
          in: "query",
          schema: { type: "string", enum: ["created-desc", "created-asc", "code-asc"], default: "created-desc" },
        },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat (yengil ustunlar — `manualContent` va snapshot yo'q).",
          paginated(
            {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                publicCode: { type: "string" },
                status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
                publishedAt: { type: ["string", "null"], format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                student: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    fullName: { type: "string" },
                    grade: { type: "integer" },
                  },
                },
                exam: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    title: { type: "string" },
                    grade: { type: "integer" },
                  },
                },
              },
            },
            {
              counts: countsOf({
                DRAFT: { type: "integer" },
                PUBLISHED: { type: "integer" },
                ARCHIVED: { type: "integer" },
              }),
            },
          ),
        ),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Natija yaratish (qo'lda)",
      description:
        "UCHALA fan ham berilishi shart. Server savollarni tekshiradi, hisob-kitobni " +
        "yozishdan OLDIN yugurtiradi (xato bo'lsa baza tegilmaydi), so'ng natijani " +
        "DARHOL NASHR ETADI va snapshotni muzlatadi — alohida \"Nashr etish\" qadami yo'q.\n\n" +
        "AI matni fon rejimida yaratiladi: javob Gemini'ni kutmaydi.\n\n" +
        "`credentials.password` faqat o'quvchiga kredensial SHU PAYT yaratilgan " +
        "bo'lsa qaytadi (`generated: true`); mavjud o'quvchida eski parol saqlanib qoladi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["studentId", "examId", "subjects"],
        properties: {
          studentId: { type: "string", format: "uuid" },
          examId: { type: "string", format: "uuid" },
          manualContent: ref("ManualContent"),
          subjects: { type: "array", minItems: 3, maxItems: 3, items: ref("SubjectInput") },
        },
      }),
      responses: {
        200: okResponse("Yaratildi va nashr etildi.", {
          type: "object",
          properties: {
            result: ref("Result"),
            credentials: {
              type: "object",
              properties: {
                loginCode: { type: ["string", "null"] },
                password: { type: ["string", "null"] },
                generated: { type: "boolean" },
              },
            },
          },
        }),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/export.csv": {
    get: {
      tags: ["Admin · Natijalar"],
      summary: "Natijalarni CSV qilib yuklab olish",
      description:
        "`GET /api/admin/results` bilan AYNAN bir xil filtrlarni oladi, lekin mos " +
        "kelgan hamma qatorni beradi (eng ko'pi 10 000). Ustunlar: qat'iy qism, " +
        "so'ng har fan uchun ball / maksimum / foiz. Sarlavha o'zbekcha va " +
        "faylda UTF-8 BOM bor — Excel diakritiklarni to'g'ri ochsin.",
      security: ADMIN,
      parameters: [
        { $ref: "#/components/parameters/ExamIdQuery" },
        { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] } },
        { $ref: "#/components/parameters/Grade" },
        { $ref: "#/components/parameters/Search" },
        { name: "today", in: "query", schema: { type: "string", enum: ["1", "true"] } },
        { name: "sort", in: "query", schema: { type: "string", enum: ["created-desc", "created-asc", "code-asc"] } },
      ],
      responses: {
        200: {
          description: "CSV fayl (`Content-Disposition: attachment`).",
          content: { "text/csv": { schema: { type: "string" } } },
        },
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/admin/results/import-csv": {
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Natijalarni ommaviy import qilish (CSV yoki JSON)",
      description:
        "`csv` (maktab jadvali matni) yoki `students` (JSON qatorlar) beriladi; " +
        "ikkalasi berilsa JSON afzal ko'riladi (u strukturaviy boyroq).\n\n" +
        "`dryRun: true` — hech narsa yozilmaydi, faqat tahlil va oldindan ko'rish " +
        "qaytadi. Har fan uchun kutilayotgan savollar soni imtihon SHABLONIDAN " +
        "olinadi; shablon yo'q fanlar `noTemplateSubjects` da ko'rsatiladi va " +
        "standart sonlar ishlatiladi (matem 25, tanqidiy 10, ingliz 50).\n\n" +
        "So'rov tanasi 5 MB gacha — bu ~300 qator × 95 ustun CSV ni qoplaydi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["examId"],
        properties: {
          examId: { type: "string", format: "uuid" },
          csv: { type: "string", description: "Xom CSV matni." },
          students: { type: "array", items: { type: "object", additionalProperties: true } },
          dryRun: { type: "boolean", default: false },
        },
      }),
      responses: {
        200: okResponse("Import hisoboti yoki oldindan ko'rish.", {
          type: "object",
          properties: {
            dryRun: { type: "boolean" },
            examId: { type: "string", format: "uuid" },
            expectedCounts: {
              type: "object",
              properties: {
                MATH: { type: "integer" },
                CRITICAL_THINKING: { type: "integer" },
                ENGLISH: { type: "integer" },
              },
            },
            noTemplateSubjects: arrayOf({ type: "string" }),
            totalRows: { type: "integer" },
            parseErrors: arrayOf({ type: "object", additionalProperties: true }),
            preview: {
              type: "array",
              description: "Faqat `dryRun` da. Eng ko'pi 500 qator.",
              items: { type: "object", additionalProperties: true },
            },
            created: { type: "array", description: "Faqat haqiqiy importda.", items: {} },
            skipped: { type: "array", items: {} },
          },
        }),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Natijalar"],
      summary: "Natija detali",
      security: ADMIN,
      responses: {
        200: okResponse("Natija (fanlar, o'quvchi, imtihon bilan).", ref("Result")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
    patch: {
      tags: ["Admin · Natijalar"],
      summary: "Natijani tahrirlash",
      description:
        "`subjects` berilsa — mavjud fanlar O'CHIRILIB qayta yoziladi (uchalasi " +
        "birga berilishi shart). Arxivlangan natija tahrirlanmaydi.\n\n" +
        "Diqqat: bu snapshotni qayta muzlatMAYDI — buning uchun " +
        "`POST /results/{id}/recompute-snapshot`.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        properties: {
          manualContent: ref("ManualContent"),
          subjects: { type: "array", minItems: 3, maxItems: 3, items: ref("SubjectInput") },
        },
      }),
      responses: {
        200: okResponse("Yangilandi.", ref("Result")),
        ...errors("BadRequest", "Unauthorized", "NotFound", "Conflict"),
      },
    },
    delete: {
      tags: ["Admin · Natijalar"],
      summary: "Natijani o'chirish",
      description: "Fan natijalari kaskad ketadi. Nashr etilgan bo'lsa kohort qayta hisoblanadi.",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/preview": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Natijalar"],
      summary: "Hisobotni oldindan ko'rish",
      description:
        "Hisob-kitob MUZLATILGAN snapshotdan emas, SHU PAYTDA qayta yugurtiriladi — " +
        "ya'ni tahrirdan keyingi holatni nashr qilmasdan ko'rish uchun.",
      security: ADMIN,
      responses: {
        200: okResponse("Hisoblangan ko'rinish.", {
          type: "object",
          properties: {
            student: ref("Student"),
            exam: ref("Exam"),
            manualContent: { type: "object", additionalProperties: true },
            subjects: arrayOf(ref("SubjectResult")),
            computed: {
              type: "object",
              additionalProperties: true,
              description: "@sodiq/compute chiqishi: `perSubject`, `composite`, `cohort`, ...",
            },
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/publish": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Nashr etish",
      description:
        "Snapshotni muzlatadi, kohort reytingini qayta hisoblaydi va " +
        '"Rivojlanish yo\'li" ning 20 daqiqalik oynasini ochadi. AI matni fon ' +
        "rejimida yaratiladi.\n\n" +
        "Uchala fan ham bo'lishi shart (`MISSING_SUBJECTS`). Odatda bu qadam " +
        "kerak emas — natijalar yaratilishi bilan nashr etiladi; bu endpoint " +
        "`unpublish` dan keyin qaytarish uchun.",
      security: ADMIN,
      responses: {
        200: okResponse("Nashr etildi.", ref("Result")),
        ...errors("BadRequest", "Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  "/api/admin/results/{id}/unpublish": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Nashrni bekor qilish",
      description: "Holatni `DRAFT` ga qaytaradi. Ota-ona hisobotni ko'ra olmay qoladi.",
      security: ADMIN,
      responses: {
        200: okResponse("Qoralamaga qaytarildi.", {
          type: "object",
          properties: { id: { type: "string" }, status: { type: "string", const: "DRAFT" } },
        }),
        ...errors("Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  "/api/admin/results/{id}/archive": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Arxivlash",
      description: "Ota-onadan butunlay yashiradi va tahrirlashni yopadi.",
      security: ADMIN,
      responses: {
        200: okResponse("Arxivlandi.", {
          type: "object",
          properties: { id: { type: "string" }, status: { type: "string", const: "ARCHIVED" } },
        }),
        ...errors("Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  "/api/admin/results/{id}/recompute-snapshot": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Snapshotni qayta muzlatish",
      description:
        "Hisob mantiqi o'zgargandan keyin eski snapshotlarni yangilash uchun. " +
        "Holatni ham, `publishedAt` ni ham O'ZGARTIRMAYDI.",
      security: ADMIN,
      responses: {
        200: okResponse("Qayta hisoblandi.", {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
            snapshot: { type: "object", additionalProperties: true },
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/generate-ai": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "AI tahlilini yaratish",
      description:
        "Gemini'ni SINXRON chaqiradi va `aiNarrative` / `aiRoadmap` / `aiUsage` ni " +
        "yozadi — javob 30 soniyagacha kutishi mumkin.\n\n" +
        "Qabul testi orqali kelgan natijalarda AI avtomatik YOZILMAYDI (har lead " +
        "uchun Gemini xarajati chiqmasin), shuning uchun kerakli natijalarda " +
        "shu tugma bosiladi. Uchala fan ham bo'lishi shart.",
      security: ADMIN,
      responses: {
        200: okResponse("Yaratildi.", {
          type: "object",
          properties: {
            narrative: { type: "object", additionalProperties: true },
            roadmap: { type: "object", additionalProperties: true },
            usage: { type: "object", additionalProperties: true },
          },
        }),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/impersonate-token": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Hisobotni admin nomidan ochish uchun token",
      description:
        "O'quvchi sessiyasini taqlid qiluvchi qisqa muddatli token (5 daqiqa). " +
        "Admin panel hisobot saytini iframe'da ochib, tokenni URL orqali uzatadi. " +
        "Muddat ataylab qisqa — havola brauzer tarixida qolib ketsa ham uzoq " +
        "yashaydigan sessiyaga aylanmasin.",
      security: ADMIN,
      responses: {
        200: okResponse("Token.", {
          type: "object",
          properties: {
            token: { type: "string" },
            expiresIn: { type: "integer", const: 300 },
            resultId: { type: "string", format: "uuid" },
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/open-roadmap": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "\"Rivojlanish yo'li\" ni 20 daqiqaga ochish",
      description:
        "Roadmap doimiy toggle EMAS — `unlockedSections` orqali boshqarilmaydi. " +
        "Nashr etish uni bir marta ochadi; bu endpoint keyinchalik qayta ochish uchun.",
      security: ADMIN,
      responses: {
        200: okResponse("Ochildi.", {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            roadmapOpenedAt: { type: "string", format: "date-time" },
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/unlocked-sections": {
    parameters: [idParam],
    patch: {
      tags: ["Admin · Natijalar"],
      summary: "Ochiq bo'limlarni belgilash",
      description:
        "Faqat `narrative` va `risks_notes` qabul qilinadi — boshqa qiymatlar " +
        "jimgina tashlab yuboriladi. `roadmap` bu yerda YO'Q (20 daqiqalik oyna, " +
        "`open-roadmap` ga qarang), \"o'sish ko'rsatkichi\" esa doim ochiq.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["unlockedSections"],
        properties: {
          unlockedSections: arrayOf({ type: "string", enum: ["narrative", "risks_notes"] }),
        },
      }),
      responses: {
        200: okResponse("Yangilandi.", {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            unlockedSections: arrayOf({ type: "string" }),
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/reset-password": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Natijalar"],
      summary: "Natija parolini almashtirish (eski tizim)",
      description:
        "**Diqqat:** bu `Result.accessPassword` ni almashtiradi, ota-ona esa endi " +
        "`Student.loginCode` bilan kiradi. Ya'ni yangi oqimda bu tugma kirishga " +
        "ta'sir qilmaydi — eski kredensial bilan kelgan foydalanuvchilar uchun qolgan.",
      security: ADMIN,
      responses: {
        200: okResponse("Yangi parol (bir marta ko'rsatiladi).", {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            publicCode: { type: "string" },
            password: { type: "string" },
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/results/{id}/pdf": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Natijalar"],
      summary: "Hisobotni PDF qilib yuklab olish",
      description:
        "Hisobot sahifalarini Playwright bilan chizib PDF ga yig'adi — birinchi " +
        "chaqiruv brauzer ko'tarilishini kutadi, ya'ni sekin bo'ladi.",
      security: ADMIN,
      responses: {
        200: {
          description: "PDF fayl.",
          content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
        },
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Foydalanuvchilar (faqat ADMIN roli)
  // =========================================================================
  "/api/admin/users": {
    get: {
      tags: ["Admin · Foydalanuvchilar"],
      summary: "Admin foydalanuvchilar ro'yxati",
      description: "**Faqat `ADMIN` roli.** `EDITOR` bu bo'limga umuman kira olmaydi.",
      security: ADMIN,
      parameters: page(
        { name: "role", in: "query", schema: { type: "string", enum: ["ADMIN", "EDITOR"] } },
        { name: "active", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        { $ref: "#/components/parameters/Search" },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat.",
          paginated(ref("AdminUser"), {
            counts: countsOf({
              admins: { type: "integer" },
              editors: { type: "integer" },
              active: { type: "integer" },
              inactive: { type: "integer" },
            }),
          }),
        ),
        ...errors("Unauthorized", "Forbidden"),
      },
    },
    post: {
      tags: ["Admin · Foydalanuvchilar"],
      summary: "Foydalanuvchi qo'shish",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["fullName", "email", "password"],
        properties: {
          fullName: { type: "string", minLength: 1 },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          role: { type: "string", enum: ["ADMIN", "EDITOR"], default: "EDITOR" },
        },
      }),
      responses: {
        200: okResponse("Yaratildi.", ref("AdminUser")),
        ...errors("BadRequest", "Unauthorized", "Forbidden", "Conflict"),
      },
    },
  },

  "/api/admin/users/{id}": {
    parameters: [idParam],
    patch: {
      tags: ["Admin · Foydalanuvchilar"],
      summary: "Foydalanuvchini tahrirlash",
      description:
        "O'zini `EDITOR` ga tushirish yoki o'chirib qo'yish TAQIQLANGAN — oxirgi " +
        "admin o'zini tizimdan qulflab qo'ymasin.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        properties: {
          fullName: { type: "string", minLength: 1 },
          role: { type: "string", enum: ["ADMIN", "EDITOR"] },
          isActive: { type: "boolean" },
          password: { type: "string", minLength: 8 },
        },
      }),
      responses: {
        200: okResponse("Yangilandi.", ref("AdminUser")),
        ...errors("BadRequest", "Unauthorized", "Forbidden", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · Foydalanuvchilar"],
      summary: "Foydalanuvchini o'chirish",
      description: "O'zini o'chirib bo'lmaydi.",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "Forbidden", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Audit
  // =========================================================================
  "/api/admin/audit-logs": {
    get: {
      tags: ["Admin · Audit"],
      summary: "Audit jurnali",
      description: "Kim, qachon, nimani o'zgartirgani. `prev`/`next` da o'zgarishning ikki tomoni.",
      security: ADMIN,
      parameters: page(
        { name: "entityType", in: "query", schema: { type: "string" }, example: "Result" },
        { name: "entityId", in: "query", schema: { type: "string" } },
        { name: "action", in: "query", schema: { type: "string" }, example: "publish" },
        { $ref: "#/components/parameters/Search" },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan jurnal.",
          paginated(ref("AuditLog"), {
            counts: {
              type: "object",
              description: "Amal nomi → soni. Bazadan sanaladi va `action` filtriga bo'ysunmaydi.",
              additionalProperties: { type: "integer" },
            },
          }),
        ),
        ...errors("Unauthorized"),
      },
    },
  },

  // =========================================================================
  // Hisobot shablonlari (namuna ma'lumot)
  // =========================================================================
  "/api/admin/templates": {
    get: {
      tags: ["Admin · Shablonlar"],
      summary: "Natija formasi uchun namuna ma'lumot",
      description:
        "Fan bo'yicha namuna savollar, atamalar lug'ati va zaxira qiymatlar — " +
        '"Shablonni yuklash" tugmasi formani shular bilan to\'ldiradi. Bu SAVOL ' +
        "shabloni emas (u `/api/admin/test-templates`), balki hisobot formasi uchun " +
        "tayyor mazmun.",
      security: ADMIN,
      parameters: [
        {
          name: "subject",
          in: "query",
          required: true,
          schema: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] },
        },
      ],
      responses: {
        200: okResponse("Namuna mazmun.", {
          type: "object",
          properties: {
            subject: { type: "string" },
            questions: { type: ["array", "null"], items: { type: "object", additionalProperties: true } },
            glossary: {
              type: "object",
              properties: {
                skillHelp: ref("GlossaryEntries"),
                bloomHelp: ref("GlossaryEntries"),
                reasonHelp: ref("GlossaryEntries"),
              },
            },
            bloomFallback: { type: "object", additionalProperties: { type: "number" } },
            skillRadar: arrayOf({
              type: "object",
              properties: { name: { type: "string" }, value: { type: "number" } },
            }),
            reasoningTypes: arrayOf({
              type: "object",
              properties: {
                name: { type: "string" },
                gloss: { type: "string" },
                value: { type: "number" },
              },
            }),
            gradeLevelFallback: { type: ["object", "null"], additionalProperties: { type: "number" } },
          },
        }),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },

  // =========================================================================
  // Savol shablonlari
  // =========================================================================
  "/api/admin/test-templates": {
    get: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Shablonlar ro'yxati",
      security: ADMIN,
      parameters: page(
        { name: "subject", in: "query", schema: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] } },
        { $ref: "#/components/parameters/Grade" },
        {
          name: "examId",
          in: "query",
          description:
            "UUID — shu imtihonning shablonlari; `null` yoki `none` — umumiy " +
            "kutubxona (`examId IS NULL`, eski qatorlar); berilmasa — hammasi.",
          schema: { type: "string" },
        },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat (savol tanasisiz, faqat `questionCount`).",
          paginated({
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              subject: { type: "string" },
              grade: { type: "integer" },
              name: { type: "string" },
              examId: { type: ["string", "null"], format: "uuid" },
              questionCount: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          }),
        ),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Shablon yaratish",
      description:
        "Har shablon imtihonga bog'lanishi SHART. Har (imtihon, fan, sinf) uchun " +
        "bitta shablon; sinf imtihonning ruxsat etilgan sinflaridan bo'lishi kerak.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["subject", "grade", "name", "questions", "examId"],
        properties: {
          subject: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] },
          grade: { type: "integer", minimum: 5, maximum: 11 },
          name: { type: "string", minLength: 1 },
          examId: { type: "string", format: "uuid" },
          questions: { type: "array", minItems: 1, items: ref("TemplateQuestion") },
        },
      }),
      responses: {
        200: okResponse("Yaratildi.", ref("TestTemplate")),
        ...errors("BadRequest", "Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  "/api/admin/test-templates/by/{subject}/{grade}": {
    get: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Fan va sinf bo'yicha shablon topish",
      description:
        "`examId` MAJBURIY — umumiy kutubxonaga qaytish olib tashlangan, aks holda " +
        "import begona imtihonning shablonini tasodifan olib qo'yishi mumkin edi.",
      security: ADMIN,
      parameters: [
        {
          name: "subject",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] },
        },
        { name: "grade", in: "path", required: true, schema: { type: "integer" } },
        { name: "examId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        200: okResponse("Shablon.", ref("TestTemplate")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/test-templates/{id}": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Shablon detali",
      security: ADMIN,
      responses: {
        200: okResponse("Shablon (savollari bilan).", ref("TestTemplate")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
    patch: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Shablonni tahrirlash",
      description:
        "Savollar sonini o'zgartirsangiz, shu shablonga bog'langan testlar " +
        "keyingi tahrirda `QUESTION_COUNT_MISMATCH` beradi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          questions: { type: "array", minItems: 1, items: ref("TemplateQuestion") },
          examId: { type: ["string", "null"], format: "uuid" },
        },
      }),
      responses: {
        200: okResponse("Yangilandi.", ref("TestTemplate")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Shablonni o'chirish",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  "/api/admin/test-templates/{id}/clone": {
    parameters: [idParam],
    post: {
      tags: ["Admin · Savol shablonlari"],
      summary: "Shablonni boshqa imtihonga nusxalash",
      description: 'Nomiga " (nusxa)" qo\'shiladi. Maqsad imtihonda shu (fan, sinf) shabloni bo\'lmasligi kerak.',
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["examId"],
        properties: { examId: { type: "string", format: "uuid" } },
      }),
      responses: {
        200: okResponse("Nusxa yaratildi.", ref("TestTemplate")),
        ...errors("BadRequest", "Unauthorized", "NotFound", "Conflict"),
      },
    },
  },

  // =========================================================================
  // Testlar
  // =========================================================================
  "/api/admin/tests": {
    get: {
      tags: ["Admin · Testlar"],
      summary: "Testlar ro'yxati",
      security: ADMIN,
      parameters: page(
        { $ref: "#/components/parameters/ExamIdQuery" },
        { name: "subject", in: "query", schema: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] } },
        { $ref: "#/components/parameters/Grade" },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat (savol tanasisiz).",
          paginated({
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              examId: { type: "string", format: "uuid" },
              templateId: { type: "string", format: "uuid" },
              name: { type: "string" },
              subject: { type: "string" },
              grade: { type: "integer" },
              languages: arrayOf({ type: "string" }),
              durationSec: { type: ["integer", "null"] },
              questionCount: { type: "integer" },
              updatedAt: { type: "string", format: "date-time" },
            },
          }),
        ),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · Testlar"],
      summary: "Test yaratish",
      description:
        "Savollar soni bog'langan shablonnikiga TENG bo'lishi shart " +
        "(`QUESTION_COUNT_MISMATCH`) — shablonning har bir pedagogik slotiga " +
        "haqiqiy mazmun tushsin. Sinf imtihonning ruxsat etilgan sinflaridan bo'lsin.",
      security: ADMIN,
      requestBody: jsonBody(ref("TestCreate")),
      responses: {
        200: okResponse("Yaratildi.", ref("Test")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
  },

  "/api/admin/tests/{id}": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Testlar"],
      summary: "Test detali",
      security: ADMIN,
      responses: {
        200: okResponse("Test (savollari va urinishlar soni bilan).", {
          allOf: [ref("Test"), { type: "object", properties: { attemptCount: { type: "integer" } } }],
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
    patch: {
      tags: ["Admin · Testlar"],
      summary: "Testni tahrirlash",
      security: ADMIN,
      requestBody: jsonBody(ref("TestUpdate")),
      responses: {
        200: okResponse("Yangilandi.", ref("Test")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · Testlar"],
      summary: "Testni o'chirish",
      description:
        "Test bilan BIRGA uning urinishlari ham o'chadi (`attemptCount` ni oldindan " +
        "ko'rsating). Fan natijalari tegilmaydi — ular (o'quvchi, imtihon) " +
        "natijasida yashaydi, testga bog'lanmagan.",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Leadlar
  // =========================================================================
  "/api/admin/leads": {
    get: {
      tags: ["Admin · Leadlar"],
      summary: "Leadlar ro'yxati",
      security: ADMIN,
      parameters: page(
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["FORM_ONLY", "STARTED", "COMPLETED", "PUBLISHED"] },
        },
        { $ref: "#/components/parameters/Grade" },
        { name: "search", in: "query", description: "Ism, familya yoki telefon.", schema: { type: "string" } },
      ),
      responses: {
        200: okResponse(
          "Sahifalangan ro'yxat.",
          paginated({
            allOf: [
              ref("Lead"),
              {
                type: "object",
                properties: {
                  loginCode: { type: ["string", "null"] },
                  attemptCount: { type: "integer" },
                },
              },
            ],
          }),
        ),
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/admin/leads/bulk-delete": {
    post: {
      tags: ["Admin · Leadlar"],
      summary: "Leadlarni ommaviy o'chirish",
      description:
        "**Kaskad**: har lead + urinishlari, va imtihonni tugatgan bo'lsa " +
        "o'quvchisi + natija/hisoboti ham. Har lead alohida tranzaksiyada — " +
        "biri yiqilsa qolganlari o'chgan bo'ladi va `failed` da qaytadi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["ids"],
        properties: {
          ids: { type: "array", minItems: 1, maxItems: 500, items: { type: "string" } },
        },
      }),
      responses: {
        200: okResponse("Hisobot.", {
          type: "object",
          properties: { deleted: { type: "integer" }, failed: arrayOf({ type: "string" }) },
        }),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },

  "/api/admin/leads/{id}": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Leadlar"],
      summary: "Lead detali",
      description: "O'quvchisi va barcha urinishlari (test + natija ma'lumoti bilan).",
      security: ADMIN,
      responses: {
        200: okResponse("Lead.", {
          allOf: [
            ref("Lead"),
            {
              type: "object",
              properties: {
                student: { oneOf: [ref("Student"), { type: "null" }] },
                attempts: arrayOf(ref("TestAttempt")),
              },
            },
          ],
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Urinishlar
  // =========================================================================
  "/api/admin/attempts/{id}/answers": {
    parameters: [idParam],
    get: {
      tags: ["Admin · Urinishlar"],
      summary: "Urinish javoblarini ko'rish",
      description:
        "Har savol uchun o'quvchi javobi va to'g'ri javob. Bu — o'quvchiga " +
        "javoblarni yashirib yuboradigan `stripAnswers` ning TESKARISI: bu yerda " +
        "to'g'ri javoblar ataylab ochib beriladi.",
      security: ADMIN,
      responses: {
        200: okResponse("Javob jadvali.", {
          type: "object",
          properties: {
            test: { type: "object", properties: { name: { type: "string" }, subject: { type: "string" } } },
            submittedAt: { type: ["string", "null"], format: "date-time" },
            scoreRaw: { type: ["integer", "null"] },
            scoreMax: { type: ["integer", "null"] },
            rows: arrayOf(ref("AnswerRow")),
          },
        }),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Statistika
  // =========================================================================
  "/api/admin/stats": {
    get: {
      tags: ["Admin · Statistika"],
      summary: "Boshqaruv paneli statistikasi",
      description:
        "Barcha NASHR ETILGAN natijalar bo'yicha yig'ma ko'rsatkichlar va o'quvchi " +
        "qatorlari. Raqamlar muzlatilgan snapshotlardan o'qiladi — ya'ni panel " +
        "ota-ona ko'rgan raqamni ko'rsatadi.\n\n" +
        "Yig'ish 5 daqiqaga keshlanadi va natija o'zgarganda avtomatik bekor " +
        "qilinadi. Qatorlar filtri va saralashi kesh USTIDA ishlaydi.\n\n" +
        "Istisno: `verdict` (qabul qarori) snapshotdan O'QILMAYDI, balki balldan " +
        "qayta hisoblanadi — 2026-08-03 gacha muzlatilgan snapshotlarda qaror " +
        "boshqa mantiq bilan yozilgan va ustundagi ball bilan mos kelmasdi.",
      security: ADMIN,
      parameters: page(
        { name: "q", in: "query", description: "O'quvchi ismi yoki kodi.", schema: { type: "string" } },
        { name: "verdict", in: "query", schema: { type: "string" } },
        { $ref: "#/components/parameters/Grade" },
        { name: "examTitle", in: "query", schema: { type: "string" } },
        {
          name: "sortKey",
          in: "query",
          schema: {
            type: "string",
            enum: ["studentName", "grade", "math", "english", "ct", "composite", "verdict", "publishedAt"],
            default: "composite",
          },
        },
        { name: "sortAsc", in: "query", schema: { type: "string", enum: ["true", "false"], default: "false" } },
      ),
      responses: {
        200: okResponse("Statistika.", {
          type: "object",
          properties: {
            totals: {
              type: "object",
              properties: {
                all: { type: "integer" },
                draft: { type: "integer" },
                published: { type: "integer" },
                archived: { type: "integer" },
              },
            },
            composite: {
              type: "object",
              properties: {
                avg: { type: ["number", "null"] },
                median: { type: ["number", "null"] },
                min: { type: ["number", "null"] },
                max: { type: ["number", "null"] },
                n: { type: "integer" },
              },
            },
            subjects: {
              type: "object",
              description: "Har fan uchun `{ avg, n }` — bo'sh fan o'rtachani nolga tortmasin.",
              additionalProperties: {
                type: "object",
                properties: { avg: { type: ["number", "null"] }, n: { type: "integer" } },
              },
            },
            bands: arrayOf({
              type: "object",
              properties: { label: { type: "string" }, count: { type: "integer" } },
            }),
            verdicts: arrayOf({
              type: "object",
              properties: { label: { type: "string" }, count: { type: "integer" } },
            }),
            grades: arrayOf({
              type: "object",
              properties: { grade: { type: "integer" }, count: { type: "integer" } },
            }),
            exams: arrayOf({
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                grade: { type: "integer" },
                n: { type: "integer" },
                avg: { type: ["number", "null"] },
              },
            }),
            ai: {
              type: "object",
              description: "Gemini xarajati yig'indisi.",
              properties: {
                promptTokens: { type: "integer" },
                completionTokens: { type: "integer" },
                totalTokens: { type: "integer" },
                costUsd: { type: "number" },
                runs: { type: "integer" },
                results: { type: "integer" },
              },
            },
            students: paginated({
              type: "object",
              properties: {
                resultId: { type: "string", format: "uuid" },
                publicCode: { type: "string" },
                studentName: { type: "string" },
                grade: { type: "integer" },
                phone: { type: ["string", "null"] },
                examTitle: { type: "string" },
                math: { type: ["number", "null"] },
                english: { type: ["number", "null"] },
                ct: { type: ["number", "null"] },
                composite: { type: ["number", "null"] },
                band: { type: ["string", "null"] },
                verdict: { type: ["string", "null"] },
                verdictSub: { type: ["string", "null"] },
                passed: { type: ["boolean", "null"] },
                publishedAt: { type: ["string", "null"], format: "date-time" },
              },
            }),
          },
        }),
        ...errors("Unauthorized"),
      },
    },
  },

  // =========================================================================
  // Fanlar
  // =========================================================================
  "/api/admin/subjects": {
    get: {
      tags: ["Admin · Fanlar"],
      summary: "Fanlar ro'yxati",
      description: "Bo'sh bo'lsa uchta standart fan bir marta yaratiladi (idempotent).",
      security: ADMIN,
      responses: {
        200: okResponse("Fanlar.", arrayOf(ref("Subject"))),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · Fanlar"],
      summary: "Fan qo'shish",
      description:
        "Kalit faqat lotin katta harflar, raqam va `_`; katta harf bilan boshlanadi " +
        "(`PHYSICS`, `HISTORY`). **Eslatma:** yangi fanlar hozircha faqat admin " +
        "tanlovida ko'rinadi — hisobot yozuvlari uchta enum fanga bog'langan.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["key", "name"],
        properties: {
          key: { type: "string", pattern: "^[A-Z][A-Z0-9_]{1,31}$" },
          name: { type: "string", minLength: 1 },
          order: { type: "integer", minimum: 0 },
          active: { type: "boolean", default: true },
        },
      }),
      responses: {
        200: okResponse("Yaratildi.", ref("Subject")),
        ...errors("BadRequest", "Unauthorized", "Conflict"),
      },
    },
  },

  "/api/admin/subjects/{id}": {
    parameters: [idParam],
    patch: {
      tags: ["Admin · Fanlar"],
      summary: "Fanni tahrirlash",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          order: { type: "integer", minimum: 0 },
          active: { type: "boolean" },
        },
      }),
      responses: {
        200: okResponse("Yangilandi.", ref("Subject")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · Fanlar"],
      summary: "Fanni o'chirish",
      description:
        "Uchta asosiy fandan biri natijalarda ishlatilayotgan bo'lsa o'chirilmaydi " +
        "(`SUBJECT_IN_USE`) — eski hisobotlar buzilmasin. Uni `active: false` qiling.",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // O'quv resurslari
  // =========================================================================
  "/api/admin/resources": {
    get: {
      tags: ["Admin · Resurslar"],
      summary: "O'quv resurslari ro'yxati",
      security: ADMIN,
      parameters: [
        {
          name: "subject",
          in: "query",
          schema: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] },
        },
      ],
      responses: {
        200: okResponse("Resurslar (sahifalanmaydi).", arrayOf(ref("LearningResource"))),
        ...errors("Unauthorized"),
      },
    },
    post: {
      tags: ["Admin · Resurslar"],
      summary: "Resurs qo'shish",
      security: ADMIN,
      requestBody: jsonBody(ref("LearningResourceInput")),
      responses: {
        200: okResponse("Yaratildi.", ref("LearningResource")),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },

  "/api/admin/resources/{id}": {
    parameters: [idParam],
    patch: {
      tags: ["Admin · Resurslar"],
      summary: "Resursni tahrirlash",
      description: "`provider` / `url` / `note` ga bo'sh satr yuborilsa ustun tozalanadi.",
      security: ADMIN,
      requestBody: jsonBody(ref("LearningResourceInput")),
      responses: {
        200: okResponse("Yangilandi.", ref("LearningResource")),
        ...errors("BadRequest", "Unauthorized", "NotFound"),
      },
    },
    delete: {
      tags: ["Admin · Resurslar"],
      summary: "Resursni o'chirish",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", ref("Deleted")),
        ...errors("Unauthorized", "NotFound"),
      },
    },
  },

  // =========================================================================
  // Sozlamalar
  // =========================================================================
  "/api/admin/settings/default-unlocked-sections": {
    get: {
      tags: ["Admin · Sozlamalar"],
      summary: "Yangi natijalarda ochiq bo'ladigan bo'limlar",
      security: ADMIN,
      responses: {
        200: okResponse("Sozlama.", {
          type: "object",
          properties: { sections: arrayOf({ type: "string" }) },
        }),
        ...errors("Unauthorized"),
      },
    },
    put: {
      tags: ["Admin · Sozlamalar"],
      summary: "Standart ochiq bo'limlarni o'rnatish",
      description: "Ruxsat etilgan kalitlar: `narrative`, `roadmap`, `risks_notes`. Boshqalari tashlanadi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["sections"],
        properties: {
          sections: arrayOf({ type: "string", enum: ["narrative", "roadmap", "risks_notes"] }),
        },
      }),
      responses: {
        200: okResponse("Saqlandi.", {
          type: "object",
          properties: { sections: arrayOf({ type: "string" }) },
        }),
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/admin/settings/contact-phone": {
    get: {
      tags: ["Admin · Sozlamalar"],
      summary: "Maktab aloqa raqami",
      security: ADMIN,
      responses: {
        200: okResponse("Raqam.", { type: "object", properties: { phone: { type: "string" } } }),
        ...errors("Unauthorized"),
      },
    },
    put: {
      tags: ["Admin · Sozlamalar"],
      summary: "Aloqa raqamini o'rnatish",
      description: "Format tekshirilmaydi — xalqaro, mahalliy va ichki raqamlar ham yoziladi.",
      security: ADMIN,
      requestBody: jsonBody({ type: "object", properties: { phone: { type: "string" } } }),
      responses: {
        200: okResponse("Saqlandi.", { type: "object", properties: { phone: { type: "string" } } }),
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/admin/settings/funnel-open": {
    get: {
      tags: ["Admin · Sozlamalar"],
      summary: "Qabul testi ochiqmi",
      security: ADMIN,
      responses: {
        200: okResponse("Holat.", { type: "object", properties: { open: { type: "boolean" } } }),
        ...errors("Unauthorized"),
      },
    },
    put: {
      tags: ["Admin · Sozlamalar"],
      summary: "Qabul testini ochish / yopish",
      description:
        "Standart — YOPIQ. Sayt ochiq internetda turadi, ya'ni ochiq bo'lsa " +
        "havolani bilgan har kim test topshira oladi. Shuning uchun imtihon kuni " +
        "ataylab ochiladi va tugagach yopiladi. O'zgarish auditga yoziladi.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["open"],
        properties: { open: { type: "boolean" } },
      }),
      responses: {
        200: okResponse("Saqlandi.", { type: "object", properties: { open: { type: "boolean" } } }),
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/admin/settings/funnel-password": {
    get: {
      tags: ["Admin · Sozlamalar"],
      summary: "Qabul testi paroli",
      description:
        "Parol OCHIQ matnda qaytadi — xodim uni admin panelda ko'rib maktab " +
        "laptoplariga ko'chiradi. Bu — umumiy qurilma paroli, shaxsiy hisob emas.",
      security: ADMIN,
      responses: {
        200: okResponse("Parol holati.", {
          type: "object",
          properties: {
            set: { type: "boolean" },
            password: { type: "string" },
            updatedAt: { type: ["string", "null"], format: "date-time" },
          },
        }),
        ...errors("Unauthorized"),
      },
    },
    put: {
      tags: ["Admin · Sozlamalar"],
      summary: "Parolni o'rnatish / almashtirish",
      description:
        "Kamida 6 belgi. Almashtirish = **barcha qurilmalarni chiqarib yuborish**: " +
        "parolning ichki versiyasi yangilanadi va eski kirish tokenlari rad etiladi. " +
        "Tokenlar bazada saqlanmagani uchun bu yagona bekor qilish usuli.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["password"],
        properties: { password: { type: "string", minLength: 6 } },
      }),
      responses: {
        200: okResponse("Saqlandi.", {
          type: "object",
          properties: {
            set: { type: "boolean", const: true },
            password: { type: "string" },
            updatedAt: { type: "string", format: "date-time" },
          },
        }),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
    delete: {
      tags: ["Admin · Sozlamalar"],
      summary: "Parolni olib tashlash",
      description: "Parol so'ralmay qoladi — faqat ochiq/yopiq tugmasi ishlaydi.",
      security: ADMIN,
      responses: {
        200: okResponse("O'chirildi.", {
          type: "object",
          properties: {
            set: { type: "boolean", const: false },
            password: { type: "string" },
            updatedAt: { type: "null" },
          },
        }),
        ...errors("Unauthorized"),
      },
    },
  },

  "/api/admin/settings/clear-data": {
    delete: {
      tags: ["Admin · Sozlamalar"],
      summary: "⚠️ Barcha o'quvchi ma'lumotini o'chirish",
      description:
        "**Qaytarib bo'lmaydi.** O'chadi: o'quvchilar, natijalar (fan natijalari " +
        "kaskad) va audit jurnali. Qoladi: adminlar, fanlar, imtihonlar, " +
        "shablonlar, sozlamalar.\n\n" +
        "Tasodifiy chaqiruvdan himoya: tanada aynan `{ \"confirm\": \"TOZALASH\" }` " +
        "bo'lishi shart.",
      security: ADMIN,
      requestBody: jsonBody({
        type: "object",
        required: ["confirm"],
        properties: { confirm: { type: "string", const: "TOZALASH" } },
      }),
      responses: {
        200: okResponse("O'chirildi.", {
          type: "object",
          properties: {
            deletedAuditLogs: { type: "integer" },
            deletedResults: { type: "integer" },
            deletedStudents: { type: "integer" },
          },
        }),
        ...errors("BadRequest", "Unauthorized"),
      },
    },
  },
};
