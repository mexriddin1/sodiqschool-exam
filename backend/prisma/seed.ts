// Seeds one admin, one grade-5 exam (with the result.text admission thresholds),
// three sample students, and three sample DRAFT results using the per-question
// JSON already in client/src/data/*.json.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

import { PrismaClient, Prisma } from "@prisma/client";
import {
  DEFAULT_ADMISSION_THRESHOLDS,
  generatePassword,
  generatePublicCode,
  Question,
  SubjectInput,
} from "@sodiq/compute";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DATA = resolve(__dirname, "../../client/src/data");

function loadSubject(filename: string): SubjectInput {
  return JSON.parse(readFileSync(resolve(CLIENT_DATA, filename), "utf8"));
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@sodiq.uz";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2025";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Test Admin";

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, fullName: adminName, role: "ADMIN", isActive: true },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      fullName: adminName,
      role: "ADMIN",
    },
  });
  console.log(`✔ admin: ${admin.email} (password: ${adminPassword})`);

  const exam = await prisma.exam.upsert({
    where: { id: "seed-exam-grade5" },
    update: {},
    create: {
      id: "seed-exam-grade5",
      title: "Sodiq School kirish imtihoni — 5-sinf (seed)",
      description: "Seed exam: per-grade thresholds from resource/result.text",
      examDate: new Date(),
      academicYear: "2025-2026",
      status: "ACTIVE",
      grade: 5,
      admissionThresholds: DEFAULT_ADMISSION_THRESHOLDS as unknown as Prisma.InputJsonValue,
      gradingConfiguration: {},
      cohortSize: 240,
    },
  });
  console.log(`✔ exam: ${exam.title}`);

  const math = loadSubject("student.json");
  const english = loadSubject("english.json");
  const ct = loadSubject("critical-thinking.json");

  // Static test templates per (subject, grade). Admin imports these into a
  // result and only marks outcomes per question.
  const TEMPLATES = [
    { subject: "MATH" as const, grade: 5, name: "5-sinf Matematika testi", data: math },
    { subject: "ENGLISH" as const, grade: 5, name: "5-sinf Ingliz tili testi", data: english },
    { subject: "CRITICAL_THINKING" as const, grade: 5, name: "5-sinf Tanqidiy fikrlash testi", data: ct },
  ];
  for (const tpl of TEMPLATES) {
    // Shared-library template lookup (examId=null). Named unique index is
    // `subject_grade_legacy` on the new schema.
    const existing = await prisma.testTemplate.findFirst({
      where: { examId: null, subject: tpl.subject, grade: tpl.grade },
    });
    if (existing) {
      console.log(`= template: ${tpl.name} (already exists)`);
      continue;
    }
    await prisma.testTemplate.create({
      data: {
        subject: tpl.subject,
        grade: tpl.grade,
        name: tpl.name,
        questions: tpl.data.questions as unknown as Prisma.InputJsonValue,
      },
    });
    console.log(`✔ template: ${tpl.name} (${tpl.data.questions.length} savol)`);
  }

  const STUDENTS = [
    { fullName: "Sample Student 1", grade: 5, sex: "MALE" as const },
    { fullName: "Sample Student 2", grade: 5, sex: "FEMALE" as const },
    { fullName: "Sample Student 3", grade: 5, sex: "MALE" as const },
  ];

  for (const s of STUDENTS) {
    const student = await prisma.student.create({ data: s });
    const publicCode = generatePublicCode();
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.result.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        publicCode,
        accessPasswordHash: passwordHash,
        accessPassword: password,
        status: "DRAFT",
        manualContent: {},
        subjects: {
          create: [
            {
              subject: "MATH",
              totalQuestions: math.questions.length,
              totalMarks: math.questions.reduce((a, q) => a + q.marks, 0),
              questions: math.questions as unknown as Prisma.InputJsonValue,
              realData: math.realData == null ? Prisma.JsonNull : (math.realData as unknown as Prisma.InputJsonValue),
            },
            {
              subject: "ENGLISH",
              totalQuestions: english.questions.length,
              totalMarks: english.questions.reduce((a, q) => a + q.marks, 0),
              questions: english.questions as unknown as Prisma.InputJsonValue,
              realData: english.realData == null ? Prisma.JsonNull : (english.realData as unknown as Prisma.InputJsonValue),
            },
            {
              subject: "CRITICAL_THINKING",
              totalQuestions: ct.questions.length,
              totalMarks: ct.questions.reduce((a, q) => a + q.marks, 0),
              questions: ct.questions as unknown as Prisma.InputJsonValue,
              realData: ct.realData == null ? Prisma.JsonNull : (ct.realData as unknown as Prisma.InputJsonValue),
            },
          ],
        },
      },
    });
    console.log(`✔ student: ${student.fullName} → publicCode=${publicCode}, password=${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
