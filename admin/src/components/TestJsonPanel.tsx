"use client";

// Butun testni bitta JSON bilan yaratish: nom + fan + sinf + tillar + vaqt +
// savollar. QuestionsJsonPanel faqat savollarni almashtiradi — bu esa formani
// boshidan oxirigacha to'ldiradi.
//
// Nega darhol POST qilmaydi, balki formani to'ldiradi: saqlash yo'li bitta
// bo'lib qoladi (page.tsx dagi save()), ya'ni shablon tanlash, tarjima
// tekshiruvi va xato ko'rsatish logikasi nusxalanmaydi. Admin JSON qanday
// o'qilganini ko'radi va faqat keyin saqlaydi.
//
// Yorliq (TestTemplate) JSON'da YO'Q va ataylab yo'q: u (imtihon, fan, sinf)
// dan avtomatik topiladi — @@unique([examId, subject, grade]). Admin "yorliq"
// atamasini umuman ko'rmaydi, JSON'da ham ko'rmasligi kerak.

import { useEffect, useState } from "react";
import { type Lang } from "@/components/I18nField";
import { type TestQuestion } from "@/components/QuestionBuilder";
import { parseQuestionsPayload, validateQuestions } from "@/lib/questions-json";

const SUBJECTS = ["MATH", "ENGLISH", "CRITICAL_THINKING"] as const;
export type Subject = (typeof SUBJECTS)[number];

const LANGS: Lang[] = ["UZ", "RU", "EN"];

export interface TestJsonValue {
  name: string;
  subject: Subject;
  grade: number;
  languages: Lang[];
  /** Ixtiyoriy — formadagi "Vaqt (daqiqa)" maydoni. */
  durationMin: number | null;
  questions: TestQuestion[];
}

interface TemplateLike {
  id: string;
  name: string;
  subject: Subject;
  grade: number;
  questionCount: number;
}

interface Check {
  /** Bu xatolar bilan qo'llab bo'lmaydi — forma to'ldirilmaydi. */
  fatal: string[];
  /** Chala savollar — qo'llanadi, admin keyin to'ldiradi. */
  warn: string[];
  value?: TestJsonValue;
  /** Topilgan yorliq — "shu shablon ishlatiladi" deb ko'rsatamiz. */
  template?: TemplateLike;
}

const SAMPLE = `{
  "name": "5-sinf matematika (QABUL 2026)",
  "subject": "MATH",
  "grade": 5,
  "languages": ["UZ", "RU"],
  "durationMin": 30,
  "questions": [ { "id": "q1", "order": 0, "type": "MULTIPLE_CHOICE", "marks": 2, "prompt": { "UZ": "…", "RU": "…" }, "choices": [ { "id": "q1-a", "label": { "same": true, "UZ": "96" } } ], "correctChoiceIds": ["q1-a"] } ]
}`;

function validate(raw: string, templates: TemplateLike[], ready: boolean): Check {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { fatal: [`JSON o'qib bo'lmadi: ${e instanceof Error ? e.message : e}`], warn: [] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      fatal: ["JSON obyekt bo'lishi kerak: { \"name\": …, \"subject\": …, \"questions\": [...] }."],
      warn: [],
    };
  }
  const o = data as Record<string, unknown>;
  const fatal: string[] = [];

  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) fatal.push("\"name\" — bo'sh bo'lmagan matn bo'lishi kerak.");

  const subject = o.subject as Subject;
  if (!SUBJECTS.includes(subject)) {
    fatal.push(`"subject" — ${SUBJECTS.join(" | ")} dan biri bo'lishi kerak (hozir: ${JSON.stringify(o.subject)}).`);
  }

  const grade = o.grade;
  if (!(typeof grade === "number" && Number.isInteger(grade) && grade >= 5 && grade <= 11)) {
    fatal.push(`"grade" — 5 dan 11 gacha butun son bo'lishi kerak (hozir: ${JSON.stringify(grade)}).`);
  }

  let languages: Lang[] = [];
  if (!Array.isArray(o.languages) || o.languages.length === 0) {
    fatal.push("\"languages\" — kamida bitta til bo'lgan massiv bo'lishi kerak, masalan [\"UZ\"].");
  } else {
    const bad = o.languages.filter((l) => !LANGS.includes(l as Lang));
    if (bad.length) fatal.push(`"languages" da noma'lum til: ${bad.map((b) => JSON.stringify(b)).join(", ")}. Ruxsat: UZ, RU, EN.`);
    else languages = o.languages as Lang[];
  }

  // durationMin — ixtiyoriy: yo'q / null bo'lsa vaqt cheklovi qo'yilmaydi.
  let durationMin: number | null = null;
  if (o.durationMin != null) {
    if (typeof o.durationMin !== "number" || !Number.isFinite(o.durationMin) || o.durationMin <= 0) {
      fatal.push(`"durationMin" — musbat son yoki null bo'lishi kerak (hozir: ${JSON.stringify(o.durationMin)}).`);
    } else {
      durationMin = o.durationMin;
    }
  }

  const questions = parseQuestionsPayload(o);
  if (!questions) fatal.push("\"questions\" — savollar massivi bo'lishi kerak.");
  else if (questions.length === 0) fatal.push("\"questions\" bo'sh — kamida bitta savol kerak.");

  // Yorliqni (imtihon, fan, sinf) bo'yicha topamiz — savol soni shundan.
  const template =
    SUBJECTS.includes(subject) && typeof grade === "number"
      ? templates.find((t) => t.subject === subject && t.grade === grade)
      : undefined;
  if (!template && fatal.length === 0) {
    // Yorliqlar hali kelmagan bo'lsa "shablon topilmadi" deyish YOLG'ON:
    // ro'yxat bo'sh, chunki so'rov tugamagan. Tez JSON tashlagan admin aynan
    // shu xatoni ko'rardi.
    fatal.push(
      ready
        ? `Bu imtihon uchun "${subject}" · ${grade}-sinf shabloni topilmadi — avval shablon yarating.`
        : "Shablonlar hali yuklanmoqda — bir soniyadan keyin urinib ko'ring.",
    );
  }

  if (fatal.length > 0 || !questions || !template) return { fatal, warn: [], template };

  // Savol tekshiruvi: soni mos kelmasa — halokatli (backend ham rad etadi),
  // qolgani ogohlantirish.
  const qLines = validateQuestions(questions, template.questionCount, languages);
  const countMismatch = qLines.filter((l) => l.startsWith("Savol soni mos emas"));
  const warn = qLines.filter((l) => !l.startsWith("Savol soni mos emas"));
  if (countMismatch.length) return { fatal: countMismatch, warn, template };

  return {
    fatal: [],
    warn,
    template,
    value: {
      name,
      subject,
      grade: grade as number,
      languages,
      durationMin,
      questions: questions.map((q, i) => ({ ...q, order: i })),
    },
  };
}

