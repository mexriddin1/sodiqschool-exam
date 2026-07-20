import { z } from "zod";

const techErrorIdsSchema = z.array(
  z.union([
    z.string().min(1),
    z.object({ id: z.string().min(1), note: z.string().optional() }),
  ]),
).optional();

// templateQuestionSchema pastda — u savol MAZMUNI tiplariga (localizedText,
// choiceSchema, ...) tayanadi va ular quyiroqda ta'riflangan.

// Result question: strict version for result creation/validation.
export const questionSchema = z.object({
  id: z.string().min(1),
  marks: z.number().int().nonnegative(),
  difficulty: z.enum(["Oson", "O'rta", "Qiyin"]),
  strand: z.string(),
  topic: z.string(),
  subTopic: z.string(),
  skill: z.string(),
  bloom: z.enum(["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"]),
  reasoning: z.enum(["Deduktiv", "Induktiv", "Analitik", "Fazoviy", "Inferensial"]).nullable(),
  gradeLevel: z.string(),
  framework: z.string(),
  techErrorIds: techErrorIdsSchema,
  result: z.enum(["To'g'ri", "Noto'g'ri", "Qisman"]),
  earned: z.number().int().nonnegative(),
  errorType: z.enum(["Texnik", "Bilim bo'shlig'i"]).nullable().optional(),
  evidence: z.string(),
  peerSolveRate: z.number().min(0).max(100).nullable().optional(),
});

export const realDataSchema = z
  .object({
    percentile: z.number().min(0).max(100).nullable(),
    cohortAverage: z.number().min(0).max(100).nullable(),
    avgTimeSec: z.number().nonnegative().nullable(),
  })
  .nullable()
  .optional();

export const subjectKeySchema = z.enum(["MATH", "ENGLISH", "CRITICAL_THINKING"]);

export const subjectInputSchema = z.object({
  subject: subjectKeySchema,
  totalQuestions: z.number().int().positive().optional(),
  totalMarks: z.number().int().positive().optional(),
  questions: z.array(questionSchema).min(1),
  realData: realDataSchema,
  manualNotes: z
    .object({
      strength: z.string().optional(),
      growthLabel: z.string().optional(),
    })
    .optional(),
});

export const admissionThresholdsSchema = z.record(
  z.string().regex(/^\d+$/),
  z.object({ math: z.number(), ct: z.number(), en: z.number() }),
);

// Base object — kept unwrapped so studentUpdateSchema can call .partial().
// The name-presence rule lives on studentCreateSchema below via .refine().
const studentBaseSchema = z.object({
  // Either provide `fullName`, or provide `firstName` + `lastName` and the
  // server will derive the combined value. Both fields are accepted so old
  // admin flows keep working.
  fullName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  uid: z.string().min(1).optional().nullable(),
  examLanguage: z.string().min(1).optional().nullable(),
  studentNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  sex: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  grade: z.number().int().min(5).max(11),
  groupName: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const studentCreateSchema = studentBaseSchema.refine(
  (d) => !!d.fullName || (!!d.firstName && !!d.lastName),
  { message: "fullName yoki firstName+lastName kerak", path: ["fullName"] },
);

export const studentUpdateSchema = studentBaseSchema.partial();

// Bulk JSON import — same shape as create, but as an array. Server splits
// fullName when only that is provided, so import files can use either shape.
export const studentImportSchema = z.object({
  students: z.array(studentCreateSchema).min(1).max(2000),
});

export const examCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  examDate: z.string().datetime(),
  academicYear: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  // Legacy single grade — accept it OR the new `grades` array. At least one
  // must be present; the route normalises them into a consistent shape.
  grade: z.number().int().min(5).max(11).optional(),
  grades: z.array(z.number().int().min(5).max(11)).optional(),
  // Subjects this exam tests. Empty → treat as all three fan (backwards compat).
  subjectKeys: z.array(z.enum(["MATH", "ENGLISH", "CRITICAL_THINKING"])).optional(),
  admissionThresholds: admissionThresholdsSchema,
  gradingConfiguration: z.record(z.string(), z.unknown()).default({}),
  cohortSize: z.number().int().positive().optional().nullable(),
});

