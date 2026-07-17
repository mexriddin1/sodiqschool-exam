// Matematik javoblarni RAQAMLI qiymati bo'yicha solishtirish.
//
// FILL_GAP baholashi ilgari sof satr tengligi edi: admin "5.8" yozsa, o'quvchi
// "29/5" (yoki MathLive'ning `\frac{29}{5}` LaTeX'i) yozsa — noto'g'ri deb
// baholanardi, garchi qiymat bir xil bo'lsa ham. Endi ikkala tomonni ratsional
// songa aylantirib solishtiramiz. Raqamli bo'lmagan javob (masalan so'z) esa
// eski aniq-satr solishtiruviga tushadi (test-grading.ts).
//
// Qamrov ATAYLAB ratsional sonlar bilan chegaralangan: butun, o'nlik, oddiy
// kasr, aralash kasr — foydalanuvchi so'ragan hamma shakl (5.8, 29/5, 58/10,
// 5 8/10, 5 4/5). Ildiz, o'zgaruvchi, ifoda — bular parse bo'lmaydi va satr
// solishtiruviga tushadi (xato javobni to'g'ri deb hisoblab yubormaslik uchun).

export interface Rational {
  /** Numerator (ishorani o'zida saqlaydi). */
  n: bigint;
  /** Denominator — doim musbat. */
  d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function makeRational(n: bigint, d: bigint): Rational | null {
  if (d === 0n) return null;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}

/**
 * Matn (oddiy yoki MathLive LaTeX) ni ratsional songa aylantiradi.
 * Aylantirib bo'lmasa (raqam emas) `null` qaytaradi.
 */
export function parseRational(input: unknown): Rational | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;

  // LaTeX bezaklarini tozalaymiz.
  s = s
    .replace(/\$/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,;:!]/g, "") // nozik bo'shliqlar \, \; \: \!
    .replace(/\\ /g, " ") // backslash-bo'shliq
    .replace(/\\dfrac|\\tfrac/g, "\\frac")
    .replace(/[{}]/g, (m) => m); // qavslar \frac uchun kerak, tegilmaydi

  // \frac{a}{b} va bir xonali \frac ab ni " a/b" ga aylantiramiz. Oldiga
  // BO'SHLIQ qo'yamiz: "5\frac{2}{3}" -> "5 2/3" (aralash son), yopishib
  // "52/3" bo'lib qolmasin.
  s = s.replace(/\\frac\s*\{\s*(-?\d+)\s*\}\s*\{\s*(-?\d+)\s*\}/g, " $1/$2");
  s = s.replace(/\\frac\s*(-?\d)\s*(-?\d)/g, " $1/$2");

  // Ishora bilan bo'shliqni yopishtiramiz: "- 1/2" -> "-1/2".
  s = s.replace(/([+-])\s+/g, "$1").trim().replace(/\s+/g, " ");

  // Aralash kasr: "5 8/10", "-5 8/10".
  let m = s.match(/^([+-]?)(\d+)\s+(\d+)\/(\d+)$/);
  if (m) {
    const sign = m[1] === "-" ? -1n : 1n;
    const whole = BigInt(m[2]!);
    const a = BigInt(m[3]!);
    const b = BigInt(m[4]!);
    return makeRational(sign * (whole * b + a), b);
  }

  // Oddiy kasr: "29/5", "-1/2".
  m = s.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (m) {
    return makeRational(BigInt(m[1]!), BigInt(m[2]!));
  }

  // O'nlik yoki butun: "5.8", "-0.25", ".5", "12".
  m = s.match(/^([+-]?)(\d*)(?:\.(\d+))?$/);
  if (m && (m[2] || m[3])) {
    const sign = m[1] === "-" ? -1n : 1n;
    const intPart = m[2] || "0";
    const fracPart = m[3] || "";
    const den = 10n ** BigInt(fracPart.length);
    const num = BigInt(intPart + fracPart);
    return makeRational(sign * num, den);
  }

  return null;
}

/** Ikki ratsional teng qiymatlimi (ko'ndalang ko'paytma). */
export function rationalsEqual(a: Rational, b: Rational): boolean {
  return a.n * b.d === b.n * a.d;
}

/**
 * Ikki javob RAQAMLI jihatdan tengmi. Ikkalasi ham ratsionalga aylansa —
 * qiymatlarni solishtiramiz. Aks holda `null` (chaqiruvchi satr solishtiruviga
 * tushadi).
 */
export function numericallyEqual(given: string, expected: string): boolean | null {
  const g = parseRational(given);
  const e = parseRational(expected);
  if (!g || !e) return null;
  return rationalsEqual(g, e);
}
