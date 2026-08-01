import type { APIRoute } from "astro";
import { API_URL, SESSION_COOKIE } from "../../lib/session";

export const prerender = false;

// Kod/parolsiz kirish — familya + ism + sinf. `api/login.ts` bilan bir xil
// proksi mantiq: real IP uzatiladi, backend qaytargan JWT shu origin'ning
// httpOnly cookie'siga yoziladi.
export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const grade = Number(body?.grade);
  if (!lastName || !firstName || !Number.isInteger(grade) || grade < 5 || grade > 11) {
    return new Response(JSON.stringify({ error: "Familya, ism va sinfni to'ldiring" }), { status: 400 });
  }
  // Forward real client IP so the backend rate-limiter tracks per-user, not per-server.
  const clientIp =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  const res = await fetch(`${API_URL}/api/result/auth/lookup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
    },
    body: JSON.stringify({ lastName, firstName, grade }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    return new Response(
      JSON.stringify({ error: json?.error?.message ?? "O'quvchi topilmadi" }),
      // 404 (topilmadi) va 429 (juda ko'p urinish) o'z holicha o'tadi — forma
      // ularga boshqa-boshqa xabar chiqaradi.
      { status: res.status === 404 || res.status === 429 ? res.status : 400 },
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
