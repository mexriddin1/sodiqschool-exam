-- "Rivojlanish yo'li" (roadmap) sekiyasi uchun 20 daqiqalik ochilish oynasi.
--
-- Roadmap endi DOIMIY ochiq emas: natija publish bo'lganda yoki admin "ochish"
-- tugmasini bosganda shu ustunga hozirgi vaqt yoziladi, va sekiya faqat 20
-- daqiqa ochiq turadi (public.result.ts dagi roadmapOpen hisoblaydi). O'sish
-- ko'rsatkichi sekiyasi bundan mustaqil — u doim ochiq.
--
-- Nullable, defaultsiz — mavjud natijalarda NULL bo'ladi (roadmap yopiq).

-- AlterTable
ALTER TABLE "Result" ADD COLUMN "roadmapOpenedAt" TIMESTAMP(3);
