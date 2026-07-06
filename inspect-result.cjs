require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const r = await p.result.findFirst({
    orderBy: { createdAt: "desc" },
    include: { student: true, exam: { select: { title: true } } },
  });
  if (!r) return console.log("no results");
  console.log("result.id:", r.id);
  console.log("result.publicCode:", r.publicCode);
  console.log("result.accessPassword:", r.accessPassword);
  console.log("---student---");
  console.log("student.fullName:", r.student.fullName);
  console.log("student.loginCode:", r.student.loginCode);
  console.log("student.accessPassword:", r.student.accessPassword);
  console.log("student.accessPasswordHash present:", !!r.student.accessPasswordHash);
  await p.$disconnect();
})();
