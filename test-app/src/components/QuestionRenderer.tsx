"use client";

// Test topshirayotgan o'quvchi uchun savol ko'rinishlari. Har type uchun
// alohida render + input handler. Answer callback API-agnostik — parent
// javoblarni bir map { [qid]: value } ichida to'playdi.

import { useRef, useEffect } from "react";
import KatexInline from "./KatexInline";

export type ClientQuestion = {
  id: string;
  order: number;
  type:
    | "MULTIPLE_CHOICE"
    | "MULTIPLE_SELECT"
    | "TRUE_FALSE"
    | "FILL_GAP"
    | "MATCHING"
    | "REORDERING";
  marks: number;
  prompt: string;
  imageUrl?: string | null;
  choices?: { id: string; label: string; imageUrl?: string | null }[];
  trueFalseItems?: { id: string; text: string }[];
  gapCount?: number;
  matchingLefts?: { id: string; text: string }[];
  matchingRights?: { id: string; text: string }[];
  reorderItems?: { id: string; text: string }[];
};

type Props = {
  q: ClientQuestion;
  answer: unknown;
  onChange: (a: unknown) => void;
};

// Import MathLive lazily once — needed for FILL_GAP math input.
let mathliveReady = false;
async function loadMathlive() {
  if (mathliveReady || typeof window === "undefined") return;
  await import("mathlive");
  mathliveReady = true;
}

export default function QuestionRenderer({ q, answer, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="text-base text-slate-800">
        <KatexInline source={q.prompt} />
      </div>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-64 rounded border" />}

      {q.type === "MULTIPLE_CHOICE" && (
        <ChoiceInput q={q} answer={typeof answer === "string" ? answer : ""} onChange={onChange} multi={false} />
      )}
      {q.type === "MULTIPLE_SELECT" && (
        <ChoiceInput q={q} answer={Array.isArray(answer) ? (answer as string[]) : []} onChange={onChange} multi={true} />
      )}
      {q.type === "TRUE_FALSE" && (
        <TrueFalseInput q={q} answer={(answer && typeof answer === "object" ? answer : {}) as Record<string, boolean>} onChange={onChange} />
      )}
      {q.type === "FILL_GAP" && (
        <FillGapInput q={q} answer={Array.isArray(answer) ? (answer as string[]) : []} onChange={onChange} />
      )}
      {q.type === "MATCHING" && (
        <MatchingInput q={q} answer={(answer && typeof answer === "object" ? answer : {}) as Record<string, string>} onChange={onChange} />
      )}
      {q.type === "REORDERING" && (
        <ReorderInput q={q} answer={Array.isArray(answer) ? (answer as string[]) : []} onChange={onChange} />
      )}
    </div>
  );
}

