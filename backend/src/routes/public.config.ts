// Ochiq (autentifikatsiyasiz) sozlamalar. Client Astro har bir sahifada
// SSR paytida "contact phone" ni oladi — yopiq bo'lim kartasida va
// "Bog'lanish" tugmasida ko'rsatish uchun.

import { Router } from "express";
import { asyncHandler, ok } from "../lib/response.js";
import { readContactPhone } from "./admin.settings.js";

export const publicConfigRouter = Router();

publicConfigRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const contactPhone = await readContactPhone();
    ok(res, { contactPhone });
  }),
);
