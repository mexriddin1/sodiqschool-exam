// Faza 4 — savol matni 3 tilda (UZ/RU/EN).
//
// Ikki asosiy kafolat:
//   1. Eski (bir tilli, tekis `string`) savollar buzilmaydi — ular
//      `{same:true, UZ}` sifatida o'qiladi, ya'ni DB backfill'i kerak emas.
//   2. Baholash spinasi (id'lar) tilga bog'liq emas; FILL_GAP esa o'quvchi
//      test topshirgan tildagi javobni kutadi.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { resolveText, testQuestionSchema } from "../src/lib/schemas.js";
import { gradeQuestion } from "../src/services/test-grading.js";

test("resolveText: tanlangan tilni qaytaradi", () => {
  const v = { UZ: "Salom", RU: "Привет", EN: "Hello" };
  assert.equal(resolveText(v, "UZ"), "Salom");
  assert.equal(resolveText(v, "RU"), "Привет");
  assert.equal(resolveText(v, "EN"), "Hello");
});

test("resolveText: same=true bo'lsa UZ hamma til uchun ishlaydi", () => {
  // Sof matematik savol — uch marta qayta terish faqat xato manbai.
  const v = { same: true, UZ: "$x^2 + 5$" };
  assert.equal(resolveText(v, "UZ"), "$x^2 + 5$");
  assert.equal(resolveText(v, "RU"), "$x^2 + 5$");
  assert.equal(resolveText(v, "EN"), "$x^2 + 5$");
});

test("resolveText: tanlanmagan til bo'sh satr qaytaradi (undefined emas)", () => {
  const v = { UZ: "Salom" };
  assert.equal(resolveText(v, "RU"), "");
  assert.equal(resolveText(undefined, "UZ"), "");
});

// DIQQAT: bu eng muhim test. Prod o'qish yo'li `Test.questions` (Json) ni
// zod bilan PARSE QILMAYDI — `as unknown as TestQuestion[]` deb cast qiladi
// (public.testtaking.ts). Ya'ni `localizedText` transform'i o'qishda
// ishlamaydi va eski savollar xom `string` bo'lib keladi. Avval bu testsiz
// eski savollar jonli tizimda bo'sh matn bo'lib chiqdi, unit testlar esa
// parse qilgani uchun o'tib ketaverdi.
test("PARSE QILINMAGAN xom string (prod o'qish yo'li) matnni yo'qotmaydi", () => {
  const rawFromDb = "2 + 2 nechchi?" as unknown as Parameters<typeof resolveText>[0];
  for (const lang of ["UZ", "RU", "EN"] as const) {
    assert.equal(resolveText(rawFromDb, lang), "2 + 2 nechchi?");
  }
});

test("eski tekis-string savol {same:true, UZ} bo'lib o'qiladi — backfill kerak emas", () => {
  // Aynan bugungi DB'dagi shakl.
  const legacy = {
    id: "q1",
    order: 0,
    type: "MULTIPLE_CHOICE",
    marks: 2,
    prompt: "2 + 2 nechchi?",
    choices: [
      { id: "q1-A", label: "3" },
      { id: "q1-B", label: "4" },
    ],
    correctChoiceIds: ["q1-B"],
  };
  const parsed = testQuestionSchema.parse(legacy);
  assert.deepEqual(parsed.prompt, { same: true, UZ: "2 + 2 nechchi?" });
  assert.deepEqual(parsed.choices?.[1]?.label, { same: true, UZ: "4" });
  // Va shu tufayli har uchala tilda ham ko'rinadi:
  for (const lang of ["UZ", "RU", "EN"] as const) {
    assert.equal(resolveText(parsed.prompt, lang), "2 + 2 nechchi?");
  }
});

