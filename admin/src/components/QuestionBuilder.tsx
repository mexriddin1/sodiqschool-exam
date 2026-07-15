"use client";

// Test savollarining editori. 6 ta savol turi:
//   MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE,
//   FILL_GAP, MATCHING, REORDERING
// Har birini boshqarish uchun kichik sub-form. Umumiy fieldlar (prompt,
// marks, imageUrl) — yuqorida.
//
// Matn maydonlari ko'p tilli (I18nText): testda qaysi tillar tanlangan bo'lsa,
// o'shalar to'ldiriladi. Id'lar, ball, `correct`, `correctIndex` va
// `correctChoiceIds` ATAYLAB tillanmaydi — baholash aynan shularga tayanadi
// (backend'da 6 turdan 5 tasi id bo'yicha solishtiradi).
//
// DIQQAT: bu tiplar backend zod sxemasidan (backend/src/lib/schemas.ts)
// import qilinmagan, qo'lda takrorlangan. Shakl o'zgarsa IKKALA joyda ham
// o'zgartirilishi shart, aks holda admin jimgina backend'dan uzoqlashadi.

import { useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import { I18nField, type I18nText, type Lang, resolveText, toI18n } from "@/components/I18nField";

export type QType =
  | "MULTIPLE_CHOICE"
  | "MULTIPLE_SELECT"
  | "TRUE_FALSE"
  | "FILL_GAP"
  | "MATCHING"
  | "REORDERING";

export interface Choice { id: string; label: I18nText; imageUrl?: string | null }
export interface TFItem { id: string; text: I18nText; correct: boolean }
export interface MatchPair { leftId: string; leftText: I18nText; rightId: string; rightText: I18nText }
export interface ReorderItem { id: string; text: I18nText; correctIndex: number }

export interface TestQuestion {
  id: string;
  /**
   * Shablonning qaysi savoliga tegishli — "Shablondan import" qo'yadi.
   *
   * Bor bo'lsa: ball shablondan keladi va TAHRIRLANMAYDI, hisobotdagi mavzu
   * tahlili ham shu bog'lanish orqali topiladi (indeks bo'yicha emas).
   */
  templateQuestionId?: string;
  order: number;
  type: QType;
  marks: number;
  prompt: I18nText;
  imageUrl?: string | null;
  choices?: Choice[];
  correctChoiceIds?: string[];
  trueFalseItems?: TFItem[];
  // Massiv uzunligi = bo'shliqlar soni; til bo'yicha o'zgarmaydi.
  gapAnswers?: I18nText[];
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
    prompt: {},
  };
  return applyTypeDefaults(base, type);
}

/**
 * Shablon savolidan test savoli.
 *
 * Ball va bog'lanish HAR DOIM shablondan: ball tahrirlanmaydi, aks holda
 * testdagi ball bilan hisobotdagi ball bir-biriga mos kelmasdi.
 *
 * Shablonda savol MAZMUNI ham bo'lishi mumkin (matn, variantlar) — u ham
 * ko'chiriladi. Eski shablonlarda bu qism yo'q, o'shanda bo'sh blanka
 * qaytadi va admin matnni o'zi yozadi.
 */
