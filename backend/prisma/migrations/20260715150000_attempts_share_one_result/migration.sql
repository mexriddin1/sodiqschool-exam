-- Bir lead uchala fanni alohida test sifatida topshiradi, lekin natija BITTA
-- bo'lishi kerak (hisobot composite ballni uchala fandan hisoblaydi va
-- publish darvozasi uchalasini talab qiladi).
--
-- Ilgari TestAttempt.resultId unique edi — ya'ni natijaga faqat bitta urinish
-- bog'lana olardi. Ikkinchi fan topshirilganda submit "Unique constraint
-- failed on the fields: (resultId)" bilan qulardi.
--
-- Endi: ko'p urinish -> bitta natija.

-- DropIndex
DROP INDEX "TestAttempt_resultId_key";

-- CreateIndex
CREATE INDEX "TestAttempt_resultId_idx" ON "TestAttempt"("resultId");
