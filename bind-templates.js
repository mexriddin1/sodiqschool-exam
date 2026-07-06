require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const unbound = await p.testTemplate.findMany({
    where: { examId: null },
    select: { id: true, name: true, subject: true, grade: true },
  });
  if (unbound.length === 0) {
    console.log("no unbound templates");
    return p.$disconnect();
  }
  console.log("unbound templates found:", unbound.length);
  // Prefer an ACTIVE exam whose grade covers each template's grade; otherwise
  // fall back to the newest exam of any status.
  const exams = await p.exam.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, grade: true, grades: true },
  });
  if (exams.length === 0) {
    console.log("no exams — cannot bind");
    return p.$disconnect();
  }
  function pickExam(grade) {
    const active = exams.filter((e) => e.status === "ACTIVE");
    const gradeMatch = (e) =>
      (Array.isArray(e.grades) && e.grades.includes(grade)) || e.grade === grade;
    return (
      active.find(gradeMatch) ||
      exams.find(gradeMatch) ||
      active[0] ||
      exams[0]
    );
  }
  let bound = 0;
  const seenSlots = new Set(); // "examId|subject|grade" — respect uniqueness
  const existingBound = await p.testTemplate.findMany({
    where: { NOT: { examId: null } },
    select: { examId: true, subject: true, grade: true },
  });
  for (const b of existingBound) seenSlots.add(`${b.examId}|${b.subject}|${b.grade}`);

  for (const tpl of unbound) {
    const ex = pickExam(tpl.grade);
    const slot = `${ex.id}|${tpl.subject}|${tpl.grade}`;
    if (seenSlots.has(slot)) {
      console.log(`SKIP ${tpl.name} — ${ex.title} allaqachon shu (fan,sinf)ga shablonga ega`);
      continue;
    }
    await p.testTemplate.update({
      where: { id: tpl.id },
      data: { examId: ex.id },
    });
    seenSlots.add(slot);
    console.log(`BIND ${tpl.name} → ${ex.title}`);
    bound++;
  }
  console.log("---");
  console.log("bound:", bound, "skipped:", unbound.length - bound);
  await p.$disconnect();
})();
