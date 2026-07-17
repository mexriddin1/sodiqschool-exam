"use client";

// Savollarni JSON bilan to'ldirish / eksport qilish.
//
// 50 savolni qo'lda yozish o'rniga tayyor JSON tashlash — eng tez yo'l.
// Naqsh QuestionGridEditor'dagi PasteBox'dan olingan, lekin u BOSHQA shakl
// uchun (`Question` — shablon pedagogikasi, techErrorIds bilan), shuning
// uchun qayta ishlatilmadi.
//
// Bu panel FAQAT savol MAZMUNINI almashtiradi — test nomi, fani, sinfi
// allaqachon formada tanlangan bo'ladi. Butun testni (metadata + savollar)
// bitta JSON bilan yaratish uchun TestJsonPanel bor.
//
// BALL VA BOG'LANISH JSON'DAN OLINMAYDI. Ular slotning o'zidan (ya'ni
// shablondan) keladi:
//   - ball shablonda qulflangan — QuestionBuilder'da input disabled, va JSON
//     orqali uni o'zgartirish o'sha qulfni chetlab o'tish bo'lardi;
//   - templateQuestionId esa hisobotdagi mavzu tahlilini boradigan bog'lanish
//     — JSON bilan almashtirilsa, u jimgina uzilib, hisobot buzilardi.
// Xuddi shu qoida tests/new dagi "Mavjud testdan nusxalash" da ham bor.
//
// Joylashdan oldin TEKSHIRAMIZ (dry-run) — qoidalar lib/questions-json.ts da.

import { useState } from "react";
import { type Lang } from "@/components/I18nField";
import { type TestQuestion } from "@/components/QuestionBuilder";
import { parseQuestionsPayload, validateQuestions } from "@/lib/questions-json";

/** Slotning ball manbai — shablon savoli. */
export interface TemplateSlot {
  id: string;
  marks?: number;
}

interface Check {
  ok: boolean;
  lines: string[];
  parsed?: TestQuestion[];
}

function validate(raw: string, expectedCount: number | undefined, languages: Lang[]): Check {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, lines: [`JSON o'qib bo'lmadi: ${e instanceof Error ? e.message : e}`] };
  }
  const qs = parseQuestionsPayload(data);
  if (!qs) {
    return { ok: false, lines: ["JSON massiv yoki { \"questions\": [...] } bo'lishi kerak."] };
  }

  const lines = validateQuestions(qs, expectedCount, languages, "fromTemplate");
  return { ok: lines.length === 0, lines, parsed: qs };
}

export function QuestionsJsonPanel({
  questions,
  onChange,
  languages,
  expectedCount,
  templateQuestions,
}: {
  questions: TestQuestion[];
  onChange: (next: TestQuestion[]) => void;
  languages: Lang[];
  expectedCount?: number;
  /**
   * Shablon savollari, test tartibida — ball va bog'lanish manbai.
   *
   * Yangi test sahifasida bor. Tahrirlash sahifasida YO'Q: u yerda slotlar
   * saqlangan testdan keladi va ball/bog'lanishni allaqachon o'zida saqlaydi.
   */
  templateQuestions?: TemplateSlot[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check | null>(null);

  const runCheck = (raw: string) => {
    setText(raw);
    setCheck(raw.trim() ? validate(raw, expectedCount, languages) : null);
  };

  const apply = () => {
    const c = validate(text, expectedCount, languages);
    setCheck(c);
    if (!c.parsed) return;
    // Faqat halokatli xatolarda to'xtatamiz (parse / son). Chala savollarni
    // joylashtirishga ruxsat beramiz — admin keyin to'ldiradi, ro'yxatda
    // sariq belgi bilan ko'rinadi. Saqlashda baribir tekshiriladi.
    const fatal = c.lines.some((l) => l.includes("JSON o'qib bo'lmadi") || l.includes("Savol soni mos emas"));
    if (fatal) return;
    // JSON'dan faqat MAZMUN olinadi. Ball va bog'lanish — shablondan (u
    // bo'lmasa hozirgi slotdan, ya'ni saqlangan testdan).
    onChange(
      c.parsed.map((q, i) => {
        const tpl = templateQuestions?.[i];
        const slot = questions[i];
        const next: TestQuestion = {
          ...q,
          order: i,
          marks: Math.max(1, Number(tpl?.marks ?? slot?.marks) || 1),
        };
        const boundTo = tpl?.id ?? slot?.templateQuestionId;
        if (boundTo) next.templateQuestionId = boundTo;
        else delete next.templateQuestionId;
        return next;
      }),
    );
    setOpen(false);
    setText("");
    setCheck(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ questions }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "savollar.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-navy hover:underline">
          {open ? "JSON panelini yopish" : "JSON bilan to'ldirish"}
        </button>
        <label className="text-navy hover:underline cursor-pointer">
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
        <button type="button" onClick={exportJson} className="text-navy hover:underline">
          JSON eksport
        </button>
        <a
          href="/docs#test-questions"
          target="_blank"
          rel="noreferrer"
          className="text-navy hover:underline ml-auto"
        >
          Namunalar (6 tur) ↗
        </a>
      </div>

      {open && (
        <div className="card p-3 space-y-2">
          <div className="text-xs text-gray-500">
            Massiv yoki <code className="bg-gray-100 px-1">{`{ "questions": [...] }`}</code>. Matn maydonlari{" "}
            <code className="bg-gray-100 px-1">{`{"UZ":"…","RU":"…"}`}</code> yoki barcha tilda bir xil bo'lsa{" "}
            <code className="bg-gray-100 px-1">{`{"same":true,"UZ":"$x^2$"}`}</code>. Oddiy satr ham bo'ladi —
            u barcha tillarga tegishli deb o'qiladi.
          </div>
          <div className="text-xs text-gray-500">
            <b>Ball yozilmaydi</b> — u shablondan olinadi.{" "}
            <code className="bg-gray-100 px-1">marks</code> yozilsa e&apos;tiborga olinmaydi.
          </div>
          <textarea
            className="w-full border rounded px-3 py-2 font-mono text-xs"
            rows={8}
            value={text}
            onChange={(e) => runCheck(e.target.value)}
            placeholder={`{ "questions": [ { "id": "q1", "order": 0, "type": "MULTIPLE_CHOICE", "prompt": { "UZ": "…" }, ... } ] }`}
          />

          {check && (
            <div
              className={`text-xs rounded px-3 py-2 space-y-1 ${
                check.ok ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800"
              }`}
            >
              {check.ok ? (
                <div>✓ {check.parsed?.length} ta savol — xatolik topilmadi.</div>
              ) : (
                <>
                  <div className="font-medium">{check.lines.length} ta ogohlantirish:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {check.lines.slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}
                    {check.lines.length > 8 && <li>… va yana {check.lines.length - 8} ta</li>}
                  </ul>
                </>
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
