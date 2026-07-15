# Test savollari — JSON namunalar

Admin panelda savollarni bittalab yozmasdan joylash mumkin. Bu hujjat har bir
savol turi uchun to'liq namuna beradi.

Ikkita kirish nuqtasi bor, ikkalasi ham quyidagi savol formatidan foydalanadi:

| Qayerda | Nima qiladi |
| --- | --- |
| **Yangi test → "JSON bilan yaratish"** | Butun testni to'ldiradi: nom, fan, sinf, tillar, vaqt **va** savollar |
| **Savollar → "JSON bilan to'ldirish"** | Faqat savollarni almashtiradi (nom/fan/sinf allaqachon tanlangan) |

Faqat savollar uchun JSON ikki shaklda bo'ladi:

```json
{ "questions": [ … ] }
```

yoki to'g'ridan-to'g'ri massiv: `[ … ]`.

## Butun test — o'ram

"JSON bilan yaratish" savollarni test metadatasi bilan birga qabul qiladi:

```json
{
  "name": "5-sinf matematika (QABUL 2026)",
  "subject": "MATH",
  "grade": 5,
  "languages": ["UZ", "RU"],
  "durationMin": 30,
  "questions": [ … ]
}
```

- `subject` — `MATH` | `ENGLISH` | `CRITICAL_THINKING`; `grade` — 5–11.
- `languages` — testda mazmuni bor tillar. Til tanlansa, o'sha tildagi matn
  ham to'ldirilishi **shart**.
- `durationMin` — daqiqada, ixtiyoriy. Yo'q/`null` bo'lsa vaqt cheklanmaydi.
- Imtihon URL'dan (`?examId=`), shablon esa imtihon + `subject` + `grade`
  bo'yicha **avtomatik** topiladi — `templateId` yozilmaydi.

Qo'llagach forma to'ladi; saqlashdan oldin ko'rib chiqasiz. To'liq namuna
admin panelning **Namunalar (JSON)** sahifasida: `/docs#test-create`.

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

`id` · `order` · `type` · `marks` · `imageUrl` · `choices[].id` ·
`correctChoiceIds` · `trueFalseItems[].correct` · `matchingPairs[].leftId` ·
`matchingPairs[].rightId` · `reorderItems[].correctIndex`

---

## 1. MULTIPLE_CHOICE — bitta to'g'ri javob

```json
{
  "id": "q1",
  "order": 0,
  "type": "MULTIPLE_CHOICE",
  "marks": 2,
  "prompt": { "UZ": "O'zbekiston poytaxti?", "RU": "Столица Узбекистана?" },
  "choices": [
    { "id": "q1-a", "label": { "UZ": "Toshkent", "RU": "Ташкент" } },
    { "id": "q1-b", "label": { "UZ": "Samarqand", "RU": "Самарканд" } },
    { "id": "q1-c", "label": { "UZ": "Buxoro", "RU": "Бухара" } },
    { "id": "q1-d", "label": { "UZ": "Xiva", "RU": "Хива" } }
  ],
  "correctChoiceIds": ["q1-a"]
}
```

`correctChoiceIds` da **aynan bitta** id bo'lishi shart.

## 2. MULTIPLE_SELECT — bir necha to'g'ri javob

```json
{
  "id": "q2",
  "order": 1,
  "type": "MULTIPLE_SELECT",
  "marks": 3,
  "prompt": { "UZ": "Qaysilari tub son?", "RU": "Какие из них простые числа?" },
  "choices": [
    { "id": "q2-a", "label": { "same": true, "UZ": "2" } },
    { "id": "q2-b", "label": { "same": true, "UZ": "4" } },
    { "id": "q2-c", "label": { "same": true, "UZ": "7" } },
    { "id": "q2-d", "label": { "same": true, "UZ": "9" } }
  ],
  "correctChoiceIds": ["q2-a", "q2-c"]
}
```

