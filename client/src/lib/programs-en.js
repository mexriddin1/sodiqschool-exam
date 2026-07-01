// ============================================================================
// ENGLISH development roadmap (CEFR A1 · 5-sinf). Same object shape as
// buildPrograms (math), focused on the English profile: reading-inference ->
// critical thinking / functional & A1+ -> A2 readiness & writing.
// ASCII apostrophes only (o', g').
// ============================================================================
import { BAND_COLORS } from '@sodiq/compute/compute';

export function buildEnglishPrograms(r) {
  const [m0, m3, m6, m12] = r.growthForecast.map((x) => x.v);
  const focus = r.weakestTopic;
  const f1base = focus ? focus.percent : 25;
  const reading = r.byStrand.find((s) => s.name === "O'qish");
  const readBase = reading ? reading.percent : 67;
  const ct = r.byStrand.find((s) => s.name === 'Tanqidiy fikrlash');
  const ctBase = ct ? ct.percent : 40;
  const a1p = r.byGradeLevel.find((x) => x.name === 'A1+');
  const a1pBase = a1p ? a1p.percent : 55;
  const a2 = r.byGradeLevel.find((x) => x.name === 'A2');
  const a2base = a2 ? a2.percent : 60;
  const g = r.meta.grade;
  const prio = (label, color) => ({ label, color });

  const p1 = {
    num: 11, months: 3, range: `0-3 oy`, phase: `1-bosqich · dastlabki 3 oy · poydevor`,
    title: `1-bosqich - Dastlabki 3 oy: o'qib tushunish va xulosa`,
    mission: `O'qishda aniq ma'lumotni topish va matndan xulosa chiqarishni mustahkamlaymiz; o'qish ishonchini oshiramiz.`,
    actions: [
      { do: `Qisqa matn o'qib, 3 savolga dalil bilan javob`, dose: `kuniga 10 daq` },
      { do: `Yangi so'zlarni lug'at daftariga yozish`, dose: `haftada 15 so'z` },
      { do: `"Matnda qayerda yozilgan?" - javobni asoslash`, dose: `har savol` },
      { do: `Audio bilan tinglab-o'qish (graded reader)`, dose: `haftada 2` },
    ],
    road: { label: `O'qish va xulosa`, gain: { from: f1base, to: 62 }, note: `kuniga 10 daq o'qish` },
    priority: prio('Yuqori', BAND_COLORS.bad),
    baseline: { label: `Boshlang'ich o'qish-xulosa`, val: f1base, color: BAND_COLORS.bad },
    target: { label: `Maqsadli daraja`, val: '>=62', color: BAND_COLORS.green },
    overall: { from: m0, to: m3 },
    weeklyHours: '4-5 soat', monthlyHours: '~17 soat', totalHours: '~52 soat',
    growthBars: [],
    goal: `Aniq ma'lumotni topish (scanning) va matndan oddiy xulosa (inference) chiqarish ko'nikmasini mustahkamlash; o'qish tezligi va ishonchini oshirish.`,
    outcome: `Qisqa matnlarda aniqlik oshadi; xulosa savollarida ${f1base}% -> 62%; umumiy ball ${m0} -> ${m3}.`,
    topics: [`Aniq ma'lumotni topish (scanning)`, `Asosiy g'oyani aniqlash`, `Oddiy xulosa (inference)`, `So'z ma'nosini kontekstdan topish`, `Voqealar ketma-ketligi`],
    skills: [`Reading comprehension (o'qib tushunish)`, `Inference skills (xulosa)`, `Vocabulary knowledge`, `Javobni dalillash`],
    weekPlan: [
      { period: '1-2-hafta', focus: `Aniq ma'lumot (scanning)`, task: `Kuniga 1 matn; "qayerda yozilgan?"` },
      { period: '3-4-hafta', focus: `Asosiy g'oya`, task: `Har matnga sarlavha o'ylab topish` },
      { period: '5-6-hafta', focus: `Oddiy xulosa`, task: `"Demak nima?" - xulosa mashqi` },
      { period: '7-8-hafta', focus: `Kontekstdan so'z`, task: `Notanish so'z ma'nosini taxmin qilish` },
      { period: '9-10-hafta', focus: `Ketma-ketlik`, task: `Voqealarni tartiblash mashqi` },
      { period: '11-12-hafta', focus: `Mustahkamlash`, task: `Aralash matn + mini-diagnostika` },
    ],
    checkpoints: [
      { label: '1-oy', lines: ['Scanning +', "asosiy g'oya"] },
      { label: '2-oy', lines: ['Xulosa', 'asoslari'] },
      { label: '3-oy', lines: ['Aralash +', 'tekshiruv'] },
    ],
    resources: {
      exercises: [`Kuniga 10 daqiqa o'qish (graded reader)`, `Haftada 1 lug'at takrori`, `Tinglab-o'qish mashqi`],
      books: [`Oxford Read & Discover / Cambridge Storyfun (A1)`, `${g}-sinf ingliz tili darsligi (Reading)`],
      platforms: [`LearnEnglish Kids (British Council)`, `Khan Academy Kids`, `Cambridge A1 Reading practice`],
      videos: [`BBC Learning English (A1)`, `Easy English short stories (YouTube)`],
    },
    roles: {
      parent: [`Kuniga 10 daqiqa o'qishni nazorat qiling`, `Lug'at daftarini ko'rib chiqing`, `Maqtov bilan rag'batlantiring`],
      teacher: [`Har dars 1 qisqa matn + xulosa savoli`, `Dalilga asoslangan javobni talab qiling`, `4-haftada mini-diagnostika`],
      student: [`Har kuni 1 matn o'qiyman`, `Javobimni matndan dalil bilan ko'rsataman`, `Yangi so'zlarni yozaman`],
    },
    criteria: [`Scanning savollarida >=75%`, `Xulosa savollarida >=62%`, `Yangi 150+ so'z o'zlashtirilgan`],
    kpis: [`O'qish-xulosa: ${f1base} -> >=62`, `O'qish (umumiy): ${readBase} -> >=78`, `Texnik xato: ${r.technicalLost} -> <=2`],
    smart: '',
    risks: [
      { risk: `O'qish zerikarli bo'lishi`, mitigation: `Qiziqarli, qisqa matnlar (hikoya, komiks) + tanlov erkinligi` },
      { risk: `Tarjimaga ortiqcha tayanish`, mitigation: `Avval kontekstdan taxmin, keyin lug'at` },
    ],
    closing: `Bola qisqa matnlarni ishonchli o'qiydi, aniq ma'lumot va oddiy xulosani topadi; o'qish bo'limi sezilarli ko'tariladi.`,
    confidence: { label: 'Yuqori', color: BAND_COLORS.good },
  };

  const p2 = {
    num: 12, months: 6, range: `3-6 oy`, phase: `2-bosqich · keyingi 3 oy (3-6 oy) · kengaytirish`,
    title: `2-bosqich - Keyingi 3 oy: tanqidiy fikrlash va funksional til`,
    mission: `Ingliz tilida tanqidiy fikrlash (fakt/fikr, mantiq) va kundalik funksional tilni mustahkamlaymiz.`,
    actions: [
      { do: `"Fakt yoki fikr?" - jumlalarni ajratish mashqi`, dose: `haftada 2` },
      { do: `Belgi/poster/e'lonlarni o'qib, savolga javob`, dose: `haftada 1` },
      { do: `Muloyim murojaat (register) - rol o'yini`, dose: `haftada 1` },
      { do: `Qisqa mantiqiy masala (ingliz tilida)`, dose: `haftada 1` },
    ],
    road: { label: `Tanqidiy va funksional til`, gain: { from: ctBase, to: 70 }, note: `haftada 2 mashq` },
    priority: prio(`O'rta-yuqori`, BAND_COLORS.orange),
    baseline: { label: `Boshlang'ich tanqidiy fikrlash`, val: ctBase, color: BAND_COLORS.bad },
    target: { label: `Maqsadli daraja`, val: '>=70', color: BAND_COLORS.green },
    overall: { from: m3, to: m6 },
    weeklyHours: '4 soat', monthlyHours: '~16 soat', totalHours: '~45 soat',
    growthBars: [],
    goal: `Fakt va fikrni farqlash, muallif maqsadini aniqlash va funksional matnlarni (belgi, poster, taklif) tushunishni mustahkamlash; A1+ darajadagi savollarda ishonchni oshirish.`,
    outcome: `Tanqidiy fikrlash ${ctBase}% -> 70%; funksional til savollarida ishonch oshadi; A1+ daraja mustahkamlanadi.`,
    topics: [`Fakt va fikrni farqlash`, `Muallif maqsadi / fikri`, `Funksional matnlar (belgi, poster)`, `Muloyim murojaat (register)`, `Grafik/diagramma o'qish`],
    skills: [`Critical thinking (tanqidiy fikrlash)`, `Communication readiness (funksional til)`, `Information processing`, `Interpretation skills`],
    weekPlan: [
      { period: '1-oy', focus: `Fakt va fikr`, task: `Haftada 2 "fakt/fikr" mashqi` },
      { period: '2-oy', focus: `Muallif maqsadi`, task: `"Nega yozilgan?" savoliga javob` },
      { period: '3-oy', focus: `Funksional matnlar`, task: `Belgi/poster + 1 savol/hafta` },
      { period: '4-oy', focus: `Register (muloyimlik)`, task: `Muloyim/norasmiy - rol o'yini` },
      { period: '5-oy', focus: `Grafik o'qish`, task: `Diagrammadan ma'lumot o'qish` },
      { period: '6-oy', focus: `Mustahkamlash`, task: `Aralash mashq + 6-oylik diagnostika` },
    ],
    checkpoints: [
      { label: '2-oy', lines: ['Fakt/fikr', 'asoslari'] },
      { label: '4-oy', lines: ['Funksional', 'til'] },
      { label: '6-oy', lines: ['Register +', 'diagnostika'] },
    ],
    resources: {
      exercises: [`Haftada 2 "fakt/fikr" mashqi`, `1 funksional matn/hafta`, `Register rol o'yini`],
      books: [`Cambridge A2 Key for Schools (Reading/Use)`, `Mantiqiy o'yinlar (ingliz tilida)`],
      platforms: [`British Council - LearnEnglish Teens`, `Cambridge A2 practice`, `Kahoot (ingliz tili)`],
      videos: [`Fact vs Opinion for kids (YouTube)`, `Everyday English conversations (A1-A2)`],
    },
    roles: {
      parent: [`Kundalik hayotda fakt/fikrni ko'rsating`, `Ingliz tilidagi belgilarni birga o'qing`, `Sabr bilan rag'batlantiring`],
      teacher: [`Haftada 2 tanqidiy topshiriq`, `Funksional matnlarni dars rejasiga qo'shing`, `Register (muloyimlik) ni baholang`],
      student: [`"Bu fakt yoki fikr?" deb so'rayman`, `Belgilarni o'qib tushunaman`, `Muloyim murojaatni mashq qilaman`],
    },
    criteria: [`Fakt/fikr mashqida >=70%`, `Funksional matn savollarida >=75%`, `A1+ savollarda aniqlik >=70%`],
    kpis: [`Tanqidiy fikrlash: ${ctBase} -> >=70`, `Funksional til mustahkam`, `A1+ daraja: ${a1pBase} -> >=72`],
    smart: '',
    risks: [
      { risk: `Mavhum tushunchalardan qiynalish`, mitigation: `Real, kundalik misollar (reklama, e'lon) bilan o'rgatish` },
      { risk: `Funksional tilni yodlab olish`, mitigation: `Vaziyatli (rol o'yini) mashq, yodlash emas` },
    ],
    closing: `Bola ingliz tilida fakt va fikrni ajratadi, funksional matnlarni tushunadi va muloyim murojaat qiladi; A1+ daraja barqarorlashadi.`,
    confidence: { label: `O'rta`, color: BAND_COLORS.ok },
  };

  const p3 = {
    num: 13, months: 12, range: `6-12 oy`, phase: `3-bosqich · keyingi 6 oy (6-12 oy) · mustahkamlash`,
    title: `3-bosqich - Keyingi 6 oy: A2 tayyorlik va yozuv`,
    mission: `A2 darajadagi savollarni va matn asosida yozma javobni mustahkamlab, ${g}-sinf ingliz tiliga to'liq tayyorlaymiz.`,
    actions: [
      { do: `Matn asosida 3-4 jumlali yozma javob`, dose: `haftada 2` },
      { do: `A2 darajadagi o'qish/grammatika mashqi`, dose: `haftada 2` },
      { do: `Yangi grammatik tuzilma (zamonlar, qiyos)`, dose: `haftada 1` },
      { do: `Aralash A2 mini-test (vaqt bilan)`, dose: `choraklik` },
    ],
    road: { label: `A2 tayyorlik va yozuv`, gain: { from: a2base, to: 85 }, note: `haftada 2 yozma mashq` },
    priority: prio(`O'rta`, BAND_COLORS.ok),
    baseline: { label: `Boshlang'ich A2 daraja`, val: a2base, color: BAND_COLORS.ok },
    target: { label: `Maqsadli A2`, val: '>=85', color: BAND_COLORS.green },
    overall: { from: m6, to: m12 },
    weeklyHours: '3-4 soat', monthlyHours: '~14 soat', totalHours: '~40 soat',
    growthBars: [],
    goal: `A2 darajadagi o'qish va grammatikani mustahkamlash; matn asosida qisqa, mazmunli yozma javob (Short Response) ko'nikmasini rivojlantirish.`,
    outcome: `A2 daraja ${a2base}% -> 85%; yozma javob ishonchli; umumiy ball ${m6} -> ${m12}+.`,
    topics: [`A2 grammatika (zamonlar, qiyos)`, `Matn asosida yozma javob`, `Murakkab o'qish matnlari`, `Akademik leksika (asoslari)`, `Vaqt bilan ishlash (stamina)`],
    skills: [`Writing (qisqa yozma javob)`, `Grammar accuracy (A2)`, `Reading comprehension (A2)`, `Mustaqil o'rganish`],
    weekPlan: [
      { period: '1-2-oy', focus: `Yozuv asoslari`, task: `Haftada 2 qisqa yozma javob` },
      { period: '3-4-oy', focus: `A2 grammatika`, task: `Zamonlar, qiyos - bosqichli mashq` },
      { period: '5-6-oy', focus: `Murakkab o'qish`, task: `Uzunroq matn + xulosa` },
      { period: '7-8-oy', focus: `Akademik leksika`, task: `Mavzuviy so'zlar (maktab, fan)` },
      { period: '9-10-oy', focus: `Aralash + vaqt`, task: `Vaqt bilan A2 mini-test` },
      { period: '11-12-oy', focus: `Yakuniy diagnostika`, task: `To'liq qayta baholash + keyingi reja` },
    ],
    checkpoints: [
      { label: '3-oy', lines: ['Yozuv +', 'grammatika'] },
      { label: '6-oy', lines: ['Murakkab', "o'qish"] },
      { label: '9-oy', lines: ['Akademik', 'leksika'] },
      { label: '12-oy', lines: ['Qayta', 'diagnostika'] },
    ],
    resources: {
      exercises: [`Haftada 2 qisqa yozma javob`, `Choraklik A2 mini-test`, `Vaqt belgilab mashq`],
      books: [`Cambridge A2 Key for Schools (to'liq)`, `Oxford Grammar for Schools (A2)`],
      platforms: [`Cambridge English - A2 Key`, `British Council - Writing practice`, `Quizlet (akademik leksika)`],
      videos: [`A2 Key Writing tips (YouTube)`, `English grammar A2 (zamonlar)`],
    },
    roles: {
      parent: [`Yozma mashqlarni rag'batlantiring`, `Choraklik diagnostikani kuzating`, `Yutuqlarni nishonlang`],
      teacher: [`Yozma javoblarni muntazam tekshiring`, `A2 darajadagi mashqlarni qo'shing`, `Choraklik diagnostika o'tkazing`],
      student: [`Haftada 2 marta yozaman`, `A2 mashqlarini bajaraman`, `Choraklik testlarda qatnashaman`],
    },
    criteria: [`Yozma javobda to'g'ri ma'no va tuzilma`, `A2 mashqida >=80%`, `Choraklik diagnostikada o'sish`],
    kpis: [`A2 daraja: ${a2base} -> >=85`, `Yozuv: shakllanmoqda -> ishonchli`, `Umumiy ball: ${m0} -> >=${m12}`],
    smart: '',
    risks: [
      { risk: `Yozuvdan qo'rqish`, mitigation: `Qisqa, namunali yozuvdan boshlash + ijobiy fikr-mulohaza` },
      { risk: `A2 grammatikadan charchash`, mitigation: `Kichik bosqichlar + o'yin shaklidagi mashq` },
    ],
    closing: `Bola A2 darajadagi savollarni uddalaydi, qisqa yozma javob yoza oladi va ${g}-sinf ingliz tili dasturiga to'liq tayyor bo'ladi.`,
    confidence: { label: `O'rta`, color: BAND_COLORS.ok },
  };

  return [p1, p2, p3];
}
