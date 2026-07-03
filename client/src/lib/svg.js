// ============================================================================
// Hand-built SVG — ONE instrument visual language shared across the report
// (cover hero, gauges, pyramid, error bar, benchmark). Mono readouts, thin
// strokes, fine ticks, a single accent marker. Palette mirrors tokens.css so
// SVG and ECharts agree. Server-rendered strings (no client JS).
// ============================================================================
import { pctColor } from '@sodiq/compute/compute';

// palette (kept in sync with tokens.css)
const C = {
  ink: '#0F1629', text: '#3A4256', muted: '#6B7385', faint: '#9AA1B2',
  border: '#E8EAEF', track: '#EEF0F4', navy: '#06113C',
  accent: '#FF8A32', pos: '#2F9E6B', warn: '#C98A12', neg: '#D2503F', info: '#3266C9',
};
const MONO = "'Space Mono', ui-monospace, monospace";
const SANS = "'Hanken Grotesk', system-ui, sans-serif";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
const txt = (x, y, s, { size = 11, fill = C.muted, w = 400, anchor = 'middle', mono = false } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" font-family="${mono ? MONO : SANS}">${s}</text>`;

// ---- COVER HERO INSTRUMENT: score on a 0-100 scale, CI band, accent marker --
// Rendered light-on-navy. The thesis of the whole report.
export function heroInstrument(percent, ci) {
  // ViewBox width is fixed; the SVG stretches to fill its parent (the hero
  // card) via width:100%. preserveAspectRatio="xMidYMid meet" keeps proportions;
  // the parent card is wide enough that the bar visually spans the full width.
  const w = 520, x0 = 14, x1 = 506, y = 56;
  const X = (v) => x0 + ((x1 - x0) * v) / 100;
  const line = 'rgba(255,255,255,.16)';
  const faint = 'rgba(255,255,255,.55)';
  let s = `<svg viewBox="0 0 ${w} 92" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:none" role="img" aria-label="Ball shkalasi ${percent}/100">`;
  // base track
  s += `<rect x="${x0}" y="${y - 3}" width="${x1 - x0}" height="6" rx="3" fill="${line}"/>`;
  // achieved fill
  s += `<rect x="${x0}" y="${y - 3}" width="${(X(percent) - x0).toFixed(1)}" height="6" rx="3" fill="rgba(255,138,50,.55)"/>`;
  // CI band
  s += `<rect x="${X(ci.low).toFixed(1)}" y="${y - 7}" width="${(X(ci.high) - X(ci.low)).toFixed(1)}" height="14" rx="4" fill="rgba(255,138,50,.18)" stroke="rgba(255,138,50,.4)"/>`;
  // ticks
  for (const v of [0, 20, 40, 60, 80, 100]) {
    s += `<line x1="${X(v).toFixed(1)}" y1="${y + 5}" x2="${X(v).toFixed(1)}" y2="${y + 11}" stroke="${line}"/>`;
    s += txt(X(v).toFixed(1), y + 24, v, { size: 9.5, fill: faint, mono: true });
  }
  // marker
  const mx = X(percent);
  s += `<line x1="${mx.toFixed(1)}" y1="${y - 13}" x2="${mx.toFixed(1)}" y2="${y + 9}" stroke="${C.accent}" stroke-width="2.5"/>`;
  s += `<polygon points="${mx.toFixed(1)},${y - 13} ${(mx - 5).toFixed(1)},${y - 21} ${(mx + 5).toFixed(1)},${y - 21}" fill="${C.accent}"/>`;
  return s + '</svg>';
}

// ---- UNIFIED GAUGE (semicircle, fine ticks) — KDI, potential, etc. ----------
export function gauge(value, { color = C.pos, label = '', sub = '' } = {}) {
  const cx = 110, cy = 116, r = 84, sw = 13;
  const pt = (val, rr) => {
    const a = Math.PI * (1 - val / 100);
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  };
  const [ex, ey] = pt(value, r);
  let s = `<svg width="220" height="140" viewBox="0 0 220 140" role="img" aria-label="${esc(label)} ${value}">`;
  // track + value arc
  s += `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${C.track}" stroke-width="${sw}" stroke-linecap="round"/>`;
  s += `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  // fine ticks every 10
  for (let i = 0; i <= 10; i++) {
    const [ax, ay] = pt(i * 10, r + 9);
    const [bx, by] = pt(i * 10, r + (i % 5 === 0 ? 15 : 13));
    s += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${C.border}" stroke-width="${i % 5 === 0 ? 1.4 : 1}"/>`;
  }
  s += txt(cx, cy - 16, value, { size: 38, fill: color, w: 700, mono: true });
  if (sub) s += txt(cx, cy, sub, { size: 11, fill: C.muted, w: 600 });
  s += txt(cx - r, cy + 14, '0', { size: 9, fill: C.faint, mono: true });
  s += txt(cx + r, cy + 14, '100', { size: 9, fill: C.faint, mono: true });
  return s + '</svg>';
}

// ---- circular progress RING (compact KDI display) --------------------------
export function ring(value, color, label) {
  const r = 44, cx = 58, cy = 58, circ = 2 * Math.PI * r;
  const off = circ * (1 - value / 100);
  return `<svg viewBox="0 0 116 116" width="116" height="116" role="img" aria-label="${esc(label)} ${value}">
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#EEF0F4" stroke-width="9"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
${txt(cx, cy - 1, value, { size: 30, fill: color, w: 700, mono: true })}
${txt(cx, cy + 16, esc(label), { size: 10, fill: C.muted, w: 700 })}</svg>`;
}