export const examUpdateSchema = examCreateSchema.partial();

// Per-subject override block — mirrors client/src/lib/client-data.ts SubjectOverrides.
const subjectCohortSchema = z.object({
  rank: z.number().int().nullable().optional(),
  total: z.number().int().nullable().optional(),
  percentile: z.number().nullable().optional(),
  maleRank: z.number().int().nullable().optional(),
  maleTotal: z.number().int().nullable().optional(),
});

const glossaryEntrySchema = z.object({ t: z.string(), d: z.string() });
const glossarySchema = z.object({
  skillHelp: z.array(glossaryEntrySchema).optional(),
  bloomHelp: z.array(glossaryEntrySchema).optional(),
  reasonHelp: z.array(glossaryEntrySchema).optional(),
});

const programStageSchema = z
  .object({
    num: z.number().optional(),
    months: z.number().optional(),
    range: z.string().optional(),
    phase: z.string().optional(),
    title: z.string().optional(),
    mission: z.string().optional(),
    weeklyHours: z.string().optional(),
    monthlyHours: z.string().optional(),
    totalHours: z.string().optional(),
    goal: z.string().optional(),
    outcome: z.string().optional(),
    closing: z.string().optional(),
    actions: z.array(z.object({ do: z.string(), dose: z.string() })).optional(),
    weekPlan: z.array(z.object({ period: z.string(), focus: z.string(), task: z.string() })).optional(),
    checkpoints: z.array(z.object({ label: z.string(), lines: z.array(z.string()) })).optional(),
    resources: z.object({
      exercises: z.array(z.string()).optional(),
      books: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
      videos: z.array(z.string()).optional(),
    }).optional(),
    roles: z.object({
      parent: z.array(z.string()).optional(),
      teacher: z.array(z.string()).optional(),
      student: z.array(z.string()).optional(),
    }).optional(),
    topics: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    kpis: z.array(z.string()).optional(),
    criteria: z.array(z.string()).optional(),
    risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).optional(),
    priority: z.object({ label: z.string(), color: z.string() }).optional(),
    confidence: z.object({ label: z.string(), color: z.string().optional() }).optional(),
  })
  .passthrough();

const narrativeSchema = z.object({
  coverTitle: z.string().optional(),
  coverSubtitle: z.string().optional(),
  story: z.array(z.string()).optional(),
});

const subjectOverrideSchema = z.object({
  strength: z.string().optional(),
  growthLabel: z.string().optional(),
  cohort: subjectCohortSchema.optional(),
  bloomFallback: z.record(z.string(), z.number()).optional(),
  skillRadar: z.array(z.object({ name: z.string(), value: z.number() })).optional(),
  reasoningTypes: z
    .array(z.object({ name: z.string(), gloss: z.string().optional(), value: z.number() }))
    .optional(),
  gradeLevelFallback: z.record(z.string(), z.number()).optional(),
  glossary: glossarySchema.optional(),
  programs: z.array(programStageSchema).optional(),
  narrative: narrativeSchema.optional(),
});