export function makeQuestionFromTemplate(
  tq: TemplateSource,
  order: number,
  fallbackType: QType = "MULTIPLE_CHOICE",
): TestQuestion {
  const marks = Math.max(1, Number(tq.marks) || 1);
  const hasContent = !!tq.prompt || !!tq.choices || !!tq.trueFalseItems || !!tq.gapAnswers
    || !!tq.matchingPairs || !!tq.reorderItems;

  if (!hasContent) {
    const base: TestQuestion = {
      id: uid(), templateQuestionId: tq.id, order, type: fallbackType, marks, prompt: {},
    };
    return applyTypeDefaults(base, fallbackType);
  }

  // Mazmun bor — o'shani olamiz. `applyTypeDefaults` ATAYLAB chaqirilmaydi:
  // u tur bo'yicha bo'sh sukut qiymatlarini qo'yib, kelgan mazmunni bosib
  // ketishi mumkin.
  return {
    id: uid(),
    templateQuestionId: tq.id,
    order,
    type: (tq.type as QType) ?? fallbackType,
    marks,
    prompt: (tq.prompt as I18nText) ?? {},
    imageUrl: tq.imageUrl ?? null,
    ...(tq.choices ? { choices: tq.choices as Choice[] } : {}),
    ...(tq.correctChoiceIds ? { correctChoiceIds: tq.correctChoiceIds } : {}),
    ...(tq.trueFalseItems ? { trueFalseItems: tq.trueFalseItems as TFItem[] } : {}),
    ...(tq.gapAnswers ? { gapAnswers: tq.gapAnswers as I18nText[] } : {}),
    ...(tq.matchingPairs ? { matchingPairs: tq.matchingPairs as MatchPair[] } : {}),
    ...(tq.reorderItems ? { reorderItems: tq.reorderItems as ReorderItem[] } : {}),
  };
}

/** Shablon savoli — pedagogika + ixtiyoriy mazmun. */
export interface TemplateSource {
  id: string;
  marks?: number;
  topic?: string;
  type?: string;
  prompt?: unknown;
  imageUrl?: string | null;
  choices?: unknown[];
  correctChoiceIds?: string[];
  trueFalseItems?: unknown[];
  gapAnswers?: unknown[];
  matchingPairs?: unknown[];
  reorderItems?: unknown[];
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
        { id: uid(), label: {} },
        { id: uid(), label: {} },
        { id: uid(), label: {} },
        { id: uid(), label: {} },
      ];
      next.correctChoiceIds = [];
      break;
    case "TRUE_FALSE":
      next.trueFalseItems = [
        { id: uid(), text: {}, correct: true },
        { id: uid(), text: {}, correct: false },
        { id: uid(), text: {}, correct: true },
      ];
      break;
    case "FILL_GAP":
      next.gapAnswers = [{}];
      break;
    case "MATCHING":
      next.matchingPairs = [
        { leftId: uid(), leftText: {}, rightId: uid(), rightText: {} },
        { leftId: uid(), leftText: {}, rightId: uid(), rightText: {} },
      ];
      break;
    case "REORDERING":
      next.reorderItems = [
        { id: uid(), text: {}, correctIndex: 0 },
        { id: uid(), text: {}, correctIndex: 1 },
      ];
      break;
  }
  return next;
}

/** Savoldagi barcha matn maydonlari (til-neytral maydonlar kirmaydi). */
export function questionTextFields(q: TestQuestion): (I18nText | string | undefined)[] {
  return [
    q.prompt,
    ...(q.choices ?? []).map((c) => c.label),
    ...(q.trueFalseItems ?? []).map((t) => t.text),
    ...(q.gapAnswers ?? []),
    ...(q.matchingPairs ?? []).flatMap((p) => [p.leftText, p.rightText]),
    ...(q.reorderItems ?? []).map((r) => r.text),
  ];
}

export type QStatus = "empty" | "partial" | "complete";

/**
 * Savolning to'ldirilganlik holati — accordion ro'yxatidagi belgi shunga
 * tayanadi. "complete" faqat matn emas, javob kaliti ham bo'lsa: to'g'ri
 * javobi belgilanmagan savol o'quvchi uchun yaroqsiz, lekin backend uni
 * bemalol saqlaydi (correctChoiceIds ixtiyoriy).
 */
export function questionStatus(q: TestQuestion, languages: Lang[]): QStatus {
  const fields = questionTextFields(q);
  const filled = (v: I18nText | string | undefined) => {
    const t = toI18n(v);
    if (t.same) return (t.UZ ?? "").trim() !== "";
    return languages.length > 0 && languages.every((l) => (t[l] ?? "").trim() !== "");
  };
  const anyText = fields.some((f) => {
    const t = toI18n(f);
    return (["UZ", "RU", "EN"] as const).some((l) => (t[l] ?? "").trim() !== "");
  });
  if (!anyText) return "empty";

  const allText = fields.every(filled);
  let keyOk = true;
  if (q.type === "MULTIPLE_CHOICE") keyOk = (q.correctChoiceIds ?? []).length === 1;
  if (q.type === "MULTIPLE_SELECT") keyOk = (q.correctChoiceIds ?? []).length > 0;
  return allText && keyOk ? "complete" : "partial";
}