export function TestJsonPanel({
  templates,
  ready,
  onApply,
}: {
  /** Shu imtihonga tegishli yorliqlar — fan/sinf shular ichidan topiladi. */
  templates: TemplateLike[];
  /** Yorliqlar so'rovi tugaganmi. Bo'sh ro'yxat "yo'q" degani EMAS. */
  ready: boolean;
  onApply: (v: TestJsonValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check | null>(null);

  const runCheck = (raw: string) => {
    setText(raw);
    setCheck(raw.trim() ? validate(raw, templates, ready) : null);
  };

  // Yorliqlar kelgach qayta tekshiramiz — aks holda "yuklanmoqda" xabari
  // matn o'zgarmaguncha ekranda qotib qoladi.
  useEffect(() => {
    if (text.trim()) setCheck(validate(text, templates, ready));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, templates]);

  const apply = () => {
    const c = validate(text, templates, ready);
    setCheck(c);
    if (!c.value) return;
    onApply(c.value);
    setOpen(false);
    setText("");
    setCheck(null);
  };

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-navy hover:underline font-medium">
          {open ? "JSON panelini yopish" : "JSON bilan yaratish"}
        </button>
        <label className="text-xs text-navy hover:underline cursor-pointer">
          Fayldan import
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setOpen(true);
              runCheck(await f.text());
              e.target.value = "";
            }}
          />
        </label>
        <a href="/docs#test-create" className="text-xs text-gray-400 hover:underline ml-auto">
          Namuna: /docs
        </a>
      </div>

      {open && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            Butun test bitta JSON'da: <code className="bg-gray-100 px-1">name</code>,{" "}
            <code className="bg-gray-100 px-1">subject</code>, <code className="bg-gray-100 px-1">grade</code>,{" "}
            <code className="bg-gray-100 px-1">languages</code>,{" "}
            <code className="bg-gray-100 px-1">durationMin</code> (ixtiyoriy) va{" "}
            <code className="bg-gray-100 px-1">questions</code>. Qo'llagach forma to'ladi — ko'rib chiqib
            «Testni saqlash» bosasiz.
          </div>
          <textarea
            className="w-full border rounded px-3 py-2 font-mono text-xs"
            rows={8}
            value={text}
            onChange={(e) => runCheck(e.target.value)}
            placeholder={SAMPLE}
          />

          {check && (
            <div
              className={`text-xs rounded px-3 py-2 space-y-1 ${
                check.fatal.length > 0
                  ? "bg-red-50 text-red-700"
                  : check.warn.length > 0
                    ? "bg-orange-50 text-orange-800"
                    : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {check.fatal.length > 0 && (
                <>
                  <div className="font-medium">Qo'llab bo'lmaydi:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {check.fatal.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}
                    {check.fatal.length > 8 && <li>… va yana {check.fatal.length - 8} ta</li>}
                  </ul>
                </>
              )}
              {check.fatal.length === 0 && check.warn.length > 0 && (
                <>
                  <div className="font-medium">
                    {check.warn.length} ta ogohlantirish — qo'llash mumkin, keyin to'ldirasiz:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {check.warn.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}
                    {check.warn.length > 8 && <li>… va yana {check.warn.length - 8} ta</li>}
                  </ul>
                </>
              )}
              {check.fatal.length === 0 && check.warn.length === 0 && check.value && (
                <div>
                  ✓ {check.value.questions.length} ta savol — xatolik topilmadi.
                </div>
              )}
              {check.template && check.fatal.length === 0 && (
                <div className="text-gray-500">
                  Shablon: <b>{check.template.name}</b> ({check.template.questionCount} ta savol).
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={apply}
            disabled={!text.trim()}
            className="rounded bg-navy text-white px-3 py-1.5 text-sm disabled:opacity-60"
          >
            Qo'llash
          </button>
        </div>
      )}
    </div>
  );
}
