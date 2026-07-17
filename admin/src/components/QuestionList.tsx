"use client";

// Savollar ro'yxati — yig'iladigan (accordion) ko'rinish.
//
// Nega: 50 savolli Ingliz tili testida savol boshiga 5 ta matn maydoni bor
// (prompt + 4 variant), uch tilda esa 750 ta. Hammasini ochiq kartalar
// ro'yxatida ko'rsatish (avvalgi holat) formani ishlab bo'lmaydigan qilardi.
// Endi bir vaqtda bittasi ochiq; qolganlari bitta qator.
//
// Har qatorda holat belgisi bor, chunki chala savol jimgina saqlanib ketishi
// mumkin: matni bo'lmagan yoki to'g'ri javobi belgilanmagan savolni backend
// bemalol qabul qiladi.

import { useMemo, useState } from "react";
import { type Lang } from "@/components/I18nField";
import {
  applyTypeDefaults,
  QuestionEditor,
  questionPreview,
  questionStatus,
  type QStatus,
  type TestQuestion,
} from "@/components/QuestionBuilder";
import { QuestionsJsonPanel } from "@/components/QuestionsJsonPanel";

const STATUS_ICON: Record<QStatus, string> = { complete: "✓", partial: "●", empty: "○" };
const STATUS_CLASS: Record<QStatus, string> = {
  complete: "text-emerald-600",
  partial: "text-amber-500",
  empty: "text-gray-300",
};
const STATUS_TITLE: Record<QStatus, string> = {
  complete: "To'liq",
  partial: "Chala — matn yoki to'g'ri javob yetishmayapti",
  empty: "Bo'sh",
};

export function QuestionList({
  questions,
  onChange,
  languages,
  expectedCount,
  templateQuestions,
}: {
  questions: TestQuestion[];
  onChange: (next: TestQuestion[]) => void;
  languages: Lang[];
  /** Shablon talab qiladigan savol soni — JSON import shu bilan tekshiriladi. */
  expectedCount?: number;
  /**
   * Shablon savollari — har qatorda mavzu yorlig'ini ko'rsatish uchun.
   *
   * Bu KO'RINISH masalasi emas: hisobotdagi mavzu tahlili shu bog'lanishdan
   * keladi, va admin qaysi slot qaysi mavzuga tegishli ekanini ko'rmasa,
   * savollarni boshqa tartibda yozib, hisobotni jimgina buzishi mumkin.
   */
  templateQuestions?: { id: string; topic?: string; strand?: string; marks?: number }[];
}) {
  const [openId, setOpenId] = useState<string | null>(questions[0]?.id ?? null);
  const tplById = useMemo(
    () => new Map((templateQuestions ?? []).map((t) => [t.id, t])),
    [templateQuestions],
  );
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const statuses = useMemo(
    () => questions.map((q) => questionStatus(q, languages)),
    [questions, languages],
  );
  const completeCount = statuses.filter((s) => s === "complete").length;

  const replaceAt = (i: number, next: TestQuestion) => {
    const arr = [...questions];
    arr[i] = { ...next, order: i };
    onChange(arr);
  };

  // "Oldingi savol kabi": tuzilishni (tur, ball, variantlar soni) ko'chiradi,
  // matnni EMAS — bir xil tuzilishli 50 savolda faqat matn o'zgaradi.
  const copyStructureFromPrevious = (i: number) => {
    const prev = questions[i - 1];
    if (!prev) return;
    const blank = applyTypeDefaults({ ...questions[i]!, marks: prev.marks }, prev.type);
    if (prev.choices && blank.choices) {
      // Variantlar sonini ham tenglashtiramiz.
      const want = prev.choices.length;
      const cur = blank.choices;
      while (cur.length < want) cur.push({ id: `${blank.id}-${cur.length}`, label: {} });
      blank.choices = cur.slice(0, want);
    }
    replaceAt(i, blank);
  };

  const visible = questions
    .map((q, i) => ({ q, i, status: statuses[i]! }))
    .filter((x) => !onlyIncomplete || x.status !== "complete");

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-navy">Savollar</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className={completeCount === questions.length ? "text-emerald-600" : "text-gray-500"}>
            To'liq: <b>{completeCount}</b> / {questions.length}
          </span>
          {completeCount < questions.length && (
            <label className="flex items-center gap-1 cursor-pointer text-gray-600">
              <input
                type="checkbox"
                checked={onlyIncomplete}
                onChange={(e) => setOnlyIncomplete(e.target.checked)}
              />
              Faqat chalalari
            </label>
          )}
        </div>
      </div>

      <QuestionsJsonPanel
        questions={questions}
        onChange={onChange}
        languages={languages}
        expectedCount={expectedCount}
      />

      <div className="card divide-y">
        {visible.length === 0 && (
          <div className="p-4 text-sm text-gray-500">Barcha savollar to'ldirilgan.</div>
        )}
        {visible.map(({ q, i, status }) => {
          const open = openId === q.id;
          const preview = questionPreview(q, languages);
          return (
            <div key={q.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : q.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className={`${STATUS_CLASS[status]} w-4 text-center`} title={STATUS_TITLE[status]}>
                  {STATUS_ICON[status]}
                </span>
                <span className="text-sm text-gray-500 w-8">{i + 1}.</span>
                <span className={`flex-1 text-sm truncate ${preview ? "text-navy" : "text-gray-400 italic"}`}>
                  {preview || "(bo'sh)"}
                </span>
                {(() => {
                  const tpl = q.templateQuestionId ? tplById.get(q.templateQuestionId) : undefined;
                  if (!tpl) return null;
                  return (
                    <span
                      className="text-[10px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 max-w-[30%] truncate flex-none"
                      title={`Shablon: ${tpl.id} · ${tpl.topic ?? ""} · ${tpl.marks ?? "?"} ball`}
                    >
                      {tpl.topic ?? tpl.id}
                    </span>
                  );
                })()}
                <span className="text-[10px] uppercase text-gray-400">{q.type.replace("_", " ")}</span>
                <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div className="px-3 pb-3 space-y-2">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => copyStructureFromPrevious(i)}
                      className="text-xs text-navy hover:underline"
                      title="Oldingi savolning turi, bali va variantlar sonini ko'chiradi (matni emas)"
                    >
                      ↧ Oldingi savol kabi qilish
                    </button>
                  )}
                  <QuestionEditor
                    q={q}
                    languages={languages}
                    onChange={(next) => replaceAt(i, next)}
                    onRemove={() => replaceAt(i, applyTypeDefaults({ ...q, marks: 1 }, q.type))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
