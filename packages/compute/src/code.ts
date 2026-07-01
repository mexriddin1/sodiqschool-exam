// Public access code generator.
// 6 characters, [A-Z0-9] minus the ambiguous set O / 0 / I / 1.
// 30^6 ≈ 730 million combinations — plenty for collision-avoidance via retry.

import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 30 characters

export function generatePublicCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export function isValidPublicCode(code: string, length = 6): boolean {
  if (typeof code !== "string" || code.length !== length) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function normalizePublicCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

// Default password generator — 10 chars from a safe set (no ambiguous chars).
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[randomInt(0, PASSWORD_ALPHABET.length)];
  }
  return out;
}
