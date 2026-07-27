// Gemini transport regression. The provider was migrated from DeepSeek to
// Google Gemini: the request shape (systemInstruction + generationConfig),
// response parsing (candidates[0].content.parts[0].text) and telemetry mapping
// (usageMetadata) all changed. These tests mock global fetch so they never hit
// the network, and pin the new contract + the graceful-degradation path that
// keeps fire-and-forget generation from ever crashing publish/create.

import { strict as assert } from "node:assert";
import { test, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SubjectInput } from "@sodiq/compute";
import { generateResultNarrative, type GenerateInput } from "../src/services/ai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../client/src/data");
const load = (name: string): SubjectInput => JSON.parse(readFileSync(resolve(DATA_DIR, name), "utf8"));

function buildInput(): GenerateInput {
  const math = load("student.json");
  return {
    student: { fullName: "Test Nomzod", grade: math.meta.grade },
    math,
    english: load("english.json"),
    criticalThinking: load("critical-thinking.json"),
  };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// A Gemini-shaped response. `payload` is the JSON the model "returned"; every
// section parser reads only its own keys, so one universal payload satisfies
// narrative, roadmap and summary calls at once.
function mockGemini(payload: unknown, meta = { promptTokenCount: 100, candidatesTokenCount: 50 }) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const body = {
      candidates: payload === null ? [] : [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
      usageMetadata: meta,
    };
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  }) as unknown as typeof fetch;
  return calls;
}

test("Gemini responses parse into narrative + roadmap + usage", async () => {
  const calls = mockGemini({
    diagnostika: "Bu sinov hikoyasi.",
    crossCutting: "Umumiy manzara.",
    finalRecommendation: "Yakuniy tavsiya.",
    nextLevelTopics: [{ topic: "Ratsional sonlar", description: "d", rationale: "r", order: 1 }],
  });

  const out = await generateResultNarrative(buildInput());

  // Parsed from candidates[0].content.parts[0].text (not DeepSeek's choices[]).
  assert.equal(out.narrative.math.diagnostika, "Bu sinov hikoyasi.");
  assert.equal(out.narrative.summary.crossCutting, "Umumiy manzara.");
  assert.equal(out.narrative.summary.finalRecommendation, "Yakuniy tavsiya.");

  // Roadmap delta present and well-formed.
  assert.ok(Array.isArray(out.roadmap.math.nextLevelTopics));
  assert.ok(Array.isArray(out.roadmap.english.nextLevelTopics));

  // Telemetry maps usageMetadata → prompt/completion tokens; model is Gemini.
  assert.ok(out.usage.totalTokens > 0);
  assert.ok(out.usage.model.includes("gemini"));
  assert.ok(out.usage.runs.length >= 4); // 3 narratives + 1 summary (+ roadmaps)

  // Requests hit the Gemini endpoint with the API-key header.
  assert.ok(calls.length >= 4);
  assert.ok(calls[0]!.url.includes(":generateContent"));
  assert.ok((calls[0]!.init.headers as Record<string, string>)["x-goog-api-key"] !== undefined);
});

test("empty candidates (safety block) degrade to {} without throwing", async () => {
  mockGemini(null);
  const out = await generateResultNarrative(buildInput());
  // No text → empty strings, but the call resolves cleanly (fire-and-forget
  // must never crash the publish/create path).
  assert.equal(out.narrative.math.diagnostika, "");
  assert.equal(out.narrative.summary.crossCutting, "");
  assert.deepEqual(out.roadmap.math.nextLevelTopics, []);
});
