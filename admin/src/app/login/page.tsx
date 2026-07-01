"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof ApiException ? e.error.message : "Login failed";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <div className="admin-login-bg" aria-hidden="true">
        <div className="admin-blob b1" />
        <div className="admin-blob b2" />
        <div className="admin-blob b3" />
      </div>

      <div className="admin-login-brand">
        <img src="/logo-white.png" alt="Sodiq School" className="admin-brand-logo" />
        <div className="admin-brand-line">
          <div className="admin-brand-title">Sodiq School Admin</div>
          <div className="admin-brand-sub">Academic Assessment Office · Boshqaruv paneli</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="admin-login-card">
        <div className="admin-login-head">
          <h1>Kirish</h1>
          <p>Elektron pochta va parolingizni kiriting.</p>
        </div>

        <div>
          <label className="admin-lbl" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="admin-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@sodiqschool.uz"
            required
            autoFocus
            autoComplete="email"
          />
        </div>

        <div>
          <label className="admin-lbl" htmlFor="password">Parol</label>
          <div className="admin-pw-wrap">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="admin-pw-toggle"
              title={showPassword ? "Yashirish" : "Ko'rsatish"}
              aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              tabIndex={-1}
            >
              <Icon name={showPassword ? "x" : "view"} size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-err" role="alert">
            {error}
          </div>
        )}

        <button className="admin-submit" type="submit" disabled={pending}>
          {pending ? "Tekshirilmoqda…" : "Kirish"}
        </button>

        <div className="admin-help">
          Muammo bo'lsa — tizim administratoriga murojaat qiling.
        </div>
      </form>

      <style jsx>{`
        .admin-login-shell {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 24px;
          background: linear-gradient(135deg, #06113C 0%, #0A1D5C 45%, #1a2b7a 100%);
          overflow: hidden;
          isolation: isolate;
        }
        .admin-login-bg { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
        .admin-blob { position: absolute; border-radius: 50%; filter: blur(90px); }
        .admin-blob.b1 { width: 480px; height: 480px; background: #FF8A32; top: -160px; right: -140px; opacity: 0.32; animation: aDrift1 22s ease-in-out infinite; }
        .admin-blob.b2 { width: 420px; height: 420px; background: #3266C9; bottom: -140px; left: -140px; opacity: 0.28; animation: aDrift2 18s ease-in-out infinite; }
        .admin-blob.b3 { width: 280px; height: 280px; background: #FF8A32; top: 55%; left: 22%; opacity: 0.14; animation: aDrift3 26s ease-in-out infinite; }
        @keyframes aDrift1 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-40px,40px) scale(1.06);} }
        @keyframes aDrift2 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(50px,-30px) scale(1.08);} }
        @keyframes aDrift3 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(-30px,20px);} }
        @media (prefers-reduced-motion: reduce) { .admin-blob { animation: none; } }

        .admin-login-brand {
          display: flex; align-items: center; gap: 14px;
          color: white; text-align: left;
          animation: aLogoIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes aLogoIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .admin-brand-logo { width: 180px; max-width: 60vw; height: auto; display: block; }
        .admin-brand-line { display: none; }

        .admin-login-card {
          background: white;
          max-width: 420px;
          width: 100%;
          padding: 32px 28px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
          display: grid;
          gap: 14px;
          box-sizing: border-box;
          animation: aCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes aCardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .admin-login-head h1 { margin: 0; color: #06113C; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; }
        .admin-login-head p { margin: 4px 0 0; color: #4A5060; font-size: 0.9rem; }

        .admin-lbl {
          display: block; font-size: 0.78rem; font-weight: 600;
          color: #444; text-transform: uppercase; letter-spacing: 0.03em;
          margin-bottom: 6px;
        }
        .admin-input {
          display: block; width: 100%;
          padding: 11px 12px;
          border: 1.5px solid #d8dbe4; border-radius: 10px;
          font: inherit; color: #0F1629; background: white; outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .admin-input:focus { border-color: #06113C; box-shadow: 0 0 0 3px rgba(6, 17, 60, 0.15); }
        .admin-pw-wrap { position: relative; }
        .admin-pw-wrap .admin-input { padding-right: 44px; }
        .admin-pw-toggle {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: 44px; display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: 0; color: #6B7385; cursor: pointer; padding: 0;
        }
        .admin-pw-toggle:hover { color: #06113C; }

        .admin-err {
          color: #D2503F; background: #D2503F10; border: 1px solid #D2503F33;
          border-radius: 8px; padding: 8px 12px; font-size: 0.85rem;
        }

        .admin-submit {
          background: linear-gradient(135deg, #06113C 0%, #1a2b7a 100%);
          color: white;
          padding: 12px 14px;
          border: 0; border-radius: 10px;
          font-family: inherit; font-weight: 700; font-size: 0.95rem;
          letter-spacing: 0.02em; cursor: pointer;
          margin-top: 4px;
          box-shadow: 0 4px 12px rgba(6, 17, 60, 0.25);
          transition: transform 0.1s, box-shadow 0.2s, opacity 0.15s;
        }
        .admin-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(6, 17, 60, 0.35); }
        .admin-submit:active:not(:disabled) { transform: translateY(0); }
        .admin-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .admin-help {
          text-align: center; color: #6B7385; font-size: 0.8rem;
          padding-top: 4px;
        }

        @media (max-width: 400px) {
          .admin-brand-logo { width: 140px; }
          .admin-login-card { padding: 24px 20px; }
        }
      `}</style>
    </main>
  );
}
