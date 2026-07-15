// Ochiq (autentifikatsiyasiz) sozlamalar. Client Astro har bir sahifada
// SSR paytida "contact phone" ni oladi — yopiq bo'lim kartasida va
// "Bog'lanish" tugmasida ko'rsatish uchun.

import { Router } from "express";
import { asyncHandler, ok } from "../lib/response.js";
import { readContactPhone, readFunnelOpen } from "./admin.settings.js";

export const publicConfigRouter = Router();

publicConfigRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const [contactPhone, funnelOpen] = await Promise.all([readContactPhone(), readFunnelOpen()]);
    // `funnelOpen` — test-app shu bilan xato o'rniga tushunarli "yopiq"
    // sahifasini ko'rsatadi. Qo'riqchi EMAS: haqiqiy to'siq
    // public.testtaking.ts dagi requireFunnelOpen (bu qiymatni o'zgartirib
    // testni ochib bo'lmaydi).
    ok(res, { contactPhone, funnelOpen });
  }),
);
