"use client";

// Savollarni JSON bilan to'ldirish / eksport qilish.
//
// 50 savolni qo'lda yozish o'rniga tayyor JSON tashlash — eng tez yo'l.
// Naqsh QuestionGridEditor'dagi PasteBox'dan olingan, lekin u BOSHQA shakl
// uchun (`Question` — shablon pedagogikasi, techErrorIds bilan), shuning
// uchun qayta ishlatilmadi.
//
// Bu panel FAQAT savollarni almashtiradi — test nomi, fani, sinfi allaqachon
// formada tanlangan bo'ladi. Butun testni (metadata + savollar) bitta JSON
// bilan yaratish uchun TestJsonPanel bor.
//
// Joylashdan oldin TEKSHIRAMIZ (dry-run) — qoidalar lib/questions-json.ts da.

import { useState } from "react";
import { type Lang } from "@/components/I18nField";
import { type TestQuestion } from "@/components/QuestionBuilder";
import { parseQuestionsPayload, validateQuestions } from "@/lib/questions-json";

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

  const lines = validateQuestions(qs, expectedCount, languages);
  return { ok: lines.length === 0, lines, parsed: qs };
}

export function QuestionsJsonPanel({
  questions,
  onChange,
  languages,
  expectedCount,
}: {
  questions: TestQuestion[];
  onChange: (next: TestQuestion[]) => void;
  languages: Lang[];
  expectedCount?: number;
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
    onChange(c.parsed.map((q, i) => ({ ...q, order: i })));
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
        <span className="text-gray-400 ml-auto">Namunalar: docs/json-namunalar.md</span>
      </div>

      {open && (
        <div className="card p-3 space-y-2">
          <div className="text-xs text-gray-500">
            Massiv yoki <code className="bg-gray-100 px-1">{`{ "questions": [...] }`}</code>. Matn maydonlari{" "}
            <code className="bg-gray-100 px-1">{`{"UZ":"…","RU":"…"}`}</code> yoki barcha tilda bir xil bo'lsa{" "}
            <code className="bg-gray-100 px-1">{`{"same":true,"UZ":"$x^2$"}`}</code>. Oddiy satr ham bo'ladi —
            u barcha tillarga tegishli deb o'qiladi.
          </div>
          <textarea
            className="w-full border rounded px-3 py-2 font-mono text-xs"
            rows={8}
            value={text}
            onChange={(e) => runCheck(e.target.value)}
            placeholder={`{ "questions": [ { "id": "q1", "order": 0, "type": "MULTIPLE_CHOICE", "marks": 2, ... } ] }`}
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
