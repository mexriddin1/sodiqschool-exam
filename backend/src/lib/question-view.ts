// O'quvchiga ketadigan savol ko'rinishi: to'g'ri javoblar olib tashlanadi,
// matn bitta tilga yechiladi, MATCHING/REORDERING esa aralashtiriladi.
//
// Nega alohida fayl: bu sof funksiya (savol + til + urug' -> ko'rinish), va
// route ichida turganda uni sinash uchun express bilan prisma'ni ko'tarish
// kerak bo'lardi. Baholash (services/test-grading.ts) ham xuddi shu sababdan
// alohida turadi — ikkalasi bitta shartnomaning ikki tomoni: bu yerda nima
// YASHIRILSA, o'sha yerda o'shanga qarab baholanadi.

import { resolveText, TestQuestion } from "./schemas.js";
import type { TestLanguage } from "@prisma/client";

/**
 * Urug'lantirilgan tasodifiy son (mulberry32).
 *
 * Urug' — urinish + savol, ya'ni tartib:
 *   - bitta o'quvchida BARQAROR: sahifa yangilanganda yoki test davom
 *     ettirilganda savol ko'z oldida qayta aralashib ketmaydi;
 *   - har o'quvchida BOSHQACHA.
 */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates: har bir o'rin almashinuvi teng ehtimolli. */
function shuffle<T>(items: T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Aralashtiradi va natija JAVOB TARTIBIDA qolib ketmasligiga kafolat beradi.
 *
 * Halol aralashtirish ham ba'zan boshlang'ich tartibni qaytaradi — ikki
 * element uchun har ikki martadan biri. Aynan o'sha holatda o'quvchiga
 * to'g'ri javob ko'rinib qoladi, shuning uchun bir qadam suramiz.
 */
function shuffleAwayFromAnswer<T extends { id: string }>(
  items: T[],
  answerOrder: string[],
  rnd: () => number,
): T[] {
  if (items.length < 2) return [...items];
  const out = shuffle(items, rnd);
  if (out.every((x, i) => x.id === answerOrder[i])) {
    return [...out.slice(1), out[0]!];
  }
  return out;
}

/**
 * @param seed Urinish id'si — tartib shu o'quvchi uchun barqaror bo'lishi
 *   uchun. Bo'sh bo'lsa (ko'rib chiqish) savolning o'zi urug' bo'ladi.
 */
/**
 * Savoldan to'g'ri javob maydonlarini olib tashlaydi — aks holda o'quvchi
 * javob tanasiga qarab javoblarni o'qib olardi.
 *
 * Til ham AYNAN shu yerda yechiladi: o'quvchining tili har bir maydondan
 * bitta satrni tanlaydi, ya'ni test-app boshqa tarjimalar borligini umuman
 * bilmaydi va ular brauzerga hech qachon yetib bormaydi.
 */
export function stripAnswers(q: TestQuestion, lang: TestLanguage, seed: string): unknown {
  const t = (v: Parameters<typeof resolveText>[0]) => resolveText(v, lang);
  const rnd = seededRandom(`${seed}:${q.id}`);
  const base = {
    id: q.id,
    order: q.order,
    type: q.type,
    marks: q.marks,
    prompt: t(q.prompt),
    imageUrl: q.imageUrl ?? null,
  } as Record<string, unknown>;
  if (q.choices) {
    base.choices = q.choices.map((c) => ({ id: c.id, label: t(c.label), imageUrl: c.imageUrl ?? null }));
  }
  if (q.trueFalseItems) {
    base.trueFalseItems = q.trueFalseItems.map((it) => ({ id: it.id, text: t(it.text) }));
  }
  if (q.gapAnswers) {
    // Bo'shliqlar soni tilga bog'liq emas (schemas.ts izohiga qarang).
    base.gapCount = q.gapAnswers.length;
  }
  if (q.matchingPairs) {
    // Chap ustun tartibida; o'ng ustun ARALASHTIRILADI — aks holda javob
    // shundoq qarama-qarshisida turadi.
    //
    // Ilgari bu `sort` edi va id'ning FAQAT BIRINCHI HARFIGA qarardi. JSON
    // bilan kiritilgan savollarda id'lar bir xil harfdan boshlanadi
    // ("q5-r1", "q5-r2", ...), ya'ni komparator har doim 0 qaytarib,
    // tartibni umuman o'zgartirmasdi — o'quvchi javobni ko'rib turardi.
    const pairs = q.matchingPairs;
    const rights = pairs.map((p) => ({ id: p.rightId, text: t(p.rightText) }));
    base.matchingLefts = pairs.map((p) => ({ id: p.leftId, text: t(p.leftText) }));
    base.matchingRights = shuffleAwayFromAnswer(rights, pairs.map((p) => p.rightId), rnd);
  }
  if (q.reorderItems) {
    // Saqlangan tartib — aynan JAVOB tartibi (muallif elementlarni to'g'ri
    // ketma-ketlikda yozadi), shuning uchun uni shundoq berib bo'lmasdi.
    const items = q.reorderItems;
    const answerOrder = [...items].sort((a, b) => a.correctIndex - b.correctIndex).map((i) => i.id);
    base.reorderItems = shuffleAwayFromAnswer(
      items.map((i) => ({ id: i.id, text: t(i.text) })),
      answerOrder,
      rnd,
    );
  }
  return base;
}