// ---- STRAND DONUT (§6): correct vs wrong as a two-slice donut ----------------
// % in the centre, "correct/total" beneath. One per strand card.
export function strandDonut(percent, correct, total, color) {
  const r = 46, cx = 64, cy = 60, circ = 2 * Math.PI * r;
  const arc = (circ * Math.min(100, percent)) / 100;
  return `<svg viewBox="0 0 128 128" width="128" height="128" style="max-width:100%" role="img" aria-label="${percent}%">
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#EEF0F4" stroke-width="14"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${arc.toFixed(1)} ${(circ - arc).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
${txt(cx, cy + 1, `${percent}%`, { size: 26, fill: color, w: 700, mono: true })}
${txt(cx, cy + 19, `${correct}/${total} to&#39;g&#39;ri`, { size: 10, fill: C.muted, w: 700 })}</svg>`;
}

// ---- SCORE / BAND SCALE: all toifa bands + current score + corrected score --
// One banded 0–100 scale (thresholds match scoreBand). Two markers: Joriy
// (today's score) and Tuzatilgan (after careless mistakes removed).
// The cards above are connected to their point on the scale by curved arrows
// (no on-bar chips). `colors` = { joriy, taxmin, tuzatilgan } match the cards.
export function scoreScale(percent, adjusted, ci, colors) {
  const c = colors || { joriy: '#0F1629', taxmin: '#6B7385', tuzatilgan: '#2F9E6B' };
  const W = 760, x0 = 30, x1 = 730, Ah = 92, barH = 34, barY = Ah;
  const X = (v) => x0 + ((x1 - x0) * v) / 100;
  // Official "Yakuniy shkala" — matches packages/compute/src/compute.ts:scoreBand.
  //   0-34 Tamal · 35-49 Shakllanayotgan · 50-66 Rivojlanayotgan · 67-83 Ishonchli · 84-100 Yuqori
  const bands = [
    { a: 0,  b: 35,  label: 'Tamal',           color: '#D2503F' },
    { a: 35, b: 50,  label: 'Shakllanayotgan', color: '#E37A2C' },
    { a: 50, b: 67,  label: 'Rivojlanayotgan', color: '#C98A12' },
    { a: 67, b: 84,  label: 'Ishonchli',       color: '#3266C9' },
    { a: 84, b: 100, label: 'Yuqori',          color: '#2F9E6B' },
  ];
  const numY = barY + barH + 20, labelY = barY + barH + 38, H = labelY + 8;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto" role="img" aria-label="Daraja shkalasi: joriy ${percent}, tuzatilgan ${adjusted}">`;
  // bar
  bands.forEach((bd, i) => {
    const xa = X(bd.a), xb = X(bd.b);
    const rL = i === 0 ? 4 : 0, rR = i === bands.length - 1 ? 4 : 0;
    s += `<path d="M ${(xa + rL).toFixed(1)} ${barY} H ${(xb - rR).toFixed(1)} ${rR ? `a ${rR} ${rR} 0 0 1 ${rR} ${rR}` : ''} V ${barY + barH - rR} ${rR ? `a ${rR} ${rR} 0 0 1 -${rR} ${rR}` : ''} H ${(xa + rL).toFixed(1)} ${rL ? `a ${rL} ${rL} 0 0 1 -${rL} -${rL}` : ''} V ${barY + rL} ${rL ? `a ${rL} ${rL} 0 0 1 ${rL} -${rL}` : ''} Z" fill="${bd.color}"/>`;
  });
  // CI shown as a soft highlighted range on the bar — not a "gate".
  const cl = X(ci.low), ch = X(ci.high);
  s += `<rect x="${cl.toFixed(1)}" y="${barY + 3}" width="${(ch - cl).toFixed(1)}" height="${barH - 6}" rx="5" fill="#fff" fill-opacity="0.5"/>`;
  // Ticks + numbers at the official band boundaries: 0 · 34 · 49 · 66 · 83 · 100
  // (The band starts at 35/50/67/84 — the tick shows the boundary of the
  // preceding band, which is one point below.)
  for (const v of [0, 34, 49, 66, 83, 100]) {
    const x = X(v);
    s += `<line x1="${x.toFixed(1)}" y1="${barY + barH}" x2="${x.toFixed(1)}" y2="${barY + barH + 6}" stroke="#9AA1B2"/>`;
    s += txt(x, numY, v, { size: 13, fill: '#3A4256', w: 700, mono: true });
  }
  for (const bd of bands) s += txt(X((bd.a + bd.b) / 2), labelY, esc(bd.label), { size: 12, fill: bd.color, w: 700 });
  // curved connector arrows from each card down to the bar (no crossings:
  // card order left→right maps to ascending targets 79 < 83 < 88)
  // only Joriy and Tuzatilgan get connector arrows; the interval is shown by
  // the soft range box on the bar (no arrow needed for taxmin oralig'i)
  s += scaleArrow(W / 6, X(percent), barY, c.joriy);
  s += scaleArrow((W * 5) / 6, X(adjusted), barY, c.tuzatilgan);
  return s + '</svg>';
}
function scaleArrow(sx, tx, barY, color, opts = {}) {
  const head = opts.head !== false;
  const sy = 5, ty = head ? barY - 9 : barY + (opts.depth || 12); // head above bar; no-head reaches into it
  const cp1y = sy + (ty - sy) * 0.52, cp2y = ty - (ty - sy) * 0.3;
  let s = `<path d="M ${sx.toFixed(1)} ${sy} C ${sx.toFixed(1)} ${cp1y.toFixed(1)}, ${tx.toFixed(1)} ${cp2y.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  if (head) s += `<polygon points="${tx.toFixed(1)},${(ty + 7).toFixed(1)} ${(tx - 4.5).toFixed(1)},${(ty - 1).toFixed(1)} ${(tx + 4.5).toFixed(1)},${(ty - 1).toFixed(1)}" fill="${color}" stroke="#fff" stroke-width="0.8"/>`;
  return s;
}

// ---- DIFFICULTY PYRAMID (fill = performance, de-saturated) ------------------
export function pyramid(tiers) {
  const layers = [
    { key: 'Oson', poly: '52,116 244,116 288,170 8,170', vy: 148, ly: 143, lx1: 286 },
    { key: "O'rta", poly: '96,62 200,62 244,116 52,116', vy: 94, ly: 89, lx1: 242 },
    { key: 'Qiyin', poly: '118,8 178,8 200,62 96,62', vy: 40, ly: 35, lx1: 198 },
  ];
  let s = '<svg width="440" height="178" viewBox="0 0 440 178" style="max-width:100%" role="img" aria-label="Qiyinchilik piramidasi">';
  for (const L of layers) {
    const t = tiers[L.key];
    const c = pctColor(t.pct);
    s += `<polygon points="${L.poly}" fill="${c}" stroke="#fff" stroke-width="2"/>`;
    s += txt(148, L.vy, `${t.pct}%`, { size: 15, fill: '#fff', w: 700, mono: true });
    s += `<line x1="${L.lx1}" y1="${L.ly}" x2="302" y2="${L.ly}" stroke="${c}" stroke-width="1.5"/><circle cx="306" cy="${L.ly}" r="3" fill="${c}"/>`;
    s += txt(314, L.ly - 1, esc(L.key), { size: 12.5, fill: c, w: 700, anchor: 'start' });
    s += txt(314, L.ly + 12, `${t.correct}/${t.n} to&#39;g&#39;ri`, { size: 9.5, fill: C.muted, anchor: 'start' });
  }
  return s + '</svg>';
}

