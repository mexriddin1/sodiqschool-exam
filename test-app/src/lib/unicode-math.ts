// Xom Unicode daraja (superscript) va indeks (subscript) belgilarini KaTeX
// LaTeX'iga aylantiradi.
//
// Muammo: ba'zi savollar `$x^2$` LaTeX o'rniga to'g'ridan-to'g'ri `x²` (U+00B2)
// belgisi bilan kiritilgan. Bunday belgi KaTeX'dan o'tmaydi — u sahifa
// shriftiga tayanadi. Bizning display shriftimizda (Pragmatica) bu glif yo'q,
// shuning uchun brauzer fallback qiladi: Windows'da to'g'ri (Segoe UI), Mac'da
// esa noto'g'ri o'lcham/joylashuvda chiqadi. Ularni `$^{..}$` / `$_{..}$` ga
// aylantirsak — KaTeX render qiladi va hamma OS'da bir xil ko'rinadi.

const SUP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")",
  "ⁿ": "n", "ⁱ": "i",
};

const SUB: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")",
};

// Ketma-ket kelgan belgilar bitta darajaga birlashadi: `x¹²` -> `x$^{12}$`.
const SUP_RUN = /[²³¹⁰ⁱ⁴-⁹⁺-ⁿ]+/g;
const SUB_RUN = /[₀-₎]+/g;

export function latexifyUnicodeScripts(src: string): string {
  if (!src) return src;
  let s = src.replace(SUP_RUN, (m) => "$^{" + Array.from(m).map((c) => SUP[c] ?? "").join("") + "}$");
  s = s.replace(SUB_RUN, (m) => "$_{" + Array.from(m).map((c) => SUB[c] ?? "").join("") + "}$");
  return s;
}
