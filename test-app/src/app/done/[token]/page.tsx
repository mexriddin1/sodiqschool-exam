"use client";

// Yakuniy sahifa — testni tugatgan bolaga xabar va NAVBATDAGI test.
//
// Tartib qat'iy (matematika -> ingliz tili -> tanqidiy fikrlash), shuning
// uchun bu yerda tanlov yo'q: faqat bitta "keyingi test" tugmasi chiqadi.
// Hammasi tugagan bo'lsagina yakuniy xabar ko'rinadi.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { nextTest, type SequencedTest, type TestRow } from "@/lib/tests";
import { SubjectIcon, SUBJECT_TINT } from "@/components/SubjectIcon";
import { DEFAULT_LANG, subjectLabel, tr, type Lang } from "@/lib/i18n";

// Konfetti bo'laklari QAT'IY ro'yxat: Math.random() bilan generatsiya qilinsa
// server va klient boshqa qiymat chizadi va hydration mismatch bo'ladi.
const CONFETTI = [
  { left: "6%",  delay: "0.00s", dur: "2.6s", color: "var(--accent)",  w: 8,  h: 14 },
  { left: "14%", delay: "0.35s", dur: "3.1s", color: "var(--pos)",     w: 10, h: 10 },
  { left: "23%", delay: "0.12s", dur: "2.4s", color: "var(--info)",    w: 7,  h: 12 },
  { left: "31%", delay: "0.62s", dur: "3.4s", color: "var(--accent)",  w: 12, h: 8  },
  { left: "40%", delay: "0.22s", dur: "2.9s", color: "#FFD166",        w: 8,  h: 8  },
  { left: "48%", delay: "0.80s", dur: "2.5s", color: "var(--pos)",     w: 9,  h: 14 },
  { left: "57%", delay: "0.05s", dur: "3.2s", color: "var(--info)",    w: 11, h: 9  },
  { left: "65%", delay: "0.48s", dur: "2.7s", color: "var(--accent)",  w: 8,  h: 12 },
  { left: "74%", delay: "0.18s", dur: "3.0s", color: "#FFD166",        w: 10, h: 10 },
  { left: "82%", delay: "0.70s", dur: "2.8s", color: "var(--pos)",     w: 7,  h: 13 },
  { left: "90%", delay: "0.30s", dur: "3.3s", color: "var(--info)",    w: 9,  h: 9  },
  { left: "96%", delay: "0.55s", dur: "2.6s", color: "var(--accent)",  w: 8,  h: 11 },
];

interface Finished {
  finished: boolean;
  leadId?: string;
  examLanguage?: Lang;
  test?: { id: string; name: string; subject: string };
}

export default function DonePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [leadId, setLeadId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [next, setNext] = useState<SequencedTest | null>(null);
  const [doneSubject, setDoneSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navbatdagi testni topamiz. Xato bo'lsa ham sahifa ishlaydi — tabrik
  // ko'rinadi, faqat "keyingi test" tugmasi chiqmaydi.
  useEffect(() => {
    (async () => {
      try {
        const att = await api<Finished>(`/api/test-taking/attempts/${token}`);
        if (att.examLanguage) setLang(att.examLanguage);
        if (att.test?.subject) setDoneSubject(att.test.subject);
        const id = att.leadId ?? (typeof window !== "undefined" ? sessionStorage.getItem("sodiq_lead_id") : null);
        if (!id) return;
        setLeadId(id);
        const d = await api<{ items: TestRow[] }>(`/api/test-taking/leads/${id}/tests`);
        setNext(nextTest(d.items ?? []) ?? null);
      } catch {
        /* Keyingi testni aniqlab bo'lmadi — tabrikning o'zi ko'rinadi. */
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function startNext() {
    if (!leadId || !next) return;
    setStarting(true);
    setError(null);
    try {
      const { token: t } = await api<{ token: string }>("/api/test-taking/attempts", {
        method: "POST",
        body: JSON.stringify({ leadId, testId: next.id }),
      });
      router.push(`/take/${t}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
      setStarting(false);
    }
  }

  const tint = next ? SUBJECT_TINT[next.subject] : null;

  return (
    <div className="relative min-h-screen overflow-hidden grid place-items-center p-4">
      {/* Bayram — faqat bezak, ekran o'quvchisidan yashiramiz. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 rounded-[2px]"
            style={{
              left: c.left,
              width: c.w,
              height: c.h,
              background: c.color,
              animation: `confetti-fall ${c.dur} ${c.delay} ease-in forwards`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md space-y-3 relative">
        <div className="card p-7 sm:p-8 text-center space-y-4 animate-rise">
          <div
            className="w-20 h-20 mx-auto rounded-full grid place-items-center animate-seal"
            style={{
              background: "var(--pos)",
              color: "#fff",
              fontSize: 40,
              lineHeight: 1,
              boxShadow: "0 12px 28px -8px rgba(47, 158, 107, 0.6), inset 0 0 0 3px rgba(255,255,255,0.35)",
            }}
          >
            ✓
          </div>

          <h1 className="text-2xl">
            {doneSubject
              ? tr(lang, "doneTitleSubject", { subject: subjectLabel(lang, doneSubject) })
              : tr(lang, "doneTitleGeneric")}
          </h1>

          <p className="text-sm text-muted">{tr(lang, "doneText")}</p>

          {/* Hammasi tugagandagina "yopishingiz mumkin" deymiz — aks holda
              bola keyingi testni topshirmasdan chiqib ketadi. */}
          {!loading && !next && (
            <div className="pt-2 text-xs text-faint border-t border-line">
              <div className="pt-3">{tr(lang, "doneClose")}</div>
              <div className="mt-1">{tr(lang, "slogan")}</div>
            </div>
          )}
        </div>

        {next && tint && (
          <div className="card p-5 space-y-4 animate-rise" style={{ animationDelay: "0.12s" }}>
            <div className="flex items-center gap-3">
              <div
                className="flex-none w-11 h-11 rounded-[12px] grid place-items-center"
                style={{ background: tint.bg, color: tint.fg }}
              >
                <SubjectIcon subject={next.subject} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted">{tr(lang, "nextTest")}</div>
                <div className="font-bold text-ink">{subjectLabel(lang, next.subject)}</div>
              </div>
              <span className="chip flex-none">
                <b className="num">{next.questionCount}</b> {tr(lang, "questionsWord")}
              </span>
            </div>

            {error && (
              <div className="animate-shake rounded-[10px] border-2 border-[#F3D3CE] bg-neg-weak px-3 py-2 text-sm font-semibold text-[#9C3A2D]">
                {error}
              </div>
            )}

            <button onClick={startNext} disabled={starting} className="btn btn-accent btn-block">
              {starting ? tr(lang, "opening") : tr(lang, "startSubject", { subject: subjectLabel(lang, next.subject) })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
