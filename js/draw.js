import { maxHp } from './balance.js';
import { ARENA, BAYS, BAY_W, COLUMNS, DUMMIES, FIELD_H, FIELD_W, PLACES, WALL, bayX } from './places.js';

export const FIGURE = { ludus: 1.3, arena: 1.6 };
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
const SKIN = ['#f0c79e', '#e2b48a', '#c98f62', '#a86e46', '#7d4f32'];
const METAL = ['#8a6a4a', '#9b6b3c', '#c58a3e', '#a9b0b6', '#cfd6dc', '#d9dfe6', '#f2c94c'];
const BLADE = ['#a0743f', '#c98a45', '#9ba4ac', '#dfe6ec', '#bfe3ff', '#b7ffd8', '#ffd34d'];
const SAND = '#d8b98b';

function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

// таблички рисуются чётко поверх пиксельного мира: при закраске фона их только запоминаем
let signs = null;

function plaque(ctx, x, y, text, size = 15, tone = '#6b4426') {
  if (signs) {
    signs.push([x, y, text, size, tone]);
    return;
  }
  ctx.font = '800 ' + size + 'px ' + FONT;
  const w = ctx.measureText(text).width + 22, h = size + 12;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  roundRect(ctx, x - w / 2 + 2, y - h / 2 + 3, w, h, 6);
  ctx.fill();
  const grad = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  grad.addColorStop(0, shade(tone, 0.18));
  grad.addColorStop(1, shade(tone, -0.18));
  ctx.fillStyle = grad;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = shade(tone, -0.45);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff3dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

function column(ctx, x, y, h, tone = '#efe6d6') {
  ctx.fillStyle = shade(tone, -0.12);
  ctx.fillRect(x - 6, y, 12, 4);
  ctx.fillRect(x - 6, y + h - 4, 12, 4);
  const grad = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
  grad.addColorStop(0, shade(tone, -0.1));
  grad.addColorStop(0.5, tone);
  grad.addColorStop(1, shade(tone, -0.25));
  ctx.fillStyle = grad;
  ctx.fillRect(x - 4, y + 4, 8, h - 8);
}

// --- лудус: вид сбоку, как в Domina ---

const L = {
  roof: '#2b1a12', wall: '#6a4630', wallDark: '#4e321f', trim: '#82573a', door: '#2f1d13',
  colTop: '#c98b6b', colLow: '#e2c3a6', floor: '#8a5a3c', floorLine: '#744a30', step: '#5e3a24',
  sand: '#e6cba0', sandDark: '#d4b282', rail: '#7a4a2a', railDark: '#55321b', front: '#3d2416',
};

function bench(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x + 2, y + 2, w, 8);
  ctx.fillStyle = '#7b4c2c';
  ctx.fillRect(x, y - 4, w, 5);
  ctx.fillStyle = '#5a361f';
  ctx.fillRect(x, y + 1, w, 2);
  ctx.fillRect(x + 4, y + 1, 3, 7);
  ctx.fillRect(x + w - 7, y + 1, 3, 7);
}

function cot(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x - 16, y + 2, 36, 6);
  ctx.fillStyle = '#6b4329';
  ctx.fillRect(x - 18, y - 3, 36, 6);
  ctx.fillStyle = '#e9dfcc';
  ctx.fillRect(x - 17, y - 6, 34, 4);
  ctx.fillStyle = '#d2c3a8';
  ctx.fillRect(x - 17, y - 7, 8, 5);
  ctx.fillStyle = '#4a2c18';
  ctx.fillRect(x - 17, y + 3, 3, 5);
  ctx.fillRect(x + 13, y + 3, 3, 5);
}

function amphora(ctx, x, y, tone = '#a8582f') {
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 2, y - 22, 4, 6);
  ctx.fillStyle = shade(tone, -0.3);
  ctx.fillRect(x - 5, y - 21, 10, 2);
  ctx.fillRect(x - 1, y - 2, 2, 3);
}

