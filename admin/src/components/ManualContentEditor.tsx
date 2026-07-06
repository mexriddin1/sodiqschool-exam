"use client";

import { ReactNode, useState } from "react";
import { Icon } from "./Icon";

export type SubjectKey = "math" | "english" | "criticalThinking";
const SUBJECTS: { key: SubjectKey; label: string }[] = [
  { key: "math", label: "Matematika" },
  { key: "english", label: "Ingliz tili" },
  { key: "criticalThinking", label: "Tanqidiy fikrlash" },
];

export interface Cohort {
  rank: number | null;
  total: number | null;
  percentile: number | null;
  maleRank: number | null;
  maleTotal: number | null;
  femaleRank: number | null;
  femaleTotal: number | null;
}

export interface GlossaryEntry { t: string; d: string }
export interface Glossary {
  skillHelp: GlossaryEntry[];
  bloomHelp: GlossaryEntry[];
  reasonHelp: GlossaryEntry[];
}

export interface SubjectOverrides {
  strength: string;
  growthLabel: string;
  cohort: Cohort;
  bloomFallback: Record<string, number>;
  skillRadar: { name: string; value: number }[];
  reasoningTypes: { name: string; gloss?: string; value: number }[];
  gradeLevelFallback: Record<string, number>;
  glossary: Glossary;
  narrative: {
    coverTitle: string;
    coverSubtitle: string;
    story: string[]; // §1 paragraphs as raw strings
  };
}

export type VerdictLabel =
  | "QABUL TAVSIYA ETILADI"
  | "QABUL QILINSIN"
  | "SHARTLI QABUL"
  | "ZAXIRA QABUL"
  | "TAYYOR EMAS"
  // Legacy English labels — retained for older saved manualContent so their
  // overrides still validate through Zod. Any new selection uses the Uzbek set.
  | "STRONG ADMIT"
  | "ADMIT"
  | "CONDITIONAL ADMIT"
  | "WAITLIST"
  | "NOT YET READY";

export interface VerdictOverride {
  label: VerdictLabel;
  sub: string;
}

export interface Summary {
  overallRank: number | null;
  overallTotal: number | null;
  overallPct: number | null;
  crossStrength: string;
  gradeLabel: string;
  verdictOverride: VerdictOverride | null;
}

export interface ManualContent {
  parent: string;
  committee: string;
  outlook: string;
  math: SubjectOverrides;
  english: SubjectOverrides;
  criticalThinking: SubjectOverrides;
  summary: Summary;
}

const blankCohort: Cohort = { rank: null, total: null, percentile: null, maleRank: null, maleTotal: null, femaleRank: null, femaleTotal: null };
const blankSubj: SubjectOverrides = {
  strength: "",
  growthLabel: "",
  cohort: blankCohort,
  bloomFallback: {},
  skillRadar: [],
  reasoningTypes: [],
  gradeLevelFallback: {},
  glossary: { skillHelp: [], bloomHelp: [], reasonHelp: [] },
  narrative: { coverTitle: "", coverSubtitle: "", story: [] },
};
export const EMPTY_MANUAL: ManualContent = {
  parent: "",
  committee: "",
  outlook: "",
  math: blankSubj,
  english: blankSubj,
  criticalThinking: blankSubj,
  summary: {
    overallRank: null,
    overallTotal: null,
    overallPct: null,
    crossStrength: "",
    gradeLabel: "",
    verdictOverride: null,
  },
};

const BLOOM_KEYS = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];

