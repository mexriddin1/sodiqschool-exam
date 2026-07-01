import { generatePublicCode } from "@sodiq/compute";
import { prisma } from "../db.js";
import { conflict } from "../lib/errors.js";

const MAX_RETRIES = 12;

export async function generateUniquePublicCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generatePublicCode();
    const exists = await prisma.result.findUnique({ where: { publicCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw conflict("Failed to generate unique public code after retries");
}
