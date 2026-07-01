import { Prisma } from "@prisma/client";

// Prisma's JSON input type rejects raw `null`; you must pass `Prisma.JsonNull`
// to explicitly clear a nullable JSON column. These helpers wrap that ceremony.

export function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function json(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}
