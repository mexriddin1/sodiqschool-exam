-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'FILL_GAP', 'MATCHING', 'REORDERING');

-- CreateEnum
CREATE TYPE "TestLanguage" AS ENUM ('UZ', 'RU', 'EN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('FORM_ONLY', 'STARTED', 'COMPLETED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" "SubjectKey" NOT NULL,
    "grade" INTEGER NOT NULL,
    "languages" "TestLanguage"[] DEFAULT ARRAY[]::"TestLanguage"[],
    "durationSec" INTEGER,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "sex" "StudentSex" NOT NULL,
    "phone" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "examLanguage" "TestLanguage" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'FORM_ONLY',
    "studentId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "clientToken" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "scoreRaw" INTEGER,
    "scoreMax" INTEGER,
    "resultId" TEXT,

    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Test_grade_subject_idx" ON "Test"("grade", "subject");

-- CreateIndex
CREATE INDEX "Test_examId_idx" ON "Test"("examId");

-- CreateIndex
CREATE INDEX "Test_templateId_idx" ON "Test"("templateId");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_clientToken_key" ON "TestAttempt"("clientToken");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_resultId_key" ON "TestAttempt"("resultId");

-- CreateIndex
CREATE INDEX "TestAttempt_leadId_idx" ON "TestAttempt"("leadId");

-- CreateIndex
CREATE INDEX "TestAttempt_testId_submittedAt_idx" ON "TestAttempt"("testId", "submittedAt");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;
