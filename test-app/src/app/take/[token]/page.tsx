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

interface Attempt {
  token: string;
  attemptId: string;
  test: { id: string; name: string; subject: string; grade: number; durationSec: number | null };
  startedAt: string;
  questions: ClientQuestion[];
  answers?: Record<string, unknown>;
  finished?: boolean;
}

export default function TakeTestPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswersState] = useState<Record<string, unknown>>({});
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [fs, setFs] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "started" | "submitting" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const submittedRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
          });
          const local = await loadAnswers(token);
          setAnswersState(local);
          setPhase("ready");
          setError("Internet uzilgan — javoblaringiz kompyuteringizda saqlanadi va internet tiklanganda serverga yuboriladi.");
        } else {
          setError(e instanceof Error ? e.message : "Testni yuklab bo'lmadi");
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
  useEffect(() => {
    const off = onFullscreenChange(() => setFs(isFullscreen()));
    return off;
  }, []);

  // 4) Autosave every 5s to server + IndexedDB (best-effort).
  useEffect(() => {
    if (phase !== "started") return;
    autosaveTimer.current = setInterval(async () => {
      try {
        await saveAnswers(token, answers);
      } catch { /* ignore */ }
      try {
        await api(`/api/test-taking/attempts/${token}/answers`, {
          method: "PATCH",
          body: JSON.stringify({ answers }),
        });
      } catch {
        /* Server unreachable — javoblar lokal saqlanadi, next tick qaytadan urinamiz */
      }
    }, 5000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [phase, token, answers]);

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
          body: JSON.stringify({ answers, autoSubmitted }),
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
        setError("Internet ulanishini tekshirib qaytadan yuborishga urining.");
      } else {
        setError(e instanceof Error ? e.message : "Yuborishda xato yuz berdi.");
      }
    }
  }, [answers, router, token]);

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
    return <div className="p-10 text-center text-gray-500">Yuklanmoqda…</div>;
  }
  if (phase === "error") {
    return (
      <div className="p-10 text-center max-w-md mx-auto">
        <div className="text-red-600 font-semibold mb-3">Xato</div>
        <div className="text-sm text-gray-700">{error}</div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-5">
        <div className="card p-6 space-y-4">
          <h1 className="text-xl font-semibold text-navy">{attempt.test.name}</h1>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>Test to'liq ekran (fullscreen) rejimida topshiriladi. Chiqishga urunish tizim tomonidan qayd qilinadi.</li>
            <li>Savollar soni: {attempt.questions.length}</li>
            {attempt.test.durationSec && (
              <li>Vaqt: {Math.round(attempt.test.durationSec / 60)} daqiqa. Vaqt tugagach test avtomatik yuboriladi.</li>
            )}
            <li>Sahifa yopilib qolsa yoki refresh bo'lsa, javoblaringiz saqlanib qoladi.</li>
            <li>Testni topshirib bo'lgach, natijangizni administrator chop etadi.</li>
          </ul>
          {error && <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">{error}</div>}
          <button
            onClick={async () => {
              await requestFullscreen();
              setPhase("started");
              setFs(isFullscreen());
            }}
            className="w-full rounded bg-navy text-white py-3 text-sm font-semibold"
          >
            Testni boshlash
          </button>
        </div>
      </div>
    );
  }

  const q = attempt.questions[idx];

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-navy text-white">
        <div className="text-sm">
          <span className="font-semibold">{attempt.test.name}</span>
          <span className="ml-3 opacity-75">Savol {idx + 1} / {totalQuestions}</span>
          <span className="ml-3 opacity-75">Javob berilgan: {answeredCount}</span>
        </div>
        <div className="flex items-center gap-3">
          {remainingSec != null && (
            <div className={`font-mono text-lg ${remainingSec < 60 ? "text-red-300" : ""}`}>
              {formatTime(remainingSec)}
            </div>
          )}
          <button
            onClick={() => {
              if (confirm("Testni yakunlashni xohlaysizmi? Undan keyin javoblaringizni o'zgartira olmaysiz.")) {
                submit(false);
              }
            }}
            className="rounded bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1"
          >
            Yakunlash
          </button>
        </div>
      </header>

      {!fs && (
        <div className="bg-red-500 text-white text-sm text-center py-2">
          Test ekran to'liq rejimida topshirilishi kerak.{" "}
          <button className="underline" onClick={() => requestFullscreen()}>
            To'liq ekranga qaytish
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto card p-6">
          {q ? (
            <QuestionRenderer
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
            <div className="text-gray-500">Savol topilmadi.</div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          ← Oldingi
        </button>
        <div className="flex flex-wrap gap-1 max-w-xl">
          {attempt.questions.map((qq, i) => {
            const answered = answeredValueSet(answers[qq.id]);
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setIdx(i)}
                className={`w-8 h-8 text-xs rounded border ${i === idx ? "bg-navy text-white border-navy" : answered ? "bg-emerald-100 border-emerald-300" : "bg-white border-gray-300"}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(totalQuestions - 1, i + 1))}
          disabled={idx >= totalQuestions - 1}
          className="rounded bg-navy text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          Keyingi →
        </button>
      </footer>

      {phase === "submitting" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 text-center max-w-sm">
            <div className="animate-pulse text-navy font-semibold">Yuborilmoqda…</div>
            <div className="text-xs text-gray-500 mt-2">Iltimos, kutib turing. Sahifani yopmang.</div>
          </div>
        </div>
      )}

      {error && phase === "started" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-2 rounded shadow-lg">
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
