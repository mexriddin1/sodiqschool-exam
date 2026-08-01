// Ota-ona "Familya + Ism + Sinf" bilan kirganda ismlarni solishtirish uchun
// normalizatsiya. Faqat SOLISHTIRISH uchun — ekranda hech qachon bu shakl
// ko'rsatilmaydi.
//
// Nega kerak: bazadagi ism uchta xil yo'l bilan yozilgan bo'lishi mumkin —
// funnel formasi (o'quvchi o'zi yozadi), admin paneli va CSV import. Apostrof
// varianti (G'ulomov / Gʻulomov / G‘ulomov), ortiqcha bo'shliq, katta-kichik
// harf va kirill yozuvi — hammasi bir xil odamni bildiradi, lekin baytlar
// darajasida teng emas.

// Kirill → lotin. To'liq translitаratsiya emas: maqsad — ikkala tomonni BIR
// XIL shaklga keltirish, chiroyli lotin matn chiqarish emas. Ko'p belgili
// almashtirishlar (ч→ch) bir belgililardan oldin bajarilishi kerak.
const CYRILLIC_MAP: [RegExp, string][] = [
  [/ё/g, "yo"], [/ж/g, "j"], [/ц/g, "ts"], [/ч/g, "ch"], [/ш/g, "sh"],
  [/щ/g, "sh"], [/ю/g, "yu"], [/я/g, "ya"], [/ў/g, "o"], [/қ/g, "q"],
  [/ғ/g, "g"], [/ҳ/g, "h"], [/а/g, "a"], [/б/g, "b"], [/в/g, "v"],
  [/г/g, "g"], [/д/g, "d"], [/е/g, "e"], [/з/g, "z"], [/и/g, "i"],
  [/й/g, "y"], [/к/g, "k"], [/л/g, "l"], [/м/g, "m"], [/н/g, "n"],
  [/о/g, "o"], [/п/g, "p"], [/р/g, "r"], [/с/g, "s"], [/т/g, "t"],
  [/у/g, "u"], [/ф/g, "f"], [/х/g, "h"], [/ъ/g, ""], [/ь/g, ""],
  [/э/g, "e"], [/ы/g, "i"],
];

/**
 * Bitta ism bo'lagini kanonik shaklga keltiradi.
 * `G'ulomov` = `Gʻulomov` = `Gulomov` = `ГУЛОМОВ` → `gulomov`.
 */
export function normalizeNamePart(input: unknown): string {
  let s = String(input ?? "").trim().toLowerCase();
  if (!s) return "";

  // Kirill NFKD dan OLDIN: `ў` va `й` Unicode'da "у/и + qo'shimcha belgi" ga
  // ajraladi, ya'ni dekompozitsiyadan keyin ular `u` va `i` bo'lib qolardi
  // (kerakli `o` va `y` o'rniga).
  for (const [re, to] of CYRILLIC_MAP) s = s.replace(re, to);

  // Unicode dekompozitsiya — aksentli lotin harflari (ǵ, ń) "asosiy harf +
  // qo'shimcha belgi" ga ajraladi; qo'shimcha belgi quyidagi filtrda tushadi.
  s = s.normalize("NFKD");

  // Apostrof/tutuq belgisi va boshqa hamma narsa (chiziqcha, nuqta, bo'shliq)
  // tashlanadi — faqat harf va raqam qoladi. Shu bilan `Sayfiddin-o'g'li` va
  // `Sayfiddin ogli` bir xil kalitga tushadi.
  return s.replace(/[^a-z0-9]/g, "");
}

/**
 * Ism bo'laklaridan tartibga bog'liq bo'lmagan kalit yasaydi.
 *
 * Tartib ataylab e'tiborga olinmaydi: `fullName` funnel'da "Ism Familya",
 * admin panelida esa ko'pincha "Familya Ism" bo'lib yoziladi, `firstName` /
 * `lastName` ustunlari esa eski yozuvlarda umuman bo'sh bo'lishi mumkin.
 * Sortlangan kalit uchala holatda ham mos tushadi.
 */
export function nameKey(parts: (string | null | undefined)[]): string {
  return parts
    .flatMap((p) => String(p ?? "").split(/\s+/))
    .map(normalizeNamePart)
    .filter(Boolean)
    .sort()
    .join("|");
}

/**
 * Bitta o'quvchi yozuvidan kalit. `firstName`/`lastName` bo'lsa shulardan,
 * aks holda `fullName` dan (bo'shliq bo'yicha bo'lakka ajratib) yasaladi.
 */
export function studentNameKey(s: {
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  // Ikkalasi ham to'lgandagina ustunlardan foydalanamiz — bittasi bo'sh bo'lsa
  // kalit bir bo'lakli chiqadi va ikki bo'lakli so'rovga hech qachon mos
  // kelmaydi. Bunday yozuvlar uchun `fullName` ancha ishonchli.
  const hasBoth = Boolean(nameKey([s.firstName]) && nameKey([s.lastName]));
  return hasBoth ? nameKey([s.firstName, s.lastName]) : nameKey([s.fullName]);
}
