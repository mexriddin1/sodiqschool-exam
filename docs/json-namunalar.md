# Test savollari — JSON namunalar

Savollarni bittalab yozmasdan, JSON bilan joylash mumkin. Bu hujjat har bir
savol turi uchun to'liq namuna beradi.

**Kirish nuqtasi bitta: Test shablonlari → "JSON kiritish".**

Savol matni JSON bilan faqat **shablonga** kiritiladi. Shablon to'ldirilgach:

```
Yangi test → "Shablondan import" → savollar matni bilan ko'chiriladi
```

> **Ilgari boshqacha edi.** Testning o'zida ham ikkita JSON paneli bor edi
> ("JSON bilan yaratish" va "JSON bilan to'ldirish"). Ular olib tashlandi:
> bir xil savolni ikki joyda ikki xil yozish mumkin edi va qaysi biri haqiqat
> ekani noaniq bo'lardi. Endi manba bitta — shablon.

Shablon JSON'i ikki shaklda bo'ladi:

```json
{ "questions": [ … ] }
```

yoki to'g'ridan-to'g'ri massiv: `[ … ]`.

Shablon savolida `id` va `marks` **majburiy**; pedagogika maydonlari
(`topic`, `bloom`, `difficulty`, `techErrorIds`, …) va savol matni —
**ixtiyoriy**. Matn yozilmasa import bo'sh blanka beradi: ball va mavzu
baribir to'g'ri keladi, matnini admin panelda qo'lda yozasiz.

Testning o'zi (nom, fan, sinf, tillar, vaqt) endi **faqat forma orqali**
to'ldiriladi — u yerda JSON yo'q.

To'liq namuna admin panelning **Namunalar (JSON)** sahifasida:
`/docs#test-template` — u yerda "Nusxa olish" tugmasi bilan.

---

## Matn maydonlari — 3 til

Savol matni va variantlar test tanlagan tillarda bo'ladi. **Faqat tanlangan
tillar** to'ldiriladi: testda UZ+RU belgilangan bo'lsa, EN kerak emas.

```json
"prompt": { "UZ": "Poytaxt qaysi?", "RU": "Какая столица?" }
```

Matn barcha tillarda **bir xil** bo'lsa (sof matematika), `same` ishlatiladi —
bir marta yoziladi:

```json
"prompt": { "same": true, "UZ": "$x^2 + 5 = 0$ ni yeching" }
```

> **Nega bu muhim.** Formula har uchala tilda aynan bir xil. Uni uch marta
> qayta terish faqat xato manbai: RU tarjimada `$x^3$` deb yozilsa, RU
> o'quvchilar boshqa savolga javob beradi — va **baholash buni sezmaydi**,
> chunki u savol matnini umuman o'qimaydi. `same` shu xavfni yo'q qiladi.

Oddiy satr ham qabul qilinadi va "barcha tillarda shu" deb o'qiladi — eski
testlar shu tufayli buzilmaydi:

```json
"prompt": "Poytaxt qaysi?"
```

## Tillanmaydigan maydonlar

