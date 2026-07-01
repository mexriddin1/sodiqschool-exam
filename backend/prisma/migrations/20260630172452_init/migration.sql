-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubjectKey" AS ENUM ('MATH', 'ENGLISH', 'CRITICAL_THINKING');

-- CreateEnum
CREATE TYPE "StudentSex" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentNumber" TEXT,
    "phone" TEXT,
    "sex" "StudentSex",
    "birthDate" TIMESTAMP(3),
    "grade" INTEGER NOT NULL,
    "groupName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "examDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "grade" INTEGER NOT NULL,
    "admissionThresholds" JSONB NOT NULL,
    "gradingConfiguration" JSONB NOT NULL,
    "cohortSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "accessPasswordHash" TEXT NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "manualContent" JSONB NOT NULL,
    "calculatedSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectResult" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "subject" "SubjectKey" NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "realData" JSONB,
    "manualNotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "prev" JSONB,
    "next" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex
CREATE INDEX "Student_grade_idx" ON "Student"("grade");

-- CreateIndex
CREATE INDEX "Exam_grade_status_idx" ON "Exam"("grade", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Result_publicCode_key" ON "Result"("publicCode");

-- CreateIndex
CREATE INDEX "Result_examId_status_idx" ON "Result"("examId", "status");

-- CreateIndex
CREATE INDEX "Result_studentId_idx" ON "Result"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectResult_resultId_subject_key" ON "SubjectResult"("resultId", "subject");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectResult" ADD CONSTRAINT "SubjectResult_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