const summaryOverrideSchema = z.object({
  overallRank: z.number().int().nullable().optional(),
  overallTotal: z.number().int().nullable().optional(),
  overallPct: z.number().nullable().optional(),
  crossStrength: z.string().optional(),
  gradeLabel: z.string().optional(),
  // Manual admission verdict override. Admin can pin the badge instead of the
  // auto-computed one. Enum from the official "Yakuniy shkala" — plus a
  // "AUTO" marker to explicitly clear a previous override.
  verdictOverride: z
    .object({
      label: z.enum([
        "QABUL TAVSIYA ETILADI", "QABUL QILINSIN", "SHARTLI QABUL", "ZAXIRA QABUL", "NAVBATDA", "TAYYOR EMAS",
        // Legacy English labels — accept for backwards compatibility with old
        // manualContent records that were saved before the Uzbek rename.
        "STRONG ADMIT", "ADMIT", "CONDITIONAL ADMIT", "WAITLIST", "NOT YET READY",
      ]),
      sub: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const manualContentSchema = z
  .object({
    parent: z.string().optional(),
    committee: z.string().optional(),
    outlook: z.string().optional(),
    math: subjectOverrideSchema.optional(),
    english: subjectOverrideSchema.optional(),
    criticalThinking: subjectOverrideSchema.optional(),
    summary: summaryOverrideSchema.optional(),
  })
  .default({});

export const resultCreateSchema = z.object({
  studentId: z.string().uuid(),
  examId: z.string().uuid(),
  manualContent: manualContentSchema,
  subjects: z.array(subjectInputSchema).length(3),
});

export const resultUpdateSchema = z.object({
  manualContent: manualContentSchema.optional(),
  subjects: z.array(subjectInputSchema).length(3).optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resultLoginSchema = z.object({
  // Legacy 6-char codes still work. New CSV-imported format is
  // `<LastInit><FirstInit><UID>` (~9-12 chars). Bounds cover both.
  code: z.string().trim().min(4).max(32),
  password: z.string().min(1),
});

export type StudentCreate = z.infer<typeof studentCreateSchema>;
export type ExamCreate = z.infer<typeof examCreateSchema>;
export type ResultCreate = z.infer<typeof resultCreateSchema>;
export type ResultUpdate = z.infer<typeof resultUpdateSchema>;
export type SubjectInput = z.infer<typeof subjectInputSchema>;

// ---------------- Live test-taking (new flow) ----------------

export const testLanguageSchema = z.enum(["UZ", "RU", "EN"]);
export const questionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "TRUE_FALSE",
  "FILL_GAP",
  "MATCHING",
  "REORDERING",
]);

// ---- Ko'p tilli matn --------------------------------------------------
//
// Savol matni va variantlar test tanlagan tillarda (UZ/RU/EN) bo'ladi.
// Faqat TANLANGAN tillar to'ldiriladi — `Test.languages` endi "kimga
// ko'rsatiladi" emas, "qaysi tillarda mazmuni bor" degani.
//
// `same: true` — matn barcha tillarda bir xil, bir marta (UZ maydonida)
// kiritiladi. Sof matematik savollar uchun: "$x^2+5$" har uchala tilda
// aynan bir xil, uni uch marta qayta terish faqat xato manbai bo'lardi —
// va baholash savol matnini umuman o'qimagani uchun bunday xatoni
// SEZMAYDI (RU tarjimada $x^3$ deb yozilsa, RU o'quvchilar boshqa savolga
// javob beradi va hech kim bilmaydi).
export const i18nTextSchema = z.object({
  same: z.boolean().optional(),
  UZ: z.string().optional(),
  RU: z.string().optional(),
  EN: z.string().optional(),
});
export type I18nText = z.infer<typeof i18nTextSchema>;

// Eski (bir tilli) qatorlar tekis `string` saqlaydi. Ularni `{same:true,UZ}`
// sifatida o'qiymiz — shu tufayli DB backfill'i UMUMAN kerak emas va eski
// testlar buzilmasdan ishlayveradi.
const localizedText = z
  .union([z.string(), i18nTextSchema])
  .transform((v): I18nText => (typeof v === "string" ? { same: true, UZ: v } : v));

// Bitta bo'shliq uchun QABUL QILINADIGAN javoblar ro'yxati. O'quvchi javobi
// (normallangan) shulardan biriga mos kelsa — to'g'ri. Masalan `3a+4b` uchun
// `4b+3a` ham, `\frac{1}{2}` uchun `0.5` ham (admin xohlasa) kiritiladi.
//
// Eski (bitta javobli) shaklni ham qabul qilamiz va massivga o'raymiz — shu
// tufayli DB backfill'i UMUMAN kerak emas, eski testlar buzilmaydi.
const gapAcceptedAnswers = z
  .union([localizedText, z.array(localizedText)])
  .transform((v): I18nText[] => (Array.isArray(v) ? v : [v]));

/**
 * Berilgan til uchun matnni tanlaydi. `same` bo'lsa — UZ hamma til uchun.
 *
 * Xom `string` ni ham qabul qiladi va uni "hamma tilda shu" deb hisoblaydi.
 * Bu SHART: `Test.questions` — Json ustuni, va o'qish yo'llari uni zod bilan
 * parse qilmasdan `as unknown as TestQuestion[]` deb cast qiladi
 * (public.testtaking.ts). Ya'ni yuqoridagi `localizedText` transform'i faqat
 * YOZISHDA ishlaydi; o'qishda esa eski qatorlar tekis string bo'lib keladi.
 * Buni hisobga olmasak, eski savollar jimgina bo'sh matn bo'lib ko'rinardi.
 */
export function resolveText(
  v: I18nText | string | undefined | null,
  lang: "UZ" | "RU" | "EN",
): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v.same) return v.UZ ?? "";
  return v[lang] ?? "";
}

const choiceSchema = z.object({
  id: z.string().min(1),
  label: localizedText,
  imageUrl: z.string().optional().nullable(),
});

const trueFalseItemSchema = z.object({
  id: z.string().min(1),
  text: localizedText,
  correct: z.boolean(),
});

const matchingPairSchema = z.object({
  leftId: z.string().min(1),
  leftText: localizedText,
  rightId: z.string().min(1),
  rightText: localizedText,
});

const reorderItemSchema = z.object({
  id: z.string().min(1),
  text: localizedText,
  correctIndex: z.number().int().nonnegative(),
});

// Til-neytral maydonlar (id, order, type, marks, imageUrl, correctChoiceIds,
// trueFalseItems[].correct, matchingPairs[].leftId/rightId,
// reorderItems[].correctIndex) ATAYLAB tillanmaydi — baholash aynan shularga
// tayanadi (6 turdan 5 tasi id bo'yicha solishtiradi), ya'ni id'lar barcha
// tillarda umumiy bo'lishi shart.
export const testQuestionSchema = z.object({
  id: z.string().min(1),
  /**
   * Shablonning QAYSI savoliga tegishli.
   *
   * Hisobotdagi mavzu / strand / ko'nikma / Bloom yorliqlari shablondan
   * keladi. Ilgari bog'lanish massiv INDEKSI edi: testning 3-savoli doim
   * shablonning 3-qatorini olardi — admin u yerga nima yozganidan qat'i
   * nazar. Ya'ni savollar boshqa tartibda yozilsa, hisobot jimgina noto'g'ri
   * mavzuni ko'rsatardi va buni hech narsa sezmasdi.
   *
   * Ixtiyoriy: bu maydondan oldin yaratilgan testlarda yo'q, ular indeks
   * bo'yicha o'qilishda davom etadi.
   */
  templateQuestionId: z.string().min(1).optional(),
  order: z.number().int().nonnegative(),
  type: questionTypeSchema,
  marks: z.number().int().positive(),
  prompt: localizedText,
  imageUrl: z.string().optional().nullable(),
  choices: z.array(choiceSchema).optional(),
  correctChoiceIds: z.array(z.string()).optional(),
  trueFalseItems: z.array(trueFalseItemSchema).optional(),
  // TASHQI massiv uzunligi = bo'shliqlar soni (til bo'yicha O'ZGARMAYDI:
  // struktura umumiy, faqat matn tillanadi — stripAnswers dagi gapCount).
  // ICHKI massiv = shu bo'shliq uchun qabul qilinadigan javob variantlari.
  gapAnswers: z.array(gapAcceptedAnswers).optional(),
  matchingPairs: z.array(matchingPairSchema).optional(),
  reorderItems: z.array(reorderItemSchema).optional(),
});

export type TestQuestion = z.infer<typeof testQuestionSchema>;

/**
 * Savol MAZMUNI — bola o'qiydigan qism. Hammasi ixtiyoriy.
 *
 * Shablon uzoq vaqt faqat pedagogika (mavzu/ball/qiyinlik) saqlagan: oflayn
 * imtihonda matn qog'ozda edi. Onlayn test uchun matn kerak, va uni har safar
 * qo'lda yozmaslik uchun shablonning o'ziga yozib qo'yish mumkin — keyin
 * "Shablondan import" uni testga ko'chiradi.
 *
 * Ixtiyoriyligi SHART: eski shablonlarda bu qism yo'q va ular avvalgidek
 * ishlashda davom etadi (import bo'sh slot beradi).
 */
const questionContentShape = {
  type: questionTypeSchema.optional(),
  prompt: localizedText.optional(),
  imageUrl: z.string().optional().nullable(),
  choices: z.array(choiceSchema).optional(),
  correctChoiceIds: z.array(z.string()).optional(),
  trueFalseItems: z.array(trueFalseItemSchema).optional(),
  gapAnswers: z.array(gapAcceptedAnswers).optional(),
  matchingPairs: z.array(matchingPairSchema).optional(),
  reorderItems: z.array(reorderItemSchema).optional(),
};

// Template question: pedagogy + (ixtiyoriy) savol mazmuni.
// All pedagogy fields except id/marks are optional so any external JSON
// (different bloom taxonomy labels, extra reasoning types, missing fields)
// is accepted.
export const templateQuestionSchema = z.object({
  id: z.coerce.string().min(1),
  marks: z.coerce.number().int().nonnegative(),
  difficulty: z.string().optional(),
  strand: z.string().optional(),
  topic: z.string().optional(),
  subTopic: z.string().optional(),
  skill: z.string().optional(),
  bloom: z.string().optional(),
  reasoning: z.string().nullable().optional(),
  gradeLevel: z.string().optional(),
  framework: z.string().optional(),
  techErrorIds: techErrorIdsSchema,
  ...questionContentShape,
});

export type TemplateQuestion = z.infer<typeof templateQuestionSchema>;

export const testCreateSchema = z.object({
  examId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1),
  subject: subjectKeySchema,
  grade: z.number().int().min(5).max(11),
  languages: z.array(testLanguageSchema).min(1),
  durationSec: z.number().int().positive().nullable().optional(),
  questions: z.array(testQuestionSchema).min(1),
});

export const testUpdateSchema = testCreateSchema.partial();

// Public-site form (natijalar.sodiqschool.uz) — lead intake.
export const leadCreateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  sex: z.enum(["MALE", "FEMALE"]),
  phone: z.string().trim().min(6).max(24),
  grade: z.number().int().min(5).max(11),
  examLanguage: testLanguageSchema,
  // Oldingi maktab — ixtiyoriy. Bo'sh satr ham "yo'q" deb qabul qilinadi.
  previousSchool: z.string().trim().max(200).optional(),
});

export const attemptStartSchema = z.object({
  leadId: z.string().uuid(),
  testId: z.string().uuid(),
});

// Answers keyed by question id. Value shape depends on question type — we
// validate the container here and defer per-type validation to grading.
export const attemptAnswersSchema = z.object({
  answers: z.record(z.string(), z.any()),
  // To'liq ekrandan chiqishlar soni — mijoz sanaydi, autosave bilan yuboradi.
  // Ixtiyoriy: eski mijoz (ochiq turgan tab) yubormasa ham autosave buzilmasin.
  fullscreenExits: z.number().int().nonnegative().optional(),
});

export type TestCreateInput = z.infer<typeof testCreateSchema>;
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
