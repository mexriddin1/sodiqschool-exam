"use client";

// Yangi test yaratish: imtihon + fan + sinf tanlanadi, yorliq (TestTemplate)
// esa shu uchtasidan AVTOMATIK topiladi — @@unique([examId, subject, grade])
// bo'yicha kombinatsiyaga bitta yorliq to'g'ri keladi. Admin "yorliq" degan
// atamani ko'rmaydi.
//
// Yorliq baribir majburiy va ma'lumotda saqlanadi: testning subject/grade'i
// o'shandan olinadi, va hisobotdagi butun mavzu tahlili (topic / strand /
// skill / bloom) yorliq savollaridan keladi — public.testtaking.ts dagi
// toStrictQuestion() o'sha yerdan o'qiydi. Yorliqsiz hammasi "Umumiy" ga
// tushib, diagnostika ma'nosini yo'qotadi.
//
// Yorliq soniga qarab blanka savollar yaratiladi; har birini QuestionEditor
// bilan to'ldiriladi.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { withBack } from "@/lib/back-link";
import { findMissingTranslations } from "@/components/I18nField";
import { TestQuestion, makeEmptyQuestion, makeQuestionFromTemplate } from "@/components/QuestionBuilder";
import { QuestionList } from "@/components/QuestionList";
import { TestJsonPanel } from "@/components/TestJsonPanel";

interface ExamOption {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  grade: number;
  grades: number[];
}

interface TemplateQuestion {
  id: string;
  marks?: number;
  topic?: string;
  strand?: string;
  subTopic?: string;
}

interface TemplateOption {
  id: string;
  name: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  examId: string | null;
  questionCount: number;
}

const LANGUAGES = [
  { key: "UZ", label: "O'zbek" },
  { key: "RU", label: "Rus" },
  { key: "EN", label: "Ingliz" },
] as const;
type Lang = (typeof LANGUAGES)[number]["key"];

type Subject = TemplateOption["subject"];

const SUBJECT_LABEL: Record<Subject, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

