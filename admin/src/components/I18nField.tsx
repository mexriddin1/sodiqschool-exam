"use client";

// Ko'p tilli matn maydoni (UZ/RU/EN).
//
// Nega tab, nega uch textarea yonma-yon emas:
// bitta MULTIPLE_CHOICE savolda 5 ta matn maydoni bor (prompt + 4 variant).
// Uch tilda bu 15 ta bo'ladi; 30 savolli testda ≈ 450 ta maydon. Uchalasini
// bir vaqtda ko'rsatish formani ishlatib bo'lmaydigan qiladi — shuning uchun
// bir vaqtda bitta til ko'rinadi.
//
// "Barcha tillarda bir xil" — sof matematik matn uchun. "$x^2+5$" har uchala
// tilda aynan bir xil; uni uch marta qayta terish faqat xato manbai bo'lardi,
// va baholash savol matnini o'qimagani uchun bunday xatoni SEZMAYDI (RU
// tarjimada $x^3$ deb yozilsa, RU o'quvchilar boshqa savolga javob beradi).

import { useState } from "react";

export type Lang = "UZ" | "RU" | "EN";

export interface I18nText {
  same?: boolean;
  UZ?: string;
  RU?: string;
  EN?: string;
}

export const LANG_LABEL: Record<Lang, string> = {
  UZ: "O'zbek",
  RU: "Rus",
  EN: "Ingliz",
};

/** Backend'dagi resolveText bilan bir xil qoida (schemas.ts). */
export function resolveText(v: I18nText | string | undefined | null, lang: Lang): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v.same) return v.UZ ?? "";
  return v[lang] ?? "";
}

/** Eski tekis string ham kelishi mumkin — normallashtiramiz. */
export function toI18n(v: I18nText | string | undefined | null): I18nText {
  if (v == null) return {};
  if (typeof v === "string") return v === "" ? {} : { same: true, UZ: v };
  return v;
}

/** Tanlangan tillarning barchasi to'ldirilganmi? */
export function isI18nComplete(v: I18nText | string | undefined | null, languages: Lang[]): boolean {
  const t = toI18n(v);
  if (t.same) return (t.UZ ?? "").trim() !== "";
  return languages.every((l) => (t[l] ?? "").trim() !== "");
}

/**
 * Savollarda to'ldirilmagan til maydonlarini topadi.
 *
 * `Test.languages` endi "qaysi tillarda mazmuni bor" degani — ya'ni RU
 * tanlangan bo'lsa, RU matni ham bo'lishi SHART. Aks holda RU lead testni
 * ochganda bo'sh savol ko'radi va buni hech kim sezmaydi (backend bo'sh satr
 * qaytaradi, xato bermaydi).
 *
 * Har savol uchun ko'pi bilan bitta xabar — 30 savolli testda 450 ta
 * ogohlantirish foydasiz bo'lardi.
 */
export function findMissingTranslations(
  questions: {
    order: number;
    prompt?: I18nText | string;
    choices?: { label: I18nText | string }[];
    trueFalseItems?: { text: I18nText | string }[];
    // Har bo'shliq — variantlar massivi (yangi) yoki bitta javob (eski).
    gapAnswers?: (I18nText | string | (I18nText | string)[])[];
    matchingPairs?: { leftText: I18nText | string; rightText: I18nText | string }[];
    reorderItems?: { text: I18nText | string }[];
  }[],
  languages: Lang[],
): string[] {
  const out: string[] = [];
  for (const q of questions) {
    const fields: (I18nText | string | undefined)[] = [
      q.prompt,
      ...(q.choices ?? []).map((c) => c.label),
      ...(q.trueFalseItems ?? []).map((t) => t.text),
      // Har bo'shliqning barcha variantlarini tekislaymiz (eski bitta shakl ham).
      ...(q.gapAnswers ?? []).flatMap((g) => (Array.isArray(g) ? g : [g])),
      ...(q.matchingPairs ?? []).flatMap((p) => [p.leftText, p.rightText]),
      ...(q.reorderItems ?? []).map((r) => r.text),
    ];
    const missing = new Set<Lang>();
    for (const f of fields) {
      const t = toI18n(f);
      if (t.same) continue;
      for (const l of languages) if ((t[l] ?? "").trim() === "") missing.add(l);
    }
    if (missing.size > 0) {
      out.push(
        `Savol #${q.order + 1}: ${[...missing].map((l) => LANG_LABEL[l]).join(", ")} to'ldirilmagan`,
      );
    }
  }
  return out;
}

export function I18nField({
  value,
  onChange,
  languages,
  label,
  placeholder,
  multiline = false,
  rows = 2,
}: {
  value: I18nText | string | undefined;
  onChange: (next: I18nText) => void;
  languages: Lang[];
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const v = toI18n(value);
  const same = !!v.same;
  // Faqat testda tanlangan tillar. Til olib tashlansa, tab ham yo'qoladi.
  const tabs = languages.length > 0 ? languages : (["UZ"] as Lang[]);
  const [tab, setTab] = useState<Lang>(tabs[0]!);
  const active = tabs.includes(tab) ? tab : tabs[0]!;

  // `same` holatida matn UZ katagida saqlanadi — resolveText o'shani o'qiydi,
  // tanlangan tillar to'plamidan qat'i nazar.
  const shown = same ? (v.UZ ?? "") : (v[active] ?? "");
  const setShown = (s: string) => onChange(same ? { ...v, same: true, UZ: s } : { ...v, [active]: s });

  const toggleSame = () => {
    if (same) {
      // Ajratamiz: joriy matnni har tilga boshlang'ich qiymat qilib beramiz,
      // shunda admin nolddan yozmaydi.
      const seed = v.UZ ?? "";
      const next: I18nText = {};
      for (const l of tabs) next[l] = seed;
      onChange(next);
    } else {
      // Birlashtiramiz: joriy ko'rinib turgan tilni umumiy matn qilamiz.
      onChange({ same: true, UZ: v[active] ?? v.UZ ?? "" });
    }
  };

  const missing = !same && tabs.filter((l) => (v[l] ?? "").trim() === "");

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {label && <label className="text-xs text-gray-500">{label}</label>}
        <div className="ml-auto flex items-center gap-2">
          {!same && tabs.length > 1 && (
            <div className="flex rounded border overflow-hidden">
              {tabs.map((l) => {
                const filled = (v[l] ?? "").trim() !== "";
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setTab(l)}
                    className={`px-2 py-0.5 text-xs ${
                      l === active ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title={filled ? LANG_LABEL[l] : `${LANG_LABEL[l]} — to'ldirilmagan`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          )}
          <label className="text-[11px] text-gray-500 flex items-center gap-1 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={same} onChange={toggleSame} />
            Barcha tillarda bir xil
          </label>
        </div>
      </div>

      {multiline ? (
        <textarea
          value={shown}
          onChange={(e) => setShown(e.target.value)}
          rows={rows}
          className="w-full border rounded px-3 py-2 text-sm font-mono"
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          value={shown}
          onChange={(e) => setShown(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder={placeholder}
        />
      )}

      {!same && missing && missing.length > 0 && (
        <div className="text-[11px] text-orange-600">
          To'ldirilmagan: {missing.map((l) => LANG_LABEL[l]).join(", ")}
        </div>
      )}
    </div>
  );
}
