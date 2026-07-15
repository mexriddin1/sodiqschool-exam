// Detail sahifalaridagi "← orqaga" havolasi uchun.
//
// Muammo: har detail sahifa o'z ro'yxatiga QATTIQ havola qilardi. Masalan
// results/[id] doim `/results` ga qaytarardi — lead sahifasidan kelgan admin
// esa lead'ga qaytishni kutadi va o'zini natijalar ro'yxatida topadi.
// Aynan shu xato bildirilgan.
//
// Yechim: kelib chiqqan sahifa `?from=` (va ixtiyoriy `?fromLabel=`) uzatadi,
// detail sahifa esa shuni o'qiydi. Uzatilmasa — eski holat, ya'ni ro'yxatga.
// Repo'dagi namuna: test-templates/new/page.tsx `?examId=` ni shunday ishlatadi.

export interface BackTarget {
  href: string;
  label: string;
}

// `from` faqat ichki, absolyut yo'l bo'lishi mumkin ("/leads/123"). Tashqi
// URL yoki protokolga o'xshash qiymat ochiq redirect bo'lardi, shuning uchun
// rad etamiz va fallback'ga tushamiz.
function isSafeInternalPath(v: string | null | undefined): v is string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//");
}

/**
 * @param params  `useSearchParams()` natijasi
 * @param fallback  `from` bo'lmasa ishlatiladigan manzil va matn
 */
export function resolveBack(
  params: { get(key: string): string | null } | null | undefined,
  fallback: BackTarget,
): BackTarget {
  const from = params?.get("from");
  if (!isSafeInternalPath(from)) return fallback;
  const label = params?.get("fromLabel");
  return { href: from, label: label && label.trim() ? label : "Orqaga" };
}

/** Detail sahifaga havola qurish — qayerdan kelinganini biriktiradi. */
export function withBack(href: string, from: string, fromLabel: string): string {
  const qs = new URLSearchParams({ from, fromLabel });
  return `${href}?${qs.toString()}`;
}