/** Ro'yxatdagi qisqa ko'rinish uchun — birinchi topilgan matn. */
export function questionPreview(q: TestQuestion, languages: Lang[]): string {
  const t = toI18n(q.prompt);
  const first = t.same ? t.UZ : (languages.map((l) => t[l]).find((s) => s && s.trim()) ?? t.UZ);
  return (first ?? "").trim();
}

// ---- Umumiy qatorlar uchun kichik bo'laklar ---------------------------
// Barcha savol turlari bir xil ko'rinsin: qator konteyneri, chap tarafda
// belgi, o'ngda ikonka tugmalar.

/** Qator qobig'i — hover va bir xil bo'shliqlar. */
function Row({ children, tinted = false }: { children: React.ReactNode; tinted?: boolean }) {
  return (
    <div
      className={`group flex items-start gap-2 rounded-md border p-2 transition ${
        tinted ? "border-emerald-300 bg-emerald-50/60" : "border-transparent hover:bg-gray-50"
      }`}
    >
      {children}
    </div>
  );
}

/** Chapdagi doiraviy belgi (harf yoki raqam). */
function RowBadge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "good" }) {
  return (
    <span
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border flex-shrink-0 mt-0.5 ${
        tone === "good"
          ? "bg-emerald-500 border-emerald-500 text-white"
          : "bg-white border-gray-300 text-gray-400"
      }`}
    >
      {children}
    </span>
  );
}

/** "+ ... qo'shish" — savol rasmi tugmasi bilan bir xil punktir uslub. */
function AddRowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-navy border border-dashed rounded-md px-3 py-1.5 transition hover:border-navy w-fit"
    >
      <Icon name="plus" size={14} />
      {children}
    </button>
  );
}

/** Tartibni surish uchun kichik tugma (Icon to'plamida strelka yo'q). */
function MoveButton({ dir, onClick, disabled }: { dir: "up" | "down"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={dir === "up" ? "Yuqoriga" : "Pastga"}
      className="w-5 h-5 rounded text-gray-400 hover:bg-gray-100 hover:text-navy disabled:opacity-30 disabled:hover:bg-transparent text-[10px] leading-none transition"
    >
      {dir === "up" ? "▲" : "▼"}
    </button>
  );
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
  languages,
}: {
  q: TestQuestion;
  onChange: (next: TestQuestion) => void;
  onRemove: () => void;
  /** Testda tanlangan tillar — faqat shular to'ldiriladi. */
  languages: Lang[];
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
            disabled={!!q.templateQuestionId}
            className="border rounded px-2 py-1 text-sm w-16 disabled:bg-gray-100 disabled:text-gray-500"
            title={q.templateQuestionId ? "Ball shablondan olingan — o'zgartirib bo'lmaydi" : "Ball"}
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

      <I18nField
        label="Savol matni (LaTeX: $x^2$, $\sqrt{2}$)"
        value={q.prompt}
        onChange={(v) => upd({ prompt: v })}
        languages={languages}
        multiline
        placeholder="Savolni yozing. Formula uchun $...$ ishlatiladi."
      />

      {/* Savol rasmi. Haqiqiy imtihonlarda diagramma/chizma savollari bor
          ("Vizual qonuniyat", "Diagramma tahlili"), ya'ni bu kamdan-kam
          emas. Rasm bo'lmasa — bitta ixcham tugma; bo'lsa — ko'rinishi
          ustida almashtirish/o'chirish. */}
      {q.imageUrl ? (
        <div className="flex items-start gap-2">
          <img src={q.imageUrl} alt="" className="h-20 rounded border" />
          <div className="flex flex-col gap-0.5">
            <label
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-navy cursor-pointer transition"
              title="Rasmni almashtirish"
            >
              <Icon name="refresh" size={16} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try { upd({ imageUrl: await uploadImage(f) }); }
                  catch (err) { alert(err instanceof Error ? err.message : "Xato"); }
                }}
              />
            </label>
            <IconButton
              icon="delete"
              label="Rasmni o'chirish"
              variant="danger"
              onClick={() => upd({ imageUrl: null })}
            />
          </div>
        </div>
      ) : (
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-navy border border-dashed rounded-md px-3 py-1.5 cursor-pointer transition hover:border-navy w-fit">
          <Icon name="upload" size={14} />
          Rasm qo'shish
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try { upd({ imageUrl: await uploadImage(f) }); }
              catch (err) { alert(err instanceof Error ? err.message : "Xato"); }
            }}
          />
        </label>
      )}

      {(q.type === "MULTIPLE_CHOICE" || q.type === "MULTIPLE_SELECT") && (
        <ChoiceEditor q={q} onChange={onChange} multi={q.type === "MULTIPLE_SELECT"} languages={languages} />
      )}
      {q.type === "TRUE_FALSE" && <TrueFalseEditor q={q} onChange={onChange} languages={languages} />}
      {q.type === "FILL_GAP" && <FillGapEditor q={q} onChange={onChange} languages={languages} />}
      {q.type === "MATCHING" && <MatchingEditor q={q} onChange={onChange} languages={languages} />}
      {q.type === "REORDERING" && <ReorderEditor q={q} onChange={onChange} languages={languages} />}
    </div>
  );
}

function ChoiceEditor({ q, onChange, multi, languages }: { q: TestQuestion; onChange: (n: TestQuestion) => void; multi: boolean; languages: Lang[] }) {
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
      {choices.map((c, i) => {
        const selected = correct.has(c.id);
        const setChoice = (patch: Partial<Choice>) => {
          const next = [...choices];
          next[i] = { ...c, ...patch };
          onChange({ ...q, choices: next });
        };
        return (
          // Tanlangan variant butun qatori bilan ajralib tursin — ilgari
          // faqat kichkina radio nuqtasi bor edi va qaysi javob to'g'ri
          // ekanini bir qarashda ko'rib bo'lmasdi.
          <Row key={c.id} tinted={selected}>
            {/* Harf belgisi = to'g'ri javob tanlagichi. Native input saqlanadi
                (klaviatura va screen reader uchun), lekin ko'rinmaydi. */}
            <label
              className="cursor-pointer mt-0.5 flex-shrink-0"
              title={multi ? "To'g'ri javoblardan biri deb belgilash" : "To'g'ri javob deb belgilash"}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`correct-${q.id}`}
                checked={selected}
                onChange={() => toggle(c.id)}
                className="sr-only peer"
              />
              <span
                className={`w-7 h-7 flex items-center justify-center text-xs font-semibold border transition peer-focus-visible:ring-2 peer-focus-visible:ring-navy ${
                  multi ? "rounded" : "rounded-full"
                } ${
                  selected
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-white border-gray-300 text-gray-400 group-hover:border-gray-400"
                }`}
              >
                {selected ? <Icon name="check" size={14} /> : String.fromCharCode(65 + i)}
              </span>
            </label>

            <div className="flex-1 min-w-0">
              <I18nField
                value={c.label}
                onChange={(v) => setChoice({ label: v })}
                languages={languages}
                placeholder={`Variant ${String.fromCharCode(65 + i)}`}
              />
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              {c.imageUrl && (
                <span className="relative">
                  <img src={c.imageUrl} alt="" className="h-8 w-8 object-cover rounded border" />
                  <button
                    type="button"
                    onClick={() => setChoice({ imageUrl: null })}
                    title="Rasmni o'chirish"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border text-gray-400 hover:text-bad flex items-center justify-center text-[9px] leading-none"
                  >
                    ✕
                  </button>
                </span>
              )}
              <label
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:bg-gray-100 hover:text-navy cursor-pointer transition"
                title={c.imageUrl ? "Rasmni almashtirish" : "Variantga rasm qo'shish"}
              >
                <Icon name="upload" size={16} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    // Inputni tozalaymiz, aks holda bir xil faylni ikkinchi
                    // marta tanlaganda `change` umuman ishlamaydi.
                    e.target.value = "";
                    if (!f) return;
                    try {
                      setChoice({ imageUrl: await uploadImage(f) });
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Xato");
                    }
                  }}
                />
              </label>
              <IconButton
                icon="delete"
                label="Variantni o'chirish"
                variant="danger"
                onClick={() => onChange({ ...q, choices: choices.filter((x) => x.id !== c.id) })}
              />
            </div>
          </Row>
        );
      })}
      <AddRowButton onClick={() => onChange({ ...q, choices: [...choices, { id: uid(), label: {} }] })}>
        Variant qo'shish
      </AddRowButton>
    </div>
  );
}

function TrueFalseEditor({ q, onChange, languages }: { q: TestQuestion; onChange: (n: TestQuestion) => void; languages: Lang[] }) {
  const items = q.trueFalseItems ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Bir necha to'g'ri/noto'g'ri iborani kiriting. O'quvchi HAMMA iborani to'g'ri belgilagandagina savolni bergan hisoblanadi.
      </div>
      {items.map((it, i) => {
        const set = (patch: Partial<TFItem>) => {
          const next = [...items];
          next[i] = { ...it, ...patch };
          onChange({ ...q, trueFalseItems: next });
        };
        return (
          <Row key={it.id} tinted={it.correct}>
            {/* Ilgari bu <select> edi — javob kaliti oddiy maydonga o'xshab
                ko'rinardi. Segment tugma to'g'ri/noto'g'ri ekanini bir
                qarashda ko'rsatadi. */}
            <div className="flex rounded-md border overflow-hidden text-xs flex-shrink-0 mt-0.5">
              <button
                type="button"
                onClick={() => set({ correct: true })}
                className={`px-2 py-1 transition ${
                  it.correct ? "bg-emerald-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                To'g'ri
              </button>
              <button
                type="button"
                onClick={() => set({ correct: false })}
                className={`px-2 py-1 border-l transition ${
                  !it.correct ? "bg-bad text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                Noto'g'ri
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <I18nField
                value={it.text}
                onChange={(v) => set({ text: v })}
                languages={languages}
                placeholder="Ibora matni"
              />
            </div>
            <IconButton
              icon="delete"
              label="Iborani o'chirish"
              variant="danger"
              onClick={() => onChange({ ...q, trueFalseItems: items.filter((x) => x.id !== it.id) })}
            />
          </Row>
        );
      })}
      <AddRowButton onClick={() => onChange({ ...q, trueFalseItems: [...items, { id: uid(), text: {}, correct: true }] })}>
        Ibora qo'shish
      </AddRowButton>
    </div>
  );
}

function FillGapEditor({ q, onChange, languages }: { q: TestQuestion; onChange: (n: TestQuestion) => void; languages: Lang[] }) {
  const answers = q.gapAnswers ?? [{}];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Savol matnida bo'sh joyni <code className="bg-gray-100 px-1">___</code> bilan belgilang. Har bir bo'sh joy uchun mos javobni tartib bo'yicha kiriting.
      </div>
      {answers.map((a, i) => (
        <Row key={i}>
          <RowBadge>{i + 1}</RowBadge>
          <div className="flex-1 min-w-0">
            <I18nField
              value={a}
              onChange={(v) => {
                const next = [...answers];
                next[i] = v;
                onChange({ ...q, gapAnswers: next });
              }}
              languages={languages}
              placeholder={`${i + 1}-bo'shliq uchun to'g'ri javob`}
            />
          </div>
          <IconButton
            icon="delete"
            label="Bo'shliqni o'chirish"
            variant="danger"
            disabled={answers.length === 1}
            onClick={() => onChange({ ...q, gapAnswers: answers.filter((_, idx) => idx !== i) })}
          />
        </Row>
      ))}
      <AddRowButton onClick={() => onChange({ ...q, gapAnswers: [...answers, {}] })}>
        Bo'shliq qo'shish
      </AddRowButton>
    </div>
  );
}