function pillar(ctx, x, top, bottom) {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(x - 10, top + 4, 26, bottom - top);
  ctx.fillStyle = shade(L.colTop, -0.2);
  ctx.fillRect(x - 15, top, 30, 8);
  ctx.fillRect(x - 15, bottom - 8, 30, 8);
  const mid = top + (bottom - top) * 0.55;
  const g1 = ctx.createLinearGradient(x - 12, 0, x + 12, 0);
  g1.addColorStop(0, shade(L.colTop, -0.18));
  g1.addColorStop(0.45, L.colTop);
  g1.addColorStop(1, shade(L.colTop, -0.32));
  ctx.fillStyle = g1;
  ctx.fillRect(x - 12, top + 8, 24, mid - top - 8);
  const g2 = ctx.createLinearGradient(x - 12, 0, x + 12, 0);
  g2.addColorStop(0, shade(L.colLow, -0.15));
  g2.addColorStop(0.45, L.colLow);
  g2.addColorStop(1, shade(L.colLow, -0.3));
  ctx.fillStyle = g2;
  ctx.fillRect(x - 12, mid, 24, bottom - 8 - mid);
}

function door(ctx, x, y, w, h) {
  ctx.fillStyle = L.door;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(L.door, 0.15);
  for (let i = 1; i < 4; i++) ctx.fillRect(x + i * w / 4, y + 2, 1, h - 2);
  ctx.fillStyle = L.trim;
  ctx.fillRect(x - 3, y - 4, w + 6, 4);
}

function bayRest(ctx, i) {
  const x = bayX(i);
  door(ctx, x + 50, 92, 60, 136);
  amphora(ctx, x + 20, 226);
  amphora(ctx, x + 138, 226, '#8f4a26');
  bench(ctx, x + 8, 262, BAY_W - 16);
  bench(ctx, x + 18, 286, BAY_W - 30);
}

function bayTemple(ctx) {
  const x = bayX(2), cx = x + BAY_W / 2;
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(x + 20, 80, BAY_W - 40, 148);
  ctx.fillStyle = 'rgba(255,200,90,.12)';
  ctx.fillRect(x + 20, 80, BAY_W - 40, 148);
  // статуя Фортуны
  ctx.fillStyle = '#b9ab95';
  ctx.fillRect(cx - 18, 196, 36, 32);
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(cx - 8, 140, 16, 56);
  ctx.beginPath();
  ctx.arc(cx, 132, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx + 6, 146, 14, 4);
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 24, 150, 10, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + 24 - Math.cos(a) * 10, 150 - Math.sin(a) * 10);
    ctx.lineTo(cx + 24 + Math.cos(a) * 10, 150 + Math.sin(a) * 10);
    ctx.stroke();
  }
  for (const dx of [-44, 44]) {
    ctx.fillStyle = '#c9b99b';
    ctx.fillRect(cx + dx - 4, 206, 8, 22);
  }
}

function bayForge(ctx) {
  const x = bayX(3);
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(x + 22, 132, 70, 96);
  ctx.fillStyle = '#4b3022';
  ctx.fillRect(x + 16, 124, 82, 10);
  // стойка с оружием на стене
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = '#b9c1c8';
    ctx.fillRect(x + 108 + k * 10, 100, 3, 40);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x + 107 + k * 10, 138, 5, 8);
  }
  ctx.fillStyle = '#6d5a3a';
  ctx.beginPath();
  ctx.arc(x + 124, 176, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9b7b4a';
  ctx.beginPath();
  ctx.arc(x + 124, 176, 5, 0, Math.PI * 2);
  ctx.fill();
  // наковальня
  const ax = x + 72, ay = 278;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(ax - 20, ay, 40, 5);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(ax - 8, ay - 14, 16, 14);
  ctx.fillStyle = '#3b3f44';
  ctx.fillRect(ax - 18, ay - 22, 34, 8);
  ctx.fillRect(ax + 16, ay - 20, 8, 4);
  ctx.fillStyle = '#6a7077';
  ctx.fillRect(ax - 18, ay - 22, 34, 2);
}

