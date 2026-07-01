import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { asyncHandler, ok } from "../lib/response.js";
import { badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";

// Templates served from the existing client/src/data/*.json + curated glossary
// + per-subject fallback arrays mirrored from the shipped client lib. Admin
// "Load template" pre-fills the result form with these so each result can be
// either left to the template or freely edited.

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DATA = resolve(__dirname, "../../../client/src/data");

const SAMPLE_FILES: Record<string, string> = {
  MATH: "student.json",
  ENGLISH: "english.json",
  CRITICAL_THINKING: "critical-thinking.json",
};

const GLOSSARY = {
  MATH: {
    skillHelp: [
      { t: "Protsedural ravonlik", d: "amallarni ravon, tez va to'g'ri bajarish — yuqori bo'lsa hisob-kitob avtomatlashgan." },
      { t: "Konseptual tushunish", d: "qoidaning ma'nosini anglash (faqat yodlash emas) — chuqur o'rganishga asos." },
      { t: "Muammo yechish", d: "notanish masalaga strategiya tuzib yechish — mustaqillik belgisi." },
      { t: "Mantiqiy xulosa", d: "ma'lumotdan asosli xulosa chiqarish — qiyin masalalarni uddalaydi." },
      { t: "Fazoviy fikrlash", d: "shakl, fazo va o'lchovni tasavvur qilish — geometriya uchun muhim." },
      { t: "Modellashtirish", d: "real vaziyatni matematik shaklga keltirish — amaliy masalalarda asqotadi." },
      { t: "Hisoblash aniqligi", d: "amallarni xatosiz bajarish — past bo'lsa e'tiborsizlik xatolari ko'payadi." },
    ],
    bloomHelp: [
      { t: "Eslab qolish", d: "faktlar va qoidalarni yodda saqlash (eng oddiy daraja)." },
      { t: "Tushunish", d: "ma'noni anglash, o'z so'zi bilan tushuntirish." },
      { t: "Qo'llash", d: "o'rganilgan qoidani yangi misolda ishlatish." },
      { t: "Tahlil", d: "masalani qismlarga ajratib, bog'liqliklarni ko'rish." },
      { t: "Baholash", d: "tanlovni asoslab, mulohaza bilan baho berish." },
      { t: "Yaratish", d: "yangi yechim yoki g'oya ishlab chiqish (eng yuqori, chuqur fikrlash darajasi)." },
    ],
    reasonHelp: [
      { t: "Deduktiv", d: "umumiy qoidadan aniq natijaga (qoida → misol) — ishonchli, izchil fikrlash." },
      { t: "Induktiv", d: "misollardan umumiy qoidaga (qonuniyat topish) — kashfiyotchi fikrlash." },
      { t: "Analitik", d: "murakkabni qismlarga ajratib tahlil qilish." },
      { t: "Fazoviy", d: "shakl va fazoni tasavvur qilib fikrlash — geometriya va modellarda." },
    ],
  },
  ENGLISH: {
    skillHelp: [
      { t: "Grammatik aniqlik", d: "gaplarni to'g'ri tuzish va grammatik qoidalarni qo'llash — kuchli bo'lsa til ishonchli." },
      { t: "Lug'at boyligi", d: "so'z zaxirasi va ularni o'rinli ishlatish — o'qish va yozishning poydevori." },
      { t: "O'qib tushunish", d: "matndan aniq ma'lumot va asosiy g'oyani anglash." },
      { t: "Xulosa chiqarish", d: "matndagi yashirin ma'noni topish (inference) — chuqur o'qish belgisi." },
      { t: "Tanqidiy fikrlash", d: "fakt va fikrni ajratish, mantiqiy baholash." },
      { t: "Funksional til", d: "kundalik vaziyatlarda (belgi, murojaat) tilni ishlatish." },
      { t: "Yozuv", d: "matn asosida qisqa, mazmunli javob yozish — eng yuqori talab." },
    ],
    bloomHelp: [
      { t: "Eslab qolish", d: "so'z, qoida va faktlarni yodda saqlash (eng oddiy daraja)." },
      { t: "Tushunish", d: "ma'noni anglash, o'z so'zi bilan aytish." },
      { t: "Qo'llash", d: "qoidani yangi gap yoki vaziyatda ishlatish." },
      { t: "Tahlil", d: "matnni qismlarga ajratib, xulosa chiqarish." },
      { t: "Baholash", d: "fakt va fikrni ajratib, asoslab baho berish." },
      { t: "Yaratish", d: "matn asosida yangi yozma javob tuzish (eng yuqori daraja)." },
    ],
    reasonHelp: [],
  },
  CRITICAL_THINKING: {
    skillHelp: [
      { t: "Qonuniyatni aniqlash", d: "sonlar yoki shakllar orasidagi yashirin qoidani topish (pattern recognition)." },
      { t: "Mantiqiy xulosa", d: "berilgan shartlardan to'g'ri xulosa chiqarish (deduktiv mantiq)." },
      { t: "Fazoviy fikrlash", d: "shakllarni aqlan aylantirish va fazoda tasavvur qilish — rasmli savollar uchun muhim." },
      { t: "Ma'lumot talqini", d: "diagramma, jadval va grafikdan to'g'ri ma'lumot o'qish." },
      { t: "Tanqidiy baholash", d: "fakt va fikrni ajratish, mantiqiy xatoni topish." },
      { t: "Strategik fikrlash", d: "maqsadga eng qisqa, samarali yo'lni rejalashtirish (algoritmik)." },
      { t: "Abstrakt mulohaza", d: "tanish bo'lmagan, mavhum qonuniyatni (matritsa) ilg'ash." },
      { t: "Tizimli sanash", d: "barcha imkoniyatlarni tartibli, xatosiz sanash (kombinatorika)." },
    ],
    bloomHelp: [
      { t: "Eslab qolish", d: "faktlarni yodda saqlash (eng oddiy daraja)." },
      { t: "Tushunish", d: "ma'noni anglash, o'z so'zi bilan aytish." },
      { t: "Qo'llash", d: "qoidani yangi vaziyatda ishlatish." },
      { t: "Tahlil", d: "masalani qismlarga ajratib, bog'liqliklarni ko'rish." },
      { t: "Baholash", d: "mulohaza bilan asoslab baho berish." },
      { t: "Yaratish", d: "yangi yechim yoki g'oya ishlab chiqish (eng yuqori daraja)." },
    ],
    reasonHelp: [],
  },
};

const BLOOM_FALLBACK = {
  MATH: { "Eslab qolish": 90, Tushunish: 75, "Qo'llash": 79, Tahlil: 86, Baholash: 70, Yaratish: 62 },
  ENGLISH: { "Eslab qolish": 92, Tushunish: 85, "Qo'llash": 85, Tahlil: 50, Baholash: 60, Yaratish: 55 },
  CRITICAL_THINKING: { "Eslab qolish": 88, Tushunish: 82, "Qo'llash": 70, Tahlil: 80, Baholash: 80, Yaratish: 60 },
};

const SKILL_RADAR = {
  MATH: [
    { name: "Protsedural ravonlik", value: 82 },
    { name: "Konseptual tushunish", value: 75 },
    { name: "Muammo yechish", value: 80 },
    { name: "Mantiqiy xulosa", value: 88 },
    { name: "Fazoviy fikrlash", value: 72 },
    { name: "Modellashtirish", value: 78 },
    { name: "Hisoblash aniqligi", value: 70 },
  ],
  ENGLISH: [
    { name: "Grammatik aniqlik", value: 88 },
    { name: "Lug'at boyligi", value: 90 },
    { name: "O'qib tushunish", value: 82 },
    { name: "Xulosa chiqarish", value: 45 },
    { name: "Tanqidiy fikrlash", value: 55 },
    { name: "Funksional til", value: 80 },
    { name: "Yozuv", value: 50 },
  ],
  CRITICAL_THINKING: [
    { name: "Qonuniyatni aniqlash", value: 85 },
    { name: "Mantiqiy xulosa", value: 88 },
    { name: "Fazoviy fikrlash", value: 42 },
    { name: "Ma'lumot talqini", value: 75 },
    { name: "Tanqidiy baholash", value: 82 },
    { name: "Strategik fikrlash", value: 80 },
    { name: "Abstrakt mulohaza", value: 78 },
    { name: "Tizimli sanash", value: 60 },
  ],
};

const REASONING = {
  MATH: [
    { name: "Deduktiv", gloss: "qoidadan natijaga", value: 85 },
    { name: "Induktiv", gloss: "misollardan qoidaga", value: 72 },
    { name: "Analitik", gloss: "qismlarga ajratib tahlil", value: 88 },
    { name: "Fazoviy", gloss: "shakl va fazoning tasavvuri", value: 76 },
  ],
  ENGLISH: [],
  CRITICAL_THINKING: [],
};

const GRADE_LEVEL_FALLBACK = {
  ENGLISH: { A1: 94, A2: 75 },
};

function loadSampleQuestions(subject: string): unknown {
  const fname = SAMPLE_FILES[subject];
  if (!fname) return null;
  try {
    const raw = JSON.parse(readFileSync(resolve(CLIENT_DATA, fname), "utf8"));
    return raw.questions ?? null;
  } catch {
    return null;
  }
}

export const templatesRouter = Router();
templatesRouter.use(requireAdmin);

templatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const subject = String(req.query.subject ?? "");
    if (!(subject in SAMPLE_FILES)) throw badRequest("BAD_SUBJECT", `Unknown subject: ${subject}`);
    const k = subject as "MATH" | "ENGLISH" | "CRITICAL_THINKING";
    ok(res, {
      subject,
      questions: loadSampleQuestions(k),
      glossary: GLOSSARY[k],
      bloomFallback: BLOOM_FALLBACK[k],
      skillRadar: SKILL_RADAR[k],
      reasoningTypes: REASONING[k],
      gradeLevelFallback: (GRADE_LEVEL_FALLBACK as Record<string, Record<string, number>>)[k] ?? null,
    });
  }),
);
