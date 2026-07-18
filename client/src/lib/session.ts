// Session helpers for the Astro client. The Astro server holds the result
// session as a cookie on its own origin (sodiq_client_token), and forwards it
// to the backend as `Authorization: Bearer` for /api/result/me. This avoids
// cross-origin cookie issues in dev (different ports) while keeping the JWT
// httpOnly to the user.

import type { APIContext, AstroCookies } from "astro";

export const SESSION_COOKIE = "sodiq_client_token";
export const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:4000";

export function getSessionToken(cookies: AstroCookies): string | null {
  return cookies.get(SESSION_COOKIE)?.value ?? null;
}

export interface PublicResultPayload {
  student: { fullName: string; grade: number; sex: "MALE" | "FEMALE" | null };
  exam: {
    title: string;
    examDate: string;
    grade: number;
    academicYear: string | null;
    cohortSize: number | null;
    // { weights: { math, english, criticalThinking } } — composite weight source.
    gradingConfiguration?: unknown;
  };
  publishedAt: string | null;
  manualContent: Record<string, unknown>;
  subjects: {
    subject: "MATH" | "ENGLISH" | "CRITICAL_THINKING";
    totalQuestions: number;
    totalMarks: number;
    questions: unknown[];
    realData: { percentile: number | null; cohortAverage: number | null; avgTimeSec: number | null } | null;
    manualNotes: { strength?: string; growthLabel?: string } | null;
  }[];
  calculatedSnapshot: Record<string, unknown> | null;
  aiNarrative: {
    math?:              { diagnostika?: string; tahlil?: string; growth?: string; skills?: string; bloom?: string; reasoning?: string };
    english?:           { diagnostika?: string; tahlil?: string; growth?: string; skills?: string; bloom?: string };
    criticalThinking?:  { diagnostika?: string; tahlil?: string; growth?: string; skills?: string; bloom?: string };
    summary?:           { crossCutting?: string; finalRecommendation?: string };
  } | null;
  // Which report sections the parent has been granted access to. Overview
  // metrics are always shown; everything else is gated on this list.
  unlockedSections?: string[];
  // "Rivojlanish yo'li" (roadmap) DOIMIY toggle emas — publish yoki admin
  // "ochish" paytidan 20 daqiqagina ochiq. Server hisoblaydi. "O'sish
  // ko'rsatkichi" bundan mustaqil (doim ochiq).
  roadmapOpen?: boolean;
}

/**
 * Autentifikatsiya qilingan natijani qaytaradi. Query'da ?resultId=... bo'lsa
 * shu ID uzatiladi (student uchun bir necha natija bo'lgan holatda tanlash);
 * aks holda backend student uchun birinchi natijani tanlaydi.
 */
export async function fetchMyResult(ctx: APIContext): Promise<PublicResultPayload | null> {
  const token = getSessionToken(ctx.cookies);
  if (!token) return null;
  try {
    const resultId = ctx.url.searchParams.get("resultId");
    const url = new URL(`${API_URL}/api/result/me`);
    if (resultId) url.searchParams.set("resultId", resultId);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Any non-2xx (401 archived, 404 deleted, 500, etc.) means the token
      // is no longer usable. Clear it so subsequent requests skip it.
      ctx.cookies.delete(SESSION_COOKIE, { path: "/" });
      return null;
    }
    const body = await res.json();
    return body?.data ?? null;
  } catch {
    // Network error / backend down — clear cookie so login shows properly.
    ctx.cookies.delete(SESSION_COOKIE, { path: "/" });
    return null;
  }
}

// Student uchun natijalar ro'yxati elementi — /select sahifasi shuni ishlatadi.
export interface ResultListRow {
  id: string;
  publicCode: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  createdAt: string;
  exam: {
    title: string;
    examDate: string;
    academicYear: string | null;
    grade: number;
  };
  compositeScore: number | null;
}

export interface ResultListPayload {
  student: { fullName: string; grade: number };
  results: ResultListRow[];
}

/** Studentga tegishli barcha natijalarni oladi (o'quvchi tanlash sahifasi). */
export async function fetchMyResultList(ctx: APIContext): Promise<ResultListPayload | null> {
  const token = getSessionToken(ctx.cookies);
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/result/list`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      ctx.cookies.delete(SESSION_COOKIE, { path: "/" });
      return null;
    }
    const body = await res.json();
    return body?.data ?? null;
  } catch {
    ctx.cookies.delete(SESSION_COOKIE, { path: "/" });
    return null;
  }
}
