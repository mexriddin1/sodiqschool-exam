"use client";

// Asosiy test-taking sahifasi. Fullscreen, offline-tolerant, refresh-safe.
// Timer backend'ning startedAt + durationSec ga tayanadi — refresh yoki
// browser jam bo'lsa ham aniq davom etaveradi.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { isFullscreen, onFullscreenChange, requestFullscreen } from "@/lib/fullscreen";
import {
  clearAttempt,
  loadAnswers,
  loadAttempt,
  saveAnswers,
  saveAttempt,
} from "@/lib/offline-store";
import QuestionRenderer, { ClientQuestion } from "@/components/QuestionRenderer";
import { DEFAULT_LANG, subjectLabel, tr, type Lang } from "@/lib/i18n";
import { SUBJECT_SEQUENCE, type Subject } from "@/lib/tests";

interface Attempt {
  token: string;
  attemptId: string;
  /** Lead tili — savollar ham, interfeys ham shu tilda. */
  examLanguage?: Lang;
  test: { id: string; name: string; subject: string; grade: number; durationSec: number | null };
  startedAt: string;
  questions: ClientQuestion[];
  answers?: Record<string, unknown>;
  finished?: boolean;
}

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Boshlash ekranidagi qoidalar ikonkalari — unicode glif emas, chunki ular
// shriftga qarab turlicha va ingichka chiqadi.
const RULE_ICON = {
  fullscreen: (
    <svg {...ICON} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M16 21h3a2 2 0 0 0 2-2v-3M8 21H5a2 2 0 0 1-2-2v-3" />
    </svg>
  ),
  clock: (
    <svg {...ICON} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  ),
  save: (
    <svg {...ICON} aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  check: (
    <svg {...ICON} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

export default function TakeTestPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswersState] = useState<Record<string, unknown>>({});
  const [idx, setIdx] = useState(0);
  // Oxirgi savoldan keyingi "Ko'rib chiqish" ekrani. `started` ichida qoladi —
  // timer, fullscreen qo'riqchi va autosave ishlab t: yakunlash SHU yerdan.
  const [reviewing, setReviewing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [fs, setFs] = useState(false);
  const [fsExits, setFsExits] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "started" | "submitting" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const lang: Lang = attempt?.examLanguage ?? DEFAULT_LANG;
  const t = (k: Parameters<typeof tr>[1], v?: Record<string, string | number>) => tr(lang, k, v);

  const submittedRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  // Fullscreen listener bir marta o'rnatiladi va `phase` ni closure'dan
  // ko'radi — ref bo'lmasa u abadiy "loading" bo'lib qolardi va hech narsa
  // sanalmasdi.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // 1) Load attempt (from server; fall back to IndexedDB if offline).
  useEffect(() => {
    (async () => {
      try {
        const data = await api<Attempt>(`/api/test-taking/attempts/${token}`);
        if (data.finished) {
          router.replace(`/done/${token}`);
          return;
        }
        setAttempt(data);
        await saveAttempt({
          token: data.token,
          test: data.test,
          questions: data.questions,
          startedAt: data.startedAt,
          examLanguage: data.examLanguage,
        });
        const local = await loadAnswers(token);
        const merged = { ...(data.answers ?? {}), ...local };
        setAnswersState(merged);
        setPhase("ready");
      } catch (e) {
        // Offline fallback — try to hydrate from IndexedDB.
        const cached = await loadAttempt(token);
        if (cached) {
          setAttempt({
            token: cached.token,
            attemptId: "",
            test: cached.test,
            startedAt: cached.startedAt,
            questions: cached.questions as ClientQuestion[],
            examLanguage: cached.examLanguage,
          });
          const local = await loadAnswers(token);
          setAnswersState(local);
          setPhase("ready");
          setError(tr(cached.examLanguage ?? DEFAULT_LANG, "offline"));
        } else {
          setError(e instanceof Error ? e.message : tr(DEFAULT_LANG, "loadFailed"));
          setPhase("error");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 2) Tick every second for timer + auto-submit check.
  useEffect(() => {
    const int = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(int);
  }, []);

  // 3) Fullscreen listener — only after start.
  //
  // Chiqishni TO'XTATIB bo'lmaydi: Esc va F11 ni brauzer o'zi ushlaydi, hech
  // qanday keydown handler ularni bekor qilolmaydi (bu ataylab shunday — aks
  // holda sayt foydalanuvchini ekranda qamab qo'ya olardi). Shuning uchun:
  // chiqishni sezamiz, testni ustidan bloklovchi oyna bilan yopamiz va
  // qaytishni so'raymiz. Qayta kirish ham faqat BOSISH orqali bo'ladi —
  // requestFullscreen user gesture'siz ishlamaydi, avtomatik qaytarolmaymiz.
  useEffect(() => {
    const off = onFullscreenChange(() => {
      const on = isFullscreen();
      setFs(on);
      // Faqat test ketayotganda sanaymiz: "Boshlash" dan oldingi va
      // yakunlagandan keyingi holat chiqish emas.
      if (!on && phaseRef.current === "started") {
        setFsExits((n) => n + 1);
      }
    });
    return off;
  }, []);

  // 4) Autosave every 5s to server + IndexedDB (best-effort).
  useEffect(() => {
    if (phase !== "started") return;
    // fsExits deps'da: chiqish sanalgach keyingi tik yangi sonni yuboradi.
    autosaveTimer.current = setInterval(async () => {
      try {
        await saveAnswers(token, answers);
      } catch { /* ignore */ }
      try {
        await api(`/api/test-taking/attempts/${token}/answers`, {
          method: "PATCH",
          body: JSON.stringify({ answers, fullscreenExits: fsExits }),
        });
      } catch {
        /* Server unreachable — javoblar lokal saqlanadi, next tick qaytadan urinamiz */
      }
    }, 5000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [phase, token, answers, fsExits]);

  const startedAtMs = attempt ? new Date(attempt.startedAt).getTime() : 0;
  const durationSec = attempt?.test.durationSec ?? null;
  const remainingSec = durationSec ? Math.max(0, durationSec - Math.floor((now - startedAtMs) / 1000)) : null;

  const submit = useCallback(async (autoSubmitted: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setPhase("submitting");
    try {
      // Save any pending answers locally first.
      await saveAnswers(token, answers);
      const res = await api<{ resultId: string; completed: boolean }>(
        `/api/test-taking/attempts/${token}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ answers, autoSubmitted, fullscreenExits: fsExits }),
        },
      );
      await clearAttempt(token);
      setPhase("done");
      router.replace(`/done/${token}`);
      return res;
    } catch (e) {
      submittedRef.current = false;
      setPhase("started");
      if (e instanceof ApiException) {
        setError(e.message);
      } else if (e instanceof Error && (e.message.includes("Failed to fetch") || e.message.includes("NetworkError"))) {
        setError(t("checkConnection"));
      } else {
        setError(e instanceof Error ? e.message : t("submitFailed"));
      }
    }
  }, [answers, router, token, fsExits]);

  // 5) Auto-submit when timer hits zero.
  useEffect(() => {
    if (phase !== "started") return;
    if (remainingSec !== null && remainingSec <= 0 && !submittedRef.current) {
      submit(true);
    }
  }, [remainingSec, phase, submit]);

  // 6) beforeunload — javoblar saqlanmagan bo'lishi mumkin — foydalanuvchini ogohlantirish.
  useEffect(() => {
    if (phase !== "started") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  // 7) Navigator gorizontal skroll — joriy savol ko'rinishdan chiqib
  // ketmasin (50 savolli testda "Keyingi" bosgan bola pill'ini yo'qotadi).
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [idx, phase]);

  const totalQuestions = attempt?.questions.length ?? 0;
  const answeredCount = useMemo(
    () => Object.keys(answers).filter((k) => {
      const v = answers[k];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return Object.keys(v as object).length > 0;
      return String(v).length > 0;
    }).length,
    [answers],
  );

  if (phase === "loading" || !attempt) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-line border-t-accent animate-spin" />
          <div className="text-sm text-muted">…</div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card p-6 max-w-md text-center space-y-3 animate-rise">
          <div className="w-14 h-14 mx-auto rounded-full grid place-items-center bg-neg-weak text-neg text-2xl font-bold">!</div>
          <h1 className="text-lg">{t("errorTitle")}</h1>
          <p className="text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    const rules: { icon: keyof typeof RULE_ICON; tint: string; fg: string; text: string }[] = [
      {
        icon: "fullscreen", tint: "var(--info-weak)", fg: "var(--info)",
        text: t("ruleFullscreen"),
      },
      {
        icon: "clock", tint: "var(--warn-weak)", fg: "var(--warn)",
        text: attempt.test.durationSec
          ? t("ruleTime", { min: Math.round(attempt.test.durationSec / 60) })
          : t("ruleNoTime"),
      },
      {
        icon: "save", tint: "var(--accent-weak)", fg: "var(--accent-ink)",
        text: t("ruleSaved"),
      },
      {
        icon: "check", tint: "var(--pos-weak)", fg: "var(--pos)",
        text: t("rulePublish"),
      },
    ];
    return (
      <div className="min-h-screen grid place-items-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-stretch">
        <header className="hero p-6 lg:p-8 flex flex-col justify-center animate-rise">
          <h1 className="text-white text-2xl lg:text-3xl">{attempt.test.name}</h1>
          <div className="flex flex-wrap gap-2 mt-5">
            <span className="chip chip-glass">
              <b className="num">{attempt.questions.length}</b> {t("questionsWord")}
            </span>
            {attempt.test.durationSec && (
              <span className="chip chip-glass">
                <b className="num">{Math.round(attempt.test.durationSec / 60)}</b> {t("minutesWord")}
              </span>
            )}
          </div>
        </header>

        <div className="card p-5 lg:p-6 space-y-4 animate-rise" style={{ animationDelay: "0.08s" }}>
          <ul className="space-y-3">
            {rules.map((r, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span
                  className="flex-none w-9 h-9 rounded-[10px] grid place-items-center"
                  style={{ background: r.tint, color: r.fg }}
                >
                  {RULE_ICON[r.icon]}
                </span>
                <span className="text-sm text-body flex-1 pt-1.5">{r.text}</span>
              </li>
            ))}
          </ul>

          {error && (
            <div className="rounded-[10px] border-2 border-[#F5E3BC] bg-warn-weak px-4 py-3 text-sm text-[#8A5F0C]">
              {error}
            </div>
          )}

          <button
            onClick={async () => {
              await requestFullscreen();
              setPhase("started");
              setFs(isFullscreen());
            }}
            className="btn btn-accent btn-block"
          >
            {t("startTest")}
          </button>
        </div>
        </div>
      </div>
    );
  }

  const q = attempt.questions[idx];
  const progressPct = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const lowTime = remainingSec != null && remainingSec < 60;
  const isLastQuestion = idx >= totalQuestions - 1;

  // Keyingi fan (qat'iy tartib). curIdx topilmasa yoki oxirgi bo'lsa — bu
  // fan imtihonning oxirgisi, "o'tish" emas "yakunlash".
  const curSubject = attempt.test.subject as Subject;
  const curSeqIdx = SUBJECT_SEQUENCE.indexOf(curSubject);
  const nextSubject: Subject | undefined =
    curSeqIdx >= 0 ? SUBJECT_SEQUENCE[curSeqIdx + 1] : undefined;
  const isLastSubject = !nextSubject;
  const unansweredCount = totalQuestions - answeredCount;

  // Review'dagi asosiy tugma: tasdiq (javobsizlar bo'lsa ogohlantirish) va
  // yakunlash. Yuborilgach orqaga qaytib bo'lmaydi (backend ALREADY_SUBMITTED).
  const finishSubject = () => {
    let msg: string;
    if (isLastSubject) {
      msg = unansweredCount > 0
        ? t("confirmFinishUnanswered", { count: unansweredCount })
        : t("confirmFinish");
    } else {
      const vars = {
        count: unansweredCount,
        current: subjectLabel(lang, curSubject),
        next: subjectLabel(lang, nextSubject!),
      };
      msg = unansweredCount > 0 ? t("confirmNextUnanswered", vars) : t("confirmNextAll", vars);
    }
    if (confirm(msg)) submit(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bg)]">
      <header className="bg-navy text-white px-3 sm:px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="progress progress-glass flex-1">
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>

          {remainingSec != null && (
            <div
              className={`chip num tabular-nums ${lowTime ? "chip-neg" : "chip-glass"}`}
              style={lowTime ? { animation: "pulse-soft 1s ease-in-out infinite" } : undefined}
            >
              {formatTime(remainingSec)}
            </div>
          )}

          {/* "Yakunlash" endi to'g'ridan-to'g'ri yubormaydi — avval Ko'rib
              chiqish ekranini ochadi (javobsiz savollar ko'rinsin). */}
          <button
            onClick={() => setReviewing(true)}
            className="btn btn-neg btn-sm flex-none"
          >
            {t("finish")}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/70">
          <span className="truncate max-w-[50%]">{attempt.test.name}</span>
          <span>
            {t("questionWord")} <b className="num text-white">{idx + 1}</b>/<span className="num">{totalQuestions}</span>
            <span className="mx-2 opacity-40">·</span>
            {t("answeredCount")} <b className="num text-white">{answeredCount}</b>
          </span>
        </div>
      </header>

      {reviewing ? (
        <>
          {/* Ko'rib chiqish: barcha savollar — javob berilgan yashil,
              BERILMAGAN qizil. Raqamni bosib o'sha savolga qaytiladi. */}
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full p-4 sm:p-6">
              <div className="max-w-3xl mx-auto card p-5 sm:p-6 space-y-4 animate-rise">
                <div>
                  <h2 className="text-lg font-bold text-ink">{t("reviewTitle")}</h2>
                  <p className="text-sm text-muted mt-1">{t("reviewHint")}</p>
                </div>
                <span className={`chip ${unansweredCount > 0 ? "chip-neg" : "chip-pos"}`}>
                  {unansweredCount > 0
                    ? t("reviewUnansweredCount", { count: unansweredCount })
                    : t("reviewAllAnswered")}
                </span>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                  {attempt.questions.map((qq, i) => {
                    const answered = answeredValueSet(answers[qq.id]);
                    return (
                      <button
                        key={qq.id}
                        type="button"
                        onClick={() => { setIdx(i); setReviewing(false); }}
                        aria-label={`${t("questionNav", { n: i + 1 })}${answered ? t("answeredSuffix") : ""}`}
                        className={`num w-9 h-9 text-xs font-bold rounded-[8px] border-2 transition-colors ${
                          answered
                            ? "bg-pos-weak border-[#C9E7D8] text-[#1F7350]"
                            : "bg-neg-weak border-[#F3D3CE] text-[#9C3A2D]"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </main>

          <footer className="border-t border-line bg-surface px-3 sm:px-4 pt-3 pb-4">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                className="btn btn-ghost btn-sm flex-none"
              >
                {t("backToQuestions")}
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={finishSubject}
                className="btn btn-accent btn-sm flex-none"
              >
                {isLastSubject
                  ? t("finishExamBtn")
                  : t("goNextSubject", { subject: subjectLabel(lang, nextSubject!) })}
              </button>
            </div>
          </footer>
        </>
      ) : (
        <>
          {/* Savol kartasi ekran markazida — tepaga yopishib turmaydi.
              Markazlash ICHKI o'ramda (min-h-full + place-items-center), skroll
              esa tashqarida: aks holda kartadan balandroq savolda markazlash uning
              TEPASINI kesib qo'yadi va u yerga skroll qilib bo'lmaydi. */}
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full grid place-items-center p-4 sm:p-6">
              {/* key = savol id: savol almashganda karta qaytadan chiziladi va
                  slide animatsiyasi ishlaydi. */}
              <div key={q?.id ?? idx} className="w-full max-w-3xl card p-5 sm:p-6 lg:p-8 animate-slide-in">
              {q ? (
                <QuestionRenderer
                  lang={lang}
                  q={q}
                  answer={answers[q.id]}
                  onChange={(val) => {
                    const next = { ...answers, [q.id]: val };
                    setAnswersState(next);
                    // Fire-and-forget local save so refresh restores instantly.
                    saveAnswers(token, next).catch(() => undefined);
                  }}
                />
              ) : (
                <div className="text-muted">{t("noQuestion")}</div>
              )}
              </div>
            </div>
          </main>

          {/* pb: 3D tugmalarning pastki soyasi kesilmasin. */}
          <footer className="border-t border-line bg-surface px-3 sm:px-4 pt-3 pb-4">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="btn btn-ghost btn-sm flex-none"
              >
                {t("prev")}
              </button>

              {/* Bir qator, gorizontal skroll: 50 savolli Ingliz testida o'ralgan
                  to'r ikki-uch qatorga cho'zilib, ekranning yarmini yeb qo'yadi. */}
              <div ref={navRef} className="flex-1 flex gap-1.5 overflow-x-auto scroll-nav py-1">
                {attempt.questions.map((qq, i) => {
                  const answered = answeredValueSet(answers[qq.id]);
                  const current = i === idx;
                  return (
                    <button
                      key={qq.id}
                      type="button"
                      onClick={() => setIdx(i)}
                      aria-label={`${t("questionNav", { n: i + 1 })}${answered ? t("answeredSuffix") : ""}`}
                      aria-current={current ? "true" : undefined}
                      className={`num flex-none w-8 h-8 text-xs font-bold rounded-[8px] border-2 transition-colors ${
                        current
                          ? "bg-navy border-navy text-white"
                          : answered
                            ? "bg-pos-weak border-[#C9E7D8] text-[#1F7350]"
                            : "bg-surface border-line text-faint hover:border-line-strong"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Oxirgi savolda "Keyingi" o'rniga "Ko'rib chiqish" — u review
                  ekranini ochadi (disabled emas, hozir tugash yo'li shu). */}
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setReviewing(true)}
                  className="btn btn-accent btn-sm flex-none"
                >
                  {t("toReview")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.min(totalQuestions - 1, i + 1))}
                  className="btn btn-accent btn-sm flex-none"
                >
                  {t("next")}
                </button>
              )}
            </div>
          </footer>
        </>
      )}

      {/* To'liq ekrandan chiqilsa — savolni butunlay yopadigan oyna.
          Ilgari bu tepada ingichka qizil chiziq edi: test ortida to'liq
          o'qilib turardi va bolaga chiqishning hech qanday narxi yo'q edi.
          Endi savol blur ostida qoladi. Chiqishning O'ZINI to'xtatib
          bo'lmaydi (Esc/F11 brauzernikidir), lekin chiqqan joyda ishlash
          mumkin emas — natijada bu "chiqib ketolmaydi" bilan deyarli bir xil
          ishlaydi. Diqqat: taymer to'xtamaydi, vaqt ketaveradi. */}
      {!fs && phase === "started" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[rgba(6,17,60,0.55)] backdrop-blur-md grid place-items-center z-[60] p-4"
        >
          <div className="card p-6 text-center max-w-sm space-y-3 animate-rise">
            <div className="w-14 h-14 mx-auto rounded-full grid place-items-center bg-neg-weak text-neg text-2xl font-bold">
              !
            </div>
            <div className="font-bold text-ink text-lg">{t("fsBlockTitle")}</div>
            <p className="text-sm text-muted">{t("fsWarning")}</p>
            <button className="btn btn-accent btn-block" onClick={() => requestFullscreen()}>
              {t("fsReturn")}
            </button>
            {fsExits > 0 && (
              <div className="text-xs text-faint num">{t("fsExitCount", { n: fsExits })}</div>
            )}
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <div className="fixed inset-0 bg-[rgba(6,17,60,0.55)] backdrop-blur-sm grid place-items-center z-50">
          <div className="card p-6 text-center max-w-sm space-y-3 animate-rise">
            <div className="w-10 h-10 mx-auto rounded-full border-4 border-line border-t-accent animate-spin" />
            <div className="font-bold text-ink">{t("submitting")}</div>
            <div className="text-xs text-muted">{t("dontClose")}</div>
          </div>
        </div>
      )}

      {error && phase === "started" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-shake rounded-[12px] bg-neg text-white text-sm font-semibold px-4 py-2.5 shadow-lg max-w-[92vw]">
          {error}
        </div>
      )}
    </div>
  );
}

function answeredValueSet(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return String(v).length > 0;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
