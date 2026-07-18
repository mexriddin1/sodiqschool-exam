"use client";

// Test topshirayotgan o'quvchi uchun savol ko'rinishlari. Har type uchun
// alohida render + input handler. Answer callback API-agnostik — parent
// javoblarni bir map { [qid]: value } ichida to'playdi.
//
// Radio/checkbox ko'rinmaydi (sr-only), lekin DOM'da qoladi: tanlov nishoni —
// butun karta (katta tegish maydoni), semantikasi esa haqiqiy radio/checkbox
// bo'lib qolaveradi (klaviatura + ekran o'quvchi ishlaydi).

import { useCallback, useEffect, useRef, useState } from "react";
import KatexInline from "./KatexInline";
import { tr, type Lang } from "@/lib/i18n";

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
  /** Lead tili — savol matni ham shu tilda kelgan. */
  lang: Lang;
};

// Import MathLive lazily once — needed for FILL_GAP math input.
let mathliveReady = false;
async function loadMathlive() {
  if (mathliveReady || typeof window === "undefined") return;
  await import("mathlive");
  configureKeyboard();
  mathliveReady = true;
}

// Virtual klaviaturani sozlaymiz. Muammo: standart klaviaturada ARALASH KASR
// (5 8/10) kiritish og'ir edi — bola 1/5 ni yozib, keyin sonlarni almashtirishga
// urinardi. Endi alohida "Kasr" tabida ikkita tayyor tugma: oddiy kasr
// (▢/▢) va aralash kasr (▢ ▢/▢), sonlar bilan birga. Chiqadigan LaTeX
// (\frac{..}{..}, n\frac{..}{..}) backenddagi parseRational tushunadigan shakl.
interface MathKeyboard {
  layouts: unknown;
  visible?: boolean;
  boundingRect?: DOMRect;
  addEventListener?: (t: string, cb: () => void) => void;
}

let keyboardGeometryHooked = false;

function configureKeyboard() {
  const mvk = (window as unknown as { mathVirtualKeyboard?: MathKeyboard }).mathVirtualKeyboard;
  if (!mvk) return;
  const fractions = {
    label: "▢/▢",
    tooltip: "Kasrlar",
    rows: [
      ["7", "8", "9", { latex: "\\frac{#0}{#0}", tooltip: "Oddiy kasr" }],
      ["4", "5", "6", { latex: "#0\\frac{#0}{#0}", label: "▢ ▢/▢", tooltip: "Aralash kasr" }],
      ["1", "2", "3", { latex: "." }],
      ["0", { latex: "-" }, "[separator]", "[backspace]"],
    ],
  };
  mvk.layouts = ["numeric", fractions];

  // Klaviatura pastdan fixed chiqadi va fokusdagi input'ni bekitardi. Uning
  // balandligini `--mvk-pad` ga yozamiz — take sahifasidagi scroll konteyneri
  // shuncha pastki bo'shliq oladi va input klaviatura ustiga ko'tariladi
  // (MathInput focus'da scrollIntoView ham qiladi).
  if (!keyboardGeometryHooked && typeof mvk.addEventListener === "function") {
    keyboardGeometryHooked = true;
    const sync = () => {
      const h = mvk.visible ? Math.round(mvk.boundingRect?.height ?? 0) : 0;
      document.documentElement.style.setProperty("--mvk-pad", `${h}px`);
    };
    mvk.addEventListener("geometrychange", sync);
    sync();
  }
}

