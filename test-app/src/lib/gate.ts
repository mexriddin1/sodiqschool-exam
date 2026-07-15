// Qabul testiga kirish tokeni (maktab laptopi uchun).
//
// Qurilma bir marta parol kiritadi va o'zi CHIQMAGUNCHA kirgan holicha
// qoladi. Shuning uchun `localStorage` — `sessionStorage` bo'lsa, brauzer
// yopilishi bilan parol qaytadan so'ralardi, maktab laptopida esa uni
// kunda o'n marta kiritishga to'g'ri kelardi.
//
// Token — backend imzolagan JWT. Uni bu yerda tekshirmaymiz: haqiqiy
// tekshiruv serverda (requireFunnelAccess). Bu yer faqat saqlaydi.
//
// Bekor qilish: admin sozlamadan parolni almashtirsa, token ichidagi versiya
// eskiradi va server 401 GATE_REQUIRED qaytaradi — shunda tozalanadi.

const KEY = "sodiq_gate_token";

export function getGateToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    // localStorage o'chirilgan bo'lishi mumkin (private rejim, siyosat).
    return null;
  }
}

export function setGateToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* saqlab bo'lmadi — har safar parol so'raladi, lekin ishlaydi */
  }
}

export function clearGateToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
