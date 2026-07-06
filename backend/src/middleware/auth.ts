import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { prisma } from "../db.js";
import type { AdminRole } from "@prisma/client";

export interface AdminAuthPayload {
  sub: string;
  role: AdminRole;
}

// 2026-07-03: sub is now the STUDENT id. `code` stays for backward compat
// with tokens issued by the old per-Result auth (they carry the Result id
// as `sub` and the Result publicCode as `code`). Middleware detects which
// era the token belongs to and populates the session accordingly.
export interface ResultAuthPayload {
  sub: string;   // student id (new) OR result id (legacy)
  code: string;  // student loginCode (new) OR result publicCode (legacy)
  kind?: "student" | "result"; // omitted on legacy tokens
}

declare module "express-serve-static-core" {
  interface Request {
    admin?: { id: string; role: AdminRole; fullName: string; email: string };
    // resultId qoladi (legacy) — yangi tokenlarda studentId ham to'ldiriladi.
    // Har ikkisi ham optional bo'lgani sababli chaqiruvchilar mavjudini
    // tekshirib olishlari kerak.
    resultSession?: {
      studentId?: string;
      resultId?: string;
      publicCode: string;
    };
  }
}

export const ADMIN_COOKIE = "sodiq_admin";
export const RESULT_COOKIE = "sodiq_result";

export function signAdminToken(payload: AdminAuthPayload): string {
  return jwt.sign(payload, config.adminJwtSecret, { expiresIn: config.adminTokenTtl });
}

export function signResultToken(payload: ResultAuthPayload): string {
  return jwt.sign(payload, config.resultJwtSecret, { expiresIn: config.resultTokenTtl });
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) throw unauthorized();
    const decoded = jwt.verify(token, config.adminJwtSecret) as AdminAuthPayload;
    const admin = await prisma.adminUser.findUnique({ where: { id: decoded.sub } });
    if (!admin || !admin.isActive) throw unauthorized();
    req.admin = { id: admin.id, role: admin.role, fullName: admin.fullName, email: admin.email };
    next();
  } catch (e) {
    if ((e as Error).name === "JsonWebTokenError" || (e as Error).name === "TokenExpiredError") {
      next(unauthorized());
      return;
    }
    next(e);
  }
}

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.admin.role)) {
      next(forbidden("Insufficient role"));
      return;
    }
    next();
  };
}

export async function requireResultSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cookieToken = req.cookies?.[RESULT_COOKIE];
    const authHeader = req.headers["authorization"];
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    const token = cookieToken ?? bearerToken;
    if (!token) throw unauthorized();
    const decoded = jwt.verify(token, config.resultJwtSecret) as ResultAuthPayload;
    // Yangi token: kind = "student", sub = studentId. Eski token: kind yo'q,
    // sub = resultId. Ikkalasi ham ishlaydi — eski link'lar buzilmasligi
    // uchun legacy shape'ni ham qo'llab-quvvatlaymiz.
    if (decoded.kind === "student") {
      req.resultSession = { studentId: decoded.sub, publicCode: decoded.code };
    } else {
      req.resultSession = { resultId: decoded.sub, publicCode: decoded.code };
    }
    next();
  } catch (e) {
    if ((e as Error).name === "JsonWebTokenError" || (e as Error).name === "TokenExpiredError") {
      next(unauthorized());
      return;
    }
    next(e);
  }
}

export function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.cookieSecure,
    maxAge: maxAgeMs,
    path: "/",
  };
}
