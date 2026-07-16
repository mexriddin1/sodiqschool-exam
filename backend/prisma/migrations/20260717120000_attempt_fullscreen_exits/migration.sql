-- O'quvchi test davomida to'liq ekrandan necha marta chiqqani.
--
-- Ilgari bu hech qayerda saqlanmasdi: test-app faqat `fs` degan React state
-- ushlab turardi va u sahifa yangilanishi bilan yo'qolardi. Shu bilan birga
-- test qoidalarida "chiqishga urinish tizim tomonidan qayd qilinadi" deb
-- yozib qo'yilgan edi — ya'ni va'da bor, yozuv yo'q edi. Endi yozuv bor.
--
-- Faqat KUZATUV uchun: baholashga ta'sir qilmaydi, hech narsani to'xtatmaydi.
-- Default 0 — mavjud urinishlar "hech qachon chiqmagan" bo'lib qoladi, bu
-- to'g'ri, chunki ular haqida ma'lumot umuman yig'ilmagan.

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN "fullscreenExits" INTEGER NOT NULL DEFAULT 0;
