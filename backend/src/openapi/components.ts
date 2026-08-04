// OpenAPI komponentlari: konvert, sahifalash, domen modellari va kirish
// sxemalari. Manba — `prisma/schema.prisma` (javob shakllari) va
// `src/lib/schemas.ts` (so'rov shakllari).
//
// Spec QO'LDA yoziladi, zod'dan generatsiya qilinmaydi. Sabab: eng muhim
// maydonlar (`Test.questions`, `Result.manualContent`, `calculatedSnapshot`,
// `aiNarrative`) Json ustunlar va `z.record(z.any())` — generator ular haqida
// "object" dan boshqa hech narsa ayta olmasdi. Drift'dan
// `test/openapi-coverage.test.ts` qo'riqlaydi.

export type JsonObject = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Yordamchilar — har endpointda konvertni qayta yozmaslik uchun.
// ---------------------------------------------------------------------------

/** `{ success: true, data: <schema> }` — `lib/response.ts` dagi `ok()`. */
export function envelope(data: JsonObject): JsonObject {
  return {
    type: "object",
    required: ["success", "data"],
    properties: { success: { type: "boolean", const: true }, data },
  };
}

/** 200 javobi, `ok()` konvertiga o'ralgan. */
export function okResponse(description: string, data: JsonObject): JsonObject {
  return {
    description,
    content: { "application/json": { schema: envelope(data) } },
  };
}

/** `$ref` qisqartmasi. */
export const ref = (name: string): JsonObject => ({ $ref: `#/components/schemas/${name}` });

/** Massiv sxemasi. */
export const arrayOf = (items: JsonObject): JsonObject => ({ type: "array", items });

/**
 * Sahifalangan ro'yxat — `lib/pagination.ts` dagi `wrapPaginated()`.
 * `extra` orqali ba'zi ro'yxatlar qo'shadigan `counts` bloki beriladi.
 */
export function paginated(items: JsonObject, extra?: JsonObject): JsonObject {
  return {
    type: "object",
    required: ["items", "total", "page", "take", "pages"],
    properties: {
      items: arrayOf(items),
      total: { type: "integer", description: "Filtrga mos jami yozuvlar soni." },
      page: { type: "integer", description: "1 dan boshlanadi." },
      take: { type: "integer" },
      pages: { type: "integer" },
      ...(extra ?? {}),
    },
  };
}

/**
 * Ro'yxat nishonlari uchun `counts` bloki. MUHIM: bu kesimlar BAZADAN
 * sanaladi, ko'rinib turgan sahifadan emas — va o'zi bo'linayotgan o'lchov
 * filtriga bo'ysunmaydi (2026-08-03 xatosi shundan edi: "Nashr etilgan: 10"
 * aslida "shu sahifadagi 10 ta" degani edi).
 */
export const countsOf = (props: JsonObject): JsonObject => ({
  type: "object",
  description:
    "Nishon kesimlari. Bazadan sanaladi (sahifadagi qatorlardan emas) va " +
    "o'zi bo'linayotgan o'lchov filtriga bo'ysunmaydi.",
  properties: props,
});

// ---------------------------------------------------------------------------
// Umumiy javoblar
// ---------------------------------------------------------------------------

