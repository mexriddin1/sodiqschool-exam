// Xom Unicode daraja (superscript) va indeks (subscript) belgilarini KaTeX
// LaTeX'iga aylantiradi. test-app'dagi nusxa bilan bir xil — sabab: ba'zi
// savollar `$x^2$` o'rniga to'g'ridan-to'g'ri `x²` belgisi bilan kiritilgan,
// bunday belgi KaTeX'dan o'tmay sahifa shriftiga tayanadi va Mac'da buziladi.

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

const SUP_RUN = /[²³¹⁰ⁱ⁴-⁹⁺-ⁿ]+/g;
const SUB_RUN = /[₀-₎]+/g;

export function latexifyUnicodeScripts(src: string): string {
  if (!src) return src;
  let s = src.replace(SUP_RUN, (m) => "$^{" + Array.from(m).map((c) => SUP[c] ?? "").join("") + "}$");
  s = s.replace(SUB_RUN, (m) => "$_{" + Array.from(m).map((c) => SUB[c] ?? "").join("") + "}$");
  return s;
}
