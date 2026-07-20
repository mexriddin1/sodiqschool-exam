// Lead detalidagi "Javoblarni ko'rish" jadvali uchun: har savol turida
// o'quvchi javobi + to'g'ri javob + to'g'ri/noto'g'ri to'g'ri chiqishi kerak.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildAnswerRows } from "../src/lib/attempt-answers.js";
import { TestQuestion } from "../src/lib/schemas.js";

const s = (uz: string) => ({ same: true, UZ: uz });

const questions = [
  {
    id: "q1", order: 0, type: "MULTIPLE_CHOICE", marks: 1,
    prompt: s("2+2?"),
    choices: [{ id: "a", label: s("3") }, { id: "b", label: s("4") }],
    correctChoiceIds: ["b"],
  },
  {
    id: "q2", order: 1, type: "MULTIPLE_SELECT", marks: 2,
    prompt: s("Tublari?"),
    choices: [{ id: "a", label: s("2") }, { id: "b", label: s("4") }, { id: "c", label: s("7") }],
    correctChoiceIds: ["a", "c"],
  },
  {
    id: "q3", order: 2, type: "TRUE_FALSE", marks: 1,
    prompt: s("Baholang"),
    trueFalseItems: [{ id: "t1", text: s("Yer yumaloq"), correct: true }, { id: "t2", text: s("Suv 50C qaynaydi"), correct: false }],
  },
  {
    id: "q4", order: 3, type: "FILL_GAP", marks: 1,
    prompt: s("Javob: ___"),
    gapAnswers: [s("5.8")],
  },
  {
    id: "q5", order: 4, type: "MATCHING", marks: 2,
    prompt: s("Moslang"),
    matchingPairs: [
      { leftId: "l1", leftText: s("O'zbekiston"), rightId: "r1", rightText: s("Toshkent") },
      { leftId: "l2", leftText: s("Qozog'iston"), rightId: "r2", rightText: s("Ostona") },
    ],
  },
  {
    id: "q6", order: 5, type: "REORDERING", marks: 1,
    prompt: s("Tartiblang"),
    reorderItems: [{ id: "i1", text: s("3"), correctIndex: 0 }, { id: "i2", text: s("7"), correctIndex: 1 }],
  },
] as unknown as TestQuestion[];

test("to'g'ri javoblar: har tur uchun isCorrect va ko'rinish", () => {
  const answers = {
    q1: "b",
    q2: ["a", "c"],
    q3: { t1: true, t2: false },
    q4: ["5.8"], // aynan saqlangan javob
    q5: { l1: "r1", l2: "r2" },
    q6: ["i1", "i2"],
  };
  const rows = buildAnswerRows(questions, answers, "UZ");
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.isCorrect), `hammasi to'g'ri bo'lishi kerak: ${JSON.stringify(rows.map((r) => [r.n, r.isCorrect]))}`);

  assert.equal(rows[0]!.student, "4");
  assert.equal(rows[0]!.correct, "4");
  assert.equal(rows[3]!.student, "$5.8$"); // FILL_GAP ko'rinishi $...$ ga o'raladi
  assert.equal(rows[3]!.correct, "$5.8$");
  assert.ok(rows[4]!.correct.includes("O'zbekiston → Toshkent"));
  assert.ok(rows[5]!.student.includes("→"));
});

test("noto'g'ri va javobsiz javoblar", () => {
  const answers = {
    q1: "a",           // noto'g'ri
    q2: ["a"],         // chala -> noto'g'ri
    // q3 javobsiz
    q4: ["29/5"],      // qiymati 5.8 ga teng, LEKIN forma boshqa -> endi NOTO'G'RI
  };
  const rows = buildAnswerRows(questions, answers, "UZ");
  assert.equal(rows[0]!.isCorrect, false);
  assert.equal(rows[0]!.student, "3");
  assert.equal(rows[1]!.isCorrect, false);
  assert.equal(rows[2]!.isCorrect, false);
  assert.equal(rows[2]!.student, "—"); // javobsiz
  // Raqamli ekvivalentlik O'CHIRILGAN: 29/5 endi 5.8 ga teng deb qabul qilinmaydi.
  assert.equal(rows[3]!.isCorrect, false);
  assert.equal(rows[3]!.student, "$29/5$");
});