export const responses: JsonObject = {
  BadRequest: {
    description: "Validatsiya yoki biznes qoidasi xatosi (`VALIDATION_ERROR`, `GRADE_MISMATCH`, ...).",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  Unauthorized: {
    description: "Sessiya yo'q, muddati o'tgan yoki kredensial noto'g'ri.",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  Forbidden: {
    description: "Rol yetarli emas (`requireRole`) yoki qabul testi yopiq.",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  NotFound: {
    description: "Yozuv topilmadi.",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  Conflict: {
    description: "Holat mos emas yoki qiymat band (`CONFLICT`).",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  TooManyRequests: {
    description: "Rate limit (`TOO_MANY_ATTEMPTS`).",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
};

/** Endpointda ishlatiladigan xato javoblari ro'yxatini yig'adi. */
export function errors(...names: (keyof typeof responses & string)[]): JsonObject {
  const map: Record<string, string> = {
    BadRequest: "400",
    Unauthorized: "401",
    Forbidden: "403",
    NotFound: "404",
    Conflict: "409",
    TooManyRequests: "429",
  };
  const out: JsonObject = {};
  for (const n of names) out[map[n]!] = { $ref: `#/components/responses/${n}` };
  return out;
}

// ---------------------------------------------------------------------------
// Umumiy parametrlar
// ---------------------------------------------------------------------------

export const parameters: JsonObject = {
  Page: {
    name: "page",
    in: "query",
    description: "Sahifa raqami, 1 dan boshlanadi.",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  Take: {
    name: "take",
    in: "query",
    description:
      "Sahifadagi yozuvlar soni. Har endpointning o'z standarti va yuqori chegarasi bor " +
      "(`parsePagination`); chegaradan oshgan qiymat jimgina qisqartiriladi.",
    schema: { type: "integer", minimum: 1 },
  },
  Search: {
    name: "q",
    in: "query",
    description: "Matnli qidiruv (registrga sezgir emas).",
    schema: { type: "string" },
  },
  Grade: {
    name: "grade",
    in: "query",
    description: "Sinf bo'yicha filtr (5–11).",
    schema: { type: "integer", minimum: 5, maximum: 11 },
  },
  ExamIdQuery: {
    name: "examId",
    in: "query",
    description: "Imtihon bo'yicha filtr.",
    schema: { type: "string", format: "uuid" },
  },
  PathId: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  },
};

// ---------------------------------------------------------------------------
// Xavfsizlik sxemalari
// ---------------------------------------------------------------------------

export const securitySchemes: JsonObject = {
  adminCookie: {
    type: "apiKey",
    in: "cookie",
    name: "sodiq_admin",
    description:
      "`POST /api/admin/auth/login` qo'yadigan httpOnly cookie (JWT, 7 kun). " +
      "Barcha `/api/admin/**` marshrutlari shuni talab qiladi. Faqat cookie — " +
      "admin marshrutlari `Authorization` sarlavhasini O'QIMAYDI.",
  },
  resultCookie: {
    type: "apiKey",
    in: "cookie",
    name: "sodiq_result",
    description: "Ota-ona sessiyasi (JWT, 1 kun). `POST /api/result/auth/login` yoki `/auth/lookup` qo'yadi.",
  },
  resultBearer: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Xuddi shu ota-ona tokeni sarlavha orqali. Boshqa origin'dagi mijozlar " +
      "(Astro SSR) cookie yubora olmagani uchun tokenni shu yerda uzatadi.",
  },
  funnelGate: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Qabul testiga kirish tokeni — `POST /api/test-taking/gate` qaytaradi. " +
      "Faqat kirish eshiklariga (`/leads`, `/leads/{leadId}/tests`, `/attempts`) " +
      "kerak; javob saqlash va yakunlash ataylab ochiq (parol o'zgarganda " +
      "test yozib o'tirgan bolaning ishi yo'qolmasin).",
  },
};

// ---------------------------------------------------------------------------
// Enumlar
// ---------------------------------------------------------------------------

const SUBJECT_KEY = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
const TEST_LANGUAGE = ["UZ", "RU", "EN"];

// ---------------------------------------------------------------------------
// Sxemalar
// ---------------------------------------------------------------------------

export const schemas: JsonObject = {
  // ---- Konvert ------------------------------------------------------------
  ErrorResponse: {
    type: "object",
    description: "Har qanday xato javobi (`middleware/error.ts`).",
    required: ["success", "error"],
    properties: {
      success: { type: "boolean", const: false },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            description:
              "Mashina o'qiydigan kod: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, " +
              "`NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR` yoki endpointga xos kod " +
              "(`GRADE_MISMATCH`, `FUNNEL_CLOSED`, ...).",
            examples: ["VALIDATION_ERROR"],
          },
          message: { type: "string" },
          fields: {
            type: "object",
            description:
              "Maydon → xabar. Zod xatosida har bir noto'g'ri maydon shu yerda " +
              "nuqta bilan ajratilgan yo'l sifatida keladi (`subjects.0.questions`).",
            additionalProperties: { type: "string" },
          },
        },
      },
    },
  },

  Deleted: {
    type: "object",
    required: ["deleted"],
    properties: { deleted: { type: "boolean", const: true } },
  },

  // ---- Domen modellari (Prisma) ------------------------------------------
  AdminUser: {
    type: "object",
    description: "Admin panel foydalanuvchisi. Parol hech qachon qaytarilmaydi.",
    properties: {
      id: { type: "string", format: "uuid" },
      fullName: { type: "string" },
      email: { type: "string", format: "email" },
      role: { type: "string", enum: ["ADMIN", "EDITOR"] },
      isActive: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  Student: {
    type: "object",
    description:
      "O'quvchi. Funnel oqimida o'quvchi UCHALA fan topshirilgach yaratiladi — " +
      "undan oldin faqat `Lead` bo'lib turadi.",
    properties: {
      id: { type: "string", format: "uuid" },
      fullName: { type: "string", description: "`firstName + lastName` dan hosil qilinadi." },
      firstName: { type: ["string", "null"] },
      lastName: { type: ["string", "null"] },
      uid: { type: ["string", "null"], description: "Tashqi reyestr raqami. Unikal (null'lar to'qnashmaydi)." },
      examLanguage: { type: ["string", "null"], description: "Imtihon tili: `UZ` / `RU` / `EN`." },
      studentNumber: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      sex: { type: ["string", "null"], enum: ["MALE", "FEMALE", null] },
      birthDate: { type: ["string", "null"], format: "date-time" },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      groupName: { type: ["string", "null"] },
      previousSchool: { type: ["string", "null"] },
      metadata: { type: ["object", "null"], additionalProperties: true },
      loginCode: {
        type: ["string", "null"],
        description:
          "Ota-ona kirish kodi, `<FamilyaBoshHarfi><IsmBoshHarfi><UID>` ko'rinishida. " +
          "Bitta o'quvchi uchun BITTA kod — bir necha imtihon natijasi shu kod bilan ochiladi.",
      },
      accessPassword: {
        type: ["string", "null"],
        description: "Ochiq matndagi parol — qabulxona ota-onaga o'qib beradi. Faqat admin javoblarida.",
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  Exam: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      description: { type: ["string", "null"] },
      examDate: { type: "string", format: "date-time" },
      academicYear: { type: ["string", "null"] },
      status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
      grade: {
        type: "integer",
        description: "Eski (bitta sinfli) ustun. Yangi yozuvlarda `grades[0]` ga teng.",
      },
      grades: { type: "array", items: { type: "integer" }, description: "Imtihon qamragan sinflar." },
      subjectKeys: { type: "array", items: { type: "string", enum: SUBJECT_KEY } },
      admissionThresholds: { $ref: "#/components/schemas/AdmissionThresholds" },
      gradingConfiguration: {
        type: "object",
        additionalProperties: true,
        description: "Band yorliqlari va kesimlari uchun ixtiyoriy override'lar.",
      },
      cohortSize: { type: ["integer", "null"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      _count: {
        type: "object",
        description: "Faqat ro'yxat va detal javoblarida.",
        properties: { results: { type: "integer" }, templates: { type: "integer" } },
      },
    },
  },

  AdmissionThresholds: {
    type: "object",
    description:
      "Sinf raqami (satr sifatida) → fan bo'yicha minimal ballar. Masalan " +
      '`{ "5": { "math": 60, "ct": 50, "en": 55 } }`.',
    additionalProperties: {
      type: "object",
      required: ["math", "ct", "en"],
      properties: {
        math: { type: "number" },
        ct: { type: "number", description: "Tanqidiy fikrlash." },
        en: { type: "number", description: "Ingliz tili." },
      },
    },
  },

  Result: {
    type: "object",
    description: "Bitta (o'quvchi, imtihon) uchun hisobot.",
    properties: {
      id: { type: "string", format: "uuid" },
      studentId: { type: "string", format: "uuid" },
      examId: { type: "string", format: "uuid" },
      publicCode: {
        type: "string",
        description:
          "Natijaning 6 belgili kodi. ESKI kirish tizimi qoldig'i — ota-ona endi " +
          "`Student.loginCode` bilan kiradi, bu kod esa admin uchun identifikator.",
      },
      status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
      manualContent: {
        type: "object",
        additionalProperties: true,
        description: "Qo'lda kiritilgan matnlar va override'lar — `ManualContent` ga qarang.",
      },
      calculatedSnapshot: {
        type: ["object", "null"],
        additionalProperties: true,
        description:
          "Nashr paytida MUZLATILGAN hisob-kitob: `{ perSubject: { MATH: { percent, band }, ... }, " +
          "composite: { composite, compBand, verdict, gateAllPassed }, cohort: {...} }`. " +
          "Ota-onaga ko'rsatiladigan raqamlar aynan shundan o'qiladi.",
      },
      aiNarrative: {
        type: ["object", "null"],
        additionalProperties: true,
        description:
          "Gemini yozgan matn: `{ math: { diagnostika, tahlil, growth }, english, ct, " +
          "summary: { crossCutting, finalRecommendation } }`.",
      },
      aiRoadmap: {
        type: ["object", "null"],
        additionalProperties: true,
        description:
          "AI qo'shadigan keyingi-daraja mavzulari. Deterministik roadmap ustiga " +
          "render paytida qo'shiladi: `{ math: { nextLevelTopics: [...] }, ... }`.",
      },
      aiUsage: {
        type: ["object", "null"],
        additionalProperties: true,
        description: "`{ model, promptTokens, completionTokens, totalTokens, costUsd, generatedAt, runs[] }`.",
      },
      unlockedSections: {
        type: "array",
        items: { type: "string", enum: ["narrative", "roadmap", "risks_notes"] },
        description:
          "Ota-onaga ochilgan bo'limlar. Bo'sh `[]` — faqat yuqoridagi qisqa blok " +
          "ko'rinadi. `roadmap` bu ro'yxat orqali BOSHQARILMAYDI (pastga qarang).",
      },
      roadmapOpenedAt: {
        type: ["string", "null"],
        format: "date-time",
        description:
          '"Rivojlanish yo\'li" doimiy toggle EMAS: shu vaqtdan 20 daqiqagina ochiq ' +
          "turadi. Nashr etish va `POST /results/{id}/open-roadmap` shu vaqtni qo'yadi.",
      },
      publishedAt: { type: ["string", "null"], format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      student: { $ref: "#/components/schemas/Student" },
      exam: { $ref: "#/components/schemas/Exam" },
      subjects: { type: "array", items: { $ref: "#/components/schemas/SubjectResult" } },
    },
  },

  SubjectResult: {
    type: "object",
    description: "Bitta natijaning bitta fani. `(resultId, subject)` juftligi unikal.",
    properties: {
      id: { type: "string", format: "uuid" },
      resultId: { type: "string", format: "uuid" },
      subject: { type: "string", enum: SUBJECT_KEY },
      totalQuestions: { type: "integer" },
      totalMarks: { type: "integer" },
      questions: { type: "array", items: { $ref: "#/components/schemas/Question" } },
      realData: { $ref: "#/components/schemas/RealData" },
      manualNotes: {
        type: ["object", "null"],
        properties: { strength: { type: "string" }, growthLabel: { type: "string" } },
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  Subject: {
    type: "object",
    description: "Admin paneldagi tanlanadigan fanlar ro'yxati.",
    properties: {
      id: { type: "string", format: "uuid" },
      key: { type: "string", description: "Katta harfli kalit: `MATH`, `PHYSICS`, ..." },
      name: { type: "string" },
      order: { type: "integer" },
      active: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  LearningResource: {
    type: "object",
    description:
      "Rivojlanish yo'li uchun o'quv resursi. `packages/compute/.../resources.json` " +
      "o'rniga — maktab panelidan boshqaradi.",
    properties: {
      id: { type: "string", format: "uuid" },
      subject: { type: "string", enum: SUBJECT_KEY },
      topic: {
        type: "string",
        description:
          "Kanonik mavzu nomi, yoki maxsus kalitlar: `_default` (butun fan uchun), " +
          "`_nextLevel` (A→B bosqichi).",
      },
      lang: { type: "string", enum: ["uz", "en"] },
      type: { type: "string", enum: ["video", "platform", "book", "channel", "app"] },
      title: { type: "string" },
      provider: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
      note: { type: ["string", "null"] },
      order: { type: "integer" },
      active: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  TestTemplate: {
    type: "object",
    description:
      "Savol SHABLONI — pedagogik tuzilma (mavzu, ko'nikma, Bloom, ball). " +
      "Har (imtihon, fan, sinf) uchun bitta.",
    properties: {
      id: { type: "string", format: "uuid" },
      subject: { type: "string", enum: SUBJECT_KEY },
      grade: { type: "integer" },
      name: { type: "string" },
      examId: { type: ["string", "null"], format: "uuid" },
      questions: { type: "array", items: { $ref: "#/components/schemas/TemplateQuestion" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  Test: {
    type: "object",
    description:
      "O'quvchi topshiradigan haqiqiy test. Savollar soni bog'langan shablonnikiga " +
      "TENG bo'lishi shart (`QUESTION_COUNT_MISMATCH`).",
    properties: {
      id: { type: "string", format: "uuid" },
      examId: { type: "string", format: "uuid" },
      templateId: { type: "string", format: "uuid" },
      name: { type: "string" },
      subject: { type: "string", enum: SUBJECT_KEY },
      grade: { type: "integer" },
      languages: {
        type: "array",
        items: { type: "string", enum: TEST_LANGUAGE },
        description:
          '"Qaysi tillarda mazmuni bor" degani (kimga ko\'rsatiladi emas). ' +
          "Bo'sh massiv — barcha tillar (eski qatorlar bilan moslik).",
      },
      durationSec: { type: ["integer", "null"] },
      questions: { type: "array", items: { $ref: "#/components/schemas/TestQuestion" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  Lead: {
    type: "object",
    description:
      "Qabul testi formasini to'ldirgan nomzod. O'quvchi (Student) faqat " +
      "uchala fan topshirilgach yaratiladi.",
    properties: {
      id: { type: "string", format: "uuid" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      sex: { type: "string", enum: ["MALE", "FEMALE"] },
      phone: { type: "string" },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      examLanguage: { type: "string", enum: TEST_LANGUAGE },
      previousSchool: { type: ["string", "null"] },
      status: {
        type: "string",
        enum: ["FORM_ONLY", "STARTED", "COMPLETED", "PUBLISHED"],
        description: "`COMPLETED` faqat uchala fan topshirilgach qo'yiladi.",
      },
      studentId: { type: ["string", "null"], format: "uuid" },
      ipAddress: { type: ["string", "null"] },
      userAgent: { type: ["string", "null"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  TestAttempt: {
    type: "object",
    description: "Bitta (lead, test) urinishi. Uchala fan urinishi BITTA natijaga bog'lanadi.",
    properties: {
      id: { type: "string", format: "uuid" },
      leadId: { type: "string", format: "uuid" },
      testId: { type: "string", format: "uuid" },
      clientToken: {
        type: "string",
        description: "Urinishning siri. Javob saqlash va yakunlash aynan shu token bilan ketadi.",
      },
      startedAt: { type: "string", format: "date-time" },
      submittedAt: { type: ["string", "null"], format: "date-time" },
      autoSubmitted: { type: "boolean", description: "Vaqt tugab avtomatik yakunlanganmi." },
      answers: { type: "object", additionalProperties: true, description: "savolId → javob." },
      scoreRaw: { type: ["integer", "null"] },
      scoreMax: { type: ["integer", "null"] },
      fullscreenExits: {
        type: "integer",
        description:
          "To'liq ekrandan chiqishlar soni. Faqat KUZATUV uchun — baholashga ta'sir " +
          "qilmaydi. Faqat o'sadi (server `max(eski, yangi)` qiladi).",
      },
      resultId: { type: ["string", "null"], format: "uuid" },
    },
  },

  AuditLog: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      adminUserId: { type: ["string", "null"], format: "uuid" },
      action: { type: "string", examples: ["create", "update", "delete", "publish", "impersonate"] },
      entityType: { type: "string", examples: ["Result"] },
      entityId: { type: "string" },
      prev: { type: ["object", "null"], additionalProperties: true },
      next: { type: ["object", "null"], additionalProperties: true },
      createdAt: { type: "string", format: "date-time" },
      adminUser: {
        type: ["object", "null"],
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string" },
          email: { type: "string" },
        },
      },
    },
  },

  // ---- Savol sxemalari ----------------------------------------------------
  Question: {
    type: "object",
    description:
      "Hisobot savoli (QAT'IY shakl) — `SubjectResult.questions` shu massiv. " +
      "Diagnostika dvigateli aynan shu maydonlardan hisoblaydi, shuning uchun " +
      "enum qiymatlari majburiy (`validateQuestions`).",
    required: [
      "id", "marks", "difficulty", "strand", "topic", "subTopic",
      "skill", "bloom", "reasoning", "gradeLevel", "framework",
      "result", "earned", "evidence",
    ],
    properties: {
      id: { type: "string", description: "Shablon savolining id'si." },
      marks: { type: "integer", minimum: 0 },
      difficulty: { type: "string", enum: ["Oson", "O'rta", "Qiyin"] },
      strand: { type: "string" },
      topic: { type: "string" },
      subTopic: { type: "string" },
      skill: { type: "string" },
      bloom: {
        type: "string",
        enum: ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"],
      },
      reasoning: {
        type: ["string", "null"],
        enum: ["Deduktiv", "Induktiv", "Analitik", "Fazoviy", "Inferensial", null],
      },
      gradeLevel: { type: "string" },
      framework: { type: "string" },
      techErrorIds: {
        type: "array",
        description: "Texnik xato belgilari: satr yoki `{ id, note }`.",
        items: {
          oneOf: [
            { type: "string" },
            { type: "object", required: ["id"], properties: { id: { type: "string" }, note: { type: "string" } } },
          ],
        },
      },
      result: { type: "string", enum: ["To'g'ri", "Noto'g'ri", "Qisman"] },
      earned: { type: "integer", minimum: 0 },
      errorType: { type: ["string", "null"], enum: ["Texnik", "Bilim bo'shlig'i", null] },
      evidence: { type: "string" },
      peerSolveRate: { type: ["number", "null"], minimum: 0, maximum: 100 },
    },
  },

  RealData: {
    type: ["object", "null"],
    description: "Kohort bilan solishtirish uchun haqiqiy ma'lumot.",
    properties: {
      percentile: { type: ["number", "null"], minimum: 0, maximum: 100 },
      cohortAverage: { type: ["number", "null"], minimum: 0, maximum: 100 },
      avgTimeSec: { type: ["number", "null"], minimum: 0 },
    },
  },

  SubjectInput: {
    type: "object",
    description: "Natija yaratish/tahrirlashda bitta fan bloki.",
    required: ["subject", "questions"],
    properties: {
      subject: { type: "string", enum: SUBJECT_KEY },
      totalQuestions: { type: "integer", description: "Berilmasa `questions.length` olinadi." },
      totalMarks: { type: "integer", description: "Berilmasa `questions[].marks` yig'indisi olinadi." },
      questions: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/Question" } },
      realData: { $ref: "#/components/schemas/RealData" },
      manualNotes: {
        type: "object",
        properties: { strength: { type: "string" }, growthLabel: { type: "string" } },
      },
    },
  },

  ManualContent: {
    type: "object",
    description:
      "Qo'lda yoziladigan matnlar va avtomatik hisobni bosib o'tuvchi qiymatlar. " +
      "Hammasi ixtiyoriy; berilmagan qismini dvigatel o'zi hisoblaydi.",
    properties: {
      parent: { type: "string", description: "Ota-onaga xulosa." },
      committee: { type: "string", description: "Qabul komissiyasiga xulosa." },
      outlook: { type: "string" },
      math: { $ref: "#/components/schemas/SubjectOverride" },
      english: { $ref: "#/components/schemas/SubjectOverride" },
      criticalThinking: { $ref: "#/components/schemas/SubjectOverride" },
      summary: {
        type: "object",
        properties: {
          overallRank: { type: ["integer", "null"] },
          overallTotal: { type: ["integer", "null"] },
          overallPct: { type: ["number", "null"] },
          crossStrength: { type: "string" },
          gradeLabel: { type: "string" },
          verdictOverride: {
            type: ["object", "null"],
            description: "Qabul qarorini qo'lda qadab qo'yish. Avtomatik qarorga qaytish uchun `null`.",
            properties: {
              label: {
                type: "string",
                enum: [
                  "QABUL TAVSIYA ETILADI", "QABUL QILINSIN", "SHARTLI QABUL",
                  "ZAXIRA QABUL", "NAVBATDA", "TAYYOR EMAS",
                  "STRONG ADMIT", "ADMIT", "CONDITIONAL ADMIT", "WAITLIST", "NOT YET READY",
                ],
              },
              sub: { type: "string" },
            },
          },
        },
      },
    },
  },

  SubjectOverride: {
    type: "object",
    description: "Bitta fan bo'yicha qo'lda kiritiladigan qiymatlar.",
    properties: {
      strength: { type: "string" },
      growthLabel: { type: "string" },
      cohort: {
        type: "object",
        properties: {
          rank: { type: ["integer", "null"] },
          total: { type: ["integer", "null"] },
          percentile: { type: ["number", "null"] },
          maleRank: { type: ["integer", "null"] },
          maleTotal: { type: ["integer", "null"] },
        },
      },
      bloomFallback: { type: "object", additionalProperties: { type: "number" } },
      skillRadar: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "value"],
          properties: { name: { type: "string" }, value: { type: "number" } },
        },
      },
      reasoningTypes: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "value"],
          properties: { name: { type: "string" }, gloss: { type: "string" }, value: { type: "number" } },
        },
      },
      gradeLevelFallback: { type: "object", additionalProperties: { type: "number" } },
      glossary: {
        type: "object",
        properties: {
          skillHelp: { $ref: "#/components/schemas/GlossaryEntries" },
          bloomHelp: { $ref: "#/components/schemas/GlossaryEntries" },
          reasonHelp: { $ref: "#/components/schemas/GlossaryEntries" },
        },
      },
      programs: {
        type: "array",
        description: "Rivojlanish bosqichlari. Qo'shimcha maydonlarga ruxsat (`passthrough`).",
        items: { type: "object", additionalProperties: true },
      },
      narrative: {
        type: "object",
        properties: {
          coverTitle: { type: "string" },
          coverSubtitle: { type: "string" },
          story: { type: "array", items: { type: "string" } },
        },
      },
    },
  },

  GlossaryEntries: {
    type: "array",
    items: {
      type: "object",
      required: ["t", "d"],
      properties: { t: { type: "string", description: "Atama." }, d: { type: "string", description: "Izoh." } },
    },
  },

  I18nText: {
    description:
      "Ko'p tilli matn. `{ same: true, UZ }` — matn barcha tillarda bir xil " +
      "(sof matematik ifodalar uchun). Eski yozuvlar tekis `string` saqlaydi va " +
      '"hamma tilda shu" deb o\'qiladi — shu sababli baza migratsiyasi kerak emas.',
    oneOf: [
      { type: "string" },
      {
        type: "object",
        properties: {
          same: { type: "boolean" },
          UZ: { type: "string" },
          RU: { type: "string" },
          EN: { type: "string" },
        },
      },
    ],
  },

  TestQuestion: {
    type: "object",
    description:
      "Onlayn test savoli. Til-neytral maydonlar (`id`, `type`, `marks`, " +
      "`correctChoiceIds`, `trueFalseItems[].correct`, `matchingPairs[].leftId/rightId`, " +
      "`reorderItems[].correctIndex`) ATAYLAB tarjima qilinmaydi — baholash aynan " +
      "shu id'lar bo'yicha ketadi, ya'ni ular barcha tillarda umumiy bo'lishi shart.",
    required: ["id", "order", "type", "marks", "prompt"],
    properties: {
      id: { type: "string" },
      templateQuestionId: {
        type: "string",
        description:
          "Shablonning qaysi savoliga tegishli. Ixtiyoriy: bu maydondan oldin " +
          "yaratilgan testlarda yo'q va ular INDEKS bo'yicha o'qilishda davom etadi.",
      },
      order: { type: "integer", minimum: 0 },
      type: {
        type: "string",
        enum: ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "FILL_GAP", "MATCHING", "REORDERING"],
      },
      marks: { type: "integer", minimum: 1 },
      prompt: { $ref: "#/components/schemas/I18nText" },
      imageUrl: { type: ["string", "null"], description: "data: URL bo'lishi mumkin — javob katta bo'ladi." },
      choices: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "label"],
          properties: {
            id: { type: "string" },
            label: { $ref: "#/components/schemas/I18nText" },
            imageUrl: { type: ["string", "null"] },
          },
        },
      },
      correctChoiceIds: { type: "array", items: { type: "string" } },
      trueFalseItems: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "text", "correct"],
          properties: {
            id: { type: "string" },
            text: { $ref: "#/components/schemas/I18nText" },
            correct: { type: "boolean" },
          },
        },
      },
      gapAnswers: {
        type: "array",
        description:
          "TASHQI massiv uzunligi = bo'shliqlar soni. ICHKI massiv = shu bo'shliq " +
          "uchun QABUL QILINADIGAN javob variantlari (`3a+4b` uchun `4b+3a` ham). " +
          "Baholash qat'iy: raqamli ekvivalentlik (0.5 ↔ 1/2) O'CHIRILGAN, " +
          "kerakli variantlar qo'lda sanab beriladi.",
        items: {
          oneOf: [
            { $ref: "#/components/schemas/I18nText" },
            { type: "array", items: { $ref: "#/components/schemas/I18nText" } },
          ],
        },
      },
      matchingPairs: {
        type: "array",
        items: {
          type: "object",
          required: ["leftId", "leftText", "rightId", "rightText"],
          properties: {
            leftId: { type: "string" },
            leftText: { $ref: "#/components/schemas/I18nText" },
            rightId: { type: "string" },
            rightText: { $ref: "#/components/schemas/I18nText" },
          },
        },
      },
      reorderItems: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "text", "correctIndex"],
          properties: {
            id: { type: "string" },
            text: { $ref: "#/components/schemas/I18nText" },
            correctIndex: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  },

  PublicTestQuestion: {
    type: "object",
    description:
      "O'quvchiga yuboriladigan savol — `stripAnswers()` dan o'tgan. To'g'ri javoblar " +
      "(`correctChoiceIds`, `trueFalseItems[].correct`, `gapAnswers`, " +
      "`matchingPairs[].rightId`, `reorderItems[].correctIndex`) OLIB TASHLANGAN, " +
      "matn esa lead tilida bitta satrga yechilgan. Variantlar urinish id'si urug'i " +
      "bilan aralashtiriladi — sahifa yangilansa tartib o'zgarmaydi.",
    properties: {
      id: { type: "string" },
      order: { type: "integer" },
      type: { type: "string" },
      marks: { type: "integer" },
      prompt: { type: "string" },
      imageUrl: { type: ["string", "null"] },
      choices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            imageUrl: { type: ["string", "null"] },
          },
        },
      },
      trueFalseItems: {
        type: "array",
        items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } } },
      },
      gapCount: { type: "integer", description: "FILL_GAP: to'ldiriladigan bo'shliqlar soni." },
      matchingLefts: {
        type: "array",
        description: "Chap ustun — muallif tartibida.",
        items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } } },
      },
      matchingRights: {
        type: "array",
        description: "O'ng ustun — ARALASHTIRILGAN, aks holda javob qarama-qarshisida turardi.",
        items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } } },
      },
      reorderItems: {
        type: "array",
        description: "Aralashtirilgan: saqlangan tartib aynan to'g'ri javob tartibi edi.",
        items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } } },
      },
    },
    additionalProperties: true,
  },

  AttemptAnswers: {
    type: "object",
    description:
      "Javoblar savol id'si bo'yicha kalitlanadi. Qiymat shakli savol turiga qarab " +
      "o'zgaradi va bu yerda TEKSHIRILMAYDI — har turga xos tekshiruv baholashda " +
      "(`services/test-grading.ts`) bo'ladi, ya'ni notanish shakl xato emas, " +
      "shunchaki noto'g'ri javob bo'lib qoladi.\n\n" +
      "| Tur | Qiymat |\n" +
      "| --- | --- |\n" +
      "| `MULTIPLE_CHOICE` | `\"choiceId\"` |\n" +
      "| `MULTIPLE_SELECT` | `[\"choiceId\", ...]` |\n" +
      "| `TRUE_FALSE` | `{ \"itemId\": true｜false }` |\n" +
      "| `FILL_GAP` | `[\"javob1\", \"javob2\"]` — bo'shliq tartibida |\n" +
      "| `MATCHING` | `{ \"leftId\": \"rightId\" }` |\n" +
      "| `REORDERING` | `[\"itemId\", ...]` — o'quvchi qo'ygan tartibda |",
    required: ["answers"],
    properties: {
      answers: { type: "object", additionalProperties: true },
      fullscreenExits: {
        type: "integer",
        minimum: 0,
        description:
          "To'liq ekrandan chiqishlar soni. Server `max(saqlangan, yuborilgan)` yozadi — " +
          "sahifa yangilanganda mijoz hisoblagichi noldan boshlanadi va usiz " +
          "yangilash chiqishlarni \"o'chirib\" yuborardi.",
      },
    },
  },

  // ---- Kirish sxemalari (so'rov tanalari) ---------------------------------
  StudentCreate: {
    type: "object",
    description:
      "`fullName` YOKI `firstName` + `lastName` majburiy. Bittasi berilsa " +
      "ikkinchisi hosil qilinadi: ajratish BIRINCHI bo'shliq bo'yicha ketadi, " +
      "ya'ni ko'p so'zli familya butun qoladi " +
      "(\"Olim Aliyev O'g'li\" → ism `Olim`, familya `Aliyev O'g'li`).",
    required: ["grade"],
    properties: {
      fullName: { type: "string", minLength: 1 },
      firstName: { type: "string", minLength: 1 },
      lastName: { type: "string", minLength: 1 },
      uid: { type: ["string", "null"], description: "Unikal. Band bo'lsa 409." },
      examLanguage: { type: ["string", "null"] },
      studentNumber: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      sex: { type: ["string", "null"], enum: ["MALE", "FEMALE", null] },
      birthDate: { type: ["string", "null"], format: "date-time" },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      groupName: { type: ["string", "null"] },
      metadata: { type: ["object", "null"], additionalProperties: true },
    },
  },

  StudentUpdate: {
    type: "object",
    description: "`StudentCreate` ning to'liq ixtiyoriy varianti — `grade` ham majburiy emas.",
    properties: {
      fullName: { type: "string", minLength: 1 },
      firstName: { type: "string", minLength: 1 },
      lastName: { type: "string", minLength: 1 },
      uid: { type: ["string", "null"] },
      examLanguage: { type: ["string", "null"] },
      studentNumber: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      sex: { type: ["string", "null"], enum: ["MALE", "FEMALE", null] },
      birthDate: { type: ["string", "null"], format: "date-time" },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      groupName: { type: ["string", "null"] },
      metadata: { type: ["object", "null"], additionalProperties: true },
    },
  },

  ExamCreate: {
    type: "object",
    required: ["title", "examDate", "admissionThresholds"],
    properties: {
      title: { type: "string", minLength: 1 },
      description: { type: ["string", "null"] },
      examDate: { type: "string", format: "date-time", description: "ISO-8601." },
      academicYear: { type: ["string", "null"], examples: ["2025-2026"] },
      status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"], default: "DRAFT" },
      grade: { type: "integer", minimum: 5, maximum: 11, description: "Eski, bitta sinfli shakl." },
      grades: {
        type: "array",
        items: { type: "integer", minimum: 5, maximum: 11 },
        description: "Yangi, ko'p sinfli shakl. `grade` bilan birga berilsa shu ustun turadi.",
      },
      subjectKeys: {
        type: "array",
        items: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] },
        description: "Berilmasa uchala fan.",
      },
      admissionThresholds: { $ref: "#/components/schemas/AdmissionThresholds" },
      gradingConfiguration: { type: "object", additionalProperties: true, default: {} },
      cohortSize: { type: ["integer", "null"] },
    },
  },

  ExamUpdate: {
    type: "object",
    description: "`ExamCreate` ning to'liq ixtiyoriy varianti.",
    properties: {
      title: { type: "string", minLength: 1 },
      description: { type: ["string", "null"] },
      examDate: { type: "string", format: "date-time" },
      academicYear: { type: ["string", "null"] },
      status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      grades: { type: "array", items: { type: "integer", minimum: 5, maximum: 11 } },
      subjectKeys: { type: "array", items: { type: "string", enum: ["MATH", "ENGLISH", "CRITICAL_THINKING"] } },
      admissionThresholds: { $ref: "#/components/schemas/AdmissionThresholds" },
      gradingConfiguration: { type: "object", additionalProperties: true },
      cohortSize: { type: ["integer", "null"] },
    },
  },

  TestCreate: {
    type: "object",
    required: ["examId", "templateId", "name", "subject", "grade", "languages", "questions"],
    properties: {
      examId: { type: "string", format: "uuid" },
      templateId: { type: "string", format: "uuid" },
      name: { type: "string", minLength: 1 },
      subject: { type: "string", enum: SUBJECT_KEY },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      languages: { type: "array", minItems: 1, items: { type: "string", enum: TEST_LANGUAGE } },
      durationSec: { type: ["integer", "null"], minimum: 1 },
      questions: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/TestQuestion" } },
    },
  },

  TestUpdate: {
    type: "object",
    description: "`TestCreate` ning to'liq ixtiyoriy varianti.",
    properties: {
      examId: { type: "string", format: "uuid" },
      templateId: { type: "string", format: "uuid" },
      name: { type: "string", minLength: 1 },
      subject: { type: "string", enum: SUBJECT_KEY },
      grade: { type: "integer", minimum: 5, maximum: 11 },
      languages: { type: "array", minItems: 1, items: { type: "string", enum: TEST_LANGUAGE } },
      durationSec: { type: ["integer", "null"] },
      questions: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/TestQuestion" } },
    },
  },

  LearningResourceInput: {
    type: "object",
    description: "Yaratishda `subject`, `topic`, `lang`, `type`, `title` majburiy; tahrirlashda hammasi ixtiyoriy.",
    properties: {
      subject: { type: "string", enum: SUBJECT_KEY },
      topic: { type: "string", minLength: 1, description: "Kanonik mavzu, `_default` yoki `_nextLevel`." },
      lang: { type: "string", enum: ["uz", "en"] },
      type: { type: "string", enum: ["video", "platform", "book", "channel", "app"] },
      title: { type: "string", minLength: 1 },
      provider: { type: "string" },
      url: { type: "string", description: "To'g'ri URL yoki bo'sh satr (ustunni tozalaydi)." },
      note: { type: "string" },
      order: { type: "integer", minimum: 0 },
      active: { type: "boolean" },
    },
  },

  AnswerRow: {
    type: "object",
    description:
      "Admin uchun bitta savol qatori. Matnlar KaTeX render'iga tayyor: " +
      "matematik qismlar `$...$` ichida keladi.",
    properties: {
      n: { type: "integer", description: "Savol raqami, 1 dan." },
      type: { type: "string" },
      student: { type: "string", description: "O'quvchi javobi (`—` javob bo'lmasa)." },
      correct: { type: "string", description: "To'g'ri javob." },
      isCorrect: { type: "boolean" },
    },
  },

  TemplateQuestion: {
    type: "object",
    description:
      "Shablon savoli: pedagogika (majburiy `id` + `marks`) va IXTIYORIY savol " +
      "mazmuni. Mazmun yozilgan bo'lsa, testga \"Shablondan import\" bilan ko'chiriladi. " +
      "Pedagogik maydonlar bo'sh bo'lishiga ruxsat — tashqi JSON'lar turlicha " +
      "taksonomiya ishlatadi.",
    required: ["id", "marks"],
    properties: {
      id: { type: "string" },
      marks: { type: "integer", minimum: 0 },
      difficulty: { type: "string" },
      strand: { type: "string" },
      topic: { type: "string" },
      subTopic: { type: "string" },
      skill: { type: "string" },
      bloom: { type: "string" },
      reasoning: { type: ["string", "null"] },
      gradeLevel: { type: "string" },
      framework: { type: "string" },
      techErrorIds: { type: "array", items: {} },
      type: { type: "string" },
      prompt: { $ref: "#/components/schemas/I18nText" },
      imageUrl: { type: ["string", "null"] },
      choices: { type: "array", items: { type: "object", additionalProperties: true } },
      correctChoiceIds: { type: "array", items: { type: "string" } },
      trueFalseItems: { type: "array", items: { type: "object", additionalProperties: true } },
      gapAnswers: { type: "array", items: {} },
      matchingPairs: { type: "array", items: { type: "object", additionalProperties: true } },
      reorderItems: { type: "array", items: { type: "object", additionalProperties: true } },
    },
  },
};
