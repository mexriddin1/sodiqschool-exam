// Generates src/data/english.json (50 Q) from the real CEFR-A1 exam taxonomy
// (Sodiq_School_Ingliz_tili_kirish_imtihoni_5-sinf.docx) + a simulated student
// profile (strong grammar/vocab, weaker reading-inference & critical thinking).
import { writeFileSync } from 'fs';

const has = (arr, q) => arr.includes(q);
const CEFR_A1p = [5, 13, 15, 17, 23, 26, 29, 30, 35, 36, 38];
const CEFR_A2 = [27, 31, 33, 34, 37, 42, 49, 50];
const cefr = (q) => (has(CEFR_A2, q) ? 'A2' : has(CEFR_A1p, q) ? 'A1+' : 'A1');

// granular skill (Skills Map, 4-ILOVA)
const SKILLS = {
  'Grammar accuracy': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 43, 44, 45, 46, 48, 49, 50],
  'Vocabulary knowledge': [11, 12, 13, 14, 15, 16, 19, 47],
  'Reading comprehension': [20, 21, 22, 24, 25, 28, 41],
  'Inference skills': [17, 29, 30, 38],
  'Context understanding': [26],
  'Information processing': [23, 32],
  'Communication readiness': [31, 39, 40, 42],
  'Problem solving': [33, 37],
  'Interpretation skills': [34],
  'Analytical thinking': [18],
  'Critical thinking': [27, 35, 36],
};
const skillOf = (q) => Object.keys(SKILLS).find((k) => has(SKILLS[k], q)) || 'Grammar accuracy';

// section / strand (exam sections A-F)
const strandOf = (q) =>
  q <= 10 ? 'Grammatika' : q <= 19 ? "Lug'at" : q <= 34 ? "O'qish" : q <= 38 ? 'Tanqidiy fikrlash' : q <= 42 ? 'Funksional til' : "Qo'shimcha mashq";

// content topics for the §7 lollipop
const TOPICS = {
  'Asosiy grammatika': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "Qo'shimcha grammatika": [43, 44, 45, 46, 47, 48, 49, 50],
  "Lug'at boyligi": [11, 12, 13, 14, 15, 16, 17, 18, 19],
  "O'qish: aniq ma'lumot": [20, 21, 22, 24, 25, 28, 41],
  "O'qish: xulosa va talqin": [26, 29, 30, 34],
  "Grafik va ma'lumot": [23, 32, 33],
  'Tanqidiy fikrlash': [27, 35, 36, 37, 38],
  'Funksional til': [39, 40, 42],
  'Yozma javob': [31],
};
const topicOf = (q) => Object.keys(TOPICS).find((k) => has(TOPICS[k], q)) || 'Boshqa';

const bloomOf = (q) => {
  const s = skillOf(q);
  if (['Inference skills', 'Critical thinking', 'Analytical thinking', 'Interpretation skills', 'Problem solving'].includes(s)) return 'Tahlil';
  if (s === 'Communication readiness') return q === 31 ? 'Yaratish' : "Qo'llash";
  if (['Reading comprehension', 'Context understanding', 'Information processing'].includes(s)) return 'Tushunish';
  if (s === 'Vocabulary knowledge') return [13, 14, 15].includes(q) ? "Qo'llash" : 'Tushunish';
  return "Qo'llash"; // grammar
};

// difficulty (8-ILOVA target ~15 Oson / 25 O'rta / 10 Qiyin)
const EASY = [1, 2, 4, 6, 11, 12, 16, 18, 20, 21, 24, 28, 39, 40, 43];
const HARD = [27, 30, 31, 33, 34, 37, 38, 42, 49, 50];
const diffOf = (q) => (has(EASY, q) ? 'Oson' : has(HARD, q) ? 'Qiyin' : "O'rta");

// 2 marks/question -> 100 marks total (keeps adjusted/potential/forecast on the
// same 0-100 scale the report's formulas assume). Strong, well-rounded student:
// ~80%, healthy across tiers, with reading-inference / writing / A2 as growth.
const WRONG = [4, 16, 29, 30, 34, 36, 37];
const PARTIAL = [23, 35];
const TECHNICAL = [4, 16]; // careless slips (the rest of WRONG = knowledge gap)

const questions = [];
for (let q = 1; q <= 50; q++) {
  let result = "To'g'ri", earned = 2, errorType = null;
  if (has(PARTIAL, q)) { result = 'Qisman'; earned = 1; errorType = null; }
  else if (has(WRONG, q)) { result = "Noto'g'ri"; earned = 0; errorType = has(TECHNICAL, q) ? 'Texnik' : "Bilim bo'shlig'i"; }
  const lvl = cefr(q);
  questions.push({
    id: `Q${q}`,
    marks: 2,
    difficulty: diffOf(q),
    strand: strandOf(q),
    topic: topicOf(q),
    subTopic: topicOf(q),
    skill: skillOf(q),
    bloom: bloomOf(q),
    reasoning: null,
    gradeLevel: lvl,
    framework: `CEFR ${lvl}`,
    result,
    earned,
    errorType,
    evidence: '',
  });
}

const data = {
  meta: {
    school: 'Sodiq School',
    slogan: 'Biz ilmga sodiqmiz',
    office: 'Academic Assessment Office',
    candidate: '____________',
    grade: 5,
    gradeLabel: '5-sinfga nomzod · CEFR A1 · ~10 yosh',
    subject: 'Ingliz tili',
    totalQuestions: 50,
    totalMarks: 100,
    brand: { navy: '#06113C', orange: '#FF8A32' },
  },
  questions,
};
writeFileSync('src/data/english.json', JSON.stringify(data, null, 2));
const correct = questions.filter((q) => q.result === "To'g'ri").length;
console.log(`wrote src/data/english.json — ${questions.length} Q, ${correct} correct, raw ${questions.reduce((s, q) => s + q.earned, 0)}/50`);