// ---- BLOOM LADDER (§7): cognitive levels, simple -> complex ------------------
// An ascending staircase. levels come in simple->complex order; we render the
// most complex at the TOP so the eye climbs the ladder. Each rung: name + plain
// gloss on the left, a track+fill bar, and the % at the right. A thin up-arrow
// on the left encodes "fikrlash murakkablashadi".
// Qualitative label helper matching bloom-fill.qualitativeLabel — kept inline
// here so svg.js has no dependency on TS files (Astro build).
function qualLabel(pct) {
  if (pct >= 90) return "A'lo";
  if (pct >= 80) return "Mustahkam";
  if (pct >= 70) return "Yaxshi";
  if (pct >= 55) return "Rivojlanmoqda";
  return "Boshlang'ich";
}

export function bloomLadder(levels) {
  const rowH = 46, y0 = 12, W = 516, x0 = 168, x1 = 430, barH = 17;
  const rungs = [...levels].reverse(); // complex on top
  const H = y0 + rungs.length * rowH + 6;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%" role="img" aria-label="Bloom — fikrlash darajalari">`;
  // left complexity axis
  s += `<line x1="14" y1="${H - 14}" x2="14" y2="14" stroke="${C.border}" stroke-width="2"/>`;
  s += `<polygon points="14,6 9,15 19,15" fill="${C.faint}"/>`;
  rungs.forEach((d, i) => {
    const c = pctColor(d.percent);
    const cy = y0 + i * rowH + rowH / 2;
    s += txt(30, cy + 4, esc(d.key), { size: 13, fill: C.ink, w: 700, anchor: 'start' });
    s += `<rect x="${x0}" y="${cy - barH / 2}" width="${x1 - x0}" height="${barH}" rx="${barH / 2}" fill="#EEF0F4"/>`;
    s += `<rect x="${x0}" y="${cy - barH / 2}" width="${((x1 - x0) * Math.min(100, d.percent) / 100).toFixed(1)}" height="${barH}" rx="${barH / 2}" fill="${c}"/>`;
    // Qualitative badge on the right instead of a raw percentage.
    const label = d.label || qualLabel(d.percent);
    s += txt(x1 + 12, cy + 4, esc(label), { size: 12, fill: c, w: 700, anchor: 'start' });
  });
  return s + '</svg>';
}

// ---- SKILL RADAR (spider web), hand-built + animated ------------------------
// Concentric polygon rings + spokes + a filled data polygon that scales in from
// the centre (CSS animation on .radar-grow; disabled for print / reduced-motion).
export function skillRadarChart(axes) {
  const n = axes.length;
  const cx = 240, cy = 182, R = 112, W = 480, H = 360;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const ring = (r) => axes.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(',')).join(' ');
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:440px;height:auto" role="img" aria-label="Ko&#39;nikmalar radari">`;
  // web rings — delicate hairlines
  for (const rv of [25, 50, 75, 100]) {
    s += `<polygon points="${ring((R * rv) / 100)}" fill="none" stroke="${rv === 100 ? '#DFE3EA' : '#EEF1F5'}" stroke-width="0.75"/>`;
  }
  // spokes
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, R);
    s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#EEF1F5" stroke-width="0.75"/>`;
  }
  // data polygon + vertices (animated) — light fill, thin stroke
  const dataPts = axes.map((a, i) => pt(i, (R * Math.min(100, a.value)) / 100).map((v) => v.toFixed(1)).join(',')).join(' ');
  s += `<g class="radar-grow" style="transform-origin:${cx}px ${cy}px">`;
  s += `<polygon points="${dataPts}" fill="rgba(255,138,50,0.09)" stroke="${C.accent}" stroke-width="1.25" stroke-linejoin="round"/>`;
  axes.forEach((a, i) => {
    const [x, y] = pt(i, (R * Math.min(100, a.value)) / 100);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${C.accent}" stroke="#fff" stroke-width="1"/>`;
  });
  s += `</g>`;
  // labels (name wrapped to 2 lines + value) — light weight
  axes.forEach((a, i) => {
    const [x, y] = pt(i, R + 14);
    const c = Math.cos(ang(i));
    const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
    const words = a.name.split(' ');
    let l1 = a.name, l2 = '';
    if (a.name.length > 12 && words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      l1 = words.slice(0, mid).join(' ');
      l2 = words.slice(mid).join(' ');
    }
    const y0 = y - (l2 ? 6 : 0) - (Math.sin(ang(i)) < -0.6 ? 6 : 0);
    s += txt(x, y0, esc(l1), { size: 11.5, fill: C.text, w: 600, anchor });
    if (l2) s += txt(x, y0 + 13, esc(l2), { size: 11.5, fill: C.text, w: 600, anchor });
    // Qualitative label instead of the raw percentage.
    s += txt(x, y0 + (l2 ? 26 : 13), qualLabel(a.value), { size: 10.5, fill: C.accent, w: 700, anchor });
  });
  return s + '</svg>';
}

