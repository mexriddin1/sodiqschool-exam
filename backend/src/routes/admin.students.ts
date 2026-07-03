import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler, ok } from "../lib/response.js";
import { notFound } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { studentCreateSchema, studentUpdateSchema, studentImportSchema } from "../lib/schemas.js";
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

// Split "Ism Familya" style input into first/last, or vice versa. Callers can
// pass either shape; this normalises them into a consistent Student row.
function normaliseNames(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): { fullName: string; firstName: string | null; lastName: string | null } {
  const trim = (v: string | null | undefined) => (v ?? "").trim();
  let firstName = trim(input.firstName);
  let lastName = trim(input.lastName);
  let fullName = trim(input.fullName);
  if (!fullName && (firstName || lastName)) {
    fullName = `${firstName} ${lastName}`.trim();
  }
  if ((!firstName || !lastName) && fullName) {
    // Split on the FIRST whitespace so multi-word last names stay together
    // (e.g. "Olim Aliyev O'g'li" → firstName="Olim", lastName="Aliyev O'g'li").
    const parts = fullName.split(/\s+/);
    firstName = firstName || parts[0] || "";
    lastName = lastName || parts.slice(1).join(" ") || "";
  }
  return {
    fullName: fullName || `${firstName} ${lastName}`.trim(),
    firstName: firstName || null,
    lastName: lastName || null,
  };
}

studentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = studentCreateSchema.parse(req.body);
    const names = normaliseNames(data);
    const student = await prisma.student.create({
      data: {
        fullName: names.fullName,
        firstName: names.firstName,
        lastName: names.lastName,
        uid: data.uid ?? null,
        examLanguage: data.examLanguage ?? null,
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

/**
 * Bulk JSON import of students. Body: { students: [ ... ] }.
 * - Duplicates by `uid` are skipped (uid uniqueness lives on the DB); the
 *   response reports how many were created vs skipped, with reasons.
 * - Rows that fail Zod validation surface as a `failed` array, so the admin
 *   sees which line(s) need fixing without aborting the whole batch.
 */
studentsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const { students } = studentImportSchema.parse(req.body);
    let created = 0;
    const skipped: { input: unknown; reason: string }[] = [];
    for (const raw of students) {
      try {
        const names = normaliseNames(raw);
        if (raw.uid) {
          const existing = await prisma.student.findUnique({ where: { uid: raw.uid } });
          if (existing) {
            skipped.push({ input: raw, reason: `UID '${raw.uid}' allaqachon mavjud` });
            continue;
          }
        }
        const s = await prisma.student.create({
          data: {
            fullName: names.fullName,
            firstName: names.firstName,
            lastName: names.lastName,
            uid: raw.uid ?? null,
            examLanguage: raw.examLanguage ?? null,
            studentNumber: raw.studentNumber ?? null,
            phone: raw.phone ?? null,
            sex: raw.sex ?? null,
            birthDate: raw.birthDate ? new Date(raw.birthDate) : null,
            grade: raw.grade,
            groupName: raw.groupName ?? null,
            metadata: jsonOrNull(raw.metadata),
          },
        });
        created += 1;
        // Audit each row so the origin is traceable per import. Volume is
        // bounded by studentImportSchema max=2000, so this is safe.
        await audit(req.admin!.id, "create", "Student", s.id, null, { imported: true });
      } catch (e) {
        skipped.push({ input: raw, reason: e instanceof Error ? e.message : "unknown error" });
      }
    }
    ok(res, { created, skipped, total: students.length });
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
    // When names change, re-derive whichever half wasn't sent so fullName
    // and firstName/lastName never drift out of sync.
    const needsNameSync = data.fullName !== undefined || data.firstName !== undefined || data.lastName !== undefined;
    const names = needsNameSync
      ? normaliseNames({
          fullName: data.fullName ?? prev.fullName,
          firstName: data.firstName ?? prev.firstName ?? null,
          lastName: data.lastName ?? prev.lastName ?? null,
        })
      : null;
    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(names && { fullName: names.fullName, firstName: names.firstName, lastName: names.lastName }),
        ...(data.uid !== undefined && { uid: data.uid }),
        ...(data.examLanguage !== undefined && { examLanguage: data.examLanguage }),
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
