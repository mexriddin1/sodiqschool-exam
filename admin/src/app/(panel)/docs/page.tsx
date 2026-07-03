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

const TEST_TEMPLATE_JSON = {
  questions: [
    {
      id: "M1",
      marks: 1,
      difficulty: "Oson",
      strand: "Algebra",
      topic: "Chiziqli tenglamalar",
      subTopic: "Bir noma'lumli tenglamalar",
      skill: "Tenglamani echish",
      bloom: "Qo'llash",
      reasoning: "Deduktiv",
      gradeLevel: "5-sinf",
      framework: "IB PYP",
      techErrorIds: ["M8", "M12"],
    },
    {
      id: "M2",
      marks: 2,
      difficulty: "O'rta",
      strand: "Geometriya",
      topic: "Uchburchaklar",
      subTopic: "Pifagor teoremasi",
      skill: "Formulani qo'llash",
      bloom: "Tahlil",
      reasoning: "Fazoviy",
      gradeLevel: "7-sinf",
      framework: "IB MYP",
    },
  ],
};

const RESULT_QUESTION_OUTCOME_JSON = {
  questions: [
    {
      id: "M1",
      result: "To'g'ri",
      earned: 1,
      errorType: null,
      evidence: "Yechim to'g'ri, ish qadamlari toza",
    },
    {
      id: "M2",
      result: "Noto'g'ri",
      earned: 0,
      errorType: "Bilim bo'shlig'i",
      evidence: "Pifagor formulasi noto'g'ri qo'llangan",
      peerSolveRate: 42,
    },
    {
      id: "M3",
      result: "Qisman",
      earned: 1,
      errorType: "Texnik",
      evidence: "Sonlar to'g'ri hisoblangan, oxirgi qadamda kichik xatolik",
    },
  ],
};

const SUBJECT_JSON = {
  key: "PHYSICS",
  name: "Fizika",
  order: 3,
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
      "Test shablonlari sahifasidagi \"JSON kiritish\" oynasi shu formatni qabul qiladi. Bu SAVOLLARNING STRUKTURASI (ballari, mavzu, qiyinligi, Bloom, ...) — bola qanday yechganini bu yerga yozmaymiz, u natija import qilinadigan JSON'da bo'ladi.",
    data: TEST_TEMPLATE_JSON,
    notes: [
      "id — savol raqami. Har bir shablon ichida noyob bo'lishi kerak.",
      "difficulty: \"Oson\" | \"O'rta\" | \"Qiyin\".",
      "bloom: \"Eslab qolish\" | \"Tushunish\" | \"Qo'llash\" | \"Tahlil\" | \"Baholash\" | \"Yaratish\".",
      "reasoning: \"Deduktiv\" | \"Induktiv\" | \"Analitik\" | \"Fazoviy\" (yoki null).",
      "techErrorIds: agar o'quvchi shu savolni noto'g'ri qilib, sanaladigan qiyinroq savolni to'g'ri yechgan bo'lsa — bu texnik xato hisoblanadi.",
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
      "errorType: \"Texnik\" | \"Bilim bo'shlig'i\" yoki null (to'g'ri javob bo'lsa null).",
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
        const json = JSON.stringify(s.data, null, 2);
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
