// O'zbek telefon raqami — kiritish niqobi.
//
// Ko'rinishi:  +998 (90) 123-45-67
// Yuboriladi:  +998901234567  (E.164)
//
// `+998` inputning ICHIDA emas, yonida qotirilgan prefiks sifatida turadi.
// Nega: aks holda foydalanuvchi o'zi "998..." deb yozganda uni niqobning
// prefiksidan ajratib bo'lmaydi — va "99" ning o'zi ham haqiqiy operator
// kodi, ya'ni "998 ni tashlab yubor" qoidasi to'g'ri raqamni buzadi.
// Prefiks tashqarida bo'lsa, input faqat 9 ta milliy raqamni ko'radi.
//
// E.164 yuborilishining sababi: bazaga formatlangan satr ketsa, bir odam
// "+998 (90) 123-45-67" va "+998901234567" ko'rinishida ikkita lead bo'lardi
// — takror esa telefon bo'yicha topiladi (docs/test-taking-plan.md, 7-qaror).

const NDIGITS = 9; // 998 dan keyingi raqamlar soni

/** Kiritilgan matndan milliy raqamlarni ajratadi (ko'pi bilan 9 ta). */
export function uzPhoneDigits(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  // Nusxa-joylash holati: to'liq xalqaro raqam tashlangan bo'lsa (998 + 9 ta),
  // mamlakat kodini olib tashlaymiz. Qo'lda yozishda bu holat yuzaga kelmaydi,
  // chunki 9 tadan oshgani kesiladi.
  if (d.length > NDIGITS && d.startsWith("998")) d = d.slice(3);
  return d.slice(0, NDIGITS);
}

/** Milliy qism: "(90) 123-45-67" — prefikssiz. */
export function formatUzNational(raw: string): string {
  const d = uzPhoneDigits(raw);
  if (d.length === 0) return "";
  let out = "(" + d.slice(0, 2);
  if (d.length >= 2) out += ")";
  if (d.length > 2) out += " " + d.slice(2, 5);
  if (d.length > 5) out += "-" + d.slice(5, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  return out;
}

/** To'liq ko'rinish — prefiks bilan. */
export function formatUzPhone(raw: string): string {
  const n = formatUzNational(raw);
  return n ? `+998 ${n}` : "";
}

/** To'liq raqam kiritilganmi (9 ta raqam). */
export function isUzPhoneComplete(raw: string): boolean {
  return uzPhoneDigits(raw).length === NDIGITS;
}

/** Backendga yuboriladigan shakl. */
export function toE164(raw: string): string {
  return "+998" + uzPhoneDigits(raw);
}
