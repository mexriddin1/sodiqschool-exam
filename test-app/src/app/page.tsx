"use client";

// natijalar.sodiqschool.uz — bosh sahifa. O'quvchi ma'lumotlari (form) va
// keyingi qadam (mos testlar ro'yxati) shu yerdan boshlanadi.
//
// MAQSADLI QURILMA — PLANSHET, telefon emas. Shuning uchun tik ustun emas,
// ikki ustun: chapda brend bloki, o'ngda forma. Planshet eni (~1024px) bemalol
// yetadi va butun forma bitta ekranga sig'adi — bola skroll qilmaydi.
//
// Sinf va til <select> emas, segment: variantlar soni kichik (7 va 3) va
// barmoq bilan ishlanadi — ochiladigan ro'yxat bu yerda faqat ortiqcha tegish.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { DEFAULT_LANG, LANGS, tr, type Lang } from "@/lib/i18n";
import { formatUzNational, isUzPhoneComplete, toE164 } from "@/lib/phone";
import { clearGateToken, getGateToken } from "@/lib/gate";
import { GateScreen } from "@/components/GateScreen";

const GRADES = [5, 6, 7, 8, 9, 10, 11];
const LANG_KEY = { UZ: "langUZ", RU: "langRU", EN: "langEN" } as const;

