-- Persisted AI-authored roadmap delta (next-level A→B topics + optional
-- polished weak-topic wording). Nullable: existing rows stay NULL and the
-- client falls back to the deterministic-only roadmap.
ALTER TABLE "Result" ADD COLUMN "aiRoadmap" JSONB;
