-- O'quvchining oldingi maktabi.
--
-- Funnel formasida ixtiyoriy so'raladi ("Oldingi maktabingiz?"). Lead'da
-- saqlanadi va imtihon tugaganda Student'ga ko'chiriladi. Ikkalasi ham
-- nullable — mavjud yozuvlar (va maktabini yozmagan yangi leadlar) NULL
-- bo'lib qoladi, hech narsa buzilmaydi.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "previousSchool" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "previousSchool" TEXT;