function NewTestForm() {
  const router = useRouter();
  // Paket sahifasidan kelinsa (?examId=), imtihon oldindan tanlanadi va
  // qulflanadi — test-templates/new dagi bilan bir xil qoida.
  const paramExamId = useSearchParams().get("examId") ?? "";
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [examId, setExamId] = useState(paramExamId);
  const [subject, setSubject] = useState<Subject | "">("");
  const [grade, setGrade] = useState<number | "">("");
  const [name, setName] = useState("");
  const [durationMinRaw, setDurationMinRaw] = useState("");
  const [languages, setLanguages] = useState<Lang[]>(["UZ"]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Yorliqlar so'rovi tugadimi. Bo'sh `templates` ikki xil ma'no beradi —
  // "hali kelmadi" va "yo'q" — va JSON paneli ularni farqlashi SHART.
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  // Tanlangan shablonning savollari (mavzu/ball). Ro'yxat endpointi faqat
  // sonini beradi, shuning uchun alohida olinadi.
  const [tplQuestions, setTplQuestions] = useState<TemplateQuestion[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api<{ items: ExamOption[] }>(`/api/admin/exams?take=200`).then((d) => setExams(d.items ?? []));
    api<{ items: TemplateOption[] }>(`/api/admin/test-templates?take=500`)
      .then((d) => setTemplates(d.items ?? []))
      .finally(() => setTemplatesLoaded(true));
  }, []);

  // Faqat shu imtihonga biriktirilgan yorliqlar. `examId = null` (eski
  // "umumiy kutubxona") ataylab QO'SHILMAYDI: yangi bunday yorliq yaratib
  // bo'lmaydi (admin.testtemplates.ts examId ni talab qiladi), Postgres'da
  // NULL ustunida @@unique ishlamaydi — ya'ni bir xil fan+sinf uchun bir
  // nechta null yorliq bo'lishi va tanlov noaniq bo'lishi mumkin, va ilova
  // bu chelakni klonlash orqali bo'shatmoqda.
  const eligibleTemplates = useMemo(
    () => (examId ? templates.filter((t) => t.examId === examId) : []),
    [templates, examId],
  );

  // Faqat yorliqqa ega bo'lgan fan/sinf variantlarini ko'rsatamiz — shunda
  // "yorliq topilmadi" holati umuman yuzaga kelmaydi.
  const subjectOptions = useMemo(
    () => Array.from(new Set(eligibleTemplates.map((t) => t.subject))).sort(),
    [eligibleTemplates],
  );
  const gradeOptions = useMemo(
    () =>
      Array.from(
        new Set(eligibleTemplates.filter((t) => t.subject === subject).map((t) => t.grade)),
      ).sort((a, b) => a - b),
    [eligibleTemplates, subject],
  );

  // (imtihon, fan, sinf) → yorliq. @@unique([examId, subject, grade]) borligi
  // uchun natija aniq: ko'pi bilan bitta.
  const selectedTpl = useMemo(() => {
    if (!subject || grade === "") return undefined;
    return eligibleTemplates.find((t) => t.subject === subject && t.grade === grade);
  }, [eligibleTemplates, subject, grade]);

  // Paketdan kelinganda o'sha paketga qaytamiz, aks holda umumiy ro'yxatga.
  const backHref = paramExamId ? `/tests/exam/${paramExamId}` : "/tests";
  const backLabel = paramExamId
    ? (exams.find((e) => e.id === paramExamId)?.title ?? "Imtihon paketi")
    : "Testlar";

  // Tanlov o'zgarsa, endi mos kelmaydigan qiymatlarni tozalaymiz.
  useEffect(() => {
    if (subject && !subjectOptions.includes(subject)) setSubject("");
  }, [subjectOptions, subject]);
  useEffect(() => {
    if (grade !== "" && !gradeOptions.includes(grade)) setGrade("");
  }, [gradeOptions, grade]);

  // Yorliq aniqlangach, savollar sonini unga tenglashtiramiz — backend
  // assertQuestionCountMatchesTemplate() bilan tengligini talab qiladi.
  useEffect(() => {
    if (!selectedTpl) return;
    if (questions.length === selectedTpl.questionCount) return;
    const next: TestQuestion[] = [];
    for (let i = 0; i < selectedTpl.questionCount; i++) {
      next.push(makeEmptyQuestion(i));
    }
    setQuestions(next);
  }, [selectedTpl?.id, selectedTpl?.questionCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Yorliq aniqlangach uning savollarini olamiz — import va mavzu yorliqlari
  // uchun kerak.
  useEffect(() => {
    if (!selectedTpl) { setTplQuestions([]); return; }
    api<{ questions?: TemplateQuestion[] }>(`/api/admin/test-templates/${selectedTpl.id}`)
      .then((d) => setTplQuestions(Array.isArray(d.questions) ? d.questions : []))
      .catch(() => setTplQuestions([]));
  }, [selectedTpl?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Shablondagi har savol uchun bitta blanka — ball va bog'lanish shablondan. */
  function importFromTemplate() {
    if (tplQuestions.length === 0) return;
    if (questions.some((q) => (q.prompt?.UZ ?? q.prompt?.RU ?? q.prompt?.EN ?? "").trim() !== "")) {
      if (!confirm("Yozilgan savollar o'chib, shablondan qaytadan yaratiladi. Davom etilsinmi?")) return;
    }
    setImporting(true);
    setQuestions(tplQuestions.map((tq, i) => makeQuestionFromTemplate(tq, i)));
    setError(null);
    setImporting(false);
  }

  function toggleLang(l: Lang) {
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function save() {
    setError(null);
    if (!examId || !subject || grade === "" || !name.trim()) {
      setError("Imtihon, fan, sinf va nom majburiy.");
      return;
    }
    if (!selectedTpl) {
      setError("Bu imtihon · fan · sinf uchun shablon topilmadi.");
      return;
    }
    if (languages.length === 0) {
      setError("Kamida bitta tilni tanlang.");
      return;
    }
    // `languages` = "qaysi tillarda mazmuni bor". Tanlangan til to'ldirilmasa,
    // o'sha tildagi o'quvchi bo'sh savol ko'radi — backend xato bermaydi.
    const missing = findMissingTranslations(questions, languages);
    if (missing.length > 0) {
      setError(
        `Tanlangan tillar to'liq to'ldirilmagan (${missing.length} ta savolda). ` +
          missing.slice(0, 3).join("; ") +
          (missing.length > 3 ? ` … va yana ${missing.length - 3} ta` : ""),
      );
      return;
    }
    const durationSec = durationMinRaw.trim()
      ? Math.max(60, Math.round(Number(durationMinRaw) * 60))
      : null;
    if (durationMinRaw.trim() && !Number.isFinite(Number(durationMinRaw))) {
      setError("Vaqt son bo'lishi kerak.");
      return;
    }
    setSaving(true);
    try {
      const t = await api<{ id: string }>("/api/admin/tests", {
        method: "POST",
        body: JSON.stringify({
          examId,
          // Avtomatik aniqlangan yorliq — UI'da ko'rsatilmaydi, lekin
          // testning pedagogik asosi shu.
          templateId: selectedTpl.id,
          name: name.trim(),
          subject: selectedTpl.subject,
          grade: selectedTpl.grade,
          languages,
          durationSec,
          questions,
        }),
      });
      // Yangi test sahifasiga o'tamiz; "orqaga" esa kelib chiqqan paketga
      // qaytarsin, umumiy ro'yxatga emas.
      router.push(withBack(`/tests/${t.id}`, backHref, backLabel));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href={backHref} className="text-sm text-navy underline">← {backLabel}</Link>
      <h1 className="text-2xl font-semibold text-navy">Yangi test</h1>

      {/* Imtihon tanlangandan keyin ko'rinadi: fan/sinf shu imtihonning
          yorliqlari ichidan topiladi, ya'ni imtihonsiz JSON'ni tekshirib
          ham bo'lmaydi. */}
      {examId && (
        <TestJsonPanel
          templates={eligibleTemplates}
          ready={templatesLoaded}
          onApply={(v) => {
            setSubject(v.subject);
            setGrade(v.grade);
            setName(v.name);
            setLanguages(v.languages);
            setDurationMinRaw(v.durationMin == null ? "" : String(v.durationMin));
            // Savollar soni yorliqnikiga teng (panel tekshirgan), shuning
            // uchun yuqoridagi "blanka yaratish" effekti ularni bosib
            // ketmaydi — u faqat son farq qilganda ishlaydi.
            //
            // Shablonga bog'lashni indeks bo'yicha qo'yamiz: JSON'da bunday
            // maydon yo'q, va bu ilgari ham amalda shunday ishlab kelgan.
            // Farqi — endi bog'lanish ochiq yozilib, ro'yxatda mavzu yorlig'i
            // bo'lib ko'rinadi, ya'ni noto'g'ri tartib sezilarli bo'ladi.
            setQuestions(
              v.questions.map((q, i) => {
                const tpl = tplQuestions[i];
                return tpl ? { ...q, templateQuestionId: tpl.id } : q;
              }),
            );
            setError(null);
          }}
        />
      )}

      <div className="card p-4 space-y-3">
        <div>
          <label htmlFor="exam-select" className="text-xs text-gray-500">Imtihon</label>
          <select
            id="exam-select"
            value={examId}
            onChange={(e) => { setExamId(e.target.value); setSubject(""); setGrade(""); }}
            className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-600"
            // Paketdan kelinganda imtihon o'zgarmaydi — test o'sha paketga tegishli.
            disabled={!!paramExamId}
          >
            <option value="">— tanlang —</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
            ))}
          </select>
          {!examId && (
            <div className="text-xs text-gray-500 mt-1">
              Avval imtihonni tanlang — fan va sinf shundan keyin ochiladi.
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="subject-select" className="text-xs text-gray-500">Fan</label>
            <select
              id="subject-select"
              value={subject}
              onChange={(e) => { setSubject(e.target.value as Subject); setGrade(""); }}
              className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
              disabled={!examId}
            >
              <option value="">— tanlang —</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>
              ))}
            </select>
            {examId && !subject && subjectOptions.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">Fanni tanlang — sinf shundan keyin ochiladi.</div>
            )}
          </div>
          <div className="w-40">
            <label htmlFor="grade-select" className="text-xs text-gray-500">Sinf</label>
            <select
              id="grade-select"
              value={grade === "" ? "" : String(grade)}
              onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
              className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
              disabled={!subject}
            >
              <option value="">— tanlang —</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>{g}-sinf</option>
              ))}
            </select>
          </div>
        </div>

        {examId && subjectOptions.length === 0 && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
            Bu imtihon uchun birorta ham savol shabloni yaratilmagan — test yaratib bo'lmaydi.{" "}
            <Link href={`/test-templates/exam/${examId}`} className="underline font-medium">
              Shu imtihonga shablon qo'shish →
            </Link>
          </div>
        )}
        {subject && grade !== "" && !selectedTpl && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
            Bu imtihon · fan · sinf uchun shablon topilmadi.
          </div>
        )}
        {selectedTpl && (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 border rounded px-3 py-2">
            <div className="text-xs text-gray-600">
              Bu testda aynan <b>{selectedTpl.questionCount} ta savol</b> bo'lishi shart —
              savollar tuzilishi <b>{selectedTpl.name}</b> shablonidan olinadi.
            </div>
            <button
              type="button"
              onClick={importFromTemplate}
              disabled={importing || tplQuestions.length === 0}
              className="rounded border border-navy text-navy px-3 py-1.5 text-xs font-medium hover:bg-navy hover:text-white disabled:opacity-50 flex-none"
              title="Har savol shablonning aniq qatoriga bog'lanadi; ball shablondan olinadi"
            >
              ↧ Shablondan import
            </button>
          </div>
        )}

        <div>
          <label htmlFor="test-name" className="text-xs text-gray-500">Test nomi</label>
          <input
            id="test-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Masalan: 5-sinf matematika (QABUL 2026)"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-start">
          <div>
            <label className="text-xs text-gray-500 block">Tillar (multi-select)</label>
            <div className="flex gap-2 mt-1">
              {LANGUAGES.map((l) => (
                <label key={l.key} className={`px-3 py-1 rounded border text-sm cursor-pointer ${languages.includes(l.key) ? "bg-navy text-white border-navy" : "bg-white text-gray-700"}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={languages.includes(l.key)}
                    onChange={() => toggleLang(l.key)}
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block">Vaqt (daqiqa, ixtiyoriy)</label>
            <input
              type="number"
              value={durationMinRaw}
              onChange={(e) => setDurationMinRaw(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-32"
              placeholder="masalan 30"
              min={1}
            />
          </div>
        </div>
      </div>

      {selectedTpl && (
        <QuestionList
          questions={questions}
          onChange={setQuestions}
          languages={languages}
          expectedCount={selectedTpl.questionCount}
          templateQuestions={tplQuestions}
        />
      )}

      {error && <div className="card p-3 bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="flex justify-end gap-3">
        <Link href={backHref} className="px-4 py-2 text-sm text-gray-600 hover:underline">Bekor qilish</Link>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-navy text-white px-4 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : "Testni saqlash"}
        </button>
      </div>
    </div>
  );
}

// useSearchParams() statik route'da Suspense chegarasini talab qiladi (Next 14).
export default function NewTestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Yuklanmoqda…</div>}>
      <NewTestForm />
    </Suspense>
  );
}
