"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

interface TechRef { id: string; note: string; }

function normalizeTechRefs(raw: Array<string | { id: string; note?: string }> | undefined): TechRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => typeof r === "string" ? { id: r, note: "" } : { id: r.id, note: r.note ?? "" });
}

// Structured editor: each entry has an ID field and an optional note field.
// Uses internal state so the "+" button can add empty rows without the
// parent filter immediately removing them. Syncs to parent on blur.
function TechErrorRefsCell({ refs: parentRefs, onChange }: { refs: TechRef[]; onChange: (next: TechRef[]) => void }) {
  const [refs, setRefs] = useState<TechRef[]>(parentRefs);

  // Re-sync when parent data changes (e.g. template loaded from picker).
  const parentKey = parentRefs.map((r) => `${r.id}\x00${r.note}`).join("\x01");
  useEffect(() => {
    setRefs(parentRefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentKey]);

  // Push non-empty entries to parent.
  function commit(next: TechRef[]) {
    onChange(next.filter((r) => r.id.trim()));
  }

  function updateRef(i: number, p: Partial<TechRef>) {
    const next = [...refs];
    next[i] = { ...next[i]!, ...p };
    setRefs(next);
    return next;
  }

  return (
    <div className="space-y-1 min-w-[220px]">
      {refs.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            className="input py-1 px-1.5 text-xs w-14 font-mono"
            placeholder="Q7"
            value={r.id}
            onChange={(e) => updateRef(i, { id: e.target.value })}
            onBlur={() => commit(refs)}
          />
          <input
            className="input py-1 px-1.5 text-xs flex-1"
            placeholder="izoh (ixtiyoriy)"
            value={r.note}
            onChange={(e) => updateRef(i, { note: e.target.value })}
            onBlur={() => commit(refs)}
          />
          <button
            type="button"
            onClick={() => {
              const next = refs.filter((_, j) => j !== i);
              setRefs(next);
              commit(next);
            }}
            className="text-bad text-xs hover:bg-bad/10 rounded px-1 py-0.5 flex-shrink-0"
          >✕</button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRefs([...refs, { id: "", note: "" }])}
        className="text-xs text-navy hover:underline"
      >+ qo'shish</button>
    </div>
  );
}

export type Difficulty = "Oson" | "O'rta" | "Qiyin";
export type QResult = "To'g'ri" | "Noto'g'ri" | "Qisman";
export type Bloom = "Eslab qolish" | "Tushunish" | "Qo'llash" | "Tahlil" | "Baholash" | "Yaratish";
export type Reasoning = "Deduktiv" | "Induktiv" | "Analitik" | "Fazoviy" | "Inferensial";
export type ErrType = "Texnik" | "Bilim bo'shlig'i";

export interface Question {
  id: string;
  marks: number;
  difficulty: Difficulty;
  strand: string;
  topic: string;
  subTopic: string;
  skill: string;
  bloom: Bloom;
  reasoning: Reasoning | null;
  gradeLevel: string;
  framework: string;
  result: QResult;
  earned: number;
  errorType: ErrType | null;
  evidence: string;
  peerSolveRate?: number | null;
  // Manually-authored "technical error" links. Each entry is either a plain
  // question ID (legacy) or an object with id + optional admin note.
  techErrorIds?: Array<string | { id: string; note?: string }>;
}

export function blankQuestion(id: string): Question {
  return {
    id, marks: 1, difficulty: "Oson",
    strand: "", topic: "", subTopic: "", skill: "",
    bloom: "Tushunish", reasoning: null, gradeLevel: "", framework: "",
    result: "To'g'ri", earned: 1, errorType: null, evidence: "",
  };
}

const DIFF: Difficulty[] = ["Oson", "O'rta", "Qiyin"];
const BLOOM: Bloom[] = ["Eslab qolish", "Tushunish", "Qo'llash", "Tahlil", "Baholash", "Yaratish"];
const REASON_MATH_CT: (Reasoning | "")[] = ["", "Deduktiv", "Induktiv", "Analitik", "Fazoviy"];
const REASON_ENGLISH: (Reasoning | "")[] = ["", "Deduktiv", "Induktiv", "Analitik", "Inferensial"];
function getReasonOptions(subj: "MATH" | "ENGLISH" | "CRITICAL_THINKING"): (Reasoning | "")[] {
  return subj === "ENGLISH" ? REASON_ENGLISH : REASON_MATH_CT;
}
const QRES: QResult[] = ["To'g'ri", "Noto'g'ri", "Qisman"];
const ERR: (ErrType | "")[] = ["", "Bilim bo'shlig'i"];

export type GridMode = "template" | "result";

interface Props {
  value: Question[];
  onChange: (next: Question[]) => void;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  apiBase: string;
  grade?: number | null;
  // template: structure-only editor (no per-student outcomes).
  // result: structure is read-only, only outcomes (result/earned/error/evidence) editable.
  mode: GridMode;
}

// Clear outcome fields when importing a template into a result form. The
// admin must explicitly grade each question — we do NOT silently give the
// student full marks. `result: ""` is an internal blank marker; the save-side
// validator catches it and forces the admin to fill in before submit.
function asBlankResultDefaults(q: Question): Question {
  return {
    ...q,
    result: "" as unknown as QResult, // blank until admin picks
    earned: 0,
    errorType: null,
    evidence: "",
    peerSolveRate: null,
  };
}

interface TemplateRow {
  id: string;
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number;
  name: string;
  questionCount: number;
}

export default function QuestionGridEditor({ value, onChange, subject, apiBase, grade, mode }: Props) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteErr, setPasteErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tpls, setTpls] = useState<TemplateRow[]>([]);
  const [tplsLoading, setTplsLoading] = useState(false);
  const [tplsErr, setTplsErr] = useState<string | null>(null);
  const [hover, setHover] = useState<{ row: number; x: number; y: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function patch(i: number, p: Partial<Question>) {
    const next = [...value];
    next[i] = { ...next[i]!, ...p };
    onChange(next);
  }
  function addRow() {
    const nextId = `Q${value.length + 1}`;
    onChange([...value, blankQuestion(nextId)]);
  }
  function delRow(i: number) {
    onChange(value.filter((_, k) => k !== i));
  }
  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }

  // Bulk grading: apply the same outcome to every row at once. Same rules
  // as the per-row Natija dropdown, including auto-setting Xato turi and
  // earned marks so the result stays validator-clean.
  function markAll(next: QResult | "") {
    onChange(
      value.map((q) => {
        if (!next) {
          return { ...q, result: "" as unknown as QResult, earned: 0, errorType: null, evidence: q.evidence, peerSolveRate: q.peerSolveRate ?? null };
        }
        if (next === "To'g'ri") {
          return { ...q, result: next, earned: q.marks, errorType: null };
        }
        // Noto'g'ri / Qisman
        const earned = next === "Qisman" ? Math.floor(q.marks / 2) : 0;
        return { ...q, result: next, earned };
      }),
    );
  }
  function applyPaste() {
    setPasteErr(null);
    try {
      const raw = JSON.parse(pasteText);
      const arr: unknown = Array.isArray(raw) ? raw : raw.questions;
      if (!Array.isArray(arr)) throw new Error("JSON should be an array or { questions: [...] }");
      const qs = arr as Question[];
      onChange(mode === "result" ? qs.map(asBlankResultDefaults) : qs);
      setShowPaste(false);
      setPasteText("");
    } catch (e) {
      setPasteErr(e instanceof Error ? e.message : "JSON parse error");
    }
  }

  // Open picker: fetch all DB templates for this subject.
  async function openPicker() {
    setPickerOpen(true);
    setTplsErr(null);
    setTplsLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/admin/test-templates?subject=${subject}`, { credentials: "include" });
      if (!r.ok) throw new Error("Shablonlarni yuklab bo'lmadi");
      const j = await r.json();
      const list = (j?.data ?? []) as TemplateRow[];
      // Sort: preferred grade first (student's grade), then ascending.
      list.sort((a, b) => {
        if (grade != null) {
          if (a.grade === grade && b.grade !== grade) return -1;
          if (b.grade === grade && a.grade !== grade) return 1;
        }
        return a.grade - b.grade;
      });
      setTpls(list);
    } catch (e) {
      setTplsErr(e instanceof Error ? e.message : "Xato");
    } finally {
      setTplsLoading(false);
    }
  }

  async function pickTemplate(tplId: string) {
    setTplsLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/admin/test-templates/${tplId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Shablonni yuklab bo'lmadi");
      const j = await r.json();
      const qs = j?.data?.questions;
      if (!Array.isArray(qs)) throw new Error("Shablonda savol yo'q");
      onChange(mode === "result"
        ? (qs as Question[]).map(asBlankResultDefaults)
        : (qs as Question[]),
      );
      setPickerOpen(false);
    } catch (e) {
      setTplsErr(e instanceof Error ? e.message : "Yuklashda xato");
    } finally {
      setTplsLoading(false);
    }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ questions: value }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${subject}-questions.json`;
    a.click();
  }

  const totalMarks = value.reduce((s, q) => s + (q.marks || 0), 0);
  const totalEarned = value.reduce((s, q) => s + (q.earned || 0), 0);
  const correctCount = value.filter((q) => q.result === "To'g'ri").length;
  const unscoredCount = value.filter((q) => !q.result).length;
  const tplButtonLabel = mode === "result" ? "Test shablonidan yuklash" : "Shablondan boshlash";

  const pickerModal = (
    <TemplatePickerModal
      open={pickerOpen}
      onCancel={() => setPickerOpen(false)}
      loading={tplsLoading}
      error={tplsErr}
      templates={tpls}
      subject={subject}
      grade={grade ?? null}
      mode={mode}
      onPick={pickTemplate}
    />
  );

  // ---------- TEMPLATE MODE: structure-only grid ----------
  if (mode === "template") {
    return (
      <>
      {pickerModal}
      <div className="space-y-2">
        <Toolbar
          mode="template"
          addRow={addRow}
          loadTemplate={openPicker}
          tplLoading={tplsLoading}
          tplLabel={tplButtonLabel}
          showPaste={showPaste}
          togglePaste={() => setShowPaste((v) => !v)}
          exportJson={exportJson}
          importRef={importInputRef}
          onClear={() => onChange([])}
          onImportFile={async (file) => {
            const txt = await file.text();
            try {
              const raw = JSON.parse(txt);
              const arr = Array.isArray(raw) ? raw : raw.questions;
              if (Array.isArray(arr)) onChange(arr as Question[]);
            } catch {}
          }}
        />
        <div className="text-xs text-gray-500">{value.length} ta savol · jami {totalMarks} ball</div>

        {showPaste && <PasteBox text={pasteText} setText={setPasteText} err={pasteErr} onApply={applyPaste} />}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="p-2 text-left min-w-[100px]">ID</th>
                <th className="p-2 text-left min-w-[100px]">Ball</th>
                <th className="p-2 text-left min-w-[130px]">Qiyinlik</th>
                <th className="p-2 text-left min-w-[170px]">Bo'lim</th>
                <th className="p-2 text-left min-w-[190px]">Mavzu</th>
                <th className="p-2 text-left min-w-[210px]">Kichik mavzu</th>
                <th className="p-2 text-left min-w-[190px]">Ko'nikma</th>
                <th className="p-2 text-left min-w-[160px]">Bloom</th>
                <th className="p-2 text-left min-w-[140px]">Fikrlash</th>
                <th className="p-2 text-left min-w-[110px]">Sinf</th>
                <th className="p-2 text-left min-w-[170px]">Framework</th>
                <th className="p-2 text-left min-w-[240px]" title="Bog'liq savol ID'lari. Agar shulardan biri yechilgan bo'lsa, bu savol texnik xato hisoblanadi. Har biriga ixtiyoriy izoh qo'shish mumkin.">Texnik xato IDlar + izoh</th>
                <th className="p-2 min-w-[90px]"></th>
              </tr>
            </thead>
            <tbody>
              {value.map((q, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.id} onChange={(e) => patch(i, { id: e.target.value })} /></td>
                  <td className="p-1"><input type="number" min={0} className="input py-3 px-3 text-sm w-full" value={q.marks} onChange={(e) => patch(i, { marks: Number(e.target.value) })} /></td>
                  <td className="p-1">
                    <select className="input py-3 px-3 text-sm w-full" value={q.difficulty} onChange={(e) => patch(i, { difficulty: e.target.value as Difficulty })}>
                      {DIFF.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.strand} onChange={(e) => patch(i, { strand: e.target.value })} /></td>
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.topic} onChange={(e) => patch(i, { topic: e.target.value })} /></td>
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.subTopic} onChange={(e) => patch(i, { subTopic: e.target.value })} /></td>
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.skill} onChange={(e) => patch(i, { skill: e.target.value })} /></td>
                  <td className="p-1">
                    <select className="input py-3 px-3 text-sm w-full" value={q.bloom} onChange={(e) => patch(i, { bloom: e.target.value as Bloom })}>
                      {BLOOM.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <select className="input py-3 px-3 text-sm w-full" value={q.reasoning ?? ""}
                      onChange={(e) => patch(i, { reasoning: (e.target.value || null) as Reasoning | null })}>
                      {getReasonOptions(subject).map((r) => <option key={r} value={r}>{r || "—"}</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.gradeLevel} onChange={(e) => patch(i, { gradeLevel: e.target.value })} /></td>
                  <td className="p-1"><input className="input py-3 px-3 text-sm w-full" value={q.framework} onChange={(e) => patch(i, { framework: e.target.value })} /></td>
                  <td className="p-1">
                    <TechErrorRefsCell
                      refs={normalizeTechRefs(q.techErrorIds)}
                      onChange={(refs) => patch(i, { techErrorIds: refs })}
                    />
                  </td>
                  <td className="p-1 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => moveRow(i, -1)} className="text-gray-400 hover:text-navy hover:bg-navy/5 inline-flex items-center justify-center h-8 w-8 rounded-md" title="Yuqoriga">↑</button>
                      <button type="button" onClick={() => moveRow(i, +1)} className="text-gray-400 hover:text-navy hover:bg-navy/5 inline-flex items-center justify-center h-8 w-8 rounded-md" title="Pastga">↓</button>
                      <button type="button" onClick={() => delRow(i)} className="text-bad hover:bg-bad/10 inline-flex items-center justify-center h-8 w-8 rounded-md" title="O'chirish">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {value.length === 0 && (
                <tr><td colSpan={13} className="p-4 text-center text-gray-400">Savol yo'q. "Namunadan boshlash" yoki "+ Savol qo'shish".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
    );
  }

  // ---------- RESULT MODE: structure read-only + outcomes editable ----------
  return (
    <>
    {pickerModal}
    <div className="space-y-2">
      <Toolbar
        mode="result"
        addRow={addRow}
        loadTemplate={openPicker}
        tplLoading={tplsLoading}
        tplLabel={tplButtonLabel}
        showPaste={showPaste}
        togglePaste={() => setShowPaste((v) => !v)}
        exportJson={exportJson}
        importRef={importInputRef}
        onClear={() => onChange([])}
        onImportFile={async (file) => {
          const txt = await file.text();
          try {
            const raw = JSON.parse(txt);
            const arr = Array.isArray(raw) ? raw : raw.questions;
            if (Array.isArray(arr)) onChange((arr as Question[]).map(asBlankResultDefaults));
          } catch {}
        }}
      />

      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm pt-2 border-t">
          <span className="text-gray-600 font-medium">Barchasini:</span>
          <button type="button" onClick={() => markAll("To'g'ri")}
            className="btn-secondary text-good hover:bg-good/10 px-3 py-1.5">
            To'g'ri
          </button>
          <button type="button" onClick={() => markAll("Noto'g'ri")}
            className="btn-secondary text-bad hover:bg-bad/10 px-3 py-1.5">
            Noto'g'ri
          </button>
          <button type="button" onClick={() => markAll("Qisman")}
            className="btn-secondary text-warn hover:bg-warn/10 px-3 py-1.5">
            Qisman
          </button>
          <button type="button" onClick={() => markAll("")}
            className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5">
            <Icon name="refresh" size={14} /> Bo'sh
          </button>
        </div>
      )}
      <div className="text-xs">
        <span className="text-gray-500">{value.length} ta savol · {correctCount} to'g'ri · {totalEarned}/{totalMarks} ball</span>
        {unscoredCount > 0 && (
          <span className="ml-2 text-bad font-medium">
            · {unscoredCount} ta baholanmagan
          </span>
        )}
      </div>

      {showPaste && <PasteBox text={pasteText} setText={setPasteText} err={pasteErr} onApply={applyPaste} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="p-2 text-left w-14">ID</th>
              <th className="p-2 text-left">Mavzu</th>
              <th className="p-2 text-left w-20">Qiyinlik</th>
              <th className="p-2 text-left w-14">Ball</th>
              <th className="p-2 text-left w-24 text-good">Natija</th>
              <th className="p-2 text-left w-16 text-good">Olgan</th>
              <th className="p-2 text-left text-good">Izoh</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {value.map((q, i) => {
              const unscored = !q.result;
              const wrong = !unscored && q.result !== "To'g'ri";
              const rowCls = unscored ? "bg-gray-50" : wrong ? "bg-bad/5" : "";
              const markCorrect = () => patch(i, { result: "To'g'ri", earned: q.marks, errorType: null });
              const markWrong = () => patch(i, { result: "Noto'g'ri", earned: 0, errorType: undefined });
              const overlayVisible = hover?.row === i;
              return (
                <tr key={i} className={`relative border-t align-top ${rowCls}`}
                  onMouseMove={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest("[data-hover-overlay]")) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = rect.height / 2;
                    setHover((prev) =>
                      prev && prev.row === i && Math.abs(prev.x - x) < 8
                        ? prev
                        : { row: i, x, y },
                    );
                  }}
                  onMouseLeave={() => setHover((h) => (h?.row === i ? null : h))}
                >
                  <td className="p-2 font-mono text-gray-700">
                    {q.id}
                    {overlayVisible && (
                      <div
                        data-hover-overlay
                        className="absolute z-30 pointer-events-auto"
                        style={{ left: hover.x, top: hover.y }}
                      >
                        <div className="flex gap-1 bg-white shadow-lg border rounded-md p-1 translate-x-3 -translate-y-1/2">
                          <button type="button" onClick={markCorrect} title="To'g'ri"
                            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded font-semibold text-base text-good bg-good/10 hover:bg-good/25 border ${q.result === "To'g'ri" ? "border-good" : "border-transparent"}`}>
                            <Icon name="check" size={18} /> To'g'ri
                          </button>
                          <button type="button" onClick={markWrong} title="Noto'g'ri"
                            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded font-semibold text-base text-bad bg-bad/10 hover:bg-bad/25 border ${q.result === "Noto'g'ri" ? "border-bad" : "border-transparent"}`}>
                            <Icon name="x" size={18} /> Noto'g'ri
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-gray-700">
                    <div className="font-medium">{q.subTopic || q.topic}</div>
                    <div className="text-gray-400 text-[11px]">{q.strand} · {q.skill} · {q.bloom}</div>
                  </td>
                  <td className="p-2 text-gray-700">{q.difficulty}</td>
                  <td className="p-2 text-gray-700">{q.marks}</td>
                  <td className="p-1">
                    <select className={`input py-1.5 px-2 text-sm w-full ${unscored ? "border-bad text-bad" : ""}`} value={q.result ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (!raw) {
                          patch(i, { result: "" as unknown as QResult, earned: 0, errorType: null });
                          return;
                        }
                        const next = raw as QResult;
                        const earned = next === "To'g'ri" ? q.marks : next === "Qisman" ? Math.floor(q.marks / 2) : 0;
                        patch(i, {
                          result: next,
                          earned,
                          errorType: next === "To'g'ri" ? null : undefined,
                        });
                      }}>
                      <option value="">—</option>
                      {QRES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <input type="number" min={0} max={q.marks} className="input py-1.5 px-2 text-sm"
                      value={q.earned} onChange={(e) => patch(i, { earned: Number(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <input className="input py-1.5 px-2 text-sm"
                      placeholder="o'qituvchi izohi"
                      value={q.evidence} onChange={(e) => patch(i, { evidence: e.target.value })} />
                  </td>
                  <td className="p-1 text-right">
                    <button type="button" onClick={() => delRow(i)}
                      className="text-bad hover:bg-bad/10 inline-flex items-center justify-center h-8 w-8 rounded-md"
                      aria-label="O'chirish" title="O'chirish">
                      <Icon name="x" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {value.length === 0 && (
              <tr><td colSpan={9} className="p-4 text-center text-gray-400">
                Savol yo'q. <b>{tplButtonLabel}</b> tugmasini bosing.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}

// ---- shared subcomponents -------------------------------------------------

function Toolbar({
  mode, addRow, loadTemplate, tplLoading, tplLabel, showPaste, togglePaste,
  exportJson, importRef, onClear, onImportFile,
}: {
  mode: GridMode;
  addRow: () => void;
  loadTemplate: () => Promise<void>;
  tplLoading: boolean;
  tplLabel: string;
  showPaste: boolean;
  togglePaste: () => void;
  exportJson: () => void;
  importRef: React.RefObject<HTMLInputElement>;
  onClear: () => void;
  onImportFile: (file: File) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {mode === "template" && (
        <button type="button" onClick={addRow} className="btn-secondary inline-flex items-center gap-1.5">
          <Icon name="plus" size={14} /> Savol qo'shish
        </button>
      )}
      <button type="button" onClick={loadTemplate} disabled={tplLoading} className="btn-secondary inline-flex items-center gap-1.5">
        <Icon name="download" size={14} /> {tplLoading ? "Yuklanmoqda…" : tplLabel}
      </button>
      <button type="button" onClick={togglePaste} className="btn-secondary inline-flex items-center gap-1.5">
        <Icon name="fileJson" size={14} /> {showPaste ? "Yopish" : "JSON kiritish"}
      </button>
      <button type="button" onClick={exportJson} className="btn-secondary inline-flex items-center gap-1.5">
        <Icon name="download" size={14} /> JSON eksport
      </button>
      <input
        type="file" accept="application/json" ref={importRef} className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await onImportFile(file);
        }}
      />
      <button type="button" className="btn-secondary inline-flex items-center gap-1.5" onClick={() => importRef.current?.click()}>
        <Icon name="upload" size={14} /> Fayldan import
      </button>
      <button type="button" onClick={onClear} className="text-xs text-bad hover:underline ml-auto inline-flex items-center gap-1">
        <Icon name="delete" size={14} /> Hammasini tozalash
      </button>
    </div>
  );
}

function PasteBox({ text, setText, err, onApply }: { text: string; setText: (s: string) => void; err: string | null; onApply: () => void }) {
  return (
    <div className="card p-3 space-y-2">
      <div className="text-xs space-y-1">
        <div>JSON kiriting (massiv yoki <code>{`{ "questions": [...] }`}</code>)</div>
        <div className="text-gray-400">
          <code>techErrorIds</code> formati:{" "}
          <code>{`[{"id":"Q7","note":"izoh matni"},{"id":"Q8","note":""}]`}</code>{" "}
          yoki sodda ID: <code>{`["Q7","Q8"]`}</code>
        </div>
      </div>
      <textarea className="input font-mono text-xs" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      {err && <div className="text-bad text-xs">{err}</div>}
      <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={onApply}>
        <Icon name="check" size={16} /> Qo'llash
      </button>
    </div>
  );
}

const SUBJECT_LABEL: Record<"MATH" | "ENGLISH" | "CRITICAL_THINKING", string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

function TemplatePickerModal({
  open, onCancel, loading, error, templates, subject, grade, mode, onPick,
}: {
  open: boolean;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  templates: TemplateRow[];
  subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
  grade: number | null;
  mode: GridMode;
  onPick: (id: string) => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onCancel}>
      <div className="card w-full max-w-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy">
              {SUBJECT_LABEL[subject]} — test shabloni tanlash
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {mode === "result"
                ? "Tanlangan shablon savol strukturasi bilan yuklanadi. Natija maydonlari bo'sh qoladi — har bir savolni siz baholaysiz."
                : "Tanlangan shablondan boshlab, kerakli o'zgartirishlarni kiriting."}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-navy" aria-label="Yopish">
            <Icon name="x" size={18} />
          </button>
        </div>

        {loading && <div className="text-gray-500 text-sm py-4 text-center">Yuklanmoqda…</div>}
        {error && <div className="text-bad text-sm py-2">{error}</div>}

        {!loading && templates.length === 0 && (
          <div className="text-gray-500 text-sm py-6 text-center">
            Bu fan uchun shablon yo'q. Avval <b>Test shablonlari</b> sahifasida yarating.
          </div>
        )}

        {!loading && templates.length > 0 && (
          <div className="max-h-96 overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Nomi</th>
                  <th className="text-left px-3 py-2 w-20">Sinf</th>
                  <th className="text-left px-3 py-2 w-20">Savol</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const isRecommended = grade != null && t.grade === grade;
                  return (
                    <tr key={t.id} className={`border-t hover:bg-gray-50 ${isRecommended ? "bg-good/5" : ""}`}>
                      <td className="px-3 py-2 font-medium">
                        {t.name}
                        {isRecommended && <span className="ml-2 text-good text-xs">✓ Tavsiya</span>}
                      </td>
                      <td className="px-3 py-2">{t.grade}-sinf</td>
                      <td className="px-3 py-2">{t.questionCount}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => onPick(t.id)}
                          className="btn-primary text-xs inline-flex items-center gap-1.5"
                        >
                          <Icon name="download" size={14} /> Import
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center gap-2">
            <Icon name="x" size={16} /> Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}