function bayHeal(ctx) {
  const x = bayX(4);
  door(ctx, x + 58, 104, 46, 124);
  // полки с травами и склянками
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(x + 10, 120, 40, 4);
  ctx.fillRect(x + 10, 150, 40, 4);
  ctx.fillRect(x + 112, 120, 40, 4);
  const jars = ['#7fb069', '#c9a227', '#a3c4d9', '#c9584a'];
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = jars[k];
    ctx.fillRect(x + 13 + k * 9, 110, 6, 10);
    ctx.fillRect(x + 115 + k * 9, 110, 6, 10);
    ctx.fillStyle = jars[3 - k];
    ctx.fillRect(x + 13 + k * 9, 140, 6, 10);
  }
  // чаша со змеёй
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(x + 72, 80, 18, 6);
  ctx.fillRect(x + 79, 86, 4, 10);
  for (const s of PLACES.heal.seats) cot(ctx, s.x, s.y);
}

function sandYard(ctx, random) {
  const g = ctx.createLinearGradient(0, WALL.sand, 0, WALL.rail);
  g.addColorStop(0, L.sandDark);
  g.addColorStop(0.3, L.sand);
  g.addColorStop(1, shade(L.sand, -0.06));
  ctx.fillStyle = g;
  ctx.fillRect(0, WALL.sand, FIELD_W, WALL.rail - WALL.sand);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(120,80,40,.12)' : 'rgba(255,245,220,.18)';
    ctx.fillRect(random() * FIELD_W, WALL.sand + random() * (WALL.rail - WALL.sand), 2, 2);
  }
  ctx.fillStyle = 'rgba(80,40,20,.18)';
  ctx.fillRect(0, WALL.sand, FIELD_W, 10);
}

function railing(ctx) {
  ctx.fillStyle = 'rgba(40,20,10,.25)';
  ctx.fillRect(0, WALL.rail - 4, FIELD_W, 8);
  ctx.fillStyle = L.front;
  ctx.fillRect(0, WALL.front, FIELD_W, FIELD_H - WALL.front);
  ctx.fillStyle = shade(L.front, 0.08);
  for (let y = WALL.front + 12; y < FIELD_H; y += 14) ctx.fillRect(0, y, FIELD_W, 1);
  ctx.fillStyle = L.railDark;
  ctx.fillRect(0, WALL.front - 4, FIELD_W, 4);
  for (let x = 14; x < FIELD_W; x += 22) {
    ctx.fillStyle = L.rail;
    ctx.fillRect(x, WALL.rail + 8, 5, WALL.front - WALL.rail - 8);
  }
  for (let x = 10; x < FIELD_W; x += 132) {
    ctx.fillStyle = L.railDark;
    ctx.fillRect(x, WALL.rail - 6, 12, WALL.front - WALL.rail + 2);
    ctx.fillStyle = shade(L.rail, 0.15);
    ctx.fillRect(x - 2, WALL.rail - 10, 16, 5);
  }
  ctx.fillStyle = L.rail;
  ctx.fillRect(0, WALL.rail, FIELD_W, 8);
  ctx.fillStyle = shade(L.rail, 0.2);
  ctx.fillRect(0, WALL.rail, FIELD_W, 2);
  ctx.fillStyle = L.rail;
  ctx.fillRect(0, WALL.rail + 20, FIELD_W, 5);
}

