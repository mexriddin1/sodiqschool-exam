import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../db.js";
import { config } from "../config.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound, conflict, forbidden } from "../lib/errors.js";
import { requireAdmin, requireRole } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";
import type { Prisma } from "@prisma/client";

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "EDITOR"]).default("EDITOR"),
});

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "EDITOR"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAdmin);
adminUsersRouter.use(requireRole("ADMIN"));

const publicShape = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

adminUsersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.query.role ? String(req.query.role) : undefined;
    const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
    const q = String(req.query.q ?? "").trim();
    const where: Prisma.AdminUserWhereInput = {
      ...(role && (role === "ADMIN" || role === "EDITOR") && { role: role as "ADMIN" | "EDITOR" }),
      ...(active !== undefined && { isActive: active }),
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }),
    };
    const p = parsePagination(req, { defaultTake: 10, maxTake: 200 });
    const [rows, total] = await Promise.all([
      prisma.adminUser.findMany({ where, select: publicShape, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
      prisma.adminUser.count({ where }),
    ]);
    ok(res, wrapPaginated(rows, total, p));
  }),
);

adminUsersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const existing = await prisma.adminUser.findUnique({ where: { email: data.email } });
    if (existing) throw conflict("Email already in use");
    const passwordHash = await bcrypt.hash(data.password, config.bcryptCost);
    const user = await prisma.adminUser.create({
      data: { fullName: data.fullName, email: data.email, role: data.role, passwordHash },
      select: publicShape,
    });
    await audit(req.admin!.id, "create", "AdminUser", user.id, null, user);
    ok(res, user);
  }),
);

adminUsersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = updateSchema.parse(req.body);
    const prev = await prisma.adminUser.findUnique({ where: { id }, select: publicShape });
    if (!prev) throw notFound();

    // Guard: don't let the last active ADMIN demote / deactivate themselves
    // and lock the system out.
    if (
      prev.id === req.admin!.id &&
      (data.role === "EDITOR" || data.isActive === false)
    ) {
      throw forbidden("Cannot demote or deactivate yourself");
    }

    const user = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.password !== undefined && {
          passwordHash: await bcrypt.hash(data.password, config.bcryptCost),
        }),
      },
      select: publicShape,
    });
    await audit(req.admin!.id, "update", "AdminUser", id, prev, user);
    ok(res, user);
  }),
);

adminUsersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (id === req.admin!.id) throw forbidden("Cannot delete yourself");
    const prev = await prisma.adminUser.findUnique({ where: { id }, select: publicShape });
    if (!prev) throw notFound();
    await prisma.adminUser.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "AdminUser", id, prev, null);
    ok(res, { deleted: true });
  }),
);
