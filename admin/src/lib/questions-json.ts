// Savollar JSON'ini tekshirish — QuestionsJsonPanel (faqat savollar) va
// TestJsonPanel (butun test) shu yerdan foydalanadi.
//
// Nega alohida: ikkala panel ham bir xil savol massivini qabul qiladi, faqat
// o'rami boshqacha. Tekshiruv nusxalansa, ikkisi vaqt o'tib bir-biridan
// ajralib ketadi — bir panel qabul qilgan JSON'ni ikkinchisi rad etardi.

import { type Lang, toI18n } from "@/components/I18nField";
import { questionStatus, type TestQuestion } from "@/components/QuestionBuilder";

export const QTYPES = [
  "MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE",
  "FILL_GAP", "MATCHING", "REORDERING",
];

/**
 * Ball JSON'dan olinadimi yoki shablondan.
 *
 * Ikkala panel bir xil savol massivini oladi, lekin ball masalasida ular
 * ATAYLAB farq qiladi — bu tasodifiy ajralish emas:
 *
 * - `required` — TestJsonPanel: testni noldan yaratadi, hali hech qanday
 *   slot yo'q, ya'ni ballni JSON'dan boshqa joydan olib bo'lmaydi.
 * - `fromTemplate` — QuestionsJsonPanel: mavjud slotlarni to'ldiradi, va ball
 *   allaqachon shablondan qulflangan (QuestionBuilder'da ham input disabled).
 *   JSON'dagi ball e'tiborga olinmaydi — aks holda qulf chetlab o'tilardi.
 */
export type MarksMode = "required" | "fromTemplate";

/** Massiv yoki `{ questions: [...] }` — ikkalasi ham qabul qilinadi. */
export function parseQuestionsPayload(data: unknown): TestQuestion[] | null {
  const arr: unknown = Array.isArray(data) ? data : (data as { questions?: unknown })?.questions;
  return Array.isArray(arr) ? (arr as TestQuestion[]) : null;
}

/**
 * Savollarni tekshiradi va ogohlantirishlar ro'yxatini qaytaradi (bo'sh =
 * xatolik yo'q).
 *
 * Backend savol sonini tekshiradi, lekin bo'sh matnli yoki to'g'ri javobsiz
 * savolni bemalol qabul qiladi — ya'ni buzuq JSON jimgina saqlanib, o'quvchi
 * bo'sh savol ko'rishi mumkin. Shuning uchun joylashdan oldin shu yerda
 * tekshiramiz.
 */
export function validateQuestions(
  qs: TestQuestion[],
  expectedCount: number | undefined,
  languages: Lang[],
  marksMode: MarksMode = "required",
): string[] {
  const lines: string[] = [];
  // `fromTemplate` da ball JSON'dan olinmaydi. Jimgina tashlab yubormaymiz:
  // admin ball yozgan bo'lsa, u qo'llandi deb o'ylab qolmasligi kerak.
  const ignoredMarks: string[] = [];

  if (expectedCount != null && qs.length !== expectedCount) {
    lines.push(`Savol soni mos emas: shablonda ${expectedCount} ta, JSON'da ${qs.length} ta.`);
  }

  qs.forEach((q, i) => {
    const n = `#${i + 1}`;
    if (!q || typeof q !== "object") return lines.push(`${n}: obyekt emas.`);
    if (!q.id) lines.push(`${n}: "id" yo'q.`);
    if (!QTYPES.includes(q.type)) lines.push(`${n}: noma'lum "type": ${JSON.stringify(q.type)}.`);
    if (marksMode === "required") {
      if (!(typeof q.marks === "number" && q.marks > 0)) lines.push(`${n}: "marks" musbat son bo'lishi kerak.`);
    } else if (q.marks !== undefined) {
      ignoredMarks.push(n);
    }

    const p = toI18n(q.prompt);
    const hasPrompt = p.same ? (p.UZ ?? "").trim() !== "" : languages.some((l) => (p[l] ?? "").trim() !== "");
    if (!hasPrompt) lines.push(`${n}: savol matni bo'sh.`);

    if (q.type === "MULTIPLE_CHOICE" && (q.correctChoiceIds ?? []).length !== 1) {
      lines.push(`${n}: MULTIPLE_CHOICE uchun aynan bitta "correctChoiceIds" kerak.`);
    }
    if (q.type === "MULTIPLE_SELECT" && (q.correctChoiceIds ?? []).length === 0) {
      lines.push(`${n}: MULTIPLE_SELECT uchun kamida bitta "correctChoiceIds" kerak.`);
    }
    // Javob kaliti mavjud variant id'siga ishora qilyaptimi?
    const ids = new Set((q.choices ?? []).map((c) => c.id));
    for (const cid of q.correctChoiceIds ?? []) {
      if (!ids.has(cid)) lines.push(`${n}: "correctChoiceIds" da "${cid}" variantlar orasida yo'q.`);
    }

    const st = questionStatus(q, languages);
    if (st !== "complete" && hasPrompt) {
      lines.push(`${n}: chala — tanlangan tillar to'liq emas yoki javob kaliti yo'q.`);
    }
  });

  // Bitta yig'ma qator: 50 savolli testda har biriga alohida ogohlantirish
  // yozilsa, haqiqiy xatolar ro'yxatdan siqib chiqarilardi.
  if (ignoredMarks.length) {
    const shown = ignoredMarks.slice(0, 5).join(", ");
    const rest = ignoredMarks.length > 5 ? ` va yana ${ignoredMarks.length - 5} ta` : "";
    lines.push(`"marks" e'tiborga olinmadi (${shown}${rest}) — ball shablondan olinadi.`);
  }

  const dupes = qs.map((q) => q?.id).filter((id, i, a) => id && a.indexOf(id) !== i);
  if (dupes.length) lines.push(`Takrorlangan id: ${[...new Set(dupes)].join(", ")}`);

  return lines;
}