export function paintLudus(ctx) {
  signs = [];
  const random = seeded(7);
  // крыша и стена
  ctx.fillStyle = L.roof;
  ctx.fillRect(0, 0, FIELD_W, WALL.top);
  ctx.fillStyle = shade(L.roof, 0.12);
  for (let x = 0; x < FIELD_W; x += 46) ctx.fillRect(x, 6, 30, 6);
  const wall = ctx.createLinearGradient(0, WALL.top, 0, WALL.floor);
  wall.addColorStop(0, L.wallDark);
  wall.addColorStop(1, L.wall);
  ctx.fillStyle = wall;
  ctx.fillRect(0, WALL.top, FIELD_W, WALL.floor - WALL.top);
  ctx.fillStyle = L.trim;
  ctx.fillRect(0, WALL.top, FIELD_W, 10);
  ctx.fillStyle = shade(L.trim, -0.3);
  ctx.fillRect(0, WALL.top + 10, FIELD_W, 3);
  // плющ с крыши
  for (const x of [120, 470, 830]) {
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 2 ? '#4d6b2e' : '#3b5523';
      ctx.fillRect(x + (random() - 0.5) * 30, WALL.top + k * 5, 6, 6);
    }
  }
  // пол галереи
  ctx.fillStyle = L.floor;
  ctx.fillRect(0, WALL.floor, FIELD_W, WALL.step - WALL.floor);
  ctx.fillStyle = L.floorLine;
  for (let y = WALL.floor + 16; y < WALL.step; y += 16) ctx.fillRect(0, y, FIELD_W, 1);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(0, WALL.floor, FIELD_W, 5);
  ctx.fillStyle = L.step;
  ctx.fillRect(0, WALL.step, FIELD_W, WALL.sand - WALL.step);
  ctx.fillStyle = shade(L.floor, 0.18);
  ctx.fillRect(0, WALL.step, FIELD_W, 2);
  for (const i of BAYS.rest) bayRest(ctx, i);
  bayTemple(ctx);
  bayForge(ctx);
  bayHeal(ctx);
  for (const x of COLUMNS) pillar(ctx, x, WALL.top + 14, WALL.step);
  sandYard(ctx, random);
  railing(ctx);
  plaque(ctx, (bayX(0) + bayX(1) + BAY_W) / 2, 72, 'Зона отдыха', 14, '#5d4426');
  plaque(ctx, bayX(2) + BAY_W / 2, 72, 'Храм Фортуны', 14, '#7a5a2a');
  plaque(ctx, bayX(3) + BAY_W / 2, 72, 'Кузница', 14, '#4e4640');
  plaque(ctx, bayX(4) + BAY_W / 2, 72, 'Лазарет', 14, '#6b2f28');
  const painted = signs;
  signs = null;
  return painted;
}

export function drawSigns(ctx, list) {
  for (const [x, y, text, size, tone] of list) plaque(ctx, x, y, text, size, tone);
}

