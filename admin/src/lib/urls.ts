// Ota-onaga ko'rinadigan hisobot sayti (client, Astro — natija.sodiqschool.uz).
//
// Nega alohida modul: ilgari bu manzil ikki joyda alohida yozilgan edi va ikki
// xil fallback bilan — biri "https://natija.sodiqschool.uz", ikkinchisi
// "http://localhost:4321". NEXT_PUBLIC_CLIENT_URL hech qaysi .env da
// belgilanmagani uchun prod'da ikkalasi ham fallback'ga tushardi: ota-onaga
// yuboriladigan xabar to'g'ri chiqar, "Hisobotni ko'rish" esa localhost'ga
// olib borardi. Bitta manba — ikkiga bo'linib ketolmaydi.
//
// DIQQAT: NEXT_PUBLIC_* build vaqtida kodga yoziladi. Prod'da .env ni
// o'zgartirish yetmaydi — admin qayta build qilinishi shart.
export const CLIENT_BASE_URL =
  process.env.NEXT_PUBLIC_CLIENT_URL ?? "https://natija.sodiqschool.uz";
