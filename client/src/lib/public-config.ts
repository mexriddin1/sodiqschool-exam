// SSR-side helper — har bir sahifa render vaqtida bir marta chaqiriladi.
// Backend'ning `/api/public/config` public endpoint'idan aloqa raqamini
// oladi. In-memory 10s cache: admin edit qilgach ~o'sha zahoti chiqadi,
// ammo yangi sahifa yuklashda har safar network hit yo'q.

import { API_URL } from "./session";

let cached: { phone: string } | null = null;
let ts = 0;
const TTL_MS = 10_000;

export async function getContactPhone(): Promise<string> {
  if (cached && Date.now() - ts < TTL_MS) return cached.phone;
  try {
    const res = await fetch(`${API_URL}/api/public/config`);
    if (!res.ok) return cached?.phone ?? "";
    const body = await res.json();
    const phone = typeof body?.data?.contactPhone === "string" ? body.data.contactPhone : "";
    cached = { phone };
    ts = Date.now();
    return phone;
  } catch {
    return cached?.phone ?? "";
  }
}

/** `+998 90 123 45 67` → `+998901234567` (tel: URI). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