Bular **hech qachon** tarjima qilinmaydi, chunki baholash aynan shularga
tayanadi (6 turdan 5 tasi id bo'yicha solishtiradi):

`id` · `type` · `marks` · `imageUrl` · `choices[].id` ·
`correctChoiceIds` · `trueFalseItems[].correct` · `matchingPairs[].leftId` ·
`matchingPairs[].rightId` · `reorderItems[].correctIndex`

---

## 1. MULTIPLE_CHOICE — bitta to'g'ri javob

```json
{
  "id": "M1",
  "type": "MULTIPLE_CHOICE",
  "marks": 2,
  "prompt": { "UZ": "O'zbekiston poytaxti?", "RU": "Столица Узбекистана?" },
  "choices": [
    { "id": "M1-a", "label": { "UZ": "Toshkent", "RU": "Ташкент" } },
    { "id": "M1-b", "label": { "UZ": "Samarqand", "RU": "Самарканд" } },
    { "id": "M1-c", "label": { "UZ": "Buxoro", "RU": "Бухара" } },
    { "id": "M1-d", "label": { "UZ": "Xiva", "RU": "Хива" } }
  ],
  "correctChoiceIds": ["M1-a"]
}
```

`correctChoiceIds` da **aynan bitta** id bo'lishi shart.

## 2. MULTIPLE_SELECT — bir necha to'g'ri javob

```json
{
  "id": "M2",
  "type": "MULTIPLE_SELECT",
  "marks": 3,
  "prompt": { "UZ": "Qaysilari tub son?", "RU": "Какие из них простые числа?" },
  "choices": [
    { "id": "M2-a", "label": { "same": true, "UZ": "2" } },
    { "id": "M2-b", "label": { "same": true, "UZ": "4" } },
    { "id": "M2-c", "label": { "same": true, "UZ": "7" } },
    { "id": "M2-d", "label": { "same": true, "UZ": "9" } }
  ],
  "correctChoiceIds": ["M2-a", "M2-c"]
}
```

Ball faqat **hamma** to'g'ri javob belgilangandagina beriladi (qisman ball yo'q).

## 3. TRUE_FALSE — bir necha ibora

```json
{
  "id": "M3",
  "type": "TRUE_FALSE",
  "marks": 3,
  "prompt": { "UZ": "Har bir iborani baholang", "RU": "Оцените каждое утверждение" },
  "trueFalseItems": [
    { "id": "M3-1", "text": { "UZ": "Yer yumaloq", "RU": "Земля круглая" }, "correct": true },
    { "id": "M3-2", "text": { "UZ": "Suv 50°C da qaynaydi", "RU": "Вода кипит при 50°C" }, "correct": false },
    { "id": "M3-3", "text": { "UZ": "2 + 2 = 4", "RU": "2 + 2 = 4" }, "correct": true }
  ]
}
```

O'quvchi **uchala** iborani to'g'ri belgilagandagina ball oladi.

## 4. FILL_GAP — bo'sh joyni to'ldirish

Savol matnida bo'sh joy `___` bilan belgilanadi. `gapAnswers` massivining
**uzunligi = bo'shliqlar soni** va u tilga bog'liq emas — struktura umumiy,
faqat matn tillanadi.

```json
{
  "id": "M4",
  "type": "FILL_GAP",
  "marks": 2,
  "prompt": { "UZ": "Poytaxt — ___ , daryo — ___", "RU": "Столица — ___ , река — ___" },
  "gapAnswers": [
    { "UZ": "Toshkent", "RU": "Ташкент" },
    { "UZ": "Sirdaryo", "RU": "Сырдарья" }
  ]
}
```

Matematik javob uchun `same` — qayta terish shart emas:

```json
"gapAnswers": [{ "same": true, "UZ": "\\frac{1}{2}" }]
```

Solishtirish katta-kichik harf va ortiqcha bo'shliqlarga e'tibor bermaydi.

## 5. MATCHING — juftlik moslash

```json
{
  "id": "M5",
  "type": "MATCHING",
  "marks": 4,
  "prompt": { "UZ": "Mos juftlikni toping", "RU": "Найдите соответствие" },
  "matchingPairs": [
    {
      "leftId": "M5-l1", "leftText": { "UZ": "O'zbekiston", "RU": "Узбекистан" },
      "rightId": "M5-r1", "rightText": { "UZ": "Toshkent", "RU": "Ташкент" }
    },
    {
      "leftId": "M5-l2", "leftText": { "UZ": "Qozog'iston", "RU": "Казахстан" },
      "rightId": "M5-r2", "rightText": { "UZ": "Ostona", "RU": "Астана" }
    }
  ]
}
```

O'ng ustun o'quvchiga aralashtirilgan holda ko'rsatiladi.

## 6. REORDERING — tartibga qo'yish

`correctIndex` — **to'g'ri** tartib (0 dan boshlanadi). O'quvchi elementlarni
aralashtirilgan holda ko'radi.

```json
{
  "id": "M6",
  "type": "REORDERING",
  "marks": 3,
  "prompt": { "UZ": "Kichikdan kattaga tartiblang", "RU": "Расположите по возрастанию" },
  "reorderItems": [
    { "id": "M6-1", "text": { "same": true, "UZ": "3" }, "correctIndex": 0 },
    { "id": "M6-2", "text": { "same": true, "UZ": "7" }, "correctIndex": 1 },
    { "id": "M6-3", "text": { "same": true, "UZ": "12" }, "correctIndex": 2 }
  ]
}
```

---

## Ixtiyoriy maydonlar

Har bir shablon savolida **majburiy**: `id` va `marks`.

Qolganining hammasi ixtiyoriy — pedagogika maydonlari ham, savol matni ham:

| Maydon | Yozilmasa nima bo'ladi |
| --- | --- |
| `type` + `prompt` + mazmun massivi | Import **bo'sh blanka** beradi; matnni admin panelda qo'lda yozasiz (ball va mavzu baribir to'g'ri keladi) |
| `imageUrl` (savolda) | Rasm ko'rsatilmaydi |
| `imageUrl` (`choices[]` ichida) | O'sha variant faqat matn bo'ladi |
| `topic` / `strand` / `bloom` / `difficulty` / … | Hisobotdagi mavzu tahlili shu qadar kambag'al bo'ladi |
| `techErrorIds` | Texnik xato aniqlanmaydi |

> **Rasm faqat ikki joyda ishlaydi:** savolda va variantda. `trueFalseItems`,
> `matchingPairs`, `reorderItems`, `gapAnswers` da rasm
> **qo'llab-quvvatlanmaydi** — ularda faqat matn. Rasmli moslash savoli
> kerak bo'lsa, hozircha imkoni yo'q.

**Shablonda `order` yo'q** — savollar tartibi massivdagi tartib bilan
aniqlanadi. `templateQuestionId` ham yozilmaydi: shablon savolining `id` si
o'zi bog'lanish kaliti bo'ladi, testga import qilinganda avtomatik qo'yiladi.

## LaTeX

Savol matni va variantlarda formula `$...$` (satr ichida) yoki `$$...$$`
(alohida qator) bilan yoziladi:

```json
"prompt": { "same": true, "UZ": "$\\sqrt{16} + 2^3$ ni hisoblang" }
```

JSON'da teskari slash ikkilanadi: `\\frac`, `\\sqrt`.

> Noto'g'ri formula **xato bermaydi** — u imtihon o'rtasida buzuq matn bo'lib
> ko'rinadi (`throwOnError: false`). Shuning uchun formulani `same` bilan bir
> marta yozish afzal.

## To'liq namuna — shablon

Olti turning hammasi, pedagogika maydonlari bilan birga. Aynan shu namuna
admin panelda ham bor: `/docs#test-template` ("Nusxa olish" tugmasi bilan).

`M7` — ataylab matnsiz: mazmun ixtiyoriy ekanini ko'rsatadi.

```json
{
  "questions": [
    {
      "id": "M1",
      "marks": 2,
      "difficulty": "Oson",
      "strand": "Algebra",
      "topic": "Chiziqli tenglamalar",
      "bloom": "Qo'llash",
      "reasoning": "Deduktiv",
      "techErrorIds": [{ "id": "M8", "note": "Ikki noma'lumli variantini yechgan bo'lsa — texnik xato" }],
      "type": "MULTIPLE_CHOICE",
      "prompt": { "UZ": "$12 \times 8$ nechchi?", "RU": "Сколько будет $12 \times 8$?" },
      "imageUrl": null,
      "choices": [
        { "id": "M1-a", "label": { "same": true, "UZ": "96" }, "imageUrl": null },
        { "id": "M1-b", "label": { "same": true, "UZ": "86" } },
        { "id": "M1-c", "label": { "same": true, "UZ": "108" } },
        { "id": "M1-d", "label": { "same": true, "UZ": "92" } }
      ],
      "correctChoiceIds": ["M1-a"]
    },
    {
      "id": "M2",
      "marks": 3,
      "difficulty": "O'rta",
      "topic": "Tub sonlar",
      "bloom": "Tushunish",
      "techErrorIds": [],
      "type": "MULTIPLE_SELECT",
      "prompt": { "UZ": "Qaysilari tub son?", "RU": "Какие из них простые числа?" },
      "choices": [
        { "id": "M2-a", "label": { "same": true, "UZ": "2" } },
        { "id": "M2-b", "label": { "same": true, "UZ": "4" } },
        { "id": "M2-c", "label": { "same": true, "UZ": "7" } },
        { "id": "M2-d", "label": { "same": true, "UZ": "9" } }
      ],
      "correctChoiceIds": ["M2-a", "M2-c"]
    },
    {
      "id": "M3",
      "marks": 3,
      "topic": "Uchburchaklar",
      "bloom": "Eslab qolish",
      "reasoning": null,
      "techErrorIds": [],
      "type": "TRUE_FALSE",
      "prompt": { "UZ": "Har bir iborani baholang", "RU": "Оцените каждое утверждение" },
      "trueFalseItems": [
        { "id": "M3-1", "text": { "UZ": "Uchburchak burchaklari yig'indisi 180°", "RU": "Сумма углов треугольника 180°" }, "correct": true },
        { "id": "M3-2", "text": { "UZ": "Kvadratning barcha tomonlari teng emas", "RU": "Не все стороны квадрата равны" }, "correct": false },
        { "id": "M3-3", "text": { "same": true, "UZ": "$2 + 2 = 4$" }, "correct": true }
      ]
    },
    {
      "id": "M4",
      "marks": 2,
      "topic": "Poytaxtlar",
      "techErrorIds": [],
      "type": "FILL_GAP",
      "prompt": { "UZ": "Poytaxt — ___ , daryo — ___", "RU": "Столица — ___ , река — ___" },
      "gapAnswers": [
        { "UZ": "Toshkent", "RU": "Ташкент" },
        { "UZ": "Sirdaryo", "RU": "Сырдарья" }
      ]
    },
    {
      "id": "M5",
      "marks": 4,
      "difficulty": "Qiyin",
      "topic": "Davlat va poytaxt",
      "bloom": "Tahlil",
      "techErrorIds": [],
      "type": "MATCHING",
      "prompt": { "UZ": "Mos juftlikni toping", "RU": "Найдите соответствие" },
      "matchingPairs": [
        {
          "leftId": "M5-l1", "leftText": { "UZ": "O'zbekiston", "RU": "Узбекистан" },
          "rightId": "M5-r1", "rightText": { "UZ": "Toshkent", "RU": "Ташкент" }
        },
        {
          "leftId": "M5-l2", "leftText": { "UZ": "Qozog'iston", "RU": "Казахстан" },
          "rightId": "M5-r2", "rightText": { "UZ": "Ostona", "RU": "Астана" }
        }
      ]
    },
    {
      "id": "M6",
      "marks": 3,
      "topic": "Taqqoslash",
      "techErrorIds": [],
      "type": "REORDERING",
      "prompt": "Kichikdan kattaga tartiblang",
      "reorderItems": [
        { "id": "M6-1", "text": { "same": true, "UZ": "3" }, "correctIndex": 0 },
        { "id": "M6-2", "text": { "same": true, "UZ": "7" }, "correctIndex": 1 },
        { "id": "M6-3", "text": { "same": true, "UZ": "12" }, "correctIndex": 2 }
      ]
    },
    {
      "id": "M7",
      "marks": 1,
      "topic": "Qo'shish",
      "techErrorIds": []
    }
  ]
}
```

## Tekshiruv qoidalari

Shablon JSON'i uchun:

| Tekshiruv | Nima bo'ladi |
| --- | --- |
| JSON o'qib bo'lmadi | Joylash to'xtaydi (panel xatoni ko'rsatadi) |
| Massiv ham, `{ "questions": [...] }` ham emas | Joylash to'xtaydi |
| `id` yoki `marks` yo'q | Backend rad etadi (400) |
| `marks` butun son emas | Backend rad etadi |
| Noma'lum `type` | Backend rad etadi |

Testni **saqlashda** (Yangi test sahifasi):

| Tekshiruv | Nima bo'ladi |
| --- | --- |
| Savol soni shablonnikiga teng emas | Backend rad etadi (`QUESTION_COUNT_MISMATCH`) |
| Tanlangan til to'ldirilmagan | **Saqlash to'xtaydi** — o'sha tildagi o'quvchi bo'sh savol ko'rmasligi uchun |
| Savol matni bo'sh / javob kaliti yo'q | Ro'yxatda sariq "chala" belgisi bilan ko'rinadi |

> **Backend turga qarab tekshirmaydi.** Zod sxemasida har bir mazmun massivi
> `optional` va discriminated union yo'q: `matchingPairs` siz `MATCHING`
> savol, yoki `correctChoiceIds` siz `MULTIPLE_CHOICE` savol **xato
> bermaydi** — u shunchaki o'quvchida bo'sh/yechib bo'lmaydigan savol bo'lib
> chiqadi. Shuning uchun namunaga qarab yozing va admin panelda savolni
> ochib ko'ring.