function MatchingEditor({ q, onChange, languages }: { q: TestQuestion; onChange: (n: TestQuestion) => void; languages: Lang[] }) {
  const pairs = q.matchingPairs ?? [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Chap ustundagi har bir elementga o'ng ustunda mos javobni belgilang.
      </div>
      {pairs.map((p, i) => {
        const set = (patch: Partial<MatchPair>) => {
          const next = [...pairs];
          next[i] = { ...p, ...patch };
          onChange({ ...q, matchingPairs: next });
        };
        return (
          <Row key={p.leftId}>
            <RowBadge>{i + 1}</RowBadge>
            <div className="flex-1 min-w-0">
              <I18nField
                value={p.leftText}
                onChange={(v) => set({ leftText: v })}
                languages={languages}
                placeholder="Chap: element"
              />
            </div>
            <span className="text-gray-300 mt-2 flex-shrink-0">→</span>
            <div className="flex-1 min-w-0">
              <I18nField
                value={p.rightText}
                onChange={(v) => set({ rightText: v })}
                languages={languages}
                placeholder="O'ng: mos javob"
              />
            </div>
            <IconButton
              icon="delete"
              label="Juftlikni o'chirish"
              variant="danger"
              onClick={() => onChange({ ...q, matchingPairs: pairs.filter((_, idx) => idx !== i) })}
            />
          </Row>
        );
      })}
      <AddRowButton
        onClick={() =>
          onChange({ ...q, matchingPairs: [...pairs, { leftId: uid(), leftText: {}, rightId: uid(), rightText: {} }] })
        }
      >
        Juftlik qo'shish
      </AddRowButton>
    </div>
  );
}