// ---- REASONING CONSTELLATION (§10): hub + 4 nodes ---------------------------
// A central "Fikrlash" hub with four orbiting reasoning-type nodes. Node size +
// line thickness encode strength. Lines draw out from the hub and nodes pop in
// (CSS animation; disabled for print / reduced-motion).
export function reasoningConstellation(types) {
  const cx = 260, cy = 162, Dx = 150, Dy = 104, W = 520, H = 326;
  const pos = [[cx, cy - Dy], [cx - Dx, cy], [cx + Dx, cy], [cx, cy + Dy]];
  const clamp = (v) => Math.max(60, Math.min(100, v));
  const rOf = (v) => 23 + ((clamp(v) - 60) / 40) * 12;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:540px;height:auto;margin:0 auto" role="img" aria-label="Fikrlash turlari konstellatsiyasi">`;
  // connecting lines (behind everything) — draw out from the hub
  types.forEach((t, i) => {
    const [x, y] = pos[i];
    const len = Math.hypot(x - cx, y - cy);
    const sw = (1.6 + ((clamp(t.value) - 60) / 40) * 3).toFixed(1);
    s += `<line class="constel-line" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${pctColor(t.value)}" stroke-opacity="0.4" stroke-width="${sw}" stroke-linecap="round" style="stroke-dasharray:${len.toFixed(1)};stroke-dashoffset:${len.toFixed(1)};animation-delay:${(0.1 + i * 0.12).toFixed(2)}s"/>`;
  });
  // central hub pill
  s += `<g class="constel-hub" style="transform-origin:${cx}px ${cy}px">`;
  s += `<rect x="${cx - 47}" y="${cy - 16}" width="94" height="32" rx="16" fill="${C.navy}"/>`;
  s += txt(cx, cy + 5, 'Fikrlash', { size: 13.5, fill: '#fff', w: 700 });
  s += `</g>`;
  // nodes + labels
  types.forEach((t, i) => {
    const [x, y] = pos[i];
    const r = rOf(t.value);
    const c = pctColor(t.value);
    s += `<g class="constel-node" style="transform-origin:${x.toFixed(1)}px ${y.toFixed(1)}px;animation-delay:${(0.3 + i * 0.12).toFixed(2)}s">`;
    s += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${c}"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="none" stroke="#fff" stroke-width="2" stroke-opacity="0.85"/>`;
    s += txt(x, y + 5.5, `${t.value}%`, { size: 16, fill: '#fff', w: 600, mono: true });
    s += `</g>`;
    const nameY = i === 3 ? y + r + 18 : y - r - 9;
    s += txt(x, nameY, esc(t.name), { size: 12.5, fill: C.ink, w: 700 });
  });
  return s + '</svg>';
}

// ---- TOPIC LOLLIPOP (§6): one dot-on-track per topic, sorted ----------------
// A clean dot plot: right-aligned topic name, a faint full-width track, a
// coloured stem + dot at the score, and the % at the end. Reads as a real
// chart, not a grid of cards.
export function topicDots(topics) {
  const rows = [...topics].sort((a, b) => b.percent - a.percent);
  const W = 720, lx = 168, px0 = 182, px1 = 642, rowH = 26, top0 = 22;
  const X = (v) => px0 + ((px1 - px0) * Math.min(100, v)) / 100;
  const H = top0 + rows.length * rowH + 6;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%" role="img" aria-label="Mavzular bo&#39;yicha natija">`;
  // light axis gridlines + scale
  for (const v of [0, 50, 100]) {
    const x = X(v);
    s += `<line x1="${x.toFixed(1)}" y1="${top0 - 6}" x2="${x.toFixed(1)}" y2="${H - 4}" stroke="${C.track}" stroke-width="1"/>`;
    s += txt(x, top0 - 11, v, { size: 9, fill: C.faint, mono: true });
  }
  rows.forEach((t, i) => {
    const c = pctColor(t.percent);
    const cy = top0 + i * rowH + rowH / 2;
    const dx = X(t.percent);
    s += txt(lx, cy + 3.5, esc(t.name), { size: 11.5, fill: C.text, anchor: 'end' });
    s += `<line x1="${px0}" y1="${cy}" x2="${px1}" y2="${cy}" stroke="${C.track}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<line x1="${px0}" y1="${cy}" x2="${dx.toFixed(1)}" y2="${cy}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<circle cx="${dx.toFixed(1)}" cy="${cy}" r="5" fill="${c}" stroke="#fff" stroke-width="1.5"/>`;
    s += txt(px1 + 22, cy + 4, `${t.percent}%`, { size: 11.5, fill: c, w: 700, anchor: 'start', mono: true });
  });
  return s + '</svg>';
}

