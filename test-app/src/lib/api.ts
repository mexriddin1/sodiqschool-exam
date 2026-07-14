// Fetch wrapper that speaks the backend's {success, data, error} envelope.

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
    throw new ApiException(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "So'rov muvaffaqiyatsiz");
  }
  return body.data as T;
}