function ReorderEditor({ q, onChange, languages }: { q: TestQuestion; onChange: (n: TestQuestion) => void; languages: Lang[] }) {
  const items = q.reorderItems ?? [];
  const sorted = [...items].sort((a, b) => a.correctIndex - b.correctIndex);
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Elementlarni to'g'ri tartibda kiriting (yuqoridan pastga). Bola ularni aralashtirilgan holda ko'radi.
      </div>
      {sorted.map((it, i) => {
        // Tartibni almashtirish. Ilgari bu umuman yo'q edi: elementlar
        // correctIndex bo'yicha saralanardi, lekin uni o'zgartirish uchun
        // hech qanday tugma yo'q edi — noto'g'ri tartibda kiritilsa,
        // hammasini o'chirib qayta yozishdan boshqa iloj qolmasdi.
        const swap = (j: number) => {
          const arr = [...sorted];
          const tmp = arr[i]!;
          arr[i] = arr[j]!;
          arr[j] = tmp;
          onChange({ ...q, reorderItems: arr.map((x, idx) => ({ ...x, correctIndex: idx })) });
        };
        return (
          <Row key={it.id}>
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-0.5">
              <MoveButton dir="up" disabled={i === 0} onClick={() => swap(i - 1)} />
              <RowBadge>{i + 1}</RowBadge>
              <MoveButton dir="down" disabled={i === sorted.length - 1} onClick={() => swap(i + 1)} />
            </div>
            <div className="flex-1 min-w-0">
              <I18nField
                value={it.text}
                onChange={(v) => {
                  const next = items.map((x) => (x.id === it.id ? { ...x, text: v } : x));
                  onChange({ ...q, reorderItems: next });
                }}
                languages={languages}
                placeholder="Element matni"
              />
            </div>
            <IconButton
              icon="delete"
              label="Elementni o'chirish"
              variant="danger"
              onClick={() => {
                const rest = items
                  .filter((x) => x.id !== it.id)
                  .sort((a, b) => a.correctIndex - b.correctIndex)
                  .map((x, idx) => ({ ...x, correctIndex: idx }));
                onChange({ ...q, reorderItems: rest });
              }}
            />
          </Row>
        );
      })}
      <AddRowButton
        onClick={() => onChange({ ...q, reorderItems: [...items, { id: uid(), text: {}, correctIndex: items.length }] })}
      >
        Element qo'shish
      </AddRowButton>
    </div>
  );
}