function drawDummy(ctx, x, y, hit) {
  ctx.fillStyle = 'rgba(60,30,10,.25)';
  ctx.fillRect(x - 12, y - 2, 24, 5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(hit * 30) * hit * 0.3);
  ctx.fillStyle = '#4a2f1c';
  ctx.fillRect(-2, -36, 4, 36);
  ctx.fillRect(-10, -8, 4, 8);
  ctx.fillRect(6, -8, 4, 8);
  ctx.fillStyle = '#5c4a30';
  ctx.beginPath();
  ctx.arc(0, -30, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7d6a45';
  ctx.beginPath();
  ctx.arc(0, -30, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d3020';
  ctx.beginPath();
  ctx.arc(0, -30, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2a26';
  ctx.fillRect(-4, -48, 8, 6);
  ctx.restore();
}

export function drawLudusLife(ctx, t, dummyHits) {
  DUMMIES.forEach((d, i) => drawDummy(ctx, d.x, d.y, dummyHits[i] || 0));
  // огонь в горне кузницы
  const x = bayX(3) + 57, y = 190;
  const flicker = 0.6 + 0.25 * Math.sin(t * 9) + 0.15 * Math.sin(t * 23);
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 46);
  glow.addColorStop(0, 'rgba(255,190,80,' + (0.95 * flicker).toFixed(3) + ')');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 46, y - 46, 92, 92);
  ctx.fillStyle = '#ffcf6b';
  ctx.fillRect(x - 12, y + 18 - flicker * 6, 24, 6 + flicker * 6);
  // факелы на колоннах
  for (const cx of COLUMNS.slice(1, -1)) {
    const f = 0.7 + 0.3 * Math.sin(t * 11 + cx);
    ctx.fillStyle = '#4a2f1c';
    ctx.fillRect(cx - 2, 120, 4, 14);
    const tg = ctx.createRadialGradient(cx, 116, 1, cx, 116, 26);
    tg.addColorStop(0, 'rgba(255,200,90,' + (0.6 * f).toFixed(3) + ')');
    tg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(cx - 26, 90, 52, 52);
    ctx.fillStyle = '#ffd47a';
    ctx.fillRect(cx - 3, 112 - f * 4, 6, 6 + f * 4);
  }
}

export function drawSoon(ctx, t) {
  // табличка «скоро» у храма
  const tx = bayX(2) + BAY_W / 2, ty = 106;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-0.06);
  const pulse = 1 + 0.04 * Math.sin(t * 3);
  ctx.scale(pulse, pulse);
  ctx.font = '900 13px ' + FONT;
  ctx.fillStyle = '#e8b93c';
  roundRect(ctx, -46, -12, 92, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#3a2804';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('гача скоро', 0, 1);
  ctx.restore();
}

function crowd(ctx, random, cx, cy, rx, ry, rows, gap) {
  const people = [];
  for (let r = 0; r < rows; r++) {
    const ex = rx + r * gap, ey = ry + r * gap * 0.75;
    const n = Math.floor((ex + ey) * Math.PI / 9);
    for (let i = 0; i < n; i++) {
      const a = (i + random() * 0.6) / n * Math.PI * 2;
      const x = cx + Math.cos(a) * ex, y = cy + Math.sin(a) * ey;
      if (x < -6 || x > FIELD_W + 6 || y < -6 || y > FIELD_H + 6) continue;
      if (random() < 0.3) continue;
      people.push({ x, y, skin: SKIN[Math.floor(random() * SKIN.length)],
        cloth: ['#9a5a50', '#c9bfae', '#5c6f93', '#b39255', '#76648f', '#5f7d62', '#d3cabb'][Math.floor(random() * 7)],
        phase: random() * Math.PI * 2 });
    }
  }
  return people;
}

export function paintArena(ctx) {
  const random = seeded(11);
  const a = ARENA;
  ctx.fillStyle = '#5c4d40';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  // трибуны
  for (let r = 14; r >= 0; r--) {
    ctx.fillStyle = r % 2 ? '#5e5045' : '#685a4d';
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, a.rx + 22 + r * 18, a.ry + 22 + r * 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const people = crowd(ctx, random, a.cx, a.cy, a.rx + 34, a.ry + 32, 12, 17)
    .filter((p) => Math.abs(p.x - a.cx) > 92 || p.y > a.cy - a.ry - 12);
  // императорская ложа
  const boxTop = 8, boxBottom = a.cy - a.ry - 16;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(a.cx - 86, boxTop + 6, 176, boxBottom - boxTop);
  ctx.fillStyle = '#3a1c33';
  ctx.fillRect(a.cx - 84, boxTop, 168, boxBottom - boxTop);
  for (let i = 0; i < 4; i++) column(ctx, a.cx - 66 + i * 44, boxTop + 26, boxBottom - boxTop - 44, '#efe6d6');
  ctx.fillStyle = '#7a2a66';
  ctx.fillRect(a.cx - 90, boxTop, 180, 22);
  ctx.fillStyle = '#d9a441';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(a.cx - 80 + i * 20, boxTop + 22, 10, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#7a2a66';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(a.cx - 80 + i * 20, boxTop + 21, 8, 0, Math.PI);
    ctx.fill();
  }
  const rail = ctx.createLinearGradient(0, boxBottom - 20, 0, boxBottom);
  rail.addColorStop(0, '#e9dcc4');
  rail.addColorStop(1, '#b9a98b');
  ctx.fillStyle = rail;
  ctx.fillRect(a.cx - 90, boxBottom - 20, 180, 20);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(a.cx - 90, boxBottom - 20, 180, 3);
  ctx.fillStyle = '#7a2a66';
  ctx.fillRect(a.cx - 14, boxBottom - 17, 28, 14);
  // стена арены
  ctx.fillStyle = '#c9b79c';
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx + 22, a.ry + 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9b3a2e';
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx + 12, a.ry + 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // песок
  const grad = ctx.createRadialGradient(a.cx, a.cy - 40, 40, a.cx, a.cy, a.rx);
  grad.addColorStop(0, '#ecd3a6');
  grad.addColorStop(1, '#cfae7c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy, a.rx, a.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(120,80,40,.10)' : 'rgba(255,245,220,.16)';
    ctx.fillRect(a.cx - a.rx + random() * a.rx * 2, a.cy - a.ry + random() * a.ry * 2, 2, 2);
  }
  ctx.strokeStyle = 'rgba(150,110,60,.18)';
  ctx.lineWidth = 2;
  for (let r = 40; r < a.rx; r += 34) {
    ctx.beginPath();
    ctx.ellipse(a.cx, a.cy, r, r * a.ry / a.rx, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // знамёна по стене
  for (let i = 0; i < 12; i++) {
    const ang = i / 12 * Math.PI * 2 + Math.PI / 12;
    const x = a.cx + Math.cos(ang) * (a.rx + 17), y = a.cy + Math.sin(ang) * (a.ry + 17);
    ctx.fillStyle = i % 2 ? '#d9a441' : '#7a2f24';
    ctx.fillRect(x - 5, y - 14, 10, 16);
    ctx.fillStyle = '#5b4a3a';
    ctx.fillRect(x - 1, y - 18, 2, 6);
  }
  return people;
}

export function drawCrowd(ctx, people, t, roar) {
  for (const p of people) {
    const jump = Math.max(0, Math.sin(t * (4 + roar * 6) + p.phase)) * (1 + roar * 3);
    ctx.fillStyle = p.cloth;
    ctx.fillRect(p.x - 3, p.y - 2 - jump, 6, 5);
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4.5 - jump, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- гладиатор ---

export function drawGladiator(ctx, g, t, scene) {
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  const lying = fate === 'down' || fate === 'dead' || pose === 'lie';
  const kneel = fate === 'yield';
  const sit = pose === 'sit';
  const seed = hashOf(g.login);
  const skin = SKIN[seed % SKIN.length];
  const metal = METAL[Math.min(METAL.length - 1, g.armor)];
  const size = FIGURE[scene];
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(size, size);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, lying ? 17 : 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (fate === 'dead') {
    ctx.fillStyle = 'rgba(140,20,20,.55)';
    ctx.beginPath();
    ctx.ellipse(4, 1, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lying) {
    ctx.translate(0, -3);
    ctx.rotate(g.face > 0 ? -Math.PI / 2 : Math.PI / 2);
    ctx.translate(0, 8);
  }
  ctx.scale(g.face < 0 ? -1 : 1, 1);
  if (fate === 'dead') ctx.globalAlpha = 0.75;
  const walk = g.walking && !lying && !kneel ? Math.sin(t * 12 + seed) : 0;
  const bob = Math.abs(walk) * 1.2 + (sit ? Math.max(0, Math.sin(t * 1.5 + seed)) * 0.6 : 0);
  const low = kneel ? 6 : sit ? 5 : 0;
  ctx.translate(0, -bob + low);
  // щит за спиной
  ctx.fillStyle = shade(metal, -0.3);
  ctx.beginPath();
  ctx.ellipse(-7, -16, 6, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g.color;
  ctx.beginPath();
  ctx.ellipse(-7, -16, 4.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(-7, -16, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // ноги
  ctx.fillStyle = skin;
  if (kneel) {
    ctx.fillRect(-4, -10, 4, 5);
    ctx.fillRect(1, -6, 7, 4);
  } else if (sit) {
    ctx.fillRect(-3, -11, 10, 3.5);
    ctx.fillRect(-3, -8, 10, 3);
    ctx.fillRect(5, -9, 3.5, 7);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(5, -3, 5, 2.5);
  } else {
    ctx.fillRect(-4 + walk * 2, -10, 3.5, 10);
    ctx.fillRect(1 - walk * 2, -10, 3.5, 10);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(-4.5 + walk * 2, -2.5, 4.5, 2.5);
    ctx.fillRect(0.5 - walk * 2, -2.5, 4.5, 2.5);
  }
  // туника
  ctx.fillStyle = g.color;
  roundRect(ctx, -6, -23, 12, 15, 3);
  ctx.fill();
  ctx.fillStyle = shade(g.color, -0.3);
  ctx.beginPath();
  ctx.moveTo(-6, -11);
  ctx.lineTo(6, -11);
  ctx.lineTo(7, -7);
  ctx.lineTo(-7, -7);
  ctx.closePath();
  ctx.fill();
  if (g.armor > 0) {
    ctx.fillStyle = metal;
    roundRect(ctx, -5.5, -22.5, 11, 9, 3);
    ctx.fill();
    ctx.fillStyle = shade(metal, -0.3);
    ctx.fillRect(-5.5, -15, 11, 1.5);
    if (g.armor >= 3) {
      ctx.fillStyle = shade(metal, 0.3);
      ctx.fillRect(-3, -21, 2, 5);
    }
  }
  ctx.fillStyle = '#4a2e1a';
  ctx.fillRect(-6, -12, 12, 2);
  if (g.armor >= 5) {
    ctx.fillStyle = '#b3262e';
    ctx.beginPath();
    ctx.moveTo(-5, -22);
    ctx.lineTo(-11, -6 + walk);
    ctx.lineTo(-4, -8);
    ctx.closePath();
    ctx.fill();
  }
  // голова и шлем
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0.5, -28, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(0.5, -29, 6.2, Math.PI * 1.05, Math.PI * 1.95 + 0.2);
  ctx.lineTo(6.5, -27);
  ctx.lineTo(-5.5, -27);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(metal, -0.35);
  ctx.fillRect(1.5, -28.5, 5, 1.6);
  // гребень
  ctx.fillStyle = shade(g.color, 0.15);
  ctx.beginPath();
  ctx.moveTo(-5, -33);
  ctx.quadraticCurveTo(0, -41, 5, -34);
  ctx.quadraticCurveTo(0, -37, -5, -33);
  ctx.fill();
  // меч
  const blade = BLADE[Math.min(BLADE.length - 1, g.weapon)];
  if (!lying && !kneel && !sit) {
    const swing = g.swing > 0 ? Math.sin((1 - g.swing / 0.3) * Math.PI) : 0;
    ctx.save();
    ctx.translate(6, -16);
    ctx.rotate(-0.9 + swing * 2.1);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(-1, -4, 2, 4);
    ctx.fillStyle = shade(blade, -0.2);
    ctx.fillRect(-3, -5, 6, 1.6);
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(-1.3, -5);
    ctx.lineTo(1.3, -5);
    ctx.lineTo(1, -16);
    ctx.lineTo(0, -18);
    ctx.lineTo(-1, -16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (kneel) {
    // поднятая рука — сдаётся
    ctx.fillStyle = skin;
    ctx.fillRect(4, -30, 2.5, 12);
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(5, -36, 7, 5);
  }
  ctx.restore();
  if (g.flash > 0 && !lying) {
    ctx.fillStyle = 'rgba(255,70,50,' + (g.flash * 2.5).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(g.x, g.y - 20 * size, 13 * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawLabel(ctx, g, scene, highlight) {
  const fate = scene === 'arena' ? g.fate : null;
  const pose = scene === 'ludus' && !g.walking ? g.pose : null;
  const lying = fate === 'down' || fate === 'dead' || pose === 'lie';
  // на скамьях и койках соседи рядом — подписи через одну выше, чтобы не налезали
  const stagger = pose && g.seat !== null && g.seat !== undefined && g.seat % 2 ? 15 : 0;
  const top = g.y - (lying ? 20 : pose === 'sit' ? 37 : 43) * FIGURE[scene] - stagger;
  ctx.font = '700 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lvl = String(g.level);
  const nameW = ctx.measureText(g.name).width;
  ctx.font = '900 10px ' + FONT;
  const lvlW = ctx.measureText(lvl).width + 8;
  const w = nameW + lvlW + 4, x0 = g.x - w / 2;
  ctx.fillStyle = highlight ? 'rgba(255,205,56,.92)' : 'rgba(20,16,30,.72)';
  roundRect(ctx, x0 - 3, top - 12, w + 6, 16, 6);
  ctx.fill();
  ctx.fillStyle = g.color;
  roundRect(ctx, x0, top - 10, lvlW, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#10131a';
  ctx.fillText(lvl, x0 + lvlW / 2, top);
  ctx.font = '700 12px ' + FONT;
  ctx.fillStyle = highlight ? '#2a1a02' : fate === 'dead' ? '#c9c2b8' : '#fff';
  ctx.fillText(g.name, x0 + lvlW + 2 + nameW / 2, top + 1);
  if (fate === 'dead') return;
  const hpMax = maxHp(g), part = Math.max(0, Math.min(1, g.hp / hpMax));
  const bw = 34, bx = g.x - bw / 2, by = top + 6;
  ctx.fillStyle = 'rgba(20,16,30,.8)';
  ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
  ctx.fillStyle = part > 0.5 ? '#4ade80' : part > 0.25 ? '#fbbf24' : '#f87171';
  ctx.fillRect(bx, by, bw * part, 4);
}

export function drawMark(ctx, g, fate) {
  const x = g.x, y = g.y - 40;
  if (fate === 'dead') {
    ctx.font = '22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('☠', x, y);
  }
}

export { roundRect, shade, FONT, hashOf };
