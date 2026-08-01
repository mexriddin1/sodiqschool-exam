// Ota-ona familya + ism + sinf bilan kiradi (kirish kodi/parolsiz). Bazadagi
// ism uchta manbadan keladi — funnel formasi, admin paneli va CSV import —
// shuning uchun apostrof varianti, katta-kichik harf, ortiqcha bo'shliq va
// kirill yozuvi bir xil o'quvchiga olib chiqishi kerak. Aks holda ota-ona
// hech qachon kira olmaydi.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { nameKey, normalizeNamePart, studentNameKey } from "../src/lib/name-match.js";

test("apostrof variantlari bir xil kalitga tushadi", () => {
  const canonical = normalizeNamePart("G'ulomov");
  assert.equal(canonical, "gulomov");
  for (const variant of ["Gʻulomov", "G‘ulomov", "G’ulomov", "Gulomov", "  GULOMOV  "]) {
    assert.equal(normalizeNamePart(variant), canonical, variant);
  }
});

test("kirill yozuvi lotinga keltiriladi", () => {
  assert.equal(normalizeNamePart("Шодиев"), normalizeNamePart("Shodiev"));
  assert.equal(normalizeNamePart("ЧОРИЕВ"), normalizeNamePart("Choriev"));
  // `ў` va `й` Unicode dekompozitsiyada `у`/`и` ga tushib ketadi — translit
  // undan oldin bajarilishi kerak.
  assert.equal(normalizeNamePart("Ўринов"), normalizeNamePart("Orinov"));
  assert.equal(normalizeNamePart("Йўлдошев"), normalizeNamePart("Yoldoshev"));
});

test("kalit tartibga bog'liq emas", () => {
  // Bazada `fullName` funnel'da "Ism Familya", admin panelida ko'pincha
  // "Familya Ism" — ota-ona qaysi tartibda yozishidan qat'i nazar topilishi
  // kerak.
  assert.equal(nameKey(["Alisher", "Karimov"]), nameKey(["Karimov", "Alisher"]));
  assert.equal(nameKey(["  alisher ", "KARIMOV"]), nameKey(["Karimov", "Alisher"]));
});

test("ikki so'zli ismlar ham mos tushadi", () => {
  // Sortlash TOKEN darajasida bo'lishi kerak, bo'lak darajasida emas.
  assert.equal(
    nameKey(["Ali Asqar", "Zaripov"]),
    nameKey(["Zaripov", "Asqar Ali"]),
  );
});

test("har xil odamlar aralashib ketmaydi", () => {
  assert.notEqual(nameKey(["Alisher", "Karimov"]), nameKey(["Alisher", "Karimova"]));
  assert.notEqual(nameKey(["Alisher", "Karimov"]), nameKey(["Alischer", "Karimov"]));
});

test("studentNameKey: firstName/lastName ustunlari", () => {
  const key = nameKey(["Alisher", "Karimov"]);
  assert.equal(
    studentNameKey({ fullName: "Alisher Karimov", firstName: "Alisher", lastName: "Karimov" }),
    key,
  );
});

test("studentNameKey: ustunlar bo'sh bo'lsa fullName ishlatiladi", () => {
  const key = nameKey(["Alisher", "Karimov"]);
  // Eski/import qilingan yozuvlarda firstName yoki lastName null bo'lishi
  // mumkin — bunda bir bo'lakli kalit chiqib, hech qachon mos kelmas edi.
  assert.equal(studentNameKey({ fullName: "Karimov Alisher", firstName: null, lastName: null }), key);
  assert.equal(studentNameKey({ fullName: "Alisher Karimov", firstName: "Alisher", lastName: null }), key);
  assert.equal(studentNameKey({ fullName: "Karimov Alisher", firstName: null, lastName: "Karimov" }), key);
});

test("bo'sh qiymatlar kalitni buzmaydi", () => {
  assert.equal(nameKey([null, undefined, "  "]), "");
  assert.equal(normalizeNamePart(null), "");
});