export default function HomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<"MALE" | "FEMALE" | "">("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [examLanguage, setExamLanguage] = useState<Lang | "">("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Test ochiqmi. `null` — hali bilinmadi (forma ko'rsatilmaydi, aks holda
  // bola to'ldirib bo'lgach "yopiq" xatosini ko'rardi).
  const [open, setOpen] = useState<boolean | null>(null);
  // Parol talab qilinadimi va bu qurilma kirganmi.
  const [gateNeeded, setGateNeeded] = useState(false);
  const [passed, setPassed] = useState(false);

  // Til tanlanishi bilan interfeys darhol o'zgaradi — tanlanmaguncha o'zbekcha.
  const lang: Lang = examLanguage || DEFAULT_LANG;
  const t = (k: Parameters<typeof tr>[1]) => tr(lang, k);

  useEffect(() => {
    // Xato bo'lsa ochiq deb hisoblaymiz: haqiqiy to'siq baribir backendda
    // (requireFunnelAccess), bu faqat ko'rsatish uchun.
    api<{ funnelOpen: boolean; funnelGate: boolean }>("/api/public/config")
      .then((d) => {
        setOpen(d.funnelOpen !== false);
        setGateNeeded(d.funnelGate === true);
        // Token bor bo'lsa — qurilma allaqachon kirgan. To'g'riligini
        // tekshirmaymiz: eskirgan bo'lsa birinchi so'rovda 401 keladi va
        // api.ts uni tozalaydi.
        setPassed(getGateToken() !== null);
      })
      .catch(() => setOpen(true));
  }, []);

  function logout() {
    if (!confirm(t("logoutConfirm"))) return;
    clearGateToken();
    setPassed(false);
  }

  const phoneOk = isUzPhoneComplete(phone);
  const filled = [firstName, lastName, sex, phoneOk, grade, examLanguage].filter(Boolean).length;
  const progress = Math.round((filled / 6) * 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName || !lastName || !sex || !phone || !grade || !examLanguage) {
      setError(t("fillAll"));
      return;
    }
    if (!phoneOk) {
      setError(t("phoneIncomplete"));
      return;
    }
    setSubmitting(true);
    try {
      const { leadId } = await api<{ leadId: string }>("/api/test-taking/leads", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          sex,
          phone: toE164(phone),
          grade: Number(grade),
          examLanguage,
          previousSchool: previousSchool.trim() || undefined,
        }),
      });
      sessionStorage.setItem("sodiq_lead_id", leadId);
      router.push(`/tests?lead=${leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  // Parol talab qilinadi va bu qurilma hali kirmagan.
  // Yopiq/ochiq tekshiruvidan KEYIN emas, oldin ham emas — yopiq bo'lsa
  // parol so'ramaymiz, chunki kiritsa ham foydasi yo'q.
  if (open === true && gateNeeded && !passed) {
    return <GateScreen onPass={() => setPassed(true)} />;
  }

  // Test yopiq — forma umuman ko'rsatilmaydi.
  if (open === false) {
    return (
      <div className="min-h-screen grid place-items-center p-4 sm:p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4 animate-rise">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="Sodiq School" className="h-10 w-auto mx-auto" />
          <div
            className="w-16 h-16 mx-auto rounded-full grid place-items-center"
            style={{ background: "var(--inset)", color: "var(--faint)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl">{tr(DEFAULT_LANG, "closedTitle")}</h1>
          <p className="text-sm text-muted">{tr(DEFAULT_LANG, "closedText")}</p>
          <div className="text-xs text-faint pt-2 border-t border-line">{tr(DEFAULT_LANG, "slogan")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-stretch">
        <header className="hero p-6 lg:p-8 flex flex-col justify-center animate-rise">
          {/* self-start SHART: header — flex ustun, va uning standart
              `align-items: stretch` qiymati rasmni butun kenglikka cho'zib,
              logoni buzadi (44px balandlikda 342px kenglik — nisbati 2.74:1
              bo'lsa ~121px bo'lishi kerak). w-auto buni to'xtatmaydi. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Sodiq School" className="h-11 w-auto self-start mb-7" />
          <h1 className="text-white text-3xl lg:text-4xl">{t("homeTitle")}</h1>
          <p className="text-[#C3CBE6] text-sm mt-3 max-w-[34ch]">
            {t("homeLead")}
          </p>
          <div className="mt-auto pt-8 flex items-end justify-between gap-3">
            <span className="text-xs text-[#8893B8] hidden md:block">{t("slogan")}</span>
            {/* Chiqish FAQAT shu yerda: qurilmani kun oxirida xodim chiqaradi.
                Test ichida ko'rsatilsa, bola adashib bosishi mumkin edi. */}
            {gateNeeded && passed && (
              <button
                type="button"
                onClick={logout}
                className="text-xs text-[#8893B8] hover:text-white underline underline-offset-2"
              >
                {t("logout")}
              </button>
            )}
          </div>
        </header>

        <form onSubmit={submit} className="card p-5 lg:p-6 space-y-4 animate-rise" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg">{t("studentInfo")}</h2>
          <span className="chip num">{filled}/6</span>
        </div>
        <div className="progress progress-sm">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">{t("firstName")}</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="field"
              placeholder="Alisher"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="lastName">{t("lastName")}</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="field"
              placeholder="Karimov"
              required
            />
          </div>
        </div>

        {/* Jins va telefon yonma-yon — ikkalasi ham tor, alohida qator
            olishning hojati yo'q. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">{t("sex")}</span>
            <div className="flex gap-2">
              {(["MALE", "FEMALE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  aria-pressed={sex === s}
                  className={`seg ${sex === s ? "is-picked" : ""}`}
                >
                  {s === "MALE" ? t("male") : t("female")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="phone">{t("phone")}</label>
            {/* +998 input ICHIDA emas: aks holda foydalanuvchi o'zi "998..."
                yozganda uni niqob prefiksidan ajratib bo'lmaydi — va "99"
                ning o'zi ham haqiqiy operator kodi. */}
            <div className="field field-group">
              <span className="num text-muted select-none">+998</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(formatUzNational(e.target.value))}
                className="num flex-1 bg-transparent border-0 outline-none p-0 text-ink"
                placeholder="(90) 123-45-67"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="previousSchool">{t("previousSchool")}</label>
          <input
            id="previousSchool"
            type="text"
            value={previousSchool}
            onChange={(e) => setPreviousSchool(e.target.value)}
            className="field"
            placeholder={t("previousSchoolHint")}
            maxLength={200}
          />
        </div>

        <div>
          <span className="label">{t("gradeLabel")}</span>
          {/* 7 ta sinf bitta qatorda — planshetda joy yetadi. */}
          <div className="grid grid-cols-7 gap-1.5">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                aria-pressed={grade === g}
                className={`seg num ${grade === g ? "is-picked" : ""}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">{t("examLang")}</span>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setExamLanguage(l)}
                aria-pressed={examLanguage === l}
                className={`seg ${examLanguage === l ? "is-picked" : ""}`}
              >
                {tr(l, LANG_KEY[l])}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="animate-shake rounded-[10px] border-2 border-[#F3D3CE] bg-neg-weak px-4 py-3 text-sm font-semibold text-[#9C3A2D]">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn btn-accent btn-block">
          {submitting ? t("sending") : t("continue")}
        </button>
        </form>
      </div>
    </div>
  );
}
