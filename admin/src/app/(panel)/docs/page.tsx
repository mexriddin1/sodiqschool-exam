"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

// Reference examples for every JSON entry point in the admin. Kept in one
// place so admins can copy a working template, and so we never have to embed
// long name-shaped placeholders in the actual forms.

const STUDENT_IMPORT_JSON = {
  students: [
    {
      firstName: "Alisher",
      lastName: "Karimov",
      uid: "SS-2026-0001",
      sex: "MALE",
      grade: 10,
      examLanguage: "UZ",
    },
    {
      firstName: "Nozima",
      lastName: "Yusupova",
      uid: "SS-2026-0002",
      sex: "FEMALE",
      grade: 5,
      examLanguage: "RU",
    },
    {
      firstName: "Javohir",
      lastName: "Rashidov",
      uid: "SS-2026-0003",
      sex: "MALE",
      grade: 7,
      examLanguage: "UZ",
    },
  ],
};

// Test shabloni — savollarning pedagogik strukturasi VA (endi) matni.
//
// Savol matni JSON bilan faqat SHU YERGA kiritiladi. Ilgari testning o'zi
// uchun ham alohida JSON paneli bor edi; u olib tashlandi, chunki ikki joyda
// bir xil savolni ikki xil yozish mumkin edi va qaysi biri haqiqat ekani
// noaniq bo'lardi. Endi yo'l bitta: shablon -> "Yangi test -> Shablondan
// import".
//
// Har olti savol turi bittadan ko'rsatilgan (M1..M6), M7 esa matnsiz —
// mazmun IXTIYORIY ekanini ko'rsatadi.
const TEST_TEMPLATE_JSON = {
  questions: [
    // 1) MULTIPLE_CHOICE — bitta to'g'ri javob.
    {
      id: "M1",
      marks: 2,
      difficulty: "Oson",
      strand: "Algebra",
      topic: "Chiziqli tenglamalar",
      subTopic: "Bir noma'lumli tenglamalar",
      skill: "Tenglamani yechish",
      bloom: "Qo'llash",
      reasoning: "Deduktiv",
      gradeLevel: "5-sinf",
      framework: "IB PYP",
      techErrorIds: [
        { id: "M8", note: "Xuddi shu ko'nikma, lekin ikki noma'lumli — yechgan bo'lsa M1 texnik xato" },
        { id: "M12", note: "" },
      ],
      type: "MULTIPLE_CHOICE",
      prompt: { UZ: "$12 \times 8$ nechchi?", RU: "Сколько будет $12 \times 8$?" },
      imageUrl: null,
      choices: [
        { id: "M1-a", label: { same: true, UZ: "96" }, imageUrl: null },
        { id: "M1-b", label: { same: true, UZ: "86" } },
        { id: "M1-c", label: { same: true, UZ: "108" } },
        { id: "M1-d", label: { same: true, UZ: "92" } },
      ],
      correctChoiceIds: ["M1-a"],
    },
    // 2) MULTIPLE_SELECT — bir necha to'g'ri javob. Faqat HAMMASI belgilansa ball.
    {
      id: "M2",
      marks: 3,
      difficulty: "O'rta",
      strand: "Sonlar",
      topic: "Tub sonlar",
      bloom: "Tushunish",
      reasoning: "Analitik",
      techErrorIds: [],
      type: "MULTIPLE_SELECT",
      prompt: { UZ: "Qaysilari tub son?", RU: "Какие из них простые числа?" },
      choices: [
        { id: "M2-a", label: { same: true, UZ: "2" } },
        { id: "M2-b", label: { same: true, UZ: "4" } },
        { id: "M2-c", label: { same: true, UZ: "7" } },
        { id: "M2-d", label: { same: true, UZ: "9" } },
      ],
      correctChoiceIds: ["M2-a", "M2-c"],
    },
    // 3) TRUE_FALSE — har bir iboraga rost/yolg'on.
    {
      id: "M3",
      marks: 3,
      difficulty: "Oson",
      strand: "Geometriya",
      topic: "Uchburchaklar",
      bloom: "Eslab qolish",
      reasoning: null,
      techErrorIds: [],
      type: "TRUE_FALSE",
      prompt: { UZ: "Har bir iborani baholang", RU: "Оцените каждое утверждение" },
      trueFalseItems: [
        { id: "M3-1", text: { UZ: "Uchburchak burchaklari yig'indisi 180°", RU: "Сумма углов треугольника 180°" }, correct: true },
        { id: "M3-2", text: { UZ: "Kvadratning barcha tomonlari teng emas", RU: "Не все стороны квадрата равны" }, correct: false },
        { id: "M3-3", text: { same: true, UZ: "$2 + 2 = 4$" }, correct: true },
      ],
    },
    // 4) FILL_GAP — matndagi har bir ___ uchun bitta javob, o'sha tartibda.
    {
      id: "M4",
      marks: 2,
      difficulty: "O'rta",
      strand: "Geografiya",
      topic: "Poytaxtlar",
      bloom: "Eslab qolish",
      techErrorIds: [],
      type: "FILL_GAP",
      prompt: { UZ: "Poytaxt — ___ , daryo — ___", RU: "Столица — ___ , река — ___" },
      gapAnswers: [
        { UZ: "Toshkent", RU: "Ташкент" },
        { UZ: "Sirdaryo", RU: "Сырдарья" },
      ],
    },
    // 5) MATCHING — juftlik. O'ng ustun o'quvchiga aralashtirib ko'rsatiladi.
    {
      id: "M5",
      marks: 4,
      difficulty: "Qiyin",
      strand: "Geografiya",
      topic: "Davlat va poytaxt",
      bloom: "Tahlil",
      techErrorIds: [],
      type: "MATCHING",
      prompt: { UZ: "Mos juftlikni toping", RU: "Найдите соответствие" },
      matchingPairs: [
        {
          leftId: "M5-l1",
          leftText: { UZ: "O'zbekiston", RU: "Узбекистан" },
          rightId: "M5-r1",
          rightText: { UZ: "Toshkent", RU: "Ташкент" },
        },
        {
          leftId: "M5-l2",
          leftText: { UZ: "Qozog'iston", RU: "Казахстан" },
          rightId: "M5-r2",
          rightText: { UZ: "Ostona", RU: "Астана" },
        },
      ],
    },
    // 6) REORDERING — correctIndex to'g'ri tartibni beradi (0 dan).
    // prompt bu yerda ATAYLAB oddiy satr: eski format ham qabul qilinadi va
    // "barcha tillarda shu" deb o'qiladi.
    {
      id: "M6",
      marks: 3,
      difficulty: "O'rta",
      strand: "Sonlar",
      topic: "Taqqoslash",
      bloom: "Qo'llash",
      techErrorIds: [],
      type: "REORDERING",
      prompt: "Kichikdan kattaga tartiblang",
      reorderItems: [
        { id: "M6-1", text: { same: true, UZ: "3" }, correctIndex: 0 },
        { id: "M6-2", text: { same: true, UZ: "7" }, correctIndex: 1 },
        { id: "M6-3", text: { same: true, UZ: "12" }, correctIndex: 2 },
      ],
    },
    // 7) Matnsiz — mazmun maydonlari IXTIYORIY. Bunday savol import qilinganda
    // bo'sh blanka bo'lib tushadi (ball va mavzu baribir to'g'ri keladi),
    // matnini admin panelda qo'lda yozasiz.
    {
      id: "M7",
      marks: 1,
      difficulty: "Oson",
      strand: "Algebra",
      topic: "Qo'shish",
      bloom: "Eslab qolish",
      techErrorIds: [],
    },
  ],
};