function ChoiceInput({ q, answer, onChange, multi }: { q: ClientQuestion; answer: string | string[]; onChange: (a: unknown) => void; multi: boolean }) {
  const choices = q.choices ?? [];
  const isPicked = (id: string) => (multi ? (answer as string[]).includes(id) : answer === id);
  return (
    <div className="space-y-2">
      {choices.map((c, i) => (
        <label
          key={c.id}
          className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${isPicked(c.id) ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-400"}`}
        >
          <input
            type={multi ? "checkbox" : "radio"}
            name={`q-${q.id}`}
            checked={isPicked(c.id)}
            onChange={() => {
              if (multi) {
                const arr = answer as string[];
                const set = new Set(arr);
                if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
                onChange([...set]);
              } else {
                onChange(c.id);
              }
            }}
          />
          <div className="flex-1">
            <div className="text-sm">
              <span className="text-gray-500 mr-2">{String.fromCharCode(65 + i)}.</span>
              <KatexInline source={c.label} />
            </div>
            {c.imageUrl && <img src={c.imageUrl} alt="" className="max-h-32 mt-2 rounded border" />}
          </div>
        </label>
      ))}
    </div>
  );
}

function TrueFalseInput({ q, answer, onChange }: { q: ClientQuestion; answer: Record<string, boolean>; onChange: (a: unknown) => void }) {
  const items = q.trueFalseItems ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Har bir ibora uchun to'g'ri yoki noto'g'ri deb belgilang.</div>
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3 p-3 rounded border">
          <div className="flex-1 text-sm">
            <KatexInline source={it.text} />
          </div>
          <div className="flex gap-1">
            {(["T", "F"] as const).map((v) => {
              const picked = answer[it.id] === (v === "T");
              return (
                <button
                  type="button"
                  key={v}
                  onClick={() => onChange({ ...answer, [it.id]: v === "T" })}
                  className={`px-3 py-1 rounded text-sm border ${picked ? "bg-navy text-white border-navy" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  {v === "T" ? "To'g'ri" : "Noto'g'ri"}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FillGapInput({ q, answer, onChange }: { q: ClientQuestion; answer: string[]; onChange: (a: unknown) => void }) {
  const count = q.gapCount ?? 1;
  const values: string[] = Array.from({ length: count }, (_, i) => answer[i] ?? "");
  useEffect(() => { loadMathlive(); }, []);
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Har bir bo'sh joyni tartib bo'yicha to'ldiring. Matematik ifodalar uchun ustidagi kalkulyator klaviaturasidan foydalaning.
      </div>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="text-xs text-gray-500 w-16">Bo'shliq {i + 1}</div>
          <MathInput
            value={v}
            onChange={(next) => {
              const arr = [...values];
              arr[i] = next;
              onChange(arr);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function MathInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let disposed = false;
    loadMathlive().then(() => {
      if (disposed || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = ref.current as any;
      const h = () => onChange(String(el.value ?? ""));
      el.addEventListener("input", h);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).__h = h;
    });
    return () => {
      disposed = true;
      const el = ref.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (el && (el as any).__h) el.removeEventListener("input", (el as any).__h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (el && (el as any).value !== value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).value = value;
    }
  }, [value]);
  return (
    // @ts-ignore — math-field is a custom element registered at runtime
    <math-field
      ref={ref as unknown as React.Ref<HTMLElement>}
      style={{ flex: 1, minWidth: "150px" }}
    >
      {value}
    </math-field>
  );
}

function MatchingInput({ q, answer, onChange }: { q: ClientQuestion; answer: Record<string, string>; onChange: (a: unknown) => void }) {
  const lefts = q.matchingLefts ?? [];
  const rights = q.matchingRights ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Har chap ustundagi elementga o'ng ustundan mos javobni tanlang.</div>
      {lefts.map((l) => (
        <div key={l.id} className="flex items-center gap-3">
          <div className="flex-1 text-sm p-2 rounded border bg-gray-50">
            <KatexInline source={l.text} />
          </div>
          <select
            value={answer[l.id] ?? ""}
            onChange={(e) => onChange({ ...answer, [l.id]: e.target.value })}
            className="flex-1 border rounded px-2 py-2 text-sm"
          >
            <option value="">— tanlang —</option>
            {rights.map((r) => (
              <option key={r.id} value={r.id}>{r.text}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function ReorderInput({ q, answer, onChange }: { q: ClientQuestion; answer: string[]; onChange: (a: unknown) => void }) {
  const items = q.reorderItems ?? [];
  // Start from any previous ordering the student had, or the presented order.
  const order = answer.length === items.length ? answer : items.map((i) => i.id);
  const byId: Record<string, string> = Object.fromEntries(items.map((i) => [i.id, i.text]));
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const arr = [...order];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  }
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Elementlarni to'g'ri tartibga qo'ying (yuqoridan pastga).</div>
      {order.map((id, i) => (
        <div key={id} className="flex items-center gap-2 p-2 rounded border bg-white">
          <div className="text-xs text-gray-500 w-6">{i + 1}.</div>
          <div className="flex-1 text-sm">
            <KatexInline source={byId[id] ?? ""} />
          </div>
          <button type="button" onClick={() => move(i, -1)} className="px-2 py-1 rounded border text-xs">↑</button>
          <button type="button" onClick={() => move(i, +1)} className="px-2 py-1 rounded border text-xs">↓</button>
        </div>
      ))}
    </div>
  );
}
