"use client";

// Kirish paroli ekrani — maktab laptopiga bir marta kiritiladi.
//
// Parol to'g'ri bo'lsa backend token beradi va u localStorage'da qoladi:
// qurilma o'zi "Chiqish" bosmaguncha qayta so'ralmaydi (lib/gate.ts).
//
// Interfeys tili bu yerda TANLANMAGAN — parol so'ralayotganda hali lead yo'q,
// ya'ni til noma'lum. Shuning uchun standart (o'zbek).

import { useState } from "react";
import { api, ApiException } from "@/lib/api";
import { setGateToken } from "@/lib/gate";
import { DEFAULT_LANG, tr } from "@/lib/i18n";

export function GateScreen({ onPass }: { onPass: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (k: Parameters<typeof tr>[1]) => tr(DEFAULT_LANG, k);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string | null }>("/api/test-taking/gate", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (r.token) setGateToken(r.token);
      onPass();
    } catch (err) {
      setError(
        err instanceof ApiException && err.code === "BAD_PASSWORD"
          ? t("gateWrong")
          : err instanceof Error
            ? err.message
            : t("gateWrong"),
      );
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 sm:p-6">
      <form onSubmit={submit} className="card p-8 max-w-sm w-full text-center space-y-4 animate-rise">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-light.png" alt="Sodiq School" className="h-10 w-auto mx-auto" />

        <div
          className="w-14 h-14 mx-auto rounded-full grid place-items-center"
          style={{ background: "var(--accent-weak)", color: "var(--accent-ink)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl">{t("gateTitle")}</h1>
          <p className="text-sm text-muted mt-1.5">{t("gateText")}</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field text-center"
          placeholder={t("gatePlaceholder")}
          autoFocus
          autoComplete="off"
        />

        {error && (
          <div className="animate-shake rounded-[10px] border-2 border-[#F3D3CE] bg-neg-weak px-3 py-2 text-sm font-semibold text-[#9C3A2D]">
            {error}
          </div>
        )}

        <button type="submit" disabled={busy || !password.trim()} className="btn btn-accent btn-block">
          {busy ? t("gateChecking") : t("gateEnter")}
        </button>

        <div className="text-xs text-faint pt-2 border-t border-line">{t("slogan")}</div>
      </form>
    </div>
  );
}
