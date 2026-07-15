// Local demo data — run AFTER `npm run seed`.
//
// The seed gives you an admin, one grade-5 exam, three templates and three
// DRAFT results. That is not enough to actually see the product:
//   - nothing is PUBLISHED, so the student report site has nothing to show
//     and cohort rank/percentile has no peers to rank against;
//   - there are no `Test` rows, so test-app's /tests page is empty.
//
// This script fills both gaps:
//   1. 12 published grade-5 students with DELIBERATELY VARIED scores, so
//      cohort rank, percentile and the sex-split standings are meaningful.
//   2. One Test per subject, questions aligned 1:1 with the template so the
//      pedagogy (topic/strand/skill) lines up with the graded outcome.
//   3. A few Leads across the funnel statuses.
//
// The seed's own three DRAFT results are left alone on purpose — they give
// admin something to exercise the publish flow against.
//
// Idempotent: re-running replaces the mock students, tests and leads.

import { PrismaClient, Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Question, SubjectKey } from "@sodiq/compute";

import { computeSnapshot, recomputeCohortRanks } from "../src/services/snapshot.js";
import { ensureStudentCredentials } from "../src/services/student-credentials.js";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DATA = resolve(__dirname, "../../client/src/data");

const load = (n: string) =>
  JSON.parse(readFileSync(resolve(CLIENT_DATA, n), "utf8")) as { questions: Question[] };

const FILES: Record<SubjectKey, string> = {
  MATH: "student.json",
  ENGLISH: "english.json",
  CRITICAL_THINKING: "critical-thinking.json",
};

// Deterministic RNG so re-running produces the same cohort — otherwise ranks
// shuffle on every run and screenshots stop matching.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Re-mark a template's questions to land near `accuracy` AS A SHARE OF MARKS,
// keeping every invariant validateQuestions() enforces:
//   earned <= marks | correct => errorType null | not-correct => earned != marks
//
// Marks are wildly uneven — critical-thinking is 10 questions worth 6/10/16
// each, so two lucky answers swing the subject by 32%. Rolling per question
// therefore produced a non-monotonic cohort (a 40%-accurate student outscoring
// a 48% one). Instead we walk a shuffled order and keep marking correct while
// the mark budget allows, which tracks the target closely on every subject.
//
// `techShare` splits wrong answers between careless ("Texnik") and genuine
// gaps ("Bilim bo'shlig'i") so the technical-error analysis has real signal.
function markQuestions(base: Question[], accuracy: number, techShare: number, seed: number): Question[] {
  const rand = rng(seed);
  const totalMarks = base.reduce((s, q) => s + q.marks, 0);
  const budget = accuracy * totalMarks;

  // Fisher-Yates over indices — which questions are missed still varies per
  // student, so topic/strand analysis differs between them.
  const order = base.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  const out = base.map((q) => ({ ...q }));
  let spent = 0;
  for (const idx of order) {
    const q = out[idx]!;
    if (spent + q.marks <= budget) {
      q.result = "To'g'ri";
      q.earned = q.marks;
      q.errorType = null;
      spent += q.marks;
      continue;
    }
    // Doesn't fit the budget — a miss. Award partial credit where it still
    // fits, so "Qisman" shows up in the report rather than only pass/fail.
    const half = Math.floor(q.marks / 2);
    const partial = half > 0 && spent + half <= budget && rand() < 0.4;
    q.result = partial ? "Qisman" : "Noto'g'ri";
    q.earned = partial ? half : 0;
    q.errorType = rand() < techShare ? "Texnik" : "Bilim bo'shlig'i";
    if (partial) spent += half;
  }
  return out;
}

// A spread wide enough to exercise every verdict band and both gate outcomes.
const COHORT = [
  { firstName: "Islombek", lastName: "Rahmonov", sex: "MALE", acc: 0.95, tech: 0.6 },
  { firstName: "Zilola", lastName: "Karimova", sex: "FEMALE", acc: 0.91, tech: 0.5 },
  { firstName: "Doniyor", lastName: "Toshev", sex: "MALE", acc: 0.86, tech: 0.55 },
  { firstName: "Madina", lastName: "Yusupova", sex: "FEMALE", acc: 0.8, tech: 0.4 },
  { firstName: "Javohir", lastName: "Ergashev", sex: "MALE", acc: 0.74, tech: 0.45 },
  { firstName: "Sevinch", lastName: "Abdullayeva", sex: "FEMALE", acc: 0.68, tech: 0.35 },
  { firstName: "Amirbek", lastName: "Nazarov", sex: "MALE", acc: 0.61, tech: 0.3 },
  { firstName: "Nilufar", lastName: "Saidova", sex: "FEMALE", acc: 0.55, tech: 0.3 },
  { firstName: "Bekzod", lastName: "Qodirov", sex: "MALE", acc: 0.48, tech: 0.25 },
  { firstName: "Gulnoza", lastName: "Mirzayeva", sex: "FEMALE", acc: 0.4, tech: 0.2 },
  { firstName: "Sardor", lastName: "Umarov", sex: "MALE", acc: 0.33, tech: 0.15 },
  { firstName: "Oysha", lastName: "Tursunova", sex: "FEMALE", acc: 0.22, tech: 0.1 },
] as const;

