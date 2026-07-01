// ============================================================================
// §10–12 development programs (3 / 6 / 12 months). Strategic templates whose
// FOCUS and NUMBERS are wired to the computed report (weakest topic, KDI,
// score, adjusted, forecast). The strategy scaffolding (weeks, roles, books)
// is curated content in the brand's tone.
// NOTE: ASCII apostrophes only (o', g') per brand guide → strings use backticks.
// ============================================================================
import { BAND_COLORS } from '@sodiq/compute/compute';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function buildPrograms(r) {
  const focus1 = r.weakestTopic; // e.g. "Kasr amallari"
  const f1 = focus1 ? focus1.name : `Asosiy bo'shliq`;
  const f1base = focus1 ? focus1.percent : 0;
  const f1lower = f1.toLowerCase();

  const induktiv = r.byReasoning.find((x) => x.name === 'Induktiv');
  const f2base = induktiv ? induktiv.percent : 47;

  const [m0, m3, m6, m12] = r.growthForecast.map((g) => g.v);
  const hardStrong = r.hardTierPct >= 75;
  const g = r.meta.grade;
  const gapIds = r.gapErrors.map((e) => e.id).slice(0, 3).join('/');
  const prio = (label, color) => ({ label, color });

  // ------------------------------------------------------------- PROGRAM 1
  const p1 = {
    num: 11, months: 3, range: `0–3 oy`, phase: `1-bosqich · dastlabki 3 oy · poydevor`,
    title: `1-bosqich — Dastlabki 3 oy: ${f1.toLowerCase()} ravonligi`,
    mission: `Kasrni noldan ishonchli va tez darajaga olib chiqamiz; e'tiborsizlik xatolarini yo'qotamiz.`,
    actions: [
      { do: `Kasr drili — qo'shish, ayirish, konvertatsiya`, dose: `kuniga 10 daq` },
      { do: `Xato-daftar: har xatoni yozib, qoidasini ayt`, dose: `haftada 1` },
      { do: `Har javobdan keyin tekshirish odatini shakllantirish`, dose: `har masala` },
      { do: `Mini-test bilan o'zlashtirishni o'lchash`, dose: `haftada 1` },
    ],
    road: { label: `Kasr amallari ravonligi`, gain: { from: f1base, to: 78 }, note: `kuniga 10 daqiqa mashq` },
    priority: prio('Yuqori', BAND_COLORS.bad),
    baseline: { label: `Boshlang'ich ${f1lower}`, val: f1base, color: BAND_COLORS.bad },
    target: { label: `Maqsadli ${f1lower}`, val: '≥78', color: BAND_COLORS.green },
    overall: { from: m0, to: m3 },
    weeklyHours: '4–5 soat', monthlyHours: '~17 soat', totalHours: '~52 soat',
    growthBars: [
      { label: f1, from: f1base, to: 78, color: BAND_COLORS.bad },
      { label: 'Umumiy ball', from: m0, to: m3, color: BAND_COLORS.ok },
      { label: 'Hisoblash aniqligi', from: 70, to: 90, color: BAND_COLORS.ok },
    ],
    goal: `${cap(f1lower)} va noto'g'ri↔aralash kasr konvertatsiyasida to'liq ravonlikka erishish; texnik (e'tiborsizlik) xatolarni kamaytirish.`,
    outcome: `Kasr-amal mashqlarida aniqlik 70%→90%; umumiy diagnostik ball ${m0}→${m3}; ${gapIds} tipidagi xatolar yo'qoladi.`,
    topics: [`Bir xil maxrajli qo'shish/ayirish`, `Noto'g'ri kasr → aralash son`, `Aralash son → noto'g'ri kasr`, `Kasr × natural son`, `Sonli nurda kasrni joylash`],
    skills: [`Protsedural ravonlik (amallarni ravon bajarish)`, `Hisoblash aniqligi`, `O'z javobini tekshirish odati`, `Kasr ma'nosini amalga bog'lash`],
    weekPlan: [
      { period: '1–2-hafta', focus: `Maxraj va ulush ma'nosi`, task: `Model bilan kasr; kuniga 10 daq; 1 mini-test` },
      { period: '3–4-hafta', focus: `Qo'shish/ayirish`, task: `20 ta bir xil maxrajli misol/hafta; xato daftari` },
      { period: '5–6-hafta', focus: `Noto'g'ri↔aralash`, task: `Har kuni 5 ta konvertatsiya; "qoidani ayt"` },
      { period: '7–8-hafta', focus: `Kasr × son`, task: `Real masala (retsept, masofa); 2 so'zli masala/hafta` },
      { period: '9–10-hafta', focus: `Sonli nur + tartiblash`, task: `Tartiblash mashqi; tezlik mashqi` },
      { period: '11–12-hafta', focus: `Aralash mustahkamlash`, task: `Aralash 20 ta misol; yakuniy mini-diagnostika` },
    ],
    checkpoints: [
      { label: '1-oy', lines: ['Model +', `qo'shish/ayirish`, 'ravonligi'] },
      { label: '2-oy', lines: ['Konvertatsiya +', `ko'paytirish`] },
      { label: '3-oy', lines: ['Tartiblash +', 'yakuniy', 'tekshiruv'] },
    ],
    resources: {
      exercises: [`Kuniga 10 daqiqa kasr drili`, `Haftada 1 xato-ustida-ishlash daftari`, `"Qoidani ayt" og'zaki mashq`],
      books: [`${g}-sinf matematika darsligi (kasr bo'limi)`, `Qiziqarli matematika — kasrlar`],
      platforms: [`Khan Academy — Fractions`, `Matematika.uz — kasrlar`, `Logiclike (mantiq)`],
      videos: [`Khan Academy: Adding fractions (uz subtitr)`, `YouTube: "Aralash kasr" ${g}-sinf`],
    },
    roles: {
      parent: [`Kuniga 10 daqiqa mashqni nazorat qiling`, `Haftada xato daftarini ko'rib chiqing`, `Maqtov bilan motivatsiya bering`],
      teacher: [`Noto'g'ri↔aralashga 2 hafta maqsadli mashq`, `Har dars 3 ta kasr og'zaki savol`, `4-haftada mini-diagnostika`],
      student: [`Kuniga 10 daqiqa mashqni bajaraman`, `Har masaladan keyin javobni tekshiraman`, `Tushunmagan joyni so'rayman`],
    },
    criteria: [`Mini-test aniqligi ≥85%`, `Konvertatsiyada xato ≤1/10`, `Tezlik: 10 ta misol ≤5 daqiqa`],
    kpis: [`${f1}: ${f1base} → ≥78`, `Texnik xato: ${r.technicalLost} ball → ≤3 ball`, `Umumiy ball: ${m0} → ≥${m3}`],
    smart: `3 oy ichida ${f1lower} ko'nikmasini ${f1base} dan kamida 78 ballga ko'tarish; har haftalik mini-testda ≥85% aniqlik, kuniga 10 daqiqa muntazam mashq orqali.`,
    risks: [
      { risk: `Mashq muntazam bo'lmasligi`, mitigation: `Belgilangan vaqt + ota-ona nazorati + qisqa sessiyalar (10 daq)` },
      { risk: `Ko'paytirishni qo'shish bilan adashtirish`, mitigation: `Vizual model (maydon) + bosqichli misollar` },
    ],
    closing: `Bola ${f1lower}ni ishonchli va tez bajaradi; texnik xatolar deyarli yo'qoladi; umumiy ball ~${m3} ga chiqadi va profil "Qattiq tavsiya" tomon siljiydi.`,
    confidence: { label: 'Yuqori', color: BAND_COLORS.good },
  };

  // ------------------------------------------------------------- PROGRAM 2
  const p2 = {
    num: 12, months: 6, range: `3–6 oy`, phase: `2-bosqich · keyingi 3 oy (3–6 oy) · kengaytirish`,
    title: `2-bosqich — Keyingi 3 oy: qonuniyat va ko'p talabli masala`,
    mission: `Qonuniyat topish va ko'p-talabli masalalarni rejalashtirib yechishni mustahkamlaymiz.`,
    actions: [
      { do: `Qonuniyat o'yini — "keyingi son yoki shakl nima?"`, dose: `haftada 2` },
      { do: `Ikki-talabli masalada bosqichlarni belgilash`, dose: `haftada 1` },
      { do: `"Nima so'ralyapti?" — yechishdan oldin reja tuzish`, dose: `har masala` },
      { do: `Javobni qayta tekshirib tasdiqlash`, dose: `har masala` },
    ],
    road: { label: `Qonuniyat va ko'p-talab`, gain: { from: f2base, to: 70 }, note: `haftada 2 mantiq o'yini` },
    priority: prio(`O'rta-yuqori`, BAND_COLORS.orange),
    baseline: { label: `Boshlang'ich qonuniyat`, val: f2base, color: BAND_COLORS.bad },
    target: { label: `Maqsadli qonuniyat`, val: '≥70', color: BAND_COLORS.green },
    overall: { from: m3, to: m6 },
    weeklyHours: '4 soat', monthlyHours: '~16 soat', totalHours: '~45 soat',
    growthBars: [
      { label: 'Qonuniyat topish', from: f2base, to: 70, color: BAND_COLORS.bad },
      { label: 'Ikki-talabli masala', from: 65, to: 82, color: BAND_COLORS.orange },
      { label: 'Tekshirish odati', from: 60, to: 85, color: BAND_COLORS.orange },
    ],
    goal: `Induktiv qonuniyat topish (misollardan qoidaga) va ikki-talabli (bir masalada ikki narsa so'raladigan) masalalarda ishonchni oshirish; kuchli deduktiv mantiqni saqlash.`,
    outcome: `Qonuniyat ${f2base}→70+; ikki bosqichli masalada "javobni tekshir" odati o'rnashadi; induktiv/ikki-talab tipidagi xatolar kamayadi.`,
    topics: [`Sonli va figurali ketma-ketliklar`, `Arifmetik-geometrik qoidalar`, `Perimetr + yuza birga (ikki talab)`, `Ko'p bosqichli so'zli masalalar`],
    skills: [`Induktiv xulosa (misollardan qoidaga)`, `Masalani bo'laklarga ajratish`, `Javobni tekshirib tasdiqlash`, `Strategik rejalashtirish`],
    weekPlan: [
      { period: '1-oy', focus: `Oddiy ketma-ketliklar`, task: `Haftada 2 "qoidani top" mashqi; qoidani yozish` },
      { period: '2-oy', focus: `Murakkab qonuniyatlar`, task: `Aralash ketma-ketlik; o'sish qoidasi` },
      { period: '3-oy', focus: `Ikki talab: perimetr+yuza`, task: `Haftada 1 ikki-talabli masala; bosqich belgilash` },
      { period: '4-oy', focus: `So'zli masala strategiyasi`, task: `"Nima so'ralyapti?" + reja tuzish odati` },
      { period: '5-oy', focus: `Tekshirish odati`, task: `Har masaladan keyin javobni qayta tekshirish` },
      { period: '6-oy', focus: `Mustahkamlash`, task: `Aralash mashq + 6-oylik diagnostika` },
    ],
    checkpoints: [
      { label: '2-oy', lines: ['Qonuniyat', 'asoslari'] },
      { label: '4-oy', lines: ['Ikki-talabli', 'masala'] },
      { label: '6-oy', lines: ['Tekshirish +', 'diagnostika'] },
    ],
    resources: {
      exercises: [`Haftada 2 ta qonuniyat o'yini`, `1 ikki-talabli masala/hafta`, `Og'zaki "keyingi son nima?"`],
      books: [`Kenguru (Kangaroo) masalalar to'plami`, `Mantiqiy masalalar to'plami ${g}-sinf`],
      platforms: [`Logiclike — qonuniyatlar`, `Bilimland — mantiq`, `Khan Academy — patterns`],
      videos: [`YouTube: "Sonlar qonuniyati" ${g}-sinf`, `Logiclike video qo'llanmalari`],
    },
    roles: {
      parent: [`Kundalik hayotda qonuniyatlarni ko'rsating`, `Haftalik mashqni rag'batlantiring`, `Sabr bilan o'ylashga vaqt bering`],
      teacher: [`Haftada 2 marta induktiv topshiriq`, `Ikki-talabli masalada bosqich talab qiling`, `"Javobni tekshir" odatini baholang`],
      student: [`Har masalada "nima so'ralyapti?" deb so'rayman`, `Javobimni qayta tekshiraman`, `Qonuniyat o'yinlarini bajaraman`],
    },
    criteria: [`Qonuniyat mashqida ≥70% to'g'ri`, `Ikki-talabli masalada ikkala qism bajarilgan`, `Tekshirishdan keyin xato ≤10%`],
    kpis: [`Qonuniyat: ${f2base} → ≥70`, `Ikki-talabli aniqlik: 65 → ≥82`, `Mantiq darajasi ${r.hardTierPct}% saqlanadi`],
    smart: `6 oy ichida qonuniyat topish ko'nikmasini ${f2base} dan ≥70 ballga ko'tarish; ikki-talabli masalalarda ikkala talabni bajarish darajasini ≥82% ga yetkazish, haftada 2 mashq orqali.`,
    risks: [
      { risk: `Qonuniyatda qiziqish yo'qolishi`, mitigation: `O'yin shaklida (jadval, rang) + qisqa sessiyalar` },
      { risk: `Ikki-talabning bir qismini unutish`, mitigation: `Bosqich-checklist + "tekshir" odati` },
    ],
    closing: `Bola yashirin qoidalarni topadi, ko'p bosqichli masalalarni rejalashtirib yechadi va o'z javobini tekshiradi; profil barqaror "Yaxshi" darajaga mustahkamlanadi.`,
    confidence: { label: `O'rta`, color: BAND_COLORS.ok },
  };

  // ------------------------------------------------------------- PROGRAM 3
  const p3 = {
    num: 13, months: 12, range: `6–12 oy`, phase: `3-bosqich · keyingi 6 oy (6–12 oy) · mustahkamlash`,
    title: `3-bosqich — Keyingi 6 oy: ${g}-sinf to'liq mahorat${hardStrong ? ' va olimpiada (yengil)' : ''}`,
    mission: `Butun ${g}-sinf dasturini mustahkamlab, fikrlashni olimpiadaga yaqin darajaga boyitamiz.`,
    actions: [
      { do: `Aralash mavzu testi — kasr, nisbat, geometriya`, dose: `choraklik` },
      { do: `Noan'anaviy (olimpiada-lite) masala yechish`, dose: `haftada 1` },
      { do: `Vaqt belgilab mashq — chidamlilikni oshirish`, dose: `haftada 1` },
      { do: `Mustaqil o'qib, qoidani o'z so'zi bilan tushuntirish`, dose: `muntazam` },
    ],
    road: { label: `${g}-sinf to'liq mahorat`, gain: { from: m0, to: m12 }, note: `haftada 1 qiyin masala` },
    priority: prio(`O'rta`, BAND_COLORS.ok),
    baseline: { label: `Boshlang'ich umumiy`, val: m0, color: BAND_COLORS.ok },
    target: { label: `Maqsadli umumiy`, val: `≥${m12}`, color: BAND_COLORS.green },
    overall: { from: m6, to: m12 },
    weeklyHours: '3–4 soat', monthlyHours: '~14 soat', totalHours: '~40 soat',
    growthBars: [
      { label: 'Umumiy ball', from: m0, to: m12, color: BAND_COLORS.ok },
      { label: 'Kasr (mustahkam)', from: 78, to: 90, color: BAND_COLORS.ok },
      { label: 'Olimpiada-lite tayyorlik', from: 40, to: 70, color: BAND_COLORS.bad },
    ],
    goal: `${g}-sinf matematika dasturini to'liq mustahkamlash; kuchli fikrlashni boyituvchi (olimpiadaga yaqin) masalalar bilan rivojlantirish.`,
    outcome: `Umumiy ball ${m0}→${m12}+; kasr ko'nikmasi mustahkam (≥90); choraklik diagnostikalarda barqaror o'sish.`,
    topics: [`Har xil maxrajli kasr amallari`, `Nisbat va proporsiya asoslari`, `Murakkab geometrik yuzalar`, `Olimpiada-lite mantiq masalalari`],
    skills: [`Bilim transferi (yangi vaziyatga ko'chirish)`, `Murakkab masala yechish`, `Mustaqil o'rganish`, `Uzoq diqqat va chidamlilik`],
    weekPlan: [
      { period: '1–2-oy', focus: `Kasrni mustahkamlash`, task: `Har xil maxraj; haftada 1 aralash test` },
      { period: '3–4-oy', focus: `Nisbat/proporsiya`, task: `Real masalalar; bosqichli yechim` },
      { period: '5–6-oy', focus: `Geometriya kengaytirish`, task: `Murakkab yuza; chizma bilan` },
      { period: '7–8-oy', focus: `Olimpiada-lite`, task: `Haftada 1 noan'anaviy masala` },
      { period: '9–10-oy', focus: `Aralash mashq`, task: `Barcha mavzu aralash; vaqt bilan` },
      { period: '11–12-oy', focus: `Yakuniy diagnostika`, task: `To'liq qayta baholash + keyingi reja` },
    ],
    checkpoints: [
      { label: '3-oy', lines: ['Kasr + nisbat'] },
      { label: '6-oy', lines: ['Geometriya'] },
      { label: '9-oy', lines: ['Olimpiada-lite'] },
      { label: '12-oy', lines: ['Qayta', 'diagnostika'] },
    ],
    resources: {
      exercises: [`Haftada 1 olimpiadaga yaqin masala`, `Choraklik aralash test`, `Vaqt belgilab mashq (chidamlilik)`],
      books: [`Olimpiada masalalari to'plami (boshlang'ich)`, `${g}-sinf to'liq mashqlar to'plami`],
      platforms: [`Bilimland`, `Khan Academy — 5th grade`, `Logiclike (premium mantiq)`],
      videos: [`Olimpiada tayyorlik video kurslari`, `Khan Academy ${g}-sinf to'liq kurs`],
    },
    roles: {
      parent: [`Choraklik diagnostikani kuzating`, `Mustaqil o'qishni rag'batlantiring`, `Yutuqlarni nishonlang`],
      teacher: [`Olimpiada-lite masalalarni qo'shing`, `Choraklik diagnostika o'tkazing`, `Kuchli tomonni (mantiq) rivojlantiring`],
      student: [`Haftada 1 qiyin masalani yechaman`, `Mustaqil o'qiyman`, `Choraklik testlarda qatnashaman`],
    },
    criteria: [`Choraklik diagnostikada o'sish ko'rinadi`, `Kasr ≥90 darajada barqaror`, `Olimpiada-lite ≥50% yechiladi`],
    kpis: [`Umumiy ball: ${m0} → ≥${m12}`, `Kasr: 78 → ≥90`, `Olimpiada-lite tayyorlik: 40 → ≥70`],
    smart: `12 oy ichida umumiy diagnostik ballni ${m0} dan ≥${m12} ga ko'tarish va kasr ko'nikmasini ≥90 darajada barqarorlashtirish; choraklik diagnostikalar va haftalik boyituvchi masalalar orqali.`,
    risks: [
      { risk: `Mavzular unutilishi (regress)`, mitigation: `Choraklik aralash takror + spiral mashq` },
      { risk: `Qiyin masalada ruhiy tushkunlik`, mitigation: `Bosqichli qiyinlik + kichik g'alabalarni nishonlash` },
    ],
    closing: `Bola ${g}-sinf dasturini to'liq egallaydi, kasr mustahkam, fikrlash olimpiadaga yaqin darajaga boyiydi; profil "Yaxshi" toifaga barqaror chiqadi va keyingi sinf uchun tayyor bo'ladi.`,
    confidence: { label: `O'rta`, color: BAND_COLORS.ok },
  };

  return [p1, p2, p3];
}

// ----------------------------------------------------------------------------
// Consolidated skill-growth trajectory for the after-roadmap slope chart (§14).
// Replaces the three per-stage growth-bar blocks with ONE from->to view across
// Hozir / 3 oy / 6 oy / 12 oy. Overall-ball points are real (growthForecast);
// per-skill intermediate stops are curated milestone targets (template stage).
// ----------------------------------------------------------------------------
export function buildSkillGrowth(r) {
  const [m0, m3, m6, m12] = r.growthForecast.map((g) => g.v);
  const focus = r.weakestTopic;
  const f1base = focus ? focus.percent : 55;
  const induktiv = r.byReasoning.find((x) => x.name === 'Induktiv');
  const f2base = induktiv ? induktiv.percent : 47;
  return [
    { name: 'Umumiy ball', color: '#06113C', points: [m0, m3, m6, m12] },
    { name: 'Kasr amallari', color: '#FF8A32', points: [f1base, Math.max(f1base, 78), 84, 90] },
    { name: 'Qonuniyat', color: '#3266C9', points: [f2base, Math.max(f2base, 35), 70, 78] },
  ];
}
