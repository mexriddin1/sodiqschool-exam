# Yangilanishlar — 2026-07-15

Sodiq School qabul tizimi uchun. Bu hujjat maktab xodimlari uchun: nima
o'zgardi, nima qilish kerak, nimaga hali ishonmaslik kerak.

---

## 1. Yangi sayt: onlayn qabul testi

**https://test.sodiqschool.uz** — ishga tushdi.

Nomzod bu yerda ma'lumotlarini qoldiradi va testlarni to'g'ridan-to'g'ri
brauzerda topshiradi. Sayt **planshet** uchun mo'ljallangan.

**Qanday ishlaydi:**

1. Nomzod formani to'ldiradi (ism, familya, jins, telefon, sinf, til).
2. Sinfi va tiliga mos testlar ochiladi.
3. Testlarni **qat'iy tartibda** topshiradi: matematika → ingliz tili →
   tanqidiy fikrlash. Tartibni o'zi tanlay olmaydi — navbatdagisi ochiq,
   qolganlari qulflangan turadi.
4. Har test tugagach, keyingisi darhol taklif qilinadi.
5. Uchala test topshirilgach, natija bitta hisobot bo'lib yig'iladi va
   **Natijalar** bo'limida nashr etishga tayyor bo'ladi.

**Interfeys tili** nomzod tanlagan imtihon tiliga qarab o'zgaradi — o'zbek,
rus yoki ingliz. Ilgari savollar ruscha, tugmalar o'zbekcha chiqardi.

**Savol turlari** — oltita: bitta javobli, ko'p javobli, to'g'ri/noto'g'ri,
bo'sh joyni to'ldirish, juftlik moslash, tartibga qo'yish. Tartiblashda
qatorni barmoq bilan suriladi; moslashda chapdan o'ngga chiziq tortiladi.

---

## 2. SIZDAN NIMA TALAB QILINADI

**Saytda hozircha test yo'q.** Bu ataylab: demo savollar yuklanmadi, testlarni
o'zingiz kiritasiz.

Test qo'shish: **admin panel → Testlar → paket → Yangi test**.

- Testni qo'lda to'ldirish mumkin, yoki **"JSON bilan yaratish"** tugmasi
  orqali butun testni bitta JSON bilan joylash mumkin. Namunalar admin
  paneldagi **Namunalar (JSON)** sahifasida.
- Har bir test o'z **shabloniga** bog'lanadi (imtihon + fan + sinf bo'yicha
  avtomatik topiladi). Testdagi savollar soni shablonnikiga teng bo'lishi
  shart.
- **Rasm qo'shish:** savol tahrirlashda "Rasm qo'shish" tugmasi. Rasm 200KB
  dan kichik bo'lsin.
- Nomzod uchala fanni ham topshirishi kerak — aks holda hisobot chiqmaydi
  (pastga qarang).

---

## 3. Tuzatilgan xatolar

**Onlayn test natijasi endi hisobotga aylanadi.** Ilgari har topshirilgan test
alohida, chala natija yaratardi: uni nashr etib ham bo'lmasdi, ochilganda esa
sayt xato berardi. Endi uchala fan bitta natijaga yig'iladi.

**Chala natija endi xato bermaydi.** Nomzod faqat bir-ikki fanni topshirgan
bo'lsa va hisobotni ochsa — "Hisobot hali tayyor emas, 1/3 fan yakunlangan"
degan tushunarli sahifa chiqadi.

> Mavjud 343 ta natijaning **hammasi to'liq** (3 fandan), ya'ni bu o'zgarish
> hozirgi o'quvchilarga ta'sir qilmaydi.

**Testlar tartibi to'g'rilandi.** Ilgari ro'yxat alifbo bo'yicha kelib,
tanqidiy fikrlash birinchi turardi.

---

## 4. Bilib qo'yish kerak

**Tartib faqat saytda ishlaydi.** Texnik bilimga ega odam so'rovni to'g'ridan-
to'g'ri yuborib, istalgan testni boshlashi mumkin. Bu ataylab shunday: bu
tizim lead yig'ish uchun, nazorat ostidagi imtihon emas. Agar test natijasi
qabulga real ta'sir qiladigan bo'lsa — buni qaytadan ko'rib chiqish kerak.

**Test sahifasidagi "Chiqishga urunish tizim tomonidan qayd qilinadi" degan
yozuv — haqiqatga to'g'ri kelmaydi.** Hech narsa qayd qilinmaydi. Uni olib
tashlash yoki haqiqatan qayd qilishni qo'shish kerak.

**Havola shaxsiy.** `test.sodiqschool.uz/tests?lead=...` havolasiga ega
istalgan odam nomzod ismini ko'radi va uning nomidan test boshlay oladi.
Havolani boshqalarga bermang.

---

## 5. HAL QILINMAGAN — testlarni kiritishdan oldin o'qing

**Hisobotdagi mavzu yorliqlari savolga mos kelmasligi mumkin.**

Hisobotdagi "mavzu / ko'nikma / Bloom darajasi" ustunlari **shablondan**
olinadi va savolga **tartib raqami** bo'yicha bog'lanadi. Ya'ni testning
3-savoli doim shablonning 3-qatoridagi mavzuni oladi — siz u yerga nima
yozganingizdan qat'i nazar.

Amalda bu degani: agar testdagi savollar tartibi shablondagi tartibga mos
kelmasa, hisobot **noto'g'ri mavzuni** ko'rsatadi va bu hech qayerda
sezilmaydi.

**Hozircha nima qilish kerak:** test savollarini shablondagi savollar bilan
**bir xil tartibda** kiriting. 3-savol shablonning 3-qatoriga mos kelsin.

Bu to'liq tuzatilishi kerak (har savolga shablon savolining aniq havolasi
qo'yiladi va admin panelda qaysi mavzuga tegishli ekani ko'rinib turadi) —
lekin hali qilinmadi.

---

## 6. Texnik ma'lumot

| | |
| --- | --- |
| Yangi sayt | https://test.sodiqschool.uz (ichki port 3020, pm2: `sodiq-test-app`) |
| Sertifikat | Let's Encrypt, 2026-10-13 gacha, avtomatik yangilanadi |
| Baza zaxirasi | `/root/backups/sodiq_exam_2026-07-15_2104.sql` (57MB) |
| Qaytish nuqtasi | commit `469316d` — `/root/deploy-rollback.txt` |
| Deploy yo'riqnomasi | `docs/deploy-test-app.md` |

Bazaga bitta o'zgarish kiritildi (bir nomzodning uchala urinishi bitta
natijaga bog'lanishi uchun). Boshqa ma'lumot o'zgarmadi.

Admin, natijalar sayti va API ham shu bilan birga yangilandi — ular yangi
kodda ishlayapti va tekshirildi.
