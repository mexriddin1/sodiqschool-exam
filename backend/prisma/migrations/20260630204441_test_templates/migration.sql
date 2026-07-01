-- CreateTable
CREATE TABLE "TestTemplate" (
    "id" TEXT NOT NULL,
    "subject" "SubjectKey" NOT NULL,
    "grade" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestTemplate_subject_grade_key" ON "TestTemplate"("subject", "grade");