// ---- SKILL GROWTH SLOPE (§14): how key skills rise across the 12-month plan --
// One multi-line progression replacing the per-stage growth bars. Each skill is
// plotted at Hozir / 3 oy / 6 oy / 12 oy; the rising slope IS the message, the
// endpoints carry the from->to readout. Right-side labels declutter on collision.
export function skillGrowthSlope(series) {
  const W = 620, H = 320, padL = 38, padR = 156, padT = 24, padB = 36;
  const x0 = padL, x1 = W - padR, yTop = padT, yBot = H - padB;
  const labels = ['Hozir', '3 oy', '6 oy', '12 oy'];
  const X = (i) => x0 + ((x1 - x0) * i) / 3;
  const Y = (v) => yBot - (Math.max(0, Math.min(100, v)) / 100) * (yBot - yTop);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:600px;height:auto;margin:0 auto" role="img" aria-label="Ko&#39;nikmalar o&#39;sishi">`;
  // horizontal gridlines + y scale (0..100)
  for (const v of [0, 25, 50, 75, 100]) {
    const y = Y(v);
    s += `<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="${C.track}" stroke-width="1"/>`;
    s += txt(x0 - 8, y + 3.5, v, { size: 9, fill: C.faint, anchor: 'end', mono: true });
  }
  // vertical milestone guides + x labels
  labels.forEach((lb, i) => {
    const x = X(i);
    s += `<line x1="${x.toFixed(1)}" y1="${yTop}" x2="${x.toFixed(1)}" y2="${yBot}" stroke="${C.track}" stroke-width="1"/>`;
    s += txt(x, yBot + 18, lb, { size: 10.5, fill: C.muted, w: 600 });
  });
  // declutter right-side end labels (min vertical gap)
  const ends = series.map((d, i) => ({ i, y: Y(d.points[3]) })).sort((a, b) => a.y - b.y);
  const minGap = 26;
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < minGap) ends[k].y = ends[k - 1].y + minGap;
  const labelY = []; ends.forEach((e) => { labelY[e.i] = Math.min(yBot, Math.max(yTop + 6, e.y)); });
  // series lines + nodes + right labels
  series.forEach((d, si) => {
    const c = d.color;
    const pts = d.points.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    s += `<polyline class="slope-line" points="${pts}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation-delay:${(0.15 + si * 0.18).toFixed(2)}s"/>`;
    d.points.forEach((v, i) => {
      const cx = X(i).toFixed(1), cy = Y(v).toFixed(1);
      s += `<g class="slope-node" style="transform-origin:${cx}px ${cy}px;animation-delay:${(0.5 + si * 0.18 + i * 0.06).toFixed(2)}s">`;
      s += `<circle cx="${cx}" cy="${cy}" r="${i === 0 || i === 3 ? 4.5 : 3.2}" fill="${c}" stroke="#fff" stroke-width="1.5"/></g>`;
    });
    const ly = labelY[si], yEnd = Y(d.points[3]);
    if (Math.abs(ly - yEnd) > 1.5) s += `<line x1="${(x1 + 4).toFixed(1)}" y1="${yEnd.toFixed(1)}" x2="${(x1 + 12).toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${c}" stroke-width="1" stroke-opacity="0.5"/>`;
    s += txt(x1 + 16, ly - 2, esc(d.name), { size: 11.5, fill: c, w: 700, anchor: 'start' });
    s += txt(x1 + 16, ly + 12, `${d.points[0]} → ${d.points[3]}`, { size: 9.5, fill: C.muted, anchor: 'start', mono: true });
  });
  return s + '</svg>';
}

// ---- GROWTH DUMBBELL (§12): every 0-100 measure, now -> after the plan ------
// Each row: a hollow "Hozir" dot, then THREE colour-coded segments (gain by 3 /
// 6 / 12 oy), ending in a navy "reja so'ngida" dot. Axis is zoomed to the data
// (no empty 0..min band). Rows sort weakest-first so biggest gains read first.
export function growthDumbbell(groups) {
  const W = 720, lx = 190, px0 = 240, px1 = 678, rowH = 25, gh = 30, padT = 14, padB = 26;
  const COL3 = '#FFC477', COL6 = C.accent, COL12 = C.navy;
  let minFrom = 100; groups.forEach((g) => g.rows.forEach((r) => { if (r.from < minFrom) minFrom = r.from; }));
  const axisMin = Math.max(0, Math.floor((minFrom - 2) / 10) * 10);
  const X = (v) => px0 + ((px1 - px0) * (Math.max(axisMin, Math.min(100, v)) - axisMin)) / (100 - axisMin);
  const mid = Math.round((axisMin + 100) / 2);
  let rowsTotal = 0; groups.forEach((g) => (rowsTotal += g.rows.length));
  const chartTop = padT + 24;
  const H = chartTop + groups.length * gh + rowsTotal * rowH + padB;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:720px;height:auto" role="img" aria-label="Reja so'ngida o'sish">`;
  // vertical gridlines (zoomed scale) + labels at the bottom
  for (const gv of [axisMin, mid, 100]) {
    const x = X(gv);
    s += `<line x1="${x.toFixed(1)}" y1="${chartTop - 4}" x2="${x.toFixed(1)}" y2="${H - padB + 6}" stroke="${C.track}" stroke-width="1"/>`;
    s += txt(x, H - 8, gv, { size: 9.5, fill: C.faint, mono: true });
  }
  // legend: Hozir + the three milestone colours
  const ly = padT + 4;
  s += `<circle cx="${px0}" cy="${ly}" r="4.5" fill="#fff" stroke="${C.faint}" stroke-width="2"/>`;
  s += txt(px0 + 10, ly + 3.5, 'Hozir', { size: 10.5, fill: C.muted, anchor: 'start' });
  let lxp = px0 + 58;
  [['3 oy', COL3], ['6 oy', COL6], ['12 oy', COL12]].forEach(([lab, col]) => {
    s += `<rect x="${lxp}" y="${ly - 3}" width="18" height="6" rx="3" fill="${col}"/>`;
    s += txt(lxp + 24, ly + 3.5, lab, { size: 10.5, fill: C.muted, anchor: 'start' });
    lxp += 74;
  });
  // rows
  let y = chartTop, ri = 0;
  groups.forEach((g) => {
    s += txt(2, y + 14, esc(g.title).toUpperCase(), { size: 9.5, w: 700, fill: C.muted, anchor: 'start' });
    s += `<line x1="2" y1="${y + 22}" x2="${px1}" y2="${y + 22}" stroke="${C.border}" stroke-width="1" opacity="0.6"/>`;
    y += gh;
    [...g.rows].sort((a, b) => a.from - b.from).forEach((r) => {
      const cy = y + rowH / 2, v = r.from, fin = r.to, gain = fin - v;
      const xv = X(v), x3 = X(v + gain * 0.45), x6 = X(v + gain * 0.75), xf = X(fin);
      const from = Math.round(v), to = Math.round(fin);
      const d = (0.05 + ri * 0.02).toFixed(2); ri++;
      s += txt(lx, cy + 4, esc(r.name), { size: 11, fill: C.text, anchor: 'end' });
      s += `<line x1="${px0}" y1="${cy}" x2="${px1}" y2="${cy}" stroke="${C.track}" stroke-width="2.5" stroke-linecap="round"/>`;
      const seg = (a, b, col) => { const len = Math.max(0, b - a); return `<line class="dbl-seg" x1="${a.toFixed(1)}" y1="${cy}" x2="${b.toFixed(1)}" y2="${cy}" stroke="${col}" stroke-width="4" stroke-linecap="butt" style="stroke-dasharray:${len.toFixed(1)};stroke-dashoffset:${len.toFixed(1)};animation-delay:${d}s"/>`; };
      s += seg(xv, x3, COL3) + seg(x3, x6, COL6) + seg(x6, xf, COL12);
      s += `<circle cx="${xv.toFixed(1)}" cy="${cy}" r="5" fill="#fff" stroke="${C.faint}" stroke-width="2"/>`;
      s += `<circle class="dbl-to" cx="${xf.toFixed(1)}" cy="${cy}" r="5.5" fill="${COL12}" stroke="#fff" stroke-width="1.5" style="transform-origin:${xf.toFixed(1)}px ${cy}px;animation-delay:${d}s"/>`;
      s += txt(xv - 11, cy + 4.5, from, { size: 12.5, fill: C.muted, w: 700, anchor: 'end', mono: true });
      s += txt(xf + 12, cy + 4.5, to, { size: 13.5, fill: COL12, w: 700, anchor: 'start', mono: true });
      y += rowH;
    });
  });
  return s + '</svg>';
}