Ball faqat **hamma** to'g'ri javob belgilangandagina beriladi (qisman ball yo'q).

## 3. TRUE_FALSE — bir necha ibora

```json
{
  "id": "q3",
  "order": 2,
  "type": "TRUE_FALSE",
  "marks": 3,
  "prompt": { "UZ": "Har bir iborani baholang", "RU": "Оцените каждое утверждение" },
  "trueFalseItems": [
    { "id": "q3-1", "text": { "UZ": "Yer yumaloq", "RU": "Земля круглая" }, "correct": true },
    { "id": "q3-2", "text": { "UZ": "Suv 50°C da qaynaydi", "RU": "Вода кипит при 50°C" }, "correct": false },
    { "id": "q3-3", "text": { "UZ": "2 + 2 = 4", "RU": "2 + 2 = 4" }, "correct": true }
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
  "id": "q4",
  "order": 3,
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
  "id": "q5",
  "order": 4,
  "type": "MATCHING",
  "marks": 4,
  "prompt": { "UZ": "Mos juftlikni toping", "RU": "Найдите соответствие" },
  "matchingPairs": [
    {
      "leftId": "q5-l1", "leftText": { "UZ": "O'zbekiston", "RU": "Узбекистан" },
      "rightId": "q5-r1", "rightText": { "UZ": "Toshkent", "RU": "Ташкент" }
    },
    {
      "leftId": "q5-l2", "leftText": { "UZ": "Qozog'iston", "RU": "Казахстан" },
      "rightId": "q5-r2", "rightText": { "UZ": "Ostona", "RU": "Астана" }
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
  "id": "q6",
  "order": 5,
  "type": "REORDERING",
  "marks": 3,
  "prompt": { "UZ": "Kichikdan kattaga tartiblang", "RU": "Расположите по возрастанию" },
  "reorderItems": [
    { "id": "q6-1", "text": { "same": true, "UZ": "3" }, "correctIndex": 0 },
    { "id": "q6-2", "text": { "same": true, "UZ": "7" }, "correctIndex": 1 },
    { "id": "q6-3", "text": { "same": true, "UZ": "12" }, "correctIndex": 2 }
  ]
}
```

---

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

## To'liq namuna

```json
{
  "questions": [
    {
      "id": "q1",
      "order": 0,
      "type": "MULTIPLE_CHOICE",
      "marks": 2,
      "prompt": { "UZ": "$12 \\times 8$ nechchi?", "RU": "Сколько будет $12 \\times 8$?" },
      "imageUrl": null,
      "choices": [
        { "id": "q1-a", "label": { "same": true, "UZ": "96" } },
        { "id": "q1-b", "label": { "same": true, "UZ": "86" } },
        { "id": "q1-c", "label": { "same": true, "UZ": "108" } },
        { "id": "q1-d", "label": { "same": true, "UZ": "92" } }
      ],
      "correctChoiceIds": ["q1-a"]
    },
    {
      "id": "q2",
      "order": 1,
      "type": "FILL_GAP",
      "marks": 1,
      "prompt": { "UZ": "$5 + 7 =$ ___", "RU": "$5 + 7 =$ ___" },
      "gapAnswers": [{ "same": true, "UZ": "12" }]
    }
  ]
}
```

## Tekshiruv qoidalari

JSON panel joylashdan **oldin** tekshiradi va ogohlantiradi:

| Tekshiruv | Nima bo'ladi |
| --- | --- |
| JSON o'qib bo'lmadi | Joylash to'xtaydi |
| Savol soni shablonnikiga teng emas | Joylash to'xtaydi |
| Savol matni bo'sh | Ogohlantirish — joylanadi, ro'yxatda sariq belgi |
| `correctChoiceIds` yo'q / mavjud bo'lmagan id | Ogohlantirish |
| Tanlangan til to'ldirilmagan | Ogohlantirish; **saqlashda to'xtatadi** |
| Takrorlangan `id` | Ogohlantirish |

Savol soni shablonnikiga teng bo'lishi shart — backend ham buni tekshiradi
(`QUESTION_COUNT_MISMATCH`).
