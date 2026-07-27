import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  computeReport,
  extractWeakAreas,
  dedupeWeakAreas,
  allocateMonths,
  weeksForTopic,
  buildRoadmapV2,
  buildRoadmapAiContext,
  SubjectInput,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../client/src/data");
const load = (name: string): SubjectInput => JSON.parse(readFileSync(resolve(DATA_DIR, name), "utf8"));

test("weeksForTopic buckets by distance-to-100 severity", () => {
  assert.equal(weeksForTopic(70), 4); // percent 30 — deep rebuild
  assert.equal(weeksForTopic(60), 4);
  assert.equal(weeksForTopic(45), 3);
  assert.equal(weeksForTopic(25), 2);
  assert.equal(weeksForTopic(10), 1); // percent 90 — polish
});

test("weak areas now use the 100% target (severity = 100 - percent)", () => {
  const r = computeReport(load("student.json"));
  const weak = extractWeakAreas(r);
  for (const w of weak) {
    assert.ok(w.percent < 100, "only sub-100% indicators are weak");
    assert.equal(w.severity, Math.round(Math.max(0, 100 - w.percent)));
    assert.ok(w.n >= 2, "single-question groups are excluded (low confidence)");
  }
});

test("dedupeWeakAreas collapses duplicates across dimensions", () => {
  const r = computeReport(load("student.json"));
  const deduped = dedupeWeakAreas("MATH", extractWeakAreas(r));
  const names = deduped.map((w) => w.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, "no canonical name repeats");
  // Severity-desc ordering preserved.
  for (let i = 1; i < deduped.length; i++) {
    assert.ok(deduped[i - 1]!.severity >= deduped[i]!.severity);
  }
});

test("allocateMonths splits the 12 months into weak + next", () => {
  const r = computeReport(load("student.json"));
  const alloc = allocateMonths("MATH", r);
  assert.equal(alloc.weakMonths + alloc.nextMonths, 12);
  assert.ok(alloc.weakMonths >= 0 && alloc.weakMonths <= 12);
  assert.equal(alloc.overflow, alloc.deferred.length > 0);
});

test("buildRoadmapV2 returns dynamic stages that span 12 months", () => {
  const r = computeReport(load("student.json"));
  const road = buildRoadmapV2("MATH", r);
  assert.ok(road.stages.length >= 1);
  assert.equal(road.weakMonths + road.nextMonths, 12);
  // Gap stages drive weaknesses to 100; their focus items are all sub-100%.
  for (const stage of road.stages) {
    assert.ok(["gap", "next"].includes(stage.kind));
    if (stage.kind === "gap") {
      for (const f of stage.focusItems) assert.ok(f.weak.percent < 100);
    }
  }
  // The last stage covers month 12.
  assert.equal(road.stages[road.stages.length - 1]!.months, 12);
});

test("buildRoadmapAiContext exposes the guardrail payload", () => {
  const r = computeReport(load("student.json"));
  const ctx = buildRoadmapAiContext("MATH", r);
  assert.equal(ctx.subject, "MATH");
  assert.equal(ctx.grade, r.meta.grade);
  assert.equal(ctx.weakMonths + ctx.nextMonths, 12);
  for (const w of ctx.weakTopics) assert.ok(w.percent < 100);
});

test("AI next-level topics are merged into the next stage when months remain", () => {
  const r = computeReport(load("student.json"));
  const alloc = allocateMonths("MATH", r);
  const ai = {
    nextLevelTopics: [
      { topic: "Ratsional sonlar", description: "d1", rationale: "r1", order: 1 },
      { topic: "Chiziqli funksiya", description: "d2", rationale: "r2", order: 2 },
    ],
  };
  const road = buildRoadmapV2("MATH", r, ai);
  const nextStage = road.stages.find((s) => s.kind === "next");
  if (alloc.nextMonths > 0) {
    assert.ok(nextStage, "a next-level stage exists when months remain");
    const titles = nextStage!.focusItems.map((f) => f.canonicalTopic);
    assert.ok(titles.includes("Ratsional sonlar"));
    assert.ok(titles.includes("Chiziqli funksiya"));
    // weekPlan is relabelled to the AI topics (no leftover placeholders).
    assert.ok(nextStage!.weekPlan.every((w) => !w.focusTopic.startsWith("Keyingi daraja · mavzu")));
  } else {
    assert.equal(nextStage, undefined, "no spare months → no next-level stage");
  }
});
