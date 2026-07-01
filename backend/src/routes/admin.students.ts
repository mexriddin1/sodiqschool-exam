import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { studentCreateSchema, studentUpdateSchema } from "../lib/schemas.js";
import { audit } from "../services/audit.js";
import { jsonOrNull } from "../lib/json.js";
import { parsePagination, wrapPaginated } from "../lib/pagination.js";

export const studentsRouter = Router();
studentsRouter.use(requireAdmin);

studentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const grade = req.query.grade ? Number(req.query.grade) : undefined;
    const sex = req.query.sex ? String(req.query.sex) : undefined;
    const sort = String(req.query.sort ?? "created-desc");
    const where: Prisma.StudentWhereInput = {
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { studentNumber: { contains: q, mode: "insensitive" } },
          { groupName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(grade && { grade }),
      ...(sex && (sex === "MALE" || sex === "FEMALE") && { sex }),
    };
    const orderBy: Prisma.StudentOrderByWithRelationInput =
      sort === "name-asc" ? { fullName: "asc" }
      : sort === "grade-asc" ? { grade: "asc" }
      : sort === "grade-desc" ? { grade: "desc" }
      : { createdAt: "desc" };
    // Combobox use-case can pass ?take=1000 to grab the full roster in one hit;
    // regular list views default to 10 rows per page.
    const p = parsePagination(req, { defaultTake: 10, maxTake: 1000 });
    const [rows, total] = await Promise.all([
      prisma.student.findMany({ where, orderBy, skip: p.skip, take: p.take }),
      prisma.student.count({ where }),
    ]);
    ok(res, wrapPaginated(rows, total, p));
  }),
);

studentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = studentCreateSchema.parse(req.body);
    const student = await prisma.student.create({
      data: {
        fullName: data.fullName,
        studentNumber: data.studentNumber ?? null,
        phone: data.phone ?? null,
        sex: data.sex ?? null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        grade: data.grade,
        groupName: data.groupName ?? null,
        metadata: jsonOrNull(data.metadata),
      },
    });
    await audit(req.admin!.id, "create", "Student", student.id, null, student);
    ok(res, student);
  }),
);

studentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const student = await prisma.student.findUnique({
      where: { id },
      include: { results: { orderBy: { createdAt: "desc" }, include: { exam: true } } },
    });
    if (!student) throw notFound();
    ok(res, student);
  }),
);

studentsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = studentUpdateSchema.parse(req.body);
    const prev = await prisma.student.findUnique({ where: { id } });
    if (!prev) throw notFound();
    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.studentNumber !== undefined && { studentNumber: data.studentNumber }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.sex !== undefined && { sex: data.sex }),
        ...(data.birthDate !== undefined && {
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
        }),
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.groupName !== undefined && { groupName: data.groupName }),
        ...(data.metadata !== undefined && { metadata: jsonOrNull(data.metadata) }),
      },
    });
    await audit(req.admin!.id, "update", "Student", student.id, prev, student);
    ok(res, student);
  }),
);

studentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const prev = await prisma.student.findUnique({ where: { id } });
    if (!prev) throw notFound();
    await prisma.student.delete({ where: { id } });
    await audit(req.admin!.id, "delete", "Student", id, prev, null);
    ok(res, { deleted: true });
  }),
);