// ---- SKILL ROAD (§11): the development plan AS a road ----------------------
// A winding road with one stop per stage. Each stop carries only the essentials
// (when · focus · skill from->to · one action). A cyclist (#roadBike) rides the
// road as the page scrolls (positioned by JS via getPointAtLength; hidden in
// print). NOT a handbook — just the journey from "Hozir" to "Maqsad".
function roadSmooth(p) {
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
export function skillRoad(stops, meta = {}) {
  const W = 600, AINK = '#B1521F';
  const y0 = 64, gap = 198, n = stops.length;
  const finishY = y0 + gap * (n + 1), H = finishY + 70;
  const wrap = (str, max) => {
    const words = String(str).split(' '); const lines = []; let cur = '';
    for (const w of words) { if ((`${cur} ${w}`).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (`${cur} ${w}`).trim(); }
    if (cur) lines.push(cur); return lines.slice(0, 2);
  };
  // anchors: start (Hozir), one per stop (weaving L/R), finish (Maqsad)
  const anchors = [{ x: 300, y: y0 }];
  stops.forEach((s, i) => anchors.push({ x: i % 2 === 0 ? 184 : 416, y: y0 + gap * (i + 1) }));
  anchors.push({ x: 300, y: finishY });
  const D = roadSmooth(anchors);

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;max-width:600px;height:auto;margin:0 auto" role="img" aria-label="Rivojlanish yo'li">`;
  // the road: soft asphalt ribbon + dashed centre line
  s += `<path id="roadPath" d="${D}" fill="none" stroke="#E6E8EF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${D}" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" opacity="0.0"/>`;
  s += `<path d="${D}" fill="none" stroke="${C.accent}" stroke-width="2.4" stroke-dasharray="11 15" stroke-linecap="round" opacity="0.85"/>`;

  // START — "Hozir"
  s += `<g><rect x="262" y="20" width="76" height="24" rx="12" fill="${C.navy}"/>`;
  s += txt(300, 36, 'Hozir', { size: 11.5, fill: '#fff', w: 700 });
  s += `<line x1="300" y1="44" x2="300" y2="${y0 - 16}" stroke="${C.border}" stroke-width="2"/></g>`;

  // STOPS
  stops.forEach((st, i) => {
    const a = anchors[i + 1];
    const right = a.x < 300;                 // marker on left half -> card to the right
    const labelLines = wrap(st.label, 22);
    const cardW = 296, cardH = 84 + (labelLines.length - 1) * 15, gapMC = 38;
    const cardX = right ? a.x + gapMC : a.x - gapMC - cardW;
    const cyTop = a.y - cardH / 2;
    const col = st.color || C.accent;
    // connector marker -> card
    const mEdge = right ? a.x + 21 : a.x - 21;
    const cEdge = right ? cardX : cardX + cardW;
    s += `<line x1="${mEdge}" y1="${a.y}" x2="${cEdge}" y2="${a.y}" stroke="${C.border}" stroke-width="2"/>`;
    // card
    s += `<rect x="${cardX}" y="${cyTop.toFixed(1)}" width="${cardW}" height="${cardH}" rx="12" fill="#fff" stroke="${C.border}"/>`;
    s += `<rect x="${cardX}" y="${cyTop.toFixed(1)}" width="4" height="${cardH}" rx="2" fill="${col}"/>`;
    const tx = cardX + 18;
    s += txt(tx, cyTop + 24, esc(`${st.range}`).toUpperCase(), { size: 10.5, fill: AINK, w: 700, anchor: 'start', mono: true });
    labelLines.forEach((ln, k) => { s += txt(tx, cyTop + 44 + k * 15, esc(ln), { size: 14, fill: C.ink, w: 700, anchor: 'start' }); });
    const gy = cyTop + 44 + labelLines.length * 15 + 6;
    s += txt(tx, gy, `${st.gain.from} → ${st.gain.to}`, { size: 13, fill: col, w: 700, anchor: 'start', mono: true });
    s += txt(tx + 64, gy, 'ball', { size: 10, fill: C.faint, anchor: 'start' });
    s += txt(tx, gy + 16, esc(st.note), { size: 10.5, fill: C.muted, anchor: 'start' });
    // marker on the road
    s += `<circle cx="${a.x}" cy="${a.y}" r="21" fill="#fff" stroke="${C.navy}" stroke-width="2.6"/>`;
    s += `<circle cx="${a.x}" cy="${a.y}" r="21" fill="none" stroke="${col}" stroke-width="2.6" stroke-dasharray="3 132" stroke-dashoffset="-1"/>`;
    s += txt(a.x, a.y + 5.5, st.n, { size: 16, fill: C.navy, w: 700, mono: true });
    // transparent hit target → opens this stage's detail panel (wired in index.astro)
    s += `<circle class="road-stop-hit" data-stage="${i}" cx="${a.x}" cy="${a.y}" r="30" fill="transparent" style="cursor:pointer;pointer-events:all"><title>${esc(st.range)} — batafsil</title></circle>`;
  });

  // FINISH — "Maqsad"
  const f = anchors[anchors.length - 1];
  s += `<circle cx="${f.x}" cy="${f.y}" r="15" fill="${C.navy}"/>`;
  s += `<path d="M${f.x - 6} ${f.y} l4 4 l7 -8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += txt(f.x, f.y + 36, esc(meta.finish || 'Maqsad'), { size: 13, fill: C.ink, w: 700 });
  if (meta.finishSub) s += txt(f.x, f.y + 52, esc(meta.finishSub), { size: 10.5, fill: C.muted });

  // CYCLIST — parked at start; JS rides it down the road on scroll.
  // Uses the school's bike emoji PNG (public/bicycle.png) directly on the road
  // (no white halo/card behind it) so the rider reads as part of the scene.
  s += `<g id="roadBike" class="road-bike" transform="translate(${anchors[0].x} ${anchors[0].y})">`;
  s += `<image href="/bicycle.png" x="-30" y="-30" width="60" height="60" preserveAspectRatio="xMidYMid meet"/>`;
  s += `</g>`;
  return s + '</svg>';
}

// ---- POSITION SCALE (§8): below / at / above grade level --------------------
// A 3-zone track with a single marker showing where the child sits overall.
// marker is 0..100 across the whole track. zones = [past, sinf, yuqori] labels.
export function positionScale(marker, zones) {
  const W = 720, x0 = 20, x1 = 700, barY = 46, barH = 26;
  const segW = (x1 - x0) / 3;
  const cols = ['#E0A33E', '#3E8E6E', '#3266C9']; // past (amber), sinf (green), yuqori (blue)
  const X = (v) => x0 + ((x1 - x0) * Math.min(100, Math.max(0, v))) / 100;
  let s = `<svg width="${W}" height="104" viewBox="0 0 ${W} 104" style="max-width:100%" role="img" aria-label="Sinf darajasiga nisbatan o'rin">`;
  zones.forEach((z, i) => {
    const sx = x0 + i * segW;
    const r0 = i === 0 ? 'rx="13"' : '';
    s += `<rect x="${sx + (i ? 1 : 0)}" y="${barY}" width="${segW - (i < 2 ? 1 : 0)}" height="${barH}" fill="${cols[i]}" fill-opacity="0.9" ${i === 0 ? 'rx="13"' : i === 2 ? 'rx="13"' : ''}/>`;
    s += txt(sx + segW / 2, barY + barH + 18, esc(z), { size: 11, fill: C.text, w: 700 });
  });
  // marker
  const mx = X(marker);
  s += `<polygon points="${mx.toFixed(1)},${barY - 4} ${(mx - 7).toFixed(1)},${(barY - 16).toFixed(1)} ${(mx + 7).toFixed(1)},${(barY - 16).toFixed(1)}" fill="${C.navy}"/>`;
  s += `<line x1="${mx.toFixed(1)}" y1="${barY - 4}" x2="${mx.toFixed(1)}" y2="${barY + barH + 4}" stroke="${C.navy}" stroke-width="2"/>`;
  s += txt(mx, barY - 22, 'Farzandingiz', { size: 11, fill: C.navy, w: 700 });
  return s + '</svg>';
}

// ---- TIER UNIT CHART (§5): one cell per question ----------------------------
// A single chart that replaces table + pyramid + donut + bars. Each question is
// one rounded cell; solid = to'g'ri, faint = xato. The number of cells shows
// how many questions of that difficulty there were (test composition), the
// solid run shows how many were correct, and the % closes each row.
export function tierUnits(tiers) {
  const order = ['Oson', "O'rta", 'Qiyin'];
  const rowH = 64, y0 = 6, cx0 = 116;
  // cells must end before the right-side readout — size the slot to the busiest
  // tier so 25 (English) cells fit the same width that 12 (math) cells used.
  const maxN = Math.max(1, ...order.map((k) => (tiers[k] ? tiers[k].n : 0)));
  const cellArea = 608 - cx0;
  const slot = Math.min(44, cellArea / maxN);
  const cellW = Math.max(8, slot * 0.82);
  const cellH = Math.min(30, Math.max(15, slot - 2));
  const rx = Math.min(6, cellW / 3);
  const H = y0 + order.length * rowH;
  let s = `<svg width="720" height="${H}" viewBox="0 0 720 ${H}" style="max-width:100%" role="img" aria-label="Qiyinchilik bo&#39;yicha natija">`;
  order.forEach((k, i) => {
    const t = tiers[k];
    const c = pctColor(t.pct);
    const top = y0 + i * rowH;
    const cy = top + rowH / 2;
    const cellY = cy - cellH / 2;
    if (i > 0) s += `<line x1="0" y1="${top}" x2="720" y2="${top}" stroke="${C.border}"/>`;
    // row label
    s += txt(0, cy - 2, esc(k), { size: 14, fill: C.ink, w: 700, anchor: 'start' });

    // Empty tier: single friendly message spanning the cell area instead of
    // "0 savol · 0% · 0/0 to'g'ri".
    if (t.n === 0) {
      s += txt(0, cy + 14, 'bu qiyinlikda savol yo‘q', { size: 10, fill: C.muted, anchor: 'start' });
      s += txt((cx0 + 608) / 2, cy + 4, 'Bunday savollar yo‘q', {
        size: 12, fill: C.faint, anchor: 'middle',
      });
      return;
    }

    s += txt(0, cy + 14, `${t.n} savol`, { size: 10, fill: C.muted, anchor: 'start' });
    // one cell per question — solid = correct, faint = wrong
    for (let q = 0; q < t.n; q++) {
      const x = cx0 + q * slot;
      const correct = q < t.correct;
      s += `<rect x="${x.toFixed(1)}" y="${cellY.toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH}" rx="${rx.toFixed(1)}" fill="${correct ? c : C.track}"${correct ? '' : ` stroke="${C.border}"`}/>`;
    }
    // closing readout
    s += txt(672, cy - 1, `${t.pct}%`, { size: 22, fill: c, w: 700, anchor: 'middle', mono: true });
    s += txt(672, cy + 15, `${t.correct}/${t.n} to&#39;g&#39;ri`, { size: 10, fill: C.muted, anchor: 'middle' });
  });
  return s + '</svg>';
}

