"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiException } from "@/lib/api";
import { Icon } from "@/components/Icon";

const SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "narrative",   label: "Batafsil tahlil",       hint: "Bir qarashda, uch fan bo'yicha diagnostik hikoya" },
  { key: "roadmap",     label: "Rivojlanish yo'li",     hint: "3/6/12 oylik dastur va oylik reja" },
  { key: "risks_notes", label: "Xatarlar va xulosalar", hint: "Xatarlar tahlili, ota-ona va komissiya xulosasi" },
];

const CONFIRM_WORD = "TOZALASH";

type ClearStep = "idle" | "confirm" | "done";

interface ClearResult {
  deletedStudents: number;
  deletedResults: number;
  deletedAuditLogs: number;
}

export default function SettingsPage() {
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // ---- qabul testi ochiq/yopiq ----
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [funnelSaving, setFunnelSaving] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  // ---- qabul testi paroli ----
  const [pwSet, setPwSet] = useState(false);
  const [pwUpdatedAt, setPwUpdatedAt] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSavedAt, setPwSavedAt] = useState<Date | null>(null);

  // ---- contact phone state ----
  const [phone, setPhone] = useState<string>("");
  const [phoneLoading, setPhoneLoading] = useState(true);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSavedAt, setPhoneSavedAt] = useState<Date | null>(null);

  // ---- clear-data state ----
  const [clearStep, setClearStep] = useState<ClearStep>("idle");
  const [clearWord, setClearWord] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<ClearResult | null>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ sections: string[] }>(`/api/admin/settings/default-unlocked-sections`)
      .then((d) => setUnlocked(new Set(d.sections)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    api<{ phone: string }>(`/api/admin/settings/contact-phone`)
      .then((d) => setPhone(d.phone ?? ""))
      .catch(() => undefined)
      .finally(() => setPhoneLoading(false));
    api<{ open: boolean }>(`/api/admin/settings/funnel-open`)
      .then((d) => setFunnelOpen(d.open === true))
      .catch(() => undefined)
      .finally(() => setFunnelLoading(false));
    api<{ set: boolean; updatedAt: string | null }>(`/api/admin/settings/funnel-password`)
      .then((d) => { setPwSet(d.set === true); setPwUpdatedAt(d.updatedAt); })
      .catch(() => undefined);
  }, []);

  async function onSavePassword() {
    setPwSaving(true);
    setPwError(null);
    try {
      const r = await api<{ set: boolean; updatedAt: string | null }>(`/api/admin/settings/funnel-password`, {
        method: "PUT",
        body: JSON.stringify({ password: pwInput }),
      });
      setPwSet(r.set);
      setPwUpdatedAt(r.updatedAt);
      setPwInput("");
      setPwSavedAt(new Date());
    } catch (e) {
      setPwError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setPwSaving(false);
    }
  }

  async function onRemovePassword() {
    if (!confirm("Parol olib tashlansinmi? Shundan keyin test ochiq bo'lsa hech qanday parolsiz kirish mumkin bo'ladi.")) return;
    setPwSaving(true);
    setPwError(null);
    try {
      await api(`/api/admin/settings/funnel-password`, { method: "DELETE" });
      setPwSet(false);
      setPwUpdatedAt(null);
      setPwSavedAt(new Date());
    } catch (e) {
      setPwError(e instanceof ApiException ? e.error.message : "Xato");
    } finally {
      setPwSaving(false);
    }
  }

  async function onToggleFunnel(next: boolean) {
    setFunnelSaving(true);
    setFunnelError(null);
    try {
      const r = await api<{ open: boolean }>(`/api/admin/settings/funnel-open`, {
        method: "PUT",
        body: JSON.stringify({ open: next }),
      });
      setFunnelOpen(r.open === true);
    } catch (e) {
      setFunnelError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setFunnelSaving(false);
    }
  }

  async function onSavePhone() {
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const r = await api<{ phone: string }>(`/api/admin/settings/contact-phone`, {
        method: "PUT",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setPhone(r.phone ?? "");
      setPhoneSavedAt(new Date());
    } catch (e) {
      setPhoneError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setPhoneSaving(false);
    }
  }

  function toggle(key: string) {
    setUnlocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ sections: string[] }>(`/api/admin/settings/default-unlocked-sections`, {
        method: "PUT",
        body: JSON.stringify({ sections: Array.from(unlocked) }),
      });
      setUnlocked(new Set(r.sections));
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  }

  function openClear() {
    setClearStep("confirm");
    setClearWord("");
    setClearError(null);
    setClearResult(null);
    setTimeout(() => confirmInputRef.current?.focus(), 60);
  }

  function cancelClear() {
    setClearStep("idle");
    setClearWord("");
    setClearError(null);
  }

  async function executeClear() {
    if (clearWord !== CONFIRM_WORD) return;
    setClearing(true);
    setClearError(null);
    try {
      const r = await api<ClearResult>(`/api/admin/settings/clear-data`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });
      setClearResult(r);
      setClearStep("done");
    } catch (e) {
      setClearError(e instanceof ApiException ? e.error.message : "Tozalashda xato yuz berdi");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold text-navy">Sozlamalar</h1>

      {/* ---- qabul testi ochiq/yopiq ----
           Eng tepada: imtihon kuni eng ko'p ishlatiladigan boshqaruv shu.
           Holat rang bilan ham ko'rinadi — "ochiq qolib ketdi" holatini
           sahifaga kirgan zahoti sezish uchun. */}
      <div
        className="card p-4 space-y-3"
        style={
          funnelLoading
            ? undefined
            : funnelOpen
              ? { borderColor: "#C9E7D8", background: "#F5FBF8" }
              : { borderColor: "#E8EAEF" }
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-navy">Onlayn qabul testi</div>
            <div className="text-xs text-gray-500 mt-0.5 max-w-[62ch]">
              test.sodiqschool.uz saytini yoqadi yoki o'chiradi. Yopiq bo'lsa, hech kim yangi
              test boshlay olmaydi — sayt ochilganda "hozircha yopiq" deb yozadi. Test yozib
              o'tirganlar ishini yo'qotmaydi: boshlangan urinishlar yakunlanaveradi.
            </div>
          </div>
          {!funnelLoading && (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-none ${
                funnelOpen ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {funnelOpen ? "OCHIQ" : "YOPIQ"}
            </span>
          )}
        </div>

        {funnelLoading ? (
          <div className="text-sm text-gray-500 py-3">Yuklanmoqda…</div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleFunnel(!funnelOpen)}
              disabled={funnelSaving}
              className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                funnelOpen ? "bg-[#D2503F] hover:opacity-90" : "bg-[#2F9E6B] hover:opacity-90"
              }`}
            >
              {funnelSaving ? "Saqlanmoqda…" : funnelOpen ? "Testni yopish" : "Testni ochish"}
            </button>
            <a
              href="https://test.sodiqschool.uz"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-navy underline"
            >
              Saytni ko'rish →
            </a>
          </div>
        )}

        {funnelOpen && !funnelLoading && !pwSet && (
          <div className="text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded px-3 py-2">
            Parol o'rnatilmagan — ochiq turganda havolani bilgan <b>istalgan odam istalgan
            qurilmadan</b> test topshira oladi. Pastdan parol qo'ying.
          </div>
        )}

        {funnelError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {funnelError}
          </div>
        )}

        {/* ---- kirish paroli ---- */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-navy">Kirish paroli</div>
              <div className="text-xs text-gray-500 mt-0.5 max-w-[62ch]">
                Sayt ochilganda shu parol so'raladi. Maktab laptopiga bir marta kiritiladi va
                qurilma <b>o'zi "Chiqish" bosmaguncha</b> esda qoladi. Parolni almashtirsangiz —
                barcha qurilmalar chiqib ketadi va qaytadan kiritishga to'g'ri keladi.
              </div>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-none ${
                pwSet ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
              }`}
            >
              {pwSet ? "O'RNATILGAN" : "YO'Q"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-1 max-w-xs"
              placeholder={pwSet ? "Yangi parol" : "Parol (kamida 6 belgi)"}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={onSavePassword}
              disabled={pwSaving || pwInput.trim().length < 6}
              className="rounded bg-navy text-white px-4 py-2 text-sm disabled:opacity-60"
            >
              {pwSaving ? "Saqlanmoqda…" : pwSet ? "Almashtirish" : "O'rnatish"}
            </button>
            {pwSet && (
              <button
                type="button"
                onClick={onRemovePassword}
                disabled={pwSaving}
                className="text-xs text-gray-500 hover:text-red-600 underline disabled:opacity-60"
              >
                Olib tashlash
              </button>
            )}
          </div>

          {/* Parol ochiq matnda ko'rsatiladi (type=text): xodim uni 5 ta
              laptopga ko'chirishi kerak, yulduzcha ostida bo'lsa xato yozadi.
              Saqlangach maydon tozalanadi va parol qayta ko'rsatilmaydi. */}
          <div className="text-xs text-gray-400">
            {pwUpdatedAt && `Oxirgi o'zgargan: ${new Date(pwUpdatedAt).toLocaleString("uz-UZ")}`}
            {pwSavedAt && !pwUpdatedAt && "Saqlandi"}
          </div>

          {pwError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {pwError}
            </div>
          )}
        </div>
      </div>

      {/* ---- default unlocked sections ---- */}
      <div className="card p-4 space-y-3">
        <div>
          <div className="font-medium text-navy">Yangi natijalar uchun ochiq bo'limlar</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Natija yaratilganda (bir-bir yaratish yoki CSV/JSON bulk import) ota-ona uchun avtomatik ochiladigan
            bo'limlar. Ochilmagan bo'limlar "yopiq" ko'rinadi va admin keyin natija sahifasidan qo'lda ocha oladi.
            Umumiy ball, fan kartalari, sinf natija doim ochiq turadi.
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-6 text-center">Yuklanmoqda…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {SECTIONS.map((s) => {
              const on = unlocked.has(s.key);
              return (
                <button
                  type="button"
                  key={s.key}
                  disabled={saving}
                  onClick={() => toggle(s.key)}
                  className={`text-left p-3 rounded-lg border transition ${
                    on ? "bg-good/10 border-good" : "bg-white border-gray-200 hover:border-navy"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{s.label}</div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        on ? "bg-good text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {on ? "Ochiq" : "Yopiq"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{s.hint}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={onSave}
            disabled={saving || loading}
          >
            <Icon name="save" size={14} />
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
          {savedAt && !saving && (
            <span className="text-xs text-good">✓ Saqlandi ({savedAt.toLocaleTimeString()})</span>
          )}
        </div>

        {error && <div className="text-bad text-sm">{error}</div>}
      </div>

      <div className="text-xs text-gray-500">
        Eslatma: bu sozlama <b>faqat yangi yaratilgan natijalar</b>ga ta'sir qiladi. Mavjud natijalar uchun
        "Ota-ona uchun bo'limlar" panelini natija sahifasida alohida boshqaring.
      </div>

      {/* ---- contact phone ---- */}
      <div className="card p-4 space-y-3">
        <div>
          <div className="font-medium text-navy">Aloqa telefon raqami</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Yopiq bo'lim kartasida va hisobot sahifasidagi "Bog'lanish" tugmasida ko'rsatiladi.
            Ota-ona shu raqam orqali maktab bilan bog'lanishi mumkin.
          </div>
        </div>
        {phoneLoading ? (
          <div className="text-sm text-gray-500 py-6 text-center">Yuklanmoqda…</div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="tel"
              className="input flex-1 max-w-sm"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={phoneSaving}
            />
            <button
              className="btn-primary inline-flex items-center gap-2"
              onClick={onSavePhone}
              disabled={phoneSaving}
            >
              <Icon name="save" size={14} />
              {phoneSaving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
            {phoneSavedAt && !phoneSaving && (
              <span className="text-xs text-good">✓ Saqlandi ({phoneSavedAt.toLocaleTimeString()})</span>
            )}
          </div>
        )}
        {phoneError && <div className="text-bad text-sm">{phoneError}</div>}
      </div>

      {/* ---- danger zone: clear all data ---- */}
      <div className="card p-4 border border-bad/30 space-y-3">
        <div>
          <div className="font-medium text-bad">Xavfli zona</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Quyidagi amal qaytarib bo'lmaydi. Imtihon shablonlari, fanlar va admin foydalanuvchilar
            saqlanib qoladi. Faqat o'quvchilar, natijalar va audit jurnali o'chiriladi.
          </div>
        </div>

        {clearStep === "idle" && (
          <button
            type="button"
            onClick={openClear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-bad text-bad text-sm font-medium hover:bg-bad/10 transition"
          >
            <Icon name="delete" size={14} />
            Ma'lumotlarni tozalash
          </button>
        )}

        {clearStep === "confirm" && (
          <div className="space-y-3">
            <div className="bg-bad/10 border border-bad/30 rounded-lg p-3 text-sm text-bad space-y-1">
              <div className="font-semibold">Bu amal quyidagilarni o'chiradi:</div>
              <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                <li>Barcha o'quvchilar (Student)</li>
                <li>Barcha natijalar va savol javoblari (Result, SubjectResult)</li>
                <li>Barcha audit jurnali yozuvlari (AuditLog)</li>
              </ul>
              <div className="font-semibold mt-2">Saqlanib qoladi:</div>
              <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                <li>Admin foydalanuvchilar</li>
                <li>Imtihonlar (Exam)</li>
                <li>Test shablonlari (TestTemplate)</li>
                <li>Fanlar va sozlamalar</li>
              </ul>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Tasdiqlash uchun <span className="font-mono font-bold text-bad">{CONFIRM_WORD}</span> deb yozing:
              </label>
              <input
                ref={confirmInputRef}
                type="text"
                className="input font-mono"
                placeholder={CONFIRM_WORD}
                value={clearWord}
                onChange={(e) => setClearWord(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && clearWord === CONFIRM_WORD && executeClear()}
                disabled={clearing}
              />
            </div>

            {clearError && <div className="text-bad text-sm">{clearError}</div>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={executeClear}
                disabled={clearWord !== CONFIRM_WORD || clearing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bad text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition"
              >
                <Icon name="delete" size={14} />
                {clearing ? "Tozalanmoqda…" : "Ha, barcha ma'lumotlarni o'chir"}
              </button>
              <button
                type="button"
                onClick={cancelClear}
                disabled={clearing}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-400 transition"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        )}

        {clearStep === "done" && clearResult && (
          <div className="bg-good/10 border border-good/30 rounded-lg p-3 text-sm space-y-1">
            <div className="font-semibold text-good">✓ Muvaffaqiyatli tozalandi</div>
            <ul className="text-xs text-gray-600 space-y-0.5 mt-1">
              <li>O'quvchilar o'chirildi: <b>{clearResult.deletedStudents}</b></li>
              <li>Natijalar o'chirildi: <b>{clearResult.deletedResults}</b></li>
              <li>Audit yozuvlari o'chirildi: <b>{clearResult.deletedAuditLogs}</b></li>
            </ul>
            <button
              type="button"
              onClick={() => { setClearStep("idle"); setClearResult(null); }}
              className="mt-2 text-xs text-gray-500 underline hover:text-gray-700"
            >
              Yopish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
