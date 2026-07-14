"use client";

// Test savollarining editori. 6 ta savol turi:
//   MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE,
//   FILL_GAP, MATCHING, REORDERING
// Har birini boshqarish uchun kichik sub-form. Umumiy fieldlar (prompt,
// marks, imageUrl) — yuqorida.

import { useState } from "react";
import { API_BASE, api } from "@/lib/api";

export type QType =
  | "MULTIPLE_CHOICE"
  | "MULTIPLE_SELECT"
  | "TRUE_FALSE"
  | "FILL_GAP"
  | "MATCHING"
  | "REORDERING";

export interface Choice { id: string; label: string; imageUrl?: string | null }
export interface TFItem { id: string; text: string; correct: boolean }
export interface MatchPair { leftId: string; leftText: string; rightId: string; rightText: string }
export interface ReorderItem { id: string; text: string; correctIndex: number }

export interface TestQuestion {
  id: string;
  order: number;
  type: QType;
  marks: number;
  prompt: string;
  imageUrl?: string | null;
  choices?: Choice[];
  correctChoiceIds?: string[];
  trueFalseItems?: TFItem[];
  gapAnswers?: string[];
  matchingPairs?: MatchPair[];
  reorderItems?: ReorderItem[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function makeEmptyQuestion(order: number, type: QType = "MULTIPLE_CHOICE"): TestQuestion {
  const base: TestQuestion = {
    id: uid(),
    order,
    type,
    marks: 1,
    prompt: "",
  };
  return applyTypeDefaults(base, type);
}

export function applyTypeDefaults(q: TestQuestion, type: QType): TestQuestion {
  const next: TestQuestion = { ...q, type };
  next.choices = undefined;
  next.correctChoiceIds = undefined;
  next.trueFalseItems = undefined;
  next.gapAnswers = undefined;
  next.matchingPairs = undefined;
  next.reorderItems = undefined;
  switch (type) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT":
      next.choices = [
        { id: uid(), label: "" },
        { id: uid(), label: "" },
        { id: uid(), label: "" },
        { id: uid(), label: "" },
      ];
      next.correctChoiceIds = [];
      break;
    case "TRUE_FALSE":
      next.trueFalseItems = [
        { id: uid(), text: "", correct: true },
        { id: uid(), text: "", correct: false },
        { id: uid(), text: "", correct: true },
      ];
      break;
    case "FILL_GAP":
      next.gapAnswers = [""];
      break;
    case "MATCHING":
      next.matchingPairs = [
        { leftId: uid(), leftText: "", rightId: uid(), rightText: "" },
        { leftId: uid(), leftText: "", rightId: uid(), rightText: "" },
      ];
      break;
    case "REORDERING":
      next.reorderItems = [
        { id: uid(), text: "", correctIndex: 0 },
        { id: uid(), text: "", correctIndex: 1 },
      ];
      break;
  }
  return next;
}

async function uploadImage(file: File): Promise<string> {
  // Backend does not yet expose an image upload endpoint. As an interim we
  // store the image as a data URL inside the question JSON. If it grows too
  // large (>200KB) we surface an error so admin knows to shrink it.
  if (file.size > 200_000) {
    throw new Error("Rasm hajmi 200KB dan kichik bo'lishi kerak (hozircha).");
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

export function QuestionEditor({
  q,
  onChange,
  onRemove,
}: {
  q: TestQuestion;
  onChange: (next: TestQuestion) => void;
  onRemove: () => void;
}) {
  const upd = (patch: Partial<TestQuestion>) => onChange({ ...q, ...patch });

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase text-gray-500 font-semibold">Savol #{q.order + 1}</div>
        <div className="flex items-center gap-2">
          <select
            value={q.type}
            onChange={(e) => onChange(applyTypeDefaults(q, e.target.value as QType))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="MULTIPLE_CHOICE">Multiple choice (1 to'g'ri)</option>
            <option value="MULTIPLE_SELECT">Multiple select (bir necha to'g'ri)</option>
            <option value="TRUE_FALSE">To'g'ri / Noto'g'ri (bir necha item)</option>
            <option value="FILL_GAP">Bo'sh joyni to'ldirish</option>
            <option value="MATCHING">Juftlik moslash</option>
            <option value="REORDERING">Tartibga qo'yish</option>
          </select>
          <input
            type="number"
            min={1}
            value={q.marks}
            onChange={(e) => upd({ marks: Math.max(1, Number(e.target.value) || 1) })}
            className="border rounded px-2 py-1 text-sm w-16"
            title="Ball"
          />
          <button
            type="button"
            onClick={onRemove}
            className="text-red-600 text-xs hover:underline"
          >
            O'chirish
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">Savol matni (LaTeX: $x^2$, $\sqrt{2}$)</label>
        <textarea
          value={q.prompt}
          onChange={(e) => upd({ prompt: e.target.value })}
          rows={2}
          className="w-full border rounded px-3 py-2 text-sm font-mono"
          placeholder="Savolni yozing. Formula uchun $...$ ishlatiladi."
        />
      </div>

      <div className="flex items-center gap-3">
        {q.imageUrl && (
          <img src={q.imageUrl} alt="" className="h-20 rounded border" />
        )}
        <label className="text-xs text-navy underline cursor-pointer">
          {q.imageUrl ? "Rasmni almashtirish" : "+ Rasm qo'shish"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const url = await uploadImage(f);
                upd({ imageUrl: url });
              } catch (err) {
                alert(err instanceof Error ? err.message : "Xato");
              }
            }}
          />
        </label>
        {q.imageUrl && (
          <button type="button" onClick={() => upd({ imageUrl: null })} className="text-xs text-red-600 hover:underline">
            Rasmni o'chirish
          </button>
        )}
      </div>

      {(q.type === "MULTIPLE_CHOICE" || q.type === "MULTIPLE_SELECT") && (
        <ChoiceEditor q={q} onChange={onChange} multi={q.type === "MULTIPLE_SELECT"} />
      )}
      {q.type === "TRUE_FALSE" && <TrueFalseEditor q={q} onChange={onChange} />}
      {q.type === "FILL_GAP" && <FillGapEditor q={q} onChange={onChange} />}
      {q.type === "MATCHING" && <MatchingEditor q={q} onChange={onChange} />}
      {q.type === "REORDERING" && <ReorderEditor q={q} onChange={onChange} />}
    </div>
  );
}

function ChoiceEditor({ q, onChange, multi }: { q: TestQuestion; onChange: (n: TestQuestion) => void; multi: boolean }) {
  const choices = q.choices ?? [];
  const correct = new Set(q.correctChoiceIds ?? []);
  const toggle = (id: string) => {
    if (multi) {
      const s = new Set(correct);
      if (s.has(id)) s.delete(id); else s.add(id);
      onChange({ ...q, correctChoiceIds: [...s] });
    } else {
      onChange({ ...q, correctChoiceIds: [id] });
    }
  };
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        {multi ? "Bir nechta to'g'ri javob mumkin — kerakli barchasini belgilang." : "Bitta to'g'ri javobni tanlang."}
      </div>
      {choices.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2">
          <input
            type={multi ? "checkbox" : "radio"}
            name={`correct-${q.id}`}
            checked={correct.has(c.id)}
            onChange={() => toggle(c.id)}
          />
          <input
            type="text"
            value={c.label}
            onChange={(e) => {
              const next = [...choices];
              next[i] = { ...c, label: e.target.value };
              onChange({ ...q, choices: next });
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder={`Variant ${String.fromCharCode(65 + i)}`}
          />
          <label className="text-xs text-navy underline cursor-pointer">
            Rasm
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const url = await uploadImage(f);
                  const next = [...choices];
                  next[i] = { ...c, imageUrl: url };
                  onChange({ ...q, choices: next });
                } catch (err) { alert(err instanceof Error ? err.message : "Xato"); }
              }}
            />
          </label>
          {c.imageUrl && <img src={c.imageUrl} alt="" className="h-8 rounded border" />}
          <button
            type="button"
            className="text-red-600 text-xs"
            onClick={() => onChange({ ...q, choices: choices.filter((x) => x.id !== c.id) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-navy hover:underline"
        onClick={() => onChange({ ...q, choices: [...choices, { id: uid(), label: "" }] })}
      >
        + Variant qo'shish
      </button>
    </div>
  );
}

function TrueFalseEditor({ q, onChange }: { q: TestQuestion; onChange: (n: TestQuestion) => void }) {
  const items = q.trueFalseItems ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Bir necha to'g'ri/noto'g'ri iborani kiriting. O'quvchi HAMMA iborani to'g'ri belgilagandagina savolni bergan hisoblanadi.
      </div>
      {items.map((it, i) => (
        <div key={it.id} className="flex items-center gap-2">
          <select
            value={it.correct ? "T" : "F"}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...it, correct: e.target.value === "T" };
              onChange({ ...q, trueFalseItems: next });
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="T">To'g'ri</option>
            <option value="F">Noto'g'ri</option>
          </select>
          <input
            type="text"
            value={it.text}
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...it, text: e.target.value };
              onChange({ ...q, trueFalseItems: next });
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Ibora matni"
          />
          <button type="button" className="text-red-600 text-xs" onClick={() => onChange({ ...q, trueFalseItems: items.filter((x) => x.id !== it.id) })}>✕</button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-navy hover:underline"
        onClick={() => onChange({ ...q, trueFalseItems: [...items, { id: uid(), text: "", correct: true }] })}
      >
        + Ibora qo'shish
      </button>
    </div>
  );
}

function FillGapEditor({ q, onChange }: { q: TestQuestion; onChange: (n: TestQuestion) => void }) {
  const answers = q.gapAnswers ?? [""];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Savol matnida bo'sh joyni <code className="bg-gray-100 px-1">___</code> bilan belgilang. Har bir bo'sh joy uchun mos javobni tartib bo'yicha kiriting.
      </div>
      {answers.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16">Bo'shliq {i + 1}</span>
          <input
            type="text"
            value={a}
            onChange={(e) => {
              const next = [...answers];
              next[i] = e.target.value;
              onChange({ ...q, gapAnswers: next });
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="To'g'ri javob"
          />
          <button type="button" className="text-red-600 text-xs" onClick={() => onChange({ ...q, gapAnswers: answers.filter((_, idx) => idx !== i) })}>✕</button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-navy hover:underline"
        onClick={() => onChange({ ...q, gapAnswers: [...answers, ""] })}
      >
        + Bo'shliq qo'shish
      </button>
    </div>
  );
}

function MatchingEditor({ q, onChange }: { q: TestQuestion; onChange: (n: TestQuestion) => void }) {
  const pairs = q.matchingPairs ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Chap ustundagi har bir elementga o'ng ustunda mos javobni belgilang.
      </div>
      {pairs.map((p, i) => (
        <div key={p.leftId} className="flex items-center gap-2">
          <input
            type="text"
            value={p.leftText}
            onChange={(e) => {
              const next = [...pairs];
              next[i] = { ...p, leftText: e.target.value };
              onChange({ ...q, matchingPairs: next });
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Chap: element"
          />
          <span className="text-gray-400">→</span>
          <input
            type="text"
            value={p.rightText}
            onChange={(e) => {
              const next = [...pairs];
              next[i] = { ...p, rightText: e.target.value };
              onChange({ ...q, matchingPairs: next });
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="O'ng: mos javob"
          />
          <button type="button" className="text-red-600 text-xs" onClick={() => onChange({ ...q, matchingPairs: pairs.filter((_, idx) => idx !== i) })}>✕</button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-navy hover:underline"
        onClick={() => onChange({ ...q, matchingPairs: [...pairs, { leftId: uid(), leftText: "", rightId: uid(), rightText: "" }] })}
      >
        + Juftlik qo'shish
      </button>
    </div>
  );
}

function ReorderEditor({ q, onChange }: { q: TestQuestion; onChange: (n: TestQuestion) => void }) {
  const items = q.reorderItems ?? [];
  const sorted = [...items].sort((a, b) => a.correctIndex - b.correctIndex);
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Elementlarni to'g'ri tartibda kiriting (yuqoridan pastga). Bola ularni aralashtirilgan holda ko'radi.
      </div>
      {sorted.map((it, i) => (
        <div key={it.id} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-6">{i + 1}.</span>
          <input
            type="text"
            value={it.text}
            onChange={(e) => {
              const next = items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x));
              onChange({ ...q, reorderItems: next });
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Element matni"
          />
          <button type="button" className="text-red-600 text-xs" onClick={() => {
            const rest = items.filter((x) => x.id !== it.id).map((x, idx) => ({ ...x, correctIndex: idx }));
            onChange({ ...q, reorderItems: rest });
          }}>✕</button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-navy hover:underline"
        onClick={() => onChange({ ...q, reorderItems: [...items, { id: uid(), text: "", correctIndex: items.length }] })}
      >
        + Element qo'shish
      </button>
    </div>
  );
}