// ---- ERROR COMPOSITION: stacked bar -----------------------------------------
export function errorBar(rawScore, technicalLost, gapLost, totalMarks) {
  const x0 = 4, innerW = 552, h = 26, y = 6;
  const sc = innerW / totalMarks;
  const seg = (x, val, fill) =>
    val <= 0 ? '' :
    `<rect x="${x.toFixed(1)}" y="${y}" width="${(val * sc).toFixed(1)}" height="${h}" rx="2" fill="${fill}"/>` +
    txt(x + (val * sc) / 2, y + 18, val, { size: 12, fill: '#fff', w: 700, mono: true });
  const xB = x0 + rawScore * sc, xR = xB + technicalLost * sc;
  return `<svg width="560" height="40" viewBox="0 0 560 40" style="max-width:100%" role="img" aria-label="Ball tarkibi">
${seg(x0, rawScore, C.pos)}${seg(xB, technicalLost, C.info)}${seg(xR, gapLost, C.neg)}
<line x1="${xR.toFixed(1)}" y1="2" x2="${xR.toFixed(1)}" y2="${y + h + 4}" stroke="${C.ink}" stroke-width="1.5" stroke-dasharray="2 2"/></svg>`;
}

export function errorLegend(rawScore, technicalLost, gapLost, adjusted) {
  const item = (color, label, v) =>
    `<span class="dot" style="background:${color}"></span> ${label} <b class="num">${v}</b>`;
  return `<div class="helper" style="display:flex;flex-wrap:wrap;gap:var(--s2) var(--s4);justify-content:center;margin-top:var(--s3)">
  <span>${item(C.pos, 'Erishilgan', rawScore)}</span>
  <span>${item(C.info, 'Texnik xato', technicalLost)}</span>
  <span>${item(C.neg, "Bo'shliq", gapLost)}</span>
  <span class="muted">tuzatilgan ~<b class="num">${adjusted}</b></span></div>`;
}