test("yangi 3 tilli savol parse bo'ladi va id'lar til-neytral qoladi", () => {
  const q = testQuestionSchema.parse({
    id: "q1",
    order: 0,
    type: "MULTIPLE_CHOICE",
    marks: 2,
    prompt: { UZ: "Poytaxt qaysi?", RU: "Какая столица?", EN: "Which capital?" },
    choices: [
      { id: "q1-A", label: { UZ: "Toshkent", RU: "Ташкент", EN: "Tashkent" } },
      { id: "q1-B", label: { UZ: "Samarqand", RU: "Самарканд", EN: "Samarkand" } },
    ],
    correctChoiceIds: ["q1-A"],
  });
  assert.equal(resolveText(q.prompt, "RU"), "Какая столица?");
  assert.equal(resolveText(q.choices![0]!.label, "EN"), "Tashkent");
  // Id'lar tarjima qilinmaydi — baholash aynan shularga tayanadi.
  assert.equal(q.choices![0]!.id, "q1-A");
  assert.deepEqual(q.correctChoiceIds, ["q1-A"]);
});

test("MULTIPLE_CHOICE baholash tilga bog'liq emas (id bo'yicha)", () => {
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "MULTIPLE_CHOICE", marks: 3,
    prompt: { UZ: "…", RU: "…" },
    choices: [{ id: "a", label: { UZ: "A", RU: "А" } }, { id: "b", label: { UZ: "B", RU: "Б" } }],
    correctChoiceIds: ["b"],
  });
  // Bir xil javob (id) — ikkala tilda ham to'g'ri.
  for (const lang of ["UZ", "RU"] as const) {
    const g = gradeQuestion(q, "b", lang);
    assert.equal(g.correct, true, `${lang} da to'g'ri bo'lishi kerak`);
    assert.equal(g.earned, 3);
  }
});

test("FILL_GAP: kutilgan javob o'quvchi tilidan olinadi", () => {
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 2,
    prompt: { UZ: "Poytaxt — ___", RU: "Столица — ___" },
    gapAnswers: [{ UZ: "Toshkent", RU: "Ташкент" }],
  });

  assert.equal(gradeQuestion(q, ["Toshkent"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["Ташкент"], "RU").correct, true);
  // Boshqa tildagi javob o'z tilida to'g'ri hisoblanmaydi:
  assert.equal(gradeQuestion(q, ["Ташкент"], "UZ").correct, false);
  assert.equal(gradeQuestion(q, ["Toshkent"], "RU").correct, false);
});

test("FILL_GAP: same=true javob barcha tillarda qabul qilinadi", () => {
  // Matematik javob — tilga bog'liq emas.
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 1,
    prompt: { UZ: "$2+2=$ ___", RU: "$2+2=$ ___" },
    gapAnswers: [{ same: true, UZ: "4" }],
  });
  for (const lang of ["UZ", "RU", "EN"] as const) {
    assert.equal(gradeQuestion(q, ["4"], lang).correct, true, `${lang}`);
  }
});

test("FILL_GAP: eski tekis-string javob hali ham ishlaydi", () => {
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 1,
    prompt: "Javob: ___",
    gapAnswers: ["olma"],
  });
  assert.equal(gradeQuestion(q, ["olma"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["OLMA"], "RU").correct, true, "eski savol har tilda ishlaydi");
});

test("gapAnswers uzunligi = bo'shliqlar soni, til bo'yicha o'zgarmaydi", () => {
  const q = testQuestionSchema.parse({
    id: "q1", order: 0, type: "FILL_GAP", marks: 2,
    prompt: { UZ: "___ va ___", RU: "___ и ___" },
    gapAnswers: [{ UZ: "bir", RU: "один" }, { UZ: "ikki", RU: "два" }],
  });
  // Struktura umumiy — forma tilga qarab boshqacha ko'rinmaydi.
  assert.equal(q.gapAnswers?.length, 2);
  assert.equal(gradeQuestion(q, ["bir", "ikki"], "UZ").correct, true);
  assert.equal(gradeQuestion(q, ["один", "два"], "RU").correct, true);
});
