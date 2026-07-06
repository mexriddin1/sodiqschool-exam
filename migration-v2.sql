ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "grades" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "subjectKeys" "SubjectKey"[] DEFAULT ARRAY[]::"SubjectKey"[];
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "unlockedSections" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "examLanguage" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "uid" TEXT;
ALTER TABLE "TestTemplate" ADD COLUMN IF NOT EXISTS "examId" TEXT;
CREATE TABLE IF NOT EXISTS "Subject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_key_key" ON "Subject"("key");
CREATE INDEX IF NOT EXISTS "Subject_active_order_idx" ON "Subject"("active", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_uid_key" ON "Student"("uid");
CREATE INDEX IF NOT EXISTS "TestTemplate_examId_idx" ON "TestTemplate"("examId");
CREATE UNIQUE INDEX IF NOT EXISTS "TestTemplate_examId_subject_grade_key" ON "TestTemplate"("examId", "subject", "grade");
DO $$ BEGIN
  ALTER TABLE "TestTemplate" ADD CONSTRAINT "TestTemplate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;