export default function QuestionRenderer({ q, answer, onChange, lang }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <span className="chip">{tr(lang, `hint_${q.type}` as "hint_MULTIPLE_CHOICE")}</span>
        <span className="chip chip-accent flex-none">
          <b className="num">{q.marks}</b> {tr(lang, "marks")}
        </span>
      </div>

      <div className="text-lg leading-relaxed text-ink font-display">
        <KatexInline source={q.prompt} />
      </div>

      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" className="max-h-64 rounded-[12px] border border-line" />
      )}

      {q.type === "MULTIPLE_CHOICE" && (
        <ChoiceInput lang={lang} q={q} answer={typeof answer === "string" ? answer : ""} onChange={onChange} multi={false} />
      )}
      {q.type === "MULTIPLE_SELECT" && (
        <ChoiceInput lang={lang} q={q} answer={Array.isArray(answer) ? (answer as string[]) : []} onChange={onChange} multi={true} />
      )}
      {q.type === "TRUE_FALSE" && (
        <TrueFalseInput lang={lang} q={q} answer={(answer && typeof answer === "object" ? answer : {}) as Record<string, boolean>} onChange={onChange} />
      )}
      {q.type === "FILL_GAP" && (
        <FillGapInput lang={lang} q={q} answer={Array.isArray(answer) ? (answer as string[]) : []} onChange={onChange} />
      )}
      {q.type === "MATCHING" && (
        <MatchingInput lang={lang} q={q} answer={(answer && typeof answer === "object" ? answer : {}) as Record<string, string>} onChange={onChange} />
      )}
      {q.type === "REORDERING" && (
        <ReorderInput lang={lang} q={q} answer={Array.isArray(answer) ? (answer as string[]) : []} onChange={onChange} />
      )}
    </div>
  );
}

