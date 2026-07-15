// Fetch wrapper that speaks the backend's {success, data, error} envelope.

import { clearGateToken, getGateToken } from "./gate";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const API_BASE = BASE;

export class ApiException extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  // Kirish tokeni — cookie EMAS: test-app va backend boshqa domenlarda
  // (test.sodiqschool.uz / api.natija.sodiqschool.uz), ya'ni cookie
  // SameSite=None talab qilardi. Header sodda va ishonchli.
  const gate = getGateToken();
  if (gate && !headers.has("authorization")) headers.set("authorization", `Bearer ${gate}`);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code: string; message: string };
  };
  if (!res.ok || !body.success) {
    const code = body.error?.code ?? "UNKNOWN";
    // Token eskirgan (admin parolni almashtirgan) — saqlangani endi
    // foydasiz, tozalaymiz. Sahifa o'zi parol so'rashga qaytadi.
    if (code === "GATE_REQUIRED") clearGateToken();
    throw new ApiException(res.status, code, body.error?.message ?? "So'rov muvaffaqiyatsiz");
  }
  return body.data as T;
}