export function fromApi(raw: unknown): ManualContent {
  const r = (raw ?? {}) as Partial<ManualContent>;
  const pickSubj = (s: Partial<SubjectOverrides> | undefined): SubjectOverrides => ({
    strength: s?.strength ?? "",
    growthLabel: s?.growthLabel ?? "",
    cohort: { ...blankCohort, ...(s?.cohort ?? {}) },
    bloomFallback: s?.bloomFallback ?? {},
    skillRadar: s?.skillRadar ?? [],
    reasoningTypes: s?.reasoningTypes ?? [],
    gradeLevelFallback: s?.gradeLevelFallback ?? {},
    glossary: {
      skillHelp: s?.glossary?.skillHelp ?? [],
      bloomHelp: s?.glossary?.bloomHelp ?? [],
      reasonHelp: s?.glossary?.reasonHelp ?? [],
    },
    narrative: {
      coverTitle: s?.narrative?.coverTitle ?? "",
      coverSubtitle: s?.narrative?.coverSubtitle ?? "",
      story: s?.narrative?.story ?? [],
    },
  });
  return {
    parent: r.parent ?? "",
    committee: r.committee ?? "",
    outlook: r.outlook ?? "",
    math: pickSubj(r.math),
    english: pickSubj(r.english),
    criticalThinking: pickSubj(r.criticalThinking),
    summary: {
      overallRank: r.summary?.overallRank ?? null,
      overallTotal: r.summary?.overallTotal ?? null,
      overallPct: r.summary?.overallPct ?? null,
      crossStrength: r.summary?.crossStrength ?? "",
      gradeLabel: r.summary?.gradeLabel ?? "",
      verdictOverride: r.summary?.verdictOverride ?? null,
    },
  };
}

// Strip empty objects/arrays/strings/nulls before sending — keeps the payload
// tidy and lets the client distinguish "unset" from "empty override".
export function toApi(mc: ManualContent): Record<string, unknown> {
  const stripCohort = (c: Cohort): Cohort | undefined => {
    const out: Cohort = { ...c };
    let any = false;
    for (const k of ["rank", "total", "percentile", "maleRank", "maleTotal", "femaleRank", "femaleTotal"] as const) {
      if (out[k] != null) any = true;
    }
    return any ? out : undefined;
  };
  const stripSubj = (s: SubjectOverrides): Record<string, unknown> | undefined => {
    const out: Record<string, unknown> = {};
    if (s.strength.trim()) out.strength = s.strength.trim();
    if (s.growthLabel.trim()) out.growthLabel = s.growthLabel.trim();
    const c = stripCohort(s.cohort);
    if (c) out.cohort = c;
    if (Object.keys(s.bloomFallback).length) out.bloomFallback = s.bloomFallback;
    if (s.skillRadar.length) out.skillRadar = s.skillRadar.filter((x) => x.name && x.value > 0);
    if (s.reasoningTypes.length) out.reasoningTypes = s.reasoningTypes.filter((x) => x.name && x.value > 0);
    if (Object.keys(s.gradeLevelFallback).length) out.gradeLevelFallback = s.gradeLevelFallback;
    const gloss: Record<string, GlossaryEntry[]> = {};
    if (s.glossary.skillHelp.length) gloss.skillHelp = s.glossary.skillHelp.filter((x) => x.t);
    if (s.glossary.bloomHelp.length) gloss.bloomHelp = s.glossary.bloomHelp.filter((x) => x.t);
    if (s.glossary.reasonHelp.length) gloss.reasonHelp = s.glossary.reasonHelp.filter((x) => x.t);
    if (Object.keys(gloss).length) out.glossary = gloss;
    const nar: Record<string, unknown> = {};
    if (s.narrative.coverTitle.trim()) nar.coverTitle = s.narrative.coverTitle.trim();
    if (s.narrative.coverSubtitle.trim()) nar.coverSubtitle = s.narrative.coverSubtitle.trim();
    const story = s.narrative.story.filter((p) => p.trim());
    if (story.length) nar.story = story;
    if (Object.keys(nar).length) out.narrative = nar;
    return Object.keys(out).length ? out : undefined;
  };
  const out: Record<string, unknown> = {};
  if (mc.parent.trim()) out.parent = mc.parent.trim();
  if (mc.committee.trim()) out.committee = mc.committee.trim();
  if (mc.outlook.trim()) out.outlook = mc.outlook.trim();
  const m = stripSubj(mc.math);
  if (m) out.math = m;
  const e = stripSubj(mc.english);
  if (e) out.english = e;
  const c = stripSubj(mc.criticalThinking);
  if (c) out.criticalThinking = c;
  const sumOut: Record<string, unknown> = {};
  if (mc.summary.overallRank != null) sumOut.overallRank = mc.summary.overallRank;
  if (mc.summary.overallTotal != null) sumOut.overallTotal = mc.summary.overallTotal;
  if (mc.summary.overallPct != null) sumOut.overallPct = mc.summary.overallPct;
  if (mc.summary.crossStrength.trim()) sumOut.crossStrength = mc.summary.crossStrength.trim();
  if (mc.summary.gradeLabel.trim()) sumOut.gradeLabel = mc.summary.gradeLabel.trim();
  if (mc.summary.verdictOverride) {
    sumOut.verdictOverride = {
      label: mc.summary.verdictOverride.label,
      ...(mc.summary.verdictOverride.sub.trim() && { sub: mc.summary.verdictOverride.sub.trim() }),
    };
  }
  if (Object.keys(sumOut).length) out.summary = sumOut;
  return out;
}

function nullableNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Section({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 text-left flex items-center justify-between border-b hover:bg-gray-50">
        <span className="font-medium">{title}</span>
        <span className="text-gray-400"><Icon name={open ? "chevronUp" : "chevronDown"} size={16} /></span>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

const COHORT_LABELS: Record<keyof Cohort, string> = {
  rank: "O'rin (jami)", total: "Jami (o'g'il+qiz)", percentile: "Persentil",
  maleRank: "O'g'il o'rin", maleTotal: "O'g'il jami",
  femaleRank: "Qiz o'rin", femaleTotal: "Qiz jami",
};

function CohortInputs({ value, onChange }: { value: Cohort; onChange: (c: Cohort) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {(["rank", "total", "percentile", "maleRank", "maleTotal", "femaleRank", "femaleTotal"] as const).map((k) => (
        <div key={k}>
          <label className="label">{COHORT_LABELS[k]}</label>
          <input
            type="number" min={0}
            className="input"
            value={value[k] ?? ""}
            onChange={(e) => onChange({ ...value, [k]: nullableNum(e.target.value) })}
          />
        </div>
      ))}
    </div>
  );
}

function BloomFallbackInputs({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BLOOM_KEYS.map((k) => (
        <div key={k}>
          <label className="label">{k}</label>
          <input
            type="number" min={0} max={100}
            className="input"
            placeholder="—"
            value={value[k] ?? ""}
            onChange={(e) => {
              const next = { ...value };
              const n = nullableNum(e.target.value);
              if (n == null) delete next[k]; else next[k] = n;
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function PairListEditor({
  label, items, onChange, withGloss,
}: {
  label: string;
  items: { name: string; value: number; gloss?: string }[];
  onChange: (next: { name: string; value: number; gloss?: string }[]) => void;
  withGloss?: boolean;
}) {
  function setAt(i: number, patch: Partial<{ name: string; value: number; gloss?: string }>) {
    const next = [...items];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-gray-500">{label}</span>
        <button type="button" className="text-xs text-navy hover:underline inline-flex items-center gap-1"
          onClick={() => onChange([...items, { name: "", value: 0, ...(withGloss && { gloss: "" }) }])}>
          <Icon name="plus" size={12} /> qator
        </button>
      </div>
      {items.length === 0 && <div className="text-xs text-gray-400">Bo'sh — fallback shipped default ishlatiladi</div>}
      {items.map((it, i) => (
        <div key={i} className={`grid gap-2 ${withGloss ? "grid-cols-7" : "grid-cols-6"}`}>
          <input
            className={`input ${withGloss ? "col-span-3" : "col-span-4"}`}
            placeholder="nomi" value={it.name}
            onChange={(e) => setAt(i, { name: e.target.value })}
          />
          {withGloss && (
            <input
              className="input col-span-2"
              placeholder="izoh" value={it.gloss ?? ""}
              onChange={(e) => setAt(i, { gloss: e.target.value })}
            />
          )}
          <input
            type="number" min={0} max={100}
            className="input col-span-1"
            placeholder="%" value={it.value}
            onChange={(e) => setAt(i, { value: Number(e.target.value) })}
          />
          <button type="button" className="text-bad hover:underline text-xs col-span-1 inline-flex items-center justify-center"
            onClick={() => onChange(items.filter((_, k) => k !== i))} title="O'chirish" aria-label="O'chirish">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function GradeLevelFallbackInputs({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">English uchun: A1 = 94, A2 = 75 — savol guruh sifatida o'lchanmaganda fallback ishlatiladi.</div>
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <input className="input" value={k} disabled />
          <input type="number" min={0} max={100} className="input w-32" value={v}
            onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} />
          <button type="button" className="text-bad hover:underline text-xs"
            onClick={() => {
              const next = { ...value };
              delete next[k];
              onChange(next);
            }}>o'chirish</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input className="input w-32" placeholder="A1 / A2 …" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <input type="number" min={0} max={100} className="input w-32" placeholder="%" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
        <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1"
          onClick={() => {
            if (newKey.trim() && newVal.trim()) {
              onChange({ ...value, [newKey.trim()]: Number(newVal) });
              setNewKey(""); setNewVal("");
            }
          }}><Icon name="plus" size={12} /> qo'shish</button>
      </div>
    </div>
  );
}

function GlossaryListEditor({ label, items, onChange }: { label: string; items: GlossaryEntry[]; onChange: (next: GlossaryEntry[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-gray-500">{label}</span>
        <button type="button" className="text-xs text-navy hover:underline inline-flex items-center gap-1"
          onClick={() => onChange([...items, { t: "", d: "" }])}><Icon name="plus" size={12} /> qator</button>
      </div>
      {items.length === 0 && <div className="text-xs text-gray-400">Bo'sh — shipped default ishlatiladi</div>}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <input className="input col-span-3 text-xs" placeholder="atama"
            value={it.t} onChange={(e) => { const n = [...items]; n[i] = { ...n[i]!, t: e.target.value }; onChange(n); }} />
          <input className="input col-span-8 text-xs" placeholder="ta'rif"
            value={it.d} onChange={(e) => { const n = [...items]; n[i] = { ...n[i]!, d: e.target.value }; onChange(n); }} />
          <button type="button" className="text-bad hover:text-bad/80 inline-flex items-center" onClick={() => onChange(items.filter((_, k) => k !== i))} title="O'chirish" aria-label="O'chirish"><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function NarrativeEditor({ value, onChange }: { value: SubjectOverrides["narrative"]; onChange: (n: SubjectOverrides["narrative"]) => void }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="label">Cover sarlavhasi (default: "Akademik diagnostika hisoboti")</label>
        <input className="input" value={value.coverTitle} onChange={(e) => onChange({ ...value, coverTitle: e.target.value })} />
      </div>
      <div>
        <label className="label">Cover subtitle (default ichida {`{subject}`} interpolatsiya)</label>
        <input className="input" value={value.coverSubtitle} onChange={(e) => onChange({ ...value, coverSubtitle: e.target.value })} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label">§1 hikoya paragraflari</label>
          <button type="button" className="text-xs text-navy hover:underline inline-flex items-center gap-1"
            onClick={() => onChange({ ...value, story: [...value.story, ""] })}><Icon name="plus" size={12} /> paragraf</button>
        </div>
        {value.story.length === 0 && <div className="text-xs text-gray-400">Bo'sh — shipped narrative ishlatiladi</div>}
        {value.story.map((p, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <textarea className="input text-xs" rows={3} value={p}
              onChange={(e) => { const n = [...value.story]; n[i] = e.target.value; onChange({ ...value, story: n }); }} />
            <button type="button" className="text-bad hover:text-bad/80 inline-flex items-center" onClick={() => onChange({ ...value, story: value.story.filter((_, k) => k !== i) })} title="O'chirish" aria-label="O'chirish"><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManualContentEditor({ value, onChange, apiBase }: { value: ManualContent; onChange: (mc: ManualContent) => void; apiBase: string }) {
  function patchSubj(key: SubjectKey, patch: Partial<SubjectOverrides>) {
    onChange({ ...value, [key]: { ...value[key], ...patch } });
  }
  function patchSummary(patch: Partial<Summary>) {
    onChange({ ...value, summary: { ...value.summary, ...patch } });
  }
  async function loadTemplate(uiKey: SubjectKey, apiKey: "MATH" | "ENGLISH" | "CRITICAL_THINKING") {
    const r = await fetch(`${apiBase}/api/admin/templates?subject=${apiKey}`, { credentials: "include" });
    const j = await r.json();
    const d = j?.data;
    if (!d) return;
    patchSubj(uiKey, {
      bloomFallback: d.bloomFallback ?? {},
      skillRadar: d.skillRadar ?? [],
      reasoningTypes: d.reasoningTypes ?? [],
      gradeLevelFallback: d.gradeLevelFallback ?? {},
      glossary: {
        skillHelp: d.glossary?.skillHelp ?? [],
        bloomHelp: d.glossary?.bloomHelp ?? [],
        reasonHelp: d.glossary?.reasonHelp ?? [],
      },
    });
  }

  return (
    <div className="space-y-3">
      <Section title="Narrativlar (Result.manualContent)" defaultOpen>
        <div>
          <label className="label">Ota-ona uchun xulosa (§14)</label>
          <textarea className="input" rows={2} value={value.parent} onChange={(e) => onChange({ ...value, parent: e.target.value })} />
        </div>
        <div>
          <label className="label">Komissiya xulosasi (§15)</label>
          <textarea className="input" rows={2} value={value.committee} onChange={(e) => onChange({ ...value, committee: e.target.value })} />
        </div>
        <div>
          <label className="label">Kelajak istiqboli kirish so'zi (§13)</label>
          <textarea className="input" rows={2} value={value.outlook} onChange={(e) => onChange({ ...value, outlook: e.target.value })} />
        </div>
      </Section>

      {SUBJECTS.map((sub) => {
        const apiKey = sub.key === "math" ? "MATH" : sub.key === "english" ? "ENGLISH" : "CRITICAL_THINKING";
        return (
        <Section key={sub.key} title={`${sub.label} — admin override`}>
          <div className="flex justify-end">
            <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5"
              onClick={() => loadTemplate(sub.key, apiKey as "MATH" | "ENGLISH" | "CRITICAL_THINKING")}>
              <Icon name="download" size={14} /> Shablondan yuklash (glossariy + radar + bloom + fallback)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Strength phrase (§1 da)</label>
              <input
                className="input"
                placeholder="masalan: murakkab, mantiqiy masalalar"
                value={value[sub.key].strength}
                onChange={(e) => patchSubj(sub.key, { strength: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Growth label (summary va §1 da)</label>
              <input
                className="input"
                placeholder="masalan: kasr amallari"
                value={value[sub.key].growthLabel}
                onChange={(e) => patchSubj(sub.key, { growthLabel: e.target.value })}
              />
            </div>
          </div>
          <div>
            <div className="label">Reyting (o'rin / jami / persentil / o'g'il / qiz)</div>
            <CohortInputs value={value[sub.key].cohort} onChange={(c) => patchSubj(sub.key, { cohort: c })} />
          </div>
          <div>
            <div className="label">Bloom fallback (lowConfidence guruh uchun)</div>
            <BloomFallbackInputs value={value[sub.key].bloomFallback} onChange={(v) => patchSubj(sub.key, { bloomFallback: v })} />
          </div>
          <PairListEditor
            label="Skill radar override (chap-bo'sh — shipped default ishlatiladi)"
            items={value[sub.key].skillRadar}
            onChange={(items) => patchSubj(sub.key, { skillRadar: items })}
          />
          {sub.key === "math" && (
            <PairListEditor
              label="Reasoning types override (faqat Matematika)"
              items={value[sub.key].reasoningTypes}
              onChange={(items) => patchSubj(sub.key, { reasoningTypes: items })}
              withGloss
            />
          )}
          {sub.key === "english" && (
            <div>
              <div className="label">Grade-level fallback (A1, A2 …)</div>
              <GradeLevelFallbackInputs value={value[sub.key].gradeLevelFallback} onChange={(v) => patchSubj(sub.key, { gradeLevelFallback: v })} />
            </div>
          )}
          <div className="border-t pt-3">
            <div className="font-medium text-sm mb-2">Atamalar lug'ati (info-tugmalar)</div>
            <GlossaryListEditor label="Skill help" items={value[sub.key].glossary.skillHelp}
              onChange={(items) => patchSubj(sub.key, { glossary: { ...value[sub.key].glossary, skillHelp: items } })} />
            <GlossaryListEditor label="Bloom help" items={value[sub.key].glossary.bloomHelp}
              onChange={(items) => patchSubj(sub.key, { glossary: { ...value[sub.key].glossary, bloomHelp: items } })} />
            {sub.key === "math" && (
              <GlossaryListEditor label="Reason help (faqat Matematika)" items={value[sub.key].glossary.reasonHelp}
                onChange={(items) => patchSubj(sub.key, { glossary: { ...value[sub.key].glossary, reasonHelp: items } })} />
            )}
          </div>
          <div className="border-t pt-3">
            <div className="font-medium text-sm mb-2">Cover sarlavhasi va §1 narrative</div>
            <NarrativeEditor value={value[sub.key].narrative}
              onChange={(n) => patchSubj(sub.key, { narrative: n })} />
          </div>
        </Section>
        );
      })}

      <Section title="Umumiy xulosa (summary.astro) override">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Overall rank</label>
            <input type="number" min={0} className="input" value={value.summary.overallRank ?? ""}
              onChange={(e) => patchSummary({ overallRank: nullableNum(e.target.value) })} />
          </div>
          <div>
            <label className="label">Overall total (cohort hajmi)</label>
            <input type="number" min={0} className="input" value={value.summary.overallTotal ?? ""}
              onChange={(e) => patchSummary({ overallTotal: nullableNum(e.target.value) })} />
          </div>
          <div>
            <label className="label">Overall percentile</label>
            <input type="number" min={0} max={100} className="input" value={value.summary.overallPct ?? ""}
              onChange={(e) => patchSummary({ overallPct: nullableNum(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">Cross-strength (3 fan kesimida eng kuchli tomon)</label>
          <input
            className="input"
            placeholder="masalan: mantiqiy va tahliliy fikrlash"
            value={value.summary.crossStrength}
            onChange={(e) => patchSummary({ crossStrength: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Grade label override (default: "{`${"\${grade}-sinfga nomzod · 3 fan"}`}")</label>
          <input
            className="input"
            placeholder="masalan: 5-sinfga nomzod · 3 fan · ~10 yosh"
            value={value.summary.gradeLabel}
            onChange={(e) => patchSummary({ gradeLabel: e.target.value })}
          />
        </div>
        <div className="border-t pt-3">
          <div className="font-medium text-sm mb-2">Qabul qarori — qo'lda o'zgartirish</div>
          <div className="text-xs text-gray-500 mb-2">
            Bo'sh qoldirilsa — jonli statistikadan hisoblangan avtomatik qaror ishlatiladi.
            Bu yerda tanlansangiz — client sahifalarida ushbu qaror ustuvor bo'ladi.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Qaror</label>
              <select
                className="input"
                value={value.summary.verdictOverride?.label ?? ""}
                onChange={(e) => {
                  const label = e.target.value as VerdictLabel | "";
                  if (!label) {
                    patchSummary({ verdictOverride: null });
                  } else {
                    patchSummary({
                      verdictOverride: {
                        label,
                        sub: value.summary.verdictOverride?.sub ?? "",
                      },
                    });
                  }
                }}
              >
                <option value="">— Avtomatik —</option>
                <option value="STRONG ADMIT">STRONG ADMIT (Yuqori daraja)</option>
                <option value="ADMIT">ADMIT (Ishonchli daraja)</option>
                <option value="CONDITIONAL ADMIT">CONDITIONAL ADMIT (Rivojlanayotgan)</option>
                <option value="WAITLIST">WAITLIST (Shakllanayotgan)</option>
                <option value="NOT YET READY">NOT YET READY (Tamal bosqich)</option>
              </select>
            </div>
            <div>
              <label className="label">Tavsif (ixtiyoriy)</label>
              <input
                className="input"
                disabled={!value.summary.verdictOverride}
                placeholder="masalan: qo'shimcha imtihon bilan qabul"
                value={value.summary.verdictOverride?.sub ?? ""}
                onChange={(e) =>
                  patchSummary({
                    verdictOverride: value.summary.verdictOverride
                      ? { ...value.summary.verdictOverride, sub: e.target.value }
                      : null,
                  })
                }
              />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
