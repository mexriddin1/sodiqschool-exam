// Testlar ketma-ketligi — /tests va /done sahifalari uchun umumiy mantiq.
//
// Tartib QAT'IY: matematika -> ingliz tili -> tanqidiy fikrlash. O'quvchi
// tanlamaydi; avvalgisi topshirilmaguncha keyingisi qulflangan turadi.
// Backend ham shu tartibda saralaydi (public.testtaking.ts SUBJECT_SEQUENCE) —
// bu yer esa qulflashni va "navbatdagi test" ni hisoblaydi.

export const SUBJECT_SEQUENCE = ["MATH", "ENGLISH", "CRITICAL_THINKING"] as const;
export type Subject = (typeof SUBJECT_SEQUENCE)[number];

// Fan nomlari lib/i18n.ts da (subjectLabel) — ular ham lead tiliga qarab
// o'zgaradi, ya'ni bu yerda qattiq o'zbekcha ro'yxat bo'lishi mumkin emas.

export interface TestRow {
  id: string;
  name: string;
  subject: Subject;
  grade: number;
  languages: string[];
  durationSec: number | null;
  questionCount: number;
  /** Shu lead bu testni topshirganmi (backend hisoblaydi). */
  completed?: boolean;
}

export interface SequencedTest extends TestRow {
  /** Ro'yxatdagi o'rni: 1, 2, 3 — o'quvchiga ko'rsatiladi. */
  step: number;
  /** Hozir topshiriladigan test — faqat bittasi. */
  isNext: boolean;
  /** Navbati kelmagan: oldingisi hali topshirilmagan. */
  locked: boolean;
}

/**
 * Testlarni qat'iy tartibga soladi va har biriga holat beradi.
 *
 * Navbatdagi = tartibda birinchi topshirilmagan test. Qolgan
 * topshirilmaganlar qulflanadi, ya'ni bir vaqtda faqat bitta test ochiq.
 */
export function sequenceTests(items: TestRow[]): SequencedTest[] {
  const ordered = [...items].sort(
    (a, b) => SUBJECT_SEQUENCE.indexOf(a.subject) - SUBJECT_SEQUENCE.indexOf(b.subject),
  );
  const nextId = ordered.find((t) => !t.completed)?.id;
  return ordered.map((t, i) => ({
    ...t,
    step: i + 1,
    isNext: t.id === nextId,
    locked: !t.completed && t.id !== nextId,
  }));
}

/** Hozir topshiriladigan test. Hammasi tugagan bo'lsa — undefined. */
export function nextTest(items: TestRow[]): SequencedTest | undefined {
  return sequenceTests(items).find((t) => t.isNext);
}
