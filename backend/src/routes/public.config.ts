// Ochiq (autentifikatsiyasiz) sozlamalar. Client Astro har bir sahifada
// SSR paytida "contact phone" ni oladi — yopiq bo'lim kartasida va
// "Bog'lanish" tugmasida ko'rsatish uchun.

import { Router } from "express";
import { asyncHandler, ok } from "../lib/response.js";
import { readContactPhone, readFunnelOpen, readFunnelPassword } from "./admin.settings.js";

export const publicConfigRouter = Router();

publicConfigRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const [contactPhone, funnelOpen, pw] = await Promise.all([
      readContactPhone(),
      readFunnelOpen(),
      readFunnelPassword(),
    ]);
    // `funnelOpen` / `funnelGate` — test-app shular bilan xato o'rniga
    // tushunarli sahifani ("yopiq" yoki parol so'rash) ko'rsatadi. Qo'riqchi
    // EMAS: haqiqiy to'siq public.testtaking.ts dagi requireFunnelAccess
    // (bu qiymatlarni o'zgartirib testni ochib bo'lmaydi).
    //
    // Parolning o'zi ham, hash'i ham qaytarilmaydi — faqat kerak-kerakmasligi.
    ok(res, { contactPhone, funnelOpen, funnelGate: pw !== null });
  }),
);
