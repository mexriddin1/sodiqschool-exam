// ============================================================================
// CRITICAL THINKING development roadmap (5-sinf). Same object shape as
// buildPrograms, focused on the CT profile: spatial-visual reasoning (weakest)
// -> systematic counting & data -> olympiad-level enrichment of strong logic.
// ASCII apostrophes only (o', g').
// ============================================================================
import { BAND_COLORS } from '@sodiq/compute/compute';

export function buildCtPrograms(r) {
  const [m0, m3, m6, m12] = r.growthForecast.map((x) => x.v);
  const focus = r.weakestTopic; // Fazoviy-vizual mulohaza
  const f1base = focus ? focus.percent : 0;
  const counting = r.byStrand.find((s) => s.name === 'Kombinatorika');
  const countBase = counting ? counting.percent : 30;
  const g = r.meta.grade;
  const prio = (label, color) => ({ label, color });

  const p1 = {
    num: 11, months: 3, range: `0-3 oy`, phase: `1-bosqich · dastlabki 3 oy · poydevor`,
    title: `1-bosqich - Dastlabki 3 oy: fazoviy-vizual mulohaza`,
    mission: `Shakllarni aqlan aylantirish va vizual qonuniyatlarni ko'rishni mustahkamlaymiz - eng bo'sh yo'nalish.`,
    actions: [
      { do: `Shaklni aqlan aylantirish (rotation) mashqi`, dose: `kuniga 10 daq` },
      { do: `Tangram / origami bilan fazoviy o'yin`, dose: `haftada 3` },
      { do: `"Keyingi shakl nima?" - vizual qonuniyat`, dose: `har kuni 3 ta` },
      { do: `3D kublarni qog'ozda chizib tasavvur qilish`, dose: `haftada 2` },
    ],
    road: { label: `Fazoviy-vizual mulohaza`, gain: { from: f1base, to: 55 }, note: `kuniga 10 daq mashq` },
    priority: prio('Yuqori', BAND_COLORS.bad),
    baseline: { label: `Boshlang'ich fazoviy`, val: f1base, color: BAND_COLORS.bad },
    target: { label: `Maqsadli daraja`, val: '>=55', color: BAND_COLORS.green },
    overall: { from: m0, to: m3 },
    weeklyHours: '4 soat', monthlyHours: '~16 soat', totalHours: '~48 soat',
    growthBars: [],
    goal: `Shakllarni aqlan aylantirish (mental rotation), vizual qonuniyatlarni topish va fazoviy tasavvurni mustahkamlash; rasmli savollarda ishonchni oshirish.`,
    outcome: `Fazoviy savollarda aniqlik ${f1base}% -> 55%; vizual qonuniyatlarda ishonch; umumiy ball ${m0} -> ${m3}.`,
    topics: [`Aqliy aylantirish (mental rotation)`, `Vizual qonuniyatlar`, `2D va 3D shakllar`, `Simmetriya va akslantirish`, `Fazoda yo'nalish`],
    skills: [`Fazoviy tasavvur`, `Aqliy aylantirish`, `Vizual qonuniyatni topish`, `Diqqat va kuzatuvchanlik`],
    weekPlan: [
      { period: '1-2-hafta', focus: `Aylantirish asoslari`, task: `90/180 daraja aylantirish; kuniga 5 ta` },
      { period: '3-4-hafta', focus: `Vizual qonuniyat`, task: `"Keyingi shakl" mashqi; rasmda farqni top` },
      { period: '5-6-hafta', focus: `2D shakllar`, task: `Tangram bilan shakl yig'ish` },
      { period: '7-8-hafta', focus: `3D tasavvur`, task: `Kub yoyilmasi; teshik/qavat mashqi` },
      { period: '9-10-hafta', focus: `Simmetriya`, task: `Akslantirish va simmetriya o'yinlari` },
      { period: '11-12-hafta', focus: `Mustahkamlash`, task: `Aralash vizual test + mini-diagnostika` },
    ],
    checkpoints: [
      { label: '1-oy', lines: ['Aylantirish +', 'qonuniyat'] },
      { label: '2-oy', lines: ['2D/3D', 'shakllar'] },
      { label: '3-oy', lines: ['Aralash +', 'tekshiruv'] },
    ],
    resources: {
      exercises: [`Kuniga 10 daqiqa fazoviy mashq`, `Haftada 3 tangram/origami`, `Vizual qonuniyat kartochkalari`],
      books: [`Mind Benders (vizual mantiq)`, `CAT4 Non-verbal Reasoning mashqlar`],
      platforms: [`Logiclike - fazoviy mantiq`, `Khan Academy - geometry intuition`, `NRICH - spatial`],
      videos: [`Mental rotation for kids (YouTube)`, `Tangram va origami darslari`],
    },
    roles: {
      parent: [`Kuniga 10 daqiqa fazoviy o'yinni nazorat qiling`, `Tangram/Lego bilan birga o'ynang`, `Maqtov bilan rag'batlantiring`],
      teacher: [`Har dars 2 ta vizual qonuniyat savoli`, `Aylantirishni qadam-baqadam tushuntiring`, `4-haftada mini-diagnostika`],
      student: [`Har kuni shakl aylantirish mashqini bajaraman`, `Rasmda qonuniyatni izlayman`, `Tangram bilan o'ynayman`],
    },
    criteria: [`Aylantirish mashqida >=70%`, `Vizual qonuniyatda >=60%`, `3D yoyilma savollarida ishonch`],
    kpis: [`Fazoviy: ${f1base} -> >=55`, `Vizual qonuniyat mustahkam`, `Texnik xato: ${r.technicalLost} -> <=2`],
    smart: '',
    risks: [
      { risk: `Fazoviy savollar qiyin tuyulishi`, mitigation: `Qo'lda ushlanadigan model (Lego, qog'oz) bilan boshlash` },
      { risk: `Tez taslim bo'lish`, mitigation: `Kichik, bosqichli qiyinlik + o'yin shakli` },
    ],
    closing: `Bola shakllarni aqlan aylantiradi, vizual qonuniyatlarni topadi; fazoviy yo'nalish noldan ishonchli darajaga ko'tariladi.`,
    confidence: { label: 'Yuqori', color: BAND_COLORS.good },
  };

  const p2 = {
    num: 12, months: 6, range: `3-6 oy`, phase: `2-bosqich · keyingi 3 oy (3-6 oy) · kengaytirish`,
    title: `2-bosqich - Keyingi 3 oy: tizimli sanash va ma'lumot tahlili`,
    mission: `Kombinatorika (tizimli sanash) va diagramma/ma'lumot tahlilida xatosiz, izchil ishlashni mustahkamlaymiz.`,
    actions: [
      { do: `Barcha variantni tizimli sanash (jadval bilan)`, dose: `haftada 3` },
      { do: `Diagramma/jadvaldan xulosa chiqarish`, dose: `haftada 2` },
      { do: `"Hammasini sanadimmi?" - tekshirish odati`, dose: `har masala` },
      { do: `Ko'p bosqichli masalani rejalashtirish`, dose: `haftada 2` },
    ],
    road: { label: `Tizimli sanash va tahlil`, gain: { from: countBase, to: 70 }, note: `haftada 3 mashq` },
    priority: prio(`O'rta-yuqori`, BAND_COLORS.orange),
    baseline: { label: `Boshlang'ich sanash`, val: countBase, color: BAND_COLORS.bad },
    target: { label: `Maqsadli daraja`, val: '>=70', color: BAND_COLORS.green },
    overall: { from: m3, to: m6 },
    weeklyHours: '4 soat', monthlyHours: '~16 soat', totalHours: '~45 soat',
    growthBars: [],
    goal: `Barcha imkoniyatlarni tizimli (jadval/daraxt bilan) sanash, diagramma va jadvaldan to'g'ri ma'lumot o'qish va xulosa chiqarishni mustahkamlash.`,
    outcome: `Tizimli sanash ${countBase}% -> 70%; ma'lumot tahlilida aniqlik oshadi; o'rta darajadagi savollar mustahkamlanadi.`,
    topics: [`Tizimli sanash (jadval/daraxt)`, `Kombinatorika asoslari`, `Diagramma va jadval o'qish`, `Ma'lumotdan xulosa`, `Ko'p bosqichli masala`],
    skills: [`Tizimli sanash`, `Ma'lumotni talqin qilish`, `Tartibli ishlash`, `O'z javobini tekshirish`],
    weekPlan: [
      { period: '1-oy', focus: `Tizimli sanash`, task: `Jadval bilan barcha variantni sanash` },
      { period: '2-oy', focus: `Kombinatorika`, task: `"Nechta usul bor?" - daraxt sxema` },
      { period: '3-oy', focus: `Diagramma o'qish`, task: `Grafik/jadvaldan ma'lumot topish` },
      { period: '4-oy', focus: `Xulosa chiqarish`, task: `Ma'lumotdan to'g'ri xulosa` },
      { period: '5-oy', focus: `Tekshirish odati`, task: `"Hammasini sanadimmi?" nazorati` },
      { period: '6-oy', focus: `Mustahkamlash`, task: `Aralash mashq + 6-oylik diagnostika` },
    ],
    checkpoints: [
      { label: '2-oy', lines: ['Sanash', 'asoslari'] },
      { label: '4-oy', lines: ['Diagramma', 'tahlili'] },
      { label: '6-oy', lines: ['Tekshirish +', 'diagnostika'] },
    ],
    resources: {
      exercises: [`Haftada 3 sanash o'yini`, `1 diagramma tahlili/hafta`, `Daraxt sxema mashqi`],
      books: [`Kenguru (Kangaroo) kombinatorika masalalari`, `Ma'lumot savodxonligi (PISA uslubi)`],
      platforms: [`NRICH - counting & combinatorics`, `Logiclike - jadval mantiq`, `Khan Academy - data`],
      videos: [`Systematic counting for kids`, `Reading charts and tables (A1-A2)`],
    },
    roles: {
      parent: [`Kundalik hayotda "nechta usul?" deb so'rang`, `Jadval/grafiklarni birga o'qing`, `Sabr bilan rag'batlantiring`],
      teacher: [`Tizimli sanashni jadval bilan o'rgating`, `Diagramma savollarini qo'shing`, `Tekshirish odatini baholang`],
      student: [`Barcha variantni jadvalda sanayman`, `Diagrammadan ma'lumot o'qiyman`, `Javobimni qayta tekshiraman`],
    },
    criteria: [`Sanash mashqida >=70% to'liq`, `Diagramma savollarida >=75%`, `Tekshirishdan keyin xato kamayadi`],
    kpis: [`Tizimli sanash: ${countBase} -> >=70`, `Ma'lumot tahlili mustahkam`, `O'rta tier: 60 -> >=80`],
    smart: '',
    risks: [
      { risk: `Variantlarni tartibsiz sanash`, mitigation: `Doimo jadval yoki daraxt sxema bilan ishlash` },
      { risk: `Diagrammani shoshib o'qish`, mitigation: `Avval sarlavha va o'qlarni o'qish odati` },
    ],
    closing: `Bola barcha imkoniyatlarni tartibli sanaydi, diagramma va jadvaldan to'g'ri xulosa chiqaradi; o'rta darajadagi savollar mustahkamlanadi.`,
    confidence: { label: `O'rta`, color: BAND_COLORS.ok },
  };

  const p3 = {
    num: 13, months: 12, range: `6-12 oy`, phase: `3-bosqich · keyingi 6 oy (6-12 oy) · mustahkamlash`,
    title: `3-bosqich - Keyingi 6 oy: olimpiada darajasidagi mantiq`,
    mission: `Bolaning kuchli mantiqiy va abstrakt fikrlashini olimpiadaga yaqin masalalar bilan boyitamiz va barcha yo'nalishni mustahkamlaymiz.`,
    actions: [
      { do: `Olimpiada-lite mantiq masalasi (haftada 1)`, dose: `haftada 1` },
      { do: `Murakkab matritsa / abstrakt qonuniyat`, dose: `haftada 1` },
      { do: `Strategik o'yin (shaxmat, mantiq jumboq)`, dose: `haftada 2` },
      { do: `Aralash CT mini-test (vaqt bilan)`, dose: `choraklik` },
    ],
    road: { label: `Olimpiada-lite mantiq`, gain: { from: m0, to: m12 }, note: `haftada 1 qiyin masala` },
    priority: prio(`O'rta`, BAND_COLORS.ok),
    baseline: { label: `Boshlang'ich umumiy`, val: m0, color: BAND_COLORS.ok },
    target: { label: `Maqsadli umumiy`, val: `>=${m12}`, color: BAND_COLORS.green },
    overall: { from: m6, to: m12 },
    weeklyHours: '3-4 soat', monthlyHours: '~14 soat', totalHours: '~40 soat',
    growthBars: [],
    goal: `Kuchli deduktiv, abstrakt va strategik fikrlashni olimpiadaga yaqin masalalar bilan rivojlantirish; barcha yo'nalishlarni baravar mustahkamlash.`,
    outcome: `Umumiy ball ${m0}->${m12}+; abstrakt va strategik fikrlash boyiydi; barcha yo'nalish muvozanatli.`,
    topics: [`Olimpiada-lite mantiq masalalari`, `Murakkab abstrakt matritsa`, `Strategiya va optimallashtirish`, `Ko'p shartli deduksiya`, `Vaqt bilan ishlash (stamina)`],
    skills: [`Abstrakt mulohaza`, `Strategik fikrlash`, `Mantiqiy xulosa`, `Mustaqil o'rganish`],
    weekPlan: [
      { period: '1-2-oy', focus: `Murakkab deduksiya`, task: `Ko'p shartli mantiq jadvali` },
      { period: '3-4-oy', focus: `Abstrakt matritsa`, task: `Murakkab qonuniyat matritsalari` },
      { period: '5-6-oy', focus: `Strategiya`, task: `Optimallashtirish va o'yin nazariyasi (oddiy)` },
      { period: '7-8-oy', focus: `Olimpiada-lite`, task: `Haftada 1 noan'anaviy masala` },
      { period: '9-10-oy', focus: `Aralash + vaqt`, task: `Vaqt bilan CT mini-test` },
      { period: '11-12-oy', focus: `Yakuniy diagnostika`, task: `To'liq qayta baholash + keyingi reja` },
    ],
    checkpoints: [
      { label: '3-oy', lines: ['Deduksiya +', 'matritsa'] },
      { label: '6-oy', lines: ['Strategiya'] },
      { label: '9-oy', lines: ['Olimpiada-lite'] },
      { label: '12-oy', lines: ['Qayta', 'diagnostika'] },
    ],
    resources: {
      exercises: [`Haftada 1 olimpiada-lite masala`, `Choraklik aralash CT test`, `Strategik o'yin (shaxmat)`],
      books: [`Olimpiada mantiq masalalari (boshlang'ich)`, `Oxford TSA / CAT4 advanced`],
      platforms: [`NRICH - advanced problems`, `Bilimland - mantiq`, `Logiclike (premium)`],
      videos: [`Olympiad logic for kids`, `Abstract reasoning strategies`],
    },
    roles: {
      parent: [`Choraklik diagnostikani kuzating`, `Mantiqiy o'yinlarni rag'batlantiring`, `Yutuqlarni nishonlang`],
      teacher: [`Olimpiada-lite masalalarni qo'shing`, `Abstrakt qonuniyatlarni rivojlantiring`, `Choraklik diagnostika o'tkazing`],
      student: [`Haftada 1 qiyin masalani yechaman`, `Strategik o'yin o'ynayman`, `Choraklik testlarda qatnashaman`],
    },
    criteria: [`Choraklik diagnostikada o'sish`, `Olimpiada-lite >=50% yechiladi`, `Barcha yo'nalish >=70%`],
    kpis: [`Umumiy ball: ${m0} -> >=${m12}`, `Abstrakt/strategik boyiydi`, `Fazoviy: 55 -> >=75`],
    smart: '',
    risks: [
      { risk: `Qiyin masalada zerikish`, mitigation: `Qiziqarli jumboq + bosqichli qiyinlik` },
      { risk: `Bir yo'nalishga ortiqcha urg'u`, mitigation: `Aralash, muvozanatli mashq rejasi` },
    ],
    closing: `Bola kuchli mantiqiy fikrlashini olimpiadaga yaqin darajaga boyitadi, barcha yo'nalishni egallaydi va keyingi bosqichga to'liq tayyor bo'ladi.`,
    confidence: { label: `O'rta`, color: BAND_COLORS.ok },
  };

  return [p1, p2, p3];
}