// ---- BENCHMARK HORIZONTAL BARS (§15) ---------------------------------------
export function hbars(rows) {
  const w = 520, lx = 132, bw = 348, rh = 28;
  let s = `<svg width="${w}" height="${rows.length * rh + 4}" viewBox="0 0 ${w} ${rows.length * rh + 4}" style="max-width:100%" role="img" aria-label="Benchmark">`;
  rows.forEach((r, i) => {
    const y = 6 + i * rh;
    s += txt(0, y + 12, esc(r.label), { size: 11, fill: C.text, anchor: 'start' });
    s += `<rect x="${lx}" y="${y}" width="${bw}" height="14" rx="7" fill="${C.track}"/>`;
    s += `<rect x="${lx}" y="${y}" width="${((bw * Math.min(100, r.val)) / 100).toFixed(1)}" height="14" rx="7" fill="${r.color}"/>`;
    s += txt(lx + bw + 8, y + 12, r.val, { size: 11, fill: r.color, w: 700, anchor: 'start', mono: true });
  });
  return s + '</svg>';
}

// ---- TINY CI SPARKLINE (KPI) -----------------------------------------------
export function ciSpark(percent, ci, color) {
  const x0 = 2, W = 200;
  const X = (v) => x0 + (W * v) / 100;
  return `<svg width="208" height="26" viewBox="0 0 208 26" style="max-width:100%">
<rect x="${x0}" y="11" width="${W}" height="5" rx="2.5" fill="${C.track}"/>
<rect x="${X(ci.low).toFixed(1)}" y="11" width="${(X(ci.high) - X(ci.low)).toFixed(1)}" height="5" rx="2.5" fill="${color}" opacity="0.4"/>
<line x1="${X(percent).toFixed(1)}" y1="8" x2="${X(percent).toFixed(1)}" y2="19" stroke="${color}" stroke-width="2.5"/>
${txt(x0, 24, ci.low, { size: 8.5, fill: C.faint, anchor: 'start', mono: true })}
${txt(x0 + W, 24, ci.high, { size: 8.5, fill: C.faint, anchor: 'end', mono: true })}</svg>`;
}