// Test-app'da olti xil savol turi bor, lekin mock faqat MULTIPLE_CHOICE
// yaratardi — ya'ni qolgan besh turni demoda umuman ko'rib bo'lmasdi va
// ularning baholanishi ham sinovdan o'tmasdi. Endi turlar aylanma tartibda
// beriladi: eng qisqa test ham (CT — 10 savol) oltalasini qamrab oladi.
const TYPE_CYCLE = [
  "MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE",
  "FILL_GAP", "MATCHING", "REORDERING",
] as const;

// One test question per template question, in the SAME order. Index alignment
// is what public.testtaking.ts relies on to attach pedagogy to a graded
// answer, so generating from the template keeps them in step.
//
// Content is trilingual (UZ/RU/EN) so the language path is actually
// exercisable in the demo — a RU lead must see RU text. Every 5th question
// uses `same: true` to cover the "identical in all languages" case (the one
// meant for pure-maths prompts that must not be retyped per language).
function buildTestQuestions(template: Question[], subject: SubjectKey) {
  return template.map((tq, i) => {
    const sameForAll = i % 5 === 4;
    const type = TYPE_CYCLE[i % TYPE_CYCLE.length]!;

    // Uch tilli matn yasovchi — `same` holatida bir marta yoziladi.
    const t3 = (uz: string, ru: string, en: string) =>
      sameForAll ? { same: true, UZ: uz } : { UZ: uz, RU: ru, EN: en };

    const head = `[${subject} ${i + 1}]`;
    const base = {
      id: tq.id,
      order: i,
      marks: tq.marks,
      // Rasm yo'q: demo rasmlar repoga qo'shilmaydi — maktab o'z
      // savollariga adminda o'zi rasm yuklaydi.
      imageUrl: null,
    };

    if (type === "MULTIPLE_SELECT") {
      const choices = ["A", "B", "C", "D"].map((letter) => ({
        id: `${tq.id}-${letter}`,
        label: t3(
          `${letter}) ${tq.topic} — variant ${letter}`,
          `${letter}) ${tq.topic} — вариант ${letter}`,
          `${letter}) ${tq.topic} — option ${letter}`,
        ),
      }));
      return {
        ...base,
        type,
        prompt: t3(
          `${head} ${tq.topic} — bir nechta javob to'g'ri (mock).`,
          `${head} ${tq.topic} — несколько верных ответов (mock).`,
          `${head} ${tq.topic} — several answers are correct (mock).`,
        ),
        choices,
        // Ikkita to'g'ri javob — indeksga qarab siljiydi.
        correctChoiceIds: [choices[i % 4]!.id, choices[(i + 2) % 4]!.id],
      };
    }

    if (type === "TRUE_FALSE") {
      return {
        ...base,
        type,
        prompt: t3(
          `${head} ${tq.topic} — har bir iborani baholang (mock).`,
          `${head} ${tq.topic} — оцените каждое утверждение (mock).`,
          `${head} ${tq.topic} — judge each statement (mock).`,
        ),
        trueFalseItems: [0, 1, 2].map((k) => ({
          id: `${tq.id}-tf${k}`,
          text: t3(
            `${tq.subTopic} — ibora ${k + 1}`,
            `${tq.subTopic} — утверждение ${k + 1}`,
            `${tq.subTopic} — statement ${k + 1}`,
          ),
          // Naqsh o'zgarib turadi, hammasi "to'g'ri" bo'lib qolmaydi.
          correct: (i + k) % 2 === 0,
        })),
      };
    }

    if (type === "FILL_GAP") {
      return {
        ...base,
        type,
        prompt: t3(
          `${head} ${tq.topic}: $${i + 1} + ${i + 2} =$ ___ va $${i + 1} \\times 2 =$ ___`,
          `${head} ${tq.topic}: $${i + 1} + ${i + 2} =$ ___ и $${i + 1} \\times 2 =$ ___`,
          `${head} ${tq.topic}: $${i + 1} + ${i + 2} =$ ___ and $${i + 1} \\times 2 =$ ___`,
        ),
        // Javob raqam — barcha tillarda bir xil, ya'ni `same`.
        gapAnswers: [
          { same: true, UZ: String(i + 1 + (i + 2)) },
          { same: true, UZ: String((i + 1) * 2) },
        ],
      };
    }

    if (type === "MATCHING") {
      return {
        ...base,
        type,
        prompt: t3(
          `${head} ${tq.topic} — mos juftlikni toping (mock).`,
          `${head} ${tq.topic} — найдите соответствие (mock).`,
          `${head} ${tq.topic} — find the matching pair (mock).`,
        ),
        matchingPairs: [0, 1, 2].map((k) => ({
          leftId: `${tq.id}-l${k}`,
          leftText: t3(`Chap ${k + 1}`, `Левый ${k + 1}`, `Left ${k + 1}`),
          rightId: `${tq.id}-r${k}`,
          rightText: t3(`O'ng ${k + 1}`, `Правый ${k + 1}`, `Right ${k + 1}`),
        })),
      };
    }

    if (type === "REORDERING") {
      return {
        ...base,
        type,
        prompt: t3(
          `${head} ${tq.topic} — kichikdan kattaga tartiblang (mock).`,
          `${head} ${tq.topic} — расположите по возрастанию (mock).`,
          `${head} ${tq.topic} — sort from smallest to largest (mock).`,
        ),
        reorderItems: [0, 1, 2, 3].map((k) => ({
          id: `${tq.id}-r${k}`,
          text: { same: true, UZ: String((k + 1) * (i + 2)) },
          correctIndex: k,
        })),
      };
    }

    // MULTIPLE_CHOICE — asosiy tur.
    const choices = ["A", "B", "C", "D"].map((letter) => ({
      id: `${tq.id}-${letter}`,
      label: sameForAll
        ? { same: true, UZ: `${letter}) $${i + 1}x + ${letter.charCodeAt(0) - 64}$` }
        : {
            UZ: `${letter}) ${tq.topic} — variant ${letter}`,
            RU: `${letter}) ${tq.topic} — вариант ${letter}`,
            EN: `${letter}) ${tq.topic} — option ${letter}`,
          },
    }));
    // Vary the correct letter by index so it isn't always "A".
    const correct = choices[i % 4]!;
    return {
      ...base,
      type,
      prompt: sameForAll
        ? { same: true, UZ: `${head} $${i + 1}x^2 + ${i} = 0$` }
        : {
            UZ: `${head} ${tq.topic} / ${tq.subTopic} — namunaviy savol (mock).`,
            RU: `${head} ${tq.topic} / ${tq.subTopic} — образец вопроса (mock).`,
            EN: `${head} ${tq.topic} / ${tq.subTopic} — sample question (mock).`,
          },
      choices,
      correctChoiceIds: [correct.id],
    };
  });
}

