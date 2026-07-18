"use client";

// Lead detail — o'quvchi ma'lumotlari + testga urinishlari + agar natija
// yaratilgan bo'lsa unga link.

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { resolveBack, withBack } from "@/lib/back-link";
import KatexInline from "@/components/KatexInline";

interface AnswerRow {
  n: number;
  type: string;
  student: string;
  correct: string;
  isCorrect: boolean;
}

interface Attempt {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  scoreRaw: number | null;
  scoreMax: number | null;
  fullscreenExits: number;
  // NB: `resultId` bu yerda yo'q — backend uni `include` da tanlamaydi, ya'ni
  // doim undefined edi. Natija havolasi `result` orqali quriladi.
  test: { id: string; name: string; subject: string; grade: number };
  result: { id: string; status: string; publicCode: string } | null;
}

interface LeadDetail {
  id: string;
  firstName: string;
  lastName: string;
  sex: string;
  phone: string;
  grade: number;
  examLanguage: string;
  previousSchool: string | null;
  status: string;
  studentId: string | null;
  createdAt: string;
  student: { id: string; loginCode: string | null; accessPassword: string | null } | null;
  attempts: Attempt[];
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  // Bu sahifaga bir necha joydan kelinadi — "orqaga" manzili
  // qattiq yozilmaydi, `?from=` bo'lsa o'shanga qaytadi.
  const back = resolveBack(useSearchParams(), { href: "/leads", label: "Leadlar ro'yxati" });
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);

  useEffect(() => {
    api<LeadDetail>(`/api/admin/leads/${params.id}`)
      .then(setLead)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="p-6 text-gray-500">Yuklanmoqda…</div>;
  if (!lead) return <div className="p-6 text-red-500">Lead topilmadi</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href={back.href} className="text-sm text-navy hover:underline">← {back.label}</Link>
      </div>
      <h1 className="text-2xl font-semibold text-navy">
        {lead.firstName} {lead.lastName}
      </h1>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-500">Sinf</div>
          <div className="font-medium">{lead.grade}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Til</div>
          <div className="font-medium">{lead.examLanguage}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Jinsi</div>
          <div className="font-medium">{lead.sex === "MALE" ? "O'g'il" : "Qiz"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Tel</div>
          <div className="font-medium">{lead.phone}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Oldingi maktab</div>
          <div className="font-medium">{lead.previousSchool || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Status</div>
          <div className="font-medium">{lead.status}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Ro'yxatdan o'tgan</div>
          <div className="font-medium">{new Date(lead.createdAt).toLocaleString("uz-UZ")}</div>
        </div>
        {lead.student?.loginCode && (
          <>
            <div>
              <div className="text-xs text-gray-500">Login kodi</div>
              <div className="font-mono">{lead.student.loginCode}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Parol</div>
              <div className="font-mono">{lead.student.accessPassword ?? "—"}</div>
            </div>
          </>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-navy mb-2">Test urinishlari</h2>
        {lead.attempts.length === 0 ? (
          <div className="card p-4 text-sm text-gray-500">Hali hech qanday testni boshlamadi.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="p-3">Test</th>
                  <th className="p-3">Fan</th>
                  <th className="p-3">Boshlangan</th>
                  <th className="p-3">Yakunlangan</th>
                  <th className="p-3">Ball</th>
                  <th className="p-3" title="O'quvchi test davomida to'liq ekrandan necha marta chiqqani">
                    Ekrandan chiqish
                  </th>
                  <th className="p-3">Natija</th>
                  <th className="p-3">Javoblar</th>
                </tr>
              </thead>
              <tbody>
                {lead.attempts.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="border-b">
                      <td className="p-3 font-medium">{a.test.name}</td>
                      <td className="p-3">{a.test.subject}</td>
                      <td className="p-3 text-xs">{new Date(a.startedAt).toLocaleString("uz-UZ")}</td>
                      <td className="p-3 text-xs">
                        {a.submittedAt ? new Date(a.submittedAt).toLocaleString("uz-UZ") : "—"}
                        {a.autoSubmitted && <span className="ml-1 text-orange-600 text-[10px]">(auto)</span>}
                      </td>
                      <td className="p-3">
                        {a.scoreRaw != null ? `${a.scoreRaw} / ${a.scoreMax}` : "—"}
                      </td>
                      {/* 0 marta chiqqan — normal holat, ko'zni tortmasin.
                          Chiqqan bo'lsa ko'rinsin, lekin bu ayblov emas: bola
                          Esc ni tasodifan bosishi ham mumkin. */}
                      <td className="p-3">
                        {a.fullscreenExits > 0 ? (
                          <span className="text-orange-600 font-medium">{a.fullscreenExits} marta</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="p-3">
                        {a.result ? (
                          // Natija sahifasi "orqaga" ni shu yerga qaytarsin —
                          // aks holda natijalar ro'yxatiga tashlab yuboradi.
                          <Link
                            href={withBack(`/results/${a.result.id}`, `/leads/${params.id}`, "Lead")}
                            className="text-navy underline"
                          >
                            {a.result.publicCode} ({a.result.status})
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setOpenAttempt(openAttempt === a.id ? null : a.id)}
                          className="text-navy text-xs hover:underline"
                        >
                          {openAttempt === a.id ? "Yopish" : "Ko'rish"}
                        </button>
                      </td>
                    </tr>
                    {openAttempt === a.id && (
                      <tr>
                        <td colSpan={8} className="p-3 bg-gray-50">
                          <AttemptAnswers attemptId={a.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Bitta urinishning savol-javoblari: Savol raqami | O'quvchi Javobi | To'g'ri
// javob. To'g'ri qatorlar yashil, noto'g'ri qizil. Javoblar KatexInline bilan
// (matematik ifodalar $...$ ichida keladi).
function AttemptAnswers({ attemptId }: { attemptId: string }) {
  const [rows, setRows] = useState<AnswerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ rows: AnswerRow[] }>(`/api/admin/attempts/${attemptId}/answers`)
      .then((d) => { if (alive) setRows(d.rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Xato"); });
    return () => { alive = false; };
  }, [attemptId]);

  if (error) return <div className="text-sm text-bad">{error}</div>;
  if (!rows) return <div className="text-sm text-gray-500">Yuklanmoqda…</div>;
  if (rows.length === 0) return <div className="text-sm text-gray-500">Savol yo'q.</div>;

  return (
    <div className="overflow-x-auto rounded border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b">
            <th className="p-2 w-20">Savol raqami</th>
            <th className="p-2">O'quvchi Javobi</th>
            <th className="p-2">To'g'ri javob</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className={`border-b ${r.isCorrect ? "bg-green-50" : "bg-red-50"}`}>
              <td className="p-2 num align-top">{r.n}</td>
              <td className="p-2 align-top"><KatexInline source={r.student} /></td>
              <td className="p-2 align-top"><KatexInline source={r.correct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
