import type { APIRoute } from "astro";
import { API_URL, SESSION_COOKIE } from "../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.code !== "string" || typeof body.password !== "string") {
    return new Response(JSON.stringify({ error: "Kod va parol kerak" }), { status: 400 });
  }
  const res = await fetch(`${API_URL}/api/result/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: body.code, password: body.password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    return new Response(
      JSON.stringify({ error: json?.error?.message ?? "Kirish amalga oshmadi" }),
      { status: res.status === 401 ? 401 : 400 },
    );
  }
  const token = json.data?.token;
  if (!token) {
    return new Response(JSON.stringify({ error: "Token qaytmadi" }), { status: 500 });
  }
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
