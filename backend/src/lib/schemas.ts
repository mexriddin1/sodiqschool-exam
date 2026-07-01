import { z } from "zod";

// Per-question shape. Mirrors @sodiq/compute Question.
export const questionSchema = z.object({
  id: z.string().min(1),
  marks: z.number().int().nonnegative(),
  difficulty: z.enum(["Oson", "O'rta", "Qiyin"]),
  strand: z.string(),
  topic: z.string(),
  subTopic: z.string(),
  skill: z.string(),
  bloom: z.enum(["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"]),
  reasoning: z.enum(["Deduktiv", "Induktiv", "Analitik", "Fazoviy"]).nullable(),
  gradeLevel: z.string(),
  framework: z.string(),
  result: z.enum(["To'g'ri", "Noto'g'ri", "Qisman"]),
  earned: z.number().int().nonnegative(),
  errorType: z.enum(["Texnik", "Bilim bo'shlig'i"]).nullable(),
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

export const studentCreateSchema = z.object({
  fullName: z.string().min(1),
  studentNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  sex: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  grade: z.number().int().min(5).max(11),
  groupName: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export const examCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  examDate: z.string().datetime(),
  academicYear: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  grade: z.number().int().min(5).max(11),
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
        "QABUL TAVSIYA ETILADI", "QABUL QILINSIN", "SHARTLI QABUL", "NAVBATDA", "TAYYOR EMAS",
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
  code: z.string().min(6).max(6),
  password: z.string().min(1),
});

export type StudentCreate = z.infer<typeof studentCreateSchema>;
export type ExamCreate = z.infer<typeof examCreateSchema>;
export type ResultCreate = z.infer<typeof resultCreateSchema>;
export type ResultUpdate = z.infer<typeof resultUpdateSchema>;
export type SubjectInput = z.infer<typeof subjectInputSchema>;
