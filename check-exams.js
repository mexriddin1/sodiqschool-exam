require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const DEFAULT_MATRIX = {
  "5":  { math: 30, english: 30, criticalThinking: 40 },
  "6":  { math: 30, english: 30, criticalThinking: 40 },
  "7":  { math: 35, english: 35, criticalThinking: 30 },
  "8":  { math: 35, english: 35, criticalThinking: 30 },
  "9":  { math: 35, english: 40, criticalThinking: 25 },
  "10": { math: 35, english: 40, criticalThinking: 25 },
  "11": { math: 35, english: 40, criticalThinking: 25 },
};

(async () => {
  const exams = await p.exam.findMany({ select: { id: true, title: true, gradingConfiguration: true } });
  let touched = 0, skipped = 0;
  for (const e of exams) {
    const gc = (e.gradingConfiguration || {});
    const hasWeights = gc.weightsByGrade && Object.keys(gc.weightsByGrade).length > 0;
    if (hasWeights) {
      console.log("SKIP:", e.title, "(already has weightsByGrade)");
      skipped++;
      continue;
    }
    await p.exam.update({
      where: { id: e.id },
      data: { gradingConfiguration: { ...gc, weightsByGrade: DEFAULT_MATRIX } },
    });
    console.log("SET :", e.title);
    touched++;
  }
  console.log("---\nTotal: touched=" + touched + " skipped=" + skipped);
  await p.$disconnect();
})();