function ChoiceInput({ q, answer, onChange, multi }: { lang: Lang; q: ClientQuestion; answer: string | string[]; onChange: (a: unknown) => void; multi: boolean }) {
  const choices = q.choices ?? [];
  const isPicked = (id: string) => (multi ? (answer as string[]).includes(id) : answer === id);
  return (
    <div className="space-y-2.5">
      {choices.map((c, i) => {
        const picked = isPicked(c.id);
        return (
          <label key={c.id} className={`option ${picked ? "is-picked" : ""}`}>
            <input
              type={multi ? "checkbox" : "radio"}
              name={`q-${q.id}`}
              checked={picked}
              className="sr-only"
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
            <span className="option-badge">{String.fromCharCode(65 + i)}</span>
            <span className="flex-1">
              <span className="text-[15px] text-ink">
                <KatexInline source={c.label} />
              </span>
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="max-h-32 mt-2 rounded-[10px] border border-line" />
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function TrueFalseInput({ lang, q, answer, onChange }: { lang: Lang; q: ClientQuestion; answer: Record<string, boolean>; onChange: (a: unknown) => void }) {
  const items = q.trueFalseItems ?? [];
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[16px] border-2 border-line bg-surface"
        >
          <div className="flex-1 text-[15px] text-ink">
            <KatexInline source={it.text} />
          </div>
          <div className="flex gap-2 flex-none">
            {(["T", "F"] as const).map((v) => {
              const picked = answer[it.id] === (v === "T");
              return (
                <button
                  type="button"
                  key={v}
                  aria-pressed={picked}
                  onClick={() => onChange({ ...answer, [it.id]: v === "T" })}
                  className={`seg ${picked ? "is-picked" : ""}`}
                  style={
                    picked
                      ? {
                          background: v === "T" ? "var(--pos)" : "var(--neg)",
                          borderColor: v === "T" ? "var(--pos)" : "var(--neg)",
                        }
                      : undefined
                  }
                >
                  {v === "T" ? tr(lang, "yes") : tr(lang, "no")}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FillGapInput({ lang, q, answer, onChange }: { lang: Lang; q: ClientQuestion; answer: string[]; onChange: (a: unknown) => void }) {
  const count = q.gapCount ?? 1;
  const values: string[] = Array.from({ length: count }, (_, i) => answer[i] ?? "");
  useEffect(() => { loadMathlive(); }, []);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted">
        {tr(lang, "gapHint")}
      </div>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="option-badge flex-none num">{i + 1}</span>
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
      el.__h = h;
      // Fokusda: klaviatura ochilib (--mvk-pad qo'yilib) bo'lgach input'ni
      // ko'rinadigan joyga suramiz — aks holda klaviatura uni bekitib qolardi.
      const f = () => {
        setTimeout(() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
      };
      el.addEventListener("focusin", f);
      el.__f = f;
    });
    return () => {
      disposed = true;
      const el = ref.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyEl = el as any;
      if (anyEl?.__h) el!.removeEventListener("input", anyEl.__h);
      if (anyEl?.__f) el!.removeEventListener("focusin", anyEl.__f);
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
    <math-field ref={ref as unknown as React.Ref<HTMLElement>}>
      {value}
    </math-field>
  );
}

/**
 * Juftlik moslash — chapdagi elementdan o'ngdagisiga QO'L BILAN chiziq
 * tortiladi (barmoq yoki sichqoncha bilan).
 *
 * Ikki yo'l ham ishlaydi va bittasi ikkinchisining zaxirasi:
 *   - sudrash: chapdagi nuqtadan o'ngdagi qatorga olib borish;
 *   - tegish: chapga bosasiz (yonadi), keyin o'ngga bosasiz.
 * Tegish yo'li klaviatura/ekran o'quvchi uchun ham qoladi — sof sudrashda
 * ular umuman javob bera olmasdi.
 *
 * Javob shakli o'zgarmadi: { [leftId]: rightId } — baholash o'sha-o'sha.
 */
function MatchingInput({ lang, q, answer, onChange }: { lang: Lang; q: ClientQuestion; answer: Record<string, string>; onChange: (a: unknown) => void }) {
  const lefts = q.matchingLefts ?? [];
  const rights = q.matchingRights ?? [];

  const boxRef = useRef<HTMLDivElement | null>(null);
  const leftRefs = useRef<Record<string, HTMLElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLElement | null>>({});

  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ leftId: string; x: number; y: number } | null>(null);
  // Chiziqlar konteyner koordinatalarida. Layout o'zgarsa qayta hisoblanadi.
  const [lines, setLines] = useState<{ leftId: string; x1: number; y1: number; x2: number; y2: number }[]>([]);

  /** Element markazini konteynerga nisbatan beradi. */
  const anchor = (el: HTMLElement | null, side: "right" | "left") => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!el || !box) return null;
    const r = el.getBoundingClientRect();
    return {
      x: (side === "right" ? r.right : r.left) - box.left,
      y: r.top + r.height / 2 - box.top,
    };
  };

  const recompute = useCallback(() => {
    const next: typeof lines = [];
    for (const [leftId, rightId] of Object.entries(answer)) {
      const a = anchor(leftRefs.current[leftId] ?? null, "right");
      const b = anchor(rightRefs.current[rightId] ?? null, "left");
      if (a && b) next.push({ leftId, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    setLines(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);

  // Layout o'zgarishi chiziqlarni siljitadi: matn o'ralishi, ekran burilishi,
  // shrift kech yuklanishi. Hammasini kuzatamiz.
  //
  // useLayoutEffect EMAS: Next client komponentni serverda ham render qiladi
  // va u yerda useLayoutEffect ogohlantirish beradi. Chiziqlar baribir
  // mount'dan keyin chiziladi.
  useEffect(() => { recompute(); }, [recompute]);
  useEffect(() => {
    const ro = new ResizeObserver(recompute);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", recompute);
    return () => { ro.disconnect(); window.removeEventListener("resize", recompute); };
  }, [recompute]);

  const connect = (leftId: string, rightId: string) => {
    onChange({ ...answer, [leftId]: rightId });
    setActiveLeft(null);
  };

  const clear = (leftId: string) => {
    const next = { ...answer };
    delete next[leftId];
    onChange(next);
  };

  /** Nuqta qaysi o'ng qator ustida — sudrash tugaganda kerak. */
  const rightUnder = (clientX: number, clientY: number): string | null => {
    for (const r of rights) {
      const el = rightRefs.current[r.id];
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (clientX >= b.left && clientX <= b.right && clientY >= b.top && clientY <= b.bottom) return r.id;
    }
    return null;
  };

  const toLocal = (clientX: number, clientY: number) => {
    const box = boxRef.current!.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };

  function onLeftPointerDown(e: React.PointerEvent, leftId: string) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = toLocal(e.clientX, e.clientY);
    setDrag({ leftId, x: p.x, y: p.y });
    setActiveLeft(leftId);
  }

  function onLeftPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = toLocal(e.clientX, e.clientY);
    setDrag({ ...drag, x: p.x, y: p.y });
  }

  function onLeftPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const hit = rightUnder(e.clientX, e.clientY);
    if (hit) connect(drag.leftId, hit);
    // Tegish bo'lsa (sudralmagan) — activeLeft yonib qoladi, o'ngga bosish
    // kutiladi. Shuning uchun bu yerda activeLeft'ni tozalamaymiz.
    setDrag(null);
  }

  const liveLine = drag
    ? (() => {
        const a = anchor(leftRefs.current[drag.leftId] ?? null, "right");
        return a ? { x1: a.x, y1: a.y, x2: drag.x, y2: drag.y } : null;
      })()
    : null;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted">
        {tr(lang, "matchHint")}
      </div>

      <div ref={boxRef} className="relative grid grid-cols-2 gap-6 sm:gap-10">
        {/* Chiziqlar — kartalar ustida, lekin bosishga xalaqit bermaydi. */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} aria-hidden="true">
          {lines.map((l) => (
            <line
              key={l.leftId}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round"
            />
          ))}
          {liveLine && (
            <line
              x1={liveLine.x1} y1={liveLine.y1} x2={liveLine.x2} y2={liveLine.y2}
              stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="5 4"
            />
          )}
        </svg>

        <div className="space-y-2.5">
          {lefts.map((l) => {
            const linked = Boolean(answer[l.id]);
            const active = activeLeft === l.id;
            return (
              <div
                key={l.id}
                ref={(el) => { leftRefs.current[l.id] = el; }}
                onPointerDown={(e) => onLeftPointerDown(e, l.id)}
                onPointerMove={onLeftPointerMove}
                onPointerUp={onLeftPointerUp}
                onPointerCancel={() => setDrag(null)}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveLeft(active ? null : l.id); }
                }}
                className={`relative flex items-center gap-2 p-3 pr-4 rounded-[14px] border-2 bg-surface select-none cursor-pointer transition-colors ${
                  active ? "border-accent bg-accent-weak" : linked ? "border-accent" : "border-line"
                }`}
                style={{ touchAction: "none", zIndex: 2 }}
              >
                <div className="flex-1 text-[15px] text-ink">
                  <KatexInline source={l.text} />
                </div>
                {linked && (
                  <button
                    type="button"
                    aria-label={tr(lang, "matchClear")}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); clear(l.id); }}
                    className="flex-none text-faint hover:text-neg text-sm leading-none"
                  >
                    ✕
                  </button>
                )}
                {/* Ulanish nuqtasi — chiziq shu yerdan chiqadi. */}
                <span
                  className="absolute -right-1.5 w-3 h-3 rounded-full border-2"
                  style={{
                    background: linked || active ? "var(--accent)" : "var(--surface)",
                    borderColor: linked || active ? "var(--accent)" : "var(--border-strong)",
                  }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-2.5">
          {rights.map((r) => {
            const takenBy = Object.entries(answer).find(([, v]) => v === r.id)?.[0];
            return (
              <div
                key={r.id}
                ref={(el) => { rightRefs.current[r.id] = el; }}
                role="button"
                tabIndex={0}
                onClick={() => { if (activeLeft) connect(activeLeft, r.id); }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && activeLeft) { e.preventDefault(); connect(activeLeft, r.id); }
                }}
                className={`relative flex items-center gap-2 p-3 pl-4 rounded-[14px] border-2 bg-surface select-none transition-colors ${
                  takenBy ? "border-accent" : activeLeft ? "border-line-strong cursor-pointer hover:bg-inset" : "border-line"
                }`}
                style={{ touchAction: "none", zIndex: 2 }}
              >
                <span
                  className="absolute -left-1.5 w-3 h-3 rounded-full border-2"
                  style={{
                    background: takenBy ? "var(--accent)" : "var(--surface)",
                    borderColor: takenBy ? "var(--accent)" : "var(--border-strong)",
                  }}
                  aria-hidden="true"
                />
                <div className="flex-1 text-[15px] text-ink">
                  <KatexInline source={r.text} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Tartiblash — qatorni barmoq bilan sudrab ko'chiriladi.
 *
 * HTML5 drag-and-drop ATAYLAB ishlatilmadi: u touch'da umuman ishlamaydi,
 * maqsadli qurilma esa planshet. Pointer Events sichqoncha va barmoq uchun
 * bitta yo'l beradi.
 *
 * ↑↓ tugmalari qoladi: sudrash klaviatura bilan ishlamaydi, ular esa
 * yagona kirish yo'li.
 */
function ReorderInput({ lang, q, answer, onChange }: { lang: Lang; q: ClientQuestion; answer: string[]; onChange: (a: unknown) => void }) {
  const items = q.reorderItems ?? [];
  // Start from any previous ordering the student had, or the presented order.
  const order = answer.length === items.length ? answer : items.map((i) => i.id);
  const byId: Record<string, string> = Object.fromEntries(items.map((i) => [i.id, i.text]));

  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  // Sudrash holati ref'da: pointermove sekundiga o'nlab marta chaqiriladi va
  // har biri uchun render qilish shart emas.
  const drag = useRef<{ idx: number; baseY: number; rowH: number } | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const arr = [...order];
    // `!` ishlatilmaydi: destrukturlashning CHAP tomonida u sintaksis xatosi
    // (tsc yutadi, Next'ning SWC'si rad etadi).
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  }

  function onPointerDown(e: React.PointerEvent, i: number) {
    // Faqat asosiy tugma / barmoq.
    if (e.button !== 0) return;
    const rowH = rowRef.current?.getBoundingClientRect().height ?? 56;
    drag.current = { idx: i, baseY: e.clientY, rowH };
    setDragId(order[i] ?? null);
    setOffset(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.baseY;
    // Yarim qatordan oshsa — qo'shni bilan almashamiz va tayanchni suramiz.
    // Shunda uzoq sudrashda ham har qadamda bittadan siljiydi.
    const step = d.rowH * 0.55;
    if (dy > step && d.idx < order.length - 1) {
      move(d.idx, +1);
      d.idx += 1;
      d.baseY += d.rowH;
    } else if (dy < -step && d.idx > 0) {
      move(d.idx, -1);
      d.idx -= 1;
      d.baseY -= d.rowH;
    }
    setOffset(e.clientY - d.baseY);
  }

  function endDrag() {
    drag.current = null;
    setDragId(null);
    setOffset(0);
  }

  return (
    <div className="space-y-2.5">
      <div className="text-xs text-muted">
        {tr(lang, "reorderHint")}
      </div>
      {order.map((id, i) => {
        const dragging = dragId === id;
        return (
          <div
            key={id}
            ref={i === 0 ? rowRef : undefined}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`flex items-center gap-3 p-3 rounded-[16px] border-2 bg-surface select-none ${
              dragging ? "border-accent shadow-lg cursor-grabbing" : "border-line cursor-grab"
            }`}
            style={{
              // touch-action: sudrayotganda sahifa skroll bo'lib ketmasin.
              touchAction: "none",
              transform: dragging ? `translateY(${offset}px)` : undefined,
              // Sudralayotgan qator qolganlarining ustida turishi kerak.
              position: dragging ? "relative" : undefined,
              zIndex: dragging ? 10 : undefined,
            }}
          >
            <span className="option-badge flex-none num">{i + 1}</span>
            <span className="flex-none text-faint leading-none" aria-hidden="true">⠿</span>
            <div className="flex-1 text-[15px] text-ink">
              <KatexInline source={byId[id] ?? ""} />
            </div>
            <div className="flex flex-col gap-1 flex-none">
              <button
                type="button"
                onClick={() => move(i, -1)}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={i === 0}
                aria-label={tr(lang, "moveUp")}
                className="icon-btn"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, +1)}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={i === order.length - 1}
                aria-label={tr(lang, "moveDown")}
                className="icon-btn"
              >
                ↓
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
