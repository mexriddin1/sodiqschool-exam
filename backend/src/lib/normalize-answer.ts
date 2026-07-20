// FILL_GAP javoblarini solishtirishdan oldin normallash.
//
// Baholash endi RAQAMLI ekvivalentlik QILMAYDI (5.8 = 29/5 avtomatik teng emas)
// — admin qaysi variantlar to'g'ri ekanini o'zi kiritadi. Bu bilan FORMA nazorat
// qilinadi: "kasr ko'rinishida yozing" savolida 0.5 endi avtomatik to'g'ri
// bo'lmaydi.
//
// Ammo MathLive bitta javobni har xil LaTeX variantida chiqaradi (`\frac12` va
// `\frac{1}{2}`, `x\le5` va `x \le 5`, `\leq` va `\le`). Shu TEXNIK farqlarni
// admin qayta-qayta kiritib o'tirmasligi uchun ikkala tomonni (o'quvchi + admin
// javobi) solishtirishdan oldin bir xil ko'rinishga keltiramiz.
//
// DIQQAT: bu qiymatni EMAS, YOZUVni normallaydi. `1/2` va `2/4` — har xil yozuv,
// ular teng EMAS (admin ikkalasini xohlasa alohida kiritadi).

/**
 * Solishtirish uchun kanonik shakl. Ikkala tomon shu funksiyadan o'tkaziladi.
 */
export function normalizeAnswer(input: unknown): string {
  let s = String(input ?? "").trim();
  if (!s) return "";

  // $...$ chegaralar: admin javoblari ba'zan $ ichida, MathLive esa yalang'och
  // LaTeX qaytaradi.
  s = s.replace(/\$/g, "");

  // Ko'rinishga ta'sir qilmaydigan bezaklar.
  s = s
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,;:!]/g, "") // nozik bo'shliqlar \, \; \: \!
    .replace(/\\ /g, " "); // backslash-bo'shliq

  // Sinonim buyruqlar — bir xil belgining ikki nomi.
  s = s
    .replace(/\\leq\b/g, "\\le")
    .replace(/\\geq\b/g, "\\ge")
    .replace(/\\neq\b/g, "\\ne")
    .replace(/\\dfrac\b/g, "\\frac")
    .replace(/\\tfrac\b/g, "\\frac");

  // Barcha bo'shliqlarni olib tashlaymiz: matematikada bo'shliq ahamiyatsiz
  // (`x \le 5` = `x\le5`). Ko'p so'zli oddiy matnda ham ikkala tomondan bir xil
  // olinadi, ya'ni tenglik saqlanadi.
  s = s.replace(/\s+/g, "");

  // Bitta token atrofidagi {} ni olib tashlaymiz — barqaror bo'lguncha takror:
  // `\frac{1}{2}` = `\frac1{2}` = `\frac12`. Ko'p belgili token (`\frac{12}{3}`)
  // qavsda qoladi, lekin ikkala tomon bir xil bo'lgani uchun bu muhim emas.
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\{(\\?[a-zA-Z0-9])\}/g, "$1");
  } while (s !== prev);

  // Katta-kichik harf farqsiz (oddiy matn uchun; hozirgi normalizeGap ham
  // lowercase qilardi — regressiya emas).
  return s.toLowerCase();
}
