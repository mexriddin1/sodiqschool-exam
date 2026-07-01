"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { EMPTY_MANUAL, ManualContent, toApi } from "@/components/ManualContentEditor";
import QuestionGridEditor, { Question } from "@/components/QuestionGridEditor";
import ResultStatsPanel from "@/components/ResultStatsPanel";

interface Student { id: string; fullName: string; grade: number }
interface Exam {
  id: string;
  title: string;
  grade: number;
  admissionThresholds?: Record<string, { math: number; ct: number; en: number }>;
}

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
const SUBJECT_LABEL: Record<SubjectKey, string> = {
  MATH: "Matematika",
  ENGLISH: "Ingliz tili",
  CRITICAL_THINKING: "Tanqidiy fikrlash",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function NewResultPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjects, setSubjects] = useState<Record<SubjectKey, Question[]>>({
    MATH: [], ENGLISH: [], CRITICAL_THINKING: [],
  });
  const [manual, setManual] = useState<ManualContent>(EMPTY_MANUAL);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ publicCode: string; password: string; id: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOpen, setStudentOpen] = useState(false);
  const studentBoxRef = useRef<HTMLDivElement>(null);
  // Collapsed state per subject card — collapsing keeps the header/summary but
  // hides the (tall) QuestionGridEditor so the page stays scannable.
  const [collapsed, setCollapsed] = useState<Record<SubjectKey, boolean>>({
    MATH: false, ENGLISH: false, CRITICAL_THINKING: false,
  });

  const studentGrade = students.find((s) => s.id === studentId)?.grade ?? null;
  const selectedStudent = students.find((s) => s.id === studentId) ?? null;

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 50);
    return students
      .filter((s) => `${s.fullName} ${s.grade}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [students, studentQuery]);

  // close the combobox popover when clicking outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!studentBoxRef.current) return;
      if (!studentBoxRef.current.contains(e.target as Node)) setStudentOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Outcome fields are blanked so the admin must explicitly grade each
  // question; mirrors QuestionGridEditor.asBlankResultDefaults.
  function blankOutcomes(q: Question): Question {
    return {
      ...q,
      result: "" as unknown as Question["result"],
      earned: 0,
      errorType: null,
      evidence: "",
      peerSolveRate: null,
    };
  }

  async function importAllSubjects() {
    if (!studentGrade) return;
    setImportLoading(true);
    setImportMsg(null);
    try {
      const next: Record<SubjectKey, Question[]> = { MATH: [], ENGLISH: [], CRITICAL_THINKING: [] };
      const misses: string[] = [];
      for (const k of Object.keys(next) as SubjectKey[]) {
        const r = await fetch(`${API_BASE}/api/admin/test-templates/by/${k}/${studentGrade}`, { credentials: "include" });
        if (r.ok) {
          const j = await r.json();
          const qs = j?.data?.questions;
          if (Array.isArray(qs)) next[k] = (qs as Question[]).map(blankOutcomes);
        } else {
          misses.push(SUBJECT_LABEL[k]);
        }
      }
      setSubjects(next);
      if (misses.length === 0) {
        setImportMsg(`${studentGrade}-sinf testlari yuklandi. Har bir savolni Natija ustunida baholang.`);
      } else {
        setImportMsg(`${studentGrade}-sinf uchun ${misses.join(", ")} shabloni topilmadi. Test shablonlari sahifasidan yarating.`);
      }
    } finally {
      setImportLoading(false);
    }
  }

  useEffect(() => {
    // Combobox uses the full list; endpoints are paginated so pass a big take.
    api<{ items: Student[] }>("/api/admin/students?take=1000").then((d) => setStudents(d.items));
    api<{ items: Exam[] }>("/api/admin/exams?take=1000").then((d) => setExams(d.items));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const subjectArr = (Object.keys(subjects) as SubjectKey[]).map((k) => {
        if (subjects[k].length === 0) throw new Error(`${SUBJECT_LABEL[k]}: kamida bitta savol kiritilishi kerak.`);
        const unscored = subjects[k].filter((q) => !q.result);
        if (unscored.length > 0) {
          const ids = unscored.slice(0, 5).map((q) => q.id).join(", ");
          throw new Error(`${SUBJECT_LABEL[k]}: ${unscored.length} ta savol baholanmagan (${ids}${unscored.length > 5 ? ", …" : ""}). Har biri uchun Natija ustunini to'ldiring.`);
        }
        return { subject: k, questions: subjects[k] };
      });
      const data = await api<{
        result: { id: string };
        credentials: { publicCode: string; password: string };
      }>("/api/admin/results", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          examId,
          manualContent: toApi(manual),
          subjects: subjectArr,
        }),
      });
      setCreds({ ...data.credentials, id: data.result.id });
    } catch (e) {
      const msg = e instanceof ApiException
        ? `${e.error.message}${e.error.fields ? "\n" + Object.entries(e.error.fields).map(([k, v]) => `• ${k}: ${v}`).join("\n") : ""}`
        : e instanceof Error ? e.message : "Saqlashda xato";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  if (creds) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold text-good">Natija yaratildi</h1>
        <div className="card p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Quyidagi maxfiy ma'lumotlarni endi bir martagina ko'rasiz.
            Parol bcrypt bilan saqlanadi va keyin tiklab bo'lmaydi.
          </p>
          <div>
            <div className="label">Kirish kodi (6 belgi)</div>
            <div className="font-mono text-xl">{creds.publicCode}</div>
          </div>
          <div>
            <div className="label">Parol</div>
            <div className="font-mono text-xl">{creds.password}</div>
          </div>
          <div className="pt-3 flex gap-2">
            <button
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => navigator.clipboard.writeText(`${creds.publicCode} / ${creds.password}`)}
            ><Icon name="copy" size={16} /> Nusxalash</button>
            <button className="btn-primary inline-flex items-center gap-2" onClick={() => router.push(`/results/${creds.id}`)}>
              <Icon name="view" size={16} /> Natijani ochish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-semibold text-navy">Yangi natija</h1>

      <div className="card p-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label">O'quvchi</label>
          <div className="relative" ref={studentBoxRef}>
            <input
              type="text"
              className={`input ${!studentId ? "border-bad bg-bad/5 focus:border-bad" : ""}`}
              placeholder="Ism-sharif bo'yicha qidiring…"
              value={studentOpen ? studentQuery : (selectedStudent ? `${selectedStudent.fullName} (${selectedStudent.grade}-sinf)` : studentQuery)}
              onFocus={() => {
                setStudentOpen(true);
                setStudentQuery("");
              }}
              onChange={(e) => {
                setStudentQuery(e.target.value);
                setStudentOpen(true);
                if (studentId) setStudentId("");
              }}
              required={!studentId}
            />
            {studentOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                {filteredStudents.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Topilmadi</div>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-navy/5 ${s.id === studentId ? "bg-navy/10 font-medium" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setStudentId(s.id);
                        setStudentQuery("");
                        setStudentOpen(false);
                      }}
                    >
                      {s.fullName} <span className="text-gray-500">({s.grade}-sinf)</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="label">Imtihon</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className={`input ${!examId ? "border-bad bg-bad/5 focus:border-bad" : ""}`}
            required
          >
            <option value="">— tanlang —</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.title} ({e.grade}-sinf)</option>
            ))}
          </select>
        </div>
      </div>

      {studentGrade != null && (
        <div className="card p-3 flex items-center justify-between bg-good/10">
          <div className="text-sm">
            <b>{studentGrade}-sinf</b> savollarini barcha 3 fan uchun bir tugma bilan import qiling.
          </div>
          <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={importLoading} onClick={importAllSubjects}>
            <Icon name="download" size={16} />
            {importLoading ? "Yuklanmoqda…" : `${studentGrade}-sinf testlarini import qilish`}
          </button>
        </div>
      )}
      {importMsg && <div className="text-sm text-gray-700">{importMsg}</div>}

      {(Object.keys(SUBJECT_LABEL) as SubjectKey[]).map((k) => {
        const qs = subjects[k];
        const scored = qs.filter((q) => q.result).length;
        const isCollapsed = collapsed[k];
        return (
        <div key={k} className="card p-4 space-y-3">
          <button
            type="button"
            className="w-full flex items-center justify-between text-left"
            onClick={() => setCollapsed({ ...collapsed, [k]: !isCollapsed })}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Yozish" : "Yig'ish"}
          >
            <div className="flex items-center gap-2">
              <div className="font-medium">{SUBJECT_LABEL[k]}</div>
              <div className="text-xs text-gray-500">
                {qs.length === 0 ? "savol yo'q" : `${scored}/${qs.length} baholangan`}
              </div>
            </div>
            <span className="text-gray-500 hover:text-navy inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-navy/5">
              <Icon name={isCollapsed ? "chevronDown" : "chevronUp"} size={16} />
            </span>
          </button>
          {!isCollapsed && (
            <QuestionGridEditor
              value={qs}
              onChange={(next) => setSubjects({ ...subjects, [k]: next })}
              subject={k}
              grade={studentGrade}
              apiBase={API_BASE}
              mode="result"
            />
          )}
        </div>
        );
      })}

      <div className="card p-4 space-y-3 bg-navy/5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Jonli statistika va qabul qarori</h2>
          <span className="text-xs text-gray-500">Har bir savolni belgilaganingizda avtomatik yangilanadi</span>
        </div>
        <ResultStatsPanel
          subjects={subjects}
          grade={studentGrade}
          admissionThresholds={exams.find((e) => e.id === examId)?.admissionThresholds ?? null}
          verdictOverride={manual.summary.verdictOverride}
          onVerdictOverrideChange={(next) =>
            setManual({ ...manual, summary: { ...manual.summary, verdictOverride: next } })
          }
        />
      </div>

      {error && <pre className="text-sm text-bad whitespace-pre-wrap">{error}</pre>}

      <button className="btn-primary inline-flex items-center gap-2" disabled={pending} type="submit">
        <Icon name="check" size={16} /> {pending ? "Hisoblanmoqda…" : "Yaratish"}
      </button>
    </form>
  );
}
