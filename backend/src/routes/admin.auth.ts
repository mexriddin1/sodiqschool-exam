import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { adminLoginSchema } from "../lib/schemas.js";
import { ok, asyncHandler } from "../lib/response.js";
import { unauthorized } from "../lib/errors.js";
import { ADMIN_COOKIE, cookieOptions, requireAdmin, signAdminToken } from "../middleware/auth.js";

const ADMIN_COOKIE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const adminAuthRouter = Router();

// 10 admin-login attempts / 15 min / IP — tighter than the generic admin limiter.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TOO_MANY_ATTEMPTS", message: "Try again later" } },
});

adminAuthRouter.post(
  "/login",
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = adminLoginSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive) throw unauthorized("Invalid credentials");
    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) throw unauthorized("Invalid credentials");

    const token = signAdminToken({ sub: admin.id, role: admin.role });
    res.cookie(ADMIN_COOKIE, token, cookieOptions(ADMIN_COOKIE_AGE_MS));
    ok(res, {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
    });
  }),
);

adminAuthRouter.post("/logout", (req, res) => {
  res.clearCookie(ADMIN_COOKIE, { path: "/" });
  ok(res, { loggedOut: true });
});

adminAuthRouter.get(
  "/me",
  requireAdmin,
  asyncHandler(async (req, res) => {
    ok(res, req.admin!);
  }),
);
