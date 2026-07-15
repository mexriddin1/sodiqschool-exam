"use client";

// Lead detail — o'quvchi ma'lumotlari + testga urinishlari + agar natija
// yaratilgan bo'lsa unga link.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { resolveBack, withBack } from "@/lib/back-link";

interface Attempt {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  scoreRaw: number | null;
  scoreMax: number | null;
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
                  <th className="p-3">Natija</th>
                </tr>
              </thead>
              <tbody>
                {lead.attempts.map((a) => (
                  <tr key={a.id} className="border-b">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