const RESULT_QUESTION_OUTCOME_JSON = {
  questions: [
    {
      id: "M1",
      result: "To'g'ri",
      earned: 1,
      evidence: "Yechim to'g'ri, ish qadamlari toza",
    },
    {
      id: "M2",
      result: "Noto'g'ri",
      earned: 0,
      evidence: "Pifagor formulasi noto'g'ri qo'llangan",
      peerSolveRate: 42,
    },
    {
      id: "M3",
      result: "Qisman",
      earned: 1,
      evidence: "Sonlar to'g'ri hisoblangan, oxirgi qadamda kichik xatolik",
    },
  ],
};

const SUBJECT_JSON = {
  key: "PHYSICS",
  name: "Fizika",
  order: 3,
};

// Sample JSON payload for the bulk import endpoint. Two students shown: one
// who attended (Alisher — mixed 0/1 answers), one who didn't show up (Nozima
// — all zeros). Answer arrays are fixed length: math=25, ct=10, eng=50. The
// import UI auto-detects JSON vs CSV based on the leading character.
const RESULTS_JSON_SAMPLE = {
  students: [
    {
      tr: 1,
      uid: "2605086",
      firstName: "Alisher",
      lastName: "Karimov",
      sex: "MALE",
      grade: 5,
      examLanguage: "RU",
      math: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ct:   [0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
      eng:  [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
    },
    {
      tr: 2,
      uid: "2605084",
      firstName: "Nozima",
      lastName: "Yusupova",
      sex: "FEMALE",
      grade: 5,
      examLanguage: null,
      math: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ct:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      eng:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ],
};

const EXAM_JSON = {
  title: "Sodiq School — 2026 kirish diagnostikasi",
  description: "5-11 sinflar uchun umumiy diagnostika",
  examDate: "2026-08-15T09:00:00.000Z",
  academicYear: "2026-2027",
  status: "ACTIVE",
  grades: [5, 6, 7, 8, 9, 10, 11],
  subjectKeys: ["MATH", "ENGLISH", "CRITICAL_THINKING"],
  admissionThresholds: {
    "5": { math: 60, ct: 55, en: 50 },
    "10": { math: 70, ct: 65, en: 60 },
  },
  gradingConfiguration: {
    weights: { math: 0.4, english: 0.3, criticalThinking: 0.3 },
  },
  cohortSize: 250,
};

interface Section {
  key: string;
  title: string;
  intro: string;
  endpoint?: string;
  data: unknown;
  notes?: string[];
}

const SECTIONS: Section[] = [
  {
    key: "students-import",
    title: "O'quvchilarni bulk import qilish",
    intro:
      "O'quvchilar sahifasida \"JSON import\" tugmasi bosilganda shu shakldagi JSON qabul qilinadi. Bir vaqtda 2000 tagacha yozuv yuborish mumkin. UID takrorlangan yozuvlar o'tkazib yuboriladi.",
    endpoint: "POST /api/admin/students/import",
    data: STUDENT_IMPORT_JSON,
    notes: [
      "firstName va lastName majburiy — fullName avtomatik yaratiladi.",
      "sex: \"MALE\" | \"FEMALE\" yoki tashlab yuborilishi mumkin.",
      "examLanguage: \"UZ\" / \"RU\" / \"EN\".",
      "grade: 5 dan 11 gacha butun son.",
      "uid noyob — takror uchraganda o'sha yozuv o'tkazib yuboriladi (created hisobiga tushmaydi).",
    ],
  },
  {
    key: "test-template",
    title: "Test shabloni (struktura) — savol jadvali",
    intro:
      "Test shablonlari sahifasidagi \"JSON kiritish\" oynasi shu formatni qabul qiladi. Bu savollarning pedagogik strukturasi (ball, mavzu, qiyinlik, Bloom, ...) VA savol matni. Savol matnini JSON bilan kiritishning YAGONA joyi shu — testning o'zida JSON paneli yo'q. Shablon to'ldirilgach: Yangi test → \"Shablondan import\" savollarni matni bilan ko'chiradi. Bola qanday yechganini bu yerga yozmaymiz — u natija import qilinadigan JSON'da.",
    data: TEST_TEMPLATE_JSON,
    notes: [
      "STRUKTURA — id va marks majburiy, qolgan pedagogika maydonlari ixtiyoriy.",
      "id — savol raqami. Har bir shablon ichida noyob bo'lishi kerak. Test savoli shu id orqali shablonga bog'lanadi, ya'ni hisobotdagi mavzu tahlili shundan keladi.",
      "difficulty: \"Oson\" | \"O'rta\" | \"Qiyin\".",
      "bloom: \"Eslab qolish\" | \"Tushunish\" | \"Qo'llash\" | \"Tahlil\" | \"Baholash\" | \"Yaratish\".",
      "reasoning: \"Deduktiv\" | \"Induktiv\" | \"Analitik\" | \"Fazoviy\" (yoki null).",
      "techErrorIds — texnik xato havolalari. Har bir element: { id: \"M8\", note: \"ixtiyoriy izoh\" }. Eski format [\"M8\", \"M12\"] ham ishlaydi.",
      "techErrorIds logikasi (bir tomonlama): o'quvchi M1 ni xato yechsa, M8 yoki M12 ni to'g'ri yechganmi tekshiriladi. Agar ha — M1 texnik xato. M1 to'g'ri, M8 xato bo'lsa — M8 alohida tekshiriladi, bu logika teskari ishlamaydi.",
      "note mavjud bo'lsa va havolalangan savol to'g'ri yechilgan bo'lsa — o'quvchi natijasida 'Izoh' ustunida ko'rinadi.",
      "SAVOL MATNI (ixtiyoriy) — type / prompt va turiga mos mazmun massivi. Namunada olti turning HAMMASI bittadan: M1…M6. M7 esa matnsiz — mazmun yozilmasa import bo'sh blanka beradi (ball va mavzu baribir to'g'ri keladi), matnini admin panelda qo'lda yozasiz. Eski shablonlar shu sababli avvalgidek ishlaydi.",
      "MULTIPLE_CHOICE — choices[] + correctChoiceIds. correctChoiceIds da AYNAN bitta id (M1).",
      "MULTIPLE_SELECT — xuddi shu shakl, lekin correctChoiceIds da bir nechta id (M2). Ball faqat hammasi to'g'ri belgilangandagina beriladi — qisman ball yo'q.",
      "TRUE_FALSE — trueFalseItems[]: { id, text, correct: true/false } (M3). Bola hamma iborani to'g'ri belgilasagina ball oladi.",
      "FILL_GAP — prompt ichida bo'sh joy ___ bilan yoziladi, gapAnswers[] esa har bir bo'shliqqa javob, o'sha tartibda (M4). Solishtirish katta-kichik harf va ortiqcha bo'shliqni hisobga olmaydi.",
      "MATCHING — matchingPairs[]: { leftId, leftText, rightId, rightText } (M5). O'ng ustun o'quvchiga aralashtirilgan holda ko'rsatiladi.",
      "REORDERING — reorderItems[]: { id, text, correctIndex } (M6). correctIndex — TO'G'RI tartib, 0 dan boshlanadi; o'quvchi aralashtirilgan holda ko'radi.",
      "Matn maydonlari (prompt, label, text, leftText/rightText, gapAnswers): {\"UZ\":\"…\",\"RU\":\"…\"} yoki barcha tilda bir xil bo'lsa {\"same\":true,\"UZ\":\"$x^2$\"}. Oddiy satr ham bo'ladi (M6 dagi prompt) — u barcha tillarga tegishli deb o'qiladi. Test qaysi tillarda bo'lsa, o'sha tillar to'ldirilishi shart — aks holda saqlashda to'xtatiladi.",
      "imageUrl — ixtiyoriy, faqat savolda va har bir variantda (M1). trueFalseItems / matchingPairs / reorderItems / gapAnswers da rasm QO'LLAB-QUVVATLANMAYDI.",
      "id, marks, type, imageUrl, choices[].id, correctChoiceIds, trueFalseItems[].correct, matchingPairs[].leftId/rightId, reorderItems[].correctIndex hech qachon tarjima qilinmaydi — baholash aynan shularga tayanadi.",
      "Shablonda `order` yo'q — savollar tartibi massivdagi tartib bilan aniqlanadi.",
    ],
  },
  {
    key: "results-csv-import",
    title: "Natijalarni CSV/JSON import qilish (bulk)",
    intro:
      "Natijalar sahifasidagi \"CSV/JSON import\" tugmasi ushbu JSON'ni yoki maktabning original CSV eksportini qabul qiladi. Bir zumda o'nlab-yuzlab o'quvchining natijasini kiritish mumkin. Import UI ichidagi textarea JSON va CSV ni avtomatik ajratadi.",
    endpoint: "POST /api/admin/results/import-csv",
    data: RESULTS_JSON_SAMPLE,
    notes: [
      "students — massiv, har bir element bir o'quvchi va uning natijasi.",
      "uid — noyob o'quvchi identifikatori (majburiy). Shu UID bo'yicha student topiladi yoki yaratiladi.",
      "firstName + lastName — ism va familya alohida. Login kod tasodifiy 6 belgi (masalan 8Q4YTL) — familya/ism harflarga bog'liq emas.",
      "sex: \"MALE\" / \"FEMALE\" yoki null (bilinmagan). CSV'da E/A ham qabul qilinadi.",
      "grade — sinf raqami (5-11 gacha butun son).",
      "examLanguage: \"UZ\" / \"RU\" / \"EN\" yoki null.",
      "math (25 ta), ct (10 ta), eng (50 ta) — javob arraylari. Har element 1 = to'g'ri, 0 = noto'g'ri.",
      "Barcha javob 0 bo'lsa: student baribir yaratiladi, natija DRAFT holatida, savollar 'Noto'g'ri' deb belgilanadi (bola imtihonga kelmagan).",
      "Har importda har natijaga tasodifiy 6 belgili login kod va parol beriladi. Import qilinganidan keyin admin panelda CSV/JSON/PDF orqali yuklab olinadi.",
      "Bir bola shu imtihonga qayta import qilinsa — eski natija saqlanadi, yangi natija alohida yaratiladi (eski login kod ham amalda qoladi).",
    ],
  },
  {
    key: "result-outcomes",
    title: "Natija — savol-bo'yicha javob va xatolar",
    intro:
      "Natija tahrirlash oynasida savollar bo'yicha bola nima yozgani, qaysi savolni yechganini shu formatda kiritiladi. Struktura template'dan olinadi, siz faqat outcome kiritasiz.",
    data: RESULT_QUESTION_OUTCOME_JSON,
    notes: [
      "id template'dagi savol id'siga to'g'ri kelishi shart — aks holda savol ochilib topilmaydi.",
      "result: \"To'g'ri\" | \"Noto'g'ri\" | \"Qisman\".",
      "earned: shu savol uchun olingan ball (marks'dan oshmasin).",
      "errorType kiritish shart emas — tizim texnik xatoni template dagi techErrorIds asosida avtomatik aniqlaydi.",
      "evidence — komissiya izohi (ixtiyoriy, lekin roadmap uchun juda foydali).",
      "peerSolveRate — sinfning nechchi %'i bu savolni to'g'ri yechgani (0-100, ixtiyoriy).",
    ],
  },
  {
    key: "subject",
    title: "Fan (Subject) yaratish",
    intro: "Fanlar sahifasida yangi fan qo'shilganda backend'ga shunday JSON boradi.",
    endpoint: "POST /api/admin/subjects",
    data: SUBJECT_JSON,
    notes: [
      "key — ichki kalit. Faqat KATTA harflar, raqamlar va _. Masalan: MATH, PHYSICS, IT_LITERACY.",
      "name — ko'rsatiladigan nom (o'zbek tilida bo'lishi mumkin).",
      "order — ro'yxatdagi tartibi. 0 dan boshlanadi.",
    ],
  },
  {
    key: "exam",
    title: "Imtihon (Exam) yaratish",
    intro: "Imtihonlar sahifasidagi \"Yangi imtihon\" tugmasi orqali yaratilganda shu shakldagi JSON POST qilinadi.",
    endpoint: "POST /api/admin/exams",
    data: EXAM_JSON,
    notes: [
      "grades — imtihon o'tkaziladigan sinflar ro'yxati.",
      "subjectKeys — MATH / ENGLISH / CRITICAL_THINKING (hozircha shu 3 fan).",
      "admissionThresholds — sinf raqami bo'yicha kesim: har biri math/ct/en 0-100.",
      "gradingConfiguration.weights — umumiy ballni hisoblashda fanlar og'irligi. Yig'indisi 1 bo'lishi kerak.",
      "cohortSize — bu imtihonga kelgan bolalarning umumiy soni (persentil uchun).",
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary text-xs inline-flex items-center gap-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          // Clipboard blocked — user can still select+copy manually.
        }
      }}
    >
      <Icon name={ok ? "check" : "copy"} size={12} />
      {ok ? "Ko'chirildi" : "Nusxa olish"}
    </button>
  );
}

export default function DocsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Namunalar (JSON)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Admin panelning barcha JSON kiritish joylari uchun ishlab turgan namuna
          template'lar. Har birini xohlagan joyingizga nusxalab tashlashingiz mumkin —
          moslashtiring, o'z ma'lumotlaringiz bilan almashtiring va yuboring.
        </p>
      </div>

      <div className="card p-4 space-y-2">
        <div className="font-medium">Sahifada nima bor</div>
        <ul className="text-sm text-navy space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <a href={`#${s.key}`} className="hover:underline">
                — {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {SECTIONS.map((s) => {
        // CSV samples come in as raw strings — render verbatim. JSON samples
        // (objects/arrays) get pretty-printed.
        const json = typeof s.data === "string" ? s.data : JSON.stringify(s.data, null, 2);
        return (
          <section key={s.key} id={s.key} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy">{s.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{s.intro}</p>
                {s.endpoint && (
                  <div className="text-xs text-gray-500 mt-1 font-mono">{s.endpoint}</div>
                )}
              </div>
              <CopyButton text={json} />
            </div>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto font-mono border border-gray-200">
              {json}
            </pre>
            {s.notes && s.notes.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">Eslatmalar</div>
                <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
                  {s.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
