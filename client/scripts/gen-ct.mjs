// Generates src/data/critical-thinking.json (10 Q · 100 marks) from the real
// CT teacher-guide taxonomy (Sodiq_School_5-sinf_Oqituvchi_Qollanmasi.pdf) +
// a simulated profile: strong at complex reasoning (aces hard logic/abstract),
// spatial visualisation is the growth area, a careless slip costs easy points.
import { writeFileSync } from 'fs';

// per-question labels: domain (strand/topic), skill, bloom, difficulty, marks,
// result, errorType. Marks scheme = 6·6·6·10·10·10·10·10·16·16.
const Q = [
  { d: 'Qonuniyat va algebra', s: 'Qonuniyatni aniqlash', b: 'Tahlil', diff: "O'rta", m: 6, res: 'correct' },
  { d: 'Deduktiv mantiq', s: 'Mantiqiy xulosa chiqarish', b: 'Tahlil', diff: 'Oson', m: 6, res: 'correct' },
  { d: 'Fazoviy-vizual mulohaza', s: 'Fazoviy tasavvur', b: "Qo'llash", diff: 'Oson', m: 6, res: 'wrong', err: 'Texnik' },
  { d: "Ma'lumot tahlili", s: "Ma'lumotni talqin qilish", b: 'Tahlil', diff: 'Oson', m: 10, res: 'correct' },
  { d: 'Tanqidiy baholash', s: 'Tanqidiy baholash', b: 'Baholash', diff: "O'rta", m: 10, res: 'correct' },
  { d: 'Strategik fikrlash', s: 'Strategik fikrlash', b: 'Tahlil', diff: 'Qiyin', m: 10, res: 'correct' },
  { d: 'Deduktiv mantiq', s: 'Mantiqiy xulosa chiqarish', b: 'Tahlil', diff: "O'rta", m: 10, res: 'correct' },
  { d: 'Fazoviy-vizual mulohaza', s: 'Fazoviy tasavvur', b: "Qo'llash", diff: "O'rta", m: 10, res: 'wrong', err: "Bilim bo'shlig'i" },
  { d: 'Abstrakt mulohaza', s: 'Abstrakt mulohaza', b: 'Tahlil', diff: 'Qiyin', m: 16, res: 'correct' },
  { d: 'Kombinatorika', s: 'Tizimli sanash', b: 'Tahlil', diff: "O'rta", m: 16, res: 'partial', err: "Bilim bo'shlig'i" },
];

const questions = Q.map((q, i) => {
  const earned = q.res === 'correct' ? q.m : q.res === 'partial' ? q.m / 2 : 0;
  const result = q.res === 'correct' ? "To'g'ri" : q.res === 'partial' ? 'Qisman' : "Noto'g'ri";
  return {
    id: `Q${i + 1}`,
    marks: q.m,
    difficulty: q.diff,
    strand: q.d,
    topic: q.d,
    subTopic: q.d,
    skill: q.s,
    bloom: q.b,
    reasoning: null,
    gradeLevel: '5-sinf',
    framework: 'CAT4 / PISA / Oxford TSA',
    result,
    earned,
    errorType: q.err || null,
    evidence: '',
  };
});

const data = {
  meta: {
    school: 'Sodiq School',
    slogan: 'Biz ilmga sodiqmiz',
    office: 'Academic Assessment Office',
    candidate: '____________',
    grade: 5,
    gradeLabel: '5-sinfga nomzod · Tanqidiy fikrlash · ~10 yosh',
    subject: 'Tanqidiy fikrlash',
    totalQuestions: 10,
    totalMarks: 100,
    brand: { navy: '#06113C', orange: '#FF8A32' },
  },
  questions,
};
writeFileSync('src/data/critical-thinking.json', JSON.stringify(data, null, 2));
const raw = questions.reduce((s, q) => s + q.earned, 0);
console.log(`wrote src/data/critical-thinking.json — ${questions.length} Q, raw ${raw}/100`);
