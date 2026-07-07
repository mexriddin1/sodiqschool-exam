// Browser-side API wrapper. Cookies travel with credentials: "include".

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Exposed so components that trigger a browser-native download (window.open,
// <a href>) can build the same absolute URL the fetch wrapper uses.
export const API_BASE = BASE;

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export class ApiException extends Error {
  constructor(public status: number, public error: ApiError) {
    super(error.message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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
    error?: ApiError;
  };
  if (!res.ok || !body.success) {
    throw new ApiException(res.status, body.error ?? { code: "UNKNOWN", message: "Request failed" });
  }
  return body.data as T;
}
