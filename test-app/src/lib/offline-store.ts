// IndexedDB wrapper for offline test-taking. Stores:
//   - attempts/<token>  → { questions, meta, startedAt, durationSec }
//   - answers/<token>   → { [questionId]: any, updatedAt }
// A refresh reads both; autosave writes here first, then to the server.

import { openDB, type DBSchema } from "idb";

import type { Lang } from "./i18n";

interface StoredAttempt {
  token: string;
  test: { id: string; name: string; subject: string; grade: number; durationSec: number | null };
  questions: unknown[]; // TestQuestion[] with correct-answer fields stripped
  startedAt: string;
  // Til ham saqlanadi: internetsiz tiklanganda savollar keshdan keladi, va
  // usiz interfeys o'zbekchaga tushib qolardi (savollar esa ruscha).
  // Eski yozuvlarda yo'q — shuning uchun ixtiyoriy.
  examLanguage?: Lang;
}

interface StoredAnswers {
  token: string;
  answers: Record<string, unknown>;
  updatedAt: string;
}

interface SodiqDB extends DBSchema {
  attempts: {
    key: string;
    value: StoredAttempt;
  };
  answers: {
    key: string;
    value: StoredAnswers;
  };
}

const DB_NAME = "sodiq-test-taking";
const DB_VERSION = 1;

async function db() {
  return openDB<SodiqDB>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains("attempts")) d.createObjectStore("attempts", { keyPath: "token" });
      if (!d.objectStoreNames.contains("answers")) d.createObjectStore("answers", { keyPath: "token" });
    },
  });
}

export async function saveAttempt(a: StoredAttempt): Promise<void> {
  const d = await db();
  await d.put("attempts", a);
}

export async function loadAttempt(token: string): Promise<StoredAttempt | null> {
  const d = await db();
  const v = await d.get("attempts", token);
  return v ?? null;
}

export async function saveAnswers(token: string, answers: Record<string, unknown>): Promise<void> {
  const d = await db();
  await d.put("answers", { token, answers, updatedAt: new Date().toISOString() });
}

export async function loadAnswers(token: string): Promise<Record<string, unknown>> {
  const d = await db();
  const v = await d.get("answers", token);
  return v?.answers ?? {};
}

export async function clearAttempt(token: string): Promise<void> {
  const d = await db();
  await d.delete("attempts", token);
  await d.delete("answers", token);
}