async function main() {
  const exam = await prisma.exam.findFirst({
    where: { title: "Sodiq School kirish imtihoni — 5-sinf (seed)" },
  });
  if (!exam) throw new Error("Seed exam topilmadi — avval `npm run seed --workspace backend`.");

  // ---- clean previous mock run -------------------------------------------
  // MOCK- - this script's own cohort. LEAD- - synthetic students that
  // public.testtaking.ts mints for every funnel attempt; they pile up in the
  // real roster, so a demo reset should clear them too.
  const stale = await prisma.student.findMany({
    where: { OR: [{ uid: { startsWith: "MOCK-" } }, { uid: { startsWith: "LEAD-" } }] },
    select: { id: true },
  });
  await prisma.testAttempt.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.test.deleteMany({ where: { examId: exam.id } });
  if (stale.length) {
    const ids = stale.map((s) => s.id);
    await prisma.result.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    console.log(`↺ tozalandi: ${stale.length} ta eski mock/lead student`);
  }

  const base: Record<SubjectKey, Question[]> = {
    MATH: load(FILES.MATH).questions,
    ENGLISH: load(FILES.ENGLISH).questions,
    CRITICAL_THINKING: load(FILES.CRITICAL_THINKING).questions,
  };

  // ---- 1) published cohort ------------------------------------------------
  const SUBJECTS: SubjectKey[] = ["MATH", "ENGLISH", "CRITICAL_THINKING"];
  let i = 0;
  for (const p of COHORT) {
    i++;
    const student = await prisma.student.create({
      data: {
        fullName: `${p.firstName} ${p.lastName}`,
        firstName: p.firstName,
        lastName: p.lastName,
        uid: `MOCK-${String(i).padStart(3, "0")}`,
        grade: 5,
        sex: p.sex,
        examLanguage: i % 3 === 0 ? "RU" : "UZ",
        phone: `+9989012345${String(i).padStart(2, "0")}`,
      },
    });

    const result = await prisma.result.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        publicCode: `MOCK${String(i).padStart(2, "0")}`,
        accessPasswordHash: "",
        accessPassword: "",
        status: "DRAFT",
        manualContent: {},
        unlockedSections: ["narrative", "roadmap", "risks_notes"],
        subjects: {
          create: SUBJECTS.map((sk, si) => {
            // Different seed per (student, subject) so a student isn't equally
            // strong in all three — that's what makes top/low subject real.
            const qs = markQuestions(base[sk], p.acc, p.tech, i * 100 + si);
            return {
              subject: sk,
              totalQuestions: qs.length,
              totalMarks: qs.reduce((s, q) => s + q.marks, 0),
              questions: qs as unknown as Prisma.InputJsonValue,
            };
          }),
        },
      },
      include: { subjects: true, student: true, exam: true },
    });

    const creds = await ensureStudentCredentials(student.id);
    const snapshot = computeSnapshot(result);
    await prisma.result.update({
      where: { id: result.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        calculatedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    console.log(
      `✔ ${student.fullName.padEnd(22)} login=${(creds.loginCode ?? "").padEnd(12)} parol=${(creds.plainPassword ?? "-").padEnd(12)} ` +
        `ball=${String(snapshot.composite.composite).padStart(3)} salohiyat=${String(snapshot.composite.compPotential).padStart(3)} → ${snapshot.composite.verdict.label}`,
    );
  }

  // Ranks only make sense once every peer is PUBLISHED.
  await recomputeCohortRanks(exam.id);
  console.log(`✔ cohort ranklar hisoblandi (${COHORT.length} ta o'quvchi)`);

  // ---- 2) tests for test-app ---------------------------------------------
  const NAMES: Record<SubjectKey, string> = {
    MATH: "5-sinf Matematika — onlayn test",
    ENGLISH: "5-sinf Ingliz tili — onlayn test",
    CRITICAL_THINKING: "5-sinf Tanqidiy fikrlash — onlayn test",
  };
  for (const sk of SUBJECTS) {
    const tpl = await prisma.testTemplate.findFirst({ where: { examId: exam.id, subject: sk, grade: 5 } });
    if (!tpl) {
      console.warn(`! ${sk} uchun template topilmadi — o'tkazib yuborildi`);
      continue;
    }
    const qs = buildTestQuestions(base[sk], sk);
    await prisma.test.create({
      data: {
        examId: exam.id,
        templateId: tpl.id,
        name: NAMES[sk],
        subject: sk,
        grade: 5,
        // `languages` endi "qaysi tillarda mazmuni bor" degani (Faza 4), ya'ni
        // buildTestQuestions() uchala tilni to'ldirgani uchun uchalasi ham.
        languages: ["UZ", "RU", "EN"],
        durationSec: 45 * 60,
        questions: qs as unknown as Prisma.InputJsonValue,
      },
    });
    console.log(`✔ test: ${NAMES[sk]} (${qs.length} savol, 45 daqiqa)`);
  }

  // ---- 3) leads -----------------------------------------------------------
  const LEADS = [
    { firstName: "Ozoda", lastName: "Hamidova", sex: "FEMALE", phone: "+998901112233", status: "FORM_ONLY" },
    { firstName: "Temur", lastName: "Aliyev", sex: "MALE", phone: "+998901112244", status: "FORM_ONLY" },
    { firstName: "Laylo", lastName: "Sobirova", sex: "FEMALE", phone: "+998901112255", status: "STARTED" },
  ] as const;
  for (const l of LEADS) {
    await prisma.lead.create({
      data: {
        firstName: l.firstName,
        lastName: l.lastName,
        sex: l.sex,
        phone: l.phone,
        grade: 5,
        examLanguage: "UZ",
        status: l.status,
      },
    });
  }
  console.log(`✔ ${LEADS.length} ta lead yaratildi`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
