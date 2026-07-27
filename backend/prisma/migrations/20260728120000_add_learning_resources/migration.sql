-- Admin-managed roadmap learning resources. Additive: a new enum + table, no
-- change to existing rows. Seeded from packages/compute/src/data/resources.json.
CREATE TYPE "ResourceType" AS ENUM ('video', 'platform', 'book', 'channel', 'app');

CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "subject" "SubjectKey" NOT NULL,
    "topic" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "url" TEXT,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningResource_subject_topic_lang_active_order_idx" ON "LearningResource"("subject", "topic", "lang", "active", "order");
