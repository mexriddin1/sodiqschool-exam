"use client";

// O'quvchining sinf + til kombinatsiyasi bo'yicha ochilgan testlar.
//
// Tartib QAT'IY: matematika -> ingliz tili -> tanqidiy fikrlash. O'quvchi
// tanlamaydi — bir vaqtda faqat bittasi ochiq, qolganlari qulflangan. Mantiq
// lib/tests.ts da (yakuniy sahifa ham o'shandan foydalanadi).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { sequenceTests, type SequencedTest, type TestRow } from "@/lib/tests";
import { DoneIcon, LockIcon, SubjectIcon, SUBJECT_TINT } from "@/components/SubjectIcon";
import { DEFAULT_LANG, subjectLabel, tr, type Lang } from "@/lib/i18n";

export default function TestsListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted">…</div>}>
      <TestsListInner />
    </Suspense>
  );
}

function TestsListInner() {
  const search = useSearchParams();
  const router = useRouter();
  const leadIdParam = search.get("lead");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [items, setItems] = useState<SequencedTest[]>([]);
  const [studentName, setStudentName] = useState("");
  // Interfeys tili lead'dan keladi (backend `lead.examLanguage` qaytaradi).
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = leadIdParam || (typeof window !== "undefined" ? sessionStorage.getItem("sodiq_lead_id") : null);
    if (!id) {
      router.replace("/");
      return;
    }
    setLeadId(id);
    api<{ items: TestRow[]; lead: { firstName: string; lastName: string; examLanguage?: Lang } }>(`/api/test-taking/leads/${id}/tests`)
      .then((d) => {
        setItems(sequenceTests(d.items ?? []));
        setStudentName(`${d.lead.firstName} ${d.lead.lastName}`);
        if (d.lead.examLanguage) setLang(d.lead.examLanguage);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Xato"))
      .finally(() => setLoading(false));
  }, [leadIdParam, router]);

  async function start(testId: string) {
    if (!leadId) return;
    setStarting(testId);
    setError(null);
    try {
      const { token } = await api<{ token: string }>("/api/test-taking/attempts", {
        method: "POST",
        body: JSON.stringify({ leadId, testId }),
      });
      router.push(`/take/${token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
      setStarting(null);
    }
  }

  const doneCount = items.filter((t) => t.completed).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const next = items.find((t) => t.isNext);

  return (
    // Planshet: markazda, kartalar yonma-yon (uchta fan — uchta ustun).
    <div className="min-h-screen grid place-items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-4">
      <header className="hero p-6 lg:p-7 animate-rise">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="Sodiq School" className="h-10 w-auto mb-5" />
        <h1 className="text-white text-2xl">{studentName || "…"}</h1>

        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#C3CBE6]">
              <span>
                {allDone ? tr(lang, "allDoneShort") : tr(lang, "seqHint")}
              </span>
              <span className="num text-white font-bold">{doneCount}/{items.length}</span>
            </div>
            <div className="progress progress-sm progress-glass">
              <div className="progress-bar" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>
          </div>
        )}
      </header>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="w-12 h-12 rounded-[12px] bg-line animate-pulse" />
              <div className="h-4 w-24 rounded bg-line animate-pulse" />
              <div className="h-3 w-32 rounded bg-inset animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="card p-6 text-center space-y-2 animate-rise">
          <div className="text-3xl">🔍</div>
          <h2 className="text-base">{tr(lang, "noTests")}</h2>
          <p className="text-sm text-muted">{tr(lang, "contactReception")}</p>
        </div>
      )}

      {allDone && (
        <div className="card p-5 text-center space-y-1 animate-rise" style={{ background: "var(--pos-weak)", borderColor: "#C9E7D8" }}>
          <div className="text-2xl">🎉</div>
          <h2 className="text-base">{tr(lang, "allDoneTitle")}</h2>
          <p className="text-sm text-muted">{tr(lang, "allDoneText")}</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 stagger">
          {items.map((t) => (
            <TestCard key={t.id} t={t} lang={lang} />
          ))}
        </div>
      )}

      {/* Bitta umumiy "Boshlash" — o'quvchi fanni tanlamaydi, imtihon qat'iy
          tartibda ketadi. Tugma navbatdagi fanni ochadi. */}
      {!loading && !allDone && next && (
        <button
          onClick={() => start(next.id)}
          disabled={Boolean(starting)}
          className="btn btn-accent btn-block"
        >
          {starting
            ? tr(lang, "opening")
            : doneCount === 0
              ? tr(lang, "startExam")
              : tr(lang, "continueExam")}
        </button>
      )}

      {error && (
        <div className="card animate-shake p-4 border-2 border-[#F3D3CE] bg-neg-weak text-sm font-semibold text-[#9C3A2D]">
          {error}
        </div>
      )}
      </div>
    </div>
  );
}

function TestCard({ t, lang }: { t: SequencedTest; lang: Lang }) {
  const tint = SUBJECT_TINT[t.subject];
  // Qulflangan karta xira: navbati kelmagani ko'rinib tursin, lekin nima
  // kutayotgani ham bilinsin.
  const dim = t.locked ? "opacity-60" : "";
  // Navbatdagi karta ajralib tursin — bola qayerga bosishini izlamasin.
  const ring = t.isNext ? { borderColor: "var(--accent)", boxShadow: "0 0 0 4px var(--accent-weak)" } : undefined;

  return (
    <div className={`card p-4 flex flex-col gap-3 ${dim}`} style={ring}>
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex-none w-12 h-12 rounded-[12px] grid place-items-center"
          style={
            t.completed
              ? { background: "var(--pos)", color: "#fff" }
              : t.locked
                ? { background: "var(--inset)", color: "var(--faint)" }
                : { background: tint.bg, color: tint.fg }
          }
        >
          {t.completed ? <DoneIcon size={22} /> : t.locked ? <LockIcon size={20} /> : <SubjectIcon subject={t.subject} />}
        </div>
        <span className="num text-xs font-bold text-faint">{t.step}/3</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-ink">{subjectLabel(lang, t.subject)}</div>
        <div className="text-xs text-muted line-clamp-2 mt-0.5">{t.name}</div>
        {/* Tugatilganda meta chiplar yo'q: pastdagi "Tugatildi" belgisi
            allaqachon shuni aytadi, savol soni esa endi ahamiyatsiz. */}
        {!t.completed && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="chip"><b className="num">{t.questionCount}</b> {tr(lang, "questionsWord")}</span>
            <span className="chip">
              {t.durationSec ? <><b className="num">{Math.round(t.durationSec / 60)}</b> {tr(lang, "minutesWord")}</> : tr(lang, "noTimeLimit")}
            </span>
          </div>
        )}
      </div>

      {t.isNext && (
        <span className="chip chip-accent justify-center">{tr(lang, "nextUp")}</span>
      )}
      {t.locked && (
        <span className="chip justify-center" title={tr(lang, "seqHint")}>
          <LockIcon size={12} /> {tr(lang, "queued")}
        </span>
      )}
      {t.completed && (
        <span className="chip chip-pos justify-center">
          <DoneIcon size={12} /> {tr(lang, "finishedChip")}
        </span>
      )}
    </div>
  );
}
