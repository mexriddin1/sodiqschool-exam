// MATCHING va REORDERING o'quvchiga ARALASHTIRILGAN holda ketishi kerak.
//
// Nega test bor: ilgari MATCHING "aralashtirgichi" id'ning faqat birinchi
// harfiga qaraydigan `sort` edi. JSON bilan kiritilgan savollarda id'lar bir
// xil harfdan boshlanadi ("q5-r1", "q5-r2", ...), ya'ni komparator har doim
// 0 qaytarib, tartibni umuman o'zgartirmasdi — o'quvchi to'g'ri javobni
// chap ustunning qarama-qarshisida ko'rib turardi. REORDERING esa umuman
// aralashtirilmasdi.
//
// Shuning uchun bu yerda "aralashtirilganmi" emas, "JAVOB TARTIBIDA EMASMI"
// tekshiriladi — buzuq aralashtirgich ham "aralashtirdim" deb da'vo qilardi.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { stripAnswers } from "../src/lib/question-view.js";
import { TestQuestion } from "../src/lib/schemas.js";

type ClientView = {
  matchingLefts?: { id: string; text: string }[];
  matchingRights?: { id: string; text: string }[];
  reorderItems?: { id: string; text: string }[];
};

const view = (q: TestQuestion, seed: string) => stripAnswers(q, "UZ", seed) as ClientView;

/** JSON bilan kiritilgandagi id'lar — hammasi "q5-" bilan boshlanadi. */
const matching = (): TestQuestion =>
  ({
    id: "q5",
    order: 0,
    type: "MATCHING",
    marks: 4,
    prompt: { same: true, UZ: "Mos juftlikni toping" },
    matchingPairs: [
      { leftId: "q5-l1", leftText: { same: true, UZ: "O'zbekiston" }, rightId: "q5-r1", rightText: { same: true, UZ: "Toshkent" } },
      { leftId: "q5-l2", leftText: { same: true, UZ: "Qozog'iston" }, rightId: "q5-r2", rightText: { same: true, UZ: "Ostona" } },
      { leftId: "q5-l3", leftText: { same: true, UZ: "Qirg'iziston" }, rightId: "q5-r3", rightText: { same: true, UZ: "Bishkek" } },
      { leftId: "q5-l4", leftText: { same: true, UZ: "Tojikiston" }, rightId: "q5-r4", rightText: { same: true, UZ: "Dushanbe" } },
    ],
  }) as unknown as TestQuestion;

/** Muallif elementlarni to'g'ri ketma-ketlikda yozadi — saqlangan tartib = javob. */
const reordering = (): TestQuestion =>
  ({
    id: "q6",
    order: 0,
    type: "REORDERING",
    marks: 3,
    prompt: { same: true, UZ: "Kichikdan kattaga tartiblang" },
    reorderItems: [
      { id: "q6-1", text: { same: true, UZ: "3" }, correctIndex: 0 },
      { id: "q6-2", text: { same: true, UZ: "7" }, correctIndex: 1 },
      { id: "q6-3", text: { same: true, UZ: "12" }, correctIndex: 2 },
      { id: "q6-4", text: { same: true, UZ: "20" }, correctIndex: 3 },
    ],
  }) as unknown as TestQuestion;

test("MATCHING: o'ng ustun javob tartibida ketmaydi", () => {
  const answerOrder = ["q5-r1", "q5-r2", "q5-r3", "q5-r4"];
  // Ko'p urinishning HAR BIRIDA javob tartibi chiqmasligi kerak.
  for (let i = 0; i < 200; i++) {
    const rights = view(matching(), `attempt-${i}`).matchingRights!.map((r) => r.id);
    assert.notDeepEqual(rights, answerOrder, `urinish ${i}: o'ng ustun javob tartibida keldi`);
    assert.deepEqual([...rights].sort(), [...answerOrder].sort(), "elementlar yo'qolmasligi kerak");
  }
});

test("MATCHING: chap ustun tartibi saqlanadi", () => {
  const lefts = view(matching(), "a1").matchingLefts!.map((l) => l.id);
  assert.deepEqual(lefts, ["q5-l1", "q5-l2", "q5-l3", "q5-l4"]);
});

test("REORDERING: javob tartibida ketmaydi", () => {
  const answerOrder = ["q6-1", "q6-2", "q6-3", "q6-4"];
  for (let i = 0; i < 200; i++) {
    const items = view(reordering(), `attempt-${i}`).reorderItems!.map((r) => r.id);
    assert.notDeepEqual(items, answerOrder, `urinish ${i}: javob tartibida keldi`);
    assert.deepEqual([...items].sort(), [...answerOrder].sort(), "elementlar yo'qolmasligi kerak");
  }
});

test("bitta urinishda tartib BARQAROR — refresh/davom ettirishda sakramaydi", () => {
  const a = view(matching(), "attempt-xyz").matchingRights!.map((r) => r.id);
  const b = view(matching(), "attempt-xyz").matchingRights!.map((r) => r.id);
  assert.deepEqual(a, b);

  const r1 = view(reordering(), "attempt-xyz").reorderItems!.map((r) => r.id);
  const r2 = view(reordering(), "attempt-xyz").reorderItems!.map((r) => r.id);
  assert.deepEqual(r1, r2);
});

test("har o'quvchida tartib boshqacha", () => {
  // Ilgari urug' faqat savol id'si edi — hamma bir xil tartib ko'rardi.
  const orders = new Set<string>();
  for (let i = 0; i < 50; i++) {
    orders.add(view(matching(), `attempt-${i}`).matchingRights!.map((r) => r.id).join(","));
  }
  assert.ok(orders.size > 1, `hamma urinishda bir xil tartib chiqdi: ${[...orders]}`);
});

test("2 elementli MATCHING ham javob tartibida ketmaydi", () => {
  // Eng nozik holat: halol aralashtirish ham har 2 martadan birida
  // boshlang'ich tartibni qaytaradi.
  const q = {
    id: "q9",
    order: 0,
    type: "MATCHING",
    marks: 2,
    prompt: { same: true, UZ: "?" },
    matchingPairs: [
      { leftId: "q9-l1", leftText: { same: true, UZ: "A" }, rightId: "q9-r1", rightText: { same: true, UZ: "1" } },
      { leftId: "q9-l2", leftText: { same: true, UZ: "B" }, rightId: "q9-r2", rightText: { same: true, UZ: "2" } },
    ],
  } as unknown as TestQuestion;

  for (let i = 0; i < 200; i++) {
    const rights = view(q, `attempt-${i}`).matchingRights!.map((r) => r.id);
    assert.notDeepEqual(rights, ["q9-r1", "q9-r2"], `urinish ${i}: javob tartibida keldi`);
  }
});

test("to'g'ri javoblar o'quvchiga ketmaydi", () => {
  const m = stripAnswers(matching(), "UZ", "a1") as Record<string, unknown>;
  assert.equal(m.matchingPairs, undefined, "matchingPairs javob kalitini o'z ichiga oladi");

  const r = stripAnswers(reordering(), "UZ", "a1") as Record<string, unknown>;
  const items = r.reorderItems as Record<string, unknown>[];
  assert.ok(items.every((i) => i.correctIndex === undefined), "correctIndex — javobning o'zi");
});
